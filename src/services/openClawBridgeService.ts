import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

import type {
  WeChatChannelAccountSummary,
  WeChatBridgeDiagnostics,
  WeChatChannelStatus,
  WeChatLoginStartResult
} from "../types/channels.js";
import {
  OpenClawGatewayClient,
  type OpenClawGatewayEventFrame,
  type OpenClawGatewaySubscription,
} from "./openClawGatewayClient.js";

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

type GatewaySendResult = {
  messageId?: unknown;
  channel?: unknown;
};

type GatewaySessionRow = {
  key?: unknown;
  channel?: unknown;
  lastChannel?: unknown;
  lastTo?: unknown;
  lastAccountId?: unknown;
  lastThreadId?: unknown;
  deliveryContext?: {
    channel?: unknown;
    to?: unknown;
    accountId?: unknown;
    threadId?: unknown;
  } | null;
  origin?: {
    provider?: unknown;
    accountId?: unknown;
    threadId?: unknown;
  } | null;
  label?: unknown;
  displayName?: unknown;
  derivedTitle?: unknown;
  lastMessagePreview?: unknown;
  updatedAt?: unknown;
};

type GatewaySessionsListResult = {
  sessions?: GatewaySessionRow[];
};

type GatewayChatHistoryResult = {
  messages?: Array<Record<string, unknown>>;
};

export interface OpenClawSessionSummary {
  sessionKey: string;
  channel?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | number | undefined;
  label?: string | undefined;
  displayName?: string | undefined;
  derivedTitle?: string | undefined;
  lastMessagePreview?: string | undefined;
  updatedAt?: number | null | undefined;
}

export interface OpenClawHistoryMessage {
  id?: string | undefined;
  role?: string | undefined;
  text: string;
  raw: Record<string, unknown>;
}

export interface OpenClawSessionEvent {
  event: string;
  payload?: unknown;
}

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toNumber(value: unknown): number | null | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolveOpenClawSessionChannel(row: GatewaySessionRow): string | undefined {
  return (
    toText(row.deliveryContext?.channel) ??
    toText(row.lastChannel) ??
    toText(row.channel) ??
    toText(row.origin?.provider)
  );
}

function toOpenClawSessionSummary(row: GatewaySessionRow): OpenClawSessionSummary | null {
  const sessionKey = toText(row.key);
  if (!sessionKey) {
    return null;
  }

  return {
    sessionKey,
    ...(resolveOpenClawSessionChannel(row) ? { channel: resolveOpenClawSessionChannel(row) } : {}),
    ...(toText(row.deliveryContext?.to) ?? toText(row.lastTo)
      ? { to: toText(row.deliveryContext?.to) ?? toText(row.lastTo) }
      : {}),
    ...(toText(row.deliveryContext?.accountId) ?? toText(row.lastAccountId) ?? toText(row.origin?.accountId)
      ? { accountId: toText(row.deliveryContext?.accountId) ?? toText(row.lastAccountId) ?? toText(row.origin?.accountId) }
      : {}),
    ...(row.deliveryContext?.threadId ?? row.lastThreadId ?? row.origin?.threadId
      ? { threadId: (row.deliveryContext?.threadId ?? row.lastThreadId ?? row.origin?.threadId) as string | number }
      : {}),
    ...(toText(row.label) ? { label: toText(row.label) } : {}),
    ...(toText(row.displayName) ? { displayName: toText(row.displayName) } : {}),
    ...(toText(row.derivedTitle) ? { derivedTitle: toText(row.derivedTitle) } : {}),
    ...(toText(row.lastMessagePreview) ? { lastMessagePreview: toText(row.lastMessagePreview) } : {}),
    ...(toNumber(row.updatedAt) !== undefined ? { updatedAt: toNumber(row.updatedAt) } : {}),
  };
}

function extractHistoryText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const record = entry as Record<string, unknown>;
        if (typeof record.text === "string" && record.text.trim()) {
          return [record.text.trim()];
        }
        return [];
      })
      .join("\n")
      .trim();
  }
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    if (typeof record.text === "string" && record.text.trim()) {
      return record.text.trim();
    }
  }
  return "";
}

