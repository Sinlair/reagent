import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchDiscoveryRunResult } from "../types/researchDiscovery.js";
import type {
  ResearchDiscoveryScheduleConfig,
  ResearchDiscoveryScheduleState,
  ResearchDiscoverySchedulerStatus,
} from "../types/researchDiscoveryScheduler.js";
import { ResearchFeedbackService } from "./researchFeedbackService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchDiscoveryService } from "./researchDiscoveryService.js";

const STORE_FILE = "channels/research-discovery-scheduler.json";
const TICK_INTERVAL_MS = 60_000;
const DEFAULT_DAILY_TIME = "09:00";
const DEFAULT_TOP_K = 5;
const DEFAULT_MAX_PAPERS_PER_QUERY = 4;

function nowIso(): string {
  return new Date().toISOString();
}

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentLocalTimeHHmm(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function daysSinceLocalDate(value: string | undefined): number {
  if (!value?.trim()) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Date.parse(`${value.trim()}T00:00:00`);
  if (!Number.isFinite(parsed)) {
    return Number.POSITIVE_INFINITY;
  }

  const todayParsed = Date.parse(`${todayLocalDate()}T00:00:00`);
  return Math.max(0, Math.floor((todayParsed - parsed) / (24 * 60 * 60 * 1000)));
}

function normalizeTime(value?: string | undefined): string {
  const trimmed = value?.trim() || DEFAULT_DAILY_TIME;
  return /^\d{2}:\d{2}$/u.test(trimmed) ? trimmed : DEFAULT_DAILY_TIME;
}

function uniqueTrimmed(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function defaultState(): ResearchDiscoveryScheduleState {
  return {
    enabled: false,
    dailyTimeLocal: DEFAULT_DAILY_TIME,
    senderId: "",
    directionIds: [],
    topK: DEFAULT_TOP_K,
    maxPapersPerQuery: DEFAULT_MAX_PAPERS_PER_QUERY,
    lastRunDateByDirection: {},
    updatedAt: nowIso(),
  };
}

function normalizeState(partial: Partial<ResearchDiscoveryScheduleState>): ResearchDiscoveryScheduleState {
  return {
    enabled: partial.enabled ?? false,
    dailyTimeLocal: normalizeTime(partial.dailyTimeLocal),
    senderId: partial.senderId?.trim() || "",
    ...(partial.senderName?.trim() ? { senderName: partial.senderName.trim() } : {}),
    directionIds: uniqueTrimmed(partial.directionIds),
    topK: Math.max(1, Math.min(partial.topK ?? DEFAULT_TOP_K, 10)),
    maxPapersPerQuery: Math.max(1, Math.min(partial.maxPapersPerQuery ?? DEFAULT_MAX_PAPERS_PER_QUERY, 10)),
    lastRunDateByDirection:
      partial.lastRunDateByDirection && typeof partial.lastRunDateByDirection === "object"
        ? Object.fromEntries(
            Object.entries(partial.lastRunDateByDirection).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {},
    updatedAt: partial.updatedAt?.trim() || nowIso(),
  };
}

export class ResearchDiscoverySchedulerService {
  private readonly storePath: string;
  private readonly directionService: ResearchDirectionService;
  private readonly feedbackService: ResearchFeedbackService;
  private timer: NodeJS.Timeout | null = null;
  private runningTick = false;

  constructor(
    private readonly workspaceDir: string,
    private readonly discoveryService: ResearchDiscoveryService,
  ) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.feedbackService = new ResearchFeedbackService(workspaceDir);
  }

  private async readState(): Promise<ResearchDiscoveryScheduleState> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      return normalizeState(JSON.parse(raw) as Partial<ResearchDiscoveryScheduleState>);
    } catch {
      return defaultState();
    }
  }

  private async writeState(state: ResearchDiscoveryScheduleState): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...state, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async getStatus(): Promise<ResearchDiscoverySchedulerStatus> {
    const state = await this.readState();
    return {
      running: Boolean(this.timer),
      enabled: state.enabled,
      dailyTimeLocal: state.dailyTimeLocal,
      ...(state.senderId ? { senderId: state.senderId } : {}),
      directionIds: [...state.directionIds],
      lastRunDateByDirection: { ...state.lastRunDateByDirection },
      updatedAt: state.updatedAt,
    };
  }

  async configure(config: Partial<ResearchDiscoveryScheduleConfig>): Promise<ResearchDiscoveryScheduleState> {
    const current = await this.readState();
    const next: ResearchDiscoveryScheduleState = {
      ...current,
      ...(config.enabled !== undefined ? { enabled: config.enabled } : {}),
      ...(config.dailyTimeLocal ? { dailyTimeLocal: normalizeTime(config.dailyTimeLocal) } : {}),
      ...(config.senderId?.trim() ? { senderId: config.senderId.trim() } : {}),
      ...(config.senderName !== undefined
        ? config.senderName?.trim()
          ? { senderName: config.senderName.trim() }
          : { senderName: undefined }
        : {}),
      ...(config.directionIds ? { directionIds: uniqueTrimmed(config.directionIds) } : {}),
      ...(config.topK ? { topK: Math.max(1, Math.min(config.topK, 10)) } : {}),
      ...(config.maxPapersPerQuery
        ? { maxPapersPerQuery: Math.max(1, Math.min(config.maxPapersPerQuery, 10)) }
        : {}),
      updatedAt: nowIso(),
    };

    await this.writeState(next);
    return next;
  }

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);
    this.timer.unref?.();
    await this.tick();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async resolveTargetDirections(state: ResearchDiscoveryScheduleState): Promise<string[]> {
    if (state.directionIds.length > 0) {
      return [...state.directionIds];
    }

    const profiles = await this.directionService.listProfiles();
    return profiles.filter((profile) => profile.enabled).map((profile) => profile.id);
  }

  async tick(): Promise<ResearchDiscoveryRunResult[]> {
    if (this.runningTick) {
      return [];
    }

    this.runningTick = true;
    try {
      const state = await this.readState();
      if (!state.enabled || !state.senderId.trim()) {
        return [];
      }

      const nowTime = currentLocalTimeHHmm();
      if (nowTime < state.dailyTimeLocal) {
        return [];
      }

      const today = todayLocalDate();
      const targetDirectionIds = await this.resolveTargetDirections(state);
      const pendingDirectionIds: string[] = [];

      for (const directionId of targetDirectionIds) {
        const profile = await this.directionService.getProfile(directionId);
        const policy = await this.feedbackService.getDirectionPushPolicy({
          directionId,
          topic: profile?.label,
        });
        const lastRunDate = state.lastRunDateByDirection[directionId];
        if (lastRunDate === today) {
          continue;
        }
        if (daysSinceLocalDate(lastRunDate) < policy.minSpacingDays) {
          continue;
        }
        pendingDirectionIds.push(directionId);
      }

      if (pendingDirectionIds.length === 0) {
        return [];
      }

      const results: ResearchDiscoveryRunResult[] = [];
      const nextState: ResearchDiscoveryScheduleState = {
        ...state,
        lastRunDateByDirection: { ...state.lastRunDateByDirection },
      };

      for (const directionId of pendingDirectionIds) {
        const profile = await this.directionService.getProfile(directionId);
        const policy = await this.feedbackService.getDirectionPushPolicy({
          directionId,
          topic: profile?.label,
        });
        const adjustedTopK = Math.max(1, Math.min(state.topK + policy.topKAdjustment, 10));
        const result = await this.discoveryService.runDiscovery({
          directionId,
          maxPapersPerQuery: state.maxPapersPerQuery,
          topK: adjustedTopK,
          pushToWechat: true,
          senderId: state.senderId,
          ...(state.senderName?.trim() ? { senderName: state.senderName.trim() } : {}),
        });
        nextState.lastRunDateByDirection[directionId] = today;
        results.push(result);
      }

      await this.writeState(nextState);
      return results;
    } finally {
      this.runningTick = false;
    }
  }
}
