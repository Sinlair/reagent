import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  MemoryFileContent,
  MemoryFileKind,
  MemoryFileSummary,
  MemorySearchResult,
  MemoryStatus,
  RememberRequest
} from "../types/memory.js";

const LONG_TERM_FILE = "MEMORY.md";
const DAILY_DIR = "memory";
const CHUNK_TARGET_WORDS = 220;
const CHUNK_OVERLAP_LINES = 4;
const DEFAULT_SEARCH_LIMIT = 6;

interface MemoryChunk {
  path: string;
  kind: MemoryFileKind;
  title: string;
  text: string;
  startLine: number;
  endLine: number;
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

function buildCjkTokens(text: string): string[] {
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
  return [...new Set([...latinTokens, ...buildCjkTokens(text)])];
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
        endLine: end
      });
    }

    if (end >= lines.length) {
      break;
    }

    start = Math.max(start + 1, end - CHUNK_OVERLAP_LINES);
  }

  return chunks;
}

function scoreChunk(query: string, chunk: MemoryChunk): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return 0;
  }

  const haystack = `${chunk.title}\n${chunk.text}`.toLowerCase();
  let overlap = 0;
  let titleHits = 0;

  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      overlap += 1;
    }
    if (chunk.title.toLowerCase().includes(term)) {
      titleHits += 1;
    }
  }

  if (overlap === 0 && !haystack.includes(query.trim().toLowerCase())) {
    return 0;
  }

  const phraseBonus = haystack.includes(query.trim().toLowerCase()) ? 4 : 0;
  const kindBonus = chunk.kind === "long-term" ? 1.5 : 1;
  const dailyFreshnessBonus = /memory\/\d{4}-\d{2}-\d{2}\.md$/u.test(chunk.path) ? 0.5 : 0;

  return overlap * 4 + titleHits * 2 + phraseBonus + kindBonus + dailyFreshnessBonus;
}

export class MemoryService {
  constructor(private readonly workspaceDir: string) {}

  private get longTermPath(): string {
    return path.join(this.workspaceDir, LONG_TERM_FILE);
  }

  private get dailyDirPath(): string {
    return path.join(this.workspaceDir, DAILY_DIR);
  }

  async ensureWorkspace(): Promise<void> {
    await mkdir(this.workspaceDir, { recursive: true });
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
        "utf8"
      );
    }
  }

  private async readAllowedFile(relativePath: string): Promise<MemoryFileContent> {
    const normalized = relativePath.replace(/\\/gu, "/");
    const isLongTerm = normalized === LONG_TERM_FILE;
    const isDaily = /^memory\/[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$/u.test(normalized);

    if (!isLongTerm && !isDaily) {
      throw new Error("Unsupported memory path");
    }

    const absolutePath = path.join(this.workspaceDir, normalized);
    const fileStat = await stat(absolutePath);
    const content = await readFile(absolutePath, "utf8");

    return {
      path: normalized,
      kind: inferKind(normalized),
      content,
      updatedAt: fileStat.mtime.toISOString()
    };
  }

  async listFiles(): Promise<MemoryFileSummary[]> {
    await this.ensureLongTermFile();

    const files: MemoryFileSummary[] = [];
    const longTermStat = await stat(this.longTermPath);
    files.push({
      path: LONG_TERM_FILE,
      kind: "long-term",
      size: longTermStat.size,
      updatedAt: longTermStat.mtime.toISOString()
    });

    const dailyEntries = await readdir(this.dailyDirPath, { withFileTypes: true });

    for (const entry of dailyEntries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const absolutePath = path.join(this.dailyDirPath, entry.name);
      const fileStat = await stat(absolutePath);
      files.push({
        path: `${DAILY_DIR}/${entry.name}`,
        kind: "daily",
        size: fileStat.size,
        updatedAt: fileStat.mtime.toISOString()
      });
    }

    return files.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getStatus(): Promise<MemoryStatus> {
    const files = await this.listFiles();
    return {
      workspaceDir: this.workspaceDir,
      files: files.length,
      searchMode: "keyword",
      lastUpdatedAt: files[0]?.updatedAt ?? null
    };
  }

  async getFile(relativePath: string): Promise<MemoryFileContent> {
    return this.readAllowedFile(relativePath);
  }

  async remember(input: RememberRequest): Promise<MemoryFileContent> {
    await this.ensureLongTermFile();

    const now = new Date();
    const title = input.title?.trim() || (input.scope === "long-term" ? "Remembered Note" : "Daily Note");
    const sourceSuffix = input.source?.trim() ? ` [source: ${input.source.trim()}]` : "";
    const entry =
      input.scope === "long-term"
        ? `\n## ${title} (${formatTimestamp(now)})${sourceSuffix}\n\n${input.content.trim()}\n`
        : `\n### ${title} (${formatTimestamp(now)})${sourceSuffix}\n\n${input.content.trim()}\n`;

    const relativePath =
      input.scope === "long-term"
        ? LONG_TERM_FILE
        : `${DAILY_DIR}/${now.toISOString().slice(0, 10)}.md`;
    const absolutePath = path.join(this.workspaceDir, relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });

    let existing = "";
    try {
      existing = await readFile(absolutePath, "utf8");
    } catch {
      existing = input.scope === "long-term" ? "# Memory\n" : `# Daily Memory ${now.toISOString().slice(0, 10)}\n`;
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
    const results: MemorySearchResult[] = [];

    for (const file of files) {
      const content = await this.readAllowedFile(file.path);
      for (const chunk of buildChunks(file.path, content.content)) {
        const score = scoreChunk(trimmed, chunk);
        if (score <= 0) {
          continue;
        }

        results.push({
          path: chunk.path,
          kind: chunk.kind,
          title: chunk.title,
          snippet: buildSnippet(chunk.text),
          score: Math.round(score * 100) / 100,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        });
      }
    }

    return results
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, limit);
  }
}
