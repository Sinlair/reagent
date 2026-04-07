import type { ResearchReport } from "../types/research.js";
import type { ResearchDirectionReport } from "../types/researchDirectionReport.js";
import { MemoryService } from "./memoryService.js";

function trimLine(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function bulletSection(title: string, values: string[] | undefined, limit = 5): string[] {
  const items = (values ?? []).map((value) => value.trim()).filter(Boolean).slice(0, limit);
  if (items.length === 0) {
    return [];
  }

  return [title, ...items.map((value) => `- ${value}`), ""];
}

function textSection(title: string, value: string | undefined): string[] {
  const trimmed = trimLine(value);
  if (!trimmed) {
    return [];
  }

  return [title, trimmed, ""];
}

function buildResearchReportMemoryContent(report: ResearchReport): string {
  const lines = [
    "Research task completed.",
    "",
    `Task ID: ${report.taskId}`,
    `Topic: ${report.topic}`,
    ...(trimLine(report.question) ? [`Question: ${report.question!.trim()}`] : []),
    `Generated At: ${report.generatedAt}`,
    "",
    ...textSection("Summary", report.summary),
    ...textSection("Critique", `${report.critique.verdict}: ${report.critique.summary}`),
    ...bulletSection("Findings", report.findings),
    ...bulletSection("Gaps", report.gaps),
    ...bulletSection("Next Actions", report.nextActions),
    ...bulletSection("Search Queries", report.plan?.searchQueries),
  ];

  return `${lines.join("\n").trim()}\n`;
}

function buildDirectionReportMemoryContent(report: ResearchDirectionReport): string {
  const lines = [
    "Direction report generated.",
    "",
    `Report ID: ${report.id}`,
    `Topic: ${report.topic}`,
    ...(trimLine(report.directionId) ? [`Direction ID: ${report.directionId!.trim()}`] : []),
    `Generated At: ${report.createdAt}`,
    "",
    ...textSection("Overview", report.overview),
    ...bulletSection(
      "Representative Papers",
      report.representativePapers.map((paper) => `${paper.title}: ${paper.reason}`),
    ),
    ...bulletSection("Common Baselines", report.commonBaselines),
    ...bulletSection("Common Modules", report.commonModules),
    ...bulletSection("Open Problems", report.openProblems),
    ...bulletSection("Suggested Routes", report.suggestedRoutes),
    ...bulletSection("Supporting Signals", report.supportingSignals),
  ];

  return `${lines.join("\n").trim()}\n`;
}

export class ResearchMemoryFlushService {
  private readonly memoryService: MemoryService;

  constructor(workspaceDir: string) {
    this.memoryService = new MemoryService(workspaceDir);
  }

  async flushResearchReport(report: ResearchReport): Promise<void> {
    await this.memoryService.remember({
      scope: "daily",
      title: `Research report: ${report.topic}`,
      content: buildResearchReportMemoryContent(report),
      source: "research-task:auto-flush",
      sourceId: report.taskId,
      sourceType: "report-derived",
      confidence:
        report.critique.verdict === "strong"
          ? "high"
          : report.critique.verdict === "moderate"
            ? "medium"
            : "low",
      tags: ["research-report", report.topic, report.critique.verdict],
    });
  }

  async flushDirectionReport(report: ResearchDirectionReport): Promise<void> {
    await this.memoryService.remember({
      scope: "daily",
      title: `Direction report: ${report.topic}`,
      content: buildDirectionReportMemoryContent(report),
      source: "direction-report:auto-flush",
      sourceId: report.id,
      sourceType: "report-derived",
      confidence: "high",
      tags: [
        "direction-report",
        report.topic,
        ...report.commonBaselines.slice(0, 3),
        ...report.commonModules.slice(0, 3),
      ],
      entityIds: report.directionId ? [report.directionId] : [],
    });
  }
}
