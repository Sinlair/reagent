import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import { createPluginServices } from "./services.js";

function textToolResult(text: string, details?: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      }
    ],
    details: details ?? {}
  };
}

export function registerReAgentTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "reagent_direction_list",
    label: "ReAgent Direction List",
    description: "List configured research directions from the ReAgent plugin workspace.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    async execute() {
      const { directionService } = createPluginServices(api);
      const directions = await directionService.listProfiles();
      if (directions.length === 0) {
        return textToolResult("No research directions are configured.", { count: 0 });
      }

      return textToolResult(
        [
          "Research directions:",
          "",
          ...directions.map((item) => `- ${item.id}: ${item.label}${item.enabled ? "" : " (disabled)"}`)
        ].join("\n"),
        { count: directions.length, directions }
      );
    }
  });

  api.registerTool({
    name: "reagent_discovery_run",
    label: "ReAgent Discovery Run",
    description: "Run paper discovery for one direction or all enabled directions.",
    parameters: {
      type: "object",
      properties: {
        directionId: { type: "string", minLength: 1 },
        maxPapersPerQuery: { type: "integer", minimum: 1, maximum: 10 },
        topK: { type: "integer", minimum: 1, maximum: 10 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { discoveryService } = createPluginServices(api);
      const result = await discoveryService.runDiscovery({
        ...(typeof params.directionId === "string" && params.directionId.trim() ? { directionId: params.directionId.trim() } : {}),
        ...(typeof params.maxPapersPerQuery === "number" ? { maxPapersPerQuery: params.maxPapersPerQuery } : {}),
        ...(typeof params.topK === "number" ? { topK: params.topK } : {}),
      });

      return textToolResult(result.digest, {
        runId: result.runId,
        itemCount: result.items.length,
        directionIds: result.directionIds,
      });
    }
  });

  api.registerTool({
    name: "reagent_baseline_suggest",
    label: "ReAgent Baseline Suggest",
    description: "Suggest likely baselines, reusable modules, and innovation directions for a topic or direction.",
    parameters: {
      type: "object",
      properties: {
        directionId: { type: "string", minLength: 1 },
        topic: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { baselineService } = createPluginServices(api);
      const report = await baselineService.suggest({
        ...(typeof params.directionId === "string" && params.directionId.trim() ? { directionId: params.directionId.trim() } : {}),
        ...(typeof params.topic === "string" && params.topic.trim() ? { topic: params.topic.trim() } : {}),
      });

      return textToolResult(
        [
          `Baseline suggestion: ${report.topic}`,
          ...(report.baselines.length > 0
            ? [`Baselines: ${report.baselines.slice(0, 4).map((item: { title: string }) => item.title).join(", ")}`]
            : ["Baselines: none yet"]),
          ...(report.reusableModules.length > 0
            ? [`Modules: ${report.reusableModules.slice(0, 4).join(", ")}`]
            : []),
          ...(report.innovationSuggestions[0] ? [`Top route: ${report.innovationSuggestions[0]}`] : []),
        ].join("\n"),
        report
      );
    }
  });

  api.registerTool({
    name: "reagent_link_ingest",
    label: "ReAgent Link Ingest",
    description: "Ingest an article URL or raw text and extract paper and repository candidates.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        rawContent: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { linkIngestionService } = createPluginServices(api);
      const item = await linkIngestionService.ingest({
        ...(typeof params.url === "string" && params.url.trim() ? { url: params.url.trim() } : {}),
        ...(typeof params.rawContent === "string" && params.rawContent.trim() ? { rawContent: params.rawContent.trim() } : {}),
      });

      return textToolResult(
        [
          `Source item: ${item.id}`,
          ...(item.title ? [`Title: ${item.title}`] : []),
          `Paper candidates: ${item.paperCandidates.length}`,
          `Repo candidates: ${item.repoCandidates.length}`
        ].join("\n"),
        {
          id: item.id,
          paperCandidates: item.paperCandidates,
          repoCandidates: item.repoCandidates,
        }
      );
    }
  });

  api.registerTool({
    name: "reagent_paper_analyze",
    label: "ReAgent Paper Analyze",
    description: "Analyze a paper from a title, URL, or source item id.",
    parameters: {
      type: "object",
      properties: {
        sourceItemId: { type: "string", minLength: 1 },
        url: { type: "string", format: "uri" },
        title: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { paperAnalysisService } = createPluginServices(api);
      const report = await paperAnalysisService.analyze({
        ...(typeof params.sourceItemId === "string" && params.sourceItemId.trim() ? { sourceItemId: params.sourceItemId.trim() } : {}),
        ...(typeof params.url === "string" && params.url.trim() ? { url: params.url.trim() } : {}),
        ...(typeof params.title === "string" && params.title.trim() ? { title: params.title.trim() } : {}),
      });

      return textToolResult(
        [
          `Paper: ${report.paper.title}`,
          `Recommendation: ${report.recommendation}`,
          `Core method: ${report.coreMethod}`,
          ...(report.innovationPoints[0] ? [`Top innovation: ${report.innovationPoints[0]}`] : [])
        ].join("\n"),
        report
      );
    }
  });

  api.registerTool({
    name: "reagent_repo_analyze",
    label: "ReAgent Repo Analyze",
    description: "Analyze a GitHub repository related to a paper or article.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        contextTitle: { type: "string", minLength: 1 }
      },
      required: ["url"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { repoAnalysisService } = createPluginServices(api);
      const report = await repoAnalysisService.analyze({
        url: String(params.url),
        ...(typeof params.contextTitle === "string" && params.contextTitle.trim() ? { contextTitle: params.contextTitle.trim() } : {}),
      });

      return textToolResult(
        [
          `Repo: ${report.owner}/${report.repo}`,
          `Official: ${String(report.likelyOfficial)}`,
          ...(report.stars != null ? [`Stars: ${report.stars}`] : []),
          ...(report.keyPaths.length > 0 ? [`Key paths: ${report.keyPaths.join(", ")}`] : [])
        ].join("\n"),
        report
      );
    }
  });

  api.registerTool({
    name: "reagent_module_extract",
    label: "ReAgent Module Extract",
    description: "Download a GitHub repository archive and record reusable module paths for later reuse.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", format: "uri" },
        contextTitle: { type: "string", minLength: 1 },
        selectedPaths: { type: "array", items: { type: "string", minLength: 1 } }
      },
      required: ["url"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { moduleAssetService } = createPluginServices(api);
      const asset = await moduleAssetService.extract({
        url: String(params.url),
        ...(typeof params.contextTitle === "string" && params.contextTitle.trim() ? { contextTitle: params.contextTitle.trim() } : {}),
        ...(Array.isArray(params.selectedPaths)
          ? {
              selectedPaths: params.selectedPaths
                .map((item: unknown) => String(item).trim())
                .filter(Boolean)
            }
          : {}),
      });

      return textToolResult(
        [
          `Module asset: ${asset.id}`,
          `Repo: ${asset.owner}/${asset.repo}`,
          ...(asset.defaultBranch ? [`Default branch: ${asset.defaultBranch}`] : []),
          ...(asset.selectedPaths.length > 0 ? [`Selected paths: ${asset.selectedPaths.join(", ")}`] : []),
        ].join("\n"),
        asset
      );
    }
  });

  api.registerTool({
    name: "reagent_novelty_check",
    label: "ReAgent Novelty Check",
    description: "Check whether an idea or topic appears likely novel based on nearby papers.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 }
      },
      required: ["query"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { noveltyService } = createPluginServices(api);
      const result = await noveltyService.check({ query: String(params.query) });

      return textToolResult(
        [
          `Query: ${result.query}`,
          `Verdict: ${result.verdict}`,
          result.summary
        ].join("\n"),
        result
      );
    }
  });

  api.registerTool({
    name: "reagent_feedback_record",
    label: "ReAgent Feedback Record",
    description: "Record explicit user feedback about paper quality, direction preference, or recommendation usefulness.",
    parameters: {
      type: "object",
      properties: {
        feedback: {
          type: "string",
          enum: [
            "useful",
            "not-useful",
            "more-like-this",
            "less-like-this",
            "too-theoretical",
            "too-engineering-heavy",
            "worth-following",
            "not-worth-following"
          ]
        },
        senderId: { type: "string", minLength: 1 },
        senderName: { type: "string", minLength: 1 },
        directionId: { type: "string", minLength: 1 },
        topic: { type: "string", minLength: 1 },
        paperTitle: { type: "string", minLength: 1 },
        venue: { type: "string", minLength: 1 },
        sourceUrl: { type: "string", format: "uri" },
        notes: { type: "string", minLength: 1 }
      },
      required: ["feedback"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { feedbackService } = createPluginServices(api);
      const record = await feedbackService.record({
        feedback: String(params.feedback) as
          | "useful"
          | "not-useful"
          | "more-like-this"
          | "less-like-this"
          | "too-theoretical"
          | "too-engineering-heavy"
          | "worth-following"
          | "not-worth-following",
        ...(typeof params.senderId === "string" && params.senderId.trim() ? { senderId: params.senderId.trim() } : {}),
        ...(typeof params.senderName === "string" && params.senderName.trim() ? { senderName: params.senderName.trim() } : {}),
        ...(typeof params.directionId === "string" && params.directionId.trim() ? { directionId: params.directionId.trim() } : {}),
        ...(typeof params.topic === "string" && params.topic.trim() ? { topic: params.topic.trim() } : {}),
        ...(typeof params.paperTitle === "string" && params.paperTitle.trim() ? { paperTitle: params.paperTitle.trim() } : {}),
        ...(typeof params.venue === "string" && params.venue.trim() ? { venue: params.venue.trim() } : {}),
        ...(typeof params.sourceUrl === "string" && params.sourceUrl.trim() ? { sourceUrl: params.sourceUrl.trim() } : {}),
        ...(typeof params.notes === "string" && params.notes.trim() ? { notes: params.notes.trim() } : {}),
      });

      return textToolResult(
        [
          `Recorded feedback: ${record.feedback}`,
          ...(record.topic ? [`Topic: ${record.topic}`] : []),
          ...(record.directionId ? [`Direction: ${record.directionId}`] : []),
        ].join("\n"),
        record
      );
    }
  });

  api.registerTool({
    name: "reagent_direction_report_generate",
    label: "ReAgent Direction Report",
    description: "Generate a reusable direction report with representative papers, baselines, modules, and suggested routes.",
    parameters: {
      type: "object",
      properties: {
        directionId: { type: "string", minLength: 1 },
        topic: { type: "string", minLength: 1 },
        days: { type: "integer", minimum: 1, maximum: 30 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { directionReportService } = createPluginServices(api);
      const report = await directionReportService.generate({
        ...(typeof params.directionId === "string" && params.directionId.trim() ? { directionId: params.directionId.trim() } : {}),
        ...(typeof params.topic === "string" && params.topic.trim() ? { topic: params.topic.trim() } : {}),
        ...(typeof params.days === "number" ? { days: params.days } : {}),
      });

      return textToolResult(
        [
          `Direction report: ${report.topic}`,
          report.overview
        ].join("\n"),
        report
      );
    }
  });

  api.registerTool({
    name: "reagent_direction_report_recent",
    label: "ReAgent Direction Reports",
    description: "List recent reusable direction reports from the plugin workspace.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 20 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { directionReportService } = createPluginServices(api);
      const reports = await directionReportService.listRecent(
        typeof params.limit === "number" ? params.limit : 5
      );

      return textToolResult(
        reports.length
          ? [
              "Recent direction reports:",
              ...reports.map((report) => `- ${report.id}: ${report.topic}`),
            ].join("\n")
          : "No direction reports are available yet.",
        { count: reports.length, reports }
      );
    }
  });

  api.registerTool({
    name: "reagent_direction_report_get",
    label: "ReAgent Direction Report Detail",
    description: "Get one reusable direction report by id.",
    parameters: {
      type: "object",
      properties: {
        reportId: { type: "string", minLength: 1 }
      },
      required: ["reportId"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { directionReportService } = createPluginServices(api);
      const report = await directionReportService.getReport(String(params.reportId));
      if (!report) {
        return textToolResult("Direction report not found.", { reportId: params.reportId, found: false });
      }

      return textToolResult(
        [
          `Direction report: ${report.topic}`,
          report.overview,
          ...(report.commonBaselines.length ? [`Baselines: ${report.commonBaselines.slice(0, 4).join(", ")}`] : []),
          ...(report.commonModules.length ? [`Modules: ${report.commonModules.slice(0, 4).join(", ")}`] : []),
        ].join("\n"),
        report
      );
    }
  });

  api.registerTool({
    name: "reagent_presentation_generate",
    label: "ReAgent Presentation Generate",
    description: "Generate a markdown and pptx meeting deck from recent direction reports.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", minimum: 1, maximum: 30 },
        topic: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { presentationService } = createPluginServices(api);
      const result = await presentationService.generateWeeklyPresentation({
        ...(typeof params.days === "number" ? { days: params.days } : {}),
        ...(typeof params.topic === "string" && params.topic.trim() ? { topic: params.topic.trim() } : {}),
      });

      return textToolResult(
        [
          `Presentation: ${result.title}`,
          `Source reports: ${result.sourceReportTaskIds.length}`,
          `Markdown: ${result.filePath}`,
          ...(result.pptxPath ? [`PPTX: ${result.pptxPath}`] : []),
        ].join("\n"),
        result
      );
    }
  });

  api.registerTool({
    name: "reagent_presentation_recent",
    label: "ReAgent Presentations",
    description: "List recent presentation artifacts from the plugin workspace.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 20 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { presentationService } = createPluginServices(api);
      const presentations = await presentationService.listRecent(
        typeof params.limit === "number" ? params.limit : 5
      );

      return textToolResult(
        presentations.length
          ? [
              "Recent presentations:",
              ...presentations.map((item) => `- ${item.id}: ${item.title}`),
            ].join("\n")
          : "No presentations are available yet.",
        { count: presentations.length, presentations }
      );
    }
  });

  api.registerTool({
    name: "reagent_presentation_get",
    label: "ReAgent Presentation Detail",
    description: "Get one presentation artifact by id.",
    parameters: {
      type: "object",
      properties: {
        presentationId: { type: "string", minLength: 1 }
      },
      required: ["presentationId"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { presentationService } = createPluginServices(api);
      const presentation = await presentationService.getPresentation(String(params.presentationId));
      if (!presentation) {
        return textToolResult("Presentation not found.", { presentationId: params.presentationId, found: false });
      }

      return textToolResult(
        [
          `Presentation: ${presentation.title}`,
          `Generated: ${presentation.generatedAt}`,
          `Markdown: ${presentation.filePath}`,
          ...(presentation.pptxPath ? [`PPTX: ${presentation.pptxPath}`] : []),
        ].join("\n"),
        presentation
      );
    }
  });

  api.registerTool({
    name: "reagent_module_asset_recent",
    label: "ReAgent Module Assets",
    description: "List recent reusable module assets from the plugin workspace.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 20 }
      },
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { moduleAssetService } = createPluginServices(api);
      const assets = await moduleAssetService.listRecent(
        typeof params.limit === "number" ? params.limit : 5
      );

      return textToolResult(
        assets.length
          ? [
              "Recent module assets:",
              ...assets.map((asset) => `- ${asset.id}: ${asset.owner}/${asset.repo}`),
            ].join("\n")
          : "No module assets are available yet.",
        { count: assets.length, assets }
      );
    }
  });

  api.registerTool({
    name: "reagent_module_asset_get",
    label: "ReAgent Module Asset Detail",
    description: "Get one reusable module asset by id.",
    parameters: {
      type: "object",
      properties: {
        assetId: { type: "string", minLength: 1 }
      },
      required: ["assetId"],
      additionalProperties: false
    },
    async execute(_toolCallId, params) {
      const { moduleAssetService } = createPluginServices(api);
      const asset = await moduleAssetService.getAsset(String(params.assetId));
      if (!asset) {
        return textToolResult("Module asset not found.", { assetId: params.assetId, found: false });
      }

      return textToolResult(
        [
          `Module asset: ${asset.id}`,
          `Repo: ${asset.owner}/${asset.repo}`,
          ...(asset.selectedPaths.length ? [`Selected paths: ${asset.selectedPaths.join(", ")}`] : []),
          ...(asset.archivePath ? [`Archive: ${asset.archivePath}`] : []),
        ].join("\n"),
        asset
      );
    }
  });
}
