import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PaperCandidate,
  PaperSearchProvider,
  ResearchDirectionProfile,
  ResearchDiscoveryItem,
  ResearchDiscoveryRunRequest,
  ResearchDiscoveryRunResult,
  ResearchDiscoveryRunSummary,
  ResearchDiscoveryStore,
  ResearchPlan,
  ResearchRequest,
} from "./types.js";
import { rankPapers } from "./paperRanker.js";
import { ArxivPaperSearchProvider } from "./providers/arxivPaperSearchProvider.js";
import { CompositePaperSearchProvider } from "./providers/compositePaperSearchProvider.js";
import { CrossrefPaperSearchProvider } from "./providers/crossrefPaperSearchProvider.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchFeedbackService } from "./researchFeedbackService.js";

const STORE_FILE = "channels/research-discovery-runs.json";
const DEFAULT_MAX_PAPERS_PER_QUERY = 4;
const DEFAULT_TOP_K = 5;
const MAX_RUN_HISTORY = 30;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchDiscoveryStore {
  return { updatedAt: nowIso(), runs: [] };
}

function uniqueTrimmed(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

const MATCH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "what",
  "with",
]);

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function buildMatchTokens(value: string): string[] {
  return uniqueTrimmed(
    normalizeMatchText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !MATCH_STOPWORDS.has(token))
  );
}

function matchesResearchSignal(haystack: string, values: Array<string | undefined>): boolean {
  const normalizedHaystack = normalizeMatchText(haystack);
  if (!normalizedHaystack) {
    return false;
  }

  return values.some((value) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return false;
    }

    const normalizedValue = normalizeMatchText(trimmed);
    if (!normalizedValue) {
      return false;
    }

    if (normalizedValue.length <= 48 && normalizedHaystack.includes(normalizedValue)) {
      return true;
    }

    const tokens = buildMatchTokens(trimmed);
    if (tokens.length < 2) {
      return false;
    }

    const matchedCount = tokens.filter((token) => normalizedHaystack.includes(token)).length;
    return matchedCount >= Math.min(tokens.length, 3);
  });
}

function buildDiscoveryQuestion(profile: ResearchDirectionProfile): string {
  return uniqueTrimmed([
    profile.targetProblem ?? "",
    profile.summary ?? "",
    profile.tlDr ?? "",
    profile.currentGoals[0] ?? "",
    profile.successCriteria[0] ?? "",
    profile.openQuestions[0] ?? "",
    profile.label,
  ])
    .slice(0, 2)
    .join(" ");
}

function buildDirectionRequest(profile: ResearchDirectionProfile, maxPapers: number): ResearchRequest {
  return {
    topic: profile.label,
    question: buildDiscoveryQuestion(profile),
    maxPapers,
  };
}

function buildDirectionPlan(profile: ResearchDirectionProfile, query: string): ResearchPlan {
  return {
    objective:
      profile.targetProblem?.trim() ||
      profile.summary?.trim() ||
      profile.tlDr?.trim() ||
      profile.label,
    subquestions: uniqueTrimmed([
      ...profile.successCriteria.map((criterion) => `Success criterion: ${criterion}`),
      ...profile.evaluationPriorities.map((priority) => `Measure: ${priority}`),
      ...profile.shortTermValidationTargets.map((target) => `Validate: ${target}`),
      ...profile.currentGoals,
      ...profile.openQuestions,
    ]).slice(0, 10),
    searchQueries: [query]
  };
}

function aggregateKey(paper: PaperCandidate): string {
  return (paper.doi?.trim() || paper.url.trim() || paper.title.trim()).toLowerCase();
}

function scorePreferenceMatches(item: ResearchDiscoveryItem, profile: ResearchDirectionProfile): number {
  let score = 0;
  if (item.venuePreferenceMatched) score += 3;
  if (item.datasetOrBenchmarkMatched) score += 2;
  if (item.targetProblemMatched) score += 3;
  if (item.baselineOrEvaluationMatched) score += 2;
  if (item.blockedTopicMatched) score -= 5;
  if (item.pdfUrl) score += 1;
  if (profile.priority === "primary") score += 2;
  if (profile.priority === "watchlist") score -= 1;
  return score;
}

