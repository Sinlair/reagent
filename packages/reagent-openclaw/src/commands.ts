import type { MemoryRecallHit } from "@sinlair/reagent-core";
import type { OpenClawPluginApi, PluginCommandContext } from "openclaw/plugin-sdk/core";

import {
  createPluginMemoryService,
  createPluginMemoryRecallService,
  createPluginServices,
  resolveConversationMemoryScopeKey,
} from "./services.js";

function textReply(text: string) {
  return { text };
}

function splitArgs(args?: string): string[] {
  return (args?.trim() ?? "").split(/\s+/u).filter(Boolean);
}

function blockToText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildMemoryScopeLabel(scope: "workspace" | "conversation", senderId?: string): string {
  return scope === "conversation" && senderId?.trim()
    ? `conversation:${senderId.trim()}`
    : "workspace";
}

function buildMemorySearchReply(scopeLabel: string, query: string, hits: MemoryRecallHit[]): string {
  if (hits.length === 0) {
    return `No memory hits found for "${query}" in ${scopeLabel}.`;
  }

  return [
    `Memory hits for "${query}" in ${scopeLabel}:`,
    "",
    ...hits.map(
      (item) =>
        `- [${item.layer}] ${item.title}${item.path ? ` | ${item.path}` : item.artifactType ? ` | ${item.artifactType}` : ""}\n  ${item.snippet}\n  provenance=${item.provenance} confidence=${item.confidence}`,
    ),
  ].join("\n");
}

function resolveConversationScopeKey(ctx: PluginCommandContext): string | null {
  const senderId = ctx.senderId?.trim();
  if (!senderId) {
    return null;
  }

  const accountId =
    typeof (ctx as { accountId?: unknown }).accountId === "string" &&
    (ctx as { accountId?: string }).accountId?.trim()
      ? (ctx as { accountId?: string }).accountId?.trim()
      : undefined;

  return resolveConversationMemoryScopeKey(accountId ? `${accountId}:${senderId}` : senderId);
}

