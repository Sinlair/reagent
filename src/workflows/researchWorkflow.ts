import { randomUUID } from "node:crypto";

import type {
  LlmClient,
  PaperContentProvider,
  PaperSearchProvider,
  ResearchRepository
} from "../domain/ports.js";
import type {
  PaperCandidate,
  ResearchChunk,
  ResearchReport,
  ResearchRequest
} from "../types/research.js";
import type { ResearchTaskProgressUpdate } from "../types/researchTask.js";
import { rankPapers } from "./paperRanker.js";
import { critiqueResearch } from "./researchCritique.js";

export class ResearchWorkflow {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly paperSearchProvider: PaperSearchProvider,
    private readonly paperContentProvider: PaperContentProvider,
    private readonly researchRepository: ResearchRepository
  ) {}

  async run(
    request: ResearchRequest,
    options: {
      taskId?: string | undefined;
      onProgress?: ((update: ResearchTaskProgressUpdate) => void | Promise<void>) | undefined;
    } = {}
  ): Promise<ResearchReport> {
    const taskId = options.taskId ?? randomUUID();
    const normalizedRequest: ResearchRequest = {
      topic: request.topic.trim(),
      question: request.question?.trim(),
      maxPapers: request.maxPapers ?? 10
    };

    await options.onProgress?.({
      state: "planning",
      message: "Building research plan."
    });
    const plan = await this.llmClient.planResearch(normalizedRequest);

    let papers: PaperCandidate[] = [];
    let chunks: ResearchChunk[] = [];
    const warnings: string[] = [];

    try {
      await options.onProgress?.({
        state: "fetching",
        message: "Fetching candidate papers from discovery sources."
      });
      await options.onProgress?.({
        state: "normalizing",
        message: "Normalizing and deduplicating candidate papers."
      });
      await options.onProgress?.({
        state: "searching-paper",
        message: "Searching and ranking relevant papers."
      });
      papers = await this.paperSearchProvider.search({
        request: normalizedRequest,
        plan
      });
      papers = rankPapers({
        request: normalizedRequest,
        plan,
        papers
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown search error";
      warnings.push(`Paper search failed: ${message}`);
    }

    try {
      await options.onProgress?.({
        state: "downloading-paper",
        message: "Downloading paper files and related artifacts."
      });
      await options.onProgress?.({
        state: "parsing",
        message: "Parsing paper text, figures, and evidence snippets."
      });
      const contentResult = await this.paperContentProvider.collect({
        taskId,
        request: normalizedRequest,
        plan,
        papers
      });
      chunks = contentResult.chunks;
      warnings.push(...contentResult.warnings);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown content extraction error";
      warnings.push(`Paper content extraction failed: ${message}`);
    }

    await options.onProgress?.({
      state: "analyzing-paper",
      message: "Consolidating evidence and paper signals."
    });
    await options.onProgress?.({
      state: "generating-summary",
      message: "Generating final research synthesis."
    });
    const synthesis = await this.llmClient.synthesizeResearch({
      request: normalizedRequest,
      plan,
      papers,
      chunks
    });
    const critique = critiqueResearch({
      request: normalizedRequest,
      papers,
      chunks,
      synthesis
    });

    const report: ResearchReport = {
      taskId,
      topic: normalizedRequest.topic,
      question: normalizedRequest.question,
      generatedAt: new Date().toISOString(),
      plan,
      papers,
      chunks,
      summary: synthesis.summary,
      findings: synthesis.findings,
      gaps: synthesis.gaps,
      nextActions: synthesis.nextActions,
      evidence: synthesis.evidence,
      warnings: [...warnings, ...synthesis.warnings],
      critique
    };

    await options.onProgress?.({
      state: "persisting",
      message: "Persisting report and evidence."
    });
    await this.researchRepository.save(report);

    return report;
  }
}

