import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ResearchRoundService } from "./researchRoundService.js";
import type {
  AgentDelegationKind,
  AgentDelegationRecord,
  AgentDelegationRationale,
  AgentDelegationStatus,
} from "../types/agentDelegation.js";

interface AgentDelegationStore {
  updatedAt: string;
  items: AgentDelegationRecord[];
}

const DELEGATION_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): AgentDelegationStore {
  return {
    updatedAt: nowIso(),
    items: [],
  };
}

function buildRetryMetadata(
  status: AgentDelegationStatus,
  updatedAt: string,
): Pick<AgentDelegationRecord, "retryState" | "retryAfter" | "retryHint"> {
  if (status === "failed" || status === "cancelled") {
    const retryAfterMs = Date.parse(updatedAt) + DELEGATION_RETRY_COOLDOWN_MS;
    const retryAfter = new Date(retryAfterMs).toISOString();
    if (Date.now() < retryAfterMs) {
      return {
        retryState: "cooldown",
        retryAfter,
        retryHint: "Wait for the cooldown window to pass, then retry with an explicit retry-style prompt after reviewing blockers.",
      };
    }

    return {
      retryState: "available",
      retryAfter,
      retryHint: "Retry is available. Use an explicit retry-style prompt after reviewing blockers or changing strategy.",
    };
  }

  return {
    retryState: "not-applicable",
  };
}

function applyRetryMetadata(record: AgentDelegationRecord): AgentDelegationRecord {
  return {
    ...record,
    ...buildRetryMetadata(record.status, record.updatedAt),
  };
}

export class AgentDelegationService {
  private readonly storePath: string;
  private readonly researchRoundService: ResearchRoundService;

  constructor(
    private readonly workspaceDir: string,
    researchRoundService?: ResearchRoundService,
  ) {
    this.storePath = path.join(this.workspaceDir, "channels", "agent-delegations.json");
    this.researchRoundService = researchRoundService ?? new ResearchRoundService(workspaceDir);
  }

  async listRecent(
    limit = 20,
    status?: AgentDelegationStatus,
    sessionId?: string,
  ): Promise<AgentDelegationRecord[]> {
    const hydrated = await this.hydrateStore();
    return hydrated.items
      .filter((item) => (status ? item.status === status : true))
      .filter((item) => (sessionId ? item.sessionId === sessionId : true))
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }

  async getDelegation(delegationId: string): Promise<AgentDelegationRecord | null> {
    const hydrated = await this.hydrateStore();
    return hydrated.items.find((item) => item.delegationId === delegationId) ?? null;
  }

  async createDelegation(input: {
    sessionId: string;
    taskId: string;
    kind: AgentDelegationKind;
    prompt?: string | undefined;
    rationale?: AgentDelegationRationale | undefined;
  }): Promise<AgentDelegationRecord> {
    const handoff = await this.researchRoundService.getHandoff(input.taskId);
    if (!handoff) {
      throw new Error("Research handoff not found for the requested task.");
    }

    const memo = await this.researchRoundService.getWorkstreamMemo(input.taskId, input.kind);
    const workstream = handoff.workstreams.find((item) => item.id === input.kind);
    const status: AgentDelegationStatus = memo
      ? "completed"
      : workstream?.status === "in_progress"
        ? "running"
        : workstream?.status === "completed"
          ? "completed"
          : handoff.state === "failed" || workstream?.status === "blocked"
            ? "failed"
            : "queued";
    const createdAt = nowIso();
    const nextRecord = applyRetryMetadata({
      delegationId: `dlg_${randomUUID()}`,
      sessionId: input.sessionId,
      taskId: input.taskId,
      kind: input.kind,
      status,
      input: {
        ...(input.prompt?.trim() ? { prompt: input.prompt.trim() } : {}),
        scope: "research-only",
        allowRecursiveDelegation: false,
      },
      ...(input.rationale ? { rationale: input.rationale } : {}),
      ...(handoff.workstreamPaths[input.kind]
        ? {
            artifact: {
              path: handoff.workstreamPaths[input.kind],
              type: "workstream-memo",
            },
          }
        : {}),
      createdAt,
      updatedAt: createdAt,
      ...(status === "failed"
        ? {
            error:
              handoff.blockers[0] ??
              handoff.currentMessage ??
              "The requested workstream is blocked or unavailable for this task.",
          }
        : {}),
    });

    const store = await this.readStore();
    await this.writeStore({
      updatedAt: createdAt,
      items: [nextRecord, ...store.items],
    });
    return nextRecord;
  }

  async cancelDelegation(delegationId: string): Promise<AgentDelegationRecord | null> {
    const store = await this.readStore();
    const index = store.items.findIndex((item) => item.delegationId === delegationId);
    if (index === -1) {
      return null;
    }

    const current = store.items[index]!;
    if (current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
      return current;
    }

    const nextRecord = applyRetryMetadata({
      ...current,
      status: "cancelled",
      updatedAt: nowIso(),
      error: null,
    });
    const nextItems = [...store.items];
    nextItems[index] = nextRecord;
    await this.writeStore({
      updatedAt: nextRecord.updatedAt,
      items: nextItems,
    });
    return nextRecord;
  }

  private async hydrateStore(): Promise<AgentDelegationStore> {
    const store = await this.readStore();
    let changed = false;
    const nextItems = await Promise.all(
      store.items.map(async (item) => {
        if (item.status === "completed" || item.status === "failed" || item.status === "cancelled") {
          return item;
        }

        const memo = await this.researchRoundService.getWorkstreamMemo(item.taskId, item.kind);
        if (memo) {
          changed = true;
          return applyRetryMetadata({
            ...item,
            status: "completed",
            artifact: {
              path: memo.path,
              type: "workstream-memo",
            },
            updatedAt: nowIso(),
            error: null,
          } satisfies AgentDelegationRecord);
        }

        const handoff = await this.researchRoundService.getHandoff(item.taskId);
        if (!handoff || handoff.state === "failed") {
          changed = true;
          return applyRetryMetadata({
            ...item,
            status: "failed",
            updatedAt: nowIso(),
            error: handoff?.blockers[0] ?? handoff?.currentMessage ?? "Research handoff is no longer available.",
          } satisfies AgentDelegationRecord);
        }

        const workstream = handoff.workstreams.find((entry) => entry.id === item.kind);
        const nextStatus: AgentDelegationStatus =
          workstream?.status === "in_progress" ? "running" : workstream?.status === "blocked" ? "failed" : "queued";
        if (nextStatus === item.status) {
          return item;
        }

        changed = true;
        return applyRetryMetadata({
          ...item,
          status: nextStatus,
          updatedAt: nowIso(),
          ...(nextStatus === "failed"
            ? {
                error: handoff.blockers[0] ?? handoff.currentMessage ?? "The requested workstream is blocked.",
              }
            : {
                error: null,
              }),
        } satisfies AgentDelegationRecord);
      }),
    );

    if (changed) {
      const nextStore = {
        updatedAt: nowIso(),
        items: nextItems,
      };
      await this.writeStore(nextStore);
      return nextStore;
    }

    return store;
  }

  private async readStore(): Promise<AgentDelegationStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AgentDelegationStore>;
      return {
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
        items: Array.isArray(parsed.items)
          ? (parsed.items as AgentDelegationRecord[]).map((item) => applyRetryMetadata(item))
          : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: AgentDelegationStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}
