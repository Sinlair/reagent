import { z } from "zod";

import type { LlmClient } from "../../domain/ports.js";
import { OpenAiCompatClient, type OpenAiCompatClientShape, type OpenAiWireApi } from "./openAiCompatClient.js";
import { ResearchPlanSchema, ResearchSynthesisSchema } from "../../schemas/researchSchema.js";
import type {
  PaperCandidate,
  ResearchChunk,
  ResearchPlan,
  ResearchRequest,
  ResearchSynthesis
} from "../../types/research.js";

interface RepairContext {
  rawText: string;
  reason: string;
}

const MAX_RESPONSE_ATTEMPTS = 2;

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "").trim();
}

function buildJsonCandidates(raw: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const pushCandidate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  const stripped = stripCodeFence(raw);
  pushCandidate(raw);
  pushCandidate(stripped);

  for (const source of [raw, stripped]) {
    const firstBrace = source.indexOf("{");
    const lastBrace = source.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      pushCandidate(source.slice(firstBrace, lastBrace + 1));
    }
  }

  return candidates;
}

function parseJsonResponse(raw: string): unknown {
  if (!raw.trim()) {
    throw new Error("OpenAI returned an empty response.");
  }

  let lastError: unknown;
  for (const candidate of buildJsonCandidates(raw)) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("OpenAI response did not contain a valid JSON object.");
}

function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildInput(systemPrompt: string, userPayload: string, repairContext?: RepairContext): string {
  const parts = [systemPrompt, "", "Payload:", userPayload];

  if (repairContext) {
    parts.push(
      "",
      "The previous response was invalid.",
      `Reason: ${repairContext.reason}`,
      "Previous response:",
      repairContext.rawText,
      "",
      "Return corrected JSON only. Do not include markdown fences or commentary."
    );
  }

  return parts.join("\n");
}

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAiCompatClient;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseURL?: string,
    client?: OpenAiCompatClientShape,
    private readonly wireApi: OpenAiWireApi = "responses",
  ) {
    this.client = new OpenAiCompatClient(this.apiKey, this.model, this.wireApi, this.baseURL, client);
  }

  async planResearch(request: ResearchRequest): Promise<ResearchPlan> {
    return this.requestJson({
      schemaName: "ResearchPlan",
      schema: ResearchPlanSchema,
      systemPrompt: [
        "You are a research planning agent.",
        "Return valid JSON only.",
        "Shape:",
        '{"objective":"string","subquestions":["string"],"searchQueries":["string"]}'
      ].join("\n"),
      userPayload: JSON.stringify(request)
    });
  }

  async synthesizeResearch(input: {
    request: ResearchRequest;
    plan: ResearchPlan;
    papers: PaperCandidate[];
    chunks: ResearchChunk[];
  }): Promise<ResearchSynthesis> {
    return this.requestJson({
      schemaName: "ResearchSynthesis",
      schema: ResearchSynthesisSchema,
      systemPrompt: [
        "You are a literature-review synthesis agent.",
        "Use only the supplied papers and chunks.",
        "Every evidence item must cite a valid paperId and chunkId from the payload.",
        'If a chunk has sourceType "pdf" and pageNumber, preserve that metadata in the evidence item.',
        "Return valid JSON only.",
        "Shape:",
        '{"summary":"string","findings":["string"],"gaps":["string"],"nextActions":["string"],"evidence":[{"claim":"string","paperId":"string","chunkId":"string","support":"string","quote":"string","pageNumber":1,"sourceType":"abstract|pdf","confidence":"low|medium|high"}],"warnings":["string"]}'
      ].join("\n"),
      userPayload: JSON.stringify(input)
    });
  }

  private async requestJson<T>(params: {
    schemaName: string;
    schema: z.ZodType<T>;
    systemPrompt: string;
    userPayload: string;
  }): Promise<T> {
    let repairContext: RepairContext | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RESPONSE_ATTEMPTS; attempt += 1) {
      const text = await this.client.createText({
        systemPrompt: params.systemPrompt,
        userPayload: params.userPayload,
        ...(repairContext ? { repairContext } : {})
      });

      try {
        const parsed = parseJsonResponse(text);
        return params.schema.parse(parsed);
      } catch (error) {
        lastError = error;
        repairContext = {
          rawText: text,
          reason: describeError(error)
        };
      }
    }

    throw new Error(
      `OpenAI ${params.schemaName} response was invalid after ${MAX_RESPONSE_ATTEMPTS} attempts: ${describeError(lastError)}`
    );
  }
}
