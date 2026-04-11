import { spawn } from "node:child_process";

import { BundledPluginCatalogService, type BundledPluginRecord } from "./bundledPluginCatalogService.js";

export interface OpenClawPluginState {
  id: string;
  name?: string | undefined;
  version?: string | undefined;
  enabled: boolean;
  status?: string | undefined;
  channelIds: string[];
}

type OpenClawPluginListPayload = {
  plugins?: Array<{
    id?: string;
    name?: string;
    version?: string;
    enabled?: boolean;
    status?: string;
    channelIds?: string[];
  }>;
};

export function parseOpenClawPluginStates(raw: string): OpenClawPluginState[] {
  if (!raw.trim()) {
    return [];
  }

  try {
    const payload = JSON.parse(raw) as OpenClawPluginListPayload;
    return (payload.plugins ?? [])
      .filter((plugin): plugin is NonNullable<OpenClawPluginListPayload["plugins"]>[number] => Boolean(plugin))
      .map((plugin) => ({
        id: plugin.id?.trim() || plugin.name?.trim() || "",
        ...(plugin.name?.trim() ? { name: plugin.name.trim() } : {}),
        ...(plugin.version?.trim() ? { version: plugin.version.trim() } : {}),
        enabled: Boolean(plugin.enabled || plugin.status === "loaded"),
        ...(plugin.status?.trim() ? { status: plugin.status.trim() } : {}),
        channelIds: (plugin.channelIds ?? []).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        ),
      }))
      .filter((plugin) => plugin.id.length > 0);
  } catch {
    return [];
  }
}

export function matchOpenClawPluginState(
  plugin: BundledPluginRecord,
  states: OpenClawPluginState[],
): OpenClawPluginState | null {
  const normalizedIds = new Set([
    plugin.id.toLowerCase(),
    plugin.packageName.toLowerCase(),
    plugin.installSpec.toLowerCase(),
  ]);

  return (
    states.find((state) => {
      const candidates = [
        state.id.toLowerCase(),
        state.name?.toLowerCase(),
        ...state.channelIds.map((entry) => entry.toLowerCase()),
      ].filter(Boolean) as string[];
      return candidates.some((candidate) => normalizedIds.has(candidate));
    }) ?? null
  );
}

export class OpenClawHostCatalogService {
  private readonly bundledCatalog: BundledPluginCatalogService;

  constructor(repoRoot: string) {
    this.bundledCatalog = new BundledPluginCatalogService(repoRoot);
  }

  async listCatalog(): Promise<BundledPluginRecord[]> {
    return this.bundledCatalog.listPlugins();
  }

  async getCatalogPlugin(id: string): Promise<BundledPluginRecord | null> {
    return this.bundledCatalog.getPlugin(id);
  }

  async readHostPluginStates(cliPath: string): Promise<{ states: OpenClawPluginState[]; error?: string }> {
    try {
      const result = await this.runExternalCli(cliPath, ["plugins", "list", "--json"], {
        timeoutMs: 10_000,
      });
      if (result.exitCode !== 0) {
        return {
          states: [],
          error: result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`,
        };
      }
      return {
        states: parseOpenClawPluginStates(result.stdout),
      };
    } catch (error) {
      return {
        states: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listMergedPlugins(states: OpenClawPluginState[]): Promise<
    Array<{
      plugin: BundledPluginRecord;
      host: OpenClawPluginState | null;
    }>
  > {
    const plugins = await this.listCatalog();
    return plugins.map((plugin) => ({
      plugin,
      host: matchOpenClawPluginState(plugin, states),
    }));
  }

  async getMergedPlugin(
    id: string,
    states: OpenClawPluginState[],
  ): Promise<{
    plugin: BundledPluginRecord | null;
    host: OpenClawPluginState | null;
  }> {
    const plugin = await this.getCatalogPlugin(id);
    return {
      plugin,
      host: plugin ? matchOpenClawPluginState(plugin, states) : null,
    };
  }

  private async runExternalCli(
    command: string,
    args: string[],
    options: { cwd?: string; timeoutMs?: number } = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd ?? process.cwd(),
        env: process.env,
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      const timeoutHandle = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill();
        reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
      }, options.timeoutMs ?? 30_000);

      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        reject(error);
      });
      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });
    });
  }
}