function summarizeOpenClawAccounts(
  channelId: string,
  snapshot: {
    channels?: Record<string, unknown>;
    channelAccounts?: Record<string, Array<Record<string, unknown>>>;
  },
): WeChatChannelAccountSummary[] {
  const rawSummary = (snapshot.channels?.[channelId] ?? {}) as Record<string, unknown>;
  const rawAccounts = Array.isArray(snapshot.channelAccounts?.[channelId])
    ? snapshot.channelAccounts?.[channelId] ?? []
    : [];
  const accounts: WeChatChannelAccountSummary[] = [];

  for (const account of rawAccounts) {
    const accountId = typeof account.accountId === "string" ? account.accountId.trim() : "";
    if (!accountId) {
      continue;
    }

    const accountName =
      typeof account.name === "string" && account.name.trim()
        ? account.name.trim()
        : typeof rawSummary.self === "object" && rawSummary.self && "name" in rawSummary.self
          ? String((rawSummary.self as { name?: unknown }).name ?? "").trim() || undefined
          : undefined;

    accounts.push({
      accountId,
      ...(accountName ? { accountName } : {}),
      ...(typeof account.configured === "boolean" ? { configured: account.configured } : {}),
      ...(typeof account.linked === "boolean" ? { linked: account.linked } : {}),
      ...(typeof account.running === "boolean" ? { running: account.running } : {}),
      ...(typeof account.connected === "boolean" ? { connected: account.connected } : {}),
      ...(typeof account.lastError === "string" && account.lastError.trim()
        ? { lastError: account.lastError.trim() }
        : {}),
    });
  }

  return accounts;
}

