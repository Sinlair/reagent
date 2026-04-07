import path from "node:path";

import {
  ResearchDirectionService,
  ResearchDiscoveryService,
  ResearchFeedbackService,
  ResearchLinkIngestionService,
  ResearchNoveltyService,
  ResearchPaperAnalysisService,
  ResearchRepoAnalysisService,
} from "@sinlair/reagent-core";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { ReAgentPluginConfig } from "./config.js";

export function resolvePluginStateDir(api: OpenClawPluginApi): string {
  return path.join(api.runtime.state.resolveStateDir(process.env), "plugins", "reagent-openclaw");
}

export function createPluginServices(api: OpenClawPluginApi): {
  workspaceDir: string;
  config: ReAgentPluginConfig;
  directionService: ResearchDirectionService;
  feedbackService: ResearchFeedbackService;
  discoveryService: ResearchDiscoveryService;
  linkIngestionService: ResearchLinkIngestionService;
  noveltyService: ResearchNoveltyService;
  paperAnalysisService: ResearchPaperAnalysisService;
  repoAnalysisService: ResearchRepoAnalysisService;
} {
  const workspaceDir = resolvePluginStateDir(api);
  const config = (api.pluginConfig ?? {}) as ReAgentPluginConfig;
  const directionService = new ResearchDirectionService(workspaceDir);
  const feedbackService = new ResearchFeedbackService(workspaceDir);
  const discoveryService = new ResearchDiscoveryService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
    feedbackService,
  });
  const linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
  const noveltyService = new ResearchNoveltyService({
    crossrefMailto: config.crossrefMailto,
  });
  const paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
  });
  const repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);

  return {
    workspaceDir,
    config,
    directionService,
    feedbackService,
    discoveryService,
    linkIngestionService,
    noveltyService,
    paperAnalysisService,
    repoAnalysisService,
  };
}
