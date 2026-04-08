import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  MemoryCompactionOptions,
  MemoryCompactionRecord,
  MemoryCompactionRecordStore,
  MemoryCompactionResult,
  MemoryIndexEntry,
  MemoryPolicyPatch,
  MemoryServiceOptions,
} from "./memory.js";
import { MemoryIndexService } from "./memoryIndexService.js";
import { MemoryPolicyService } from "./memoryPolicyService.js";

const LONG_TERM_FILE = "MEMORY.md";
const SCOPE_ROOT_DIR = "memory-scopes";
const HISTORY_FILE = "memory-compactions.json";
const DEFAULT_OLDER_THAN_DAYS = 14;
const DEFAULT_MIN_ENTRIES = 6;
const DEFAULT_MAX_ENTRIES = 12;

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

function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")}`;
}

function clipText(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength);
  const end = boundary > Math.floor(maxLength / 2) ? boundary : maxLength;
  return `${normalized.slice(0, end).trimEnd()}...`;
}

function countTop(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function buildSummaryTitle(entries: MemoryIndexEntry[]): string {
  const dates = entries
    .map((entry) => entry.updatedAt.slice(0, 10))
    .filter(Boolean)
    .sort();
  const start = dates[0] ?? "unknown";
  const end = dates.at(-1) ?? start;
  return start === end ? `Memory Summary ${start}` : `Memory Summary ${start} to ${end}`;
}

function buildSummaryContent(
  entries: MemoryIndexEntry[],
  generatedAt: string,
  mode: "auto" | "manual",
): { content: string; tags: string[]; entityIds: string[] } {
  const topTags = countTop(
    entries.flatMap((entry) => entry.tags).filter((tag) => !["memory-summary", "memory-compaction"].includes(tag)),
    6,
  );
  const topEntities = countTop(entries.flatMap((entry) => entry.entityIds), 6);

  const lines = [
    "Memory compaction summary.",
    "",
    `Generated At: ${generatedAt}`,
    `Mode: ${mode}`,
    `Source Entries: ${entries.length}`,
    "",
    ...(topTags.length > 0 ? ["Top Tags", ...topTags.map((tag) => `- ${tag}`), ""] : []),
    ...(topEntities.length > 0 ? ["Top Entities", ...topEntities.map((entity) => `- ${entity}`), ""] : []),
    "Compressed Notes",
    ...entries.map(
      (entry) =>
        `- [${entry.updatedAt.slice(0, 10)}] ${entry.title}: ${clipText(entry.snippet || entry.content, 180)}`,
    ),
  ];

  return {
    content: `${lines.join("\n").trim()}\n`,
    tags: ["memory-summary", "memory-compaction", ...topTags],
    entityIds: topEntities,
  };
}

function isCompactionCandidate(entry: MemoryIndexEntry, cutoffMs: number): boolean {
  if (entry.kind !== "daily") {
    return false;
  }
  if (entry.compactedAt) {
    return false;
  }
  if (entry.compactionSourceIds?.length) {
    return false;
  }
  if ((entry.source ?? "").startsWith("memory-compaction:")) {
    return false;
  }
  if (entry.tags.includes("memory-summary")) {
    return false;
  }

  const updatedMs = Date.parse(entry.updatedAt);
  if (!Number.isFinite(updatedMs) || updatedMs > cutoffMs) {
    return false;
  }

  return true;
}

function defaultHistory(): MemoryCompactionRecordStore {
  return {
    updatedAt: nowIso(),
    items: [],
  };
}

export class MemoryCompactionService {
  private readonly memoryIndexService: MemoryIndexService;
  private readonly memoryPolicyService: MemoryPolicyService;

  constructor(
    private readonly workspaceDir: string,
    private readonly options: MemoryServiceOptions = {},
  ) {
    this.memoryIndexService = new MemoryIndexService(workspaceDir, options);
    this.memoryPolicyService = new MemoryPolicyService(workspaceDir);
  }

  private get scopeKey(): string | undefined {
    return this.options.scopeKey?.trim() || undefined;
  }

  private get scopeRootDir(): string {
    return this.scopeKey
      ? path.join(this.workspaceDir, SCOPE_ROOT_DIR, buildScopeDirName(this.scopeKey))
      : this.workspaceDir;
  }

  private get longTermPath(): string {
    return path.join(this.scopeRootDir, LONG_TERM_FILE);
  }

  private get historyPath(): string {
    return path.join(this.workspaceDir, HISTORY_FILE);
  }

  private async readHistory(): Promise<MemoryCompactionRecordStore> {
    try {
      const raw = await readFile(this.historyPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<MemoryCompactionRecordStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        items: Array.isArray(parsed.items) ? (parsed.items as MemoryCompactionRecord[]) : [],
      };
    } catch {
      return defaultHistory();
    }
  }

  private async writeHistory(store: MemoryCompactionRecordStore): Promise<void> {
    await mkdir(path.dirname(this.historyPath), { recursive: true });
    await writeFile(
      this.historyPath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  private async appendHistory(record: MemoryCompactionRecord): Promise<void> {
    const store = await this.readHistory();
    await this.writeHistory({
      ...store,
      items: [record, ...store.items].slice(0, 200),
    });
  }

  private async appendLongTermEntry(title: string, content: string, source: string): Promise<void> {
    const now = new Date();
    await mkdir(this.scopeRootDir, { recursive: true });

    let existing = "";
    try {
      existing = await readFile(this.longTermPath, "utf8");
    } catch {
      existing = "# Memory\n";
    }

    const separator = existing.endsWith("\n") ? "" : "\n";
    const block = `\n## ${title} (${formatTimestamp(now)}) [source: ${source}]\n\n${content.trim()}\n`;
    await writeFile(this.longTermPath, `${existing}${separator}${block}`.trimEnd() + "\n", "utf8");
  }

  async getPolicy() {
    return this.memoryPolicyService.getPolicy();
  }

  async updatePolicy(patch: MemoryPolicyPatch) {
    return this.memoryPolicyService.updatePolicy(patch);
  }

  async listRecent(limit = 20): Promise<MemoryCompactionRecord[]> {
    const store = await this.readHistory();
    const filtered = this.scopeKey
      ? store.items.filter((item) => item.scopeKey === this.scopeKey)
      : store.items.filter((item) => !item.scopeKey);
    return filtered.slice(0, Math.max(1, Math.min(limit, 100)));
  }

  async maybeAutoCompact(): Promise<MemoryCompactionResult | null> {
    const policy = await this.memoryPolicyService.getPolicy();
    if (!policy.autoCompactionEnabled) {
      return null;
    }

    const result = await this.compact({
      source: "auto",
      olderThanDays: policy.autoCompactionOlderThanDays,
      minEntries: policy.autoCompactionMinEntries,
      maxEntries: policy.autoCompactionMaxEntries,
    });
    return result.compactedEntryCount > 0 ? result : null;
  }

  async compact(options: MemoryCompactionOptions = {}): Promise<MemoryCompactionResult> {
    const policy = await this.memoryPolicyService.getPolicy();
    const mode = options.source ?? "manual";
    const olderThanDays = Math.max(
      1,
      Math.min(options.olderThanDays ?? policy.autoCompactionOlderThanDays ?? DEFAULT_OLDER_THAN_DAYS, 365),
    );
    const minEntries = Math.max(
      2,
      Math.min(options.minEntries ?? policy.autoCompactionMinEntries ?? DEFAULT_MIN_ENTRIES, 50),
    );
    const maxEntries = Math.max(
      minEntries,
      Math.min(options.maxEntries ?? policy.autoCompactionMaxEntries ?? DEFAULT_MAX_ENTRIES, 50),
    );
    const generatedAt = nowIso();
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const entries = await this.memoryIndexService.listEntries();
    const dailyActiveCount = entries.filter(
      (entry) => entry.kind === "daily" && !entry.compactedAt && !entry.compactionSourceIds?.length,
    ).length;
    const candidates = entries
      .filter(
        (entry) =>
          isCompactionCandidate(entry, cutoffMs) &&
          !entry.tags.some((tag) => policy.neverCompactTags.includes(tag)) &&
          !(policy.highConfidenceLongTermOnly && entry.confidence === "high"),
      )
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
      .slice(0, maxEntries);

    if (mode === "auto" && dailyActiveCount < policy.maxDailyEntriesBeforeAutoCompact) {
      const skipped = {
        generatedAt,
        candidateCount: candidates.length,
        compactedEntryCount: 0,
        sourceEntryIds: candidates.map((entry) => entry.id),
        ...(this.scopeKey ? { scopeKey: this.scopeKey } : {}),
        mode,
      } satisfies MemoryCompactionResult;
      await this.appendHistory({
        id: randomUUID(),
        ...skipped,
        status: "skipped",
        reason: `daily-entry-threshold:${dailyActiveCount}/${policy.maxDailyEntriesBeforeAutoCompact}`,
      });
      return skipped;
    }

    if (candidates.length < minEntries) {
      const skipped = {
        generatedAt,
        candidateCount: candidates.length,
        compactedEntryCount: 0,
        sourceEntryIds: candidates.map((entry) => entry.id),
        ...(this.scopeKey ? { scopeKey: this.scopeKey } : {}),
        mode,
      } satisfies MemoryCompactionResult;
      await this.appendHistory({
        id: randomUUID(),
        ...skipped,
        status: "skipped",
        reason: `not-enough-candidates:${candidates.length}/${minEntries}`,
      });
      return skipped;
    }

    const title = buildSummaryTitle(candidates);
    const summary = buildSummaryContent(candidates, generatedAt, mode);
    const sourceId = `memory-compaction:${mode}:${randomUUID()}`;
    const baseResult = {
      generatedAt,
      candidateCount: candidates.length,
      compactedEntryCount: candidates.length,
      sourceEntryIds: candidates.map((entry) => entry.id),
      summaryTitle: title,
      summaryPath: LONG_TERM_FILE,
      ...(this.scopeKey ? { scopeKey: this.scopeKey } : {}),
      mode,
    } satisfies MemoryCompactionResult;

    if (options.dryRun) {
      return baseResult;
    }

    await this.appendLongTermEntry(title, summary.content, sourceId);
    const summaryEntry = await this.memoryIndexService.recordRememberedEntry({
      path: LONG_TERM_FILE,
      kind: "long-term",
      title,
      content: summary.content,
      createdAt: generatedAt,
      remember: {
        scope: "long-term",
        title,
        content: summary.content,
        source: `memory-compaction:${mode}`,
        sourceId,
        sourceType: "agent-inferred",
        confidence: "medium",
        tags: summary.tags,
        entityIds: summary.entityIds,
        compactionSourceIds: candidates.map((entry) => entry.id),
      },
    });
    await this.memoryIndexService.markCompacted(
      candidates.map((entry) => entry.id),
      summaryEntry.id,
      generatedAt,
    );

    const result = {
      ...baseResult,
      summaryEntryId: summaryEntry.id,
    } satisfies MemoryCompactionResult;
    await this.appendHistory({
      id: randomUUID(),
      ...result,
      status: "compacted",
    });
    return result;
  }
}
