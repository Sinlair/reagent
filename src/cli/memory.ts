import { consumePositionals, getBooleanFlag, getIntegerFlag, getStringFlag, type ParsedOptions } from "./args.js";
import type {
  MemoryCompactionResult,
  MemoryFileContent,
  MemoryFileSummary,
  MemoryPolicy,
  MemoryRecallResult,
  MemorySearchResult,
  MemoryStatus,
} from "../types/memory.js";
import type { JobRuntimeRunAuditEntry, JobRuntimeSnapshot } from "../services/jobRuntimeObservabilityService.js";

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

type MemoryCompactionsPayload = {
  items: any[];
};

type MemorySearchPayload = {
  query: string;
  results: MemorySearchResult[];
};

type MemorySchedulerRunsPayload = {
  items: JobRuntimeRunAuditEntry[];
};

export interface MemoryCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  renderMemoryHelp(): void;
  printMemoryStatus(status: MemoryStatus): void;
  printMemoryFiles(files: MemoryFileSummary[]): void;
  printMemoryFile(file: MemoryFileContent): void;
  printMemorySearchResults(results: MemorySearchResult[]): void;
  printMemoryRecallResults(result: MemoryRecallResult): void;
  printMemoryCompactionResult(result: MemoryCompactionResult): void;
  printCompactionRecords(items: any[]): void;
  printJobRuntimeSnapshot(snapshot: JobRuntimeSnapshot): void;
  printJobRuntimeRuns(items: JobRuntimeRunAuditEntry[]): void;
  getQueryInput(options: ParsedOptions): string;
  formatYesNo(value: boolean): string;
}

