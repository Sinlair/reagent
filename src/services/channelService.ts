import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchService } from "./researchService.js";
import type { MemoryService } from "./memoryService.js";
import { ChatService, type ChatServiceLike } from "./chatService.js";
import { ResearchFeedbackService } from "./researchFeedbackService.js";
import type {
  ChannelsStatusSnapshot,
  WeChatLifecycleState,
  WeChatChannelStatus,
  WeChatInboundResult,
  WeChatLoginStartResult,
  WeChatMessage,
  WeChatProviderMode
} from "../types/channels.js";
import { MockWeChatChannelProvider } from "../providers/channels/mockWeChatChannelProvider.js";
import { NativeWeChatChannelProvider } from "../providers/channels/nativeWeChatChannelProvider.js";
import { OpenClawBridgeService } from "./openClawBridgeService.js";

interface OpenClawBridgeOptions {
  cliPath: string;
  gatewayUrl: string;
  channelId: string;
  token?: string | undefined;
  password?: string | undefined;
}

interface ChannelServiceOptions {
  wechatProvider?: WeChatProviderMode;
  openClaw?: OpenClawBridgeOptions;
  openClawBridge?: OpenClawBridgeService;
  nativeProvider?: NativeWeChatChannelProvider;
  chatService?: ChatServiceLike;
  healthMonitor?: {
    intervalMs?: number | undefined;
    restartCooldownMs?: number | undefined;
    unhealthyThreshold?: number | undefined;
    maxRestartsPerHour?: number | undefined;
  } | undefined;
}

interface TranscriptState {
  updatedAt: string;
  messages: WeChatMessage[];
}

interface WeChatLifecycleStateRecord {
  providerMode: WeChatProviderMode;
  state: WeChatLifecycleState;
  reason: string;
  updatedAt: string;
  requiresHumanAction: boolean;
  consecutiveUnhealthyChecks: number;
  firstUnhealthyAt?: string | undefined;
  lastHealthyAt?: string | undefined;
  lastRestartAt?: string | undefined;
  reconnectPausedUntil?: string | undefined;
  restartHistory: string[];
  lastError?: string | undefined;
}

interface WeChatLifecycleAuditEntry {
  ts?: string | undefined;
  providerMode: WeChatProviderMode;
  event:
    | "service-started"
    | "service-stopped"
    | "lifecycle-transition"
    | "auto-restart-scheduled"
    | "auto-restart-completed"
    | "auto-restart-failed"
    | "auto-restart-blocked";
  state?: WeChatLifecycleState | undefined;
  reason?: string | undefined;
  details?: Record<string, string | number | boolean | null>;
}

const DEFAULT_HEALTH_MONITOR_INTERVAL_MS = 15_000;
const DEFAULT_RESTART_COOLDOWN_MS = 60_000;
const DEFAULT_UNHEALTHY_THRESHOLD = 2;
const DEFAULT_MAX_RESTARTS_PER_HOUR = 6;
const DEFAULT_STALE_SOCKET_THRESHOLD_MS = 90_000;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultTranscriptState(): TranscriptState {
  return {
    updatedAt: nowIso(),
    messages: []
  };
}

function defaultWeChatLifecycleState(providerMode: WeChatProviderMode): WeChatLifecycleStateRecord {
  return {
    providerMode,
    state: "waiting-human-action",
    reason: "initializing",
    updatedAt: nowIso(),
    requiresHumanAction: true,
    consecutiveUnhealthyChecks: 0,
    restartHistory: []
  };
}

function trimRestartHistory(history: string[], nowMs: number): string[] {
  return history.filter((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && nowMs - parsed < 60 * 60 * 1000;
  });
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function buildCommandHelpReply(): string {
  return [
    "Supported commands:",
    "/research <topic>",
    "/memory <query>",
    "/remember <fact>",
    "/feedback <signal> [notes]",
    "/role <assistant|operator|researcher>",
    "/skills",
    "/model [providerId modelId]",
    "/fallbacks [providerId/modelId, ...]",
    "/reasoning [default|none|minimal|low|medium|high|xhigh]",
    "",
    "Direct chat is also available without a leading slash."
  ].join("\n");
}

type AgentRuntimeSummaryShape = {
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
  fallbackRoutes: Array<{
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: string | undefined;
  }>;
  reasoningEffort: string;
  defaultRoute: {
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: string | undefined;
  };
  availableRoles: Array<{ id: string; label: string }>;
  availableSkills: Array<{ id: string; label: string }>;
  availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
  availableReasoningEfforts: string[];
};

function hasAgentRuntimeControls(
  chatService: ChatServiceLike
): chatService is ChatServiceLike & {
  listSessions(): Promise<
    Array<{
      sessionId: string;
      channel: string;
      senderId: string;
      roleId: string;
      roleLabel: string;
      skillIds: string[];
      skillLabels: string[];
      turnCount: number;
      updatedAt: string;
    }>
  >;
  setRole(senderId: string, roleId: string): Promise<AgentRuntimeSummaryShape>;
  setSkills(senderId: string, skillIds: string[]): Promise<AgentRuntimeSummaryShape>;
  setModel(senderId: string, providerId: string, modelId: string): Promise<AgentRuntimeSummaryShape>;
  clearModel(senderId: string): Promise<AgentRuntimeSummaryShape>;
  setFallbacks(senderId: string, selections: Array<{ providerId: string; modelId: string }>): Promise<AgentRuntimeSummaryShape>;
  setReasoning(senderId: string, reasoningEffort: string): Promise<AgentRuntimeSummaryShape>;
  describeSession(senderId: string): Promise<AgentRuntimeSummaryShape>;
} {
  return (
    typeof (chatService as { listSessions?: unknown }).listSessions === "function" &&
    typeof (chatService as { setRole?: unknown }).setRole === "function" &&
    typeof (chatService as { setSkills?: unknown }).setSkills === "function" &&
    typeof (chatService as { setModel?: unknown }).setModel === "function" &&
    typeof (chatService as { clearModel?: unknown }).clearModel === "function" &&
    typeof (chatService as { setFallbacks?: unknown }).setFallbacks === "function" &&
    typeof (chatService as { setReasoning?: unknown }).setReasoning === "function" &&
    typeof (chatService as { describeSession?: unknown }).describeSession === "function"
  );
}

function buildMemoryReply(query: string, hits: Awaited<ReturnType<MemoryService["search"]>>): string {
  if (hits.length === 0) {
    return `No memory hits found for \"${query}\".`;
  }

  return [
    `Memory hits for \"${query}\":`,
    ...hits.map(
      (hit, index) =>
        `${index + 1}. ${hit.path}:${hit.startLine}-${hit.endLine} | ${hit.title}\n${hit.snippet}`
    )
  ].join("\n\n");
}

function buildResearchReply(report: Awaited<ReturnType<ResearchService["runResearch"]>>): string {
  const findings = report.findings.slice(0, 2).join("\n- ");
  return [
    `Research task created: ${report.taskId}`,
    report.summary,
    findings ? `Top findings:\n- ${findings}` : "No findings yet."
  ].join("\n\n");
}

function mergeMessages(...messageSets: WeChatMessage[][]): WeChatMessage[] {
  const byId = new Map<string, WeChatMessage>();

  for (const messages of messageSets) {
    for (const message of messages) {
      byId.set(message.id, message);
    }
  }

  return [...byId.values()].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );
}

