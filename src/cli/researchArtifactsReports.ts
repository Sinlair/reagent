import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  getBooleanFlag,
  getIntegerFlag,
  getStringFlag,
  type ParsedOptions,
} from "./args.js";
import { dispatchResearchDirectionReportCommand } from "./dispatch.js";
import type { DeepPaperAnalysisReport } from "../types/researchAnalysis.js";
import type { ResearchDirectionReport } from "../types/researchDirectionReport.js";
import type {
  ModuleAsset,
  RepoAnalysisReport,
  ResearchSourceItem,
  WeeklyPresentationResult,
} from "../types/researchArtifacts.js";

type GatewayContextLike = {
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

type GatewayBytesResponse = {
  bytes: Uint8Array;
  contentType: string | null;
};

type ResearchModuleAssetsPayload = {
  assets: ModuleAsset[];
};

type ResearchPresentationsPayload = {
  presentations: WeeklyPresentationResult[];
};

type ResearchDirectionReportsPayload = {
  reports: ResearchDirectionReport[];
};

export interface ResearchArtifactsReportsCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  requestGatewayBytes(
    baseUrl: string,
    targetPath: string,
    options?: GatewayRequestOptions,
  ): Promise<GatewayBytesResponse>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  resolveRequiredEntityId(options: ParsedOptions, label: string): string;
  printResearchSourceItem(item: ResearchSourceItem): void;
  printResearchPaperReport(report: DeepPaperAnalysisReport): void;
  printResearchRepoReport(report: RepoAnalysisReport): void;
  printResearchModuleAssets(assets: ModuleAsset[]): void;
  printResearchModuleAsset(asset: ModuleAsset): void;
  printResearchPresentations(items: WeeklyPresentationResult[]): void;
  printResearchPresentation(item: WeeklyPresentationResult): void;
  printResearchDirectionReports(reports: ResearchDirectionReport[]): void;
  printResearchDirectionReport(report: ResearchDirectionReport): void;
}

export function createResearchArtifactsReportsCli(deps: ResearchArtifactsReportsCliDeps) {
  async function researchArtifactCommand(options: ParsedOptions): Promise<void> {
    const artifactPath = options.positionals.join(" ").trim();
    if (!artifactPath) {
      throw new Error("research artifact requires a workspace-relative path.");
    }

    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayBytes(
      context.baseUrl,
      `/api/research/artifact?${deps.buildQueryString({ path: artifactPath })}`,
      { timeoutMs: context.timeoutMs },
    );
    const outPath = getStringFlag(options, "out");

    if (outPath) {
      const resolvedOutPath = path.resolve(process.cwd(), outPath);
      await mkdir(path.dirname(resolvedOutPath), { recursive: true });
      await writeFile(resolvedOutPath, Buffer.from(payload.bytes));
      if (getBooleanFlag(options, "json")) {
        deps.printJson({
          artifactPath,
          outPath: resolvedOutPath,
          contentType: payload.contentType,
          bytes: payload.bytes.length,
        });
        return;
      }
      console.log(`Wrote research artifact to ${resolvedOutPath}`);
      return;
    }

    const contentType = payload.contentType?.toLowerCase() ?? "";
    const isTextual =
      contentType.startsWith("text/") ||
      contentType.includes("application/json") ||
      contentType.includes("application/markdown");
    if (!isTextual) {
      throw new Error("Binary artifacts require --out <file>.");
    }

    const text = Buffer.from(payload.bytes).toString("utf8");
    if (getBooleanFlag(options, "json")) {
      deps.printJson({ artifactPath, contentType: payload.contentType, content: text });
      return;
    }
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  }

  async function researchSourceCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sourceItemId = deps.resolveRequiredEntityId(options, "source item");
    const payload = await deps.requestGatewayJson<ResearchSourceItem>(
      context.baseUrl,
      `/api/research/source-items/${encodeURIComponent(sourceItemId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchSourceItem(payload);
  }

  async function researchPaperReportCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const reportId = deps.resolveRequiredEntityId(options, "paper report");
    const payload = await deps.requestGatewayJson<DeepPaperAnalysisReport>(
      context.baseUrl,
      `/api/research/paper-reports/${encodeURIComponent(reportId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchPaperReport(payload);
  }

  async function researchRepoReportCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const reportId = deps.resolveRequiredEntityId(options, "repo report");
    const payload = await deps.requestGatewayJson<RepoAnalysisReport>(
      context.baseUrl,
      `/api/research/repo-reports/${encodeURIComponent(reportId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchRepoReport(payload);
  }

  async function researchModuleAssetsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 20;
    const payload = await deps.requestGatewayJson<ResearchModuleAssetsPayload>(
      context.baseUrl,
      `/api/research/module-assets/recent?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchModuleAssets(payload.assets);
  }

  async function researchModuleAssetCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const assetId = deps.resolveRequiredEntityId(options, "module asset");
    const payload = await deps.requestGatewayJson<ModuleAsset>(
      context.baseUrl,
      `/api/research/module-assets/${encodeURIComponent(assetId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchModuleAsset(payload);
  }

  async function researchPresentationsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 20;
    const payload = await deps.requestGatewayJson<ResearchPresentationsPayload>(
      context.baseUrl,
      `/api/research/presentations/recent?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchPresentations(payload.presentations);
  }

  async function researchPresentationCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const presentationId = deps.resolveRequiredEntityId(options, "presentation");
    const payload = await deps.requestGatewayJson<WeeklyPresentationResult>(
      context.baseUrl,
      `/api/research/presentations/${encodeURIComponent(presentationId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchPresentation(payload);
  }

  async function researchDirectionReportsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = getIntegerFlag(options, "limit") ?? 20;
    const payload = await deps.requestGatewayJson<ResearchDirectionReportsPayload>(
      context.baseUrl,
      `/api/research/direction-reports/recent?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDirectionReports(payload.reports);
  }

  async function researchDirectionReportGetCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const reportId = deps.resolveRequiredEntityId(options, "direction report");
    const payload = await deps.requestGatewayJson<ResearchDirectionReport>(
      context.baseUrl,
      `/api/research/direction-reports/${encodeURIComponent(reportId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDirectionReport(payload);
  }

  async function researchDirectionReportGenerateCommand(options: ParsedOptions): Promise<void> {
    const directionId = getStringFlag(options, "direction");
    const positionalTopic = options.positionals.join(" ").trim();
    const topic = getStringFlag(options, "topic") ?? (positionalTopic ? positionalTopic : undefined);
    const days = getIntegerFlag(options, "days");
    if (!directionId && !topic) {
      throw new Error("research direction-report generate requires --direction <id> or --topic <value>.");
    }

    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<ResearchDirectionReport>(
      context.baseUrl,
      "/api/research/direction-reports/generate",
      {
        method: "POST",
        body: {
          ...(directionId ? { directionId } : {}),
          ...(topic ? { topic } : {}),
          ...(days !== undefined ? { days } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }
    deps.printResearchDirectionReport(payload);
  }

  async function researchDirectionReportCommand(options: ParsedOptions): Promise<void> {
    await dispatchResearchDirectionReportCommand(options, {
      researchDirectionReportGetCommand,
      researchDirectionReportGenerateCommand,
    });
  }

  return {
    researchArtifactCommand,
    researchSourceCommand,
    researchPaperReportCommand,
    researchRepoReportCommand,
    researchModuleAssetsCommand,
    researchModuleAssetCommand,
    researchPresentationsCommand,
    researchPresentationCommand,
    researchDirectionReportsCommand,
    researchDirectionReportGetCommand,
    researchDirectionReportGenerateCommand,
    researchDirectionReportCommand,
  };
}
