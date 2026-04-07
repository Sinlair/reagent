import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  MemoryFileContent,
  MemoryFileKind,
  MemoryFileSummary,
  MemorySearchResult,
  MemoryServiceOptions,
  MemoryStatus,
  RememberRequest,
} from "./memory.js";

const LONG_TERM_FILE = "MEMORY.md";
const DAILY_DIR = "memory";
const SCOPE_ROOT_DIR = "memory-scopes";
const CHUNK_TARGET_WORDS = 220;
const CHUNK_OVERLAP_LINES = 4;
const DEFAULT_SEARCH_LIMIT = 6;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

interface MemoryChunk {
  path: string;
  kind: MemoryFileKind;
  title: string;
  text: string;
  startLine: number;
  endLine: number;
}

interface PreparedChunk {
  chunk: MemoryChunk;
  haystack: string;
  terms: Map<string, number>;
  uniqueTerms: Set<string>;
  titleTerms: Set<string>;
  pathTerms: Set<string>;
  length: number;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/gu, "\n");
}

function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")}`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
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

function buildCjkTokens(text: string): string[] {
  const tokens: string[] = [];
  const sequences = text.match(/[\p{Script=Han}]{2,}/gu) ?? [];

  for (const sequence of sequences) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      tokens.push(sequence.slice(index, index + 2));
    }
  }

  return tokens;
}

function buildUniqueCjkTokens(text: string): string[] {
  const tokens = new Set<string>();
  const sequences = text.match(/[\p{Script=Han}]{2,}/gu) ?? [];

  for (const sequence of sequences) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      tokens.add(sequence.slice(index, index + 2));
    }
  }

  return [...tokens];
}

function tokenize(text: string): string[] {
  const latinTokens = text.toLowerCase().match(/[a-z0-9]{2,}/gu) ?? [];
  return [...new Set([...latinTokens, ...buildUniqueCjkTokens(text)])];
}

function tokenizeDense(text: string): string[] {
  const latinTokens = text.toLowerCase().match(/[a-z0-9]{2,}/gu) ?? [];
  return [...latinTokens, ...buildCjkTokens(text)];
}

function buildTermFrequencies(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return frequencies;
}

function buildSnippet(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength);
  const end = boundary > Math.floor(maxLength / 2) ? boundary : maxLength;
  return `${normalized.slice(0, end).trimEnd()}...`;
}

function buildContextSnippet(text: string, query: string, maxLength = 220): string {
  const lines = normalizeLineEndings(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "";
  }

  const queryTokens = tokenize(query);
  const queryLower = query.trim().toLowerCase();
  let bestLineIndex = -1;
  let bestLineScore = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const lineLower = line.toLowerCase();
    let score = lineLower.includes(queryLower) ? 6 : 0;
    for (const token of queryTokens) {
      if (lineLower.includes(token)) {
        score += 2;
      }
    }

    if (score > bestLineScore) {
      bestLineScore = score;
      bestLineIndex = index;
    }
  }

  if (bestLineIndex < 0 || bestLineScore <= 0) {
    return buildSnippet(text, maxLength);
  }

  let start = bestLineIndex;
  let end = bestLineIndex + 1;
  let snippet = lines.slice(start, end).join(" ");

  while (snippet.length < maxLength && (start > 0 || end < lines.length)) {
    if (start > 0) {
      start -= 1;
    }
    if (snippet.length < maxLength && end < lines.length) {
      end += 1;
    }
    snippet = lines.slice(start, end).join(" ");
  }

  return buildSnippet(snippet, maxLength);
}

function inferKind(relativePath: string): MemoryFileKind {
  return relativePath === LONG_TERM_FILE ? "long-term" : "daily";
}

function resolveTitle(lines: string[], startIndex: number, relativePath: string): string {
  for (let index = startIndex; index >= 0; index -= 1) {
    const trimmed = lines[index]?.trim() ?? "";
    if (/^#{1,6}\s+/u.test(trimmed)) {
      return trimmed.replace(/^#{1,6}\s+/u, "");
    }
  }

  return relativePath;
}

function buildChunks(relativePath: string, content: string): MemoryChunk[] {
  const lines = normalizeLineEndings(content).split("\n");
  const kind = inferKind(relativePath);
  const chunks: MemoryChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let wordCount = 0;

    while (end < lines.length && (wordCount < CHUNK_TARGET_WORDS || end === start)) {
      wordCount += countWords(lines[end] ?? "");
      end += 1;
    }

    const text = lines.slice(start, end).join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        path: relativePath,
        kind,
        title: resolveTitle(lines, start, relativePath),
        text,
        startLine: start + 1,
        endLine: end,
      });
    }

    if (end >= lines.length) {
      break;
    }

    start = Math.max(start + 1, end - CHUNK_OVERLAP_LINES);
  }

  return chunks;
}