export class ChannelService {
  private readonly wechatProviderMode: WeChatProviderMode;
  private readonly mockProvider: MockWeChatChannelProvider | null;
  private readonly nativeProvider: NativeWeChatChannelProvider | null;
  private readonly openClawBridge: OpenClawBridgeService | null;
  private readonly transcriptPath: string;
  private readonly lifecycleStatePath: string;
  private readonly lifecycleAuditPath: string;
  private readonly chatService: ChatServiceLike;
  private readonly feedbackService: ResearchFeedbackService;
  private readonly healthMonitorIntervalMs: number;
  private readonly restartCooldownMs: number;
  private readonly unhealthyThreshold: number;
  private readonly maxRestartsPerHour: number;
  private healthMonitorTimer: NodeJS.Timeout | null = null;
  private healthCheckInFlight = false;
  private restartInFlight = false;

  constructor(
    private readonly workspaceDir: string,
    private readonly researchService: ResearchService,
    private readonly memoryService: MemoryService,
    options: ChannelServiceOptions = {}
  ) {
    this.wechatProviderMode = options.wechatProvider ?? "mock";
    this.chatService =
      options.chatService ??
      new ChatService(workspaceDir, memoryService, {
        researchService
      });
    this.feedbackService = new ResearchFeedbackService(workspaceDir);
    this.mockProvider =
      this.wechatProviderMode === "mock" ? new MockWeChatChannelProvider(workspaceDir) : null;
    this.nativeProvider =
      this.wechatProviderMode === "native"
        ? (options.nativeProvider ??
          new NativeWeChatChannelProvider(workspaceDir, async (input) => this.handleWeChatInput(input)))
        : null;
    this.openClawBridge =
      this.wechatProviderMode === "openclaw"
        ? (options.openClawBridge ??
          new OpenClawBridgeService(
            options.openClaw?.cliPath ?? "D:/nodejs/openclaw.cmd",
            options.openClaw?.gatewayUrl ?? "ws://127.0.0.1:18789",
            options.openClaw?.channelId ?? "openclaw-weixin",
            options.openClaw?.token,
            options.openClaw?.password
          ))
        : null;
    this.transcriptPath = path.join(this.workspaceDir, "channels", "wechat-transcript.json");
    this.lifecycleStatePath = path.join(this.workspaceDir, "channels", "wechat-lifecycle.json");
    this.lifecycleAuditPath = path.join(this.workspaceDir, "channels", "wechat-lifecycle-audit.jsonl");
    this.healthMonitorIntervalMs = Math.max(
      2_000,
      options.healthMonitor?.intervalMs ?? DEFAULT_HEALTH_MONITOR_INTERVAL_MS
    );
    this.restartCooldownMs = Math.max(
      5_000,
      options.healthMonitor?.restartCooldownMs ?? DEFAULT_RESTART_COOLDOWN_MS
    );
    this.unhealthyThreshold = Math.max(
      1,
      options.healthMonitor?.unhealthyThreshold ?? DEFAULT_UNHEALTHY_THRESHOLD
    );
    this.maxRestartsPerHour = Math.max(
      1,
      options.healthMonitor?.maxRestartsPerHour ?? DEFAULT_MAX_RESTARTS_PER_HOUR
    );
  }

  async start(): Promise<void> {
    if (this.wechatProviderMode === "native") {
      await this.nativeProvider?.start?.();
      this.startHealthMonitor();
      await this.evaluateWeChatLifecycle({ allowRestart: false }).catch(() => undefined);
      await this.appendLifecycleAudit({
        providerMode: this.wechatProviderMode,
        event: "service-started",
        details: { source: "channel-service" }
      });
      return;
    }
    if (this.wechatProviderMode === "openclaw") {
      await this.openClawBridge?.start?.();
      this.startHealthMonitor();
      await this.evaluateWeChatLifecycle({ allowRestart: false }).catch(() => undefined);
      await this.appendLifecycleAudit({
        providerMode: this.wechatProviderMode,
        event: "service-started",
        details: { source: "channel-service" }
      });
      return;
    }
    await this.mockProvider?.start?.();
  }

