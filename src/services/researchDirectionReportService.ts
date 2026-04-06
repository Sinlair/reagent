import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchDirectionReport, ResearchDirectionReportStore } from "../types/researchDirectionReport.js";
import { ResearchBaselineService } from "./researchBaselineService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchDiscoveryService } from "./researchDiscoveryService.js";
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

function buildOverview(input: {
  topic: string;
  summary?: string | undefined;
  representativeCount: number;
  baselineCount: number;
  moduleCount: number;
  signalCount: number;
}): string {
  const sentences = [
    input.summary?.trim() || `${input.topic} is the active synthesis topic for this report.`,
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

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.discoveryService = new ResearchDiscoveryService(workspaceDir);
    this.paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
    this.repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
    this.baselineService = new ResearchBaselineService(workspaceDir);
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
        return (
          report.paper.title.toLowerCase().includes(direction.label.toLowerCase()) ||
          report.problemStatement.toLowerCase().includes(direction.label.toLowerCase()) ||
          report.sourceUrl?.toLowerCase().includes(direction.label.toLowerCase()) ||
          false
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
        return `${report.owner}/${report.repo} ${report.description ?? ""}`
          .toLowerCase()
          .includes(direction.label.toLowerCase());
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
        summary: direction?.summary,
        representativeCount: representativePapers.length,
        baselineCount: baseline.baselines.length,
        moduleCount: commonModules.length,
        signalCount: supportingSignals.length,
      }),
      representativePapers,
      commonBaselines: baseline.baselines.map((item) => item.title),
      commonModules,
      openProblems,
      suggestedRoutes: baseline.innovationSuggestions.slice(0, 10),
      supportingSignals,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      reports: [report, ...store.reports].slice(0, MAX_REPORTS),
    });

    return report;
  }
}
