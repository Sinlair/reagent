import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  consumePositionals,
  getBooleanFlag,
  getIntegerFlag,
  getOptionalBooleanFlag,
  getStringFlag,
  type ParsedOptions,
} from "./args.js";
import {
  dispatchResearchDirectionCommand as runResearchDirectionCommandDispatch,
  dispatchResearchDiscoveryCommand as runResearchDiscoveryCommandDispatch,
} from "./dispatch.js";
import type { JobRuntimeRunAuditEntry, JobRuntimeSnapshot } from "../services/jobRuntimeObservabilityService.js";
import type {
  ResearchDirectionProfile,
  ResearchDiscoveryQueryCandidate,
} from "../types/researchDirection.js";
import type {
  ResearchDiscoveryRunResult,
  ResearchDiscoveryRunSummary,
} from "../types/researchDiscovery.js";
import type { ResearchDiscoverySchedulerStatus } from "../types/researchDiscoveryScheduler.js";

type GatewayContextLike = {
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

type ResearchDirectionsPayload = {
  profiles: ResearchDirectionProfile[];
};

type ResearchDiscoveryPlanPayload = {
  candidates: ResearchDiscoveryQueryCandidate[];
};

type ResearchDiscoveryRecentPayload = {
  runs: ResearchDiscoveryRunSummary[];
};

type ResearchDirectionPlanPayload = {
  profile: ResearchDirectionProfile;
  candidates: ResearchDiscoveryQueryCandidate[];
};

type ResearchDiscoverySchedulerTickPayload = {
  results: ResearchDiscoveryRunResult[];
  status: ResearchDiscoverySchedulerStatus;
};

type ResearchDiscoverySchedulerRunsPayload = {
  items: JobRuntimeRunAuditEntry[];
};

export interface ResearchDirectionDiscoveryCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  requestGatewayText(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<string>;
  requestGatewayResponse(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<Response>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  printResearchDirections(profiles: ResearchDirectionProfile[]): void;
  printResearchDirection(profile: ResearchDirectionProfile): void;
  printResearchDiscoveryPlan(candidates: ResearchDiscoveryQueryCandidate[]): void;
  printResearchDiscoveryRuns(runs: ResearchDiscoveryRunSummary[]): void;
  printResearchDiscoveryRun(run: ResearchDiscoveryRunResult): void;
  printResearchSchedulerStatus(status: ResearchDiscoverySchedulerStatus): void;
  printJobRuntimeSnapshot(snapshot: JobRuntimeSnapshot): void;
  printJobRuntimeRuns(items: JobRuntimeRunAuditEntry[]): void;
  resolveRequiredEntityId(options: ParsedOptions, label: string): string;
  parseCommaSeparatedValues(raw: string | undefined): string[];
  readInputSource(source: string): Promise<string>;
  renderResearchHelp(): void;
}

export function createResearchDirectionDiscoveryCli(deps: ResearchDirectionDiscoveryCliDeps) {
  async function researchDirectionsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchDirectionsPayload>(
      context.baseUrl,
      "/api/research/directions",
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDirections(payload.profiles);
  }

  async function researchDirectionGetCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const directionId = deps.resolveRequiredEntityId(options, "research direction");
    const profile = await deps.requestGatewayJson<ResearchDirectionProfile>(
      context.baseUrl,
      `/api/research/directions/${encodeURIComponent(directionId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(profile);
      return;
    }
    deps.printResearchDirection(profile);
  }

  async function researchDirectionUpsertCommand(options: ParsedOptions): Promise<void> {
    const source = options.positionals[0]?.trim();
    if (!source) {
      throw new Error("research direction upsert requires a JSON file path or '-' for stdin.");
    }

    const raw = await deps.readInputSource(source);
    const payload = raw.trim() ? (JSON.parse(raw) as unknown) : {};
    const context = await deps.resolveGatewayContext(options);
    const result = await deps.requestGatewayJson<ResearchDirectionProfile>(
      context.baseUrl,
      "/api/research/directions",
      {
        method: "POST",
        body: payload,
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ source, profile: result });
      return;
    }
    deps.printResearchDirection(result);
  }

  async function researchDirectionBriefCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const directionId = deps.resolveRequiredEntityId(options, "research direction");
    const markdown = await deps.requestGatewayText(
      context.baseUrl,
      `/api/research/directions/${encodeURIComponent(directionId)}/brief-markdown`,
      { timeoutMs: context.timeoutMs },
    );
    const outPath = getStringFlag(options, "out");

    if (outPath) {
      const resolvedOutPath = path.resolve(process.cwd(), outPath);
      await mkdir(path.dirname(resolvedOutPath), { recursive: true });
      await writeFile(resolvedOutPath, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");
      if (getBooleanFlag(options, "json")) {
        deps.printJson({ directionId, outPath: resolvedOutPath });
        return;
      }
      console.log(`Wrote research brief to ${resolvedOutPath}`);
      return;
    }

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ directionId, markdown });
      return;
    }
    process.stdout.write(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  }

  async function researchDirectionPlanCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const directionId = deps.resolveRequiredEntityId(options, "research direction");
    const payload = await deps.requestGatewayJson<ResearchDirectionPlanPayload>(
      context.baseUrl,
      `/api/research/directions/${encodeURIComponent(directionId)}/plan`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printResearchDirection(payload.profile);
    console.log("");
    deps.printResearchDiscoveryPlan(payload.candidates);
  }

  async function researchDirectionImportBriefCommand(options: ParsedOptions): Promise<void> {
    const source = options.positionals[0]?.trim();
    if (!source) {
      throw new Error("research direction import-brief requires a markdown file path or '-' for stdin.");
    }

    const markdown = await deps.readInputSource(source);
    const directionId = getStringFlag(options, "id");
    const context = await deps.resolveGatewayContext(options);
    const profile = await deps.requestGatewayJson<ResearchDirectionProfile>(
      context.baseUrl,
      "/api/research/directions/import-markdown",
      {
        method: "POST",
        body: {
          markdown,
          ...(directionId ? { id: directionId } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ source, profile });
      return;
    }
    deps.printResearchDirection(profile);
  }

  async function researchDirectionDeleteCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const directionId = deps.resolveRequiredEntityId(options, "research direction");
    await deps.requestGatewayResponse(
      context.baseUrl,
      `/api/research/directions/${encodeURIComponent(directionId)}`,
      {
        method: "DELETE",
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ directionId, deleted: true });
      return;
    }
    console.log(`Deleted research direction ${directionId}`);
  }

  async function researchDirectionCommand(options: ParsedOptions): Promise<void> {
    await runResearchDirectionCommandDispatch(options, {
      renderResearchHelp: deps.renderResearchHelp,
      researchDirectionGetCommand,
      researchDirectionUpsertCommand,
      researchDirectionBriefCommand,
      researchDirectionPlanCommand,
      researchDirectionImportBriefCommand,
      researchDirectionDeleteCommand,
    });
  }

  async function researchDiscoveryPlanCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const directionId = getStringFlag(options, "direction", "id") ?? options.positionals[0];
    const payload = await deps.requestGatewayJson<ResearchDiscoveryPlanPayload>(
      context.baseUrl,
      `/api/research/discovery-plan?${deps.buildQueryString({
        ...(directionId?.trim() ? { directionId: directionId.trim() } : {}),
      })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDiscoveryPlan(payload.candidates);
  }

  async function researchDiscoveryRecentCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 10;
    const payload = await deps.requestGatewayJson<ResearchDiscoveryRecentPayload>(
      context.baseUrl,
      `/api/research/discovery/recent?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDiscoveryRuns(payload.runs);
  }

  async function researchDiscoveryInspectCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const runId = deps.resolveRequiredEntityId(options, "discovery run");
    const payload = await deps.requestGatewayJson<ResearchDiscoveryRunResult>(
      context.baseUrl,
      `/api/research/discovery/runs/${encodeURIComponent(runId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDiscoveryRun(payload);
  }

  async function researchDiscoveryRunCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const directionId = getStringFlag(options, "direction");
    const topK = getIntegerFlag(options, "top-k", "topK");
    const maxPapersPerQuery = getIntegerFlag(options, "max-papers-per-query", "max-papers");
    const senderId = getStringFlag(options, "sender");
    const senderName = getStringFlag(options, "name", "sender-name");
    const payload = await deps.requestGatewayJson<ResearchDiscoveryRunResult>(
      context.baseUrl,
      "/api/research/discovery/run",
      {
        method: "POST",
        body: {
          ...(directionId ? { directionId } : {}),
          ...(topK !== undefined ? { topK } : {}),
          ...(maxPapersPerQuery !== undefined ? { maxPapersPerQuery } : {}),
          ...(getBooleanFlag(options, "push", "push-to-wechat") ? { pushToWechat: true } : {}),
          ...(senderId ? { senderId } : {}),
          ...(senderName ? { senderName } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDiscoveryRun(payload);
  }

  async function researchDiscoverySchedulerStatusCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchDiscoverySchedulerStatus>(
      context.baseUrl,
      "/api/research/discovery/scheduler",
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchSchedulerStatus(payload);
  }

  async function researchDiscoverySchedulerSetCommand(options: ParsedOptions): Promise<void> {
    const enabled =
      getOptionalBooleanFlag(options, "enabled") ??
      (getBooleanFlag(options, "disable") ? false : undefined) ??
      (getBooleanFlag(options, "enable") ? true : undefined);
    const dailyTimeLocal = getStringFlag(options, "time", "daily-time", "dailyTimeLocal");
    const senderId = getStringFlag(options, "sender");
    const senderName = getStringFlag(options, "name", "sender-name");
    const directionIds = deps.parseCommaSeparatedValues(getStringFlag(options, "direction-ids", "directions"));
    const topK = getIntegerFlag(options, "top-k", "topK");
    const maxPapersPerQuery = getIntegerFlag(options, "max-papers-per-query", "max-papers");

    const body = {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(dailyTimeLocal ? { dailyTimeLocal } : {}),
      ...(senderId ? { senderId } : {}),
      ...(senderName ? { senderName } : {}),
      ...(directionIds.length > 0 ? { directionIds } : {}),
      ...(topK !== undefined ? { topK } : {}),
      ...(maxPapersPerQuery !== undefined ? { maxPapersPerQuery } : {}),
    };

    if (Object.keys(body).length === 0) {
      throw new Error("research discovery scheduler set requires at least one configuration flag.");
    }

    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchDiscoverySchedulerStatus>(
      context.baseUrl,
      "/api/research/discovery/scheduler",
      {
        method: "POST",
        body,
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchSchedulerStatus(payload);
  }

  async function researchDiscoverySchedulerTickCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchDiscoverySchedulerTickPayload>(
      context.baseUrl,
      "/api/research/discovery/scheduler/tick",
      {
        method: "POST",
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printResearchSchedulerStatus(payload.status);
    if (payload.results.length > 0) {
      console.log("");
      deps.printResearchDiscoveryRuns(
        payload.results.map((item) => ({
          runId: item.runId,
          generatedAt: item.generatedAt,
          directionIds: item.directionIds,
          directionLabels: item.directionLabels,
          topTitle: item.items[0]?.title,
          itemCount: item.items.length,
          pushed: item.pushed,
        })),
      );
    }
  }

  async function researchDiscoverySchedulerRuntimeCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<JobRuntimeSnapshot>(
      context.baseUrl,
      "/api/research/discovery/scheduler/runtime",
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printJobRuntimeSnapshot(payload);
  }

  async function researchDiscoverySchedulerRunsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 20;
    const payload = await deps.requestGatewayJson<ResearchDiscoverySchedulerRunsPayload>(
      context.baseUrl,
      `/api/research/discovery/scheduler/runs?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printJobRuntimeRuns(payload.items);
  }

  async function researchDiscoverySchedulerCommand(options: ParsedOptions): Promise<void> {
    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "status") {
      await researchDiscoverySchedulerStatusCommand(
        subcommand === undefined ? options : consumePositionals(options, 1),
      );
      return;
    }
    if (subcommand === "set" || subcommand === "configure") {
      await researchDiscoverySchedulerSetCommand(consumePositionals(options, 1));
      return;
    }
    if (subcommand === "tick") {
      await researchDiscoverySchedulerTickCommand(consumePositionals(options, 1));
      return;
    }
    if (subcommand === "runtime") {
      await researchDiscoverySchedulerRuntimeCommand(consumePositionals(options, 1));
      return;
    }
    if (subcommand === "runs") {
      await researchDiscoverySchedulerRunsCommand(consumePositionals(options, 1));
      return;
    }

    throw new Error(`Unknown research discovery scheduler command: ${subcommand}`);
  }

  async function researchDiscoveryCommand(options: ParsedOptions): Promise<void> {
    await runResearchDiscoveryCommandDispatch(options, {
      renderResearchHelp: deps.renderResearchHelp,
      researchDiscoveryRecentCommand,
      researchDiscoveryPlanCommand,
      researchDiscoveryInspectCommand,
      researchDiscoveryRunCommand,
      researchDiscoverySchedulerCommand,
    });
  }

  return {
    researchDirectionsCommand,
    researchDirectionGetCommand,
    researchDirectionUpsertCommand,
    researchDirectionBriefCommand,
    researchDirectionPlanCommand,
    researchDirectionImportBriefCommand,
    researchDirectionDeleteCommand,
    researchDirectionCommand,
    researchDiscoveryPlanCommand,
    researchDiscoveryRecentCommand,
    researchDiscoveryInspectCommand,
    researchDiscoveryRunCommand,
    researchDiscoverySchedulerStatusCommand,
    researchDiscoverySchedulerSetCommand,
    researchDiscoverySchedulerTickCommand,
    researchDiscoverySchedulerRuntimeCommand,
    researchDiscoverySchedulerRunsCommand,
    researchDiscoverySchedulerCommand,
    researchDiscoveryCommand,
  };
}
