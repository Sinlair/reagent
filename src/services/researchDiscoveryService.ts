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
import { rankPapers } from "../workflows/paperRanker.js";
import { env } from "../config/env.js";
import { ResearchDirectionService } from "./researchDirectionService.js";

const STORE_FILE = "channels/research-discovery-runs.json";
const DEFAULT_MAX_PAPERS_PER_QUERY = 4;
const DEFAULT_TOP_K = 5;
const MAX_RUN_HISTORY = 30;

interface ResearchDiscoveryServiceOptions {
  searchProvider?: DiscoveryPaperSearchProvider;
  pushDigest?: ((input: { senderId: string; senderName?: string | undefined; text: string }) => Promise<void>) | undefined;
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

function buildDirectionRequest(profile: ResearchDirectionProfile, maxPapers: number): ResearchRequest {
  return {
    topic: profile.label,
    question:
      profile.summary?.trim() ||
      profile.currentGoals[0] ||
      profile.openQuestions[0] ||
      profile.label,
    maxPapers,
  };
}

function buildDirectionPlan(profile: ResearchDirectionProfile, query: string): ResearchPlan {
  return {
    objective: profile.summary?.trim() || profile.label,
    subquestions: [...profile.openQuestions, ...profile.currentGoals],
    searchQueries: [query],
  };
}

function aggregateKey(paper: PaperCandidate): string {
  return (paper.doi?.trim() || paper.url.trim() || paper.title.trim()).toLowerCase();
}

function scorePreferenceMatches(item: ResearchDiscoveryItem, profile: ResearchDirectionProfile): number {
  let score = 0;

  if (item.venuePreferenceMatched) {
    score += 3;
  }
  if (item.datasetOrBenchmarkMatched) {
    score += 2;
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

function buildDiscoveryItem(
  paper: PaperCandidate,
  profile: ResearchDirectionProfile,
  query: string,
  queryReason: string,
): ResearchDiscoveryItem {
  const normalizedVenue = paper.venue?.toLowerCase() ?? "";
  const metadataHaystack = `${paper.title} ${paper.abstract ?? ""}`.toLowerCase();
  const venuePreferenceMatched = profile.preferredVenues.some(
    (venue) => normalizedVenue.includes(venue.toLowerCase()),
  );
  const datasetOrBenchmarkMatched = [...profile.preferredDatasets, ...profile.preferredBenchmarks].some(
    (token) => metadataHaystack.includes(token.toLowerCase()),
  );

  return {
    ...paper,
    directionId: profile.id,
    directionLabel: profile.label,
    query,
    queryReason,
    venuePreferenceMatched,
    datasetOrBenchmarkMatched,
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

    const existingScore = existing.score ?? 0;
    const nextScore = item.score ?? 0;
    const primary = nextScore > existingScore ? item : existing;
    const secondary = primary === item ? existing : item;

    byKey.set(key, {
      ...primary,
      directionLabel: uniqueTrimmed([primary.directionLabel, secondary.directionLabel]).join(" | "),
      queryReason: uniqueTrimmed([primary.queryReason, secondary.queryReason]).join("; "),
      rankingReasons: uniqueTrimmed([...(primary.rankingReasons ?? []), ...(secondary.rankingReasons ?? [])]),
      relevanceReason: uniqueTrimmed([
        primary.relevanceReason ?? "",
        secondary.relevanceReason ?? "",
      ]).join(" "),
      venuePreferenceMatched: primary.venuePreferenceMatched || secondary.venuePreferenceMatched,
      datasetOrBenchmarkMatched: primary.datasetOrBenchmarkMatched || secondary.datasetOrBenchmarkMatched,
    });
  }

  return [...byKey.values()];
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
      ...(item.rankingReasons ?? []).slice(0, 2),
      item.venuePreferenceMatched ? "Preferred venue match." : "",
      item.datasetOrBenchmarkMatched ? "Dataset/benchmark match." : "",
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

  constructor(
    private readonly workspaceDir: string,
    options: ResearchDiscoveryServiceOptions = {},
  ) {
    this.storePath = discoveryStorePath(workspaceDir);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.searchProvider = options.searchProvider ?? new CrossrefPaperSearchProvider(env.CROSSREF_MAILTO);
    this.pushDigest = options.pushDigest;
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
                bonus > 0 ? `Profile bonus: +${bonus}.` : "",
              ]),
            };
          });
          perProfilePapers = [...perProfilePapers, ...ranked];
        } catch (error) {
          warnings.push(
            `Discovery search failed for ${profile.label} / ${queryCandidate.query}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      perProfilePapers.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
      rankedCandidates.push(...perProfilePapers.slice(0, topK * 2));
    }

    const merged = mergeDiscoveryItems(rankedCandidates)
      .sort((left, right) => {
        const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title);
      })
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
