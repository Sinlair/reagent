import type { PaperCandidate, ResearchPlan, ResearchRequest } from "./types.js";

const englishStopwords = new Set([
  "about", "across", "after", "also", "among", "and", "are", "because", "been", "being", "between",
  "from", "have", "into", "main", "methods", "more", "most", "over", "that", "their", "there",
  "these", "this", "those", "what", "when", "where", "which", "with"
]);

function tokenize(value?: string): string[] {
  if (!value) return [];
  const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!normalized) return [];
  return [...new Set(normalized.split(/\s+/u).filter((token) => token.length >= 2 && !englishStopwords.has(token)))];
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
  const normalized = text.toLowerCase();
  return terms.filter((term) => normalized.includes(term));
}

function getRecencyScore(year?: number): number {
  if (!year) return 0;
  const age = new Date().getUTCFullYear() - year;
  if (age <= 2) return 4;
  if (age <= 5) return 3;
  if (age <= 8) return 2;
  return 1;
}

function comparePapers(left: PaperCandidate, right: PaperCandidate): number {
  const leftScore = left.score ?? 0;
  const rightScore = right.score ?? 0;
  if (rightScore !== leftScore) return rightScore - leftScore;
  const leftYear = left.year ?? 0;
  const rightYear = right.year ?? 0;
  if (rightYear !== leftYear) return rightYear - leftYear;
  return left.title.localeCompare(right.title);
}

export function rankPapers(input: { request: ResearchRequest; plan: ResearchPlan; papers: PaperCandidate[] }): PaperCandidate[] {
  const queryTerms = [...new Set(collectQueryTerms(input.request, input.plan))];

  return input.papers
    .map((paper) => {
      const titleMatches = findMatches(paper.title, queryTerms);
      const abstractMatches = findMatches(paper.abstract ?? "", queryTerms).filter((term) => !titleMatches.includes(term));
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
        ...paper,
        score,
        rankingReasons: [
          ...(titleMatches.length ? [`Title matches: ${titleMatches.join(", ")}`] : []),
          ...(abstractMatches.length ? [`Abstract matches: ${abstractMatches.join(", ")}`] : []),
          ...(paper.abstract ? ["Abstract is available for synthesis."] : []),
          ...(paper.doi ? ["DOI metadata is present."] : []),
          ...(paper.year ? [`Publication year: ${paper.year}.`] : []),
          ...(paper.venue ? [`Venue metadata: ${paper.venue}.`] : []),
          ...(paper.relevanceReason ? [paper.relevanceReason] : [])
        ]
      };
    })
    .sort(comparePapers)
    .map((paper, index) => ({
      ...paper,
      rank: index + 1,
      relevanceReason: paper.rankingReasons?.join(" ") || paper.relevanceReason || `Ranked #${index + 1} for the current request.`
    }));
}
