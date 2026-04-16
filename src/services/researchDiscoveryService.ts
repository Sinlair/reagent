import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CrossrefPaperSearchProvider } from "../providers/search/crossrefPaperSearchProvider.js";
import type { PaperCandidate, ResearchPlan, ResearchRequest } from "../types/research.js";
import type {
  DiscoveryPaperSearchProvider,
  ResearchDiscoveryItem,
  ResearchDiscoveryRunRequest,
  ResearchDiscoveryRunResult,
  ResearchDiscoveryRunSummary,
  ResearchDiscoveryStore,
} from "../types/researchDiscovery.js";
import type { ResearchDirectionProfile } from "../types/researchDirection.js";
import { ArxivPaperSearchProvider } from "../providers/search/arxivPaperSearchProvider.js";
import { CompositePaperSearchProvider } from "../providers/search/compositePaperSearchProvider.js";
import { rankPapers } from "../workflows/paperRanker.js";
import { env } from "../config/env.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchFeedbackService } from "./researchFeedbackService.js";

const STORE_FILE = "channels/research-discovery-runs.json";
const DEFAULT_MAX_PAPERS_PER_QUERY = 4;
const DEFAULT_TOP_K = 5;
const MAX_RUN_HISTORY = 30;

interface ResearchDiscoveryServiceOptions {
  searchProvider?: DiscoveryPaperSearchProvider;
  pushDigest?: ((input: { senderId: string; senderName?: string | undefined; text: string }) => Promise<void>) | undefined;
  feedbackService?: ResearchFeedbackService | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchDiscoveryStore {
  return {
    updatedAt: nowIso(),
    runs: [],
  };
}

function discoveryStorePath(workspaceDir: string): string {
  return path.join(workspaceDir, STORE_FILE);
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
    searchQueries: [query],
  };
}

function normalizePaperDoi(value?: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
}

function normalizePaperUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/u, "") || "/";
    return `${parsed.hostname.toLowerCase()}${normalizedPath.toLowerCase()}`;
  } catch {
    return trimmed.toLowerCase().replace(/[?#].*$/u, "").replace(/\/+$/u, "");
  }
}

function normalizePaperTitle(value: string): string {
  return normalizeMatchText(value);
}

function buildDiscoveryAggregateKeys(paper: PaperCandidate): string[] {
  const keys = [
    normalizePaperDoi(paper.doi) ? `doi:${normalizePaperDoi(paper.doi)}` : "",
    normalizePaperUrl(paper.url) ? `url:${normalizePaperUrl(paper.url)}` : "",
    normalizePaperTitle(paper.title) ? `title:${normalizePaperTitle(paper.title)}` : "",
  ].filter(Boolean);

  return uniqueTrimmed(keys);
}

function hasCompatiblePublicationWindow(left: PaperCandidate, right: PaperCandidate): boolean {
  if (!left.year || !right.year) {
    return true;
  }
  return Math.abs(left.year - right.year) <= 1;
}

function isNearDuplicatePaper(left: PaperCandidate, right: PaperCandidate): boolean {
  if (!hasCompatiblePublicationWindow(left, right)) {
    return false;
  }

  const leftTitle = normalizePaperTitle(left.title);
  const rightTitle = normalizePaperTitle(right.title);
  if (!leftTitle || !rightTitle) {
    return false;
  }

  if (leftTitle === rightTitle) {
    return true;
  }

  const leftTokens = new Set(buildMatchTokens(left.title));
  const rightTokens = new Set(buildMatchTokens(right.title));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  const maxTokenCount = Math.max(leftTokens.size, rightTokens.size);
  return overlap / maxTokenCount >= 0.8;
}

function scoreDiscoveryMetadataCompleteness(item: PaperCandidate): number {
  let score = 0;
  if (item.doi) {
    score += 3;
  }
  if (item.venue) {
    score += 2;
  }
  if (item.pdfUrl) {
    score += 1;
  }
  if (item.abstract) {
    score += 1;
  }
  if (item.authors.length > 0) {
    score += 1;
  }
  return score;
}

function compareDiscoveryItems(left: ResearchDiscoveryItem, right: ResearchDiscoveryItem): number {
  const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const metadataDelta = scoreDiscoveryMetadataCompleteness(right) - scoreDiscoveryMetadataCompleteness(left);
  if (metadataDelta !== 0) {
    return metadataDelta;
  }

  const yearDelta = (right.year ?? 0) - (left.year ?? 0);
  if (yearDelta !== 0) {
    return yearDelta;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  const sourceDelta = left.source.localeCompare(right.source);
  if (sourceDelta !== 0) {
    return sourceDelta;
  }

  return left.url.localeCompare(right.url);
}

function compareDiscoveryMergePreference(left: ResearchDiscoveryItem, right: ResearchDiscoveryItem): number {
  const metadataDelta = scoreDiscoveryMetadataCompleteness(right) - scoreDiscoveryMetadataCompleteness(left);
  if (metadataDelta !== 0) {
    return metadataDelta;
  }

  const yearDelta = (right.year ?? 0) - (left.year ?? 0);
  if (yearDelta !== 0) {
    return yearDelta;
  }

  const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const titleDelta = left.title.localeCompare(right.title);
  if (titleDelta !== 0) {
    return titleDelta;
  }

  return left.url.localeCompare(right.url);
}

function mergeDiscoveryItemPair(primaryCandidate: ResearchDiscoveryItem, secondaryCandidate: ResearchDiscoveryItem): ResearchDiscoveryItem {
  const primary =
    compareDiscoveryMergePreference(primaryCandidate, secondaryCandidate) <= 0 ? primaryCandidate : secondaryCandidate;
  const secondary = primary === primaryCandidate ? secondaryCandidate : primaryCandidate;

  return {
    ...primary,
    authors: primary.authors.length > 0 ? primary.authors : secondary.authors,
    url: primary.url || secondary.url,
    pdfUrl: primary.pdfUrl || secondary.pdfUrl,
    year: primary.year ?? secondary.year,
    venue: primary.venue ?? secondary.venue,
    doi: primary.doi ?? secondary.doi,
    source: primary.source || secondary.source,
    directionLabel: uniqueTrimmed([primary.directionLabel, secondary.directionLabel]).join(" | "),
    queryReason: uniqueTrimmed([primary.queryReason, secondary.queryReason]).join("; "),
    rankingReasons: uniqueTrimmed([...(primary.rankingReasons ?? []), ...(secondary.rankingReasons ?? [])]),
    relevanceReason: uniqueTrimmed([
      primary.relevanceReason ?? "",
      secondary.relevanceReason ?? "",
    ]).join(" "),
    venuePreferenceMatched: primary.venuePreferenceMatched || secondary.venuePreferenceMatched,
    datasetOrBenchmarkMatched: primary.datasetOrBenchmarkMatched || secondary.datasetOrBenchmarkMatched,
    targetProblemMatched: primary.targetProblemMatched || secondary.targetProblemMatched,
    baselineOrEvaluationMatched:
      primary.baselineOrEvaluationMatched || secondary.baselineOrEvaluationMatched,
    blockedTopicMatched: primary.blockedTopicMatched || secondary.blockedTopicMatched,
  };
}

function scorePreferenceMatches(item: ResearchDiscoveryItem, profile: ResearchDirectionProfile): number {
  let score = 0;

  if (item.venuePreferenceMatched) {
    score += 3;
  }
  if (item.datasetOrBenchmarkMatched) {
    score += 2;
  }
  if (item.targetProblemMatched) {
    score += 3;
  }
  if (item.baselineOrEvaluationMatched) {
    score += 2;
  }
  if (item.blockedTopicMatched) {
    score -= 5;
  }
  if (item.pdfUrl) {
    score += 1;
  }
  if (profile.priority === "primary") {
    score += 2;
  }
  if (profile.priority === "watchlist") {
    score -= 1;
  }

  return score;
}

async function scoreFeedbackMatches(
  feedbackService: ResearchFeedbackService,
  item: ResearchDiscoveryItem,
  profile: ResearchDirectionProfile,
): Promise<{ score: number; reasons: string[] }> {
  return feedbackService.scoreDiscoveryCandidate({
    directionId: profile.id,
    topic: profile.label,
    title: item.title,
    abstract: item.abstract,
    venue: item.venue,
  });
}

function buildDiscoveryItem(
  paper: PaperCandidate,
  profile: ResearchDirectionProfile,
  query: string,
  queryReason: string,
): ResearchDiscoveryItem {
  const normalizedVenue = paper.venue?.toLowerCase() ?? "";
  const metadataHaystack = `${paper.title} ${paper.abstract ?? ""} ${paper.venue ?? ""}`;
  const venuePreferenceMatched = profile.preferredVenues.some(
    (venue) => normalizedVenue.includes(venue.toLowerCase()),
  );
  const datasetOrBenchmarkMatched = [...profile.preferredDatasets, ...profile.preferredBenchmarks].some(
    (token) => normalizeMatchText(metadataHaystack).includes(normalizeMatchText(token)),
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
  const byCanonicalKey = new Map<string, ResearchDiscoveryItem>();
  const keyToCanonicalKey = new Map<string, string>();

  for (const item of items) {
    const keys = buildDiscoveryAggregateKeys(item);
    const canonicalKey =
      keys.map((key) => keyToCanonicalKey.get(key)).find((value): value is string => Boolean(value)) ??
      [...byCanonicalKey.entries()].find(([, existing]) => isNearDuplicatePaper(existing, item))?.[0];

    if (!canonicalKey) {
      const nextCanonicalKey = keys[0] ?? `id:${item.id}`;
      byCanonicalKey.set(nextCanonicalKey, item);
      for (const key of keys) {
        keyToCanonicalKey.set(key, nextCanonicalKey);
      }
      continue;
    }

    const existing = byCanonicalKey.get(canonicalKey);
    if (!existing) {
      byCanonicalKey.set(canonicalKey, item);
      for (const key of keys) {
        keyToCanonicalKey.set(key, canonicalKey);
      }
      continue;
    }

    const merged = mergeDiscoveryItemPair(existing, item);
    byCanonicalKey.set(canonicalKey, merged);
    for (const key of [...keys, ...buildDiscoveryAggregateKeys(merged)]) {
      keyToCanonicalKey.set(key, canonicalKey);
    }
  }

  return [...byCanonicalKey.values()];
}

function formatDiscoveryDigest(result: ResearchDiscoveryRunResult): string {
  if (result.items.length === 0) {
    return `No strong recent paper candidates were found for ${result.directionLabels.join(", ") || "the selected directions"}.`;
  }

  const lines = [
    `Daily discovery for ${result.directionLabels.join(", ")}`,
    "",
  ];

  for (const item of result.items) {
    const header = `${item.rank}. ${item.title}`;
    const metadata = [item.year, item.venue, item.directionLabel].filter(Boolean).join(" | ");
    const why = uniqueTrimmed([
      item.queryReason,
      ...(item.rankingReasons ?? []).slice(0, 3),
    ]).join(" ");
    const codeHint = item.pdfUrl ? "PDF: yes" : "PDF: no";

    lines.push(header);
    if (metadata) {
      lines.push(metadata);
    }
    lines.push(`Why: ${why || "Strong match for the active direction profile."}`);
    lines.push(`${codeHint}`);
    lines.push(`Link: ${item.url}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export class ResearchDiscoveryService {
  private readonly storePath: string;
  private readonly directionService: ResearchDirectionService;
  private readonly searchProvider: DiscoveryPaperSearchProvider;
  private readonly pushDigest?: ResearchDiscoveryServiceOptions["pushDigest"];
  private readonly feedbackService: ResearchFeedbackService;

  constructor(
    private readonly workspaceDir: string,
    options: ResearchDiscoveryServiceOptions = {},
  ) {
    this.storePath = discoveryStorePath(workspaceDir);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.searchProvider =
      options.searchProvider ??
      new CompositePaperSearchProvider([
        new CrossrefPaperSearchProvider(env.CROSSREF_MAILTO),
        new ArxivPaperSearchProvider()
      ]);
    this.pushDigest = options.pushDigest;
    this.feedbackService = options.feedbackService ?? new ResearchFeedbackService(workspaceDir);
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
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
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
      pushed: run.pushed,
    }));
  }

  async getRun(runId: string): Promise<ResearchDiscoveryRunResult | null> {
    const id = runId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.runs.find((run) => run.runId === id) ?? null;
  }

  async runDiscovery(input: ResearchDiscoveryRunRequest = {}): Promise<ResearchDiscoveryRunResult> {
    const maxPapersPerQuery = Math.max(1, Math.min(input.maxPapersPerQuery ?? DEFAULT_MAX_PAPERS_PER_QUERY, 10));
    const topK = Math.max(1, Math.min(input.topK ?? DEFAULT_TOP_K, 10));
    const warnings: string[] = [];

    const profilePromise = input.directionId?.trim()
      ? this.directionService.getProfile(input.directionId.trim())
      : null;

    const activeProfiles = profilePromise
      ? ((await profilePromise) ? [await profilePromise] : []).filter(
          (profile): profile is ResearchDirectionProfile => Boolean(profile),
        )
      : (await this.directionService.listProfiles()).filter((profile) => profile.enabled);

    if (activeProfiles.length === 0) {
      const emptyResult: ResearchDiscoveryRunResult = {
        runId: randomUUID(),
        generatedAt: nowIso(),
        directionIds: [],
        directionLabels: [],
        request: {
          directionId: input.directionId?.trim(),
          maxPapersPerQuery,
          topK,
          pushToWechat: Boolean(input.pushToWechat),
          ...(input.senderId?.trim() ? { senderId: input.senderId.trim() } : {}),
        },
        items: [],
        digest: "No enabled research directions are configured.",
        pushed: false,
        warnings: ["No enabled research directions are configured."],
      };
      return emptyResult;
    }

    const rankedCandidates: ResearchDiscoveryItem[] = [];

    for (const profile of activeProfiles) {
      const queries = await this.directionService.buildDiscoveryPlan(profile.id);
      const queryPlan = queries.slice(0, 6);
      let perProfilePapers: ResearchDiscoveryItem[] = [];

      for (const queryCandidate of queryPlan) {
        try {
          const request = buildDirectionRequest(profile, maxPapersPerQuery);
          const plan = buildDirectionPlan(profile, queryCandidate.query);
          const papers = await this.searchProvider.search({ request, plan });
          const ranked = rankPapers({ request, plan, papers }).map((paper) => {
            const discoveryItem = buildDiscoveryItem(
              paper,
              profile,
              queryCandidate.query,
              queryCandidate.reason,
            );
            const bonus = scorePreferenceMatches(discoveryItem, profile);
            return {
              ...discoveryItem,
              score: (paper.score ?? 0) + bonus,
              rankingReasons: uniqueTrimmed([
                ...(paper.rankingReasons ?? []),
                discoveryItem.targetProblemMatched ? "Target problem / validation match." : "",
                discoveryItem.baselineOrEvaluationMatched ? "Baseline / evaluation priority match." : "",
                discoveryItem.blockedTopicMatched ? "Blocked-topic penalty applied." : "",
                bonus > 0 ? `Profile bonus: +${bonus}.` : "",
                ]),
              };
            });
          const feedbackAdjusted: ResearchDiscoveryItem[] = [];
          for (const item of ranked) {
            const feedback = await scoreFeedbackMatches(this.feedbackService, item, profile);
            const feedbackBonus = feedback.score;
            feedbackAdjusted.push({
              ...item,
              score: (item.score ?? 0) + feedbackBonus,
              rankingReasons: uniqueTrimmed([
                ...(item.rankingReasons ?? []),
                feedbackBonus !== 0 ? `Feedback adjustment: ${feedbackBonus > 0 ? "+" : ""}${feedbackBonus}.` : "",
                ...feedback.reasons,
              ]),
            });
          }
          perProfilePapers = [...perProfilePapers, ...feedbackAdjusted];
        } catch (error) {
          warnings.push(
            `Discovery search failed for ${profile.label} / ${queryCandidate.query}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      perProfilePapers.sort(compareDiscoveryItems);
      rankedCandidates.push(...perProfilePapers.slice(0, topK * 2));
    }

    const merged = mergeDiscoveryItems(rankedCandidates)
      .sort(compareDiscoveryItems)
      .slice(0, topK)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    const result: ResearchDiscoveryRunResult = {
      runId: randomUUID(),
      generatedAt: nowIso(),
      directionIds: activeProfiles.map((profile) => profile.id),
      directionLabels: activeProfiles.map((profile) => profile.label),
      request: {
        directionId: input.directionId?.trim(),
        maxPapersPerQuery,
        topK,
        pushToWechat: Boolean(input.pushToWechat),
        ...(input.senderId?.trim() ? { senderId: input.senderId.trim() } : {}),
      },
      items: merged,
      digest: "",
      pushed: false,
      warnings,
    };

    result.digest = formatDiscoveryDigest(result);

    if (input.pushToWechat) {
      if (!input.senderId?.trim()) {
        warnings.push("Discovery push was requested, but senderId was missing.");
      } else if (!this.pushDigest) {
        warnings.push("Discovery push was requested, but no WeChat push transport is configured.");
      } else {
        await this.pushDigest({
          senderId: input.senderId.trim(),
          ...(input.senderName?.trim() ? { senderName: input.senderName.trim() } : {}),
          text: result.digest,
        });
        result.pushed = true;
      }
    }

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      runs: [result, ...store.runs].slice(0, MAX_RUN_HISTORY),
    });

    return result;
  }
}
