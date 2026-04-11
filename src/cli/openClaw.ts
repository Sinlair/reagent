import path from "node:path";
import process from "node:process";

import { applyRuntimeOverrides, getBooleanFlag, getIntegerFlag, getStringFlag, type ParsedOptions } from "./args.js";
import {
  dispatchPluginsCommand as runPluginsCommandDispatch,
  delegateOpenClawCommandFamily as runDelegatedOpenClawCommandFamily,
  type OpenClawCommandFamily,
  type PluginDelegateSubcommand,
} from "./dispatch.js";
import { packageRootDir } from "../packagePaths.js";
import { type BundledPluginRecord } from "../services/bundledPluginCatalogService.js";
import {
  OpenClawHostCatalogService,
  matchOpenClawPluginState,
  type OpenClawPluginState,
} from "../services/openClawHostCatalogService.js";
import { OpenClawHostSurfaceService, type OpenClawImportMetadata } from "../services/openClawHostSurfaceService.js";

type RuntimeEnvLike = {
  OPENCLAW_CLI_PATH: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_WECHAT_CHANNEL_ID: string;
  PLATFORM_WORKSPACE_DIR: string;
  WECHAT_PROVIDER: string;
};

type OpenClawSessionEventPayload = {
  event: string;
  payload?: unknown;
};

type OpenClawSessionRegistryEntryPayload = {
  sessionKey: string;
  channel?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | number | undefined;
  label?: string | undefined;
  displayName?: string | undefined;
  derivedTitle?: string | undefined;
  lastMessagePreview?: string | undefined;
  lastMessageId?: string | undefined;
  lastMessageRole?: string | undefined;
  updatedAt?: number | null | undefined;
  lastSyncedAt: string;
};

type ExternalCliOptionsLike = {
  cwd?: string;
  timeoutMs?: number;
  inheritStdio?: boolean;
};

type ExternalCliResultLike = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type MarketplaceSource = "reagent" | "bundled" | "reference" | "upstream";

export interface OpenClawCliDeps {
  loadRuntimeEnv(): Promise<RuntimeEnvLike>;
  renderPluginsHelp(): void;
  printJson(value: unknown): void;
  printBundledPluginList(items: Array<{ plugin: BundledPluginRecord; host: OpenClawPluginState | null }>): void;
  formatMarketplaceSource(source: MarketplaceSource): string;
  formatYesNo(value: boolean): string;
  formatWhen(value: string | number | null | undefined): string;
  printOpenClawSessions(items: any[]): void;
  printOpenClawHistory(messages: any[]): void;
  printOpenClawEvents(events: any[]): void;
  runExternalCli(command: string, args: string[], options?: ExternalCliOptionsLike): Promise<ExternalCliResultLike>;
}

