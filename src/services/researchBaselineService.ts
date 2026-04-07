import { randomUUID } from "node:crypto";

import type { BaselineSuggestionReport } from "../types/researchAnalysis.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchDiscoveryService } from "./researchDiscoveryService.js";
import { ResearchPaperAnalysisService } from "./researchPaperAnalysisService.js";
import { ResearchRepoAnalysisService } from "./researchRepoAnalysisService.js";

function nowIso(): string {
  return new Date().toISOString();
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

export class ResearchBaselineService {
  private readonly directionService: ResearchDirectionService;
  private readonly discoveryService: ResearchDiscoveryService;
  private readonly paperAnalysisService: ResearchPaperAnalysisService;
  private readonly repoAnalysisService: ResearchRepoAnalysisService;

  constructor(private readonly workspaceDir: string) {
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.discoveryService = new ResearchDiscoveryService(workspaceDir);
    this.paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
    this.repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
  }

  async suggest(input: { directionId?: string | undefined; topic?: string | undefined }): Promise<BaselineSuggestionReport> {
    const direction = input.directionId?.trim()
      ? await this.directionService.getProfile(input.directionId.trim())
      : null;
    const topic = input.topic?.trim() || direction?.label || "Research direction";
    const directionSignals = direction ? collectDirectionSignals(direction) : [];

    const recentDiscoveryRuns = await this.discoveryService.listRecentRuns(20);
    const relevantRunTitles = recentDiscoveryRuns
      .filter((run) => {
        if (direction?.id) {
          return run.directionIds.includes(direction.id);
        }
        return `${run.directionLabels.join(" ")} ${run.topTitle ?? ""}`.toLowerCase().includes(topic.toLowerCase());
      })
      .map((run) => run.topTitle)
      .filter((title): title is string => Boolean(title));

    const recentPaperReports = await this.paperAnalysisService.listRecent(20);
    const relevantPaperReports = recentPaperReports.filter((report) => {
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
      return `${report.paper.title} ${report.problemStatement}`.toLowerCase().includes(topic.toLowerCase());
    });

    const recentRepoReports = await this.repoAnalysisService.listRecent(20);
    const relevantRepoReports = recentRepoReports.filter((report) => {
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

      return `${report.owner}/${report.repo} ${report.description ?? ""}`.toLowerCase().includes(topic.toLowerCase());
    });
    const reusableModules = unique(
      relevantRepoReports.flatMap((report) => report.keyPaths).slice(0, 12)
    );

    const baselineTitles = unique([
      ...(direction?.knownBaselines ?? []),
      ...relevantRunTitles,
      ...relevantPaperReports.flatMap((report) => report.likelyBaselines),
    ]).slice(0, 8);
    const baselines = baselineTitles.map((title) => {
      const sourceReport = relevantPaperReports.find((report) => report.likelyBaselines.includes(title));
      if (direction?.knownBaselines.includes(title)) {
        return {
          title,
          reason: `Recorded in the research brief for ${direction.label}.`,
        };
      }

      return {
        title,
        reason: direction
          ? `Appeared in recent discovery or paper analysis for ${direction.label}.`
          : `Appeared in recent discovery or paper analysis for ${topic}.`,
        ...(sourceReport?.paper.url ? { sourceUrl: sourceReport.paper.url } : {}),
      };
    });

    const innovationSuggestions = unique([
      direction?.targetProblem ? `Solve: ${direction.targetProblem}` : "",
      ...(direction?.successCriteria ?? []).map((criterion) => `Validate against: ${criterion}`),
      ...(direction?.evaluationPriorities ?? []).map((priority) => `Measure: ${priority}`),
      ...(direction?.shortTermValidationTargets ?? []).map((target) => `Short-term validation: ${target}`),
      ...(direction?.openQuestions ?? []).map((question) => `Investigate: ${question}`),
      ...(direction?.currentGoals ?? []).map((goal) => `Prioritize: ${goal}`),
      ...relevantPaperReports.flatMap((report) => report.innovationPoints.map((point) => `Paper cue: ${point}`)),
      ...reusableModules.slice(0, 4).map((modulePath) => `Check whether module "${modulePath}" can be adapted for ${topic}.`),
    ]).slice(0, 10);

    const supportingSignals = unique([
      ...(direction?.targetProblem ? [`Target problem: ${direction.targetProblem}`] : []),
      ...(direction?.successCriteria ?? []).slice(0, 2).map((criterion) => `Success: ${criterion}`),
      ...(direction?.evaluationPriorities ?? []).slice(0, 2).map((priority) => `Metric: ${priority}`),
      ...recentDiscoveryRuns.flatMap((run) => run.directionLabels),
      ...recentPaperReports.flatMap((report) => report.paper.venue ? [report.paper.venue] : []),
      ...relevantRepoReports.flatMap((report) => report.stars != null ? [`${report.owner}/${report.repo} stars=${report.stars}`] : [`${report.owner}/${report.repo}`]),
    ]).slice(0, 12);

    return {
      id: randomUUID(),
      ...(direction?.id ? { directionId: direction.id } : {}),
      topic,
      baselines,
      reusableModules,
      innovationSuggestions,
      supportingSignals,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
}
