import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  OpenClawCachedSessionMessage,
  OpenClawEventAuditEntry,
  OpenClawSessionRegistryEntry,
} from "../types/channels.js";

function nowIso(): string {
  return new Date().toISOString();
}

export class OpenClawRuntimeStateService {
  private readonly eventAuditPath: string;
  private readonly sessionRegistryPath: string;
  private readonly sessionTranscriptDir: string;

  constructor(private readonly workspaceDir: string) {
    this.eventAuditPath = path.join(this.workspaceDir, "channels", "openclaw-session-events.jsonl");
    this.sessionRegistryPath = path.join(this.workspaceDir, "channels", "openclaw-sessions.json");
    this.sessionTranscriptDir = path.join(this.workspaceDir, "channels", "openclaw-session-transcripts");
  }

  getSessionRegistryPath(): string {
    return this.sessionRegistryPath;
  }

  getEventAuditPath(): string {
    return this.eventAuditPath;
  }

  private getSessionTranscriptPath(sessionKey: string): string {
    const safeKey = sessionKey.trim().replace(/[\\/:*?"<>|]/g, "_");
    return path.join(this.sessionTranscriptDir, `${safeKey}.json`);
  }

  private getSessionRecency(entry: OpenClawSessionRegistryEntry): number {
    if (typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)) {
      return entry.updatedAt;
    }
    const syncedAt = Date.parse(entry.lastSyncedAt);
    return Number.isFinite(syncedAt) ? syncedAt : 0;
  }

  async readSessionRegistry(): Promise<{
    updatedAt: string;
    sessions: OpenClawSessionRegistryEntry[];
  }> {
    try {
      const raw = await readFile(this.sessionRegistryPath, "utf8");
      const parsed = JSON.parse(raw.replace(/^\uFEFF/u, "")) as Partial<{
        updatedAt: string;
        sessions: OpenClawSessionRegistryEntry[];
      }>;
      return {
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      const initial = { updatedAt: nowIso(), sessions: [] as OpenClawSessionRegistryEntry[] };
      await this.writeSessionRegistry(initial);
      return initial;
    }
  }

  async writeSessionRegistry(state: {
    updatedAt: string;
    sessions: OpenClawSessionRegistryEntry[];
  }): Promise<void> {
    await mkdir(path.dirname(this.sessionRegistryPath), { recursive: true });
    await writeFile(this.sessionRegistryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async replaceSessionRegistry(entries: OpenClawSessionRegistryEntry[]): Promise<void> {
    await this.writeSessionRegistry({
      updatedAt: nowIso(),
      sessions: entries,
    });
  }

  async listSessionRegistry(limit = 100): Promise<OpenClawSessionRegistryEntry[]> {
    const state = await this.readSessionRegistry();
    return state.sessions
      .slice()
      .sort((left, right) => {
        const leftUpdated = left.updatedAt ?? 0;
        const rightUpdated = right.updatedAt ?? 0;
        return rightUpdated - leftUpdated || left.sessionKey.localeCompare(right.sessionKey);
      })
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async getSessionRegistryEntry(sessionKey: string): Promise<OpenClawSessionRegistryEntry | null> {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return null;
    }
    const state = await this.readSessionRegistry();
    return state.sessions.find((entry) => entry.sessionKey === normalizedSessionKey) ?? null;
  }

  async findSessionRegistryEntryByTarget(input: {
    to: string;
    accountId?: string | undefined;
    threadId?: string | number | undefined;
  }): Promise<OpenClawSessionRegistryEntry | null> {
    const target = input.to.trim();
    if (!target) {
      return null;
    }

    const requestedAccountId = input.accountId?.trim() || "";
    const requestedThreadId =
      input.threadId == null ? "" : String(input.threadId).trim();
    const state = await this.readSessionRegistry();
    const matches = state.sessions.filter((entry) => entry.to === target);
    if (matches.length === 0) {
      return null;
    }

    const scored = matches
      .map((entry) => {
        let score = 0;
        if (requestedAccountId) {
          score += entry.accountId?.trim() === requestedAccountId ? 10 : -10;
        }
        if (requestedThreadId) {
          score += entry.threadId != null && String(entry.threadId).trim() === requestedThreadId ? 5 : -5;
        }
        return {
          entry,
          score,
          recency: this.getSessionRecency(entry),
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.recency !== left.recency) {
          return right.recency - left.recency;
        }
        return left.entry.sessionKey.localeCompare(right.entry.sessionKey);
      });

    const best = scored[0];
    if (!best) {
      return null;
    }
    if ((requestedAccountId || requestedThreadId) && best.score < 0) {
      return null;
    }
    return best.entry;
  }

  async upsertSessionRegistryEntry(
    sessionKey: string,
    updater: (entry: OpenClawSessionRegistryEntry | null) => OpenClawSessionRegistryEntry,
  ): Promise<void> {
    const current = await this.readSessionRegistry();
    const index = current.sessions.findIndex((entry) => entry.sessionKey === sessionKey);
    const previous = index >= 0 ? current.sessions[index] ?? null : null;
    const nextEntry = updater(previous);
    const nextSessions =
      index >= 0
        ? current.sessions.map((entry, entryIndex) => (entryIndex === index ? nextEntry : entry))
        : [...current.sessions, nextEntry];
    await this.writeSessionRegistry({
      updatedAt: nowIso(),
      sessions: nextSessions,
    });
  }

  async appendEventAudit(entry: OpenClawEventAuditEntry): Promise<void> {
    await mkdir(path.dirname(this.eventAuditPath), { recursive: true });
    await appendFile(
      this.eventAuditPath,
      `${JSON.stringify({ ...entry, ts: entry.ts ?? nowIso() })}\n`,
      "utf8",
    );
  }

  async listEventAudit(limit = 30): Promise<OpenClawEventAuditEntry[]> {
    try {
      const raw = await readFile(this.eventAuditPath, "utf8");
      const entries = raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Partial<OpenClawEventAuditEntry>;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is Partial<OpenClawEventAuditEntry> => Boolean(entry))
        .filter((entry) => typeof entry.event === "string")
        .map((entry) => ({
          ts: typeof entry.ts === "string" ? entry.ts : undefined,
          event: entry.event as string,
          sessionKey: typeof entry.sessionKey === "string" ? entry.sessionKey : undefined,
          messageId: typeof entry.messageId === "string" ? entry.messageId : undefined,
          role: typeof entry.role === "string" ? entry.role : undefined,
          text: typeof entry.text === "string" ? entry.text : undefined,
        }));

      return entries.slice(-Math.max(1, Math.min(limit, 200))).reverse();
    } catch {
      return [];
    }
  }

  async appendSessionMessage(
    sessionKey: string,
    message: OpenClawCachedSessionMessage,
  ): Promise<void> {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return;
    }
    const current = await this.readSessionMessages(normalizedSessionKey);
    const existingIndex = current.findIndex((entry) => entry.id === message.id);
    const nextMessages =
      existingIndex >= 0
        ? current.map((entry, index) => (index === existingIndex ? message : entry))
        : [...current, message];
    const transcriptPath = this.getSessionTranscriptPath(normalizedSessionKey);
    await mkdir(path.dirname(transcriptPath), { recursive: true });
    await writeFile(
      transcriptPath,
      `${JSON.stringify({ updatedAt: nowIso(), messages: nextMessages.slice(-200) }, null, 2)}\n`,
      "utf8",
    );
  }

  async readSessionMessages(sessionKey: string): Promise<OpenClawCachedSessionMessage[]> {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return [];
    }
    const transcriptPath = this.getSessionTranscriptPath(normalizedSessionKey);
    try {
      const raw = await readFile(transcriptPath, "utf8");
      const payload = JSON.parse(raw.replace(/^\uFEFF/u, "")) as { messages?: unknown };
      return Array.isArray(payload.messages)
        ? payload.messages.filter((entry): entry is OpenClawCachedSessionMessage => {
            return Boolean(
              entry &&
              typeof entry === "object" &&
              typeof (entry as { id?: unknown }).id === "string" &&
              typeof (entry as { text?: unknown }).text === "string" &&
              typeof (entry as { createdAt?: unknown }).createdAt === "string",
            );
          })
        : [];
    } catch {
      return [];
    }
  }

  async listAllSessionMessages(limit = 500): Promise<
    Array<{
      sessionKey: string;
      message: OpenClawCachedSessionMessage;
      entry: OpenClawSessionRegistryEntry | null;
    }>
  > {
    const state = await this.readSessionRegistry();
    const registryEntries = new Map(state.sessions.map((entry) => [entry.sessionKey, entry] as const));
    const items: Array<{
      sessionKey: string;
      message: OpenClawCachedSessionMessage;
      entry: OpenClawSessionRegistryEntry | null;
    }> = [];

    for (const sessionKey of registryEntries.keys()) {
      const messages = await this.readSessionMessages(sessionKey);
      const entry = registryEntries.get(sessionKey) ?? null;
      for (const message of messages) {
        items.push({
          sessionKey,
          message,
          entry,
        });
      }
    }

    return items
      .sort((left, right) => {
        const leftTime = Date.parse(left.message.createdAt);
        const rightTime = Date.parse(right.message.createdAt);
        const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
        if (safeRightTime !== safeLeftTime) {
          return safeRightTime - safeLeftTime;
        }
        return left.message.id.localeCompare(right.message.id);
      })
      .slice(0, Math.max(1, Math.min(limit, 2_000)));
  }
}
