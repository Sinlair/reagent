import { randomUUID } from "node:crypto";

import type { PaperCandidate, PaperSearchProvider, ResearchPlan, ResearchRequest } from "./types.js";
import type { NoveltyCheckCandidate, NoveltyCheckResult, NoveltyVerdict } from "./researchNovelty.js";
import { ArxivPaperSearchProvider } from "./providers/arxivPaperSearchProvider.js";
import { CompositePaperSearchProvider } from "./providers/compositePaperSearchProvider.js";
import { CrossrefPaperSearchProvider } from "./providers/crossrefPaperSearchProvider.js";

function nowIso(): string {
  return new Date().toISOString();
}

function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/u).map((token) => token.trim()).filter((token) => token.length >= 3))];
}

function overlapTerms(queryTerms: string[], paper: PaperCandidate): string[] {
  const haystack = `${paper.title} ${paper.abstract ?? ""}`.toLowerCase();
  return queryTerms.filter((term) => haystack.includes(term));
}

function overlapScore(queryTerms: string[], paper: PaperCandidate): number {
  const overlaps = overlapTerms(queryTerms, paper);
  return overlaps.length * 4 + (paper.abstract ? 2 : 0) + (paper.year ? 1 : 0);
}

function buildVerdict(candidates: NoveltyCheckCandidate[]): NoveltyVerdict {
  const topScore = candidates[0]?.overlapScore ?? 0;
  if (topScore >= 14) {
    return "likely-known";
  }
  if (topScore >= 8) {
    return "uncertain";
  }
  return "likely-novel";
}

function buildSummary(query: string, verdict: NoveltyVerdict, candidates: NoveltyCheckCandidate[]): string {
  if (candidates.length === 0) {
    return `No closely related papers were found for "${query}". The idea may be novel, but manual review is still required.`;
  }

  if (verdict === "likely-known") {
    return `Several closely related papers were found for "${query}". This idea is likely already explored or overlaps heavily with prior work.`;
  }

  if (verdict === "uncertain") {
    return `Some related papers were found for "${query}". The idea may still be useful, but the difference from prior work needs manual checking.`;
  }

  return `Only weakly related papers were found for "${query}". The idea may be novel, but should still be checked manually before committing.`;
}

export class ResearchNoveltyService {
  private readonly searchProvider: PaperSearchProvider;

  constructor(options: { searchProvider?: PaperSearchProvider; crossrefMailto?: string | undefined } = {}) {
    this.searchProvider =
      options.searchProvider ??
      new CompositePaperSearchProvider([
        new CrossrefPaperSearchProvider(options.crossrefMailto),
        new ArxivPaperSearchProvider()
      ]);
  }

  async check(input: { query: string; maxPapers?: number | undefined }): Promise<NoveltyCheckResult> {
    const query = input.query.trim();
    if (!query) {
      throw new Error("A novelty-check query is required.");
    }

    const request: ResearchRequest = {
      topic: query,
      question: query,
      maxPapers: Math.max(3, Math.min(input.maxPapers ?? 8, 12)),
    };
    const plan: ResearchPlan = {
      objective: query,
      subquestions: [],
      searchQueries: [query],
    };

    const papers = await this.searchProvider.search({ request, plan });
    const queryTerms = tokenize(query);
    const candidates = papers
      .map((paper) => ({
        paper,
        overlapScore: overlapScore(queryTerms, paper),
        overlapTerms: overlapTerms(queryTerms, paper),
      }))
      .sort((left, right) => right.overlapScore - left.overlapScore || left.paper.title.localeCompare(right.paper.title))
      .slice(0, 5);

    const verdict = buildVerdict(candidates);
    const summary = buildSummary(query, verdict, candidates);

    return {
      id: randomUUID(),
      query,
      verdict,
      summary,
      overlapTerms: [...new Set(candidates.flatMap((candidate) => candidate.overlapTerms))],
      candidates,
      createdAt: nowIso(),
    };
  }
}
