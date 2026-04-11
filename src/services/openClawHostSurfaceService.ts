import { readFile } from "node:fs/promises";
import path from "node:path";

import type { BundledPluginRecord } from "./bundledPluginCatalogService.js";
import { OpenClawHostCatalogService, matchOpenClawPluginState, type OpenClawPluginState } from "./openClawHostCatalogService.js";
import { OpenClawRuntimeStateService } from "./openClawRuntimeStateService.js";

export interface OpenClawImportMetadata {
  importedAt: string;
  sourcePath: string;
  sourceCommit: string;
  trackedFileCount: number;
  extensionCount: number;
  destinationPath: string;
  excludedTopLevelNames: string[];
}

export class OpenClawHostSurfaceService {
  private readonly catalog: OpenClawHostCatalogService;
  private readonly runtimeState: OpenClawRuntimeStateService;
  private readonly importMetadataPath: string;
  private readonly snapshotPath: string;

  constructor(
    private readonly repoRoot: string,
    workspaceDir: string,
  ) {
    this.catalog = new OpenClawHostCatalogService(repoRoot);
    this.runtimeState = new OpenClawRuntimeStateService(workspaceDir);
    this.snapshotPath = path.join(this.repoRoot, "upstream", "openclaw");
    this.importMetadataPath = path.join(this.snapshotPath, ".reagent-import.json");
  }

  getSnapshotPath(): string {
    return this.snapshotPath;
  }

  getSessionRegistryPath(): string {
    return this.runtimeState.getSessionRegistryPath();
  }

  async readSessionRegistry() {
    return this.runtimeState.readSessionRegistry();
  }

  async readImportMetadata(): Promise<OpenClawImportMetadata | null> {
    try {
      const raw = await readFile(this.importMetadataPath, "utf8");
      const payload = JSON.parse(raw.replace(/^\uFEFF/u, "")) as Partial<OpenClawImportMetadata>;
      if (
        typeof payload.importedAt !== "string" ||
        typeof payload.sourcePath !== "string" ||
        typeof payload.sourceCommit !== "string" ||
        typeof payload.trackedFileCount !== "number" ||
        typeof payload.extensionCount !== "number" ||
        typeof payload.destinationPath !== "string" ||
        !Array.isArray(payload.excludedTopLevelNames)
      ) {
        return null;
      }

      return {
        importedAt: payload.importedAt,
        sourcePath: payload.sourcePath,
        sourceCommit: payload.sourceCommit,
        trackedFileCount: payload.trackedFileCount,
        extensionCount: payload.extensionCount,
        destinationPath: payload.destinationPath,
        excludedTopLevelNames: payload.excludedTopLevelNames.filter(
          (entry): entry is string => typeof entry === "string",
        ),
      };
    } catch {
      return null;
    }
  }

  async readCachedSessions() {
    return this.runtimeState.readSessionRegistry();
  }

  async listCatalog(): Promise<BundledPluginRecord[]> {
    return this.catalog.listCatalog();
  }

  async getCatalogPlugin(id: string): Promise<BundledPluginRecord | null> {
    return this.catalog.getCatalogPlugin(id);
  }

  async readHostPluginStates(cliPath: string) {
    return this.catalog.readHostPluginStates(cliPath);
  }

  async listMergedPlugins(states: OpenClawPluginState[]) {
    return this.catalog.listMergedPlugins(states);
  }

  async readOverview(input: {
    cliPath: string;
    gatewayUrl: string;
    channelId: string;
  }): Promise<{
    cliPath: string;
    gatewayUrl: string;
    channelId: string;
    snapshotAvailable: boolean;
    sourceCommit?: string | undefined;
    importedAt?: string | undefined;
    trackedFileCount?: number | undefined;
    importedExtensionCount: number;
    foundationPackageCount: number;
    sessionRegistryCount: number;
    sessionRegistryUpdatedAt?: string | undefined;
  }> {
    const [metadata, plugins, registry] = await Promise.all([
      this.readImportMetadata(),
      this.catalog.listCatalog(),
      this.runtimeState.readSessionRegistry(),
    ]);
    const foundationPackageCount = plugins.filter((plugin) => plugin.source === "reference").length;
    const importedExtensionCount = metadata?.extensionCount ?? plugins.filter((plugin) => plugin.source === "upstream").length;

    return {
      cliPath: input.cliPath,
      gatewayUrl: input.gatewayUrl,
      channelId: input.channelId,
      snapshotAvailable: Boolean(metadata),
      ...(metadata
        ? {
            sourceCommit: metadata.sourceCommit,
            importedAt: metadata.importedAt,
            trackedFileCount: metadata.trackedFileCount,
          }
        : {}),
      importedExtensionCount,
      foundationPackageCount,
      sessionRegistryCount: registry.sessions.length,
      ...(registry.updatedAt ? { sessionRegistryUpdatedAt: registry.updatedAt } : {}),
    };
  }

  async listFoundationItems(cliPath: string): Promise<{
    hostState: { states: OpenClawPluginState[]; error?: string };
    items: Array<{
      plugin: Awaited<ReturnType<OpenClawHostCatalogService["listCatalog"]>>[number];
      host: OpenClawPluginState | null;
    }>;
  }> {
    const [plugins, hostState] = await Promise.all([
      this.catalog.listCatalog(),
      this.catalog.readHostPluginStates(cliPath),
    ]);
    return {
      hostState,
      items: plugins
        .filter((plugin) => plugin.source === "reference")
        .map((plugin) => ({
          plugin,
          host: matchOpenClawPluginState(plugin, hostState.states),
        })),
    };
  }

  async listUpstreamItems(cliPath: string): Promise<{
    hostState: { states: OpenClawPluginState[]; error?: string };
    items: Array<{
      plugin: Awaited<ReturnType<OpenClawHostCatalogService["listCatalog"]>>[number];
      host: OpenClawPluginState | null;
    }>;
  }> {
    const [plugins, hostState] = await Promise.all([
      this.catalog.listCatalog(),
      this.catalog.readHostPluginStates(cliPath),
    ]);
    return {
      hostState,
      items: plugins
        .filter((plugin) => plugin.source === "upstream")
        .map((plugin) => ({
          plugin,
          host: matchOpenClawPluginState(plugin, hostState.states),
        })),
    };
  }

  async inspectPlugin(target: string, cliPath: string) {
    const [metadata, result, hostState] = await Promise.all([
      this.readImportMetadata(),
      this.catalog.getCatalogPlugin(target),
      this.catalog.readHostPluginStates(cliPath),
    ]);
    const host = result ? matchOpenClawPluginState(result, hostState.states) : null;
    return {
      snapshot: {
        available: Boolean(metadata),
        path: this.snapshotPath,
        ...(metadata ? { metadata } : {}),
      },
      plugin: result,
      hostState,
      host,
    };
  }
}
