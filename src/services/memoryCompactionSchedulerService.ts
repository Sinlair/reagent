import type { FastifyBaseLogger } from "fastify";

import type { MemoryCompactionResult } from "../types/memory.js";
import { JobRuntimeObservabilityService } from "./jobRuntimeObservabilityService.js";
import { JobRuntimeService } from "./jobRuntimeService.js";
import { MemoryCompactionService } from "./memoryCompactionService.js";

export class MemoryCompactionSchedulerService {
  private readonly observability: JobRuntimeObservabilityService;
  private readonly runtime: JobRuntimeService<MemoryCompactionResult | null>;

  constructor(
    workspaceDir: string,
    private readonly memoryCompactionService: MemoryCompactionService,
    private readonly logger?: FastifyBaseLogger,
  ) {
    this.observability = new JobRuntimeObservabilityService(workspaceDir);
    this.runtime = new JobRuntimeService<MemoryCompactionResult | null>({
      jobName: "memory-auto-compaction",
      logger,
      scheduledErrorMessage: "Memory auto-compaction failed.",
      observers: [this.observability],
      classifyResult: (result) =>
        result?.compactedEntryCount
          ? {
              state: "completed",
              summary: `Compacted ${result.compactedEntryCount} memory entries.`,
              metadata: {
                compactedEntryCount: result.compactedEntryCount,
                ...(result.summaryTitle ? { summaryTitle: result.summaryTitle } : {}),
              },
            }
          : {
              state: "skipped",
              summary: "No memory entries required compaction.",
            },
      onRun: async () => {
        const result = await this.memoryCompactionService.maybeAutoCompact();
        if (result?.compactedEntryCount) {
          this.logger?.info(
            { compactedEntryCount: result.compactedEntryCount, summaryTitle: result.summaryTitle },
            "Memory auto-compaction completed.",
          );
        }
        return result;
      },
      onBusyReturn: () => null,
      onScheduledErrorReturn: () => null,
    });
  }

  async getRuntimeSnapshot() {
    return this.observability.getSnapshot("memory-auto-compaction");
  }

  async listRecentRuns(limit = 20) {
    return this.observability.listRecentRuns("memory-auto-compaction", limit);
  }

  private async runOnce(): Promise<MemoryCompactionResult | null> {
    return this.runtime.runDirect();
  }

  async start(): Promise<void> {
    await this.stop();
    const policy = await this.memoryCompactionService.getPolicy();
    if (!policy.autoCompactionEnabled) {
      this.logger?.info("Memory auto-compaction scheduler is disabled by policy.");
      return;
    }

    const intervalMs = Math.max(5, policy.autoCompactionIntervalMinutes) * 60_000;
    await this.runtime.start({
      intervalMs,
      immediate: true,
    });
    this.logger?.info({ intervalMinutes: policy.autoCompactionIntervalMinutes }, "Memory auto-compaction scheduler started.");
  }

  async refresh(): Promise<void> {
    await this.start();
  }

  async stop(): Promise<void> {
    const wasStarted = this.runtime.isStarted();
    await this.runtime.stop();
    if (wasStarted) {
      this.logger?.info("Memory auto-compaction scheduler stopped.");
    }
  }
}