export function registerReAgentCommands(api: OpenClawPluginApi): void {
  api.registerCommand({
    name: "reagent-status",
    description: "Show ReAgent plugin status.",
    acceptsArgs: false,
    handler: async () => {
      const { workspaceDir, memoryService, directionService, feedbackService, discoveryService } =
        createPluginServices(api);
      const [memoryStatus, directions, feedback, runs] = await Promise.all([
        memoryService.getStatus(),
        directionService.listProfiles(),
        feedbackService.getSummary(5),
        discoveryService.listRecentRuns(5),
      ]);

      return textReply([
        "ReAgent plugin status",
        `Workspace: ${workspaceDir}`,
        `Workspace memory files: ${memoryStatus.files}`,
        `Directions: ${directions.length}`,
        `Feedback items: ${feedback.total}`,
        `Recent discovery runs: ${runs.length}`,
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-memory",
    description: "Search conversation-scoped ReAgent memory for the current sender.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const query = ctx.args?.trim();
      if (!query) {
        return textReply("Usage: /reagent-memory <query>");
      }

      const scopeKey = resolveConversationScopeKey(ctx);
      if (!scopeKey) {
        return textReply("Conversation-scoped memory requires a sender context.");
      }

      const memoryService = createPluginMemoryService(api, {
        scope: "conversation",
        scopeKey,
      });
      const recall = createPluginMemoryRecallService(api, {
        scope: "conversation",
        scopeKey,
      });
      const hits = (await recall.recall(query, {
        limit: 6,
        includeConversation: true,
        includeWorkspace: true,
        includeArtifacts: true,
      })).hits;
      return textReply(buildMemorySearchReply(buildMemoryScopeLabel("conversation", ctx.senderId), query, hits));
    },
  });

  api.registerCommand({
    name: "reagent-memory-workspace",
    description: "Search shared ReAgent workspace memory.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const query = ctx.args?.trim();
      if (!query) {
        return textReply("Usage: /reagent-memory-workspace <query>");
      }

      const recall = createPluginMemoryRecallService(api);
      const hits = (await recall.recall(query, {
        limit: 6,
        includeConversation: false,
        includeWorkspace: true,
        includeArtifacts: true,
      })).hits;
      return textReply(buildMemorySearchReply(buildMemoryScopeLabel("workspace"), query, hits));
    },
  });

  api.registerCommand({
    name: "reagent-remember",
    description: "Save a note into conversation-scoped ReAgent memory for the current sender.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const content = ctx.args?.trim();
      if (!content) {
        return textReply("Usage: /reagent-remember <note>");
      }

      const scopeKey = resolveConversationScopeKey(ctx);
      if (!scopeKey) {
        return textReply("Conversation-scoped memory requires a sender context.");
      }

      const memoryService = createPluginMemoryService(api, {
        scope: "conversation",
        scopeKey,
      });
      const saved = await memoryService.remember({
        scope: "daily",
        title: "Conversation Note",
        content,
        source: "openclaw-command:conversation",
        sourceType: "user-stated",
        confidence: "medium",
        tags: ["conversation-memory"],
      });

      return textReply(
        `Saved to ${buildMemoryScopeLabel("conversation", ctx.senderId)} memory: ${saved.path}`,
      );
    },
  });

  api.registerCommand({
    name: "reagent-remember-workspace",
    description: "Save a note into shared ReAgent workspace memory.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const content = ctx.args?.trim();
      if (!content) {
        return textReply("Usage: /reagent-remember-workspace <note>");
      }

      const memoryService = createPluginMemoryService(api);
      const saved = await memoryService.remember({
        scope: "daily",
        title: "Workspace Note",
        content,
        source: "openclaw-command:workspace",
        sourceType: "user-stated",
        confidence: "medium",
        tags: ["workspace-memory"],
      });

      return textReply(`Saved to workspace memory: ${saved.path}`);
    },
  });

  api.registerCommand({
    name: "reagent-directions",
    description: "List known research directions.",
    acceptsArgs: false,
    handler: async () => {
      const { directionService } = createPluginServices(api);
      const directions = await directionService.listProfiles();
      if (directions.length === 0) {
        return textReply("No research directions are configured.");
      }

      return textReply([
        "Research directions:",
        "",
        ...directions.map((item) => `- ${item.id}: ${item.label}${item.enabled ? "" : " (disabled)"}`)
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-direction-add",
    description: "Add a research direction by label.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const label = ctx.args?.trim();
      if (!label) {
        return textReply("Usage: /reagent-direction-add <label>");
      }

      const { directionService } = createPluginServices(api);
      const profile = await directionService.upsertProfile({ label });
      return textReply(`Added direction: ${profile.label} (${profile.id})`);
    }
  });

  api.registerCommand({
    name: "reagent-direction-remove",
    description: "Remove a research direction by id.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const directionId = ctx.args?.trim();
      if (!directionId) {
        return textReply("Usage: /reagent-direction-remove <directionId>");
      }

      const { directionService } = createPluginServices(api);
      const deleted = await directionService.deleteProfile(directionId);
      return textReply(deleted ? `Removed direction: ${directionId}` : `Direction not found: ${directionId}`);
    }
  });

  api.registerCommand({
    name: "reagent-discover",
    description: "Run ReAgent paper discovery for all enabled directions or one direction id.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const directionId = ctx.args?.trim() || undefined;
      const { discoveryService } = createPluginServices(api);
      const result = await discoveryService.runDiscovery({
        ...(directionId ? { directionId } : {}),
      });
      return textReply(result.digest);
    }
  });

  api.registerCommand({
    name: "reagent-runs",
    description: "List recent ReAgent discovery runs.",
    acceptsArgs: false,
    handler: async () => {
      const { discoveryService } = createPluginServices(api);
      const runs = await discoveryService.listRecentRuns(10);
      if (runs.length === 0) {
        return textReply("No discovery runs yet.");
      }

      return textReply([
        "Recent discovery runs:",
        "",
        ...runs.map((run) => `- ${run.runId}: ${run.directionLabels.join(", ")} | items=${run.itemCount}${run.topTitle ? ` | top=${run.topTitle}` : ""}`)
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-feedback",
    description: "Record a research feedback signal.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const [feedback, ...rest] = splitArgs(ctx.args);
      if (!feedback) {
        return textReply("Usage: /reagent-feedback <useful|not-useful|more-like-this|less-like-this|too-theoretical|too-engineering-heavy|worth-following|not-worth-following> [notes]");
      }

      const allowed = new Set([
        "useful",
        "not-useful",
        "more-like-this",
        "less-like-this",
        "too-theoretical",
        "too-engineering-heavy",
        "worth-following",
        "not-worth-following",
      ]);

      if (!allowed.has(feedback)) {
        return textReply("Unsupported feedback signal.");
      }

      const { feedbackService } = createPluginServices(api);
      const record = await feedbackService.record({
        feedback: feedback as
          | "useful"
          | "not-useful"
          | "more-like-this"
          | "less-like-this"
          | "too-theoretical"
          | "too-engineering-heavy"
          | "worth-following"
          | "not-worth-following",
        ...(ctx.senderId?.trim() ? { senderId: ctx.senderId.trim() } : {}),
        ...(rest.length > 0 ? { notes: rest.join(" ").trim() } : {}),
      });

      return textReply(`Recorded feedback: ${record.feedback}`);
    }
  });

  api.registerCommand({
    name: "reagent-baseline-suggest",
    description: "Suggest likely baselines and reusable modules for a direction or topic.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const raw = ctx.args?.trim();
      if (!raw) {
        return textReply("Usage: /reagent-baseline-suggest <directionId-or-topic>");
      }

      const { baselineService, directionService } = createPluginServices(api);
      const knownDirection = await directionService.getProfile(raw);
      const report = await baselineService.suggest(
        knownDirection
          ? { directionId: knownDirection.id }
          : { topic: raw }
      );

      return textReply([
        `Baseline suggestion: ${report.topic}`,
        ...(report.baselines.length > 0
          ? [`Baselines: ${report.baselines.slice(0, 4).map((item: { title: string }) => item.title).join(", ")}`]
          : ["Baselines: none yet"]),
        ...(report.reusableModules.length > 0
          ? [`Modules: ${report.reusableModules.slice(0, 4).join(", ")}`]
          : []),
        ...(report.innovationSuggestions[0] ? [`Top route: ${report.innovationSuggestions[0]}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-link-ingest",
    description: "Ingest an article link or raw text and extract paper and GitHub candidates.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const raw = ctx.args?.trim();
      if (!raw) {
        return textReply("Usage: /reagent-link-ingest <url-or-text>");
      }

      const { linkIngestionService } = createPluginServices(api);
      const item = await linkIngestionService.ingest(
        /^https?:\/\//iu.test(raw)
          ? { url: raw }
          : { rawContent: raw }
      );

      return textReply([
        `Source item: ${item.id}`,
        ...(item.title ? [`Title: ${item.title}`] : []),
        `Paper candidates: ${item.paperCandidates.length}`,
        `Repo candidates: ${item.repoCandidates.length}`,
        ...(item.paperCandidates[0]?.url ? [`Top paper: ${item.paperCandidates[0].url}`] : []),
        ...(item.repoCandidates[0]?.url ? [`Top repo: ${item.repoCandidates[0].url}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-paper-analyze",
    description: "Analyze a paper from a title, article URL, arXiv URL, or stored source item id.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const raw = ctx.args?.trim();
      if (!raw) {
        return textReply("Usage: /reagent-paper-analyze <title|url|sourceItemId>");
      }

      const { paperAnalysisService } = createPluginServices(api);
      const report = await paperAnalysisService.analyze(
        /^https?:\/\//iu.test(raw)
          ? { url: raw }
          : /^source[-_:]/iu.test(raw) || /^[a-f0-9-]{8,}$/iu.test(raw)
            ? { sourceItemId: raw }
            : { title: raw }
      );

      return textReply([
        `Paper: ${report.paper.title}`,
        `Recommendation: ${report.recommendation}`,
        `Core method: ${report.coreMethod}`,
        `Innovation points: ${report.innovationPoints.length}`,
        `Repo candidates: ${report.repoCandidates.length}`,
        ...(report.innovationPoints[0] ? [`Top innovation: ${report.innovationPoints[0]}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-repo-analyze",
    description: "Analyze a GitHub repository linked to a paper or article.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const raw = ctx.args?.trim();
      if (!raw) {
        return textReply("Usage: /reagent-repo-analyze <github-url> [context-title]");
      }

      const tokens = splitArgs(raw);
      const url = tokens[0];
      const contextTitle = tokens.slice(1).join(" ").trim() || undefined;
      if (!url || !/^https?:\/\/github\.com\//iu.test(url)) {
        return textReply("A valid GitHub repository URL is required.");
      }

      const { repoAnalysisService } = createPluginServices(api);
      const report = await repoAnalysisService.analyze({ url, ...(contextTitle ? { contextTitle } : {}) });

      return textReply([
        `Repo: ${report.owner}/${report.repo}`,
        `Official: ${String(report.likelyOfficial)}`,
        ...(report.stars != null ? [`Stars: ${report.stars}`] : []),
        ...(report.defaultBranch ? [`Default branch: ${report.defaultBranch}`] : []),
        ...(report.keyPaths.length > 0 ? [`Key paths: ${report.keyPaths.join(", ")}`] : []),
        ...report.notes.slice(0, 3),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-module-extract",
    description: "Download a GitHub repository archive and record reusable module paths.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const raw = ctx.args?.trim();
      if (!raw) {
        return textReply("Usage: /reagent-module-extract <github-url> [context-title]");
      }

      const tokens = splitArgs(raw);
      const url = tokens[0];
      const contextTitle = tokens.slice(1).join(" ").trim() || undefined;
      if (!url || !/^https?:\/\/github\.com\//iu.test(url)) {
        return textReply("A valid GitHub repository URL is required.");
      }

      const { moduleAssetService } = createPluginServices(api);
      const asset = await moduleAssetService.extract({ url, ...(contextTitle ? { contextTitle } : {}) });

      return textReply([
        `Module asset: ${asset.id}`,
        `Repo: ${asset.owner}/${asset.repo}`,
        ...(asset.defaultBranch ? [`Default branch: ${asset.defaultBranch}`] : []),
        ...(asset.selectedPaths.length > 0 ? [`Selected paths: ${asset.selectedPaths.join(", ")}`] : []),
        ...(asset.archivePath ? [`Archive: ${asset.archivePath}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-novelty-check",
    description: "Check whether a research idea appears likely novel based on nearby papers.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const query = ctx.args?.trim();
      if (!query) {
        return textReply("Usage: /reagent-novelty-check <idea-or-topic>");
      }

      const { noveltyService } = createPluginServices(api);
      const result = await noveltyService.check({ query });

      return textReply([
        `Query: ${result.query}`,
        `Verdict: ${result.verdict}`,
        result.summary,
        ...(result.candidates.length > 0
          ? [
              "",
              "Nearest papers:",
              ...result.candidates.map((candidate) =>
                `- ${candidate.paper.title} | score=${candidate.overlapScore}${candidate.overlapTerms.length ? ` | overlap=${candidate.overlapTerms.join(", ")}` : ""}`
              ),
            ]
          : [])
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-direction-report",
    description: "Generate a direction report from recent papers, baselines, and repos.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const raw = ctx.args?.trim();
      if (!raw) {
        return textReply("Usage: /reagent-direction-report <directionId-or-topic>");
      }

      const { directionReportService, directionService } = createPluginServices(api);
      const knownDirection = await directionService.getProfile(raw);
      const report = await directionReportService.generate(
        knownDirection
          ? { directionId: knownDirection.id }
          : { topic: raw }
      );

      return textReply([
        `Direction report: ${report.topic}`,
        report.overview,
        ...(report.representativePapers[0] ? [`Top paper: ${report.representativePapers[0].title}`] : []),
        ...(report.commonBaselines.length > 0 ? [`Baselines: ${report.commonBaselines.slice(0, 3).join(", ")}`] : []),
        ...(report.commonModules.length > 0 ? [`Modules: ${report.commonModules.slice(0, 3).join(", ")}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-direction-reports",
    description: "List recent direction reports.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const limit = Number.parseInt(ctx.args?.trim() || "5", 10);
      const { directionReportService } = createPluginServices(api);
      const reports = await directionReportService.listRecent(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 5);
      if (reports.length === 0) {
        return textReply("No direction reports are available yet.");
      }

      return textReply([
        "Recent direction reports:",
        ...reports.map((report) => `- ${report.id}: ${report.topic}`),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-direction-report-get",
    description: "Get one direction report by id.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const reportId = ctx.args?.trim();
      if (!reportId) {
        return textReply("Usage: /reagent-direction-report-get <reportId>");
      }

      const { directionReportService } = createPluginServices(api);
      const report = await directionReportService.getReport(reportId);
      if (!report) {
        return textReply(`Direction report not found: ${reportId}`);
      }

      return textReply([
        `Direction report: ${report.topic}`,
        report.overview,
        ...(report.commonBaselines.length ? [`Baselines: ${report.commonBaselines.slice(0, 4).join(", ")}`] : []),
        ...(report.commonModules.length ? [`Modules: ${report.commonModules.slice(0, 4).join(", ")}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-presentation-generate",
    description: "Generate a markdown and pptx meeting deck from recent direction reports.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const topic = ctx.args?.trim() || undefined;
      const { presentationService } = createPluginServices(api);
      const result = await presentationService.generateWeeklyPresentation(
        topic ? { topic } : {}
      );

      return textReply([
        `Presentation: ${result.title}`,
        `Source reports: ${result.sourceReportTaskIds.length}`,
        `Markdown: ${result.filePath}`,
        ...(result.pptxPath ? [`PPTX: ${result.pptxPath}`] : []),
        ...(result.imagePaths.length > 0 ? [`Images: ${result.imagePaths.length}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-presentations",
    description: "List recent presentation artifacts.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const limit = Number.parseInt(ctx.args?.trim() || "5", 10);
      const { presentationService } = createPluginServices(api);
      const presentations = await presentationService.listRecent(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 5);
      if (presentations.length === 0) {
        return textReply("No presentations are available yet.");
      }

      return textReply([
        "Recent presentations:",
        ...presentations.map((item) => `- ${item.id}: ${item.title}`),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-presentation-get",
    description: "Get one presentation artifact by id.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const presentationId = ctx.args?.trim();
      if (!presentationId) {
        return textReply("Usage: /reagent-presentation-get <presentationId>");
      }

      const { presentationService } = createPluginServices(api);
      const presentation = await presentationService.getPresentation(presentationId);
      if (!presentation) {
        return textReply(`Presentation not found: ${presentationId}`);
      }

      return textReply([
        `Presentation: ${presentation.title}`,
        `Generated: ${presentation.generatedAt}`,
        `Markdown: ${presentation.filePath}`,
        ...(presentation.pptxPath ? [`PPTX: ${presentation.pptxPath}`] : []),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-module-assets",
    description: "List recent module assets.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const limit = Number.parseInt(ctx.args?.trim() || "5", 10);
      const { moduleAssetService } = createPluginServices(api);
      const assets = await moduleAssetService.listRecent(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 5);
      if (assets.length === 0) {
        return textReply("No module assets are available yet.");
      }

      return textReply([
        "Recent module assets:",
        ...assets.map((asset) => `- ${asset.id}: ${asset.owner}/${asset.repo}`),
      ].join("\n"));
    }
  });

  api.registerCommand({
    name: "reagent-module-asset-get",
    description: "Get one module asset by id.",
    acceptsArgs: true,
    handler: async (ctx: PluginCommandContext) => {
      const assetId = ctx.args?.trim();
      if (!assetId) {
        return textReply("Usage: /reagent-module-asset-get <assetId>");
      }

      const { moduleAssetService } = createPluginServices(api);
      const asset = await moduleAssetService.getAsset(assetId);
      if (!asset) {
        return textReply(`Module asset not found: ${assetId}`);
      }

      return textReply([
        `Module asset: ${asset.id}`,
        `Repo: ${asset.owner}/${asset.repo}`,
        ...(asset.selectedPaths.length ? [`Selected paths: ${asset.selectedPaths.join(", ")}`] : []),
        ...(asset.archivePath ? [`Archive: ${asset.archivePath}`] : []),
      ].join("\n"));
    }
  });
}
