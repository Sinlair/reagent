import {
  getBooleanFlag,
  getIntegerFlag,
  getStringFlag,
  type ParsedOptions,
} from "./args.js";
import { dispatchResearchCandidateCommand } from "./dispatch.js";
import type {
  ResearchEvolutionCandidate,
  ResearchEvolutionCandidateApplyOutcome,
  ResearchEvolutionCandidateRollbackOutcome,
} from "../types/researchEvolutionCandidate.js";

type GatewayContextLike = {
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
};

type ResearchEvolutionCandidatesPayload = {
  candidates: ResearchEvolutionCandidate[];
};

export interface ResearchCandidatesCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  resolveRequiredEntityId(options: ParsedOptions, label: string): string;
  printResearchEvolutionCandidates(items: ResearchEvolutionCandidate[]): void;
  printResearchEvolutionCandidate(item: ResearchEvolutionCandidate): void;
  printResearchEvolutionCandidateApplyOutcome(outcome: ResearchEvolutionCandidateApplyOutcome): void;
  printResearchEvolutionCandidateRollbackOutcome(outcome: ResearchEvolutionCandidateRollbackOutcome): void;
}

export function createResearchCandidatesCli(deps: ResearchCandidatesCliDeps) {
  async function researchCandidatesCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 20;
    const status = getStringFlag(options, "status");
    const type = getStringFlag(options, "type");
    const payload = await deps.requestGatewayJson<ResearchEvolutionCandidatesPayload>(
      context.baseUrl,
      `/api/research/candidates?${deps.buildQueryString({ limit, status, type })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchEvolutionCandidates(payload.candidates);
  }

  async function researchCandidateGetCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const candidateId = deps.resolveRequiredEntityId(options, "evolution candidate");
    const payload = await deps.requestGatewayJson<ResearchEvolutionCandidate>(
      context.baseUrl,
      `/api/research/candidates/${encodeURIComponent(candidateId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchEvolutionCandidate(payload);
  }

  async function researchCandidateGenerateCommand(options: ParsedOptions): Promise<void> {
    const reportId = getStringFlag(options, "report");
    const assetId = getStringFlag(options, "asset") ?? (!reportId ? options.positionals[0]?.trim() : undefined);
    if (Boolean(reportId) === Boolean(assetId)) {
      throw new Error("research candidate generate requires exactly one of --report <directionReportId> or --asset <moduleAssetId>.");
    }

    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchEvolutionCandidate>(
      context.baseUrl,
      reportId ? "/api/research/candidates/direction-preset" : "/api/research/candidates/workspace-skill",
      {
        method: "POST",
        body: reportId ? { reportId } : { assetId },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchEvolutionCandidate(payload);
  }

  async function reviewCandidate(
    options: ParsedOptions,
    decision: "reviewed" | "approved" | "rejected",
  ): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const candidateId = deps.resolveRequiredEntityId(options, "evolution candidate");
    const reviewer = getStringFlag(options, "reviewer");
    const notes = getStringFlag(options, "notes");
    const payload = await deps.requestGatewayJson<ResearchEvolutionCandidate>(
      context.baseUrl,
      `/api/research/candidates/${encodeURIComponent(candidateId)}/review`,
      {
        method: "POST",
        body: {
          decision,
          ...(reviewer ? { reviewer } : {}),
          ...(notes ? { notes } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchEvolutionCandidate(payload);
  }

  async function researchCandidateReviewCommand(options: ParsedOptions): Promise<void> {
    await reviewCandidate(options, "reviewed");
  }

  async function researchCandidateApproveCommand(options: ParsedOptions): Promise<void> {
    await reviewCandidate(options, "approved");
  }

  async function researchCandidateRejectCommand(options: ParsedOptions): Promise<void> {
    await reviewCandidate(options, "rejected");
  }

  async function researchCandidateApplyCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const candidateId = deps.resolveRequiredEntityId(options, "evolution candidate");
    const reviewer = getStringFlag(options, "reviewer");
    const notes = getStringFlag(options, "notes");
    const dryRun = getBooleanFlag(options, "dry-run", "dryRun");
    const payload = await deps.requestGatewayJson<ResearchEvolutionCandidateApplyOutcome>(
      context.baseUrl,
      `/api/research/candidates/${encodeURIComponent(candidateId)}/apply`,
      {
        method: "POST",
        body: {
          ...(dryRun ? { dryRun: true } : {}),
          ...(reviewer ? { reviewer } : {}),
          ...(notes ? { notes } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchEvolutionCandidateApplyOutcome(payload);
  }

  async function researchCandidateRollbackCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const candidateId = deps.resolveRequiredEntityId(options, "evolution candidate");
    const reviewer = getStringFlag(options, "reviewer");
    const notes = getStringFlag(options, "notes");
    const payload = await deps.requestGatewayJson<ResearchEvolutionCandidateRollbackOutcome>(
      context.baseUrl,
      `/api/research/candidates/${encodeURIComponent(candidateId)}/rollback`,
      {
        method: "POST",
        body: {
          ...(reviewer ? { reviewer } : {}),
          ...(notes ? { notes } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchEvolutionCandidateRollbackOutcome(payload);
  }

  async function researchCandidateCommand(options: ParsedOptions): Promise<void> {
    await dispatchResearchCandidateCommand(options, {
      researchCandidateGetCommand,
      researchCandidateGenerateCommand,
      researchCandidateReviewCommand,
      researchCandidateApproveCommand,
      researchCandidateRejectCommand,
      researchCandidateApplyCommand,
      researchCandidateRollbackCommand,
    });
  }

  return {
    researchCandidatesCommand,
    researchCandidateGetCommand,
    researchCandidateGenerateCommand,
    researchCandidateReviewCommand,
    researchCandidateApproveCommand,
    researchCandidateRejectCommand,
    researchCandidateApplyCommand,
    researchCandidateRollbackCommand,
    researchCandidateCommand,
  };
}
