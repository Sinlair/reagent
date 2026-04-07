import type { PaperCandidate, PaperSearchProvider, ResearchPlan, ResearchRequest } from "../types.js";

const xmlEntityMap: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&apos;": "'"
};

function buildQuery(request: ResearchRequest, plan: ResearchPlan): string {
  return plan.searchQueries.find((query) => query.trim().length > 0) ?? request.topic;
}

function decodeXmlEntities(raw: string): string {
  return raw.replace(/&lt;|&gt;|&amp;|&quot;|&#39;|&apos;/gu, (match) => xmlEntityMap[match] ?? match);
}

function normalizeText(raw?: string | undefined): string | undefined {
  const normalized = decodeXmlEntities(raw ?? "").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
  return normalized || undefined;
}

function extractTag(block: string, tagName: string): string | undefined {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "iu"));
  return normalizeText(match?.[1]);
}

function extractAuthors(block: string): string[] {
  return [...block.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/giu)]
    .map((match) => normalizeText(match[1]))
    .filter((value): value is string => Boolean(value));
}

function extractPdfUrl(block: string): string | undefined {
  const pdfLink =
    block.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/iu)?.[1] ??
    block.match(/<link[^>]+href="([^"]+)"[^>]+type="application\/pdf"/iu)?.[1];
  return pdfLink?.trim() || undefined;
}

function extractArxivId(id?: string | undefined): string | undefined {
  const match = id?.match(/\/abs\/([^/?#]+)$/iu) ?? id?.match(/arxiv\.org\/pdf\/([^/?#]+?)(?:\.pdf)?$/iu);
  return match?.[1]?.trim();
}

function deduplicatePapers(papers: PaperCandidate[]): PaperCandidate[] {
  const seen = new Set<string>();
  return papers.filter((paper) => {
    const key = (paper.doi ?? paper.url ?? paper.title).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class ArxivPaperSearchProvider implements PaperSearchProvider {
  async search(input: { request: ResearchRequest; plan: ResearchPlan }): Promise<PaperCandidate[]> {
    const query = buildQuery(input.request, input.plan);
    const rows = input.request.maxPapers ?? 5;
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", `all:${query}`);
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", String(rows * 2));
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "ReAgentCore/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`arXiv request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/giu)];
    const papers = entries.map((entry, index) => {
      const block = entry[1] ?? "";
      const id = extractTag(block, "id");
      const published = extractTag(block, "published");
      const doi = extractTag(block, "arxiv:doi");
      const arxivId = extractArxivId(id);

      return {
        id: arxivId ?? doi ?? `${query}-arxiv-${index + 1}`,
        title: extractTag(block, "title") ?? "Untitled paper",
        abstract: extractTag(block, "summary"),
        authors: extractAuthors(block),
        url: id ?? `https://arxiv.org/abs/${arxivId ?? ""}`,
        pdfUrl: extractPdfUrl(block),
        year: published ? Number.parseInt(published.slice(0, 4), 10) || undefined : undefined,
        venue: "arXiv",
        doi: doi ?? undefined,
        source: "arxiv",
        relevanceReason: `Retrieved for the query "${query}".`
      } satisfies PaperCandidate;
    });

    return deduplicatePapers(papers).slice(0, rows);
  }
}
