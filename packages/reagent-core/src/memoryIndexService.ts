import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  MemoryConfidence,
  MemoryIndexEntry,
  MemoryIndexStore,
  MemoryServiceOptions,
  MemorySourceType,
  RememberRequest,
} from "./memory.js";

const INDEX_FILE = "memory-index.json";
const SCOPE_ROOT_DIR = "memory-scopes";
const MAX_ENTRIES = 4000;

function nowIso(): string {
  return new Date().toISOString();
}

function buildScopeDirName(scopeKey: string): string {
  const trimmed = scopeKey.trim();
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
  const digest = createHash("sha1").update(trimmed).digest("hex").slice(0, 8);
  return `${normalized || "scope"}-${digest}`;
}

function defaultStore(): MemoryIndexStore {
  return {
    updatedAt: nowIso(),
    entries: [],
  };
}

function uniqueTrimmed(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function clipText(text: string, maxLength = 320): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength);
  const end = boundary > Math.floor(maxLength / 2) ? boundary : maxLength;
  return `${normalized.slice(0, end).trimEnd()}...`;
}

function tokenize(text: string): string[] {
  const latinTokens = text.toLowerCase().match(/[a-z0-9]{2,}/gu) ?? [];
  const cjkTokens = [...new Set(text.match(/[\p{Script=Han}]{2}/gu) ?? [])];
  return [...new Set([...latinTokens, ...cjkTokens])];
}

function normalizeSourceType(sourceType: RememberRequest["sourceType"]): MemorySourceType {
  return sourceType ?? "user-stated";
}

function normalizeConfidence(confidence: RememberRequest["confidence"]): MemoryConfidence {
  return confidence ?? "medium";
}

function stableEntryId(input: {
  path: string;
  title: string;
  content: string;
  createdAt: string;
  scopeKey?: string | undefined;
}): string {
  return createHash("sha1")
    .update([input.scopeKey ?? "", input.path, input.title, input.content, input.createdAt].join("\n"))
    .digest("hex");
}

export interface MemoryIndexSearchHit {
  entry: MemoryIndexEntry;
  score: number;
}

export class MemoryIndexService {
  constructor(
    private readonly workspaceDir: string,
    private readonly options: MemoryServiceOptions = {},
  ) {}

  private get scopeKey(): string | undefined {
    return this.options.scopeKey?.trim() || undefined;
  }

  private get scopeRootDir(): string {
    return this.scopeKey
      ? path.join(this.workspaceDir, SCOPE_ROOT_DIR, buildScopeDirName(this.scopeKey))
      : this.workspaceDir;
  }

  private get storePath(): string {
    return path.join(this.scopeRootDir, INDEX_FILE);
  }

  private async readStore(): Promise<MemoryIndexStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<MemoryIndexStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        entries: Array.isArray(parsed.entries)
          ? parsed.entries.filter(
              (entry): entry is MemoryIndexEntry =>
                Boolean(entry) &&
                typeof entry === "object" &&
                typeof entry.id === "string" &&
                typeof entry.path === "string" &&
                typeof entry.title === "string" &&
                typeof entry.content === "string" &&
                typeof entry.snippet === "string",
            )
          : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: MemoryIndexStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async recordRememberedEntry(input: {
    path: string;
    kind: "long-term" | "daily";
    title: string;
    content: string;
    createdAt: string;
    remember: RememberRequest;
  }): Promise<MemoryIndexEntry> {
    const store = await this.readStore();
    const snippet = clipText(input.content, 280);
    const entry: MemoryIndexEntry = {
      id: stableEntryId({
        path: input.path,
        title: input.title,
        content: input.content,
        createdAt: input.createdAt,
        ...(this.scopeKey ? { scopeKey: this.scopeKey } : {}),
      }),
      path: input.path,
      kind: input.kind,
      title: input.title,
      content: input.content.trim(),
      snippet,
      ...(input.remember.source?.trim() ? { source: input.remember.source.trim() } : {}),
      ...(input.remember.sourceId?.trim() ? { sourceId: input.remember.sourceId.trim() } : {}),
      sourceType: normalizeSourceType(input.remember.sourceType),
      confidence: normalizeConfidence(input.remember.confidence),
      tags: uniqueTrimmed(input.remember.tags),
      entityIds: uniqueTrimmed(input.remember.entityIds),
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      ...(this.scopeKey ? { scopeKey: this.scopeKey } : {}),
    };

    const dedupeKey = createHash("sha1")
      .update([entry.path, entry.title.toLowerCase(), entry.content.toLowerCase()].join("\n"))
      .digest("hex");

    const nextEntries = [
      entry,
      ...store.entries.filter((item) => {
        const existingKey = createHash("sha1")
          .update([item.path, item.title.toLowerCase(), item.content.toLowerCase()].join("\n"))
          .digest("hex");
        return existingKey !== dedupeKey;
      }),
    ].slice(0, MAX_ENTRIES);

    await this.writeStore({
      ...store,
      entries: nextEntries,
    });

    return entry;
  }

  async search(query: string, limit = 6): Promise<MemoryIndexSearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const store = await this.readStore();
    const queryTerms = tokenize(trimmed);
    const queryLower = trimmed.toLowerCase();
    const results = store.entries
      .map((entry) => {
        const haystack = [
          entry.title,
          entry.content,
          entry.snippet,
          entry.tags.join(" "),
          entry.entityIds.join(" "),
          entry.source ?? "",
        ]
          .join("\n")
          .toLowerCase();

        let score = haystack.includes(queryLower) ? 5 : 0;
        let overlap = 0;
        for (const term of queryTerms) {
          if (haystack.includes(term)) {
            overlap += 1;
            score += 1.5;
          }
          if (entry.title.toLowerCase().includes(term)) {
            score += 1.25;
          }
          if (entry.tags.some((tag) => tag.toLowerCase().includes(term))) {
            score += 0.75;
          }
        }

        const recencyTarget = entry.lastUsedAt ?? entry.updatedAt ?? entry.createdAt;
        const recencyMs = Date.now() - Date.parse(recencyTarget);
        const recencyDays = Number.isFinite(recencyMs) ? Math.max(0, recencyMs / 86_400_000) : 999;
        const recencyBonus = Math.max(0, 1.2 - recencyDays * 0.04);
        const confidenceBonus =
          entry.confidence === "high" ? 1.2 : entry.confidence === "medium" ? 0.6 : 0.2;

        return overlap > 0 || score > 0
          ? {
              entry,
              score: Math.round((score + recencyBonus + confidenceBonus) * 100) / 100,
            }
          : null;
      })
      .filter((item): item is MemoryIndexSearchHit => Boolean(item))
      .sort((left, right) => right.score - left.score || left.entry.updatedAt.localeCompare(right.entry.updatedAt))
      .slice(0, limit);

    if (results.length > 0) {
      const resultIds = new Set(results.map((item) => item.entry.id));
      await this.writeStore({
        ...store,
        entries: store.entries.map((entry) =>
          resultIds.has(entry.id) ? { ...entry, lastUsedAt: nowIso() } : entry,
        ),
      });
    }

    return results;
  }
}