function pickPrimaryAccount(
  accounts: WeChatChannelAccountSummary[],
): WeChatChannelAccountSummary | null {
  return (
    accounts.find((account) => account.connected) ??
    accounts.find((account) => account.running) ??
    accounts[0] ??
    null
  );
}

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
      const accounts = summarizeOpenClawAccounts(this.channelId, snapshot);
      const primaryAccount = pickPrimaryAccount(accounts);
      const account =
        primaryAccount
          ? (snapshot.channelAccounts?.[this.channelId] ?? []).find(
              (entry) => typeof entry.accountId === "string" && entry.accountId.trim() === primaryAccount.accountId,
            ) as Record<string, unknown> | undefined
          : undefined;
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
        accountId: primaryAccount?.accountId,
        accountName:
          primaryAccount?.accountName ??
          (typeof account?.name === "string"
            ? account.name
            : typeof rawSummary.self === "object" && rawSummary.self && "name" in rawSummary.self
              ? String((rawSummary.self as { name?: unknown }).name ?? "") || undefined
              : undefined),
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
        ...(accounts.length > 0 ? { accounts } : {}),
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

  async listSessions(input: {
    limit?: number | undefined;
    search?: string | undefined;
    channel?: string | undefined;
    includeDerivedTitles?: boolean | undefined;
    includeLastMessage?: boolean | undefined;
  } = {}): Promise<OpenClawSessionSummary[]> {
    await this.ensureGatewayReachable();
    const result = await this.gatewayRequest<GatewaySessionsListResult>("sessions.list", {
      ...(typeof input.limit === "number" && Number.isFinite(input.limit)
        ? { limit: Math.max(1, Math.trunc(input.limit)) }
        : {}),
      ...(input.search?.trim() ? { search: input.search.trim() } : {}),
      ...(typeof input.includeDerivedTitles === "boolean"
        ? { includeDerivedTitles: input.includeDerivedTitles }
        : {}),
      ...(typeof input.includeLastMessage === "boolean"
        ? { includeLastMessage: input.includeLastMessage }
        : {}),
    });

    const requestedChannel = input.channel?.trim().toLowerCase() || "";
    return (result.sessions ?? [])
      .map((row) => toOpenClawSessionSummary(row))
      .filter((row): row is OpenClawSessionSummary => Boolean(row))
      .filter((row) => (requestedChannel ? row.channel?.toLowerCase() === requestedChannel : true));
  }

  async getSession(sessionKey: string): Promise<OpenClawSessionSummary | null> {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      return null;
    }
    const sessions = await this.listSessions({
      limit: 500,
      search: normalizedSessionKey,
      includeDerivedTitles: true,
      includeLastMessage: true,
    });
    return sessions.find((session) => session.sessionKey === normalizedSessionKey) ?? null;
  }

  async readHistory(sessionKey: string, limit = 20): Promise<OpenClawHistoryMessage[]> {
    const normalizedSessionKey = sessionKey.trim();
    if (!normalizedSessionKey) {
      throw new Error("OpenClaw sessionKey cannot be empty.");
    }

    await this.ensureGatewayReachable();
    const result = await this.gatewayRequest<GatewayChatHistoryResult>("chat.history", {
      sessionKey: normalizedSessionKey,
      limit: Math.max(1, Math.trunc(limit)),
    });

    return (result.messages ?? []).map((message) => ({
      ...(typeof message.id === "string" && message.id.trim() ? { id: message.id.trim() } : {}),
      ...(typeof message.role === "string" && message.role.trim() ? { role: message.role.trim() } : {}),
      text: extractHistoryText(message.content),
      raw: message,
    }));
  }

  async sendSessionMessage(input: {
    sessionKey: string;
    text: string;
    mediaUrl?: string | undefined;
  }): Promise<{
    messageId?: string | undefined;
    channel: string;
    to?: string | undefined;
    accountId?: string | undefined;
    threadId?: string | number | undefined;
  }> {
    const session = await this.getSession(input.sessionKey);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${input.sessionKey}`);
    }
    if (!session.to) {
      throw new Error(`OpenClaw session has no delivery target: ${input.sessionKey}`);
    }

    const result = await this.sendMessage({
      to: session.to,
      text: input.text,
      ...(input.mediaUrl?.trim() ? { mediaUrl: input.mediaUrl.trim() } : {}),
      ...(session.accountId ? { accountId: session.accountId } : {}),
      ...(session.threadId == null ? {} : { threadId: String(session.threadId) }),
    });

    return {
      ...result,
      to: session.to,
      ...(session.accountId ? { accountId: session.accountId } : {}),
      ...(session.threadId == null ? {} : { threadId: session.threadId }),
    };
  }

  async watchSessionEvents(input: {
    sessionKey?: string | undefined;
    onEvent: (event: OpenClawSessionEvent) => void | Promise<void>;
    onClose?: (() => void | Promise<void>) | undefined;
    onError?: ((error: Error) => void | Promise<void>) | undefined;
  }): Promise<OpenClawGatewaySubscription> {
    await this.ensureGatewayReachable();
    const client = new OpenClawGatewayClient({
      url: this.gatewayUrl,
      token: this.token,
      password: this.password,
      timeoutMs: 15000,
    });

    const sessionKey = input.sessionKey?.trim() || undefined;
    return client.subscribe({
      subscriptions: [
        { method: "sessions.subscribe", params: {} },
        ...(sessionKey ? [{ method: "sessions.messages.subscribe", params: { key: sessionKey } }] : []),
      ],
      onEvent: async (event: OpenClawGatewayEventFrame) => {
        if (!sessionKey) {
          await input.onEvent({ event: event.event, payload: event.payload });
          return;
        }
        const payload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as { sessionKey?: unknown })
            : null;
        const payloadSessionKey =
          payload && typeof payload.sessionKey === "string" ? payload.sessionKey.trim() : "";
        if (!payloadSessionKey || payloadSessionKey !== sessionKey) {
          return;
        }
        await input.onEvent({ event: event.event, payload: event.payload });
      },
      ...(input.onClose ? { onClose: input.onClose } : {}),
      ...(input.onError ? { onError: input.onError } : {}),
    });
  }

  async sendMessage(input: {
    to: string;
    text: string;
    mediaUrl?: string | undefined;
    accountId?: string | undefined;
    threadId?: string | undefined;
  }): Promise<{
    messageId?: string | undefined;
    channel: string;
  }> {
    const target = input.to.trim();
    const text = input.text.trim();
    const mediaUrl = input.mediaUrl?.trim() || undefined;

    if (!target) {
      throw new Error("OpenClaw outbound target cannot be empty.");
    }
    if (!text && !mediaUrl) {
      throw new Error("OpenClaw outbound payload requires text or media.");
    }

    await this.ensureGatewayReachable();
    const status = await this.getWeChatStatus();
    if (!status.connected) {
      throw new Error("WeChat is not connected. Complete QR login before pushing messages.");
    }

    const accountId = input.accountId?.trim() || status.accountId?.trim() || undefined;
    const threadId = input.threadId?.trim() || undefined;
    const result = await this.gatewayRequest<GatewaySendResult>("send", {
      to: target,
      ...(text ? { message: text } : {}),
      ...(mediaUrl ? { mediaUrl } : {}),
      channel: this.channelId,
      ...(accountId ? { accountId } : {}),
      ...(threadId ? { threadId } : {}),
      idempotencyKey: randomUUID(),
    });

    const messageId =
      typeof result.messageId === "string" && result.messageId.trim().length > 0
        ? result.messageId.trim()
        : undefined;
    const channel =
      typeof result.channel === "string" && result.channel.trim().length > 0
        ? result.channel.trim()
        : this.channelId;

    this.pushLog(`OpenClaw outbound send ok channel=${channel} to=${target} messageId=${messageId ?? "-"}`);

    return {
      ...(messageId ? { messageId } : {}),
      channel,
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

