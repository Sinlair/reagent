import type { PaperSearchProvider } from "../../domain/ports.js";
import type { PaperCandidate, ResearchPlan, ResearchRequest } from "../../types/research.js";

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefDateParts {
  "date-parts"?: number[][] | undefined;
}

interface CrossrefLink {
  URL?: string;
  "content-type"?: string;
}

interface CrossrefWorkItem {
  DOI?: string;
  URL?: string;
  title?: string[];
  abstract?: string;
  author?: CrossrefAuthor[];
  publisher?: string;
  "container-title"?: string[];
  issued?: CrossrefDateParts;
  published?: CrossrefDateParts;
  link?: CrossrefLink[];
}

interface CrossrefWorksResponse {
  message?: {
    items?: CrossrefWorkItem[];
  };
}

const htmlEntityMap: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'"
};

function getYear(item: CrossrefWorkItem): number | undefined {
  const parts = item.issued?.["date-parts"]?.[0] ?? item.published?.["date-parts"]?.[0];
  return parts?.[0];
}

function decodeHtmlEntities(raw: string): string {
  return raw.replace(/&lt;|&gt;|&amp;|&quot;|&#39;/gu, (match) => htmlEntityMap[match] ?? match);
}

function cleanJatsAbstract(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }

  return decodeHtmlEntities(raw).replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

function mapAuthors(authors?: CrossrefAuthor[]): string[] {
  if (!authors?.length) {
    return [];
  }

  return authors
    .map((author) => author.name ?? [author.given, author.family].filter(Boolean).join(" ").trim())
    .filter((author) => author.length > 0);
}

function selectPdfUrl(item: CrossrefWorkItem): string | undefined {
  return item.link?.find((link) => link["content-type"] === "application/pdf")?.URL;
}

function buildQuery(request: ResearchRequest, plan: ResearchPlan): string {
  return plan.searchQueries.find((query) => query.trim().length > 0) ?? request.topic;
}

function deduplicatePapers(papers: PaperCandidate[]): PaperCandidate[] {
  const seen = new Set<string>();

  return papers.filter((paper) => {
    const key = (paper.doi ?? paper.title).trim().toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export class CrossrefPaperSearchProvider implements PaperSearchProvider {
  constructor(private readonly mailto?: string) {}

  async search(input: { request: ResearchRequest; plan: ResearchPlan }): Promise<PaperCandidate[]> {
    const query = buildQuery(input.request, input.plan);
    const rows = input.request.maxPapers ?? 5;
    const url = new URL("https://api.crossref.org/works");

    url.searchParams.set("query", query);
    url.searchParams.set("rows", String(rows * 2));

    if (this.mailto) {
      url.searchParams.set("mailto", this.mailto);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": this.mailto
          ? `ReAgent/0.1 (mailto:${this.mailto})`
          : "ReAgent/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Crossref request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as CrossrefWorksResponse;
    const items = payload.message?.items ?? [];

    const papers = items.map((item, index) => ({
      id: item.DOI ?? `${query}-${index + 1}`,
      title: item.title?.[0] ?? "Untitled paper",
      abstract: cleanJatsAbstract(item.abstract),
      authors: mapAuthors(item.author),
      url: item.URL ?? `https://doi.org/${item.DOI ?? ""}`,
      pdfUrl: selectPdfUrl(item),
      year: getYear(item),
      venue: item["container-title"]?.[0] ?? item.publisher,
      doi: item.DOI,
      source: "crossref",
      relevanceReason: `Retrieved for the query "${query}".`
    }));

    return deduplicatePapers(papers).slice(0, rows);
  }
}
