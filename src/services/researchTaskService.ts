import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchService } from "./researchService.js";
import { ResearchMemoryFlushService } from "./researchMemoryFlushService.js";
import type { ResearchRequest } from "../types/research.js";
import type {
  ResearchTaskProgressUpdate,
  ResearchTaskRecord,
  ResearchTaskState,
  ResearchTaskSummary,
  ResearchTaskTransition
} from "../types/researchTask.js";

interface ResearchTaskStore {
  tasks: ResearchTaskRecord[];
}

const STORE_FILE = "research/task-runs.json";

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchTaskStore {
  return { tasks: [] };
}

function progressForState(state: ResearchTaskState): number {
  switch (state) {
    case "queued":
      return 5;
    case "planning":
      return 12;
    case "fetching":
      return 20;
    case "normalizing":
      return 28;
    case "searching-paper":
      return 36;
    case "downloading-paper":
      return 48;
    case "parsing":
      return 56;
    case "analyzing-paper":
      return 68;
    case "checking-repo":
      return 74;
    case "extracting-module":
      return 78;
    case "generating-summary":
      return 84;
    case "generating-ppt":
      return 88;
    case "persisting":
      return 92;
    case "completed":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

function pushTransition(
  transitions: ResearchTaskTransition[],
  state: ResearchTaskState,
  message?: string | undefined
): ResearchTaskTransition[] {
  return [
    ...transitions,
    {
      state,
      at: nowIso(),
      ...(message?.trim() ? { message: message.trim() } : {})
    }
  ];
}

function toSummary(record: ResearchTaskRecord): ResearchTaskSummary {
  return {
    taskId: record.taskId,
    topic: record.topic,
    question: record.question,
    state: record.state,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    message: record.message,
    progress: record.progress,
    attempt: record.attempt,
    sourceTaskId: record.sourceTaskId,
    reportReady: record.reportReady,
    generatedAt: record.generatedAt
  };
}

export class ResearchTaskService {
  private readonly storePath: string;
  private readonly memoryFlushService: ResearchMemoryFlushService;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    workspaceDir: string,
    private readonly researchService: ResearchService
  ) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.memoryFlushService = new ResearchMemoryFlushService(workspaceDir);
  }

  private async readStore(): Promise<ResearchTaskStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchTaskStore>;
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchTaskStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  private async mutateStore<T>(mutator: (store: ResearchTaskStore) => T | Promise<T>): Promise<T> {
    let resolveResult: ((value: T | PromiseLike<T>) => void) | null = null;
    let rejectResult: ((reason?: unknown) => void) | null = null;
    const resultPromise = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const store = await this.readStore();
        const result = await mutator(store);
        await this.writeStore(store);
        resolveResult?.(result);
      } catch (error) {
        rejectResult?.(error);
      }
    });

    return resultPromise;
  }

  async recoverInterruptedTasks(): Promise<void> {
    await this.mutateStore((store) => {
      store.tasks = store.tasks.map((task) => {
        if (task.state === "completed" || task.state === "failed") {
          return task;
        }

        const message = "ReAgent restarted before this task finished.";
        return {
          ...task,
          state: "failed",
          updatedAt: nowIso(),
          message,
          error: message,
          progress: progressForState("failed"),
          transitions: pushTransition(task.transitions ?? [], "failed", message)
        };
      });
    });
  }

  async createTask(request: ResearchRequest, sourceTaskId?: string): Promise<ResearchTaskRecord> {
    const normalizedRequest: ResearchRequest = {
      topic: request.topic.trim(),
      ...(request.question?.trim() ? { question: request.question.trim() } : {}),
      ...(request.maxPapers ? { maxPapers: request.maxPapers } : {})
    };
    const task: ResearchTaskRecord = {
      taskId: randomUUID(),
      topic: normalizedRequest.topic,
      question: normalizedRequest.question,
      request: normalizedRequest,
      state: "queued",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      message: "Task queued.",
      progress: progressForState("queued"),
      attempt: 1,
      reportReady: false,
      ...(sourceTaskId ? { sourceTaskId } : {}),
      transitions: pushTransition([], "queued", "Task queued.")
    };

    await this.mutateStore((store) => {
      if (sourceTaskId) {
        const parent = store.tasks.find((entry) => entry.taskId === sourceTaskId);
        task.attempt = (parent?.attempt ?? 0) + 1;
      }
      store.tasks = [task, ...store.tasks].slice(0, 200);
    });

    return task;
  }

  async enqueueTask(request: ResearchRequest, sourceTaskId?: string): Promise<ResearchTaskSummary> {
    const task = await this.createTask(request, sourceTaskId);
    queueMicrotask(() => {
      void this.runTask(task.taskId);
    });
    return toSummary(task);
  }

  async listTasks(limit: number): Promise<ResearchTaskSummary[]> {
    const store = await this.readStore();
    return store.tasks
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map(toSummary);
  }

  async getTask(taskId: string): Promise<ResearchTaskRecord | null> {
    const store = await this.readStore();
    return store.tasks.find((task) => task.taskId === taskId) ?? null;
  }

  async retryTask(taskId: string): Promise<ResearchTaskSummary | null> {
    const existing = await this.getTask(taskId);
    if (!existing) {
      return null;
    }

    return this.enqueueTask(existing.request, existing.taskId);
  }

  private async updateTaskState(
    taskId: string,
    state: ResearchTaskState,
    message?: string | undefined,
    extras: Partial<ResearchTaskRecord> = {}
  ): Promise<void> {
    await this.mutateStore((store) => {
      store.tasks = store.tasks.map((task) => {
        if (task.taskId !== taskId) {
          return task;
        }

        return {
          ...task,
          ...extras,
          state,
          updatedAt: nowIso(),
          ...(message?.trim() ? { message: message.trim() } : {}),
          progress: progressForState(state),
          transitions: pushTransition(task.transitions ?? [], state, message)
        };
      });
    });
  }

  private async runTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task || task.state === "completed") {
      return;
    }

    try {
      const report = await this.researchService.runResearch(task.request, {
        taskId,
        onProgress: async (update: ResearchTaskProgressUpdate) => {
          await this.updateTaskState(taskId, update.state, update.message);
        }
      });

      await this.memoryFlushService.flushResearchReport(report).catch(() => {});

      await this.updateTaskState(taskId, "completed", "Research task completed.", {
        reportReady: true,
        generatedAt: report.generatedAt,
        report
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateTaskState(taskId, "failed", message, {
        error: message,
        reportReady: false
      });
    }
  }
}
