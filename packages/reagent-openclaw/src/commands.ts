import type { OpenClawPluginApi, PluginCommandContext } from "openclaw/plugin-sdk/core";

import { createPluginServices } from "./services.js";

function textReply(text: string) {
  return { text };
}

function splitArgs(args?: string): string[] {
  return (args?.trim() ?? "").split(/\s+/u).filter(Boolean);
}

function blockToText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function registerReAgentCommands(api: OpenClawPluginApi): void {
  api.registerCommand({
    name: "reagent-status",
    description: "Show ReAgent plugin status.",
    acceptsArgs: false,
    handler: async () => {
      const { workspaceDir, directionService, feedbackService, discoveryService } = createPluginServices(api);
      const [directions, feedback, runs] = await Promise.all([
        directionService.listProfiles(),
        feedbackService.getSummary(5),
        discoveryService.listRecentRuns(5),
      ]);

      return textReply([
        "ReAgent plugin status",
        `Workspace: ${workspaceDir}`,
        `Directions: ${directions.length}`,
        `Feedback items: ${feedback.total}`,
        `Recent discovery runs: ${runs.length}`,
      ].join("\n"));
    }
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
}
