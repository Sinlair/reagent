import type { PaperCandidate, ResearchPlan, ResearchRequest } from "../types/research.js";

const englishStopwords = new Set([
  "about",
  "across",
  "after",
  "also",
  "among",
  "and",
  "are",
  "because",
  "been",
  "being",
  "between",
  "from",
  "have",
  "into",
  "main",
  "methods",
  "more",
  "most",
  "over",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "what",
  "when",
  "where",
  "which",
  "with"
]);

function tokenize(value?: string): string[] {
  if (!value) {
    return [];
  }

  const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  return [
    ...new Set(
      normalized
        .split(/\s+/u)
        .filter((token) => token.length >= 2 && !englishStopwords.has(token))
    )
  ];
}

function collectQueryTerms(request: ResearchRequest, plan: ResearchPlan): string[] {
  return [
    ...tokenize(request.topic),
    ...tokenize(request.question),
    ...plan.subquestions.flatMap((question) => tokenize(question)),
    ...plan.searchQueries.flatMap((query) => tokenize(query))
  ];
}

function findMatches(text: string, terms: string[]): string[] {
  const normalizedText = text.toLowerCase();
  return terms.filter((term) => normalizedText.includes(term));
}

function getRecencyScore(year?: number): number {
  if (!year) {
    return 0;
  }

  const currentYear = new Date().getUTCFullYear();
  const age = currentYear - year;

  if (age <= 2) {
    return 4;
  }

  if (age <= 5) {
    return 3;
  }

  if (age <= 8) {
    return 2;
  }

  return 1;
}

function buildRankingReasons(
  paper: PaperCandidate,
  titleMatches: string[],
  abstractMatches: string[]
): string[] {
  const reasons: string[] = [];

  if (titleMatches.length > 0) {
    reasons.push(`Title matches: ${titleMatches.join(", ")}`);
  }

  if (abstractMatches.length > 0) {
    reasons.push(`Abstract matches: ${abstractMatches.join(", ")}`);
  }

  if (paper.abstract) {
    reasons.push("Abstract is available for synthesis.");
  }

  if (paper.doi) {
    reasons.push("DOI metadata is present.");
  }

  if (paper.year) {
    reasons.push(`Publication year: ${paper.year}.`);
  }

  if (paper.venue) {
    reasons.push(`Venue metadata: ${paper.venue}.`);
  }

  if (paper.relevanceReason) {
    reasons.push(paper.relevanceReason);
  }

  return reasons;
}

function scorePaper(paper: PaperCandidate, queryTerms: string[]): {
  score: number;
  rankingReasons: string[];
} {
  const titleMatches = findMatches(paper.title, queryTerms);
  const abstractMatches = findMatches(paper.abstract ?? "", queryTerms).filter(
    (match) => !titleMatches.includes(match)
  );
  const normalizedMetadata = `${paper.title} ${paper.abstract ?? ""}`.toLowerCase();
  const isSurveyLike = /\b(survey|review|benchmark|meta-analysis)\b/u.test(normalizedMetadata);

  const score =
    titleMatches.length * 6 +
    abstractMatches.length * 3 +
    (paper.abstract ? 4 : 0) +
    (paper.doi ? 2 : 0) +
    (paper.venue ? 1 : 0) +
    getRecencyScore(paper.year) +
    (isSurveyLike ? 3 : 0);

  return {
    score,
    rankingReasons: buildRankingReasons(paper, titleMatches, abstractMatches)
  };
}

function comparePapers(left: PaperCandidate, right: PaperCandidate): number {
  const leftScore = left.score ?? 0;
  const rightScore = right.score ?? 0;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const leftYear = left.year ?? 0;
  const rightYear = right.year ?? 0;

  if (rightYear !== leftYear) {
    return rightYear - leftYear;
  }

  return left.title.localeCompare(right.title);
}

export function rankPapers(input: {
  request: ResearchRequest;
  plan: ResearchPlan;
  papers: PaperCandidate[];
}): PaperCandidate[] {
  const queryTerms = [...new Set(collectQueryTerms(input.request, input.plan))];

  return input.papers
    .map((paper) => {
      const { score, rankingReasons } = scorePaper(paper, queryTerms);

      return {
        ...paper,
        score,
        rankingReasons
      };
    })
    .sort(comparePapers)
    .map((paper, index) => ({
      ...paper,
      rank: index + 1,
      relevanceReason:
        paper.rankingReasons?.join(" ") ??
        paper.relevanceReason ??
        `Ranked #${index + 1} for the current request.`
    }));
}
