import { readFile } from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ResearchRequestSchema } from "../schemas/researchSchema.js";
import { ResearchLinkIngestionService } from "../services/researchLinkIngestionService.js";
import { ResearchFeedbackService } from "../services/researchFeedbackService.js";
import { ResearchMemoryRegistryService } from "../services/researchMemoryRegistryService.js";
import { ResearchModuleAssetService } from "../services/researchModuleAssetService.js";
import { ResearchPaperAnalysisService } from "../services/researchPaperAnalysisService.js";
import { ResearchDirectionReportService } from "../services/researchDirectionReportService.js";
import { ResearchPresentationService } from "../services/researchPresentationService.js";
import { ResearchRepoAnalysisService } from "../services/researchRepoAnalysisService.js";
import { ResearchRoundService } from "../services/researchRoundService.js";
import type { ResearchDirectionService } from "../services/researchDirectionService.js";
import type { ResearchDiscoverySchedulerService } from "../services/researchDiscoverySchedulerService.js";
import type { ResearchDiscoveryService } from "../services/researchDiscoveryService.js";
import type { ResearchService } from "../services/researchService.js";
import type { ResearchTaskService } from "../services/researchTaskService.js";
import type { ResearchMemoryGraphQuery, ResearchMemoryNodeType } from "../types/researchMemoryGraph.js";

const GRAPH_NODE_TYPES: ResearchMemoryNodeType[] = [
  "direction",
  "discovery_run",
  "source_item",
  "paper",
  "workflow_report",
  "paper_report",
  "repo",
  "repo_report",
  "module_asset",
  "presentation",
];

const ResearchTaskParamsSchema = z.object({
  taskId: z.string().uuid()
});

const DirectionParamsSchema = z.object({
  directionId: z.string().trim().min(1)
});

const DirectionBriefMarkdownImportSchema = z.object({
  markdown: z.string().trim().min(1),
  id: z.string().trim().min(1).optional(),
});

const DiscoveryRunParamsSchema = z.object({
  runId: z.string().trim().min(1)
});

const SourceItemParamsSchema = z.object({
  sourceItemId: z.string().trim().min(1)
});

const PaperReportParamsSchema = z.object({
  reportId: z.string().trim().min(1)
});

const RepoReportParamsSchema = z.object({
  reportId: z.string().trim().min(1)
});

const ModuleAssetParamsSchema = z.object({
  assetId: z.string().trim().min(1)
});

const PresentationParamsSchema = z.object({
  presentationId: z.string().trim().min(1)
});

const DirectionReportParamsSchema = z.object({
  reportId: z.string().trim().min(1)
});

const MemoryGraphNodeParamsSchema = z.object({
  nodeId: z.string().trim().min(1)
});

const ArtifactQuerySchema = z.object({
  path: z.string().trim().min(1)
});

const RecentReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

const TaskListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

const DiscoveryPlanQuerySchema = z.object({
  directionId: z.string().trim().min(1).optional()
});

const DiscoveryRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10)
});

const FeedbackRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

const DirectionReportGenerateSchema = z.object({
  directionId: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(1).optional(),
  days: z.coerce.number().int().min(1).max(30).optional(),
}).refine((value) => Boolean(value.directionId || value.topic), {
  message: "directionId or topic is required"
});

const FeedbackRecordSchema = z.object({
  feedback: z.enum([
    "useful",
    "not-useful",
    "more-like-this",
    "less-like-this",
    "too-theoretical",
    "too-engineering-heavy",
    "worth-following",
    "not-worth-following"
  ]),
  senderId: z.string().trim().min(1).optional(),
  senderName: z.string().trim().min(1).optional(),
  directionId: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(1).optional(),
  paperTitle: z.string().trim().min(1).optional(),
  venue: z.string().trim().min(1).optional(),
  sourceUrl: z.string().trim().url().optional(),
  notes: z.string().trim().min(1).optional(),
});

const MemoryGraphQuerySchema = z.object({
  view: z.enum(["asset", "paper"]).optional(),
  types: z.string().trim().optional(),
  search: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

const MemoryGraphConnectionQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  view: z.enum(["asset", "paper"]).optional(),
});

const MemoryGraphReportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional().default(6),
});

