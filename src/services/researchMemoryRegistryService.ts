import path from "node:path";

import { buildResearchService, type ResearchService } from "./researchService.js";
import { ResearchBaselineService } from "./researchBaselineService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchDiscoveryService } from "./researchDiscoveryService.js";
import { ResearchLinkIngestionService } from "./researchLinkIngestionService.js";
import { ResearchModuleAssetService } from "./researchModuleAssetService.js";
import { ResearchPaperAnalysisService } from "./researchPaperAnalysisService.js";
import { ResearchPresentationService } from "./researchPresentationService.js";
import { ResearchRepoAnalysisService } from "./researchRepoAnalysisService.js";
import type {
  ResearchMemoryEdge,
  ResearchMemoryGraph,
  ResearchMemoryGraphQuery,
  ResearchMemoryNode,
  ResearchMemoryNodeDetail,
  ResearchMemoryNodeLink,
  ResearchMemoryNodeType,
  ResearchMemoryGraphView,
} from "../types/researchMemoryGraph.js";

interface CanonicalPaperRecord {
  id: string;
  key: string;
  label: string;
  externalUrl?: string | undefined;
  occurredAt?: string | undefined;
  tags: Set<string>;
  sourceItemIds: Set<string>;
  discoveryRunIds: Set<string>;
  workflowReportIds: Set<string>;
  paperReportIds: Set<string>;
  repoKeys: Set<string>;
}

interface CanonicalRepoRecord {
  id: string;
  key: string;
  label: string;
  externalUrl: string;
  occurredAt?: string | undefined;
  tags: Set<string>;
  sourceItemIds: Set<string>;
  paperKeys: Set<string>;
  paperReportIds: Set<string>;
  repoReportIds: Set<string>;
  moduleAssetIds: Set<string>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildEdge(
  source: string,
  target: string,
  label: string,
  extra: Partial<Omit<ResearchMemoryEdge, "id" | "source" | "target" | "label">> = {},
): ResearchMemoryEdge {
  return {
    id: `${source}::${label}::${target}`,
    source,
    target,
    label,
    ...extra,
  };
}

function buildPaperPairKey(source: string, target: string): string {
  return [source, target].sort((left, right) => left.localeCompare(right)).join("::");
}

function describePaperRelation(node: ResearchMemoryNode): { kind: string; label: string } | null {
  switch (node.type) {
    case "discovery_run":
      return { kind: "shared_discovery_run", label: "Discovered together" };
    case "source_item":
      return { kind: "shared_source_item", label: "Mentioned in the same source" };
    case "repo":
      return { kind: "shared_repo", label: "Share the same code repository" };
    case "workflow_report":
      return { kind: "shared_workflow_report", label: "Used in the same report" };
    default:
      return null;
  }
}

function countByType(nodes: ResearchMemoryNode[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const node of nodes) {
    result[node.type] = (result[node.type] ?? 0) + 1;
  }
  return result;
}

function uniqueBy<T>(items: T[], keySelector: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keySelector(item).trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function slugify(value: string, maxLength = 96): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, maxLength) || "item";
}

function extractArxivId(value?: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/arxiv\.org\/(?:abs|pdf)\/([^/?#]+?)(?:\.pdf)?$/iu);
  if (match?.[1]) {
    return match[1];
  }

  return /^\d{4}\.\d{4,5}(?:v\d+)?$/u.test(trimmed) ? trimmed : undefined;
}

function canonicalPaperKey(input: {
  doi?: string | undefined;
  arxivId?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
}): string | null {
  const arxivId = extractArxivId(input.arxivId) ?? extractArxivId(input.url);
  if (arxivId) {
    return `arxiv:${arxivId.toLowerCase()}`;
  }

  const doi = input.doi?.trim().toLowerCase();
  if (doi) {
    const doiLooksLikeArxiv = extractArxivId(doi);
    if (doiLooksLikeArxiv) {
      return `arxiv:${doiLooksLikeArxiv.toLowerCase()}`;
    }
    return `doi:${doi}`;
  }

  const normalizedUrl = input.url?.trim().toLowerCase();
  if (normalizedUrl) {
    return `url:${normalizedUrl}`;
  }

  const title = input.title?.trim().toLowerCase();
  if (title) {
    return `title:${title.replace(/\s+/gu, " ")}`;
  }

  return null;
}

function canonicalPaperId(key: string): string {
  return `paper:${slugify(key, 120)}`;
}

function normalizeRepoUrl(url?: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/iu);
  if (!match?.[1] || !match?.[2]) {
    return trimmed.toLowerCase();
  }

  return `https://github.com/${match[1].toLowerCase()}/${match[2].replace(/\.git$/iu, "").toLowerCase()}`;
}

function canonicalRepoKey(url?: string | undefined): string | null {
  const normalized = normalizeRepoUrl(url);
  return normalized ? `repo:${normalized}` : null;
}

function canonicalRepoId(key: string): string {
  return `repo:${slugify(key, 120)}`;
}

function parseNodeId(nodeId: string): { type: ResearchMemoryNodeType | "discovery" | "source" | "workflow" | "module"; entityId: string } | null {
  const trimmed = nodeId.trim();
  if (!trimmed || !trimmed.includes(":")) {
    return null;
  }

  const [type, ...rest] = trimmed.split(":");
  const entityId = rest.join(":").trim();
  if (!type || !entityId) {
    return null;
  }

  if (
    type === "direction" ||
    type === "discovery" ||
    type === "source" ||
    type === "workflow" ||
    type === "paper" ||
    type === "paper-report" ||
    type === "repo" ||
    type === "repo-report" ||
    type === "module" ||
    type === "presentation"
  ) {
    return {
      type:
        type === "paper-report"
          ? "paper_report"
          : type === "repo-report"
            ? "repo_report"
            : (type as ResearchMemoryNodeType | "discovery" | "source" | "workflow" | "module"),
      entityId,
    };
  }

  return null;
}

function normalizeQueryTokens(value?: string | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeWorkspaceRelativePath(workspaceDir: string, candidate?: string | undefined): string | undefined {
  if (!candidate?.trim()) {
    return undefined;
  }

  const resolved = path.resolve(candidate);
  const relative = path.relative(workspaceDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }

  return relative.replace(/\\/gu, "/");
}

function parseDateBoundary(value: string | undefined, mode: "start" | "end"): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    const base = new Date(`${trimmed}T00:00:00.000`);
    const baseMs = base.getTime();
    if (!Number.isFinite(baseMs)) {
      return null;
    }
    return mode === "start" ? baseMs : baseMs + 24 * 60 * 60 * 1000 - 1;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function getNodeTimestampMs(node: ResearchMemoryNode): number | null {
  if (!node.occurredAt) {
    return null;
  }

  const parsed = Date.parse(node.occurredAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildNodeSearchHaystack(node: ResearchMemoryNode): string {
  return [
    node.label,
    node.subtitle ?? "",
    node.tags.join(" "),
    node.externalUrl ?? "",
    node.artifactPath ?? "",
    ...Object.values(node.meta).map((value) => String(value ?? "")),
  ]
    .join(" ")
    .toLowerCase();
}

function matchesTokens(haystack: string, tokens: string[]): boolean {
  return tokens.every((token) => haystack.includes(token));
}

function chooseBetterLabel(current: string, candidate?: string | undefined): string {
  const next = candidate?.trim();
  if (!next) {
    return current;
  }
  if (!current.trim()) {
    return next;
  }
  if (/^paper\b|^repo\b/iu.test(current) && !/^paper\b|^repo\b/iu.test(next)) {
    return next;
  }
  return next.length > current.length ? next : current;
}

function chooseEarlierIso(current: string | undefined, candidate?: string | undefined): string | undefined {
  const next = candidate?.trim();
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }

  const currentMs = Date.parse(current);
  const nextMs = Date.parse(next);
  if (!Number.isFinite(currentMs) || !Number.isFinite(nextMs)) {
    return current;
  }

  return nextMs < currentMs ? next : current;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function buildDegreeByNodeId(graph: ResearchMemoryGraph): Map<string, number> {
  const degreeByNodeId = new Map<string, number>();
  for (const node of graph.nodes) {
    degreeByNodeId.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) ?? 0) + 1);
    degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) ?? 0) + 1);
  }
  return degreeByNodeId;
}