export function createMemoryCli(deps: MemoryCliDeps) {
  async function memoryStatusCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const status = await deps.requestGatewayJson<MemoryStatus>(context.baseUrl, "/api/memory/status", {
      timeoutMs: context.timeoutMs,
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson(status);
      return;
    }

    deps.printMemoryStatus(status);
  }

  async function memoryFilesCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const files = await deps.requestGatewayJson<MemoryFileSummary[]>(context.baseUrl, "/api/memory/files", {
      timeoutMs: context.timeoutMs,
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson(files);
      return;
    }

    deps.printMemoryFiles(files);
  }

  async function memoryFileCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const targetPath = getStringFlag(options, "path") ?? options.positionals.join(" ").trim();
    if (!targetPath) {
      throw new Error("memory file requires a path.");
    }

    const file = await deps.requestGatewayJson<MemoryFileContent>(
      context.baseUrl,
      `/api/memory/file?${deps.buildQueryString({ path: targetPath })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(file);
      return;
    }

    deps.printMemoryFile(file);
  }

  async function memorySearchCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const query = deps.getQueryInput(options);
    if (!query) {
      throw new Error("memory search requires a query. Example: reagent memory search model routing");
    }

    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 6, 20));
    const payload = await deps.requestGatewayJson<MemorySearchPayload>(
      context.baseUrl,
      `/api/memory/search?${deps.buildQueryString({ q: query, limit })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    console.log(`Query: ${payload.query}`);
    console.log("");
    deps.printMemorySearchResults(payload.results);
  }

  async function memoryRecallCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const query = deps.getQueryInput(options);
    if (!query) {
      throw new Error("memory recall requires a query. Example: reagent memory recall prior research choices");
    }

    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 6, 20));
    const payload = await deps.requestGatewayJson<MemoryRecallResult>(
      context.baseUrl,
      `/api/memory/recall?${deps.buildQueryString({
        q: query,
        limit,
        includeWorkspace: getBooleanFlag(options, "include-workspace"),
        includeArtifacts: getBooleanFlag(options, "include-artifacts"),
      })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    console.log(`Query: ${payload.query}`);
    console.log(`Generated: ${payload.generatedAt}`);
    console.log("");
    deps.printMemoryRecallResults(payload);
  }

  async function memoryRememberCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const scope = getStringFlag(options, "scope") ?? "daily";
    if (scope !== "daily" && scope !== "long-term") {
      throw new Error(`Unsupported memory scope: ${scope}. Use "daily" or "long-term".`);
    }

    const content = getStringFlag(options, "content") ?? options.positionals.join(" ").trim();
    if (!content) {
      throw new Error("memory remember requires content. Example: reagent memory remember The user prefers evidence-led reports");
    }

    const title = getStringFlag(options, "title");
    const source = getStringFlag(options, "source");
    const body = {
      scope,
      content,
      ...(title ? { title } : {}),
      ...(source ? { source } : {}),
    };
    const result = await deps.requestGatewayJson<MemoryFileContent>(context.baseUrl, "/api/memory/remember", {
      method: "POST",
      body,
      timeoutMs: context.timeoutMs,
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    deps.printMemoryFile(result);
  }

  async function memoryPolicyCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const result = await deps.requestGatewayJson<MemoryPolicy>(context.baseUrl, "/api/memory/policy", {
      timeoutMs: context.timeoutMs,
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    console.log(`Updated: ${result.updatedAt}`);
    console.log(`Auto compaction: ${deps.formatYesNo(result.autoCompactionEnabled)}`);
    console.log(`Interval minutes: ${result.autoCompactionIntervalMinutes}`);
    console.log(`Older than days: ${result.autoCompactionOlderThanDays}`);
    console.log(`Min entries: ${result.autoCompactionMinEntries}`);
    console.log(`Max entries: ${result.autoCompactionMaxEntries}`);
    console.log(`Max daily entries before auto compact: ${result.maxDailyEntriesBeforeAutoCompact}`);
    console.log(`High-confidence long-term only: ${deps.formatYesNo(result.highConfidenceLongTermOnly)}`);
    console.log(`Never compact tags: ${result.neverCompactTags.join(", ") || "-"}`);
  }

  async function memoryCompactCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const olderThanDays = getIntegerFlag(options, "older-than-days");
    const minEntries = getIntegerFlag(options, "min-entries");
    const maxEntries = getIntegerFlag(options, "max-entries");
    const body = {
      ...(olderThanDays !== undefined ? { olderThanDays } : {}),
      ...(minEntries !== undefined ? { minEntries } : {}),
      ...(maxEntries !== undefined ? { maxEntries } : {}),
      ...(getBooleanFlag(options, "dry-run") ? { dryRun: true } : {}),
    };
    const result = await deps.requestGatewayJson<MemoryCompactionResult>(context.baseUrl, "/api/memory/compact", {
      method: "POST",
      body,
      timeoutMs: context.timeoutMs,
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    deps.printMemoryCompactionResult(result);
  }

  async function memoryCompactionsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
    const payload = await deps.requestGatewayJson<MemoryCompactionsPayload>(
      context.baseUrl,
      `/api/memory/compactions?${deps.buildQueryString({ limit })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printCompactionRecords(payload.items);
  }

  async function memorySchedulerRuntimeCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<JobRuntimeSnapshot>(
      context.baseUrl,
      "/api/memory/compaction-scheduler/runtime",
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printJobRuntimeSnapshot(payload);
  }

  async function memorySchedulerRunsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
    const payload = await deps.requestGatewayJson<MemorySchedulerRunsPayload>(
      context.baseUrl,
      `/api/memory/compaction-scheduler/runs?${deps.buildQueryString({ limit })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printJobRuntimeRuns(payload.items);
  }

  async function memoryCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderMemoryHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "status") {
      await memoryStatusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderMemoryHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);

    if (subcommand === "files") {
      await memoryFilesCommand(subOptions);
      return;
    }
    if (subcommand === "file") {
      await memoryFileCommand(subOptions);
      return;
    }
    if (subcommand === "search") {
      await memorySearchCommand(subOptions);
      return;
    }
    if (subcommand === "recall") {
      await memoryRecallCommand(subOptions);
      return;
    }
    if (subcommand === "remember") {
      await memoryRememberCommand(subOptions);
      return;
    }
    if (subcommand === "policy") {
      await memoryPolicyCommand(subOptions);
      return;
    }
    if (subcommand === "compact") {
      await memoryCompactCommand(subOptions);
      return;
    }
    if (subcommand === "compactions") {
      await memoryCompactionsCommand(subOptions);
      return;
    }
    if (subcommand === "scheduler") {
      const schedulerSubcommand = subOptions.positionals[0];
      if (schedulerSubcommand === "runtime") {
        await memorySchedulerRuntimeCommand(consumePositionals(subOptions, 1));
        return;
      }
      if (schedulerSubcommand === "runs") {
        await memorySchedulerRunsCommand(consumePositionals(subOptions, 1));
        return;
      }
      throw new Error(`Unknown memory scheduler command: ${schedulerSubcommand ?? "(missing)"}`);
    }

    throw new Error(`Unknown memory command: ${subcommand}`);
  }

  return {
    memoryStatusCommand,
    memoryFilesCommand,
    memoryFileCommand,
    memorySearchCommand,
    memoryRecallCommand,
    memoryRememberCommand,
    memoryPolicyCommand,
    memoryCompactCommand,
    memoryCompactionsCommand,
    memorySchedulerRuntimeCommand,
    memorySchedulerRunsCommand,
    memoryCommand,
  };
}
