import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchDirectionReport, ResearchDirectionReportStore } from "../types/researchDirectionReport.js";
import { ResearchBaselineService } from "./researchBaselineService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchDiscoveryService } from "./researchDiscoveryService.js";
import { ResearchMemoryFlushService } from "./researchMemoryFlushService.js";
import { ResearchPaperAnalysisService } from "./researchPaperAnalysisService.js";
import { ResearchRepoAnalysisService } from "./researchRepoAnalysisService.js";

const STORE_FILE = "research/direction-reports.json";
const MAX_REPORTS = 80;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchDirectionReportStore {
  return {
    updatedAt: nowIso(),
    reports: [],
  };
}

function unique(values: string[]): string[] {
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
  return unique(
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

function collectDirectionSignals(direction: NonNullable<Awaited<ReturnType<ResearchDirectionService["getProfile"]>>>): string[] {
  return unique([
    direction.label,
    direction.summary ?? "",
    direction.tlDr ?? "",
    direction.targetProblem ?? "",
    ...direction.subDirections,
    ...direction.currentGoals,
    ...direction.openQuestions,
    ...direction.knownBaselines,
    ...direction.evaluationPriorities,
    ...direction.shortTermValidationTargets,
  ]);
}

function buildOverview(input: {
  topic: string;
  summary?: string | undefined;
  targetProblem?: string | undefined;
  successCriteria: string[];
  evaluationPriorities: string[];
  blockedDirections: string[];
  representativeCount: number;
  baselineCount: number;
  moduleCount: number;
  signalCount: number;
}): string {
  const sentences = [
    input.summary?.trim() || `${input.topic} is the active synthesis topic for this report.`,
    ...(input.targetProblem?.trim() ? [`Target problem: ${input.targetProblem.trim()}`] : []),
    ...(input.successCriteria.length > 0
      ? [`Success criteria: ${input.successCriteria.slice(0, 2).join("; ")}`]
      : []),
    ...(input.evaluationPriorities.length > 0
      ? [`Evaluation priorities: ${input.evaluationPriorities.slice(0, 2).join(", ")}`]
      : []),
    ...(input.blockedDirections.length > 0
      ? [`Avoid drifting into: ${input.blockedDirections.slice(0, 2).join(", ")}`]
      : []),
    input.representativeCount > 0
      ? `Collected ${input.representativeCount} representative paper signal(s).`
      : "No strong representative paper signal was found yet.",
    input.baselineCount > 0
      ? `Identified ${input.baselineCount} baseline candidate(s).`
      : "Baseline evidence is still sparse.",
    input.moduleCount > 0
      ? `Observed ${input.moduleCount} reusable module pattern(s).`
      : "Reusable module patterns are still limited.",
    input.signalCount > 0
      ? `Supporting evidence was aggregated from ${input.signalCount} recent signal(s).`
      : "Supporting signals remain limited and should be expanded.",
  ];

  return sentences.join(" ");
}

export class ResearchDirectionReportService {
  private readonly storePath: string;
  private readonly directionService: ResearchDirectionService;
  private readonly discoveryService: ResearchDiscoveryService;
  private readonly paperAnalysisService: ResearchPaperAnalysisService;
  private readonly repoAnalysisService: ResearchRepoAnalysisService;
  private readonly baselineService: ResearchBaselineService;
  private readonly memoryFlushService: ResearchMemoryFlushService;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.discoveryService = new ResearchDiscoveryService(workspaceDir);
    this.paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
    this.repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
    this.baselineService = new ResearchBaselineService(workspaceDir);
    this.memoryFlushService = new ResearchMemoryFlushService(workspaceDir);
  }

  private async readStore(): Promise<ResearchDirectionReportStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchDirectionReportStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchDirectionReportStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 20): Promise<ResearchDirectionReport[]> {
    const store = await this.readStore();
    return store.reports.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getReport(reportId: string): Promise<ResearchDirectionReport | null> {
    const id = reportId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.reports.find((report) => report.id === id) ?? null;
  }

  async generate(input: {
    directionId?: string | undefined;
    topic?: string | undefined;
    days?: number | undefined;
  }): Promise<ResearchDirectionReport> {
    const direction = input.directionId?.trim()
      ? await this.directionService.getProfile(input.directionId.trim())
      : null;
    const topic = input.topic?.trim() || direction?.label || "Research direction";
    const days = Math.max(1, Math.min(input.days ?? 14, 30));
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const directionSignals = direction ? collectDirectionSignals(direction) : [];

    const baseline = await this.baselineService.suggest({
      ...(direction?.id ? { directionId: direction.id } : {}),
      ...(input.topic?.trim() ? { topic: input.topic.trim() } : {}),
    });

    const paperReports = (await this.paperAnalysisService.listRecent(40)).filter((report) => {
      const createdAtMs = Date.parse(report.updatedAt);
      if (Number.isFinite(createdAtMs) && createdAtMs < cutoffMs) {
        return false;
      }

      if (direction?.id) {
        return matchesResearchSignal(
          [
            report.paper.title,
            report.problemStatement,
            report.coreMethod,
            report.paper.venue ?? "",
            ...report.innovationPoints,
            ...report.likelyBaselines,
          ].join(" "),
          directionSignals,
        );
      }

      return `${report.paper.title} ${report.problemStatement} ${report.coreMethod}`
        .toLowerCase()
        .includes(topic.toLowerCase());
    });

    const representativePapers = unique(
      paperReports.flatMap((report) => report.paper.title ? [report.paper.title] : [])
    )
      .slice(0, 6)
      .map((title) => {
        const report = paperReports.find((entry) => entry.paper.title === title);
        return {
          title,
          reason: report?.recommendation ?? "Recent paper analysis signal.",
          ...(report?.paper.url ? { sourceUrl: report.paper.url } : {}),
        };
      });

    const discoveryRuns = await this.discoveryService.listRecentRuns(20);
    const repoReports = (await this.repoAnalysisService.listRecent(30)).filter((report) => {
      const createdAtMs = Date.parse(report.updatedAt);
      if (Number.isFinite(createdAtMs) && createdAtMs < cutoffMs) {
        return false;
      }

      if (direction?.id) {
        return matchesResearchSignal(
          [
            `${report.owner}/${report.repo}`,
            report.description ?? "",
            ...report.keyPaths,
            ...report.notes,
          ].join(" "),
          directionSignals,
        );
      }

      return `${report.owner}/${report.repo} ${report.description ?? ""}`
        .toLowerCase()
        .includes(topic.toLowerCase());
    });

    const commonModules = unique([
      ...baseline.reusableModules,
      ...repoReports.flatMap((report) => report.keyPaths),
    ]).slice(0, 10);

    const openProblems = unique([
      ...(direction?.openQuestions ?? []),
      ...(direction?.successCriteria ?? []).map((criterion) => `Need evidence for: ${criterion}`),
      ...paperReports
        .flatMap((report) => report.conclusions)
        .filter((conclusion) => conclusion.missingEvidence)
        .map((conclusion) => conclusion.missingEvidence ?? ""),
    ]).slice(0, 8);

    const supportingSignals = unique([
      ...baseline.supportingSignals,
      ...discoveryRuns.flatMap((run) => run.directionLabels),
      ...representativePapers.map((paper) => paper.title),
    ]).slice(0, 12);

    const report: ResearchDirectionReport = {
      id: randomUUID(),
      ...(direction?.id ? { directionId: direction.id } : {}),
      topic,
      overview: buildOverview({
        topic,
        summary: direction?.summary ?? direction?.tlDr,
        targetProblem: direction?.targetProblem,
        successCriteria: direction?.successCriteria ?? [],
        evaluationPriorities: direction?.evaluationPriorities ?? [],
        blockedDirections: direction?.blockedDirections ?? [],
        representativeCount: representativePapers.length,
        baselineCount: baseline.baselines.length,
        moduleCount: commonModules.length,
        signalCount: supportingSignals.length,
      }),
      representativePapers,
      commonBaselines: baseline.baselines.map((item) => item.title),
      commonModules,
      openProblems,
      suggestedRoutes: unique([
        ...baseline.innovationSuggestions,
        ...(direction?.successCriteria ?? []).map((criterion) => `Validate against: ${criterion}`),
        ...(direction?.evaluationPriorities ?? []).map((priority) => `Optimize for: ${priority}`),
        ...(direction?.knownBaselines ?? []).map((baselineTitle) => `Compare against baseline: ${baselineTitle}`),
        ...(direction?.shortTermValidationTargets ?? []).map((target) => `Short-term validation: ${target}`),
      ]).slice(0, 10),
      supportingSignals: unique([
        ...supportingSignals,
        ...(direction?.targetProblem ? [`Target problem: ${direction.targetProblem}`] : []),
        ...(direction?.evaluationPriorities ?? []).slice(0, 2).map((priority) => `Metric: ${priority}`),
      ]).slice(0, 12),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      reports: [report, ...store.reports].slice(0, MAX_REPORTS),
    });

    await this.memoryFlushService.flushDirectionReport(report).catch(() => {});

    return report;
  }
}