function compareInsightNodes(
  left: ResearchMemoryNode,
  right: ResearchMemoryNode,
  degreeByNodeId: Map<string, number>,
): number {
  const degreeDelta = (degreeByNodeId.get(right.id) ?? 0) - (degreeByNodeId.get(left.id) ?? 0);
  if (degreeDelta !== 0) {
    return degreeDelta;
  }

  const timeDelta = (Date.parse(right.occurredAt ?? "") || 0) - (Date.parse(left.occurredAt ?? "") || 0);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return left.label.localeCompare(right.label);
}

function compareInsightEdges(left: ResearchMemoryEdge, right: ResearchMemoryEdge): number {
  const weightDelta = (right.weight ?? 1) - (left.weight ?? 1);
  if (weightDelta !== 0) {
    return weightDelta;
  }

  const supportDelta = (right.supportingLabels?.length ?? 0) - (left.supportingLabels?.length ?? 0);
  if (supportDelta !== 0) {
    return supportDelta;
  }

  return left.label.localeCompare(right.label);
}

function buildAdjacency(
  graph: ResearchMemoryGraph,
): Map<string, Array<{ neighborId: string; edge: ResearchMemoryEdge }>> {
  const adjacency = new Map<string, Array<{ neighborId: string; edge: ResearchMemoryEdge }>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const sourceNeighbors = adjacency.get(edge.source) ?? [];
    sourceNeighbors.push({ neighborId: edge.target, edge });
    adjacency.set(edge.source, sourceNeighbors);

    const targetNeighbors = adjacency.get(edge.target) ?? [];
    targetNeighbors.push({ neighborId: edge.source, edge });
    adjacency.set(edge.target, targetNeighbors);
  }
  return adjacency;
}

function findShortestPath(
  graph: ResearchMemoryGraph,
  fromNodeId: string,
  toNodeId: string,
): { nodeIds: string[]; edges: ResearchMemoryEdge[] } | null {
  const fromId = fromNodeId.trim();
  const toId = toNodeId.trim();
  if (!fromId || !toId) {
    return null;
  }

  if (fromId === toId) {
    return {
      nodeIds: [fromId],
      edges: [],
    };
  }

  const adjacency = buildAdjacency(graph);
  if (!adjacency.has(fromId) || !adjacency.has(toId)) {
    return null;
  }

  const queue: string[] = [fromId];
  const parents = new Map<string, { previousId: string; edge: ResearchMemoryEdge }>();
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const neighbors = adjacency.get(currentId) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.neighborId)) {
        continue;
      }

      visited.add(neighbor.neighborId);
      parents.set(neighbor.neighborId, {
        previousId: currentId,
        edge: neighbor.edge,
      });

      if (neighbor.neighborId === toId) {
        queue.length = 0;
        break;
      }

      queue.push(neighbor.neighborId);
    }
  }

  if (!parents.has(toId)) {
    return null;
  }

  const nodeIds: string[] = [];
  const edges: ResearchMemoryEdge[] = [];
  let cursor = toId;

  while (cursor !== fromId) {
    nodeIds.push(cursor);
    const parent = parents.get(cursor);
    if (!parent) {
      return null;
    }
    edges.push(parent.edge);
    cursor = parent.previousId;
  }

  nodeIds.push(fromId);
  nodeIds.reverse();
  edges.reverse();

  return {
    nodeIds,
    edges,
  };
}

export class ResearchMemoryRegistryService {
  private readonly directionService: ResearchDirectionService;
  private readonly discoveryService: ResearchDiscoveryService;
  private readonly linkIngestionService: ResearchLinkIngestionService;
  private readonly paperAnalysisService: ResearchPaperAnalysisService;
  private readonly repoAnalysisService: ResearchRepoAnalysisService;
  private readonly moduleAssetService: ResearchModuleAssetService;
  private readonly baselineService: ResearchBaselineService;
  private readonly presentationService: ResearchPresentationService;
  private readonly researchService: Pick<ResearchService, "listRecentReports" | "getReport">;

  constructor(
    private readonly workspaceDir: string,
    researchService?: Pick<ResearchService, "listRecentReports" | "getReport">,
  ) {
    this.researchService = researchService ?? buildResearchService(workspaceDir);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.discoveryService = new ResearchDiscoveryService(workspaceDir);
    this.linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
    this.paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
    this.repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
    this.moduleAssetService = new ResearchModuleAssetService(workspaceDir);
    this.baselineService = new ResearchBaselineService(workspaceDir);
    this.presentationService = new ResearchPresentationService(workspaceDir, this.researchService);
  }

  private async resolveGraphForQuery(query: ResearchMemoryGraphQuery = {}): Promise<ResearchMemoryGraph> {
    const fullGraph = await this.buildFullGraph();
    const graph = query.view === "paper" ? this.buildPaperGraph(fullGraph) : fullGraph;
    if (
      !query.types?.length &&
      !query.search?.trim() &&
      !query.topic?.trim() &&
      !query.dateFrom?.trim() &&
      !query.dateTo?.trim()
    ) {
      return graph;
    }

    return this.filterGraph(graph, query);
  }

