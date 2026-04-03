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

function buildEdge(source: string, target: string, label: string): ResearchMemoryEdge {
  return {
    id: `${source}::${label}::${target}`,
    source,
    target,
    label,
  };
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
    const graph = await this.buildFullGraph();
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

  async getNodeDetail(nodeId: string): Promise<ResearchMemoryNodeDetail | null> {
    const graph = await this.buildFullGraph();
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
    const raw =
      persistedRaw ??
      (node.type === "paper" || node.type === "repo"
        ? {
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
          }
        : null);

    return {
      generatedAt: nowIso(),
      node,
      relatedEdges,
      relatedNodes,
      raw,
      links: this.buildNodeLinks(node, raw),
    };
  }
}
