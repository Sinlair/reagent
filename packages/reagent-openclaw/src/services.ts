import path from "node:path";

import {
  MemoryCompactionService,
  MemoryService,
  MemoryRecallService,
  ResearchBaselineService,
  ResearchDirectionService,
  ResearchDirectionReportService,
  ResearchDiscoveryService,
  ResearchFeedbackService,
  ResearchLinkIngestionService,
  ResearchModuleAssetService,
  ResearchNoveltyService,
  ResearchPaperAnalysisService,
  ResearchPresentationService,
  ResearchRepoAnalysisService,
} from "@sinlair/reagent-core";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

import type { ReAgentPluginConfig } from "./config.js";

export type ReAgentMemoryScope = "workspace" | "conversation";

export interface ReAgentMemoryScopeOptions {
  scope?: ReAgentMemoryScope | undefined;
  scopeKey?: string | undefined;
}

export function resolvePluginStateDir(api: OpenClawPluginApi): string {
  return path.join(api.runtime.state.resolveStateDir(process.env), "plugins", "reagent-openclaw");
}

export function resolveConversationMemoryScopeKey(senderId: string): string {
  return `openclaw-peer:${senderId.trim()}`;
}

export function createPluginMemoryService(
  api: OpenClawPluginApi,
  options: ReAgentMemoryScopeOptions = {},
): MemoryService {
  const workspaceDir = resolvePluginStateDir(api);
  const scope = options.scope ?? "workspace";
  const scopeKey = scope === "conversation" ? options.scopeKey?.trim() || undefined : undefined;
  return new MemoryService(workspaceDir, scopeKey ? { scopeKey } : {});
}

export function createPluginMemoryRecallService(
  api: OpenClawPluginApi,
  options: ReAgentMemoryScopeOptions = {},
): MemoryRecallService {
  const workspaceDir = resolvePluginStateDir(api);
  const scope = options.scope ?? "workspace";
  const scopeKey = scope === "conversation" ? options.scopeKey?.trim() || undefined : undefined;
  return new MemoryRecallService(workspaceDir, scopeKey ? { conversationScopeKey: scopeKey } : {});
}

export function createPluginMemoryCompactionService(
  api: OpenClawPluginApi,
  options: ReAgentMemoryScopeOptions = {},
): MemoryCompactionService {
  const workspaceDir = resolvePluginStateDir(api);
  const scope = options.scope ?? "workspace";
  const scopeKey = scope === "conversation" ? options.scopeKey?.trim() || undefined : undefined;
  return new MemoryCompactionService(workspaceDir, scopeKey ? { scopeKey } : {});
}

export function createPluginServices(api: OpenClawPluginApi): {
  workspaceDir: string;
  config: ReAgentPluginConfig;
  memoryService: MemoryService;
  memoryRecallService: MemoryRecallService;
  memoryCompactionService: MemoryCompactionService;
  baselineService: ResearchBaselineService;
  directionService: ResearchDirectionService;
  directionReportService: ResearchDirectionReportService;
  feedbackService: ResearchFeedbackService;
  discoveryService: ResearchDiscoveryService;
  linkIngestionService: ResearchLinkIngestionService;
  moduleAssetService: ResearchModuleAssetService;
  noveltyService: ResearchNoveltyService;
  paperAnalysisService: ResearchPaperAnalysisService;
  presentationService: ResearchPresentationService;
  repoAnalysisService: ResearchRepoAnalysisService;
} {
  const workspaceDir = resolvePluginStateDir(api);
  const config = (api.pluginConfig ?? {}) as ReAgentPluginConfig;
  const memoryService = createPluginMemoryService(api);
  const memoryRecallService = createPluginMemoryRecallService(api);
  const memoryCompactionService = createPluginMemoryCompactionService(api);
  const baselineService = new ResearchBaselineService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
  });
  const directionService = new ResearchDirectionService(workspaceDir);
  const directionReportService = new ResearchDirectionReportService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
  });
  const feedbackService = new ResearchFeedbackService(workspaceDir);
  const discoveryService = new ResearchDiscoveryService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
    feedbackService,
  });
  const linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
  const moduleAssetService = new ResearchModuleAssetService(workspaceDir);
  const noveltyService = new ResearchNoveltyService({
    crossrefMailto: config.crossrefMailto,
  });
  const paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
  });
  const presentationService = new ResearchPresentationService(workspaceDir, {
    crossrefMailto: config.crossrefMailto,
  });
  const repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);

  return {
    workspaceDir,
    config,
    memoryService,
    memoryRecallService,
    memoryCompactionService,
    baselineService,
    directionService,
    directionReportService,
    feedbackService,
    discoveryService,
    linkIngestionService,
    moduleAssetService,
    noveltyService,
    paperAnalysisService,
    presentationService,
    repoAnalysisService,
  };
}