  private async buildFullGraph(): Promise<ResearchMemoryGraph> {
    const [
      directions,
      discoveryRuns,
      sourceItemsRaw,
      paperReportsRaw,
      repoReportsRaw,
      moduleAssetsRaw,
      presentationsRaw,
      workflowReportsRaw,
    ] = await Promise.all([
      this.directionService.listProfiles(),
      this.discoveryService.listRecentRuns(50),
      this.linkIngestionService.listRecent(100),
      this.paperAnalysisService.listRecent(100),
      this.repoAnalysisService.listRecent(100),
      this.moduleAssetService.listRecent(100),
      this.presentationService.listRecent(50),
      this.researchService.listRecentReports(50),
    ]);

    const sourceItems = uniqueBy(sourceItemsRaw, (item) => item.id);
    const paperReports = uniqueBy(paperReportsRaw, (report) => report.id);
    const repoReports = uniqueBy(repoReportsRaw, (report) => report.url);
    const moduleAssets = uniqueBy(moduleAssetsRaw, (asset) => asset.id);
    const presentations = uniqueBy(presentationsRaw, (item) => item.id);
    const workflowReports = uniqueBy(workflowReportsRaw, (report) => report.taskId);
    const workflowReportDetails = uniqueBy(
      (
        await Promise.all(workflowReports.map((report) => this.researchService.getReport(report.taskId)))
      ).filter((report): report is NonNullable<Awaited<ReturnType<ResearchService["getReport"]>>> => Boolean(report)),
      (report) => report.taskId,
    );
    const workflowReportByTaskId = new Map(
      workflowReportDetails.map((report) => [report.taskId, report]),
    );
    const discoveryRunDetails = uniqueBy(
      (
        await Promise.all(discoveryRuns.map((run) => this.discoveryService.getRun(run.runId)))
      ).filter((run): run is NonNullable<Awaited<ReturnType<ResearchDiscoveryService["getRun"]>>> => Boolean(run)),
      (run) => run.runId,
    );

    const nodes: ResearchMemoryNode[] = [];
    const edges: ResearchMemoryEdge[] = [];
    const paperRecords = new Map<string, CanonicalPaperRecord>();
    const repoRecords = new Map<string, CanonicalRepoRecord>();

    const ensurePaperRecord = (input: {
      doi?: string | undefined;
      arxivId?: string | undefined;
      url?: string | undefined;
      title?: string | undefined;
      occurredAt?: string | undefined;
      tags?: string[] | undefined;
    }): CanonicalPaperRecord | null => {
      const key = canonicalPaperKey(input);
      if (!key) {
        return null;
      }

      const existing = paperRecords.get(key);
      if (existing) {
        existing.label = chooseBetterLabel(existing.label, input.title);
        if (!existing.externalUrl && input.url?.trim()) {
          existing.externalUrl = input.url.trim();
        }
        existing.occurredAt = chooseEarlierIso(existing.occurredAt, input.occurredAt);
        for (const tag of input.tags ?? []) {
          if (tag?.trim()) {
            existing.tags.add(tag.trim());
          }
        }
        return existing;
      }

      const record: CanonicalPaperRecord = {
        id: canonicalPaperId(key),
        key,
        label: input.title?.trim() || input.url?.trim() || `paper ${slugify(key, 24)}`,
        ...(input.url?.trim() ? { externalUrl: input.url.trim() } : {}),
        ...(input.occurredAt?.trim() ? { occurredAt: input.occurredAt.trim() } : {}),
        tags: new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
        sourceItemIds: new Set<string>(),
        discoveryRunIds: new Set<string>(),
        workflowReportIds: new Set<string>(),
        paperReportIds: new Set<string>(),
        repoKeys: new Set<string>(),
      };
      paperRecords.set(key, record);
      return record;
    };

    const ensureRepoRecord = (input: {
      url?: string | undefined;
      label?: string | undefined;
      occurredAt?: string | undefined;
      tags?: string[] | undefined;
    }): CanonicalRepoRecord | null => {
      const key = canonicalRepoKey(input.url);
      const normalizedUrl = normalizeRepoUrl(input.url);
      if (!key || !normalizedUrl) {
        return null;
      }

      const existing = repoRecords.get(key);
      if (existing) {
        existing.label = chooseBetterLabel(existing.label, input.label);
        existing.occurredAt = chooseEarlierIso(existing.occurredAt, input.occurredAt);
        for (const tag of input.tags ?? []) {
          if (tag?.trim()) {
            existing.tags.add(tag.trim());
          }
        }
        return existing;
      }

      const fallbackLabel = normalizedUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)$/iu);
      const record: CanonicalRepoRecord = {
        id: canonicalRepoId(key),
        key,
        label:
          input.label?.trim() ||
          (fallbackLabel?.[1] && fallbackLabel?.[2] ? `${fallbackLabel[1]}/${fallbackLabel[2]}` : normalizedUrl),
        externalUrl: normalizedUrl,
        ...(input.occurredAt?.trim() ? { occurredAt: input.occurredAt.trim() } : {}),
        tags: new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
        sourceItemIds: new Set<string>(),
        paperKeys: new Set<string>(),
        paperReportIds: new Set<string>(),
        repoReportIds: new Set<string>(),
        moduleAssetIds: new Set<string>(),
      };
      repoRecords.set(key, record);
      return record;
    };

    for (const direction of directions) {
      nodes.push({
        id: `direction:${direction.id}`,
        type: "direction",
        label: direction.label,
        subtitle: direction.summary,
        tags: [...direction.subDirections, ...direction.preferredVenues],
        meta: {
          priority: direction.priority,
          enabled: direction.enabled,
          queryHintCount: direction.queryHints.length,
          updatedAt: direction.updatedAt,
        },
        occurredAt: direction.updatedAt,
      });
    }

    for (const run of discoveryRuns) {
      const runNodeId = `discovery:${run.runId}`;
      nodes.push({
        id: runNodeId,
        type: "discovery_run",
        label: run.directionLabels.join(" | ") || "Discovery run",
        subtitle: run.topTitle,
        tags: run.directionIds,
        meta: {
          itemCount: run.itemCount,
          pushed: run.pushed,
          generatedAt: run.generatedAt,
        },
        occurredAt: run.generatedAt,
      });
      for (const directionId of run.directionIds) {
        edges.push(buildEdge(`direction:${directionId}`, runNodeId, "discovered_by"));
      }
    }

    for (const item of sourceItems) {
      nodes.push({
        id: `source:${item.id}`,
        type: "source_item",
        label: item.title || item.url || item.id,
        subtitle: item.url,
        tags: [item.sourceType],
        meta: {
          papers: item.paperCandidates.length,
          repos: item.repoCandidates.length,
          images: item.imageUrls.length,
          updatedAt: item.updatedAt,
        },
        occurredAt: item.createdAt,
        ...(item.url ? { externalUrl: item.url } : {}),
      });

      for (const candidate of item.paperCandidates) {
        const paperRecord = ensurePaperRecord({
          doi: candidate.doi,
          arxivId: candidate.arxivId,
          url: candidate.url ?? candidate.pdfUrl,
          title: candidate.title ?? item.title,
          occurredAt: item.createdAt,
          tags: [
            candidate.arxivId ? "arxiv" : "",
            candidate.doi ? "doi" : "",
            candidate.confidence,
          ],
        });
        if (!paperRecord) {
          continue;
        }

        paperRecord.sourceItemIds.add(item.id);
        for (const repoCandidate of item.repoCandidates) {
          const repoRecord = ensureRepoRecord({
            url: repoCandidate.url,
            label:
              repoCandidate.owner && repoCandidate.repo
                ? `${repoCandidate.owner}/${repoCandidate.repo}`
                : undefined,
            occurredAt: item.createdAt,
          });
          if (repoRecord) {
            repoRecord.sourceItemIds.add(item.id);
            repoRecord.paperKeys.add(paperRecord.key);
            paperRecord.repoKeys.add(repoRecord.key);
          }
        }
      }

      for (const candidate of item.repoCandidates) {
        const repoRecord = ensureRepoRecord({
          url: candidate.url,
          label:
            candidate.owner && candidate.repo ? `${candidate.owner}/${candidate.repo}` : item.title,
          occurredAt: item.createdAt,
          tags: [candidate.confidence],
        });
        if (repoRecord) {
          repoRecord.sourceItemIds.add(item.id);
        }
      }
    }

    for (const run of discoveryRunDetails) {
      for (const item of run.items) {
        const paperRecord = ensurePaperRecord({
          doi: item.doi,
          url: item.url,
          title: item.title,
          occurredAt: run.generatedAt,
          tags: [item.venue ?? "", item.year ? String(item.year) : "", "discovery"],
        });
        if (paperRecord) {
          paperRecord.discoveryRunIds.add(run.runId);
        }
      }
    }

    for (const report of workflowReports) {
      const fullReport = workflowReportByTaskId.get(report.taskId);
      nodes.push({
        id: `workflow:${report.taskId}`,
        type: "workflow_report",
        label: report.topic,
        subtitle: report.summary,
        tags: [report.critiqueVerdict],
        meta: {
          generatedAt: report.generatedAt,
          paperCount: report.paperCount,
          evidenceCount: report.evidenceCount,
        },
        occurredAt: report.generatedAt,
      });

      for (const paper of fullReport?.papers ?? []) {
        const paperRecord = ensurePaperRecord({
          doi: paper.doi,
          url: paper.url ?? paper.pdfUrl,
          title: paper.title,
          occurredAt: report.generatedAt,
          tags: [
            paper.venue ?? "",
            paper.year ? String(paper.year) : "",
            report.topic,
            report.critiqueVerdict,
          ],
        });
        if (paperRecord) {
          paperRecord.workflowReportIds.add(report.taskId);
        }
      }
    }

    for (const report of paperReports) {
      const reportNodeId = `paper-report:${report.id}`;
      nodes.push({
        id: reportNodeId,
        type: "paper_report",
        label: report.paper.title,
        subtitle: report.recommendation,
        tags: report.likelyBaselines,
        meta: {
          repoCandidates: report.repoCandidates.length,
          evidenceCount: report.evidenceSnippets.length,
          updatedAt: report.updatedAt,
        },
        occurredAt: report.createdAt,
        ...(report.paper.url ? { externalUrl: report.paper.url } : {}),
      });
      if (report.sourceItemId) {
        edges.push(buildEdge(`source:${report.sourceItemId}`, reportNodeId, "mentions_paper"));
      }

      const paperRecord = ensurePaperRecord({
        doi: report.paper.doi,
        url: report.paper.url,
        title: report.paper.title,
        occurredAt: report.createdAt,
        tags: [
          report.paper.venue ?? "",
          report.paper.year ? String(report.paper.year) : "",
          ...report.likelyBaselines,
        ],
      });
      if (paperRecord) {
        paperRecord.paperReportIds.add(report.id);
        if (report.sourceItemId) {
          paperRecord.sourceItemIds.add(report.sourceItemId);
        }
      }

      for (const candidate of report.repoCandidates) {
        const repoRecord = ensureRepoRecord({
          url: candidate.url,
          label:
            candidate.owner && candidate.repo
              ? `${candidate.owner}/${candidate.repo}`
              : undefined,
          occurredAt: report.createdAt,
        });
        if (repoRecord) {
          repoRecord.paperReportIds.add(report.id);
          if (paperRecord) {
            repoRecord.paperKeys.add(paperRecord.key);
            paperRecord.repoKeys.add(repoRecord.key);
          }
        }
      }
    }

    for (const repo of repoReports) {
      const repoNodeId = `repo-report:${repo.id}`;
      nodes.push({
        id: repoNodeId,
        type: "repo_report",
        label: `${repo.owner}/${repo.repo}`,
        subtitle: repo.description,
        tags: repo.keyPaths,
        meta: {
          stars: repo.stars ?? 0,
          likelyOfficial: repo.likelyOfficial,
          updatedAt: repo.updatedAt,
        },
        occurredAt: repo.createdAt,
        externalUrl: repo.url,
      });

      const repoRecord = ensureRepoRecord({
        url: repo.url,
        label: `${repo.owner}/${repo.repo}`,
        occurredAt: repo.createdAt,
        tags: [...repo.keyPaths],
      });
      if (repoRecord) {
        repoRecord.repoReportIds.add(repo.id);
      }

      for (const sourceItem of sourceItems) {
        if (sourceItem.repoCandidates.some((candidate) => candidate.url === repo.url)) {
          edges.push(buildEdge(`source:${sourceItem.id}`, repoNodeId, "links_repo"));
        }
      }
      for (const report of paperReports) {
        if (report.repoCandidates.some((candidate) => candidate.url === repo.url)) {
          edges.push(buildEdge(`paper-report:${report.id}`, repoNodeId, "has_repo"));
        }
      }
    }

    for (const asset of moduleAssets) {
      const assetNodeId = `module:${asset.id}`;
      const archivePath = normalizeWorkspaceRelativePath(this.workspaceDir, asset.archivePath);
      nodes.push({
        id: assetNodeId,
        type: "module_asset",
        label: `${asset.owner}/${asset.repo}`,
        subtitle: asset.archivePath,
        tags: asset.selectedPaths,
        meta: {
          pathCount: asset.selectedPaths.length,
          archivePath: asset.archivePath ?? null,
          updatedAt: asset.updatedAt,
        },
        occurredAt: asset.createdAt,
        externalUrl: asset.repoUrl,
        ...(archivePath ? { artifactPath: archivePath } : {}),
      });
      for (const repo of repoReports) {
        if (repo.url === asset.repoUrl) {
          edges.push(buildEdge(`repo-report:${repo.id}`, assetNodeId, "extracts_module"));
        }
      }

      const repoRecord = ensureRepoRecord({
        url: asset.repoUrl,
        label: `${asset.owner}/${asset.repo}`,
        occurredAt: asset.createdAt,
        tags: [...asset.selectedPaths],
      });
      if (repoRecord) {
        repoRecord.moduleAssetIds.add(asset.id);
      }
    }

    for (const presentation of presentations) {
      const presentationNodeId = `presentation:${presentation.id}`;
      nodes.push({
        id: presentationNodeId,
        type: "presentation",
        label: presentation.title,
        subtitle: presentation.pptxPath || presentation.filePath,
        tags: [],
        meta: {
          generatedAt: presentation.generatedAt,
          imageCount: presentation.imagePaths.length,
          filePath: normalizeWorkspaceRelativePath(this.workspaceDir, presentation.filePath) ?? presentation.filePath,
          pptxPath: normalizeWorkspaceRelativePath(this.workspaceDir, presentation.pptxPath) ?? presentation.pptxPath ?? null,
        },
        occurredAt: presentation.generatedAt,
        artifactPath: normalizeWorkspaceRelativePath(this.workspaceDir, presentation.filePath),
      });
      for (const taskId of presentation.sourceReportTaskIds) {
        edges.push(buildEdge(`workflow:${taskId}`, presentationNodeId, "included_in_presentation"));
      }
    }

    const canonicalPaperNodes = [...paperRecords.values()]
      .sort((left, right) => (left.label || "").localeCompare(right.label || ""))
      .map((paper) => ({
        id: paper.id,
        type: "paper" as const,
        label: paper.label,
        subtitle: paper.externalUrl,
        tags: [...paper.tags].slice(0, 8),
        meta: {
          sourceItems: paper.sourceItemIds.size,
          discoveryRuns: paper.discoveryRunIds.size,
          workflowReports: paper.workflowReportIds.size,
          paperReports: paper.paperReportIds.size,
          linkedRepos: paper.repoKeys.size,
        },
        ...(paper.occurredAt ? { occurredAt: paper.occurredAt } : {}),
        ...(paper.externalUrl ? { externalUrl: paper.externalUrl } : {}),
      }));

    const canonicalRepoNodes = [...repoRecords.values()]
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((repo) => ({
        id: repo.id,
        type: "repo" as const,
        label: repo.label,
        subtitle: repo.externalUrl,
        tags: [...repo.tags].slice(0, 8),
        meta: {
          sourceItems: repo.sourceItemIds.size,
          linkedPapers: repo.paperKeys.size,
          paperReports: repo.paperReportIds.size,
          repoReports: repo.repoReportIds.size,
          moduleAssets: repo.moduleAssetIds.size,
        },
        ...(repo.occurredAt ? { occurredAt: repo.occurredAt } : {}),
        externalUrl: repo.externalUrl,
      }));

    nodes.push(...canonicalPaperNodes, ...canonicalRepoNodes);

    for (const paper of paperRecords.values()) {
      for (const sourceItemId of paper.sourceItemIds) {
        edges.push(buildEdge(`source:${sourceItemId}`, paper.id, "references_paper"));
      }
      for (const runId of paper.discoveryRunIds) {
        edges.push(buildEdge(`discovery:${runId}`, paper.id, "ranked_paper"));
      }
      for (const workflowReportId of paper.workflowReportIds) {
        edges.push(buildEdge(`workflow:${workflowReportId}`, paper.id, "includes_paper"));
      }
      for (const reportId of paper.paperReportIds) {
        edges.push(buildEdge(`paper-report:${reportId}`, paper.id, "analyzes_paper"));
      }
      for (const repoKey of paper.repoKeys) {
        const repo = repoRecords.get(repoKey);
        if (repo) {
          edges.push(buildEdge(paper.id, repo.id, "has_repo"));
        }
      }
    }

    for (const repo of repoRecords.values()) {
      for (const sourceItemId of repo.sourceItemIds) {
        edges.push(buildEdge(`source:${sourceItemId}`, repo.id, "references_repo"));
      }
      for (const reportId of repo.repoReportIds) {
        edges.push(buildEdge(`repo-report:${reportId}`, repo.id, "describes_repo"));
      }
      for (const assetId of repo.moduleAssetIds) {
        edges.push(buildEdge(repo.id, `module:${assetId}`, "extracts_module"));
      }
    }

    return {
      generatedAt: nowIso(),
      stats: {
        nodes: nodes.length,
        edges: edges.length,
        byType: countByType(nodes),
      },
      nodes,
      edges,
    };
  }

  private buildPaperGraph(graph: ResearchMemoryGraph): ResearchMemoryGraph {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const paperNodes = graph.nodes.filter((node) => node.type === "paper");
    const paperNodeIds = new Set(paperNodes.map((node) => node.id));
    const paperIdsByContextId = new Map<string, Set<string>>();

    for (const edge of graph.edges) {
      const sourceIsPaper = paperNodeIds.has(edge.source);
      const targetIsPaper = paperNodeIds.has(edge.target);
      if (sourceIsPaper === targetIsPaper) {
        continue;
      }

      const paperId = sourceIsPaper ? edge.source : edge.target;
      const contextId = sourceIsPaper ? edge.target : edge.source;
      const contextNode = nodeById.get(contextId);
      if (!contextNode) {
        continue;
      }

      const relation = describePaperRelation(contextNode);
      if (!relation) {
        continue;
      }

      const paperIds = paperIdsByContextId.get(contextId) ?? new Set<string>();
      paperIds.add(paperId);
      paperIdsByContextId.set(contextId, paperIds);
    }

    const relationByPairKey = new Map<
      string,
      {
        source: string;
        target: string;
        weight: number;
        kinds: Set<string>;
        labels: Set<string>;
        supportingNodeIds: Set<string>;
        supportingLabels: Set<string>;
      }
    >();

    for (const [contextId, paperIds] of paperIdsByContextId) {
      if (paperIds.size < 2) {
        continue;
      }

      const contextNode = nodeById.get(contextId);
      if (!contextNode) {
        continue;
      }

      const relation = describePaperRelation(contextNode);
      if (!relation) {
        continue;
      }

      const sortedPaperIds = [...paperIds].sort((left, right) => left.localeCompare(right));
      for (let index = 0; index < sortedPaperIds.length; index += 1) {
        for (let nextIndex = index + 1; nextIndex < sortedPaperIds.length; nextIndex += 1) {
          const source = sortedPaperIds[index]!;
          const target = sortedPaperIds[nextIndex]!;
          const pairKey = buildPaperPairKey(source, target);
          const existing = relationByPairKey.get(pairKey) ?? {
            source,
            target,
            weight: 0,
            kinds: new Set<string>(),
            labels: new Set<string>(),
            supportingNodeIds: new Set<string>(),
            supportingLabels: new Set<string>(),
          };

          existing.weight += 1;
          existing.kinds.add(relation.kind);
          existing.labels.add(relation.label);
          existing.supportingNodeIds.add(contextNode.id);
          existing.supportingLabels.add(contextNode.label);
          relationByPairKey.set(pairKey, existing);
        }
      }
    }

    const edges = [...relationByPairKey.values()]
      .map((relation) => {
        const labels = [...relation.labels];
        const label =
          labels.length === 1
            ? labels[0]!
            : labels.length === 2
              ? labels.join(" + ")
              : "Connected in multiple research contexts";

        return buildEdge(
          relation.source,
          relation.target,
          label,
          {
            kind: relation.kinds.size === 1 ? [...relation.kinds][0] : "shared_context",
            weight: relation.weight,
            supportingNodeIds: [...relation.supportingNodeIds],
            supportingLabels: [...relation.supportingLabels].sort((left, right) => left.localeCompare(right)),
          },
        );
      })
      .sort((left, right) => {
        const weightDelta = (right.weight ?? 0) - (left.weight ?? 0);
        if (weightDelta !== 0) {
          return weightDelta;
        }
        return left.label.localeCompare(right.label);
      });

    const connectedPaperCountById = new Map<string, number>();
    for (const edge of edges) {
      connectedPaperCountById.set(edge.source, (connectedPaperCountById.get(edge.source) ?? 0) + 1);
      connectedPaperCountById.set(edge.target, (connectedPaperCountById.get(edge.target) ?? 0) + 1);
    }

    const projectedPaperNodes = paperNodes.map((node) => ({
      ...node,
      meta: {
        ...node.meta,
        connectedPapers: connectedPaperCountById.get(node.id) ?? 0,
      },
    }));

    return {
      generatedAt: graph.generatedAt,
      stats: {
        nodes: projectedPaperNodes.length,
        edges: edges.length,
        byType: countByType(projectedPaperNodes),
      },
      nodes: projectedPaperNodes,
      edges,
    };
  }

  private filterGraph(graph: ResearchMemoryGraph, query: ResearchMemoryGraphQuery): ResearchMemoryGraph {
    const requestedTypes = Array.isArray(query.types) && query.types.length > 0 ? new Set(query.types) : null;
    const searchTokens = normalizeQueryTokens(query.search);
    const topicTokens = normalizeQueryTokens(query.topic);
    const dateFromMs = parseDateBoundary(query.dateFrom, "start");
    const dateToMs = parseDateBoundary(query.dateTo, "end");

    const filteredNodes = graph.nodes.filter((node) => {
      if (requestedTypes && !requestedTypes.has(node.type)) {
        return false;
      }

      const haystack = buildNodeSearchHaystack(node);
      if (searchTokens.length > 0 && !matchesTokens(haystack, searchTokens)) {
        return false;
      }

      const topicHaystack = `${node.label} ${node.subtitle ?? ""} ${node.tags.join(" ")}`.toLowerCase();
      if (topicTokens.length > 0 && !matchesTokens(topicHaystack, topicTokens)) {
        return false;
      }

      if (dateFromMs != null || dateToMs != null) {
        const timestampMs = getNodeTimestampMs(node);
        if (timestampMs == null) {
          return false;
        }
        if (dateFromMs != null && timestampMs < dateFromMs) {
          return false;
        }
        if (dateToMs != null && timestampMs > dateToMs) {
          return false;
        }
      }

      return true;
    });

    const includedIds = new Set(filteredNodes.map((node) => node.id));
    const filteredEdges = graph.edges.filter(
      (edge) => includedIds.has(edge.source) && includedIds.has(edge.target),
    );

    return {
      generatedAt: graph.generatedAt,
      stats: {
        nodes: filteredNodes.length,
        edges: filteredEdges.length,
        byType: countByType(filteredNodes),
      },
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }

  private buildNodeLinks(node: ResearchMemoryNode, raw: unknown): ResearchMemoryNodeLink[] {
    const links: ResearchMemoryNodeLink[] = [];
    const parsed = parseNodeId(node.id);
    if (!parsed) {
      return links;
    }

    switch (parsed.type) {
      case "direction":
        links.push(
          { label: "Direction JSON", href: `/api/research/directions/${encodeURIComponent(parsed.entityId)}`, kind: "api" },
          { label: "Discovery Plan", href: `/api/research/directions/${encodeURIComponent(parsed.entityId)}/plan`, kind: "api" },
        );
        break;
      case "discovery":
        links.push({
          label: "Discovery Run JSON",
          href: `/api/research/discovery/runs/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      case "source":
        links.push({
          label: "Source Item JSON",
          href: `/api/research/source-items/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      case "workflow":
        links.push({
          label: "Workflow Report JSON",
          href: `/api/research/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      case "paper_report":
        links.push({
          label: "Paper Report JSON",
          href: `/api/research/paper-reports/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      case "repo":
        break;
      case "repo_report":
        links.push({
          label: "Repo Report JSON",
          href: `/api/research/repo-reports/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      case "module":
        links.push({
          label: "Module Asset JSON",
          href: `/api/research/module-assets/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      case "presentation":
        links.push({
          label: "Presentation JSON",
          href: `/api/research/presentations/${encodeURIComponent(parsed.entityId)}`,
          kind: "api",
        });
        break;
      default:
        break;
    }

    if (node.externalUrl) {
      links.push({
        label: "Open External Source",
        href: node.externalUrl,
        kind: "external",
      });
    }

    if (node.artifactPath) {
      links.push({
        label: "Open Artifact File",
        href: `/api/research/artifact?path=${encodeURIComponent(node.artifactPath)}`,
        kind: "artifact",
      });
    }

    if (
      parsed.type === "presentation" &&
      raw &&
      typeof raw === "object" &&
      "pptxPath" in raw &&
      typeof raw.pptxPath === "string"
    ) {
      const pptxPath = normalizeWorkspaceRelativePath(this.workspaceDir, raw.pptxPath);
      if (pptxPath) {
        links.push({
          label: "Open Presentation PPTX",
          href: `/api/research/artifact?path=${encodeURIComponent(pptxPath)}`,
          kind: "artifact",
        });
      }
    }

    return links;
  }

  private async resolveRawNodePayload(nodeId: string): Promise<unknown> {
    const parsed = parseNodeId(nodeId);
    if (!parsed) {
      return null;
    }

    switch (parsed.type) {
      case "direction":
        return this.directionService.getProfile(parsed.entityId);
      case "discovery":
        return this.discoveryService.getRun(parsed.entityId);
      case "source":
        return this.linkIngestionService.getItem(parsed.entityId);
      case "paper":
        return null;
      case "workflow":
        return this.researchService.getReport(parsed.entityId);
      case "paper_report":
        return this.paperAnalysisService.getReport(parsed.entityId);
      case "repo":
        return null;
      case "repo_report":
        return this.repoAnalysisService.getReport(parsed.entityId);
      case "module":
        return this.moduleAssetService.getAsset(parsed.entityId);
      case "presentation":
        return this.presentationService.getPresentation(parsed.entityId);
      default:
        return null;
    }
  }

  async buildGraph(query: ResearchMemoryGraphQuery = {}): Promise<ResearchMemoryGraph> {
    return this.resolveGraphForQuery(query);
  }

  async getNodeDetail(nodeId: string, query: ResearchMemoryGraphQuery = {}): Promise<ResearchMemoryNodeDetail | null> {
    const graph = await this.resolveGraphForQuery(query);
    const node = graph.nodes.find((item) => item.id === nodeId.trim());
    if (!node) {
      return null;
    }

    const relatedEdges = graph.edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id,
    );
    const relatedNodeIds = new Set(
      relatedEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== node.id),
    );
    const relatedNodes = graph.nodes.filter((item) => relatedNodeIds.has(item.id));
    const persistedRaw = await this.resolveRawNodePayload(node.id);
    const raw = (() => {
      if (persistedRaw) {
        return persistedRaw;
      }

      if (query.view === "paper" && node.type === "paper") {
        return {
          kind: "paper_relation_node",
          canonicalId: node.id,
          label: node.label,
          externalUrl: node.externalUrl ?? null,
          meta: node.meta,
          connectedPaperCount: relatedNodes.length,
          relationKinds: Object.fromEntries(
            [...new Set(relatedEdges.map((edge) => edge.kind || "shared_context"))].map((kind) => [
              kind,
              relatedEdges.filter((edge) => (edge.kind || "shared_context") === kind).length,
            ]),
          ),
          relations: relatedEdges.map((edge) => {
            const peerId = edge.source === node.id ? edge.target : edge.source;
            const peer = relatedNodes.find((item) => item.id === peerId);
            return {
              peerId,
              peerLabel: peer?.label ?? peerId,
              relation: edge.label,
              relationKind: edge.kind ?? "shared_context",
              weight: edge.weight ?? 1,
              supportingLabels: edge.supportingLabels ?? [],
            };
          }),
        };
      }

      if (node.type === "paper" || node.type === "repo") {
        return {
          kind: node.type === "paper" ? "canonical_paper" : "canonical_repo",
          canonicalId: node.id,
          label: node.label,
          externalUrl: node.externalUrl ?? null,
          meta: node.meta,
          relatedNodeIds: relatedNodes.map((item) => item.id),
          relatedByType: Object.fromEntries(
            [...new Set(relatedNodes.map((item) => item.type))].map((type) => [
              type,
              relatedNodes
                .filter((item) => item.type === type)
                .map((item) => ({ id: item.id, label: item.label })),
            ]),
          ),
          provenance: relatedEdges.map((edge) => ({
            edgeId: edge.id,
            label: edge.label,
            source: edge.source,
            target: edge.target,
          })),
        };
      }

      return null;
    })();

    return {
      generatedAt: nowIso(),
      node,
      relatedEdges,
      relatedNodes,
      raw,
      links: this.buildNodeLinks(node, raw),
    };
  }

  async queryGraph(query: ResearchMemoryGraphQuery = {}, limit = 6): Promise<{
    generatedAt: string;
    view: ResearchMemoryGraphView;
    filters: ResearchMemoryGraphQuery;
    stats: ResearchMemoryGraph["stats"];
    topNodes: Array<{
      node: ResearchMemoryNode;
      degree: number;
    }>;
    strongestEdges: Array<ResearchMemoryEdge & {
      sourceLabel: string;
      targetLabel: string;
    }>;
    isolatedNodes: ResearchMemoryNode[];
  }> {
    const graph = await this.resolveGraphForQuery(query);
    const boundedLimit = Math.max(1, Math.min(limit, 12));
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const degreeByNodeId = buildDegreeByNodeId(graph);
    const connectedNodeIds = new Set(graph.edges.flatMap((edge) => [edge.source, edge.target]));

    return {
      generatedAt: graph.generatedAt,
      view: query.view ?? "asset",
      filters: query,
      stats: graph.stats,
      topNodes: [...graph.nodes]
        .sort((left, right) => compareInsightNodes(left, right, degreeByNodeId))
        .slice(0, boundedLimit)
        .map((node) => ({
          node,
          degree: degreeByNodeId.get(node.id) ?? 0,
        })),
      strongestEdges: [...graph.edges]
        .sort(compareInsightEdges)
        .slice(0, boundedLimit)
        .map((edge) => ({
          ...edge,
          sourceLabel: nodeById.get(edge.source)?.label ?? edge.source,
          targetLabel: nodeById.get(edge.target)?.label ?? edge.target,
        })),
      isolatedNodes: graph.nodes
        .filter((node) => !connectedNodeIds.has(node.id))
        .sort((left, right) => left.label.localeCompare(right.label))
        .slice(0, boundedLimit),
    };
  }

  async findPath(
    fromNodeId: string,
    toNodeId: string,
    query: ResearchMemoryGraphQuery = {},
  ): Promise<{
    generatedAt: string;
    view: ResearchMemoryGraphView;
    connected: boolean;
    fromNode: ResearchMemoryNode | null;
    toNode: ResearchMemoryNode | null;
    hops: number;
    pathNodeIds: string[];
    pathNodes: ResearchMemoryNode[];
    pathEdges: Array<ResearchMemoryEdge & { sourceLabel: string; targetLabel: string }>;
    summary: string;
  }> {
    const graph = await this.resolveGraphForQuery(query);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const fromNode = nodeById.get(fromNodeId.trim()) ?? null;
    const toNode = nodeById.get(toNodeId.trim()) ?? null;

    if (!fromNode || !toNode) {
      return {
        generatedAt: graph.generatedAt,
        view: query.view ?? "asset",
        connected: false,
        fromNode,
        toNode,
        hops: 0,
        pathNodeIds: [],
        pathNodes: [],
        pathEdges: [],
        summary: "One or both nodes are missing in the current graph view.",
      };
    }

    const path = findShortestPath(graph, fromNode.id, toNode.id);
    if (!path) {
      return {
        generatedAt: graph.generatedAt,
        view: query.view ?? "asset",
        connected: false,
        fromNode,
        toNode,
        hops: 0,
        pathNodeIds: [],
        pathNodes: [],
        pathEdges: [],
        summary: `${fromNode.label} and ${toNode.label} are not connected in the current graph view.`,
      };
    }

    const pathNodes = path.nodeIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is ResearchMemoryNode => Boolean(node));
    const pathEdges = path.edges.map((edge) => ({
      ...edge,
      sourceLabel: nodeById.get(edge.source)?.label ?? edge.source,
      targetLabel: nodeById.get(edge.target)?.label ?? edge.target,
    }));
    const hops = Math.max(0, path.nodeIds.length - 1);

    return {
      generatedAt: graph.generatedAt,
      view: query.view ?? "asset",
      connected: true,
      fromNode,
      toNode,
      hops,
      pathNodeIds: path.nodeIds,
      pathNodes,
      pathEdges,
      summary:
        hops === 0
          ? `${fromNode.label} and ${toNode.label} are the same node in the current graph view.`
          : `${fromNode.label} reaches ${toNode.label} in ${hops} hop${hops === 1 ? "" : "s"}.`,
    };
  }

  async explainConnection(
    fromNodeId: string,
    toNodeId: string,
    query: ResearchMemoryGraphQuery = {},
  ): Promise<{
    generatedAt: string;
    view: ResearchMemoryGraphView;
    connected: boolean;
    relationType: "missing" | "direct" | "indirect" | "disconnected";
    fromNode: ResearchMemoryNode | null;
    toNode: ResearchMemoryNode | null;
    directEdges: Array<ResearchMemoryEdge & { sourceLabel: string; targetLabel: string }>;
    sharedNeighbors: ResearchMemoryNode[];
    supportingLabels: string[];
    path: {
      hops: number;
      pathNodeIds: string[];
      pathNodes: ResearchMemoryNode[];
      pathEdges: Array<ResearchMemoryEdge & { sourceLabel: string; targetLabel: string }>;
    } | null;
    summary: string;
  }> {
    const graph = await this.resolveGraphForQuery(query);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const fromNode = nodeById.get(fromNodeId.trim()) ?? null;
    const toNode = nodeById.get(toNodeId.trim()) ?? null;

    if (!fromNode || !toNode) {
      return {
        generatedAt: graph.generatedAt,
        view: query.view ?? "asset",
        connected: false,
        relationType: "missing",
        fromNode,
        toNode,
        directEdges: [],
        sharedNeighbors: [],
        supportingLabels: [],
        path: null,
        summary: "One or both nodes are missing in the current graph view.",
      };
    }

    const directEdges = graph.edges
      .filter(
        (edge) =>
          (edge.source === fromNode.id && edge.target === toNode.id) ||
          (edge.source === toNode.id && edge.target === fromNode.id),
      )
      .sort(compareInsightEdges)
      .map((edge) => ({
        ...edge,
        sourceLabel: nodeById.get(edge.source)?.label ?? edge.source,
        targetLabel: nodeById.get(edge.target)?.label ?? edge.target,
      }));

    const adjacency = buildAdjacency(graph);
    const fromNeighbors = new Set((adjacency.get(fromNode.id) ?? []).map((item) => item.neighborId));
    const toNeighbors = new Set((adjacency.get(toNode.id) ?? []).map((item) => item.neighborId));
    const sharedNeighbors = graph.nodes
      .filter((node) => node.id !== fromNode.id && node.id !== toNode.id && fromNeighbors.has(node.id) && toNeighbors.has(node.id))
      .sort((left, right) => left.label.localeCompare(right.label))
      .slice(0, 8);

    if (directEdges.length > 0) {
      const supportingLabels = uniqueStrings(directEdges.flatMap((edge) => edge.supportingLabels ?? []));
      return {
        generatedAt: graph.generatedAt,
        view: query.view ?? "asset",
        connected: true,
        relationType: "direct",
        fromNode,
        toNode,
        directEdges,
        sharedNeighbors,
        supportingLabels,
        path: {
          hops: 1,
          pathNodeIds: [fromNode.id, toNode.id],
          pathNodes: [fromNode, toNode],
          pathEdges: directEdges,
        },
        summary: supportingLabels.length > 0
          ? `${fromNode.label} and ${toNode.label} are directly connected. Shared evidence: ${supportingLabels.slice(0, 3).join(", ")}.`
          : `${fromNode.label} and ${toNode.label} are directly connected in the current graph view.`,
      };
    }

    const path = await this.findPath(fromNode.id, toNode.id, query);
    if (!path.connected) {
      return {
        generatedAt: graph.generatedAt,
        view: query.view ?? "asset",
        connected: false,
        relationType: "disconnected",
        fromNode,
        toNode,
        directEdges: [],
        sharedNeighbors,
        supportingLabels: [],
        path: null,
        summary: `${fromNode.label} and ${toNode.label} do not share a visible path in the current graph view.`,
      };
    }

    return {
      generatedAt: graph.generatedAt,
      view: query.view ?? "asset",
      connected: true,
      relationType: "indirect",
      fromNode,
      toNode,
      directEdges: [],
      sharedNeighbors,
      supportingLabels: [],
      path: {
        hops: path.hops,
        pathNodeIds: path.pathNodeIds,
        pathNodes: path.pathNodes,
        pathEdges: path.pathEdges,
      },
      summary: `${fromNode.label} reaches ${toNode.label} through ${path.hops} hop${path.hops === 1 ? "" : "s"} in the current graph view.`,
    };
  }

  async buildGraphReport(
    query: ResearchMemoryGraphQuery = {},
    limit = 6,
  ): Promise<{
    generatedAt: string;
    view: ResearchMemoryGraphView;
    filters: ResearchMemoryGraphQuery;
    stats: ResearchMemoryGraph["stats"];
    isolatedNodeCount: number;
    hubs: Array<{
      node: ResearchMemoryNode;
      degree: number;
    }>;
    strongestEdges: Array<ResearchMemoryEdge & {
      sourceLabel: string;
      targetLabel: string;
    }>;
    components: Array<{
      id: string;
      size: number;
      edgeCount: number;
      nodeTypes: Record<string, number>;
      leadNodes: Array<{
        id: string;
        label: string;
        type: ResearchMemoryNodeType;
        degree: number;
      }>;
      supportingLabels: string[];
    }>;
    summary: string[];
  }> {
    const graph = await this.resolveGraphForQuery(query);
    const boundedLimit = Math.max(1, Math.min(limit, 12));
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const degreeByNodeId = buildDegreeByNodeId(graph);
    const connectedNodeIds = new Set(graph.edges.flatMap((edge) => [edge.source, edge.target]));
    const adjacency = buildAdjacency(graph);
    const visited = new Set<string>();
    const components: Array<{
      id: string;
      size: number;
      edgeCount: number;
      nodeTypes: Record<string, number>;
      leadNodes: Array<{
        id: string;
        label: string;
        type: ResearchMemoryNodeType;
        degree: number;
      }>;
      supportingLabels: string[];
    }> = [];

    for (const node of graph.nodes) {
      if (visited.has(node.id)) {
        continue;
      }

      const queue = [node.id];
      const componentNodeIds = new Set<string>();
      visited.add(node.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        componentNodeIds.add(currentId);
        for (const neighbor of adjacency.get(currentId) ?? []) {
          if (visited.has(neighbor.neighborId)) {
            continue;
          }
          visited.add(neighbor.neighborId);
          queue.push(neighbor.neighborId);
        }
      }

      if (componentNodeIds.size <= 1) {
        continue;
      }

      const componentNodes = graph.nodes.filter((item) => componentNodeIds.has(item.id));
      const componentEdges = graph.edges.filter(
        (edge) => componentNodeIds.has(edge.source) && componentNodeIds.has(edge.target),
      );

      components.push({
        id: `component-${components.length + 1}`,
        size: componentNodes.length,
        edgeCount: componentEdges.length,
        nodeTypes: countByType(componentNodes),
        leadNodes: [...componentNodes]
          .sort((left, right) => compareInsightNodes(left, right, degreeByNodeId))
          .slice(0, 3)
          .map((componentNode) => ({
            id: componentNode.id,
            label: componentNode.label,
            type: componentNode.type,
            degree: degreeByNodeId.get(componentNode.id) ?? 0,
          })),
        supportingLabels: uniqueStrings(componentEdges.flatMap((edge) => edge.supportingLabels ?? [])).slice(0, 6),
      });
    }

    components.sort((left, right) => right.size - left.size || right.edgeCount - left.edgeCount || left.id.localeCompare(right.id));

    const hubs = [...graph.nodes]
      .sort((left, right) => compareInsightNodes(left, right, degreeByNodeId))
      .slice(0, boundedLimit)
      .map((node) => ({
        node,
        degree: degreeByNodeId.get(node.id) ?? 0,
      }));

    const strongestEdges = [...graph.edges]
      .sort(compareInsightEdges)
      .slice(0, boundedLimit)
      .map((edge) => ({
        ...edge,
        sourceLabel: nodeById.get(edge.source)?.label ?? edge.source,
        targetLabel: nodeById.get(edge.target)?.label ?? edge.target,
      }));

    const summary = uniqueStrings([
      `${graph.stats.nodes} nodes and ${graph.stats.edges} edges are visible in the ${query.view ?? "asset"} graph view.`,
      hubs[0] ? `Top hub: ${hubs[0].node.label} (${hubs[0].degree} links).` : undefined,
      strongestEdges[0]
        ? `Strongest link: ${strongestEdges[0].sourceLabel} <-> ${strongestEdges[0].targetLabel} (${strongestEdges[0].weight ?? 1}).`
        : undefined,
      components[0]
        ? `Largest cluster: ${components[0].size} nodes around ${components[0].leadNodes.map((node) => node.label).join(", ")}.`
        : undefined,
      graph.nodes.length - connectedNodeIds.size > 0
        ? `${graph.nodes.length - connectedNodeIds.size} nodes are currently isolated in this filtered view.`
        : undefined,
    ]);

    return {
      generatedAt: graph.generatedAt,
      view: query.view ?? "asset",
      filters: query,
      stats: graph.stats,
      isolatedNodeCount: graph.nodes.length - connectedNodeIds.size,
      hubs,
      strongestEdges,
      components: components.slice(0, boundedLimit),
      summary,
    };
  }
}