export function createOpenClawCli(deps: OpenClawCliDeps) {
  async function resolveOpenClawCliPath(options: ParsedOptions): Promise<string> {
    applyRuntimeOverrides(options);
    const runtimeEnv = await deps.loadRuntimeEnv();
    return runtimeEnv.OPENCLAW_CLI_PATH;
  }

  async function createOpenClawHostSurfaceService(options: ParsedOptions): Promise<OpenClawHostSurfaceService> {
    applyRuntimeOverrides(options);
    const runtimeEnv = await deps.loadRuntimeEnv();
    const workspaceDir = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
    return new OpenClawHostSurfaceService(packageRootDir, workspaceDir);
  }

  async function readOpenClawImportMetadata(): Promise<OpenClawImportMetadata | null> {
    const service = await createOpenClawHostSurfaceService({
      flags: new Map(),
      positionals: [],
    });
    return service.readImportMetadata();
  }

  function collectPluginDelegateFlags(options: ParsedOptions, names: string[]): string[] {
    const args: string[] = [];
    for (const name of names) {
      const value = options.flags.get(name);
      if (value === true) {
        args.push(`--${name}`);
        continue;
      }
      if (typeof value === "string" && value.trim()) {
        args.push(`--${name}`, value.trim());
      }
    }
    return args;
  }

  async function pluginsListCommand(options: ParsedOptions): Promise<void> {
    const cliPath = await resolveOpenClawCliPath(options);
    const catalog = await createOpenClawHostSurfaceService(options);
    const [items, hostState] = await Promise.all([catalog.listMergedPlugins([]), catalog.readHostPluginStates(cliPath)]);
    const merged = items
      .map((item) => ({
        plugin: item.plugin,
        host: matchOpenClawPluginState(item.plugin, hostState.states),
      }))
      .filter((item) => !getBooleanFlag(options, "enabled") || Boolean(item.host?.enabled));

    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        cliPath,
        host: {
          available: !hostState.error,
          ...(hostState.error ? { error: hostState.error } : {}),
          plugins: hostState.states,
        },
        bundled: merged,
      });
      return;
    }

    if (hostState.error) {
      console.log(`OpenClaw host probe: ${hostState.error}`);
      console.log("");
    }
    deps.printBundledPluginList(merged);
  }

  function resolveMarketplaceSource(options: ParsedOptions): MarketplaceSource {
    const raw = (getStringFlag(options, "source") ?? options.positionals[0] ?? "reagent").trim().toLowerCase();
    if (raw === "reagent" || raw === "all" || raw === "repo") {
      return "reagent";
    }
    if (raw === "bundled" || raw === "bundle") {
      return "bundled";
    }
    if (raw === "upstream" || raw === "snapshot" || raw === "vendor" || raw === "openclaw") {
      return "upstream";
    }
    if (raw === "reference" || raw === "compat" || raw === "package" || raw === "foundation") {
      return "reference";
    }
    throw new Error(`Unknown marketplace source: ${raw}`);
  }

  async function pluginsMarketplaceListCommand(options: ParsedOptions): Promise<void> {
    const catalog = await createOpenClawHostSurfaceService(options);
    const source = resolveMarketplaceSource(options);
    const plugins = (await catalog.listCatalog()).filter(
      (plugin: BundledPluginRecord) => source === "reagent" || plugin.source === source,
    );
    const payload = {
      marketplace: {
        requestedSource: getStringFlag(options, "source") ?? options.positionals[0] ?? "reagent",
        resolvedSource: source,
        available: true,
        pluginCount: plugins.length,
      },
      plugins,
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    console.log(`Marketplace: ${deps.formatMarketplaceSource(payload.marketplace.resolvedSource)}`);
    console.log(`Plugins: ${payload.marketplace.pluginCount}`);
    console.log("");
    deps.printBundledPluginList(plugins.map((plugin) => ({ plugin, host: null })));
  }

  function renderPluginsMarketplaceHelp(): void {
    console.log(`ReAgent Plugins Marketplace

Commands:
  reagent plugins marketplace list [source]

Sources:
  reagent                List all plugin packages shipped in this repo
  bundled                List bundled packages from packages/*
  upstream               List imported OpenClaw upstream extensions from upstream/openclaw/extensions/*
  openclaw               Alias for "upstream"
  foundation             List the in-repo OpenClaw foundation package from package/
  reference              Alias for "foundation"

Flags:
  --source <id>          Marketplace source alias
  --json                 Print JSON output
`);
  }

  function resolveOpenClawImportScriptPath(): string {
    return path.join(packageRootDir, "scripts", "import-openclaw-upstream.ps1");
  }

  function resolvePowerShellExecutable(): string {
    return process.platform === "win32" ? "powershell.exe" : "pwsh";
  }

  async function buildOpenClawOverview(): Promise<{
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
    const runtimeEnv = await deps.loadRuntimeEnv();
    const service = await createOpenClawHostSurfaceService({
      flags: new Map(),
      positionals: [],
    });
    return service.readOverview({
      cliPath: runtimeEnv.OPENCLAW_CLI_PATH,
      gatewayUrl: runtimeEnv.OPENCLAW_GATEWAY_URL,
      channelId: runtimeEnv.OPENCLAW_WECHAT_CHANNEL_ID,
    });
  }

  async function createOpenClawBridgeFromOptions(options: ParsedOptions): Promise<any> {
    applyRuntimeOverrides(options);
    const runtimeEnv = await deps.loadRuntimeEnv();
    const { OpenClawBridgeService } = await import("../services/openClawBridgeService.js");
    return new OpenClawBridgeService(
      runtimeEnv.OPENCLAW_CLI_PATH,
      runtimeEnv.OPENCLAW_GATEWAY_URL,
      runtimeEnv.OPENCLAW_WECHAT_CHANNEL_ID,
    );
  }

  async function readLocalOpenClawSessionRegistryState(): Promise<{
    path: string;
    updatedAt?: string | undefined;
    sessions: OpenClawSessionRegistryEntryPayload[];
  }> {
    const runtimeEnv = await deps.loadRuntimeEnv();
    const workspaceDir = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
    const service = new OpenClawHostSurfaceService(packageRootDir, workspaceDir);
    const state = await service.readSessionRegistry();

    return {
      path: service.getSessionRegistryPath(),
      ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}),
      sessions: state.sessions.map((entry) => ({
        sessionKey: entry.sessionKey,
        ...(entry.channel ? { channel: entry.channel } : {}),
        ...(entry.to ? { to: entry.to } : {}),
        ...(entry.accountId ? { accountId: entry.accountId } : {}),
        ...(entry.threadId == null ? {} : { threadId: entry.threadId }),
        ...(entry.label ? { label: entry.label } : {}),
        ...(entry.displayName ? { displayName: entry.displayName } : {}),
        ...(entry.derivedTitle ? { derivedTitle: entry.derivedTitle } : {}),
        ...(entry.lastMessagePreview ? { lastMessagePreview: entry.lastMessagePreview } : {}),
        ...(entry.lastMessageId ? { lastMessageId: entry.lastMessageId } : {}),
        ...(entry.lastMessageRole ? { lastMessageRole: entry.lastMessageRole } : {}),
        ...(entry.updatedAt === undefined ? {} : { updatedAt: entry.updatedAt }),
        lastSyncedAt: entry.lastSyncedAt,
      })),
    };
  }

  async function openClawInspectCommand(options: ParsedOptions): Promise<void> {
    const target = options.positionals.join(" ").trim();
    if (!target) {
      throw new Error("inspect requires a plugin id or package name.");
    }

    const metadata = await readOpenClawImportMetadata();
    const cliPath = await resolveOpenClawCliPath(options);
    const service = await createOpenClawHostSurfaceService(options);
    const { snapshot, plugin, hostState, host } = await service.inspectPlugin(target, cliPath);
    const payload = {
      target,
      snapshot,
      ...(plugin ? { plugin } : {}),
      host: {
        available: !hostState.error,
        ...(hostState.error ? { error: hostState.error } : {}),
        ...(host ? { plugin: host } : {}),
      },
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    if (plugin) {
      deps.printBundledPluginList([{ plugin, host }]);
      console.log(`Package root: ${plugin.packageRoot}`);
      console.log(`Manifest: ${plugin.manifestPath}`);
      console.log(`Snapshot imported: ${deps.formatYesNo(Boolean(metadata))}`);
      if (plugin.source === "upstream" && metadata) {
        console.log(`Imported commit: ${metadata.sourceCommit}`);
      }
      return;
    }

    if (host) {
      console.log(`${host.id} installed in OpenClaw`);
      console.log(`Enabled: ${deps.formatYesNo(host.enabled)}`);
      console.log(`Version: ${deps.formatWhen(host.version)}`);
      return;
    }

    throw new Error(`Plugin not found in imported snapshot, foundation catalog, or OpenClaw host inventory: ${target}`);
  }

  async function openClawSessionsCommand(options: ParsedOptions): Promise<void> {
    applyRuntimeOverrides(options);
    const registry = await readLocalOpenClawSessionRegistryState();
    const shouldUseCached =
      !getBooleanFlag(options, "live") && (getBooleanFlag(options, "cached") || registry.sessions.length > 0);
    if (shouldUseCached) {
      const cachedRegistry = await readLocalOpenClawSessionRegistryState();
      const requestedLimit = getIntegerFlag(options, "limit");
      const resolvedLimit =
        requestedLimit !== undefined
          ? requestedLimit
          : cachedRegistry.sessions.length > 0
            ? cachedRegistry.sessions.length
            : 20;
      const sessions = cachedRegistry.sessions.slice(
        0,
        Math.max(1, Math.min(resolvedLimit, 500)),
      );

      if (getBooleanFlag(options, "json")) {
        deps.printJson({
          source: "cached-registry",
          path: cachedRegistry.path,
          ...(cachedRegistry.updatedAt ? { updatedAt: cachedRegistry.updatedAt } : {}),
          sessions,
        });
        return;
      }

      console.log("Source: cached-registry");
      console.log(`Path: ${cachedRegistry.path}`);
      console.log(`Updated: ${deps.formatWhen(cachedRegistry.updatedAt)}`);
      console.log("");
      deps.printOpenClawSessions(sessions);
      return;
    }

    const bridge = await createOpenClawBridgeFromOptions(options);
    const sessions = await bridge.listSessions({
      ...(getIntegerFlag(options, "limit") ? { limit: getIntegerFlag(options, "limit") } : {}),
      ...(getStringFlag(options, "search") ? { search: getStringFlag(options, "search") } : {}),
      ...(getStringFlag(options, "channel") ? { channel: getStringFlag(options, "channel") } : {}),
      includeDerivedTitles: true,
      includeLastMessage: true,
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ source: "live-host", sessions });
      return;
    }

    console.log("Source: live-host");
    console.log("");
    deps.printOpenClawSessions(sessions);
  }

  async function openClawHistoryCommand(options: ParsedOptions): Promise<void> {
    applyRuntimeOverrides(options);
    const sessionKey = options.positionals.join(" ").trim();
    if (!sessionKey) {
      throw new Error("history requires a sessionKey.");
    }

    const shouldUseCached = !getBooleanFlag(options, "live");
    if (shouldUseCached) {
      const runtimeEnv = await deps.loadRuntimeEnv();
      const workspaceDir = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
      const { OpenClawRuntimeStateService } = await import("../services/openClawRuntimeStateService.js");
      const service = new OpenClawRuntimeStateService(workspaceDir);
      const messages = await service.readSessionMessages(sessionKey);

      if (messages.length > 0 || getBooleanFlag(options, "cached")) {
        if (getBooleanFlag(options, "json")) {
          deps.printJson({ source: "cached-registry", sessionKey, messages });
          return;
        }

        if (messages.length === 0) {
          console.log("No cached OpenClaw history messages found.");
          return;
        }

        deps.printOpenClawHistory(
          messages.map((message) => ({
            ...(message.id ? { id: message.id } : {}),
            ...(message.role ? { role: message.role } : {}),
            text: message.text,
            raw: {
              id: message.id,
              role: message.role,
              createdAt: message.createdAt,
            },
          })),
        );
        return;
      }
    }

    const bridge = await createOpenClawBridgeFromOptions(options);
    const messages = await bridge.readHistory(
      sessionKey,
      Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 200)),
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ source: "live-host", sessionKey, messages });
      return;
    }

    console.log("Source: live-host");
    console.log("");
    deps.printOpenClawHistory(messages);
  }

  async function openClawWatchCommand(options: ParsedOptions): Promise<void> {
    const sessionKey = options.positionals.join(" ").trim() || undefined;
    const limit = Math.max(
      1,
      Math.min(getIntegerFlag(options, "limit") ?? (getBooleanFlag(options, "json") ? 20 : 10_000), 10_000),
    );
    const timeoutOverride = getIntegerFlag(options, "timeout", "timeout-ms");
    if (getBooleanFlag(options, "json") && timeoutOverride === undefined && getIntegerFlag(options, "limit") === undefined) {
      throw new Error("watch --json requires --limit or --timeout.");
    }

    const timeoutMs =
      timeoutOverride === undefined
        ? getBooleanFlag(options, "json")
          ? 5_000
          : 0
        : Math.max(1_000, Math.min(timeoutOverride, 120_000));
    const bridge = await createOpenClawBridgeFromOptions(options);
    const events: OpenClawSessionEventPayload[] = [];

    await new Promise<void>(async (resolve, reject) => {
      let settled = false;
      let timeoutHandle: NodeJS.Timeout | null = null;
      let subscription: { close(): Promise<void> } | null = null;

      const finish = async (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        try {
          await subscription?.close?.();
        } catch {
          // ignore close failures
        }
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      try {
        subscription = await bridge.watchSessionEvents({
          ...(sessionKey ? { sessionKey } : {}),
          onEvent: async (event: OpenClawSessionEventPayload) => {
            events.push(event);
            if (!getBooleanFlag(options, "json")) {
              deps.printOpenClawEvents([event]);
            }
            if (events.length >= limit) {
              await finish(undefined);
            }
          },
          onError: async (error: unknown) => {
            await finish(error);
          },
          onClose: async () => {
            await finish(undefined);
          },
        });
      } catch (error) {
        await finish(error);
        return;
      }

      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          void finish(undefined);
        }, timeoutMs);
      }
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        ...(sessionKey ? { sessionKey } : {}),
        events,
      });
      return;
    }

    if (events.length === 0) {
      console.log("No OpenClaw session events captured.");
    }
  }

  async function openClawSyncCommand(options: ParsedOptions): Promise<void> {
    const scriptPath = resolveOpenClawImportScriptPath();
    const sourcePath = getStringFlag(options, "source-path") ?? "E:\\Internship\\program\\openclaw";
    const command = resolvePowerShellExecutable();
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-SourcePath",
      sourcePath,
    ];
    const result = await deps.runExternalCli(command, args, {
      cwd: packageRootDir,
      timeoutMs: 600_000,
      inheritStdio: !getBooleanFlag(options, "json"),
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `OpenClaw sync failed with exit code ${result.exitCode}`);
    }

    const metadata = await readOpenClawImportMetadata();
    const payload = {
      ok: true,
      command,
      scriptPath,
      sourcePath,
      stdout: result.stdout.trim(),
      snapshot: {
        available: Boolean(metadata),
        path: path.join(packageRootDir, "upstream", "openclaw"),
        ...(metadata ? { metadata } : {}),
      },
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    console.log("OpenClaw upstream sync completed.");
    console.log(`Source: ${sourcePath}`);
    console.log(`Snapshot: ${payload.snapshot.path}`);
    console.log(`Imported: ${deps.formatWhen(metadata?.importedAt)}`);
    console.log(`Commit: ${metadata?.sourceCommit ?? "-"}`);
    console.log(`Extensions: ${metadata?.extensionCount ?? "-"}`);
  }

  async function pluginsInspectCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "all")) {
      await pluginsListCommand(options);
      return;
    }

    const target = options.positionals.join(" ").trim();
    if (!target) {
      throw new Error("plugins inspect requires a plugin id or package name.");
    }

    const cliPath = await resolveOpenClawCliPath(options);
    const catalog = new OpenClawHostCatalogService(packageRootDir);
    const [{ plugin, host }, hostState] = await Promise.all([
      catalog.getMergedPlugin(target, []),
      catalog.readHostPluginStates(cliPath),
    ]);
    const resolvedHost = plugin ? matchOpenClawPluginState(plugin, hostState.states) : host;
    const payload = {
      target,
      ...(plugin ? { bundled: plugin } : {}),
      host: {
        available: !hostState.error,
        ...(hostState.error ? { error: hostState.error } : {}),
        ...(resolvedHost ? { plugin: resolvedHost } : {}),
      },
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    if (plugin) {
      deps.printBundledPluginList([{ plugin, host: resolvedHost }]);
      return;
    }

    if (resolvedHost) {
      console.log(`${resolvedHost.id} installed in OpenClaw`);
      console.log(`Enabled: ${deps.formatYesNo(resolvedHost.enabled)}`);
      console.log(`Version: ${deps.formatWhen(resolvedHost.version)}`);
      return;
    }

    throw new Error(`Plugin not found in bundled catalog or OpenClaw host inventory: ${target}`);
  }

  async function delegatePluginCommand(
    options: ParsedOptions,
    subcommand: PluginDelegateSubcommand,
  ): Promise<void> {
    const cliPath = await resolveOpenClawCliPath(options);
    const catalog = new OpenClawHostCatalogService(packageRootDir);
    const target = options.positionals[0]?.trim();
    const delegatedArgs = ["plugins", subcommand];

    if (subcommand !== "doctor") {
      if (!target && !(subcommand === "update" && getBooleanFlag(options, "all"))) {
        throw new Error(`plugins ${subcommand} requires a plugin id.`);
      }
      const resolvedTarget = target ?? "";
      if (subcommand === "install") {
        const plugin = await catalog.getCatalogPlugin(resolvedTarget);
        delegatedArgs.push(plugin?.installSpec ?? resolvedTarget);
        delegatedArgs.push(...collectPluginDelegateFlags(options, ["yes", "force", "pin", "link", "json"]));
      } else if (subcommand === "update") {
        if (target) {
          delegatedArgs.push(target);
        }
        delegatedArgs.push(...collectPluginDelegateFlags(options, ["all", "yes", "json"]));
      } else if (subcommand === "uninstall") {
        delegatedArgs.push(resolvedTarget);
        delegatedArgs.push(...collectPluginDelegateFlags(options, ["dry-run", "keep-files", "json", "yes"]));
      } else {
        delegatedArgs.push(resolvedTarget);
        delegatedArgs.push(...collectPluginDelegateFlags(options, ["json", "yes"]));
      }
    } else {
      delegatedArgs.push(...collectPluginDelegateFlags(options, ["json"]));
    }

    const result = await deps.runExternalCli(cliPath, delegatedArgs, {
      timeoutMs: 120_000,
      inheritStdio: !getBooleanFlag(options, "json"),
    });

    if (getBooleanFlag(options, "json")) {
      if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || result.stdout.trim() || `OpenClaw exited with code ${result.exitCode}`);
      }
      process.stdout.write(result.stdout);
      return;
    }

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `OpenClaw exited with code ${result.exitCode}`);
    }
  }

  async function delegateOpenClawCommandFamily(
    options: ParsedOptions,
    family: OpenClawCommandFamily,
  ): Promise<void> {
    await runDelegatedOpenClawCommandFamily(options, family, {
      resolveOpenClawCliPath,
      runExternalCli: deps.runExternalCli,
    });
  }

  async function pluginsCommand(options: ParsedOptions): Promise<void> {
    await runPluginsCommandDispatch(options, {
      renderPluginsHelp: deps.renderPluginsHelp,
      pluginsListCommand,
      pluginsInspectCommand,
      pluginsMarketplaceListCommand,
      renderPluginsMarketplaceHelp,
      delegatePluginCommand,
    });
  }

  return {
    buildOpenClawOverview,
    openClawInspectCommand,
    openClawSessionsCommand,
    openClawHistoryCommand,
    openClawWatchCommand,
    openClawSyncCommand,
    pluginsListCommand,
    pluginsMarketplaceListCommand,
    renderPluginsMarketplaceHelp,
    pluginsInspectCommand,
    delegatePluginCommand,
    delegateOpenClawCommandFamily,
    pluginsCommand,
  };
}