function buildDiscoveryItem(
  paper: PaperCandidate,
  profile: ResearchDirectionProfile,
  query: string,
  queryReason: string,
): ResearchDiscoveryItem {
  const normalizedVenue = paper.venue?.toLowerCase() ?? "";
  const metadataHaystack = `${paper.title} ${paper.abstract ?? ""} ${paper.venue ?? ""}`;
  const venuePreferenceMatched = profile.preferredVenues.some((venue) => normalizedVenue.includes(venue.toLowerCase()));
  const datasetOrBenchmarkMatched = [...profile.preferredDatasets, ...profile.preferredBenchmarks].some(
    (token) => normalizeMatchText(metadataHaystack).includes(normalizeMatchText(token))
  );
  const targetProblemMatched = matchesResearchSignal(metadataHaystack, [
    profile.targetProblem,
    ...profile.successCriteria,
    ...profile.shortTermValidationTargets,
  ]);
  const baselineOrEvaluationMatched = matchesResearchSignal(metadataHaystack, [
    ...profile.knownBaselines,
    ...profile.evaluationPriorities,
  ]);
  const blockedTopicMatched = matchesResearchSignal(metadataHaystack, [
    ...profile.excludedTopics,
    ...profile.blockedDirections,
  ]);

  return {
    ...paper,
    directionId: profile.id,
    directionLabel: profile.label,
    query,
    queryReason,
    venuePreferenceMatched,
    datasetOrBenchmarkMatched,
    targetProblemMatched,
    baselineOrEvaluationMatched,
    blockedTopicMatched,
  };
}

function mergeDiscoveryItems(items: ResearchDiscoveryItem[]): ResearchDiscoveryItem[] {
  const byKey = new Map<string, ResearchDiscoveryItem>();
  for (const item of items) {
    const key = aggregateKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const primary = (item.score ?? 0) > (existing.score ?? 0) ? item : existing;
    const secondary = primary === item ? existing : item;
    byKey.set(key, {
      ...primary,
      directionLabel: uniqueTrimmed([primary.directionLabel, secondary.directionLabel]).join(" | "),
      queryReason: uniqueTrimmed([primary.queryReason, secondary.queryReason]).join("; "),
      rankingReasons: uniqueTrimmed([...(primary.rankingReasons ?? []), ...(secondary.rankingReasons ?? [])]),
      relevanceReason: uniqueTrimmed([primary.relevanceReason ?? "", secondary.relevanceReason ?? ""]).join(" "),
      venuePreferenceMatched: primary.venuePreferenceMatched || secondary.venuePreferenceMatched,
      datasetOrBenchmarkMatched: primary.datasetOrBenchmarkMatched || secondary.datasetOrBenchmarkMatched,
      targetProblemMatched: primary.targetProblemMatched || secondary.targetProblemMatched,
      baselineOrEvaluationMatched:
        primary.baselineOrEvaluationMatched || secondary.baselineOrEvaluationMatched,
      blockedTopicMatched: primary.blockedTopicMatched || secondary.blockedTopicMatched,
    });
  }
  return [...byKey.values()];
}

