import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type {
  WeChatBridgeDiagnostics,
  WeChatChannelStatus,
  WeChatLoginStartResult
} from "../types/channels.js";
import { OpenClawGatewayClient } from "./openClawGatewayClient.js";

const REQUIRED_OPENCLAW_VERSION = "2026.3.22";
const LOG_TAIL_LIMIT = 120;

type PluginListResult = {
  plugins?: Array<{
    id?: string;
    name?: string;
    version?: string;
    enabled?: boolean;
    status?: string;
    channelIds?: string[];
  }>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function compareVersion(left: string, right: string): number {
  const leftParts = left.split(/[.-]/u).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(/[.-]/u).map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

export class OpenClawBridgeService {
  private gatewayProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly logTail: string[] = [];
  private lastQrDataUrl: string | undefined;

  constructor(
    private readonly cliPath: string,
    private readonly gatewayUrl: string,
    private readonly channelId: string,
    private readonly token?: string,
    private readonly password?: string
  ) {}

  async start(): Promise<void> {
    await this.ensureGatewayReachable();
  }

  async close(): Promise<void> {
    await this.stopGateway();
  }

  private pushLog(line: string): void {
    this.logTail.push(`${new Date().toISOString()} ${line}`);
    if (this.logTail.length > LOG_TAIL_LIMIT) {
      this.logTail.splice(0, this.logTail.length - LOG_TAIL_LIMIT);
    }
  }

  private async runCli(args: string[], timeoutMs = 20000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, args, {
        windowsHide: true,
        env: {
          ...process.env,
          OPENCLAW_GATEWAY_TOKEN: this.token ?? process.env.OPENCLAW_GATEWAY_TOKEN,
          OPENCLAW_GATEWAY_PASSWORD: this.password ?? process.env.OPENCLAW_GATEWAY_PASSWORD
        }
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill();
        reject(new Error(`OpenClaw CLI timed out: ${args.join(" ")}`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? -1 });
      });
    });
  }

  private async getCliVersion(): Promise<string | undefined> {
    try {
      const result = await this.runCli(["--version"], 10000);
      if (result.exitCode !== 0) {
        return undefined;
      }
      const match = result.stdout.match(/OpenClaw\s+([0-9.]+)/u);
      return match?.[1];
    } catch {
      return undefined;
    }
  }

  private async getPluginInfo(): Promise<{
    pluginInstalled: boolean;
    pluginEnabled: boolean;
    pluginVersion?: string | undefined;
  }> {
    try {
      const result = await this.runCli(["plugins", "list", "--json"], 30000);
      if (result.exitCode !== 0) {
        return {
          pluginInstalled: false,
          pluginEnabled: false
        };
      }

      const payload = JSON.parse(result.stdout) as PluginListResult;
      const plugin = payload.plugins?.find(
        (entry) =>
          entry.id === this.channelId ||
          entry.name?.toLowerCase().includes("weixin") ||
          entry.channelIds?.includes(this.channelId)
      );

      return {
        pluginInstalled: Boolean(plugin),
        pluginEnabled: Boolean(plugin?.enabled || plugin?.status === "loaded"),
        pluginVersion: plugin?.version
      };
    } catch {
      return {
        pluginInstalled: false,
        pluginEnabled: false
      };
    }
  }

  private async gatewayRequest<T>(method: string, params?: unknown): Promise<T> {
    const client = new OpenClawGatewayClient({
      url: this.gatewayUrl,
      token: this.token,
      password: this.password,
      timeoutMs: 15000
    });

    return client.request<T>(method, params);
  }

  private async ensureGatewayReachable(): Promise<void> {
    try {
      await this.gatewayRequest("channels.status", { probe: false, timeoutMs: 5000 });
      return;
    } catch {
      // fall through and try to launch a managed gateway
    }

    await this.startGateway();
  }

  async startGateway(): Promise<void> {
    if (this.gatewayProcess && !this.gatewayProcess.killed) {
      return;
    }

    this.gatewayProcess = spawn(this.cliPath, ["gateway"], {
      windowsHide: true,
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: this.token ?? process.env.OPENCLAW_GATEWAY_TOKEN,
        OPENCLAW_GATEWAY_PASSWORD: this.password ?? process.env.OPENCLAW_GATEWAY_PASSWORD
      }
    });

    this.pushLog(`Starting OpenClaw gateway: ${this.cliPath} gateway`);

    this.gatewayProcess.stdout.on("data", (chunk) => {
      this.pushLog(chunk.toString().trimEnd());
    });
    this.gatewayProcess.stderr.on("data", (chunk) => {
      this.pushLog(chunk.toString().trimEnd());
    });
    this.gatewayProcess.on("close", (code, signal) => {
      this.pushLog(`OpenClaw gateway exited with code=${code ?? 0} signal=${signal ?? "none"}`);
      this.gatewayProcess = null;
    });
    this.gatewayProcess.on("error", (error) => {
      this.pushLog(`OpenClaw gateway process error: ${error.message}`);
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  async stopGateway(): Promise<void> {
    if (!this.gatewayProcess) {
      return;
    }

    this.pushLog("Stopping OpenClaw gateway");
    this.gatewayProcess.kill();
    this.gatewayProcess = null;
  }

  async getDiagnostics(): Promise<WeChatBridgeDiagnostics> {
    const cliVersion = await this.getCliVersion();
    const pluginInfo = await this.getPluginInfo();
    const recommendedActions: string[] = [];
    let gatewayReachable = false;
    let lastError: string | undefined;

    if (!cliVersion) {
      recommendedActions.push(`Ensure OpenClaw CLI is available at ${this.cliPath}.`);
    } else if (compareVersion(cliVersion, REQUIRED_OPENCLAW_VERSION) < 0) {
      recommendedActions.push(
        `Upgrade OpenClaw from ${cliVersion} to ${REQUIRED_OPENCLAW_VERSION} or newer before using @tencent-weixin/openclaw-weixin v2.x.`
      );
    }

    if (!pluginInfo.pluginInstalled) {
      recommendedActions.push(
        `Install the real WeChat plugin: ${this.cliPath} plugins install @tencent-weixin/openclaw-weixin@2.1.1 --yes`
      );
    } else if (!pluginInfo.pluginEnabled) {
      recommendedActions.push(
        `Enable the WeChat plugin: ${this.cliPath} plugins enable ${this.channelId}`
      );
    }

    try {
      await this.gatewayRequest("channels.status", { probe: false, timeoutMs: 5000 });
      gatewayReachable = true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      recommendedActions.push(`Start the OpenClaw gateway and make sure ${this.gatewayUrl} is reachable.`);
    }

    return {
      providerMode: "openclaw",
      cliPath: this.cliPath,
      cliAvailable: Boolean(cliVersion),
      cliVersion,
      requiredVersion: REQUIRED_OPENCLAW_VERSION,
      pluginId: this.channelId,
      pluginInstalled: pluginInfo.pluginInstalled,
      pluginEnabled: pluginInfo.pluginEnabled,
      pluginVersion: pluginInfo.pluginVersion,
      gatewayUrl: this.gatewayUrl,
      gatewayReachable,
      managedProcessRunning: Boolean(this.gatewayProcess),
      recommendedActions,
      lastError,
      logTail: [...this.logTail]
    };
  }

  async getWeChatStatus(): Promise<WeChatChannelStatus> {
    const diagnostics = await this.getDiagnostics();
    const notes = [...diagnostics.recommendedActions];

    if (!diagnostics.gatewayReachable) {
      return {
        providerMode: "openclaw",
        configured: diagnostics.pluginInstalled,
        linked: false,
        running: diagnostics.managedProcessRunning,
        connected: false,
        qrDataUrl: this.lastQrDataUrl,
        lastError: diagnostics.lastError,
        cliVersion: diagnostics.cliVersion,
        pluginInstalled: diagnostics.pluginInstalled,
        pluginVersion: diagnostics.pluginVersion,
        gatewayUrl: diagnostics.gatewayUrl,
        gatewayReachable: diagnostics.gatewayReachable,
        updatedAt: nowIso(),
        notes
      };
    }

    try {
      const snapshot = await this.gatewayRequest<{
        channels?: Record<string, unknown>;
        channelAccounts?: Record<string, Array<Record<string, unknown>>>;
      }>("channels.status", { probe: false, timeoutMs: 5000 });
      const rawSummary = (snapshot.channels?.[this.channelId] ?? {}) as Record<string, unknown>;
      const account = snapshot.channelAccounts?.[this.channelId]?.[0] as Record<string, unknown> | undefined;
      const connected = Boolean(rawSummary.connected ?? account?.connected ?? false);

      if (connected) {
        this.lastQrDataUrl = undefined;
      }

      return {
        providerMode: "openclaw",
        configured: Boolean(rawSummary.configured ?? account?.configured ?? diagnostics.pluginInstalled),
        linked: Boolean(rawSummary.linked ?? account?.linked ?? false),
        running: Boolean(rawSummary.running ?? account?.running ?? diagnostics.managedProcessRunning),
        connected,
        qrDataUrl: this.lastQrDataUrl,
        accountId: typeof account?.accountId === "string" ? account.accountId : undefined,
        accountName:
          typeof account?.name === "string"
            ? account.name
            : typeof rawSummary.self === "object" && rawSummary.self && "name" in rawSummary.self
              ? String((rawSummary.self as { name?: unknown }).name ?? "") || undefined
              : undefined,
        lastMessage:
          typeof rawSummary.lastMessage === "string"
            ? rawSummary.lastMessage
            : typeof rawSummary.message === "string"
              ? rawSummary.message
              : undefined,
        lastError:
          typeof rawSummary.lastError === "string"
            ? rawSummary.lastError
            : typeof account?.lastError === "string"
              ? account.lastError
              : diagnostics.lastError,
        cliVersion: diagnostics.cliVersion,
        pluginInstalled: diagnostics.pluginInstalled,
        pluginVersion: diagnostics.pluginVersion,
        gatewayUrl: diagnostics.gatewayUrl,
        gatewayReachable: diagnostics.gatewayReachable,
        updatedAt: nowIso(),
        notes
      };
    } catch (error) {
      return {
        providerMode: "openclaw",
        configured: diagnostics.pluginInstalled,
        linked: false,
        running: diagnostics.managedProcessRunning,
        connected: false,
        qrDataUrl: this.lastQrDataUrl,
        lastError: error instanceof Error ? error.message : String(error),
        cliVersion: diagnostics.cliVersion,
        pluginInstalled: diagnostics.pluginInstalled,
        pluginVersion: diagnostics.pluginVersion,
        gatewayUrl: diagnostics.gatewayUrl,
        gatewayReachable: diagnostics.gatewayReachable,
        updatedAt: nowIso(),
        notes
      };
    }
  }

  async startLogin(force: boolean): Promise<WeChatLoginStartResult> {
    await this.ensureGatewayReachable();
    const result = await this.gatewayRequest<{ message?: string; qrDataUrl?: string }>("web.login.start", {
      force,
      timeoutMs: 30000,
      verbose: true
    });

    this.lastQrDataUrl = result.qrDataUrl;

    return {
      message: result.message ?? "OpenClaw QR login started.",
      qrDataUrl: result.qrDataUrl,
      connected: false,
      providerMode: "openclaw"
    };
  }

  async waitLogin(): Promise<WeChatLoginStartResult> {
    await this.ensureGatewayReachable();
    const result = await this.gatewayRequest<{ message?: string; connected?: boolean }>("web.login.wait", {
      timeoutMs: 120000
    });

    if (result.connected) {
      this.lastQrDataUrl = undefined;
    }

    return {
      message: result.message ?? "Waiting for scan.",
      connected: Boolean(result.connected),
      providerMode: "openclaw"
    };
  }

  async logout(): Promise<WeChatChannelStatus> {
    await this.ensureGatewayReachable();
    await this.gatewayRequest("channels.logout", {
      channel: this.channelId
    });
    this.lastQrDataUrl = undefined;
    return this.getWeChatStatus();
  }
}

