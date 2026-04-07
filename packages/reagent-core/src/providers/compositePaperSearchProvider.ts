import type { PaperCandidate, PaperSearchProvider, ResearchPlan, ResearchRequest } from "../types.js";

function deduplicatePapers(papers: PaperCandidate[]): PaperCandidate[] {
  const seen = new Set<string>();
  return papers.filter((paper) => {
    const key = (paper.doi ?? paper.url ?? paper.title).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class CompositePaperSearchProvider implements PaperSearchProvider {
  constructor(private readonly providers: PaperSearchProvider[]) {}

  async search(input: { request: ResearchRequest; plan: ResearchPlan }): Promise<PaperCandidate[]> {
    const settled = await Promise.allSettled(this.providers.map((provider) => provider.search(input)));
    const papers: PaperCandidate[] = [];
    const errors: string[] = [];

    for (const result of settled) {
      if (result.status === "fulfilled") papers.push(...result.value);
      else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }

    const deduped = deduplicatePapers(papers)
      .sort((left, right) => (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title))
      .slice(0, input.request.maxPapers ?? 5);

    if (deduped.length === 0 && errors.length > 0) {
      throw new Error(`All paper sources failed: ${errors.join(" | ")}`);
    }

    return deduped;
  }
}