function formatDiscoveryDigest(result: ResearchDiscoveryRunResult): string {
  if (result.items.length === 0) {
    return `No strong recent paper candidates were found for ${result.directionLabels.join(", ") || "the selected directions"}.`;
  }

  const lines = [`Daily discovery for ${result.directionLabels.join(", ")}`, ""];
  for (const item of result.items) {
    const metadata = [item.year, item.venue, item.directionLabel].filter(Boolean).join(" | ");
    const why = uniqueTrimmed([
      item.queryReason,
      ...(item.rankingReasons ?? []).slice(0, 3),
    ]).join(" ");
    lines.push(`${item.rank}. ${item.title}`);
    if (metadata) lines.push(metadata);
    lines.push(`Why: ${why || "Strong match for the active direction profile."}`);
    lines.push(`PDF: ${item.pdfUrl ? "yes" : "no"}`);
    lines.push(`Link: ${item.url}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export class ResearchDiscoveryService {
  private readonly storePath: string;
  private readonly directionService: ResearchDirectionService;
  private readonly feedbackService: ResearchFeedbackService;
  private readonly searchProvider: PaperSearchProvider;

  constructor(
    private readonly workspaceDir: string,
    options: {
      searchProvider?: PaperSearchProvider;
      feedbackService?: ResearchFeedbackService;
      crossrefMailto?: string | undefined;
    } = {}
  ) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.feedbackService = options.feedbackService ?? new ResearchFeedbackService(workspaceDir);
    this.searchProvider =
      options.searchProvider ??
      new CompositePaperSearchProvider([
        new CrossrefPaperSearchProvider(options.crossrefMailto),
        new ArxivPaperSearchProvider()
      ]);
  }

  private async readStore(): Promise<ResearchDiscoveryStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchDiscoveryStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchDiscoveryStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`, "utf8");
  }

  async listRecentRuns(limit = 10): Promise<ResearchDiscoveryRunSummary[]> {
    const store = await this.readStore();
    return store.runs.slice(0, Math.max(1, Math.min(limit, 50))).map((run) => ({
      runId: run.runId,
      generatedAt: run.generatedAt,
      directionIds: run.directionIds,
      directionLabels: run.directionLabels,
      topTitle: run.items[0]?.title,
      itemCount: run.items.length,
    }));
  }

  async getRun(runId: string): Promise<ResearchDiscoveryRunResult | null> {
    const id = runId.trim();
    if (!id) return null;
    return (await this.readStore()).runs.find((run) => run.runId === id) ?? null;
  }

  async runDiscovery(input: ResearchDiscoveryRunRequest = {}): Promise<ResearchDiscoveryRunResult> {
    const maxPapersPerQuery = Math.max(1, Math.min(input.maxPapersPerQuery ?? DEFAULT_MAX_PAPERS_PER_QUERY, 10));
    const topK = Math.max(1, Math.min(input.topK ?? DEFAULT_TOP_K, 10));
    const warnings: string[] = [];

    let activeProfiles: ResearchDirectionProfile[] = [];
    if (input.directionId?.trim()) {
      const profile = await this.directionService.getProfile(input.directionId.trim());
      activeProfiles = profile ? [profile] : [];
    } else {
      activeProfiles = (await this.directionService.listProfiles()).filter((profile) => profile.enabled);
    }

    if (activeProfiles.length === 0) {
      return {
        runId: randomUUID(),
        generatedAt: nowIso(),
        directionIds: [],
        directionLabels: [],
        request: { directionId: input.directionId?.trim(), maxPapersPerQuery, topK },
        items: [],
        digest: "No enabled research directions are configured.",
        warnings: ["No enabled research directions are configured."],
      };
    }

    const rankedCandidates: ResearchDiscoveryItem[] = [];

    for (const profile of activeProfiles) {
      const queries = (await this.directionService.buildDiscoveryPlan(profile.id)).slice(0, 6);
      let perProfilePapers: ResearchDiscoveryItem[] = [];

      for (const queryCandidate of queries) {
        try {
          const request = buildDirectionRequest(profile, maxPapersPerQuery);
          const plan = buildDirectionPlan(profile, queryCandidate.query);
          const papers = await this.searchProvider.search({ request, plan });
          const ranked = rankPapers({ request, plan, papers });
          const adjusted: ResearchDiscoveryItem[] = [];

          for (const paper of ranked) {
            const discoveryItem = buildDiscoveryItem(paper, profile, queryCandidate.query, queryCandidate.reason);
            const profileBonus = scorePreferenceMatches(discoveryItem, profile);
            const feedback = await this.feedbackService.scoreDiscoveryCandidate({
              directionId: profile.id,
              topic: profile.label,
              title: discoveryItem.title,
              abstract: discoveryItem.abstract,
              venue: discoveryItem.venue,
            });

            adjusted.push({
              ...discoveryItem,
              score: (paper.score ?? 0) + profileBonus + feedback.score,
              rankingReasons: uniqueTrimmed([
                ...(paper.rankingReasons ?? []),
                discoveryItem.targetProblemMatched ? "Target problem / validation match." : "",
                discoveryItem.baselineOrEvaluationMatched ? "Baseline / evaluation priority match." : "",
                discoveryItem.blockedTopicMatched ? "Blocked-topic penalty applied." : "",
                ...(profileBonus > 0 ? [`Profile bonus: +${profileBonus}.`] : []),
                ...(feedback.score !== 0 ? [`Feedback adjustment: ${feedback.score > 0 ? "+" : ""}${feedback.score}.`] : []),
                ...feedback.reasons,
              ]),
            });
          }

          perProfilePapers = [...perProfilePapers, ...adjusted];
        } catch (error) {
          warnings.push(`Discovery search failed for ${profile.label} / ${queryCandidate.query}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      perProfilePapers.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
      rankedCandidates.push(...perProfilePapers.slice(0, topK * 2));
    }

    const items = mergeDiscoveryItems(rankedCandidates)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title))
      .slice(0, topK)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const result: ResearchDiscoveryRunResult = {
      runId: randomUUID(),
      generatedAt: nowIso(),
      directionIds: activeProfiles.map((profile) => profile.id),
      directionLabels: activeProfiles.map((profile) => profile.label),
      request: { directionId: input.directionId?.trim(), maxPapersPerQuery, topK },
      items,
      digest: "",
      warnings,
    };

    result.digest = formatDiscoveryDigest(result);
    const store = await this.readStore();
    await this.writeStore({ ...store, runs: [result, ...store.runs].slice(0, 30) });
    return result;
  }
}
