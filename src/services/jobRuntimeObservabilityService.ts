import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface JobRuntimeRunClassification {
  state: "completed" | "skipped";
  summary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface JobRuntimeRunEvent {
  jobName: string;
  trigger: "manual" | "scheduled";
  startedAt: string;
}

export interface JobRuntimeRunFinishedEvent extends JobRuntimeRunEvent {
  finishedAt: string;
  state: "completed" | "skipped";
  summary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface JobRuntimeRunFailedEvent extends JobRuntimeRunEvent {
  finishedAt: string;
  error: string;
}

export interface JobRuntimeObserver {
  onRunStarted?(event: JobRuntimeRunEvent): Promise<void> | void;
  onRunFinished?(event: JobRuntimeRunFinishedEvent): Promise<void> | void;
  onRunFailed?(event: JobRuntimeRunFailedEvent): Promise<void> | void;
}

export interface JobRuntimeSnapshot {
  jobName: string;
  running: boolean;
  lastStartedAt?: string | undefined;
  lastFinishedAt?: string | undefined;
  lastTrigger?: "manual" | "scheduled" | undefined;
  lastState?: "completed" | "skipped" | "failed" | undefined;
  lastSummary?: string | undefined;
  lastError?: string | undefined;
  updatedAt: string;
}

export interface JobRuntimeRunAuditEntry {
  ts: string;
  event: "started" | "finished" | "failed";
  jobName: string;
  trigger: "manual" | "scheduled";
  startedAt: string;
  finishedAt?: string | undefined;
  state?: "completed" | "skipped" | undefined;
  summary?: string | undefined;
  error?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeJobName(jobName: string): string {
  return jobName.trim().replace(/[^a-z0-9._-]+/giu, "-");
}

export class JobRuntimeObservabilityService implements JobRuntimeObserver {
  private readonly statusDir: string;
  private readonly auditDir: string;

  constructor(private readonly workspaceDir: string) {
    this.statusDir = path.join(this.workspaceDir, "channels", "job-runtime");
    this.auditDir = path.join(this.workspaceDir, "channels", "job-runtime-runs");
  }

  private getStatusPath(jobName: string): string {
    return path.join(this.statusDir, `${sanitizeJobName(jobName)}.json`);
  }

  private getAuditPath(jobName: string): string {
    return path.join(this.auditDir, `${sanitizeJobName(jobName)}.jsonl`);
  }

  async getSnapshot(jobName: string): Promise<JobRuntimeSnapshot> {
    const statusPath = this.getStatusPath(jobName);
    try {
      const raw = await readFile(statusPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<JobRuntimeSnapshot>;
      return {
        jobName,
        running: Boolean(parsed.running),
        ...(typeof parsed.lastStartedAt === "string" ? { lastStartedAt: parsed.lastStartedAt } : {}),
        ...(typeof parsed.lastFinishedAt === "string" ? { lastFinishedAt: parsed.lastFinishedAt } : {}),
        ...(parsed.lastTrigger === "manual" || parsed.lastTrigger === "scheduled"
          ? { lastTrigger: parsed.lastTrigger }
          : {}),
        ...(parsed.lastState === "completed" || parsed.lastState === "skipped" || parsed.lastState === "failed"
          ? { lastState: parsed.lastState }
          : {}),
        ...(typeof parsed.lastSummary === "string" ? { lastSummary: parsed.lastSummary } : {}),
        ...(typeof parsed.lastError === "string" ? { lastError: parsed.lastError } : {}),
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
      };
    } catch {
      return {
        jobName,
        running: false,
        updatedAt: nowIso(),
      };
    }
  }

  async listRecentRuns(jobName: string, limit = 20): Promise<JobRuntimeRunAuditEntry[]> {
    const auditPath = this.getAuditPath(jobName);
    try {
      const raw = await readFile(auditPath, "utf8");
      const entries = raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as JobRuntimeRunAuditEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is JobRuntimeRunAuditEntry => Boolean(entry?.event));

      return entries.slice(-Math.max(1, Math.min(limit, 200))).reverse();
    } catch {
      return [];
    }
  }

  async onRunStarted(event: JobRuntimeRunEvent): Promise<void> {
    await this.writeSnapshot(event.jobName, (current) => ({
      ...current,
      running: true,
      lastStartedAt: event.startedAt,
      lastTrigger: event.trigger,
      lastError: undefined,
      updatedAt: nowIso(),
    }));
    await this.appendAudit(event.jobName, {
      ts: nowIso(),
      event: "started",
      jobName: event.jobName,
      trigger: event.trigger,
      startedAt: event.startedAt,
    });
  }

  async onRunFinished(event: JobRuntimeRunFinishedEvent): Promise<void> {
    await this.writeSnapshot(event.jobName, (current) => ({
      ...current,
      running: false,
      lastStartedAt: event.startedAt,
      lastFinishedAt: event.finishedAt,
      lastTrigger: event.trigger,
      lastState: event.state,
      ...(event.summary ? { lastSummary: event.summary } : { lastSummary: undefined }),
      lastError: undefined,
      updatedAt: nowIso(),
    }));
    await this.appendAudit(event.jobName, {
      ts: nowIso(),
      event: "finished",
      jobName: event.jobName,
      trigger: event.trigger,
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      state: event.state,
      ...(event.summary ? { summary: event.summary } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
    });
  }

  async onRunFailed(event: JobRuntimeRunFailedEvent): Promise<void> {
    await this.writeSnapshot(event.jobName, (current) => ({
      ...current,
      running: false,
      lastStartedAt: event.startedAt,
      lastFinishedAt: event.finishedAt,
      lastTrigger: event.trigger,
      lastState: "failed",
      lastError: event.error,
      updatedAt: nowIso(),
    }));
    await this.appendAudit(event.jobName, {
      ts: nowIso(),
      event: "failed",
      jobName: event.jobName,
      trigger: event.trigger,
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      error: event.error,
    });
  }

  private async writeSnapshot(
    jobName: string,
    updater: (current: JobRuntimeSnapshot) => JobRuntimeSnapshot,
  ): Promise<void> {
    const next = updater(await this.getSnapshot(jobName));
    const statusPath = this.getStatusPath(jobName);
    await mkdir(path.dirname(statusPath), { recursive: true });
    await writeFile(statusPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  private async appendAudit(jobName: string, entry: JobRuntimeRunAuditEntry): Promise<void> {
    const auditPath = this.getAuditPath(jobName);
    await mkdir(path.dirname(auditPath), { recursive: true });
    await appendFile(auditPath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}
