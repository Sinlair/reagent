import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchService } from "./researchService.js";
import { ResearchMemoryFlushService } from "./researchMemoryFlushService.js";
import { ResearchRoundService } from "./researchRoundService.js";
import type { ResearchRequest } from "../types/research.js";
import type {
  ResearchTaskDetail,
  ResearchTaskProgressUpdate,
  ResearchTaskRecord,
  ResearchTaskReviewStatus,
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

function stripStoredReport(record: ResearchTaskRecord): ResearchTaskRecord {
  const { report: _report, ...rest } = record;
  return rest;
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
    generatedAt: record.generatedAt,
    roundPath: record.roundPath,
    handoffPath: record.handoffPath,
    reviewStatus: record.reviewStatus,
  };
}

function toDetail(record: ResearchTaskRecord): ResearchTaskDetail {
  return {
    ...toSummary(record),
    transitions: record.transitions,
    request: record.request,
    error: record.error,
  };
}

export class ResearchTaskService {
  private readonly storePath: string;
  private readonly memoryFlushService: ResearchMemoryFlushService;
  private readonly researchRoundService: ResearchRoundService;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    workspaceDir: string,
    private readonly researchService: ResearchService
  ) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.memoryFlushService = new ResearchMemoryFlushService(workspaceDir);
    this.researchRoundService = new ResearchRoundService(workspaceDir);
  }

  private async readStore(): Promise<ResearchTaskStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchTaskStore>;
      return {
        tasks: Array.isArray(parsed.tasks)
          ? parsed.tasks
              .filter((task): task is ResearchTaskRecord => Boolean(task) && typeof task === "object")
              .map((task) => stripStoredReport(task))
          : []
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchTaskStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ tasks: store.tasks.map((task) => stripStoredReport(task)) }, null, 2)}\n`,
      "utf8",
    );
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
    const interruptedTasks = await this.mutateStore<ResearchTaskRecord[]>((store) => {
      const interrupted: ResearchTaskRecord[] = [];
      store.tasks = store.tasks.map((task) => {
        if (task.state === "completed" || task.state === "failed") {
          return task;
        }

        const message = "ReAgent restarted before this task finished.";
        const nextTask: ResearchTaskRecord = {
          ...task,
          state: "failed",
          updatedAt: nowIso(),
          message,
          error: message,
          progress: progressForState("failed"),
          transitions: pushTransition(task.transitions ?? [], "failed", message)
        };
        interrupted.push(nextTask);
        return nextTask;
      });
      return interrupted;
    });

    await Promise.all(
      interruptedTasks.map((task) =>
        this.researchRoundService.recordTaskProgress({
          taskId: task.taskId,
          state: "failed",
          progress: task.progress,
          message: task.message,
          reviewStatus: task.reviewStatus,
        }),
      ),
    );
  }

  async createTask(request: ResearchRequest, sourceTaskId?: string): Promise<ResearchTaskRecord> {
    const normalizedRequest: ResearchRequest = {
      topic: request.topic.trim(),
      ...(request.question?.trim() ? { question: request.question.trim() } : {}),
      ...(request.maxPapers ? { maxPapers: request.maxPapers } : {})
    };
    const sourceTask = sourceTaskId ? await this.getTask(sourceTaskId) : null;
    const taskId = randomUUID();
    const createdAt = nowIso();
    const roundPointers = this.researchRoundService.getRoundPointers(taskId);
    const task: ResearchTaskRecord = {
      taskId,
      topic: normalizedRequest.topic,
      question: normalizedRequest.question,
      request: normalizedRequest,
      state: "queued",
      createdAt,
      updatedAt: createdAt,
      message: "Task queued.",
      progress: progressForState("queued"),
      attempt: sourceTaskId ? (sourceTask?.attempt ?? 0) + 1 : 1,
      reportReady: false,
      roundPath: roundPointers.roundPath,
      handoffPath: roundPointers.handoffPath,
      reviewStatus: "pending",
      ...(sourceTaskId ? { sourceTaskId } : {}),
      transitions: pushTransition([], "queued", "Task queued.")
    };

    await this.researchRoundService.createRound({
      taskId: task.taskId,
      topic: task.topic,
      question: task.question,
      request: task.request,
      attempt: task.attempt,
      sourceTaskId: task.sourceTaskId,
      createdAt: task.createdAt,
      progress: task.progress,
      message: task.message,
    });

    try {
      await this.mutateStore((store) => {
        store.tasks = [task, ...store.tasks].slice(0, 200);
      });
    } catch (error) {
      await this.researchRoundService.deleteRound(task.taskId).catch(() => {});
      throw error;
    }

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

  async getTaskDetail(taskId: string): Promise<ResearchTaskDetail | null> {
    const task = await this.getTask(taskId);
    return task ? toDetail(task) : null;
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
    const nextTask = await this.mutateStore<ResearchTaskRecord | null>(async (store) => {
      const taskIndex = store.tasks.findIndex((task) => task.taskId === taskId);
      if (taskIndex < 0) {
        return null;
      }

      const currentTask = store.tasks[taskIndex];
      if (!currentTask) {
        return null;
      }

      const mergedTask = {
        ...currentTask,
        ...extras,
      };
      const updatedTask: ResearchTaskRecord = {
        ...mergedTask,
        request: mergedTask.request,
        state,
        updatedAt: nowIso(),
        ...(message?.trim() ? { message: message.trim() } : {}),
        progress: progressForState(state),
        transitions: pushTransition(currentTask.transitions ?? [], state, message),
      };

      store.tasks[taskIndex] = updatedTask;

      await this.researchRoundService.recordTaskProgress({
        taskId,
        state,
        progress: updatedTask.progress,
        message: updatedTask.message,
        reviewStatus: updatedTask.reviewStatus,
      });

      return updatedTask;
    });

    if (!nextTask) {
      return;
    }
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

      const reviewStatus: ResearchTaskReviewStatus =
        report.critique.verdict === "weak" ? "needs-review" : "passed";
      await this.researchRoundService.finalizeReport(taskId, report);
      await this.memoryFlushService.flushResearchReport(report).catch(() => {});

      await this.updateTaskState(taskId, "completed", "Research task completed.", {
        reportReady: true,
        generatedAt: report.generatedAt,
        reviewStatus,
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