  async close(): Promise<void> {
    this.stopHealthMonitor();
    await this.appendLifecycleAudit({
      providerMode: this.wechatProviderMode,
      event: "service-stopped",
      details: { source: "channel-service" }
    }).catch(() => undefined);
    if (this.wechatProviderMode === "native") {
      await this.nativeProvider?.close?.();
      return;
    }
    if (this.wechatProviderMode === "openclaw") {
      await this.openClawBridge?.close?.();
      return;
    }
    await this.mockProvider?.close?.();
  }

  private startHealthMonitor(): void {
    if (this.wechatProviderMode === "mock" || this.healthMonitorTimer) {
      return;
    }

    queueMicrotask(() => {
      void this.runHealthCheck();
    });
    this.healthMonitorTimer = setInterval(() => {
      void this.runHealthCheck();
    }, this.healthMonitorIntervalMs);
    this.healthMonitorTimer.unref?.();
  }

  private stopHealthMonitor(): void {
    if (this.healthMonitorTimer) {
      clearInterval(this.healthMonitorTimer);
      this.healthMonitorTimer = null;
    }
  }

  private async runHealthCheck(): Promise<void> {
    if (this.healthCheckInFlight || this.wechatProviderMode === "mock") {
      return;
    }

    this.healthCheckInFlight = true;
    try {
      await this.evaluateWeChatLifecycle({ allowRestart: true });
    } catch {
      // Health checks are best-effort. Status polling will surface the latest provider error.
    } finally {
      this.healthCheckInFlight = false;
    }
  }

