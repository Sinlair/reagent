import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RepoAnalysisReport, RepoAnalysisStore } from "../types/researchArtifacts.js";

const STORE_FILE = "research/repo-reports.json";
const MAX_REPORTS = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): RepoAnalysisStore {
  return {
    updatedAt: nowIso(),
    reports: [],
  };
}

function normalizeRepoUrl(url: string): { url: string; owner: string; repo: string } {
  const match = url.trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/iu);
  if (!match || !match[1] || !match[2]) {
    throw new Error("A valid GitHub repository URL is required.");
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/iu, "");
  return {
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
  };
}

function extractMetaContent(html: string, property: string): string | undefined {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:name|property)=["']${property}["'][^>]+content=["']([^"']+)["']`, "iu"),
  );
  return match?.[1]?.trim() || undefined;
}

function extractStars(html: string): number | undefined {
  const jsonStyle = html.match(/"stargazerCount"\s*:\s*(\d+)/iu)?.[1];
  if (jsonStyle) {
    return Number.parseInt(jsonStyle, 10);
  }

  const ariaStyle = html.match(/aria-label=["']([0-9][0-9,]*) users starred this repository["']/iu)?.[1];
  if (ariaStyle) {
    return Number.parseInt(ariaStyle.replace(/,/gu, ""), 10);
  }

  return undefined;
}

function extractTreeEntries(html: string, owner: string, repo: string): Array<{ branch: string; path: string }> {
  const pattern = new RegExp(`/${owner}/${repo}/tree/([^/]+)/([^"'#?]+)`, "giu");
  return [...html.matchAll(pattern)]
    .map((match) => ({
      branch: match[1] ?? "",
      path: match[2] ?? "",
    }))
    .filter((entry) => entry.branch && entry.path);
}

function extractKeyPaths(entries: Array<{ branch: string; path: string }>): string[] {
  return [...new Set(entries.map((entry) => entry.path))].slice(0, 8);
}

function extractDefaultBranch(entries: Array<{ branch: string; path: string }>): string | undefined {
  return entries[0]?.branch;
}

function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/u).filter((token) => token.length >= 3))];
}

function estimateOfficial(urlOwner: string, repo: string, contextTitle?: string, description?: string): boolean {
  if (!contextTitle?.trim()) {
    return false;
  }

  const contextTokens = tokenize(contextTitle);
  const haystack = `${urlOwner} ${repo} ${description ?? ""}`.toLowerCase();
  const hits = contextTokens.filter((token) => haystack.includes(token));
  return hits.length >= Math.min(2, contextTokens.length);
}

export class ResearchRepoAnalysisService {
  private readonly storePath: string;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
  }

  private async readStore(): Promise<RepoAnalysisStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<RepoAnalysisStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: RepoAnalysisStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 20): Promise<RepoAnalysisReport[]> {
    const store = await this.readStore();
    return store.reports.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getReport(reportId: string): Promise<RepoAnalysisReport | null> {
    const id = reportId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.reports.find((report) => report.id === id) ?? null;
  }

  async analyze(input: { url: string; contextTitle?: string | undefined }): Promise<RepoAnalysisReport> {
    const normalized = normalizeRepoUrl(input.url);
    const response = await fetch(normalized.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "ReAgent/0.1"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub repository page: ${response.status}`);
    }

    const html = await response.text();
    const title = extractMetaContent(html, "og:title") ?? `${normalized.owner}/${normalized.repo}`;
    const description = extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description");
    const stars = extractStars(html);
    const treeEntries = extractTreeEntries(html, normalized.owner, normalized.repo);
    const keyPaths = extractKeyPaths(treeEntries);
    const defaultBranch = extractDefaultBranch(treeEntries);
    const likelyOfficial = estimateOfficial(normalized.owner, normalized.repo, input.contextTitle, description);

    const notes = [
      stars != null ? `Stars: ${stars}.` : "Star count could not be determined.",
      keyPaths.length > 0 ? `Detected top-level paths: ${keyPaths.join(", ")}.` : "Top-level paths could not be detected.",
      defaultBranch ? `Default branch appears to be ${defaultBranch}.` : "Default branch could not be determined.",
      likelyOfficial ? "Repository name and description align with the referenced paper/article." : "Official status is uncertain.",
    ];

    const report: RepoAnalysisReport = {
      id: randomUUID(),
      url: normalized.url,
      owner: normalized.owner,
      repo: normalized.repo,
      ...(defaultBranch ? { defaultBranch } : {}),
      ...(title?.trim() ? { title: title.trim() } : {}),
      ...(description?.trim() ? { description: description.trim() } : {}),
      ...(stars != null ? { stars } : {}),
      likelyOfficial,
      keyPaths,
      notes,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      reports: [report, ...store.reports].slice(0, MAX_REPORTS),
    });

    return report;
  }
}
