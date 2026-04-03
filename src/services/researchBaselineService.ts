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
        return report.paper.title.toLowerCase().includes(direction.label.toLowerCase()) ||
          report.sourceUrl?.toLowerCase().includes(direction.label.toLowerCase()) || false;
      }
      return `${report.paper.title} ${report.problemStatement}`.toLowerCase().includes(topic.toLowerCase());
    });

    const recentRepoReports = await this.repoAnalysisService.listRecent(20);
    const reusableModules = unique(
      recentRepoReports.flatMap((report) => report.keyPaths).slice(0, 12)
    );

    const baselines = unique([
      ...relevantRunTitles,
      ...relevantPaperReports.flatMap((report) => report.likelyBaselines),
    ]).slice(0, 8).map((title) => ({
      title,
      reason: direction
        ? `Appeared in recent discovery or paper analysis for ${direction.label}.`
        : `Appeared in recent discovery or paper analysis for ${topic}.`,
    }));

    const innovationSuggestions = unique([
      ...(direction?.openQuestions ?? []).map((question) => `Investigate: ${question}`),
      ...(direction?.currentGoals ?? []).map((goal) => `Prioritize: ${goal}`),
      ...relevantPaperReports.flatMap((report) => report.innovationPoints.map((point) => `Paper cue: ${point}`)),
      ...reusableModules.slice(0, 4).map((modulePath) => `Check whether module "${modulePath}" can be adapted for ${topic}.`),
    ]).slice(0, 10);

    const supportingSignals = unique([
      ...recentDiscoveryRuns.flatMap((run) => run.directionLabels),
      ...recentPaperReports.flatMap((report) => report.paper.venue ? [report.paper.venue] : []),
      ...recentRepoReports.flatMap((report) => report.stars != null ? [`${report.owner}/${report.repo} stars=${report.stars}`] : [`${report.owner}/${report.repo}`]),
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