const DiscoveryRunRequestSchema = z.object({
  directionId: z.string().trim().min(1).optional(),
  maxPapersPerQuery: z.coerce.number().int().min(1).max(10).optional(),
  topK: z.coerce.number().int().min(1).max(10).optional(),
  pushToWechat: z.boolean().optional(),
  senderId: z.string().trim().min(1).optional(),
  senderName: z.string().trim().min(1).optional(),
});

const SchedulerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  dailyTimeLocal: z.string().trim().regex(/^\d{2}:\d{2}$/u).optional(),
  senderId: z.string().trim().min(1).optional(),
  senderName: z.string().trim().min(1).optional(),
  directionIds: z.array(z.string().trim().min(1)).optional(),
  topK: z.coerce.number().int().min(1).max(10).optional(),
  maxPapersPerQuery: z.coerce.number().int().min(1).max(10).optional(),
});

const ResearchDirectionProfileSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  tlDr: z.string().trim().min(1).optional(),
  abstract: z.string().trim().min(1).optional(),
  background: z.string().trim().min(1).optional(),
  targetProblem: z.string().trim().min(1).optional(),
  subDirections: z.array(z.string().trim().min(1)).optional(),
  excludedTopics: z.array(z.string().trim().min(1)).optional(),
  preferredVenues: z.array(z.string().trim().min(1)).optional(),
  preferredDatasets: z.array(z.string().trim().min(1)).optional(),
  preferredBenchmarks: z.array(z.string().trim().min(1)).optional(),
  preferredPaperStyles: z
    .array(z.enum(["theory", "engineering", "reproducibility", "application"]))
    .optional(),
  openQuestions: z.array(z.string().trim().min(1)).optional(),
  currentGoals: z.array(z.string().trim().min(1)).optional(),
  queryHints: z.array(z.string().trim().min(1)).optional(),
  successCriteria: z.array(z.string().trim().min(1)).optional(),
  blockedDirections: z.array(z.string().trim().min(1)).optional(),
  knownBaselines: z.array(z.string().trim().min(1)).optional(),
  evaluationPriorities: z.array(z.string().trim().min(1)).optional(),
  shortTermValidationTargets: z.array(z.string().trim().min(1)).optional(),
  priority: z.enum(["primary", "secondary", "watchlist"]).optional(),
  enabled: z.boolean().optional(),
});

function normalizeGraphTypes(raw: string | undefined): ResearchMemoryNodeType[] | null {
  if (!raw?.trim()) {
    return [];
  }

  const values = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
  if (values.some((value) => !GRAPH_NODE_TYPES.includes(value as ResearchMemoryNodeType))) {
    return null;
  }

  return values as ResearchMemoryNodeType[];
}

function parseGraphQuery(rawQuery: unknown):
  | { success: true; data: ResearchMemoryGraphQuery }
  | { success: false; message: string; issues?: unknown } {
  const parsed = MemoryGraphQuerySchema.safeParse(rawQuery ?? {});
  if (!parsed.success) {
    return {
      success: false,
      message: "Invalid research memory graph query",
      issues: parsed.error.flatten()
    };
  }

  const types = normalizeGraphTypes(parsed.data.types);
  if (types === null) {
    return {
      success: false,
      message: `Invalid graph node type filter. Supported values: ${GRAPH_NODE_TYPES.join(", ")}`
    };
  }

  return {
    success: true,
    data: {
      ...(parsed.data.view ? { view: parsed.data.view } : {}),
      ...(types.length > 0 ? { types } : {}),
      ...(parsed.data.search ? { search: parsed.data.search } : {}),
      ...(parsed.data.topic ? { topic: parsed.data.topic } : {}),
      ...(parsed.data.dateFrom ? { dateFrom: parsed.data.dateFrom } : {}),
      ...(parsed.data.dateTo ? { dateTo: parsed.data.dateTo } : {}),
    }
  };
}

