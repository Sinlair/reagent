import type { FastifyBaseLogger } from "fastify";

import type {
  JobRuntimeObserver,
  JobRuntimeRunClassification,
} from "./jobRuntimeObservabilityService.js";

export interface JobRuntimeServiceOptions<TResult> {
  jobName: string;
  onRun(): Promise<TResult>;
  onBusyReturn(): TResult;
  onScheduledErrorReturn(error: unknown): TResult;
  classifyResult?(result: TResult): JobRuntimeRunClassification;
  observers?: JobRuntimeObserver[] | undefined;
  logger?: FastifyBaseLogger | undefined;
  scheduledErrorMessage?: string | undefined;
}

export class JobRuntimeService<TResult> {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: JobRuntimeServiceOptions<TResult>) {}

  isStarted(): boolean {
    return Boolean(this.timer);
  }

  async runDirect(): Promise<TResult> {
    if (this.running) {
      return this.options.onBusyReturn();
    }

    const startedAt = new Date().toISOString();
    this.running = true;
    try {
      await this.emitRunStarted("manual", startedAt);
      const result = await this.options.onRun();
      await this.emitRunFinished("manual", startedAt, result);
      return result;
    } catch (error) {
      await this.emitRunFailed("manual", startedAt, error);
      throw error;
    } finally {
      this.running = false;
    }
  }

  async start(input: {
    intervalMs: number;
    immediate?: boolean | undefined;
  }): Promise<void> {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runScheduled();
    }, input.intervalMs);
    this.timer.unref?.();

    if (input.immediate !== false) {
      await this.runScheduled();
    }
  }

  async stop(): Promise<void> {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async runScheduled(): Promise<TResult> {
    if (this.running) {
      return this.options.onBusyReturn();
    }

    const startedAt = new Date().toISOString();
    this.running = true;
    try {
      await this.emitRunStarted("scheduled", startedAt);
      const result = await this.options.onRun();
      await this.emitRunFinished("scheduled", startedAt, result);
      return result;
    } catch (error) {
      await this.emitRunFailed("scheduled", startedAt, error);
      this.options.logger?.error(
        { err: error, jobName: this.options.jobName },
        this.options.scheduledErrorMessage ?? `${this.options.jobName} failed.`,
      );
      return this.options.onScheduledErrorReturn(error);
    } finally {
      this.running = false;
    }
  }

  private async emitRunStarted(trigger: "manual" | "scheduled", startedAt: string): Promise<void> {
    for (const observer of this.options.observers ?? []) {
      await observer.onRunStarted?.({
        jobName: this.options.jobName,
        trigger,
        startedAt,
      });
    }
  }

  private async emitRunFinished(trigger: "manual" | "scheduled", startedAt: string, result: TResult): Promise<void> {
    const classification = this.options.classifyResult?.(result) ?? {
      state: "completed",
    };
    const finishedAt = new Date().toISOString();

    for (const observer of this.options.observers ?? []) {
      await observer.onRunFinished?.({
        jobName: this.options.jobName,
        trigger,
        startedAt,
        finishedAt,
        state: classification.state,
        ...(classification.summary ? { summary: classification.summary } : {}),
        ...(classification.metadata ? { metadata: classification.metadata } : {}),
      });
    }
  }

  private async emitRunFailed(trigger: "manual" | "scheduled", startedAt: string, error: unknown): Promise<void> {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);

    for (const observer of this.options.observers ?? []) {
      await observer.onRunFailed?.({
        jobName: this.options.jobName,
        trigger,
        startedAt,
        finishedAt,
        error: message,
      });
    }
  }
}