  private async readTranscriptState(): Promise<TranscriptState> {
    try {
      const raw = await readFile(this.transcriptPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<TranscriptState>;
      return {
        ...defaultTranscriptState(),
        ...parsed,
        messages: Array.isArray(parsed.messages) ? parsed.messages : []
      };
    } catch {
      const initialState = defaultTranscriptState();
      await this.writeTranscriptState(initialState);
      return initialState;
    }
  }

  private async writeTranscriptState(state: TranscriptState): Promise<void> {
    await mkdir(path.dirname(this.transcriptPath), { recursive: true });
    await writeFile(this.transcriptPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private trimMessages(messages: WeChatMessage[]): WeChatMessage[] {
    return messages.slice(-50);
  }

  private async appendTranscriptMessage(
    message: Omit<WeChatMessage, "id" | "createdAt"> & Partial<Pick<WeChatMessage, "id" | "createdAt">>
  ): Promise<WeChatMessage> {
    const nextMessage: WeChatMessage = {
      id: message.id ?? randomUUID(),
      createdAt: message.createdAt ?? nowIso(),
      direction: message.direction,
      text: message.text,
      senderId: message.senderId,
      senderName: message.senderName
    };
    const current = await this.readTranscriptState();
    await this.writeTranscriptState({
      updatedAt: nowIso(),
      messages: this.trimMessages([...current.messages, nextMessage])
    });
    return nextMessage;
  }

  private async listTranscriptMessages(): Promise<WeChatMessage[]> {
    const state = await this.readTranscriptState();
    return [...state.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  private async readLifecycleState(): Promise<WeChatLifecycleStateRecord> {
    try {
      const raw = await readFile(this.lifecycleStatePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<WeChatLifecycleStateRecord>;
      const providerMode = parsed.providerMode ?? this.wechatProviderMode;
      return {
        ...defaultWeChatLifecycleState(providerMode),
        ...parsed,
        providerMode,
        restartHistory: Array.isArray(parsed.restartHistory)
          ? parsed.restartHistory.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : [],
      };
    } catch {
      const initial = defaultWeChatLifecycleState(this.wechatProviderMode);
      await this.writeLifecycleState(initial);
      return initial;
    }
  }

  private async writeLifecycleState(state: WeChatLifecycleStateRecord): Promise<void> {
    await mkdir(path.dirname(this.lifecycleStatePath), { recursive: true });
    await writeFile(
      this.lifecycleStatePath,
      `${JSON.stringify({ ...state, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8"
    );
  }

  private async appendLifecycleAudit(entry: WeChatLifecycleAuditEntry): Promise<void> {
    await mkdir(path.dirname(this.lifecycleAuditPath), { recursive: true });
    await appendFile(
      this.lifecycleAuditPath,
      `${JSON.stringify({ ...entry, ts: nowIso() })}\n`,
      "utf8"
    );
  }

  private inferWeChatLifecycle(
    status: WeChatChannelStatus,
    previous: WeChatLifecycleStateRecord,
    nowMs: number,
  ): {
    state: WeChatLifecycleState;
    reason: string;
    requiresHumanAction: boolean;
    restartable: boolean;
    reconnectPausedUntil?: string | undefined;
  } {
    const notes = [status.lastError, status.lastMessage, ...(status.notes ?? [])]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" \n ");
    const updatedAtMs = Date.parse(status.updatedAt);
    const staleSocketThresholdMs = Math.max(
      DEFAULT_STALE_SOCKET_THRESHOLD_MS,
      this.healthMonitorIntervalMs * 6
    );

    const humanActionPatterns = [
      /pairing required/iu,
      /complete qr login/iu,
      /start qr login again/iu,
      /scan the code/iu,
      /start pairing again/iu,
      /invalid token/iu,
      /token missing/iu,
      /token mismatch/iu,
      /password mismatch/iu,
      /auth failed/iu,
      /install the real wechat plugin/iu,
      /enable the wechat plugin/iu,
      /ensure openclaw cli is available/iu,
      /missing saved context token/iu,
    ];
    const cooldownPatterns = [
      /cooling down/iu,
      /retry automatically/iu,
      /cooldown/iu,
    ];

    if (
      status.connected &&
      status.running &&
      Number.isFinite(updatedAtMs) &&
      nowMs - updatedAtMs > staleSocketThresholdMs &&
      previous.lastHealthyAt
    ) {
      return {
        state: "stale-socket",
        reason: "stale-socket",
        requiresHumanAction: false,
        restartable: true,
      };
    }

    if (status.connected) {
      return {
        state: "running",
        reason: "connected",
        requiresHumanAction: false,
        restartable: false,
      };
    }

    if (status.qrDataUrl || status.pairingCode) {
      return {
        state: "waiting-human-action",
        reason: "pairing",
        requiresHumanAction: true,
        restartable: false,
      };
    }

    if (matchesAnyPattern(notes, humanActionPatterns)) {
      return {
        state: "waiting-human-action",
        reason: "manual-auth-required",
        requiresHumanAction: true,
        restartable: false,
      };
    }

    if (matchesAnyPattern(notes, cooldownPatterns)) {
      const reconnectPausedUntil =
        previous.reconnectPausedUntil?.trim() ||
        new Date(Date.now() + this.restartCooldownMs).toISOString();
      return {
        state: "reconnecting",
        reason: "cooldown",
        requiresHumanAction: false,
        restartable: false,
        reconnectPausedUntil,
      };
    }

    if (!status.configured && this.wechatProviderMode !== "mock") {
      return {
        state: "waiting-human-action",
        reason: "not-configured",
        requiresHumanAction: true,
        restartable: false,
      };
    }

    if (
      status.running &&
      !status.connected &&
      previous.consecutiveUnhealthyChecks + 1 >= this.unhealthyThreshold + 1
    ) {
      return {
        state: "stuck",
        reason: "stuck",
        requiresHumanAction: false,
        restartable: true,
      };
    }

    if (status.linked && !status.connected) {
      return {
        state: "reconnecting",
        reason: status.running ? "linked-disconnected" : "linked-not-running",
        requiresHumanAction: false,
        restartable: true,
      };
    }

    if (!status.running && (status.configured || status.linked)) {
      return {
        state: "disconnected",
        reason: "not-running",
        requiresHumanAction: false,
        restartable: true,
      };
    }

    if (status.gatewayReachable === false && status.pluginInstalled !== false) {
      return {
        state: "disconnected",
        reason: "gateway-unreachable",
        requiresHumanAction: false,
        restartable: true,
      };
    }

    return {
      state: "waiting-human-action",
      reason: "login-required",
      requiresHumanAction: true,
      restartable: false,
    };
  }

  private canRestartLifecycle(record: WeChatLifecycleStateRecord, nowMs: number): {
    allowed: boolean;
    reconnectPausedUntil?: string | undefined;
    reason?: string | undefined;
  } {
    const history = trimRestartHistory(record.restartHistory, nowMs);
    if (history.length >= this.maxRestartsPerHour) {
      return {
        allowed: false,
        reason: "restart-budget-exhausted",
      };
    }

    const lastRestartAtMs = record.lastRestartAt ? Date.parse(record.lastRestartAt) : Number.NaN;
    if (Number.isFinite(lastRestartAtMs) && nowMs - lastRestartAtMs < this.restartCooldownMs) {
      return {
        allowed: false,
        reason: "restart-cooldown",
        reconnectPausedUntil: new Date(lastRestartAtMs + this.restartCooldownMs).toISOString(),
      };
    }

    return { allowed: true };
  }

  private async getRawWeChatStatus(): Promise<WeChatChannelStatus> {
    if (this.wechatProviderMode === "native") {
      return this.nativeProvider!.getStatus();
    }
    if (this.wechatProviderMode === "openclaw") {
      return this.openClawBridge!.getWeChatStatus();
    }
    return this.mockProvider!.getStatus();
  }

  private async restartWeChatProvider(): Promise<void> {
    if (this.wechatProviderMode === "native") {
      await this.nativeProvider?.close?.();
      await this.nativeProvider?.start?.();
      return;
    }
    if (this.wechatProviderMode === "openclaw") {
      await this.openClawBridge?.close?.();
      await this.openClawBridge?.start?.();
      return;
    }
    await this.mockProvider?.close?.();
    await this.mockProvider?.start?.();
  }

  private async evaluateWeChatLifecycle(options: {
    allowRestart: boolean;
  }): Promise<WeChatChannelStatus> {
    const rawStatus = await this.getRawWeChatStatus();
    const previous = await this.readLifecycleState();
    const nowMs = Date.now();
    const inferred = this.inferWeChatLifecycle(rawStatus, previous, nowMs);
    const priorHistory = trimRestartHistory(previous.restartHistory, nowMs);
    const nextFirstUnhealthyAt =
      inferred.state === "running" || inferred.requiresHumanAction
        ? undefined
        : previous.firstUnhealthyAt?.trim() || nowIso();

    const baseRecord: WeChatLifecycleStateRecord = {
      providerMode: this.wechatProviderMode,
      state: inferred.state,
      reason: inferred.reason,
      updatedAt: nowIso(),
      requiresHumanAction: inferred.requiresHumanAction,
      consecutiveUnhealthyChecks:
        inferred.state === "running" || inferred.requiresHumanAction
          ? 0
          : previous.consecutiveUnhealthyChecks + 1,
      restartHistory: priorHistory,
      ...(nextFirstUnhealthyAt ? { firstUnhealthyAt: nextFirstUnhealthyAt } : {}),
      ...(inferred.state === "running"
        ? { lastHealthyAt: nowIso() }
        : previous.lastHealthyAt
          ? { lastHealthyAt: previous.lastHealthyAt }
          : {}),
      ...(rawStatus.lastError ? { lastError: rawStatus.lastError } : {}),
      ...(inferred.reconnectPausedUntil ? { reconnectPausedUntil: inferred.reconnectPausedUntil } : {}),
      ...(previous.lastRestartAt ? { lastRestartAt: previous.lastRestartAt } : {}),
    };

    if (previous.state !== baseRecord.state || previous.reason !== baseRecord.reason) {
      await this.appendLifecycleAudit({
        providerMode: this.wechatProviderMode,
        event: "lifecycle-transition",
        state: baseRecord.state,
        reason: baseRecord.reason,
        details: {
          previousState: previous.state,
          previousReason: previous.reason,
          consecutiveUnhealthyChecks: baseRecord.consecutiveUnhealthyChecks,
        }
      });
    }

    if (
      options.allowRestart &&
      inferred.restartable &&
      baseRecord.consecutiveUnhealthyChecks >= this.unhealthyThreshold &&
      !this.restartInFlight
    ) {
      const restartPolicy = this.canRestartLifecycle(baseRecord, nowMs);
      if (!restartPolicy.allowed) {
        const blockedRecord: WeChatLifecycleStateRecord = {
          ...baseRecord,
          state: restartPolicy.reason === "restart-budget-exhausted" ? "failed" : baseRecord.state,
          reason: restartPolicy.reason ?? baseRecord.reason,
          ...(restartPolicy.reconnectPausedUntil
            ? { reconnectPausedUntil: restartPolicy.reconnectPausedUntil }
            : {}),
        };
        await this.writeLifecycleState(blockedRecord);
        await this.appendLifecycleAudit({
          providerMode: this.wechatProviderMode,
          event: "auto-restart-blocked",
          state: blockedRecord.state,
          reason: blockedRecord.reason,
          details: {
            restartCount: blockedRecord.restartHistory.length,
            reconnectPausedUntil: blockedRecord.reconnectPausedUntil ?? null,
          }
        });
        return {
          ...rawStatus,
          lifecycleState: blockedRecord.state,
          lifecycleReason: blockedRecord.reason,
          requiresHumanAction: blockedRecord.requiresHumanAction,
          reconnectPausedUntil: blockedRecord.reconnectPausedUntil,
          lastHealthyAt: blockedRecord.lastHealthyAt,
          lastRestartAt: blockedRecord.lastRestartAt,
          restartCount: blockedRecord.restartHistory.length,
          notes: [
            ...(rawStatus.notes ?? []),
            restartPolicy.reason === "restart-budget-exhausted"
              ? "Automatic restart budget exhausted. Manual inspection is required."
              : `Automatic restart cooling down until ${restartPolicy.reconnectPausedUntil}.`,
          ],
        };
      }

      this.restartInFlight = true;
      const restartAt = nowIso();
      const restartingRecord: WeChatLifecycleStateRecord = {
        ...baseRecord,
        state: "reconnecting",
        reason: "auto-restart",
        lastRestartAt: restartAt,
        reconnectPausedUntil: new Date(nowMs + this.restartCooldownMs).toISOString(),
        restartHistory: [...priorHistory, restartAt],
      };
      await this.writeLifecycleState(restartingRecord);
      await this.appendLifecycleAudit({
        providerMode: this.wechatProviderMode,
        event: "auto-restart-scheduled",
        state: restartingRecord.state,
        reason: restartingRecord.reason,
        details: {
          restartCount: restartingRecord.restartHistory.length,
          previousState: baseRecord.state,
          previousReason: baseRecord.reason,
        }
      });

      try {
        await this.restartWeChatProvider();
        const recoveredStatus = await this.getRawWeChatStatus();
        const recoveredInference = this.inferWeChatLifecycle(recoveredStatus, restartingRecord, Date.now());
        const recoveredRecord: WeChatLifecycleStateRecord = {
          ...restartingRecord,
          state: recoveredInference.state,
          reason: recoveredInference.state === "running" ? "recovered" : recoveredInference.reason,
          requiresHumanAction: recoveredInference.requiresHumanAction,
          consecutiveUnhealthyChecks: recoveredInference.state === "running" ? 0 : restartingRecord.consecutiveUnhealthyChecks,
          firstUnhealthyAt: recoveredInference.state === "running" ? undefined : restartingRecord.firstUnhealthyAt,
          ...(recoveredInference.state === "running" ? { lastHealthyAt: nowIso() } : {}),
        };
        await this.writeLifecycleState(recoveredRecord);
        await this.appendLifecycleAudit({
          providerMode: this.wechatProviderMode,
          event: "auto-restart-completed",
          state: recoveredRecord.state,
          reason: recoveredRecord.reason,
          details: {
            restartCount: recoveredRecord.restartHistory.length,
          }
        });
        return {
          ...recoveredStatus,
          lifecycleState: recoveredRecord.state,
          lifecycleReason: recoveredRecord.reason,
          requiresHumanAction: recoveredRecord.requiresHumanAction,
          reconnectPausedUntil: recoveredRecord.reconnectPausedUntil,
          lastHealthyAt: recoveredRecord.lastHealthyAt,
          lastRestartAt: recoveredRecord.lastRestartAt,
          restartCount: recoveredRecord.restartHistory.length,
          notes: [
            ...(recoveredStatus.notes ?? []),
            "Automatic provider recovery is active.",
          ],
        };
      } catch (error) {
        const failedRecord: WeChatLifecycleStateRecord = {
          ...restartingRecord,
          state: "failed",
          reason: "restart-failed",
          requiresHumanAction: false,
          lastError: error instanceof Error ? error.message : String(error),
        };
        await this.writeLifecycleState(failedRecord);
        await this.appendLifecycleAudit({
          providerMode: this.wechatProviderMode,
          event: "auto-restart-failed",
          state: failedRecord.state,
          reason: failedRecord.reason,
          details: {
            restartCount: failedRecord.restartHistory.length,
            lastError: failedRecord.lastError ?? null,
          }
        });
        return {
          ...rawStatus,
          lifecycleState: failedRecord.state,
          lifecycleReason: failedRecord.reason,
          requiresHumanAction: failedRecord.requiresHumanAction,
          reconnectPausedUntil: failedRecord.reconnectPausedUntil,
          lastHealthyAt: failedRecord.lastHealthyAt,
          lastRestartAt: failedRecord.lastRestartAt,
          restartCount: failedRecord.restartHistory.length,
          lastError: failedRecord.lastError,
          notes: [
            ...(rawStatus.notes ?? []),
            "Automatic restart failed. ReAgent will wait for the next health cycle or manual intervention.",
          ],
        };
      } finally {
        this.restartInFlight = false;
      }
    }

    await this.writeLifecycleState(baseRecord);
    return {
      ...rawStatus,
      lifecycleState: baseRecord.state,
      lifecycleReason: baseRecord.reason,
      requiresHumanAction: baseRecord.requiresHumanAction,
      reconnectPausedUntil: baseRecord.reconnectPausedUntil,
      lastHealthyAt: baseRecord.lastHealthyAt,
      lastRestartAt: baseRecord.lastRestartAt,
      restartCount: baseRecord.restartHistory.length,
    };
  }

  private async getWeChatStatus(): Promise<WeChatChannelStatus> {
    return this.evaluateWeChatLifecycle({ allowRestart: false });
  }

  private async handleWeChatInput(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    let reply: string;
    let researchTaskId: string | undefined;

    if (message === "/research" || message.startsWith("/research ")) {
      const topic = message.slice("/research".length).trim();
      if (!topic) {
        reply = "Usage: /research <topic>";
      } else {
        const report = await this.researchService.runResearch({
          topic,
          question: `WeChat request from ${input.senderName?.trim() || input.senderId}: ${topic}`,
          maxPapers: 10
        });
        researchTaskId = report.taskId;
        reply = buildResearchReply(report);
      }
    } else if (message === "/memory" || message.startsWith("/memory ")) {
      const query = message.slice("/memory".length).trim();
      if (!query) {
        reply = "Usage: /memory <query>";
      } else {
        const hits = await this.memoryService.search(query, 4);
        reply = buildMemoryReply(query, hits);
      }
    } else if (message === "/remember" || message.startsWith("/remember ")) {
      const content = message.slice("/remember".length).trim();
      if (!content) {
        reply = "Usage: /remember <fact>";
      } else {
        await this.memoryService.remember({
          scope: "daily",
          title: `WeChat note from ${input.senderName?.trim() || input.senderId}`,
          content,
          source: "wechat"
        });
        reply = "Saved to today's memory file.";
      }
    } else if (message === "/feedback" || message.startsWith("/feedback ")) {
      const content = message.slice("/feedback".length).trim();
      if (!content) {
        reply = "Usage: /feedback <useful|not-useful|more-like-this|less-like-this|too-theoretical|too-engineering-heavy|worth-following|not-worth-following> [notes]";
      } else {
        const [rawSignal, ...rest] = content.split(/\s+/u);
        const signal = rawSignal?.trim().toLowerCase();
        const feedbackSignals = new Set([
          "useful",
          "not-useful",
          "more-like-this",
          "less-like-this",
          "too-theoretical",
          "too-engineering-heavy",
          "worth-following",
          "not-worth-following"
        ]);

        if (!signal || !feedbackSignals.has(signal)) {
          reply = "Unsupported feedback signal. Use one of: useful, not-useful, more-like-this, less-like-this, too-theoretical, too-engineering-heavy, worth-following, not-worth-following";
        } else {
          const notes = rest.join(" ").trim();
          const record = await this.feedbackService.record({
            feedback: signal as
              | "useful"
              | "not-useful"
              | "more-like-this"
              | "less-like-this"
              | "too-theoretical"
              | "too-engineering-heavy"
              | "worth-following"
              | "not-worth-following",
            senderId: input.senderId,
            senderName: input.senderName,
            ...(notes ? { notes } : {})
          });
          reply = `Recorded feedback: ${record.feedback}.${record.notes ? ` Notes: ${record.notes}` : ""}`;
        }
      }
    } else if (message === "/role" || message.startsWith("/role ")) {
      if (!hasAgentRuntimeControls(this.chatService)) {
        reply = "Agent role controls are unavailable in the current chat backend.";
      } else {
        const requestedRole = message.slice("/role".length).trim();
        if (!requestedRole) {
          const summary = await this.chatService.describeSession(input.senderId);
          reply = [
            `Current role: ${summary.roleLabel} (${summary.roleId})`,
            `Available roles: ${summary.availableRoles.map((role) => `${role.id}`).join(", ")}`
          ].join("\n");
        } else {
          const summary = await this.chatService.setRole(input.senderId, requestedRole);
          reply = `Agent role set to ${summary.roleLabel} (${summary.roleId}).`;
        }
      }
    } else if (message === "/skills") {
      if (!hasAgentRuntimeControls(this.chatService)) {
        reply = "Agent skill inspection is unavailable in the current chat backend.";
      } else {
        const summary = await this.chatService.describeSession(input.senderId);
        reply = [
          `Current role: ${summary.roleLabel} (${summary.roleId})`,
          `Active skills: ${summary.skillLabels.join(", ")}`,
          `Model route: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`
        ].join("\n");
      }
    } else if (message === "/model" || message.startsWith("/model ")) {
      if (!hasAgentRuntimeControls(this.chatService)) {
        reply = "Agent model controls are unavailable in the current chat backend.";
      } else {
        const requested = message.slice("/model".length).trim();
        if (!requested) {
          const summary = await this.chatService.describeSession(input.senderId);
          const available = summary.availableLlmProviders
            .map((provider) => {
              const models =
                "models" in provider && Array.isArray((provider as { models?: Array<{ id: string }> }).models)
                  ? (provider as { models: Array<{ id: string }> }).models.map((model) => model.id).join(", ")
                  : "";
              return models ? `${provider.id}: ${models}` : provider.id;
            })
            .join(" | ");
          reply = [
            `Current model route: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
            `Status: ${summary.llmStatus} (${summary.llmSource})`,
            `Available providers: ${available || "none"}`
          ].join("\n");
        } else if (requested.toLowerCase() === "default" || requested.toLowerCase() === "inherit") {
          const summary = await this.chatService.clearModel(input.senderId);
          reply = `Agent model route reset to default: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}.`;
        } else {
          const [providerId, modelId] = requested.split(/\s+/u);
          if (!providerId || !modelId) {
            reply = "Usage: /model <providerId> <modelId> or /model default";
          } else {
            const summary = await this.chatService.setModel(input.senderId, providerId, modelId);
            reply = `Agent model route set to ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}.`;
          }
        }
      }
    } else if (message === "/fallbacks" || message.startsWith("/fallbacks ")) {
      if (!hasAgentRuntimeControls(this.chatService)) {
        reply = "Agent fallback controls are unavailable in the current chat backend.";
      } else {
        const requested = message.slice("/fallbacks".length).trim();
        if (!requested) {
          const summary = await this.chatService.describeSession(input.senderId);
          reply = [
            `Current model route: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
            `Fallbacks: ${
              summary.fallbackRoutes.length
                ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
                : "none"
            }`
          ].join("\n");
        } else if (requested.toLowerCase() === "clear" || requested.toLowerCase() === "none") {
          const summary = await this.chatService.setFallbacks(input.senderId, []);
          reply = `Agent model fallbacks cleared. Primary route remains ${summary.providerLabel}/${summary.modelLabel}.`;
        } else {
          const selections = requested
            .split(/[,\n]/u)
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
              const [providerId, modelId] = entry.split(/[/:]/u);
              return {
                providerId: providerId?.trim() || "",
                modelId: modelId?.trim() || ""
              };
            })
            .filter((entry) => entry.providerId && entry.modelId);
          if (selections.length === 0) {
            reply = "Usage: /fallbacks <providerId/modelId, providerId/modelId> or /fallbacks clear";
          } else {
            const summary = await this.chatService.setFallbacks(input.senderId, selections);
            reply = `Agent model fallbacks set to ${summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")}.`;
          }
        }
      }
    } else if (message === "/reasoning" || message.startsWith("/reasoning ")) {
      if (!hasAgentRuntimeControls(this.chatService)) {
        reply = "Agent reasoning controls are unavailable in the current chat backend.";
      } else {
        const requested = message.slice("/reasoning".length).trim().toLowerCase();
        if (!requested) {
          const summary = await this.chatService.describeSession(input.senderId);
          reply = [
            `Current reasoning effort: ${summary.reasoningEffort}`,
            `Options: ${summary.availableReasoningEfforts.join(", ")}`
          ].join("\n");
        } else {
          const summary = await this.chatService.setReasoning(input.senderId, requested);
          reply = `Agent reasoning effort set to ${summary.reasoningEffort}.`;
        }
      }
    } else if (message.startsWith("/")) {
      reply = buildCommandHelpReply();
    } else {
      reply = await this.chatService.reply(input);
    }

    return {
      accepted: true,
      reply,
      researchTaskId
    };
  }

  async receiveUiChatMessage(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    if (!message) {
      return {
        accepted: false,
        reply: "Please enter a message."
      };
    }

    await this.appendTranscriptMessage({
      direction: "inbound",
      senderId: input.senderId,
      senderName: input.senderName,
      text: message
    });

    const result = await this.handleWeChatInput(input);

    await this.appendTranscriptMessage({
      direction: "outbound",
      senderId: input.senderId,
      senderName: input.senderName,
      text: result.reply
    });

    return result;
  }

  private async appendOpenClawOutboundReply(reply: string): Promise<WeChatInboundResult> {
    await this.appendTranscriptMessage({
      direction: "outbound",
      text: reply
    });
    return {
      accepted: true,
      reply
    };
  }

  async getStatusSnapshot(): Promise<ChannelsStatusSnapshot> {
    return {
      ts: Date.now(),
      channelOrder: ["wechat"],
      channelLabels: { wechat: "WeChat" },
      channels: {
        wechat: await this.getWeChatStatus()
      }
    };
  }

  async startWeChatLogin(force: boolean, displayName?: string): Promise<WeChatLoginStartResult> {
    if (this.wechatProviderMode === "native") {
      return this.nativeProvider!.startLogin(force, displayName);
    }
    if (this.wechatProviderMode === "openclaw") {
      const result = await this.openClawBridge!.startLogin(force);
      await this.appendTranscriptMessage({
        direction: "system",
        text: result.message
      });
      return result;
    }
    return this.mockProvider!.startLogin(force);
  }

  async completeWeChatLogin(displayName?: string): Promise<WeChatChannelStatus> {
    if (this.wechatProviderMode === "native") {
      await this.nativeProvider!.completeLogin(displayName);
      return this.evaluateWeChatLifecycle({ allowRestart: false });
    }
    if (this.wechatProviderMode === "openclaw") {
      const result = await this.openClawBridge!.waitLogin();
      await this.appendTranscriptMessage({
        direction: "system",
        text: result.message
      });
      return this.evaluateWeChatLifecycle({ allowRestart: false });
    }
    return this.mockProvider!.completeLogin(displayName);
  }

  async logoutWeChat(): Promise<WeChatChannelStatus> {
    if (this.wechatProviderMode === "native") {
      await this.nativeProvider!.logout();
      return this.evaluateWeChatLifecycle({ allowRestart: false });
    }
    if (this.wechatProviderMode === "openclaw") {
      const status = await this.openClawBridge!.logout();
      await this.appendTranscriptMessage({
        direction: "system",
        text: status.lastMessage ?? "Disconnected WeChat session."
      });
      return this.evaluateWeChatLifecycle({ allowRestart: false });
    }
    return this.mockProvider!.logout();
  }

  async listUiChatMessages(): Promise<WeChatMessage[]> {
    return this.listTranscriptMessages();
  }

  async getAgentSession(senderId: string): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent session controls are unavailable in the current chat backend.");
    }

    return this.chatService.describeSession(senderId);
  }

  async listAgentSessions(): Promise<
    Array<{
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
    }>
  > {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent session controls are unavailable in the current chat backend.");
    }

    return this.chatService.listSessions();
  }

  async setAgentRole(senderId: string, roleId: string): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent role controls are unavailable in the current chat backend.");
    }

