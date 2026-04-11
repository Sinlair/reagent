import QRCode from "qrcode";

import { getBooleanFlag, getIntegerFlag, getStringFlag, type ParsedOptions } from "./args.js";
import {
  dispatchChannelsAgentCommand as runChannelsAgentCommandDispatch,
  dispatchChannelsCommand as runChannelsCommandDispatch,
} from "./dispatch.js";
import type {
  ChannelsStatusSnapshot,
  WeChatChannelStatus,
  WeChatLifecycleAuditEntry,
  WeChatLoginStartResult,
  WeChatMessage,
} from "../types/channels.js";

type RuntimeEnvLike = {
  PORT: number;
} & Record<string, unknown>;

type GatewayContextLike = {
  runtimeEnv: RuntimeEnvLike;
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

type OpenClawEventAuditPayload = {
  items: Array<{
    ts?: string;
    event: string;
    sessionKey?: string;
    messageId?: string;
    role?: string;
    text?: string;
  }>;
};

type ChannelLifecyclePayload = {
  items: WeChatLifecycleAuditEntry[];
};

type ChannelMessagesPayload = {
  messages: WeChatMessage[];
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

type OpenClawSessionRegistryPayload = {
  items: OpenClawSessionRegistryEntryPayload[];
};

type ChannelSessionsPayload = {
  sessions: Array<{
    sessionId: string;
    channel: string;
    senderId: string;
    roleId: string;
    roleLabel: string;
    skillIds: string[];
    skillLabels: string[];
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env" | "injected";
    wireApi?: string | undefined;
    turnCount: number;
    lastUserMessage?: string | undefined;
    lastAssistantMessage?: string | undefined;
    updatedAt: string;
  }>;
};

type AgentRouteOption = {
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: "ready" | "needs-setup" | "disabled";
  llmSource: "registry" | "env";
  wireApi?: string | undefined;
};

type AgentSessionSummary = {
  roleId: string;
  roleLabel: string;
  skillIds: string[];
  skillLabels: string[];
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: "ready" | "needs-setup" | "disabled";
  llmSource: "registry" | "env" | "injected";
  wireApi?: string | undefined;
  fallbackRoutes: AgentRouteOption[];
  reasoningEffort: string;
  defaultRoute: AgentRouteOption;
  availableRoles: Array<{ id: string; label: string }>;
  availableSkills: Array<{ id: string; label: string }>;
  availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
  availableReasoningEfforts: string[];
};

type ChannelMessagePayload = {
  senderId?: string | undefined;
  senderName?: string | undefined;
  sessionKey?: string | undefined;
  text: string;
  mediaUrl?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | undefined;
};

type ChannelInboundResult = {
  accepted: boolean;
  reply: string;
  researchTaskId?: string | undefined;
};

type SettledCliRequest<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

export interface ChannelsCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  settleCliRequest<T>(promise: Promise<T>): Promise<SettledCliRequest<T>>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  maybeReadLocalGatewayStatus(baseUrl: string, port: number, deep: boolean): Promise<unknown | null>;
  buildFallbackChannelsSnapshot(
    runtimeEnv: RuntimeEnvLike,
    gateway: unknown,
    reason: string,
    probeRequested: boolean,
  ): Promise<ChannelsStatusSnapshot>;
  printJson(value: unknown): void;
  printWeChatStatus(status: WeChatChannelStatus): void;
  formatWhen(value: string | null | undefined): string;
  printOpenClawSessions(items: OpenClawSessionRegistryEntryPayload[]): void;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
}

export function createChannelsCli(deps: ChannelsCliDeps) {
  async function renderTerminalQr(value: string): Promise<string | null> {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return await QRCode.toString(trimmed, {
        type: "terminal",
        small: true,
      });
    } catch {
      return null;
    }
  }

  function formatYesNo(value: boolean): string {
    return value ? "yes" : "no";
  }

  function ensureSupportedChannel(options: ParsedOptions): void {
    const requested = getStringFlag(options, "channel");
    if (!requested) {
      return;
    }

    const normalized = requested.trim().toLowerCase();
    if (!["wechat", "weixin", "openclaw-weixin"].includes(normalized)) {
      throw new Error(
        `Unsupported channel target: ${requested}. ReAgent CLI currently exposes only the WeChat channel surface.`,
      );
    }
  }

  function resolveSenderId(options: ParsedOptions): string {
    const senderId = getStringFlag(options, "sender") ?? options.positionals[0];
    if (!senderId?.trim()) {
      throw new Error("A senderId is required. Pass it positionally or via --sender.");
    }
    return senderId.trim();
  }

  function parseSkillSelections(raw: string): string[] {
    return [...new Set(raw.split(/[,\n]/u).map((entry) => entry.trim()).filter(Boolean))];
  }

  function parseFallbackSelections(raw: string): Array<{ providerId: string; modelId: string }> {
    return raw
      .split(/[,\n]/u)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [providerId, modelId] = entry.split(/[/:]/u);
        return {
          providerId: providerId?.trim() || "",
          modelId: modelId?.trim() || "",
        };
      })
      .filter((entry) => entry.providerId.length > 0 && entry.modelId.length > 0);
  }

  function resolveMessagePayload(options: ParsedOptions, textStartIndex: number): ChannelMessagePayload {
    const sessionKey = getStringFlag(options, "session-key");
    const senderId = sessionKey ? undefined : resolveSenderId(options);
    const senderName = getStringFlag(options, "name", "sender-name");
    const mediaUrl = getStringFlag(options, "media-url");
    const accountId = getStringFlag(options, "account-id");
    const threadId = getStringFlag(options, "thread-id");
    const text = getStringFlag(options, "text") ?? options.positionals.slice(textStartIndex).join(" ").trim();
    if (!text && !mediaUrl) {
      throw new Error("A message text or media URL is required. Pass --text, --media-url, or positional text.");
    }
    return {
      ...(senderId ? { senderId } : {}),
      ...(senderName ? { senderName } : {}),
      ...(sessionKey ? { sessionKey } : {}),
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(accountId ? { accountId } : {}),
      ...(threadId ? { threadId } : {}),
      text,
    };
  }

  function printChannelInboundResult(result: ChannelInboundResult): void {
    console.log(`Accepted: ${formatYesNo(result.accepted)}`);
    if (result.researchTaskId) {
      console.log(`Research task: ${result.researchTaskId}`);
    }
    console.log("");
    console.log(result.reply);
  }

  function printAgentSessionSummary(summary: AgentSessionSummary): void {
    console.log(`Role: ${summary.roleLabel} (${summary.roleId})`);
    console.log(
      `Model: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""} [${summary.llmStatus}]`,
    );
    console.log(`Reasoning: ${summary.reasoningEffort}`);
    console.log(`Skills: ${summary.skillLabels.join(", ") || "-"}`);
    console.log(
      `Fallbacks: ${
        summary.fallbackRoutes.length > 0
          ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
          : "none"
      }`,
    );
    console.log(
      `Default route: ${summary.defaultRoute.providerLabel}/${summary.defaultRoute.modelLabel}${summary.defaultRoute.wireApi ? ` via ${summary.defaultRoute.wireApi}` : ""}`,
    );
    console.log(`Available roles: ${summary.availableRoles.map((role) => role.id).join(", ") || "-"}`);
    console.log(`Available skills: ${summary.availableSkills.map((skill) => skill.id).join(", ") || "-"}`);
    console.log(`Available reasoning: ${summary.availableReasoningEfforts.join(", ") || "-"}`);
  }

  function renderChannelsHelp(): void {
    console.log(`ReAgent Channels

Commands:
  reagent channels status
  reagent channels list
  reagent channels logs
  reagent channels messages
  reagent channels chat <senderId> <text>
  reagent channels inbound <senderId> <text>
  reagent channels push <senderId> <text>
  reagent channels send <senderId> <text>
  reagent channels sessions
  reagent channels agent ...
  reagent channels login
  reagent channels wait
  reagent channels logout

Flags:
  --channel <id>            Accepted aliases: wechat, weixin, openclaw-weixin
  --probe                   Prefer a live gateway probe before falling back to local status
  --sender <id>             Sender/user id for chat, inbound, push, or send
  --name <value>            Optional sender display name
  --text <value>            Message text instead of positional arguments
  --media-url <value>       Optional outbound media URL for push/send
  --session-key <value>     Optional OpenClaw host session key for push/send
  --account-id <value>      Optional outbound account override for push/send
  --thread-id <value>       Optional outbound thread override for push/send
  --display-name <value>    Optional account display name for login completion
  --force                   Start a fresh login flow
  --wait                    Wait for login confirmation after "login"
  --host                    With "logs", show persisted OpenClaw host session events instead of lifecycle audit
  --cached                  With "sessions", prefer the locally cached OpenClaw host session registry
  --live                    With "sessions" or "history", bypass the cached OpenClaw host state and query the live host
  --limit <n>               Limit message/log/session output
  --json                    Print JSON output
`);
  }

  function renderChannelsAgentHelp(): void {
    console.log(`ReAgent Channels Agent

Commands:
  reagent channels agent sessions
  reagent channels agent session <senderId>
  reagent channels agent role <senderId> [roleId]
  reagent channels agent skills <senderId> [skillId,skillId...]
  reagent channels agent model <senderId> [providerId modelId]
  reagent channels agent fallbacks <senderId> [providerId/modelId, ...]
  reagent channels agent reasoning <senderId> [effort]

Examples:
  reagent channels agent session wx-user-1
  reagent channels agent role wx-user-1 researcher
  reagent channels agent skills wx-user-1 workspace-control,memory-ops
  reagent channels agent model wx-user-1 proxy-a gpt-4o
  reagent channels agent model wx-user-1 clear
  reagent channels agent fallbacks wx-user-1 proxy-a/gpt-5.4,proxy-b/gpt-4.1
  reagent channels agent fallbacks wx-user-1 clear
  reagent channels agent reasoning wx-user-1 high

Notes:
  - omit the trailing value to inspect the current setting
  - model "clear" resets the session to the default route
  - fallbacks "clear" removes all fallback routes

Flags:
  --sender <id>             Use a senderId flag instead of the first positional
  --json                    Print JSON output
`);
  }

  async function fetchAgentSessionSummary(context: GatewayContextLike, senderId: string): Promise<AgentSessionSummary> {
    return deps.requestGatewayJson<AgentSessionSummary>(
      context.baseUrl,
      `/api/channels/wechat/agent?${deps.buildQueryString({ senderId })}`,
      { timeoutMs: context.timeoutMs },
    );
  }

  async function channelsStatusCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const probeRequested = getBooleanFlag(options, "probe", "deep");
    const payload = await deps.settleCliRequest(
      deps.requestGatewayJson<ChannelsStatusSnapshot>(context.baseUrl, "/api/channels/status", {
        timeoutMs: context.timeoutMs,
      }),
    );

    if (payload.ok) {
      if (getBooleanFlag(options, "json")) {
        deps.printJson(payload.value);
        return;
      }

      console.log(
        `Channels: ${payload.value.channelOrder.map((id) => payload.value.channelLabels[id] ?? id).join(", ")}`,
      );
      console.log("");
      deps.printWeChatStatus(payload.value.channels.wechat);
      return;
    }

    const gateway = await deps.maybeReadLocalGatewayStatus(context.baseUrl, context.runtimeEnv.PORT, probeRequested);
    if (!gateway) {
      throw new Error(payload.error);
    }
    const fallback = await deps.buildFallbackChannelsSnapshot(
      context.runtimeEnv,
      gateway,
      payload.error,
      probeRequested,
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(fallback);
      return;
    }

    console.log("Channels: WeChat");
    console.log("Mode: local fallback");
    console.log("");
    deps.printWeChatStatus(fallback.channels.wechat);
  }

  async function channelsLogsCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit", "lines") ?? 20, 100));
    if (getBooleanFlag(options, "host")) {
      const payload = await deps.requestGatewayJson<OpenClawEventAuditPayload>(
        context.baseUrl,
        `/api/channels/wechat/openclaw-events?${deps.buildQueryString({ limit })}`,
        { timeoutMs: context.timeoutMs },
      );

      if (getBooleanFlag(options, "json")) {
        deps.printJson(payload);
        return;
      }

      if (payload.items.length === 0) {
        console.log("No OpenClaw host event records found.");
        return;
      }

      for (const item of payload.items) {
        console.log(
          `${deps.formatWhen(item.ts)} event=${item.event} session=${deps.formatWhen(item.sessionKey)}`,
        );
        if (item.messageId) {
          console.log(`Message ID: ${item.messageId}`);
        }
        if (item.role) {
          console.log(`Role: ${item.role}`);
        }
        if (item.text) {
          console.log(item.text);
        }
        console.log("");
      }
      return;
    }

    const payload = await deps.requestGatewayJson<ChannelLifecyclePayload>(
      context.baseUrl,
      `/api/channels/wechat/lifecycle-audit?${deps.buildQueryString({ limit })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    if (payload.items.length === 0) {
      console.log("No channel lifecycle records found.");
      return;
    }

    for (const item of payload.items) {
      console.log(`${deps.formatWhen(item.ts)} event=${item.event} state=${deps.formatWhen(item.state)}`);
      if (item.reason) {
        console.log(`Reason: ${item.reason}`);
      }
      if (item.details) {
        console.log(`Details: ${JSON.stringify(item.details)}`);
      }
      console.log("");
    }
  }

  async function channelsMessagesCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit", "lines") ?? 20, 100));
    const payload = await deps.requestGatewayJson<ChannelMessagesPayload>(
      context.baseUrl,
      "/api/channels/wechat/messages",
      { timeoutMs: context.timeoutMs },
    );
    const messages = payload.messages.slice(-limit);

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ messages });
      return;
    }

    if (messages.length === 0) {
      console.log("No channel messages found.");
      return;
    }

    for (const message of messages) {
      const sender = message.senderName?.trim() || message.senderId?.trim() || "-";
      console.log(`${message.createdAt} ${message.direction} ${sender}`);
      console.log(message.text);
      console.log("");
    }
  }

  async function channelsChatCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const payload = resolveMessagePayload(options, 1);
    const result = await deps.requestGatewayJson<ChannelInboundResult>(
      context.baseUrl,
      "/api/channels/wechat/chat",
      {
        method: "POST",
        body: payload,
        timeoutMs: Math.max(context.timeoutMs, 60_000),
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ ...payload, ...result });
      return;
    }

    printChannelInboundResult(result);
  }

  async function channelsInboundCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const payload = resolveMessagePayload(options, 1);
    const result = await deps.requestGatewayJson<ChannelInboundResult>(
      context.baseUrl,
      "/api/channels/wechat/inbound",
      {
        method: "POST",
        body: payload,
        timeoutMs: Math.max(context.timeoutMs, 60_000),
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ ...payload, ...result });
      return;
    }

    printChannelInboundResult(result);
  }

  async function channelsPushCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const payload = resolveMessagePayload(options, 1);
    const result = await deps.requestGatewayJson<ChannelInboundResult>(
      context.baseUrl,
      "/api/channels/wechat/push",
      {
        method: "POST",
        body: payload,
        timeoutMs: Math.max(context.timeoutMs, 60_000),
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ ...payload, ...result });
      return;
    }

    printChannelInboundResult(result);
  }

  async function channelsSessionsCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
    if (getBooleanFlag(options, "host")) {
      const payload = await deps.requestGatewayJson<OpenClawSessionRegistryPayload>(
        context.baseUrl,
        `/api/channels/wechat/openclaw-sessions?${deps.buildQueryString({ limit })}`,
        { timeoutMs: context.timeoutMs },
      );
      const sessions = payload.items.slice(0, limit);

      if (getBooleanFlag(options, "json")) {
        deps.printJson({ source: "host-registry", sessions });
        return;
      }

      if (sessions.length === 0) {
        console.log("No cached OpenClaw host sessions found.");
        return;
      }

      deps.printOpenClawSessions(sessions);
      return;
    }

    const payload = await deps.requestGatewayJson<ChannelSessionsPayload>(
      context.baseUrl,
      "/api/channels/wechat/agent/sessions",
      { timeoutMs: context.timeoutMs },
    );
    const sessions = payload.sessions.slice(0, limit);

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ sessions });
      return;
    }

    if (sessions.length === 0) {
      console.log("No agent sessions found.");
      return;
    }

    for (const session of sessions) {
      console.log(`${session.sessionId} sender=${session.senderId} updated=${session.updatedAt}`);
      console.log(
        `Role=${session.roleLabel} Model=${session.providerLabel}/${session.modelLabel}${session.wireApi ? ` via ${session.wireApi}` : ""} Turns=${session.turnCount}`,
      );
      console.log(`Skills=${session.skillLabels.join(", ") || "-"}`);
      console.log("");
    }
  }

  async function channelsAgentSessionsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
    const payload = await deps.requestGatewayJson<ChannelSessionsPayload>(
      context.baseUrl,
      "/api/channels/wechat/agent/sessions",
      { timeoutMs: context.timeoutMs },
    );
    const sessions = payload.sessions.slice(0, limit);

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ sessions });
      return;
    }

    if (sessions.length === 0) {
      console.log("No agent sessions found.");
      return;
    }

    for (const session of sessions) {
      console.log(`${session.senderId} role=${session.roleId} updated=${session.updatedAt}`);
      console.log(
        `Model=${session.providerId}/${session.modelId}${session.wireApi ? ` via ${session.wireApi}` : ""} Turns=${session.turnCount}`,
      );
      console.log(`Skills=${session.skillIds.join(", ") || "-"}`);
      console.log("");
    }
  }

  async function channelsAgentSessionCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const senderId = resolveSenderId(options);
    const summary = await fetchAgentSessionSummary(context, senderId);

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ senderId, ...summary });
      return;
    }

    console.log(`Sender: ${senderId}`);
    printAgentSessionSummary(summary);
  }

  async function channelsAgentRoleCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const senderId = resolveSenderId(options);
    const roleId = options.positionals[1]?.trim();

    if (!roleId) {
      const summary = await fetchAgentSessionSummary(context, senderId);
      if (getBooleanFlag(options, "json")) {
        deps.printJson({
          senderId,
          roleId: summary.roleId,
          roleLabel: summary.roleLabel,
          availableRoles: summary.availableRoles,
        });
        return;
      }
      console.log(`Sender: ${senderId}`);
      console.log(`Current role: ${summary.roleLabel} (${summary.roleId})`);
      console.log(
        `Available roles: ${summary.availableRoles.map((role) => `${role.id} (${role.label})`).join(", ") || "-"}`,
      );
      return;
    }

    const summary = await deps.requestGatewayJson<AgentSessionSummary>(
      context.baseUrl,
      "/api/channels/wechat/agent/role",
      {
        method: "POST",
        body: {
          senderId,
          roleId,
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ senderId, ...summary });
      return;
    }

    console.log(`Sender: ${senderId}`);
    console.log(`Role updated to ${summary.roleLabel} (${summary.roleId})`);
  }

  async function channelsAgentSkillsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const senderId = resolveSenderId(options);
    const raw = options.positionals.slice(1).join(" ").trim();

    if (!raw) {
      const summary = await fetchAgentSessionSummary(context, senderId);
      if (getBooleanFlag(options, "json")) {
        deps.printJson({
          senderId,
          skillIds: summary.skillIds,
          skillLabels: summary.skillLabels,
          availableSkills: summary.availableSkills,
        });
        return;
      }
      console.log(`Sender: ${senderId}`);
      console.log(`Current skills: ${summary.skillLabels.join(", ") || "-"}`);
      console.log(
        `Available skills: ${summary.availableSkills.map((skill) => `${skill.id} (${skill.label})`).join(", ") || "-"}`,
      );
      return;
    }

    const skillIds = parseSkillSelections(raw);
    if (skillIds.length === 0) {
      throw new Error("No valid skill ids were provided.");
    }

    const summary = await deps.requestGatewayJson<AgentSessionSummary>(
      context.baseUrl,
      "/api/channels/wechat/agent/skills",
      {
        method: "POST",
        body: {
          senderId,
          skillIds,
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ senderId, ...summary });
      return;
    }

    console.log(`Sender: ${senderId}`);
    console.log(`Skills updated: ${summary.skillLabels.join(", ") || "-"}`);
  }

  async function channelsAgentModelCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const senderId = resolveSenderId(options);
    const arg1 = options.positionals[1]?.trim();
    const arg2 = options.positionals[2]?.trim();

    if (!arg1) {
      const summary = await fetchAgentSessionSummary(context, senderId);
      if (getBooleanFlag(options, "json")) {
        deps.printJson({
          senderId,
          providerId: summary.providerId,
          providerLabel: summary.providerLabel,
          modelId: summary.modelId,
          modelLabel: summary.modelLabel,
          wireApi: summary.wireApi,
          availableLlmProviders: summary.availableLlmProviders,
        });
        return;
      }
      console.log(`Sender: ${senderId}`);
      console.log(
        `Current model: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
      );
      console.log(
        `Available providers: ${summary.availableLlmProviders.map((provider) => provider.id).join(", ") || "-"}`,
      );
      return;
    }

    if (["clear", "reset", "default", "none"].includes(arg1.toLowerCase())) {
      const summary = await deps.requestGatewayJson<AgentSessionSummary>(
        context.baseUrl,
        "/api/channels/wechat/agent/model",
        {
          method: "POST",
          body: {
            senderId,
          },
          timeoutMs: context.timeoutMs,
        },
      );
      if (getBooleanFlag(options, "json")) {
        deps.printJson({ senderId, ...summary });
        return;
      }
      console.log(`Sender: ${senderId}`);
      console.log(
        `Model reset to ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
      );
      return;
    }

    if (!arg2) {
      throw new Error("channels agent model requires both providerId and modelId, or 'clear'.");
    }

    const summary = await deps.requestGatewayJson<AgentSessionSummary>(
      context.baseUrl,
      "/api/channels/wechat/agent/model",
      {
        method: "POST",
        body: {
          senderId,
          providerId: arg1,
          modelId: arg2,
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ senderId, ...summary });
      return;
    }

    console.log(`Sender: ${senderId}`);
    console.log(
      `Model updated to ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
    );
  }

  async function channelsAgentFallbacksCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const senderId = resolveSenderId(options);
    const raw = options.positionals.slice(1).join(" ").trim();

    if (!raw) {
      const summary = await fetchAgentSessionSummary(context, senderId);
      if (getBooleanFlag(options, "json")) {
        deps.printJson({ senderId, fallbackRoutes: summary.fallbackRoutes });
        return;
      }
      console.log(`Sender: ${senderId}`);
      console.log(
        `Fallbacks: ${
          summary.fallbackRoutes.length > 0
            ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
            : "none"
        }`,
      );
      return;
    }

    const routes =
      ["clear", "reset", "none"].includes(raw.toLowerCase()) ? [] : parseFallbackSelections(raw);

    if (!["clear", "reset", "none"].includes(raw.toLowerCase()) && routes.length === 0) {
      throw new Error("No valid fallback routes were provided.");
    }

    const summary = await deps.requestGatewayJson<AgentSessionSummary>(
      context.baseUrl,
      "/api/channels/wechat/agent/fallbacks",
      {
        method: "POST",
        body: {
          senderId,
          routes,
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ senderId, ...summary });
      return;
    }

    console.log(`Sender: ${senderId}`);
    console.log(
      `Fallbacks updated: ${
        summary.fallbackRoutes.length > 0
          ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
          : "none"
      }`,
    );
  }

  async function channelsAgentReasoningCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const senderId = resolveSenderId(options);
    const reasoningEffort = options.positionals[1]?.trim();

    if (!reasoningEffort) {
      const summary = await fetchAgentSessionSummary(context, senderId);
      if (getBooleanFlag(options, "json")) {
        deps.printJson({
          senderId,
          reasoningEffort: summary.reasoningEffort,
          availableReasoningEfforts: summary.availableReasoningEfforts,
        });
        return;
      }
      console.log(`Sender: ${senderId}`);
      console.log(`Current reasoning: ${summary.reasoningEffort}`);
      console.log(`Available reasoning: ${summary.availableReasoningEfforts.join(", ") || "-"}`);
      return;
    }

    const summary = await deps.requestGatewayJson<AgentSessionSummary>(
      context.baseUrl,
      "/api/channels/wechat/agent/reasoning",
      {
        method: "POST",
        body: {
          senderId,
          reasoningEffort,
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ senderId, ...summary });
      return;
    }

    console.log(`Sender: ${senderId}`);
    console.log(`Reasoning updated to ${summary.reasoningEffort}`);
  }

  async function printLoginPreview(result: WeChatLoginStartResult): Promise<void> {
    console.log(result.message);
    if (result.pairingCode) {
      console.log(`Pairing code: ${result.pairingCode}`);
      const qr = await renderTerminalQr(result.pairingCode);
      if (qr) {
        console.log(qr);
      }
    }
    if (result.qrDataUrl) {
      console.log("QR image is available in the dashboard/UI flow.");
    }
  }

  async function channelsLoginCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const displayName = getStringFlag(options, "display-name", "name");
    const startBody = {
      force: getBooleanFlag(options, "force"),
      ...(displayName ? { displayName } : {}),
    };
    const startResult = await deps.requestGatewayJson<WeChatLoginStartResult>(
      context.baseUrl,
      "/api/channels/wechat/login/start",
      {
        method: "POST",
        body: startBody,
        timeoutMs: Math.max(context.timeoutMs, 30_000),
      },
    );

    if (getBooleanFlag(options, "wait")) {
      const completeResult = await deps.requestGatewayJson<WeChatChannelStatus>(
        context.baseUrl,
        "/api/channels/wechat/login/complete",
        {
          method: "POST",
          body: displayName ? { displayName } : {},
          timeoutMs: Math.max(context.timeoutMs, 120_000),
        },
      );

      if (getBooleanFlag(options, "json")) {
        deps.printJson({ start: startResult, complete: completeResult });
        return;
      }

      await printLoginPreview(startResult);
      console.log("");
      deps.printWeChatStatus(completeResult);
      return;
    }

    if (getBooleanFlag(options, "json")) {
      deps.printJson(startResult);
      return;
    }

    await printLoginPreview(startResult);
  }

  async function channelsWaitCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const displayName = getStringFlag(options, "display-name", "name");
    const result = await deps.requestGatewayJson<WeChatChannelStatus>(
      context.baseUrl,
      "/api/channels/wechat/login/complete",
      {
        method: "POST",
        body: displayName ? { displayName } : {},
        timeoutMs: Math.max(context.timeoutMs, 120_000),
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    deps.printWeChatStatus(result);
  }

  async function channelsLogoutCommand(options: ParsedOptions): Promise<void> {
    ensureSupportedChannel(options);
    const context = await deps.resolveGatewayContext(options);
    const result = await deps.requestGatewayJson<WeChatChannelStatus>(
      context.baseUrl,
      "/api/channels/wechat/logout",
      {
        method: "POST",
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    deps.printWeChatStatus(result);
  }

  async function channelsAgentCommand(options: ParsedOptions): Promise<void> {
    await runChannelsAgentCommandDispatch(options, {
      renderChannelsAgentHelp,
      channelsAgentSessionsCommand,
      channelsAgentSessionCommand,
      channelsAgentRoleCommand,
      channelsAgentSkillsCommand,
      channelsAgentModelCommand,
      channelsAgentFallbacksCommand,
      channelsAgentReasoningCommand,
    });
  }

  async function channelsCommand(options: ParsedOptions): Promise<void> {
    await runChannelsCommandDispatch(options, {
      renderChannelsHelp,
      channelsStatusCommand,
      channelsLogsCommand,
      channelsMessagesCommand,
      channelsChatCommand,
      channelsInboundCommand,
      channelsPushCommand,
      channelsSessionsCommand,
      channelsAgentCommand,
      channelsLoginCommand,
      channelsWaitCommand,
      channelsLogoutCommand,
    });
  }

  return {
    renderChannelsHelp,
    renderChannelsAgentHelp,
    channelsStatusCommand,
    channelsLogsCommand,
    channelsMessagesCommand,
    channelsChatCommand,
    channelsInboundCommand,
    channelsPushCommand,
    channelsSessionsCommand,
    channelsAgentSessionsCommand,
    channelsAgentSessionCommand,
    channelsAgentRoleCommand,
    channelsAgentSkillsCommand,
    channelsAgentModelCommand,
    channelsAgentFallbacksCommand,
    channelsAgentReasoningCommand,
    channelsLoginCommand,
    channelsWaitCommand,
    channelsLogoutCommand,
    channelsAgentCommand,
    channelsCommand,
  };
}