function resolveWorkspaceArtifactPath(workspaceDir: string, requestedPath: string): string | null {
  const normalized = requestedPath.replace(/[\\/]+/gu, path.sep);
  const resolved = path.resolve(workspaceDir, normalized);
  const relative = path.relative(workspaceDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  const relativePosix = relative.replace(/[\\]+/gu, "/");
  if (!relativePosix.startsWith("research/")) {
    return null;
  }

  return resolved;
}

function contentTypeForArtifact(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".md") return "text/markdown; charset=utf-8";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".zip") return "application/zip";
  if (extension === ".pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export async function registerResearchRoutes(
  app: FastifyInstance,
  workspaceDir: string,
  researchService: ResearchService,
  researchTaskService: ResearchTaskService,
  researchDirectionService: ResearchDirectionService,
  researchDiscoveryService: ResearchDiscoveryService,
  researchDiscoverySchedulerService: ResearchDiscoverySchedulerService,
): Promise<void> {
  const linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
  const paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
  const repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
  const moduleAssetService = new ResearchModuleAssetService(workspaceDir);
  const feedbackService = new ResearchFeedbackService(workspaceDir);
  const directionReportService = new ResearchDirectionReportService(workspaceDir);
  const presentationService = new ResearchPresentationService(workspaceDir, researchService);
  const researchMemoryRegistryService = new ResearchMemoryRegistryService(workspaceDir, researchService);
  const researchRoundService = new ResearchRoundService(workspaceDir);

  app.get("/api/research/recent", async (request, reply) => {
    const parsedQuery = RecentReportsQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid recent research query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      reports: await researchService.listRecentReports(parsedQuery.data.limit)
    });
  });

  app.get("/api/research/tasks", async (request, reply) => {
    const parsedQuery = TaskListQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid research task query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      tasks: await researchTaskService.listTasks(parsedQuery.data.limit)
    });
  });

  app.get("/api/research/tasks/:taskId", async (request, reply) => {
    const parsedParams = ResearchTaskParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research task id",
        issues: parsedParams.error.flatten()
      });
    }

    const task = await researchTaskService.getTaskDetail(parsedParams.data.taskId);
    if (!task) {
      return reply.code(404).send({
        message: "Research task not found"
      });
    }

    return reply.send({
      ...task,
      handoff: await researchRoundService.getHandoff(parsedParams.data.taskId)
    });
  });

  app.get("/api/research/tasks/:taskId/handoff", async (request, reply) => {
    const parsedParams = ResearchTaskParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research task id",
        issues: parsedParams.error.flatten()
      });
    }

    const task = await researchTaskService.getTaskDetail(parsedParams.data.taskId);
    if (!task) {
      return reply.code(404).send({
        message: "Research task not found"
      });
    }

    const handoff = await researchRoundService.getHandoff(parsedParams.data.taskId);
    if (!handoff) {
      return reply.code(404).send({
        message: "Research task handoff not found"
      });
    }

    return reply.send(handoff);
  });

  app.post("/api/research/tasks", async (request, reply) => {
    const parsed = ResearchRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid research task payload",
        issues: parsed.error.flatten()
      });
    }

    return reply.code(202).send(await researchTaskService.enqueueTask(parsed.data));
  });

  app.post("/api/research/tasks/:taskId/retry", async (request, reply) => {
    const parsedParams = ResearchTaskParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research task id",
        issues: parsedParams.error.flatten()
      });
    }

    const nextTask = await researchTaskService.retryTask(parsedParams.data.taskId);
    if (!nextTask) {
      return reply.code(404).send({
        message: "Research task not found"
      });
    }

    return reply.code(202).send(nextTask);
  });

  app.get("/api/research/memory-graph", async (request, reply) => {
    const parsedQuery = parseGraphQuery(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: parsedQuery.message,
        ...(parsedQuery.issues ? { issues: parsedQuery.issues } : {})
      });
    }

    return reply.send(await researchMemoryRegistryService.buildGraph(parsedQuery.data));
  });

  app.get("/api/research/memory-graph/:nodeId", async (request, reply) => {
    const parsedParams = MemoryGraphNodeParamsSchema.safeParse(request.params);
    const parsedQuery = parseGraphQuery(request.query);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research memory graph node id",
        issues: parsedParams.error.flatten()
      });
    }

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: parsedQuery.message,
        ...(parsedQuery.issues ? { issues: parsedQuery.issues } : {})
      });
    }

    const detail = await researchMemoryRegistryService.getNodeDetail(parsedParams.data.nodeId, parsedQuery.data);
    if (!detail) {
      return reply.code(404).send({
        message: "Research memory graph node not found"
      });
    }

    return reply.send(detail);
  });

  app.get("/api/research/memory-graph/path", async (request, reply) => {
    const parsedPair = MemoryGraphConnectionQuerySchema.safeParse(request.query ?? {});
    if (!parsedPair.success) {
      return reply.code(400).send({
        message: "Invalid research memory graph path query",
        issues: parsedPair.error.flatten()
      });
    }

    const result = await researchMemoryRegistryService.findPath(
      parsedPair.data.from,
      parsedPair.data.to,
      parsedPair.data.view ? { view: parsedPair.data.view } : {}
    );

    if (!result.fromNode || !result.toNode) {
      return reply.code(404).send({
        message: "One or both research memory graph nodes were not found"
      });
    }

    return reply.send(result);
  });

  app.get("/api/research/memory-graph/explain", async (request, reply) => {
    const parsedPair = MemoryGraphConnectionQuerySchema.safeParse(request.query ?? {});
    if (!parsedPair.success) {
      return reply.code(400).send({
        message: "Invalid research memory graph explain query",
        issues: parsedPair.error.flatten()
      });
    }

    const result = await researchMemoryRegistryService.explainConnection(
      parsedPair.data.from,
      parsedPair.data.to,
      parsedPair.data.view ? { view: parsedPair.data.view } : {}
    );

    if (!result.fromNode || !result.toNode) {
      return reply.code(404).send({
        message: "One or both research memory graph nodes were not found"
      });
    }

    return reply.send(result);
  });

  app.get("/api/research/memory-graph/report", async (request, reply) => {
    const parsedQuery = parseGraphQuery(request.query);
    const parsedOptions = MemoryGraphReportQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: parsedQuery.message,
        ...(parsedQuery.issues ? { issues: parsedQuery.issues } : {})
      });
    }

    if (!parsedOptions.success) {
      return reply.code(400).send({
        message: "Invalid research memory graph report query",
        issues: parsedOptions.error.flatten()
      });
    }

    return reply.send(
      await researchMemoryRegistryService.buildGraphReport(parsedQuery.data, parsedOptions.data.limit)
    );
  });

  app.get("/api/research/artifact", async (request, reply) => {
    const parsedQuery = ArtifactQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid research artifact query",
        issues: parsedQuery.error.flatten()
      });
    }

    const resolvedPath = resolveWorkspaceArtifactPath(workspaceDir, parsedQuery.data.path);
    if (!resolvedPath) {
      return reply.code(400).send({
        message: "Artifact path must stay within the workspace"
      });
    }

    try {
      const bytes = await readFile(resolvedPath);
      reply.header("Content-Type", contentTypeForArtifact(resolvedPath));
      reply.header("Content-Disposition", `inline; filename="${path.basename(resolvedPath)}"`);
      return reply.send(bytes);
    } catch {
      return reply.code(404).send({
        message: "Research artifact not found"
      });
    }
  });

  app.get("/api/research/directions", async () => ({
    profiles: await researchDirectionService.listProfiles()
  }));

  app.get("/api/research/discovery-plan", async (request, reply) => {
    const parsedQuery = DiscoveryPlanQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid discovery plan query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      candidates: await researchDirectionService.buildDiscoveryPlan(parsedQuery.data.directionId)
    });
  });

  app.get("/api/research/discovery/recent", async (request, reply) => {
    const parsedQuery = DiscoveryRecentQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid discovery recent query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      runs: await researchDiscoveryService.listRecentRuns(parsedQuery.data.limit)
    });
  });

  app.get("/api/research/feedback", async (request, reply) => {
    const parsedQuery = FeedbackRecentQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid feedback query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      summary: await feedbackService.getSummary(parsedQuery.data.limit),
      items: await feedbackService.listRecent(parsedQuery.data.limit)
    });
  });

  app.post("/api/research/feedback", async (request, reply) => {
    const parsed = FeedbackRecordSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid research feedback payload",
        issues: parsed.error.flatten()
      });
    }

    const record = await feedbackService.record(parsed.data);
    return reply.code(201).send(record);
  });

  app.get("/api/research/discovery/runs/:runId", async (request, reply) => {
    const parsedParams = DiscoveryRunParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid discovery run id",
        issues: parsedParams.error.flatten()
      });
    }

    const run = await researchDiscoveryService.getRun(parsedParams.data.runId);
    if (!run) {
      return reply.code(404).send({
        message: "Discovery run not found"
      });
    }

    return reply.send(run);
  });

  app.get("/api/research/discovery/scheduler", async () =>
    researchDiscoverySchedulerService.getStatus()
  );

  app.post("/api/research/discovery/scheduler", async (request, reply) => {
    const parsed = SchedulerConfigSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid discovery scheduler payload",
        issues: parsed.error.flatten()
      });
    }

    const schedulerConfig = {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.dailyTimeLocal ? { dailyTimeLocal: parsed.data.dailyTimeLocal } : {}),
      ...(parsed.data.senderId ? { senderId: parsed.data.senderId } : {}),
      ...(parsed.data.senderName ? { senderName: parsed.data.senderName } : {}),
      ...(parsed.data.directionIds ? { directionIds: parsed.data.directionIds } : {}),
      ...(parsed.data.topK !== undefined ? { topK: parsed.data.topK } : {}),
      ...(parsed.data.maxPapersPerQuery !== undefined
        ? { maxPapersPerQuery: parsed.data.maxPapersPerQuery }
        : {}),
    };

    return reply.send(await researchDiscoverySchedulerService.configure(schedulerConfig));
  });

  app.post("/api/research/discovery/scheduler/tick", async () => {
    const results = await researchDiscoverySchedulerService.tick();
    return {
      results,
      status: await researchDiscoverySchedulerService.getStatus(),
    };
  });

  app.post("/api/research/discovery/run", async (request, reply) => {
    const parsed = DiscoveryRunRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid discovery run payload",
        issues: parsed.error.flatten()
      });
    }

    const result = await researchDiscoveryService.runDiscovery(parsed.data);
    return reply.code(201).send(result);
  });

  app.get("/api/research/source-items/:sourceItemId", async (request, reply) => {
    const parsedParams = SourceItemParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid source item id",
        issues: parsedParams.error.flatten()
      });
    }

    const item = await linkIngestionService.getItem(parsedParams.data.sourceItemId);
    if (!item) {
      return reply.code(404).send({
        message: "Source item not found"
      });
    }

    return reply.send(item);
  });

  app.get("/api/research/paper-reports/:reportId", async (request, reply) => {
    const parsedParams = PaperReportParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid paper report id",
        issues: parsedParams.error.flatten()
      });
    }

    const report = await paperAnalysisService.getReport(parsedParams.data.reportId);
    if (!report) {
      return reply.code(404).send({
        message: "Paper report not found"
      });
    }

    return reply.send(report);
  });

  app.get("/api/research/repo-reports/:reportId", async (request, reply) => {
    const parsedParams = RepoReportParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid repo report id",
        issues: parsedParams.error.flatten()
      });
    }

    const report = await repoAnalysisService.getReport(parsedParams.data.reportId);
    if (!report) {
      return reply.code(404).send({
        message: "Repo report not found"
      });
    }

    return reply.send(report);
  });

  app.get("/api/research/module-assets/:assetId", async (request, reply) => {
    const parsedParams = ModuleAssetParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid module asset id",
        issues: parsedParams.error.flatten()
      });
    }

    const asset = await moduleAssetService.getAsset(parsedParams.data.assetId);
    if (!asset) {
      return reply.code(404).send({
        message: "Module asset not found"
      });
    }

    return reply.send(asset);
  });

  app.get("/api/research/module-assets/recent", async (request, reply) => {
    const parsedQuery = RecentReportsQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid module asset query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      assets: await moduleAssetService.listRecent(parsedQuery.data.limit)
    });
  });

  app.get("/api/research/presentations/:presentationId", async (request, reply) => {
    const parsedParams = PresentationParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid presentation id",
        issues: parsedParams.error.flatten()
      });
    }

    const presentation = await presentationService.getPresentation(parsedParams.data.presentationId);
    if (!presentation) {
      return reply.code(404).send({
        message: "Presentation not found"
      });
    }

    return reply.send(presentation);
  });

  app.get("/api/research/presentations/recent", async (request, reply) => {
    const parsedQuery = RecentReportsQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid presentation query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      presentations: await presentationService.listRecent(parsedQuery.data.limit)
    });
  });

  app.get("/api/research/direction-reports/recent", async (request, reply) => {
    const parsedQuery = RecentReportsQuerySchema.safeParse(request.query ?? {});

    if (!parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid direction report query",
        issues: parsedQuery.error.flatten()
      });
    }

    return reply.send({
      reports: await directionReportService.listRecent(parsedQuery.data.limit)
    });
  });

  app.get("/api/research/direction-reports/:reportId", async (request, reply) => {
    const parsedParams = DirectionReportParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid direction report id",
        issues: parsedParams.error.flatten()
      });
    }

    const report = await directionReportService.getReport(parsedParams.data.reportId);
    if (!report) {
      return reply.code(404).send({
        message: "Direction report not found"
      });
    }

    return reply.send(report);
  });

  app.post("/api/research/direction-reports/generate", async (request, reply) => {
    const parsed = DirectionReportGenerateSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid direction report payload",
        issues: parsed.error.flatten()
      });
    }

    const report = await directionReportService.generate(parsed.data);
    return reply.code(201).send(report);
  });

  app.get("/api/research/directions/:directionId", async (request, reply) => {
    const parsedParams = DirectionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research direction id",
        issues: parsedParams.error.flatten()
      });
    }

    const profile = await researchDirectionService.getProfile(parsedParams.data.directionId);
    if (!profile) {
      return reply.code(404).send({
        message: "Research direction not found"
      });
    }

    return reply.send(profile);
  });

  app.get("/api/research/directions/:directionId/brief-markdown", async (request, reply) => {
    const parsedParams = DirectionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research direction id",
        issues: parsedParams.error.flatten()
      });
    }

    const markdown = await researchDirectionService.exportBriefMarkdown(parsedParams.data.directionId);
    if (!markdown) {
      return reply.code(404).send({
        message: "Research direction not found"
      });
    }

    reply.header("Content-Type", "text/markdown; charset=utf-8");
    return reply.send(markdown);
  });

  app.get("/api/research/directions/:directionId/plan", async (request, reply) => {
    const parsedParams = DirectionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research direction id",
        issues: parsedParams.error.flatten()
      });
    }

    const profile = await researchDirectionService.getProfile(parsedParams.data.directionId);
    if (!profile) {
      return reply.code(404).send({
        message: "Research direction not found"
      });
    }

    return reply.send({
      profile,
      candidates: await researchDirectionService.buildDiscoveryPlan(parsedParams.data.directionId)
    });
  });

  app.post("/api/research/directions", async (request, reply) => {
    const parsed = ResearchDirectionProfileSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid research direction payload",
        issues: parsed.error.flatten()
      });
    }

    const profile = await researchDirectionService.upsertProfile(parsed.data);
    return reply.code(201).send(profile);
  });

  app.post("/api/research/directions/import-markdown", async (request, reply) => {
    const parsed = DirectionBriefMarkdownImportSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid research brief markdown payload",
        issues: parsed.error.flatten()
      });
    }

    try {
      const profile = await researchDirectionService.importBriefMarkdown(parsed.data.markdown, {
        ...(parsed.data.id ? { id: parsed.data.id } : {}),
      });
      return reply.code(201).send(profile);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Failed to import research brief markdown"
      });
    }
  });

  app.delete("/api/research/directions/:directionId", async (request, reply) => {
    const parsedParams = DirectionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research direction id",
        issues: parsedParams.error.flatten()
      });
    }

    const deleted = await researchDirectionService.deleteProfile(parsedParams.data.directionId);
    if (!deleted) {
      return reply.code(404).send({
        message: "Research direction not found"
      });
    }

    return reply.code(204).send();
  });

  app.get("/api/research/:taskId", async (request, reply) => {
    const parsedParams = ResearchTaskParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        message: "Invalid research task id",
        issues: parsedParams.error.flatten()
      });
    }

    const report = await researchService.getReport(parsedParams.data.taskId);

    if (!report) {
      return reply.code(404).send({
        message: "Research report not found"
      });
    }

    const taskMeta = await researchTaskService.getTaskDetail(parsedParams.data.taskId);
    const handoff = taskMeta ? await researchRoundService.getHandoff(parsedParams.data.taskId) : null;

    return reply.send({
      ...report,
      ...(taskMeta ? { taskMeta: { ...taskMeta, handoff } } : {})
    });
  });

  app.post("/api/research", async (request, reply) => {
    const parsed = ResearchRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid research request",
        issues: parsed.error.flatten()
      });
    }

    const report = await researchService.runResearch(parsed.data);
    return reply.code(201).send(report);
  });
}
