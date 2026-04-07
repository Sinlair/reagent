import type { MemoryServiceOptions } from "./memory.js";
import type { ResearchDirectionReport } from "./researchDirectionReport.js";
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

  constructor(workspaceDir: string, options: MemoryServiceOptions = {}) {
    this.memoryService = new MemoryService(workspaceDir, options);
  }

  async flushDirectionReport(report: ResearchDirectionReport): Promise<void> {
    await this.memoryService.remember({
      scope: "daily",
      title: `Direction report: ${report.topic}`,
      content: buildDirectionReportMemoryContent(report),
      source: "direction-report:auto-flush",
    });
  }
}