    return this.chatService.setRole(senderId, roleId);
  }

  async setAgentSkills(senderId: string, skillIds: string[]): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent skill controls are unavailable in the current chat backend.");
    }

    return this.chatService.setSkills(senderId, skillIds);
  }

  async setAgentModel(senderId: string, providerId: string, modelId: string): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent model controls are unavailable in the current chat backend.");
    }

    return this.chatService.setModel(senderId, providerId, modelId);
  }

  async clearAgentModel(senderId: string): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent model controls are unavailable in the current chat backend.");
    }

    return this.chatService.clearModel(senderId);
  }

  async setAgentFallbacks(
    senderId: string,
    selections: Array<{ providerId: string; modelId: string }>
  ): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent fallback controls are unavailable in the current chat backend.");
    }

    return this.chatService.setFallbacks(senderId, selections);
  }

  async setAgentReasoning(
    senderId: string,
    reasoningEffort: string
  ): Promise<{
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
    fallbackRoutes: Array<{
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    }>;
    reasoningEffort: string;
    defaultRoute: {
      providerId: string;
      providerLabel: string;
      modelId: string;
      modelLabel: string;
      llmStatus: "ready" | "needs-setup" | "disabled";
      llmSource: "registry" | "env";
      wireApi?: string | undefined;
    };
    availableRoles: Array<{ id: string; label: string }>;
    availableSkills: Array<{ id: string; label: string }>;
    availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
    availableReasoningEfforts: string[];
  }> {
    if (!hasAgentRuntimeControls(this.chatService)) {
      throw new Error("Agent reasoning controls are unavailable in the current chat backend.");
    }

    return this.chatService.setReasoning(senderId, reasoningEffort);
  }

  async listWeChatMessages(): Promise<WeChatMessage[]> {
    const transcriptMessages = await this.listTranscriptMessages();

    if (this.wechatProviderMode === "native") {
      return mergeMessages(await this.nativeProvider!.listMessages(), transcriptMessages);
    }
    if (this.wechatProviderMode === "openclaw") {
      return transcriptMessages;
    }
    return mergeMessages(await this.mockProvider!.listMessages(), transcriptMessages);
  }

  async pushWeChatMessage(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    if (!message) {
      throw new Error("Push text cannot be empty.");
    }

    if (this.wechatProviderMode === "native") {
      return this.nativeProvider!.pushMessage(input);
    }

    if (this.wechatProviderMode === "openclaw") {
      throw new Error("Proactive push is not implemented for the OpenClaw bridge yet.");
    }

    return this.mockProvider!.pushOutbound(input.senderId, message, input.senderName);
  }
  async receiveWeChatMessage(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
  }): Promise<WeChatInboundResult> {
    if (this.wechatProviderMode === "native") {
      return this.nativeProvider!.receiveManualMessage(input);
    }

    const message = input.text.trim();
    if (this.wechatProviderMode === "openclaw") {
      const status = await this.getWeChatStatus();
      if (!status.connected) {
        throw new Error("WeChat is not connected. Complete QR login before sending inbound messages.");
      }
      await this.appendTranscriptMessage({
        direction: "inbound",
        senderId: input.senderId,
        senderName: input.senderName,
        text: message
      });
      const result = await this.handleWeChatInput(input);
      const outbound = await this.appendOpenClawOutboundReply(result.reply);
      return {
        ...outbound,
        researchTaskId: result.researchTaskId
      };
    }

    await this.mockProvider!.appendInbound(input.senderId, message, input.senderName);
    const result = await this.handleWeChatInput(input);
    const outbound = await this.mockProvider!.appendOutbound(result.reply);
    return {
      ...outbound,
      researchTaskId: result.researchTaskId
    };
  }
}