function prepareChunk(chunk: MemoryChunk): PreparedChunk {
  const haystack = `${chunk.title}\n${chunk.text}`.toLowerCase();
  const denseTokens = tokenizeDense(haystack);
  return {
    chunk,
    haystack,
    terms: buildTermFrequencies(denseTokens),
    uniqueTerms: new Set(denseTokens),
    titleTerms: new Set(tokenize(chunk.title)),
    pathTerms: new Set(tokenize(chunk.path)),
    length: Math.max(denseTokens.length, 1),
  };
}

function parseDailyPathDate(relativePath: string): Date | null {
  const match = relativePath.match(/^memory\/(\d{4}-\d{2}-\d{2})\.md$/u);
  if (!match?.[1]) {
    return null;
  }

  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function scoreChunk(
  query: string,
  queryTerms: string[],
  prepared: PreparedChunk,
  preparedChunks: PreparedChunk[],
): number {
  if (queryTerms.length === 0 || preparedChunks.length === 0) {
    return 0;
  }

  const avgDocLength =
    preparedChunks.reduce((total, item) => total + item.length, 0) / preparedChunks.length;
  const queryLower = query.trim().toLowerCase();
  const documentCount = preparedChunks.length;

  let bm25 = 0;
  let overlap = 0;
  let titleHits = 0;
  let pathHits = 0;

  for (const term of queryTerms) {
    const termFrequency = prepared.terms.get(term) ?? 0;
    if (termFrequency <= 0) {
      continue;
    }

    overlap += 1;
    if (prepared.titleTerms.has(term)) {
      titleHits += 1;
    }
    if (prepared.pathTerms.has(term)) {
      pathHits += 1;
    }

    let documentFrequency = 0;
    for (const item of preparedChunks) {
      if (item.uniqueTerms.has(term)) {
        documentFrequency += 1;
      }
    }

    const idf = Math.log(1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const numerator = termFrequency * (BM25_K1 + 1);
    const denominator =
      termFrequency +
      BM25_K1 * (1 - BM25_B + BM25_B * (prepared.length / Math.max(avgDocLength, 1)));
    bm25 += idf * (numerator / denominator);
  }

  if (bm25 <= 0 && !prepared.haystack.includes(queryLower)) {
    return 0;
  }

  const phraseBonus = prepared.haystack.includes(queryLower) ? 3 : 0;
  const titlePhraseBonus = prepared.chunk.title.toLowerCase().includes(queryLower) ? 3 : 0;
  const titleBonus = titleHits * 1.75;
  const pathBonus = pathHits * 0.75;
  const coverageBonus = (overlap / queryTerms.length) * 2.5;
  const kindBonus = prepared.chunk.kind === "long-term" ? 0.8 : 0.4;

  let recencyBonus = 0;
  const dailyDate = parseDailyPathDate(prepared.chunk.path);
  if (dailyDate) {
    const ageMs = Math.max(0, Date.now() - dailyDate.getTime());
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    recencyBonus = Math.max(0, 1.2 - ageDays * 0.08);
  }

  return (
    bm25 +
    phraseBonus +
    titlePhraseBonus +
    titleBonus +
    pathBonus +
    coverageBonus +
    kindBonus +
    recencyBonus
  );
}

export class MemoryService {
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

  private get longTermPath(): string {
    return path.join(this.scopeRootDir, LONG_TERM_FILE);
  }

  private get dailyDirPath(): string {
    return path.join(this.scopeRootDir, DAILY_DIR);
  }

  async ensureWorkspace(): Promise<void> {
    await mkdir(this.scopeRootDir, { recursive: true });
    await mkdir(this.dailyDirPath, { recursive: true });
  }

  private async ensureLongTermFile(): Promise<void> {
    await this.ensureWorkspace();

    try {
      await stat(this.longTermPath);
    } catch {
      await writeFile(
        this.longTermPath,
        "# Memory\n\nLong-term preferences, decisions, and durable facts live here.\n",
        "utf8",
      );
    }
  }

  private withScope<T extends object>(value: T): T & { scopeKey?: string | undefined } {
    return this.scopeKey ? { ...value, scopeKey: this.scopeKey } : { ...value };
  }

  private async readAllowedFile(relativePath: string): Promise<MemoryFileContent> {
    const normalized = relativePath.replace(/\\/gu, "/");
    const isLongTerm = normalized === LONG_TERM_FILE;
    const isDaily = /^memory\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$/u.test(normalized);

    if (!isLongTerm && !isDaily) {
      throw new Error("Unsupported memory path");
    }

    const absolutePath = path.join(this.scopeRootDir, normalized);
    const fileStat = await stat(absolutePath);
    const content = await readFile(absolutePath, "utf8");

    return this.withScope({
      path: normalized,
      kind: inferKind(normalized),
      content,
      updatedAt: fileStat.mtime.toISOString(),
    });
  }

  async listFiles(): Promise<MemoryFileSummary[]> {
    await this.ensureLongTermFile();

    const files: MemoryFileSummary[] = [];
    const longTermStat = await stat(this.longTermPath);
    files.push(
      this.withScope({
        path: LONG_TERM_FILE,
        kind: "long-term" as const,
        size: longTermStat.size,
        updatedAt: longTermStat.mtime.toISOString(),
      }),
    );

    const dailyEntries = await readdir(this.dailyDirPath, { withFileTypes: true });

    for (const entry of dailyEntries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const absolutePath = path.join(this.dailyDirPath, entry.name);
      const fileStat = await stat(absolutePath);
      files.push(
        this.withScope({
          path: `${DAILY_DIR}/${entry.name}`,
          kind: "daily" as const,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
        }),
      );
    }

    return files.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getStatus(): Promise<MemoryStatus> {
    const files = await this.listFiles();
    return {
      workspaceDir: this.workspaceDir,
      scopeRootDir: this.scopeRootDir,
      files: files.length,
      searchMode: "hybrid",
      lastUpdatedAt: files[0]?.updatedAt ?? null,
      ...(this.scopeKey ? { scopeKey: this.scopeKey } : {}),
    };
  }

  async getFile(relativePath: string): Promise<MemoryFileContent> {
    return this.readAllowedFile(relativePath);
  }

  async remember(input: RememberRequest): Promise<MemoryFileContent> {
    await this.ensureLongTermFile();

    const now = new Date();
    const title =
      input.title?.trim() || (input.scope === "long-term" ? "Remembered Note" : "Daily Note");
    const sourceSuffix = input.source?.trim() ? ` [source: ${input.source.trim()}]` : "";
    const entry =
      input.scope === "long-term"
        ? `\n## ${title} (${formatTimestamp(now)})${sourceSuffix}\n\n${input.content.trim()}\n`
        : `\n### ${title} (${formatTimestamp(now)})${sourceSuffix}\n\n${input.content.trim()}\n`;

    const relativePath =
      input.scope === "long-term"
        ? LONG_TERM_FILE
        : `${DAILY_DIR}/${now.toISOString().slice(0, 10)}.md`;
    const absolutePath = path.join(this.scopeRootDir, relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });

    let existing = "";
    try {
      existing = await readFile(absolutePath, "utf8");
    } catch {
      existing =
        input.scope === "long-term"
          ? "# Memory\n"
          : `# Daily Memory ${now.toISOString().slice(0, 10)}\n`;
    }

    const separator = existing.endsWith("\n") ? "" : "\n";
    await writeFile(absolutePath, `${existing}${separator}${entry}`.trimEnd() + "\n", "utf8");

    return this.readAllowedFile(relativePath);
  }

  async search(query: string, limit = DEFAULT_SEARCH_LIMIT): Promise<MemorySearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const files = await this.listFiles();
    const preparedChunks: PreparedChunk[] = [];

    for (const file of files) {
      const content = await this.readAllowedFile(file.path);
      for (const chunk of buildChunks(file.path, content.content)) {
        preparedChunks.push(prepareChunk(chunk));
      }
    }

    const queryTerms = tokenize(trimmed);
    const results: MemorySearchResult[] = [];

    for (const prepared of preparedChunks) {
      const score = scoreChunk(trimmed, queryTerms, prepared, preparedChunks);
      if (score <= 0) {
        continue;
      }

      results.push(
        this.withScope({
          path: prepared.chunk.path,
          kind: prepared.chunk.kind,
          title: prepared.chunk.title,
          snippet: buildContextSnippet(prepared.chunk.text, trimmed),
          score: Math.round(score * 100) / 100,
          startLine: prepared.chunk.startLine,
          endLine: prepared.chunk.endLine,
        }),
      );
    }

    return results
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, limit);
  }
}
