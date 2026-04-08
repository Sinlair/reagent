import type { FastifyBaseLogger } from "fastify";

import type { MemoryCompactionResult } from "../types/memory.js";
import { MemoryCompactionService } from "./memoryCompactionService.js";

export class MemoryCompactionSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly memoryCompactionService: MemoryCompactionService,
    private readonly logger?: FastifyBaseLogger,
  ) {}

  private async runOnce(): Promise<MemoryCompactionResult | null> {
    if (this.running) {
      return null;
    }

    this.running = true;
    try {
      const result = await this.memoryCompactionService.maybeAutoCompact();
      if (result?.compactedEntryCount) {
        this.logger?.info(
          { compactedEntryCount: result.compactedEntryCount, summaryTitle: result.summaryTitle },
          "Memory auto-compaction completed.",
        );
      }
      return result;
    } catch (error) {
      this.logger?.error({ err: error }, "Memory auto-compaction failed.");
      return null;
    } finally {
      this.running = false;
    }
  }

  async start(): Promise<void> {
    await this.stop();
    const policy = await this.memoryCompactionService.getPolicy();
    if (!policy.autoCompactionEnabled) {
      this.logger?.info("Memory auto-compaction scheduler is disabled by policy.");
      return;
    }

    const intervalMs = Math.max(5, policy.autoCompactionIntervalMinutes) * 60_000;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref();
    this.logger?.info({ intervalMinutes: policy.autoCompactionIntervalMinutes }, "Memory auto-compaction scheduler started.");
    await this.runOnce();
  }

  async refresh(): Promise<void> {
    await this.start();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger?.info("Memory auto-compaction scheduler stopped.");
    }
  }
}
