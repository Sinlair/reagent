import type {
  MemoryConfidence,
  MemoryRecallHit,
  MemoryRecallOptions,
  MemoryRecallResult,
  MemorySourceType
} from "../types/memory.js";
import type { ResearchReportSummary } from "../types/research.js";
import type { ResearchService } from "./researchService.js";
import { MemoryIndexService } from "./memoryIndexService.js";
import { ResearchDirectionReportService } from "./researchDirectionReportService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchPresentationService } from "./researchPresentationService.js";

type ResearchRecallArtifactSource = Partial<Pick<ResearchService, "listRecentReports" | "getReport">>;

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueTrimmed(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function tokenize(text: string): string[] {
  const latinTokens = text.toLowerCase().match(/[a-z0-9]{2,}/gu) ?? [];
  const cjkTokens = [...new Set(text.match(/[\p{Script=Han}]{2}/gu) ?? [])];
  return [...new Set([...latinTokens, ...cjkTokens])];
}

function scoreText(query: string, haystack: string, title: string, tags: string[]): number {
  const queryLower = query.trim().toLowerCase();
  const haystackLower = haystack.toLowerCase();
  const titleLower = title.toLowerCase();
  const queryTerms = tokenize(query);

  let score = haystackLower.includes(queryLower) ? 5 : 0;
  let overlap = 0;
  for (const term of queryTerms) {
    if (haystackLower.includes(term)) {
      overlap += 1;
      score += 1.5;
    }
    if (titleLower.includes(term)) {
      score += 1.25;
    }
    if (tags.some((tag) => tag.toLowerCase().includes(term))) {
      score += 0.75;
    }
  }

  return overlap > 0 || score > 0 ? Math.round(score * 100) / 100 : 0;
}

function buildArtifactHit(input: {
  id: string;
  title: string;
  snippet: string;
  haystack: string;
  tags?: string[] | undefined;
  confidence: MemoryConfidence;
  sourceType: MemorySourceType;
  provenance: string;
  artifactType: string;
  sourceId?: string | undefined;
  updatedAt?: string | undefined;
  createdAt?: string | undefined;
  query: string;
}): MemoryRecallHit | null {
  const tags = uniqueTrimmed(input.tags);
  const score = scoreText(input.query, input.haystack, input.title, tags);
  if (score <= 0) {
    return null;
  }

  return {
    id: input.id,
    layer: "artifact",
    title: input.title,
    snippet: input.snippet,
    score,
    confidence: input.confidence,
    sourceType: input.sourceType,
    provenance: input.provenance,
    tags,
    entityIds: [],
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    artifactType: input.artifactType
  };
}

function canListRecentReports(
  researchService: ResearchRecallArtifactSource | undefined,
): researchService is Pick<ResearchService, "listRecentReports" | "getReport"> {
  return (
    typeof researchService?.listRecentReports === "function" &&
    typeof researchService.getReport === "function"
  );
}

export class MemoryRecallService {
  private readonly memoryIndexService: MemoryIndexService;
  private readonly directionService: ResearchDirectionService;
  private readonly directionReportService: ResearchDirectionReportService;
  private readonly presentationService: ResearchPresentationService | null;

  constructor(
    private readonly workspaceDir: string,
    private readonly researchService?: ResearchRecallArtifactSource | undefined
  ) {
    this.memoryIndexService = new MemoryIndexService(workspaceDir);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.directionReportService = new ResearchDirectionReportService(workspaceDir);
    this.presentationService = canListRecentReports(researchService)
      ? new ResearchPresentationService(workspaceDir, researchService)
      : null;
  }

  async recall(query: string, options: MemoryRecallOptions = {}): Promise<MemoryRecallResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        query,
        generatedAt: nowIso(),
        hits: []
      };
    }

    const limit = Math.max(1, Math.min(options.limit ?? 6, 12));
    const includeWorkspace = options.includeWorkspace ?? true;
    const includeArtifacts = options.includeArtifacts ?? true;

    const [workspaceHits, artifactHits] = await Promise.all([
      includeWorkspace ? this.memoryIndexService.search(trimmed, limit) : Promise.resolve([]),
      includeArtifacts ? this.searchArtifacts(trimmed, limit) : Promise.resolve([]),
    ]);

    const hits: MemoryRecallHit[] = [
      ...workspaceHits.map(({ entry, score }) => ({
        id: entry.id,
        layer: "workspace" as const,
        title: entry.title,
        snippet: entry.snippet,
        score: score + 0.6,
        confidence: entry.confidence,
        sourceType: entry.sourceType,
        provenance: entry.source ? `${entry.sourceType}:${entry.source}` : `${entry.sourceType}:${entry.path}`,
        tags: entry.tags,
        entityIds: entry.entityIds,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        ...(entry.sourceId ? { sourceId: entry.sourceId } : {}),
        path: entry.path,
        kind: entry.kind
      })),
      ...artifactHits
    ];

    const deduped = new Map<string, MemoryRecallHit>();
    for (const hit of hits) {
      const key = `${hit.layer}:${hit.sourceId ?? hit.path ?? hit.id}:${hit.title.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || hit.score > existing.score) {
        deduped.set(key, hit);
      }
    }

    return {
      query: trimmed,
      generatedAt: nowIso(),
      hits: [...deduped.values()]
        .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
        .slice(0, limit)
    };
  }

  private async searchArtifacts(query: string, limit: number): Promise<MemoryRecallHit[]> {
    const [directions, reports, researchSummaries, presentations] = await Promise.all([
      this.directionService.listProfiles(),
      this.directionReportService.listRecent(Math.max(limit * 2, 8)),
      canListRecentReports(this.researchService)
        ? this.researchService.listRecentReports(Math.max(limit * 2, 8))
        : Promise.resolve([] as ResearchReportSummary[]),
      this.presentationService ? this.presentationService.listRecent(Math.max(limit * 2, 6)) : Promise.resolve([])
    ]);

    const hits: MemoryRecallHit[] = [];

    for (const direction of directions) {
      const haystack = [
        direction.label,
        direction.summary ?? "",
        direction.tlDr ?? "",
        direction.abstract ?? "",
        direction.background ?? "",
        direction.targetProblem ?? "",
        ...direction.currentGoals,
        ...direction.openQuestions,
        ...direction.knownBaselines,
        ...direction.evaluationPriorities,
        ...direction.shortTermValidationTargets
      ].join("\n");

      const hit = buildArtifactHit({
        id: `brief:${direction.id}`,
        title: direction.label,
        snippet: direction.summary ?? direction.tlDr ?? direction.targetProblem ?? "Research brief",
        haystack,
        tags: [
          "research-brief",
          direction.priority,
          ...direction.knownBaselines.slice(0, 3),
          ...direction.evaluationPriorities.slice(0, 2)
        ],
        confidence: "high",
        sourceType: "tool-derived",
        provenance: `research-brief:${direction.id}`,
        artifactType: "research-brief",
        sourceId: direction.id,
        createdAt: direction.createdAt,
        updatedAt: direction.updatedAt,
        query
      });
      if (hit) {
        hits.push(hit);
      }
    }

    for (const report of reports) {
      const hit = buildArtifactHit({
        id: `direction-report:${report.id}`,
        title: report.topic,
        snippet: report.overview,
        haystack: [
          report.topic,
          report.overview,
          ...report.commonBaselines,
          ...report.commonModules,
          ...report.openProblems,
          ...report.suggestedRoutes,
          ...report.supportingSignals,
          ...report.representativePapers.map((paper) => `${paper.title} ${paper.reason}`)
        ].join("\n"),
        tags: ["direction-report", ...report.commonBaselines.slice(0, 3), ...report.commonModules.slice(0, 3)],
        confidence: "high",
        sourceType: "report-derived",
        provenance: `direction-report:${report.id}`,
        artifactType: "direction-report",
        sourceId: report.id,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        query
      });
      if (hit) {
        hits.push(hit);
      }
    }

    for (const report of researchSummaries) {
      const hit = buildArtifactHit({
        id: `research-report:${report.taskId}`,
        title: report.topic,
        snippet: report.summary,
        haystack: [report.topic, report.summary, report.question ?? "", report.critiqueVerdict].join("\n"),
        tags: ["research-report", report.critiqueVerdict],
        confidence: report.critiqueVerdict === "strong" ? "high" : report.critiqueVerdict === "moderate" ? "medium" : "low",
        sourceType: "report-derived",
        provenance: `research-report:${report.taskId}`,
        artifactType: "research-report",
        sourceId: report.taskId,
        createdAt: report.generatedAt,
        updatedAt: report.generatedAt,
        query
      });
      if (hit) {
        hits.push(hit);
      }
    }

    for (const presentation of presentations) {
      const hit = buildArtifactHit({
        id: `presentation:${presentation.id}`,
        title: presentation.title,
        snippet: presentation.slideMarkdown.split("\n").slice(0, 8).join(" "),
        haystack: [presentation.title, presentation.slideMarkdown, ...presentation.sourceReportTaskIds].join("\n"),
        tags: ["presentation", ...presentation.sourceReportTaskIds.slice(0, 3)],
        confidence: "medium",
        sourceType: "report-derived",
        provenance: `presentation:${presentation.id}`,
        artifactType: "presentation",
        sourceId: presentation.id,
        createdAt: presentation.generatedAt,
        updatedAt: presentation.generatedAt,
        query
      });
      if (hit) {
        hits.push(hit);
      }
    }

    return hits
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, limit);
  }
}
