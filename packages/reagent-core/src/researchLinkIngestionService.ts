import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type {
  ResearchLinkIngestionRequest,
  ResearchSourceItem,
  ResearchSourcePaperCandidate,
  ResearchSourceRepoCandidate,
  ResearchSourceStore,
} from "./researchArtifacts.js";

const STORE_FILE = "research/source-items.json";
const MAX_ITEMS = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchSourceStore {
  return {
    updatedAt: nowIso(),
    items: [],
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, "\"")
    .replace(/&#39;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function extractTitleFromHtml(html: string): string | undefined {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/iu)?.[1];
  if (ogTitle?.trim()) {
    return ogTitle.trim();
  }

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/iu)?.[1];
  return title?.trim() || undefined;
}

function extractMetaContent(html: string, property: string): string | undefined {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:name|property)=["']${property}["'][^>]+content=["']([^"']+)["']`, "iu"),
  );
  return match?.[1]?.trim() || undefined;
}

function extractAttributeLinks(html: string, attribute: string): string[] {
  const regex = new RegExp(`${attribute}=["']([^"'#]+)["']`, "giu");
  const matches = [...html.matchAll(regex)]
    .map((match) => match[1])
    .filter((link): link is string => typeof link === "string" && link.trim().length > 0);
  return [...new Set(matches.map((link) => link.trim()))];
}

function buildExcerpt(text: string, maxLength = 260): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function uniqueLinks(links: string[]): string[] {
  return [...new Set(links.map((link) => link.trim()).filter(Boolean))];
}

function normalizeGithubCandidate(url: string, reason: string): ResearchSourceRepoCandidate | null {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/iu);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    url,
    owner: match[1],
    repo: match[2].replace(/\.git$/iu, ""),
    reason,
    confidence: "high",
  };
}

function dedupePaperCandidates(candidates: ResearchSourcePaperCandidate[]): ResearchSourcePaperCandidate[] {
  const byKey = new Map<string, ResearchSourcePaperCandidate>();
  for (const candidate of candidates) {
    const key = (candidate.arxivId || candidate.doi || candidate.url || candidate.title || randomUUID()).toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
}

function dedupeRepoCandidates(candidates: ResearchSourceRepoCandidate[]): ResearchSourceRepoCandidate[] {
  const byKey = new Map<string, ResearchSourceRepoCandidate>();
  for (const candidate of candidates) {
    const key = candidate.url.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
}

function extractArxivCandidates(text: string): ResearchSourcePaperCandidate[] {
  const matches = [...text.matchAll(/https?:\/\/(?:www\.)?arxiv\.org\/(abs|pdf)\/([^\s"'<>?#]+)(?:\.pdf)?/giu)];
  return matches
    .map((match) => match[2])
    .filter((arxivId): arxivId is string => typeof arxivId === "string" && arxivId.trim().length > 0)
    .map((arxivIdRaw) => {
      const arxivId = arxivIdRaw.replace(/\.pdf$/iu, "");
      return {
        url: `https://arxiv.org/abs/${arxivId}`,
        pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
        arxivId,
        reason: "Found arXiv link in source content.",
        confidence: "high",
      } satisfies ResearchSourcePaperCandidate;
    });
}

function extractDoiCandidates(text: string): ResearchSourcePaperCandidate[] {
  const doiLinks = [...text.matchAll(/https?:\/\/(?:dx\.)?doi\.org\/([^\s"'<>?#]+)/giu)]
    .map((match) => match[1])
    .filter((doi): doi is string => typeof doi === "string" && doi.trim().length > 0);
  return doiLinks.map((doi) => ({
    url: `https://doi.org/${doi}`,
    doi,
    reason: "Found DOI link in source content.",
    confidence: "high",
  }));
}

function extractGithubCandidates(links: string[]): ResearchSourceRepoCandidate[] {
  return links
    .map((link) => normalizeGithubCandidate(link, "Found GitHub link in article outbound links."))
    .filter((candidate): candidate is ResearchSourceRepoCandidate => Boolean(candidate));
}

function extractReadableContent(html: string, url?: string | undefined): { content: string; title?: string | undefined } {
  try {
    const dom = new JSDOM(html, {
      url: url ?? "https://example.com/",
    });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    if (!parsed) {
      return {
        content: stripHtml(html),
        ...(extractTitleFromHtml(html) ? { title: extractTitleFromHtml(html) } : {}),
      };
    }

    return {
      content: stripHtml(parsed.content || parsed.textContent || html),
      ...(parsed.title?.trim() ? { title: parsed.title.trim() } : {}),
    };
  } catch {
    return {
      content: stripHtml(html),
      ...(extractTitleFromHtml(html) ? { title: extractTitleFromHtml(html) } : {}),
    };
  }
}

export class ResearchLinkIngestionService {
  private readonly storePath: string;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
  }

  private async readStore(): Promise<ResearchSourceStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchSourceStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchSourceStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 20): Promise<ResearchSourceItem[]> {
    const store = await this.readStore();
    return store.items.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getItem(sourceItemId: string): Promise<ResearchSourceItem | null> {
    const id = sourceItemId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.items.find((item) => item.id === id) ?? null;
  }

  async ingest(input: ResearchLinkIngestionRequest): Promise<ResearchSourceItem> {
    const url = input.url?.trim();
    const rawContent = input.rawContent?.trim();
    if (!url && !rawContent) {
      throw new Error("Either url or rawContent is required.");
    }

    let html = rawContent ?? "";
    if (url) {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "ReAgentCore/0.1"
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch source URL: ${response.status}`);
      }
      html = await response.text();
    }

    const readable = extractReadableContent(html, url);
    const content = readable.content;
    const outboundLinks = uniqueLinks(
      (url
        ? extractAttributeLinks(html, "href").map((link) => {
            try {
              return new URL(link, url).toString();
            } catch {
              return link;
            }
          })
        : extractAttributeLinks(html, "href"))
    );
    const imageUrls = uniqueLinks(
      (url
        ? extractAttributeLinks(html, "src").map((link) => {
            try {
              return new URL(link, url).toString();
            } catch {
              return link;
            }
          })
        : extractAttributeLinks(html, "src"))
    );
    const ogImage = extractMetaContent(html, "og:image");
    if (ogImage) {
      imageUrls.unshift(url ? new URL(ogImage, url).toString() : ogImage);
    }

    const paperCandidates = dedupePaperCandidates([
      ...extractArxivCandidates(`${html}\n${content}`),
      ...extractDoiCandidates(`${html}\n${content}`),
    ]);
    const repoCandidates = dedupeRepoCandidates(extractGithubCandidates(outboundLinks));

    const extractedTitle = readable.title || extractTitleFromHtml(html);
    const extractedAuthor = extractMetaContent(html, "author");
    const extractedPublishedAt = extractMetaContent(html, "article:published_time");

    const item: ResearchSourceItem = {
      id: randomUUID(),
      sourceType: url ? "url" : "text",
      ...(url ? { url } : {}),
      ...(extractedTitle ? { title: extractedTitle } : {}),
      ...(extractedAuthor ? { author: extractedAuthor } : {}),
      ...(extractedPublishedAt ? { publishedAt: extractedPublishedAt } : {}),
      content,
      excerpt: buildExcerpt(content),
      outboundLinks,
      imageUrls: uniqueLinks(imageUrls),
      paperCandidates,
      repoCandidates,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      items: [item, ...store.items].slice(0, MAX_ITEMS),
    });

    return item;
  }
}
