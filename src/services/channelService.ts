import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchService } from "./researchService.js";
import type { MemoryService } from "./memoryService.js";
import { MemoryCompactionService } from "./memoryCompactionService.js";
import {
  createSafeAndMaintenanceHandlers,
  createSessionControlHandlers,
  createWorkspaceMutationHandlers,
  type InboundCommandExecutionResult,
  type SessionControlSummary,
} from "./inboundCommandHandlers.js";
import {
  INBOUND_SLASH_COMMAND_SPECS,
  formatInboundCommandUsage,
  parseInboundSlashCommand,
  resolveAllowedSourcesForInboundCommand,
  type InboundSlashCommandSpec,
  type InboundSlashCommandTier,
} from "./inboundCommandRegistry.js";
import { MemoryRecallService } from "./memoryRecallService.js";
import { InboundCommandPolicyService, type RemoteAuthorizedCommandTier } from "./inboundCommandPolicyService.js";
import { ChatService, type ChatServiceLike } from "./chatService.js";
import { OpenClawRuntimeStateService } from "./openClawRuntimeStateService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchDiscoveryService } from "./researchDiscoveryService.js";
import { ResearchFeedbackService } from "./researchFeedbackService.js";
import type { MemoryRecallHit } from "../types/memory.js";
import type {
  ChannelsStatusSnapshot,
  OpenClawEventAuditEntry,
  OpenClawSessionRegistryEntry,
  WeChatLifecycleAuditEntry,
  WeChatLifecycleState,
  WeChatChannelStatus,
  WeChatInboundResult,
  WeChatLoginStartResult,
  WeChatMessage,
  WeChatProviderMode
} from "../types/channels.js";
import { MockWeChatChannelProvider } from "../providers/channels/mockWeChatChannelProvider.js";
import { NativeWeChatChannelProvider } from "../providers/channels/nativeWeChatChannelProvider.js";
import { OpenClawBridgeService, type OpenClawSessionSummary } from "./openClawBridgeService.js";

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
  directionService?: Pick<ResearchDirectionService, "listProfiles" | "upsertProfile">;
  discoveryService?: Pick<ResearchDiscoveryService, "runDiscovery">;
  healthMonitor?: {
    intervalMs?: number | undefined;
    restartCooldownMs?: number | undefined;
    unhealthyThreshold?: number | undefined;
    maxRestartsPerHour?: number | undefined;
  } | undefined;
}

type OpenClawSendCapableBridge = Pick<OpenClawBridgeService, "sendMessage">;
type OpenClawEventCapableBridge = Pick<OpenClawBridgeService, "watchSessionEvents">;
type OpenClawSessionSendCapableBridge = Pick<OpenClawBridgeService, "sendSessionMessage">;

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

type InboundMessageIntent = "plain-chat" | "agent-runtime";

const AGENT_RUNTIME_INTENT_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/iu,
  /\b(arxiv|github|paper|repo|repository|pdf|baseline|benchmark|dataset|memory|recall|remember|research|brief|discovery|direction|report|presentation|artifact)\b/iu,
  /(论文|文献|仓库|代码库|代码仓|链接|网页|调研|研究|分析|记住|记下来|回忆|检索|方向|报告|汇报|演示|幻灯片|基线|数据集|复现|模型路由|技能|角色)/iu,
];

function classifyInboundMessageIntent(message: string): InboundMessageIntent {
  const normalized = message.trim();
  if (!normalized) {
    return "plain-chat";
  }

  return matchesAnyPattern(normalized, AGENT_RUNTIME_INTENT_PATTERNS) ? "agent-runtime" : "plain-chat";
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function normalizeIntentSubject(value: string): string {
  return value
    .trim()
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu, "")
    .replace(/[.?!,;:。！？，；：]+$/gu, "")
    .trim();
}

function extractDirectionLabelFromIntent(message: string): string | null {
  const normalized = message.trim().replace(/\s+/gu, " ");
  if (!normalized) {
    return null;
  }

  const patterns = [
    /^(?:please\s+)?(?:set|make|track|follow|watch)\s+(.+?)\s+(?:as|for)\s+(?:my\s+)?(?:research\s+)?(?:direction|topic)$/iu,
    /^(?:help\s+me\s+)?(?:set|track|follow)\s+(?:my\s+)?(?:research\s+)?(?:direction|topic)\s*[:\-]?\s*(.+)$/iu,
    /^(?:research\s+direction|research\s+topic)\s*[:\-]?\s*(.+)$/iu,
    /^(?:帮我)?(?:把|将)?(.+?)(?:设为|设置为|作为)?(?:研究方向|关注方向|跟踪方向)$/u,
    /^(?:帮我)?(?:设置|设定)(?:我的)?(?:研究方向|关注方向)\s*[:：\-]?\s*(.+)$/u,
    /^(?:研究方向|关注方向)\s*[:：\-]?\s*(.+)$/u,
  ];

  for (const pattern of patterns) {
    const matched = normalized.match(pattern)?.[1];
    const label = normalizeIntentSubject(matched ?? "");
    if (!label) {
      continue;
    }
    if (/^(?:direction|topic|research direction|research topic|研究方向|关注方向)$/iu.test(label)) {
      continue;
    }
    return label.slice(0, 120);
  }

  return null;
}

function isTodayPapersIntent(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }

  const hasPaperKeyword = /\b(paper|papers|article|articles)\b/iu.test(normalized) || /(论文|文献)/u.test(normalized);
  const hasRecentness =
    /\b(today|today's|recent|latest|new)\b/iu.test(normalized) || /(今天|今日|最近|最新)/u.test(normalized);
  const hasRequestVerb =
    /\b(push|send|show|share|recommend|surface|find|what)\b/iu.test(normalized) ||
    /(推送|发送|发我|给我看|看看|整理|推荐|找|有什么|有哪些)/u.test(normalized);

  return hasPaperKeyword && hasRecentness && (hasRequestVerb || normalized.length <= 12);
}

function buildDirectionSavedReply(label: string, preferChinese: boolean): string {
  return preferChinese
    ? `已经把“${label}”记成研究方向了。\n你接下来可以直接说“推送今天的论文”或者“帮我总结这篇论文”。`
    : `Saved "${label}" as a research direction.\nYou can now say "push today's papers" or "summarize this paper".`;
}

function buildMissingDirectionReply(preferChinese: boolean): string {
  return preferChinese
    ? "我这边还没有已启用的研究方向。你可以先说“把半监督图像学习设为研究方向”，我再帮你推今天的论文。"
    : "I do not have an enabled research direction yet. Say something like \"set semi-supervised image learning as my research direction\" first, and then I can surface today's papers.";
}

function formatDiscoveryReply(
  result: Awaited<ReturnType<ResearchDiscoveryService["runDiscovery"]>>,
  preferChinese: boolean,
): string {
  const labels = result.directionLabels.join("、");
  if (result.items.length === 0) {
    return preferChinese
      ? `今天还没筛到足够强的候选论文${labels ? `，当前方向是：${labels}` : ""}。`
      : `I did not find strong paper candidates for today${labels ? ` across: ${labels}` : ""}.`;
  }

  const lines = preferChinese
    ? [`今天先给你筛了 ${result.items.length} 篇更值得看的论文${labels ? `，方向：${labels}` : ""}：`, ""]
    : [`I picked ${result.items.length} paper candidates for today${labels ? ` across ${labels}` : ""}:`, ""];

  for (const [index, item] of result.items.entries()) {
    const rank = item.rank ?? index + 1;
    const metadata = [item.year, item.venue, item.directionLabel].filter(Boolean).join(" | ");
    const reasons = [...(item.rankingReasons ?? []), item.relevanceReason ?? ""].filter(Boolean).slice(0, 2).join(" ");
    lines.push(`${rank}. ${item.title}`);
    if (metadata) {
      lines.push(metadata);
    }
    if (reasons) {
      lines.push(preferChinese ? `推荐理由：${reasons}` : `Why: ${reasons}`);
    }
    lines.push(preferChinese ? `链接：${item.url}` : `Link: ${item.url}`);
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push(preferChinese ? `备注：${result.warnings[0]}` : `Note: ${result.warnings[0]}`);
  }

  return lines.join("\n").trim();
}

function buildIntentFailureReply(error: unknown, preferChinese: boolean): string {
  const message = error instanceof Error ? error.message : String(error);
  return preferChinese
    ? `这一步我没有成功跑完：${message}`
    : `I could not finish that step: ${message}`;
}

function hasPlainChatSupport(
  chatService: ChatServiceLike,
): chatService is ChatServiceLike & {
  plainReply(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
    source?: "direct" | "ui" | "wechat" | "openclaw" | undefined;
  }): Promise<string>;
} {
  return typeof (chatService as { plainReply?: unknown }).plainReply === "function";
}

function hasOpenClawSendSupport(
  bridge: OpenClawBridgeService | null,
): bridge is OpenClawBridgeService & OpenClawSendCapableBridge {
  return Boolean(bridge) && typeof (bridge as { sendMessage?: unknown }).sendMessage === "function";
}

function hasOpenClawEventSupport(
  bridge: OpenClawBridgeService | null,
): bridge is OpenClawBridgeService & OpenClawEventCapableBridge {
  return Boolean(bridge) && typeof (bridge as { watchSessionEvents?: unknown }).watchSessionEvents === "function";
}

function hasOpenClawSessionSendSupport(
  bridge: OpenClawBridgeService | null,
): bridge is OpenClawBridgeService & OpenClawSessionSendCapableBridge {
  return Boolean(bridge) && typeof (bridge as { sendSessionMessage?: unknown }).sendSessionMessage === "function";
}

function extractOpenClawEventText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }
  const record = message as { content?: unknown };
  if (Array.isArray(record.content)) {
    return record.content
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const part = entry as { text?: unknown };
        return typeof part.text === "string" && part.text.trim() ? [part.text.trim()] : [];
      })
      .join("\n")
      .trim();
  }
  return "";
}

function buildCommandHelpReply(unknownCommand?: string): string {
  const lines = [
    ...(unknownCommand ? [`Unknown command: ${unknownCommand}`, ""] : []),
    "Supported commands:",
    ...INBOUND_SLASH_COMMAND_SPECS.map((spec) => formatInboundCommandUsage(spec)),
    "",
    "Direct chat is also available without a leading slash."
  ];
  return lines.join("\n");
}

function buildCommandStatusReply(input: {
  wechatStatus: WeChatChannelStatus;
  sessionSummary?: AgentRuntimeSummaryShape | null;
}): string {
  const { wechatStatus, sessionSummary } = input;
  const lines = [
    `Provider mode: ${wechatStatus.providerMode}`,
    `Connected: ${wechatStatus.connected ? "yes" : "no"}`,
    `Configured: ${wechatStatus.configured ? "yes" : "no"}`,
    `Running: ${wechatStatus.running ? "yes" : "no"}`,
    `Account: ${wechatStatus.accountId ?? "-"}`,
  ];

  if (!sessionSummary) {
    lines.push("Agent session controls: unavailable");
    return lines.join("\n");
  }

  lines.push(`Role: ${sessionSummary.roleLabel} (${sessionSummary.roleId})`);
  lines.push(`Skills: ${sessionSummary.skillLabels.join(", ") || "-"}`);
  lines.push(
    `Model: ${sessionSummary.providerLabel}/${sessionSummary.modelLabel}${sessionSummary.wireApi ? ` via ${sessionSummary.wireApi}` : ""}`,
  );
  lines.push(`Model status: ${sessionSummary.llmStatus} (${sessionSummary.llmSource})`);
  lines.push(
    `Fallbacks: ${
      sessionSummary.fallbackRoutes.length > 0
        ? sessionSummary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
        : "none"
    }`,
  );
  lines.push(`Reasoning: ${sessionSummary.reasoningEffort}`);
  return lines.join("\n");
}

function buildCommandSourceBlockedReply(spec: InboundSlashCommandSpec): string {
  const allowedSources = resolveAllowedSourcesForInboundCommand(spec);
  if (allowedSources.length === 1 && allowedSources[0] === "ui") {
    return `Command ${spec.usage.split(" ")[0]} is only available from the local UI/runtime control surface.`;
  }

  const allowed = allowedSources.join(", ") || "the allowed control surfaces";
  return `Command ${spec.usage.split(" ")[0]} (${spec.tier}) is not available from this entry surface. Allowed sources: ${allowed}.`;
}

function toRemoteAuthorizedCommandTier(
  tier: InboundSlashCommandTier,
): RemoteAuthorizedCommandTier | null {
  if (tier === "workspace-mutation" || tier === "session-control") {
    return tier;
  }
  return null;
}

function buildCommandAuthorizationBlockedReply(input: {
  spec: InboundSlashCommandSpec;
  senderId: string;
  allowlist: string[];
}): string {
  const command = input.spec.usage.split(" ")[0];
  const allowlistSummary = input.allowlist.length > 0 ? input.allowlist.join(", ") : "(empty)";
  return `Command ${command} (${input.spec.tier}) is not authorized for sender ${input.senderId}. Allowed senders: ${allowlistSummary}.`;
}

type AgentRuntimeSummaryShape = SessionControlSummary;

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

function buildMemoryReply(query: string, hits: MemoryRecallHit[]): string {
  if (hits.length === 0) {
    return `No memory hits found for \"${query}\".`;
  }

  return [
    `Memory hits for \"${query}\":`,
    ...hits.map(
      (hit, index) =>
        `${index + 1}. [${hit.layer}] ${hit.title}${hit.path ? ` | ${hit.path}` : hit.artifactType ? ` | ${hit.artifactType}` : ""}\n${hit.snippet}`
    )
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
  private readonly openClawRuntimeStateService: OpenClawRuntimeStateService;
  private readonly chatService: ChatServiceLike;
  private readonly directionService: Pick<ResearchDirectionService, "listProfiles" | "upsertProfile">;
  private readonly discoveryService: Pick<ResearchDiscoveryService, "runDiscovery">;
  private readonly feedbackService: ResearchFeedbackService;
  private readonly memoryRecallService: MemoryRecallService;
  private readonly memoryCompactionService: MemoryCompactionService;
  private readonly inboundCommandPolicyService: InboundCommandPolicyService;
  private readonly healthMonitorIntervalMs: number;
  private readonly restartCooldownMs: number;
  private readonly unhealthyThreshold: number;
  private readonly maxRestartsPerHour: number;
  private readonly openClawChannelId: string;
  private healthMonitorTimer: NodeJS.Timeout | null = null;
  private healthCheckInFlight = false;
  private restartInFlight = false;
  private openClawEventSubscription: { close(): Promise<void> } | null = null;
  private openClawEventSyncToken: object | null = null;
  private transcriptWriteChain: Promise<void> = Promise.resolve();

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
    this.directionService = options.directionService ?? new ResearchDirectionService(workspaceDir);
    this.discoveryService = options.discoveryService ?? new ResearchDiscoveryService(workspaceDir);
    this.feedbackService = new ResearchFeedbackService(workspaceDir);
    this.memoryRecallService = new MemoryRecallService(workspaceDir, researchService);
    this.memoryCompactionService = new MemoryCompactionService(workspaceDir);
    this.inboundCommandPolicyService = new InboundCommandPolicyService(workspaceDir);
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
            options.openClaw?.cliPath ?? "openclaw",
            options.openClaw?.gatewayUrl ?? "ws://127.0.0.1:18789",
            options.openClaw?.channelId ?? "openclaw-weixin",
            options.openClaw?.token,
            options.openClaw?.password
          ))
        : null;
    this.openClawChannelId = options.openClaw?.channelId ?? "openclaw-weixin";
    this.transcriptPath = path.join(this.workspaceDir, "channels", "wechat-transcript.json");
    this.lifecycleStatePath = path.join(this.workspaceDir, "channels", "wechat-lifecycle.json");
    this.lifecycleAuditPath = path.join(this.workspaceDir, "channels", "wechat-lifecycle-audit.jsonl");
    this.openClawRuntimeStateService = new OpenClawRuntimeStateService(this.workspaceDir);
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
      await this.startOpenClawEventSync();
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
    await this.stopOpenClawEventSync();
    await this.appendLifecycleAudit({
      providerMode: this.wechatProviderMode,
      event: "service-stopped",
      details: { source: "channel-service" }
    }).catch(() => undefined);
    if (this.wechatProviderMode === "native") {
      await this.nativeProvider?.close?.();
      await this.transcriptWriteChain.catch(() => undefined);
      return;
    }
    if (this.wechatProviderMode === "openclaw") {
      await this.openClawBridge?.close?.();
      await this.transcriptWriteChain.catch(() => undefined);
      return;
    }
    await this.mockProvider?.close?.();
    await this.transcriptWriteChain.catch(() => undefined);
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

  private async readOpenClawSessionRegistry(): Promise<{
    updatedAt: string;
    sessions: OpenClawSessionRegistryEntry[];
  }> {
    return this.openClawRuntimeStateService.readSessionRegistry();
  }

  private async writeOpenClawSessionRegistry(state: {
    updatedAt: string;
    sessions: OpenClawSessionRegistryEntry[];
  }): Promise<void> {
    await this.openClawRuntimeStateService.writeSessionRegistry(state);
  }

  private mapOpenClawSessionSummary(entry: OpenClawSessionSummary): OpenClawSessionRegistryEntry {
    return {
      sessionKey: entry.sessionKey,
      ...(entry.channel ? { channel: entry.channel } : {}),
      ...(entry.to ? { to: entry.to } : {}),
      ...(entry.accountId ? { accountId: entry.accountId } : {}),
      ...(entry.threadId == null ? {} : { threadId: entry.threadId }),
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.displayName ? { displayName: entry.displayName } : {}),
      ...(entry.derivedTitle ? { derivedTitle: entry.derivedTitle } : {}),
      ...(entry.lastMessagePreview ? { lastMessagePreview: entry.lastMessagePreview } : {}),
      ...(entry.updatedAt === undefined ? {} : { updatedAt: entry.updatedAt }),
      lastSyncedAt: nowIso(),
    };
  }

  private async replaceOpenClawSessionRegistry(entries: OpenClawSessionRegistryEntry[]): Promise<void> {
    await this.openClawRuntimeStateService.replaceSessionRegistry(entries);
  }

  private async getOpenClawSessionRegistryEntry(sessionKey: string): Promise<OpenClawSessionRegistryEntry | null> {
    return this.openClawRuntimeStateService.getSessionRegistryEntry(sessionKey);
  }

  private selectBestOpenClawSessionRegistryEntryByTarget(
    entries: OpenClawSessionRegistryEntry[],
    input: {
      senderId: string;
      accountId?: string | undefined;
      threadId?: string | undefined;
    },
  ): OpenClawSessionRegistryEntry | null {
    const senderId = input.senderId.trim();
    if (!senderId) {
      return null;
    }

    const requestedAccountId = input.accountId?.trim() || "";
    const requestedThreadId = input.threadId?.trim() || "";
    const matches = entries.filter((entry) => entry.to === senderId);
    if (matches.length === 0) {
      return null;
    }

    const scored = matches
      .map((entry) => {
        let score = 0;
        if (requestedAccountId) {
          score += entry.accountId?.trim() === requestedAccountId ? 10 : -10;
        }
        if (requestedThreadId) {
          score += entry.threadId != null && String(entry.threadId).trim() === requestedThreadId ? 5 : -5;
        }
        const recency =
          typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
            ? entry.updatedAt
            : Number.isFinite(Date.parse(entry.lastSyncedAt))
              ? Date.parse(entry.lastSyncedAt)
              : 0;
        return { entry, score, recency };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.recency !== left.recency) {
          return right.recency - left.recency;
        }
        return left.entry.sessionKey.localeCompare(right.entry.sessionKey);
      });

    const best = scored[0];
    if (!best) {
      return null;
    }
    if ((requestedAccountId || requestedThreadId) && best.score < 0) {
      return null;
    }
    return best.entry;
  }

  private async findOpenClawSessionRegistryEntryByTarget(input: {
    senderId: string;
    accountId?: string | undefined;
    threadId?: string | undefined;
  }): Promise<OpenClawSessionRegistryEntry | null> {
    const senderId = input.senderId.trim();
    if (!senderId) {
      return null;
    }

    const current = await this.readOpenClawSessionRegistry().catch(() => ({
      updatedAt: nowIso(),
      sessions: [] as OpenClawSessionRegistryEntry[],
    }));
    let session = this.selectBestOpenClawSessionRegistryEntryByTarget(current.sessions, {
      senderId,
      ...(input.accountId?.trim() ? { accountId: input.accountId.trim() } : {}),
      ...(input.threadId?.trim() ? { threadId: input.threadId.trim() } : {}),
    });
    if (session || !this.openClawBridge || typeof this.openClawBridge.listSessions !== "function") {
      return session;
    }

    const sessions = await this.openClawBridge.listSessions({
      limit: 500,
      includeDerivedTitles: true,
      includeLastMessage: true,
    }).catch(() => []);
    if (sessions.length === 0) {
      return null;
    }

    const mappedSessions = sessions.map((entry) => this.mapOpenClawSessionSummary(entry));
    await this.replaceOpenClawSessionRegistry(
      mappedSessions,
    ).catch(() => undefined);

    session = this.selectBestOpenClawSessionRegistryEntryByTarget(mappedSessions, {
      senderId,
      ...(input.accountId?.trim() ? { accountId: input.accountId.trim() } : {}),
      ...(input.threadId?.trim() ? { threadId: input.threadId.trim() } : {}),
    });
    return session;
  }

  private async upsertOpenClawSessionRegistryEntry(
    sessionKey: string,
    updater: (entry: OpenClawSessionRegistryEntry | null) => OpenClawSessionRegistryEntry,
  ): Promise<void> {
    await this.openClawRuntimeStateService.upsertSessionRegistryEntry(sessionKey, updater);
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
    const operation = this.transcriptWriteChain
      .catch(() => undefined)
      .then(async () => {
        const current = await this.readTranscriptState();
        const existingIndex = current.messages.findIndex((entry) => entry.id === nextMessage.id);
        const nextMessages =
          existingIndex >= 0
            ? current.messages.map((entry, index) => (index === existingIndex ? nextMessage : entry))
            : [...current.messages, nextMessage];
        await this.writeTranscriptState({
          updatedAt: nowIso(),
          messages: this.trimMessages(nextMessages)
        });
        return nextMessage;
      });
    this.transcriptWriteChain = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async startOpenClawEventSync(): Promise<void> {
    if (this.wechatProviderMode !== "openclaw") {
      return;
    }

    if (this.openClawBridge && typeof this.openClawBridge.listSessions === "function") {
      const sessions = await this.openClawBridge.listSessions({
        limit: 500,
        includeDerivedTitles: true,
        includeLastMessage: true,
      }).catch(() => []);
      await this.replaceOpenClawSessionRegistry(
        sessions.map((entry) => this.mapOpenClawSessionSummary(entry)),
      ).catch(() => undefined);
    }

    if (!hasOpenClawEventSupport(this.openClawBridge)) {
      return;
    }
    if (this.openClawEventSubscription) {
      return;
    }

    const syncToken = {};
    this.openClawEventSyncToken = syncToken;
    this.openClawEventSubscription = await this.openClawBridge.watchSessionEvents({
      onEvent: async (event) => {
        if (this.openClawEventSyncToken !== syncToken) {
          return;
        }
        const eventPayload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as {
                sessionKey?: unknown;
                messageId?: unknown;
                message?: { role?: unknown; content?: unknown } | undefined;
              })
            : null;
        const auditText =
          eventPayload?.message ? extractOpenClawEventText(eventPayload.message) : "";
        void this.appendOpenClawEventAudit({
          event: event.event,
          ...(eventPayload && typeof eventPayload.sessionKey === "string" && eventPayload.sessionKey.trim()
            ? { sessionKey: eventPayload.sessionKey.trim() }
            : {}),
          ...(eventPayload && typeof eventPayload.messageId === "string" && eventPayload.messageId.trim()
            ? { messageId: eventPayload.messageId.trim() }
            : {}),
          ...(eventPayload && eventPayload.message && typeof eventPayload.message.role === "string" && eventPayload.message.role.trim()
            ? { role: eventPayload.message.role.trim() }
            : {}),
          ...(auditText ? { text: auditText } : {}),
        }).catch(() => undefined);

        if (this.openClawEventSyncToken !== syncToken) {
          return;
        }

        if (event.event !== "session.message") {
          return;
        }
        const payload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as {
                messageId?: unknown;
                sessionKey?: unknown;
                lastChannel?: unknown;
                lastAccountId?: unknown;
                lastThreadId?: unknown;
                lastTo?: unknown;
                message?: { role?: unknown; content?: unknown } | undefined;
                displayName?: unknown;
                derivedTitle?: unknown;
                label?: unknown;
                updatedAt?: unknown;
              })
            : null;
        if (!payload) {
          return;
        }

        const sessionKey =
          typeof payload.sessionKey === "string" && payload.sessionKey.trim()
            ? payload.sessionKey.trim()
            : "";
        if (sessionKey) {
          const role =
            payload.message && typeof payload.message.role === "string" ? payload.message.role.trim() : undefined;
          const text = payload.message ? extractOpenClawEventText(payload.message) : "";
          const messageId =
            typeof payload.messageId === "string" && payload.messageId.trim()
              ? payload.messageId.trim()
              : undefined;
          await this.upsertOpenClawSessionRegistryEntry(sessionKey, (previous) => ({
            sessionKey,
            ...(typeof payload.lastChannel === "string" && payload.lastChannel.trim()
              ? { channel: payload.lastChannel.trim() }
              : previous?.channel
                ? { channel: previous.channel }
                : {}),
            ...(typeof payload.lastTo === "string" && payload.lastTo.trim()
              ? { to: payload.lastTo.trim() }
              : previous?.to
                ? { to: previous.to }
                : {}),
            ...(typeof payload.lastAccountId === "string" && payload.lastAccountId.trim()
              ? { accountId: payload.lastAccountId.trim() }
              : previous?.accountId
                ? { accountId: previous.accountId }
                : {}),
            ...(payload.lastThreadId != null
              ? { threadId: payload.lastThreadId as string | number }
              : previous?.threadId != null
                ? { threadId: previous.threadId }
                : {}),
            ...(typeof payload.label === "string" && payload.label.trim()
              ? { label: payload.label.trim() }
              : previous?.label
                ? { label: previous.label }
                : {}),
            ...(typeof payload.displayName === "string" && payload.displayName.trim()
              ? { displayName: payload.displayName.trim() }
              : previous?.displayName
                ? { displayName: previous.displayName }
                : {}),
            ...(typeof payload.derivedTitle === "string" && payload.derivedTitle.trim()
              ? { derivedTitle: payload.derivedTitle.trim() }
              : previous?.derivedTitle
                ? { derivedTitle: previous.derivedTitle }
                : {}),
            ...(text
              ? { lastMessagePreview: text }
              : previous?.lastMessagePreview
                ? { lastMessagePreview: previous.lastMessagePreview }
                : {}),
            ...(messageId
              ? { lastMessageId: messageId }
              : previous?.lastMessageId
                ? { lastMessageId: previous.lastMessageId }
                : {}),
            ...(role
              ? { lastMessageRole: role }
              : previous?.lastMessageRole
                ? { lastMessageRole: previous.lastMessageRole }
                : {}),
            ...(typeof payload.updatedAt === "number" && Number.isFinite(payload.updatedAt)
              ? { updatedAt: payload.updatedAt }
              : previous?.updatedAt !== undefined
                ? { updatedAt: previous.updatedAt }
                : {}),
            lastSyncedAt: nowIso(),
          })).catch(() => undefined);

          if (messageId && role && text) {
            await this.openClawRuntimeStateService.appendSessionMessage(sessionKey, {
              id: messageId,
              role,
              text,
              createdAt: nowIso(),
            }).catch(() => undefined);
          }
        }

        const lastChannel =
          typeof payload.lastChannel === "string" && payload.lastChannel.trim()
            ? payload.lastChannel.trim()
            : "";
        if (lastChannel && lastChannel !== this.openClawChannelId) {
          return;
        }

        const role =
          payload.message && typeof payload.message.role === "string" ? payload.message.role.trim() : "";
        if (role !== "user" && role !== "assistant") {
          return;
        }

        const text = extractOpenClawEventText(payload.message);
        if (!text) {
          return;
        }

        const senderId =
          typeof payload.lastTo === "string" && payload.lastTo.trim()
            ? payload.lastTo.trim()
            : undefined;
        const messageId =
          typeof payload.messageId === "string" && payload.messageId.trim()
            ? payload.messageId.trim()
            : undefined;

        if (this.openClawEventSyncToken !== syncToken) {
          return;
        }

        await this.appendTranscriptMessage({
          ...(messageId ? { id: messageId } : {}),
          direction: role === "user" ? "inbound" : "outbound",
          ...(senderId ? { senderId } : {}),
          text,
        });
      },
      onError: async () => {
        if (this.openClawEventSyncToken !== syncToken) {
          return;
        }
        void this.appendOpenClawEventAudit({
          event: "stream.error",
        }).catch(() => undefined);
        await this.appendTranscriptMessage({
          direction: "system",
          text: "OpenClaw session event stream reported an error.",
        }).catch(() => undefined);
      },
      onClose: async () => {
        if (this.openClawEventSyncToken !== syncToken) {
          return;
        }
        this.openClawEventSubscription = null;
        this.openClawEventSyncToken = null;
      },
    });
  }

  private async stopOpenClawEventSync(): Promise<void> {
    if (!this.openClawEventSubscription) {
      this.openClawEventSyncToken = null;
      return;
    }
    const subscription = this.openClawEventSubscription;
    this.openClawEventSubscription = null;
    this.openClawEventSyncToken = null;
    await subscription.close().catch(() => undefined);
  }

  private async listTranscriptMessages(): Promise<WeChatMessage[]> {
    const state = await this.readTranscriptState();
    return [...state.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  private async listOpenClawCachedMessages(): Promise<WeChatMessage[]> {
    const items = await this.openClawRuntimeStateService.listAllSessionMessages().catch(() => []);
    return items
      .map(({ message, entry }) => ({
        id: message.id,
        direction:
          message.role === "assistant"
            ? "outbound"
            : message.role === "user"
              ? "inbound"
              : "system",
        text: message.text,
        ...(entry?.to ? { senderId: entry.to } : {}),
        ...(entry?.displayName ? { senderName: entry.displayName } : {}),
        createdAt: message.createdAt,
      } satisfies WeChatMessage))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  private async listOpenClawCanonicalMessages(): Promise<WeChatMessage[]> {
    const [hostMessages, transcriptMessages] = await Promise.all([
      this.listOpenClawCachedMessages(),
      this.listTranscriptMessages(),
    ]);
    return mergeMessages(hostMessages, transcriptMessages);
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

  private async appendOpenClawEventAudit(entry: OpenClawEventAuditEntry): Promise<void> {
    await this.openClawRuntimeStateService.appendEventAudit(entry);
  }

  async listWeChatLifecycleAudit(limit = 30): Promise<WeChatLifecycleAuditEntry[]> {
    try {
      const raw = await readFile(this.lifecycleAuditPath, "utf8");
      const entries = raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Partial<WeChatLifecycleAuditEntry>;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is Partial<WeChatLifecycleAuditEntry> => Boolean(entry))
        .filter(
          (entry) =>
            typeof entry.providerMode === "string" &&
            typeof entry.event === "string",
        )
        .map((entry) => ({
          ts: typeof entry.ts === "string" ? entry.ts : undefined,
          providerMode: entry.providerMode as WeChatProviderMode,
          event: entry.event as WeChatLifecycleAuditEntry["event"],
          state: typeof entry.state === "string" ? (entry.state as WeChatLifecycleState) : undefined,
          reason: typeof entry.reason === "string" ? entry.reason : undefined,
          details:
            entry.details && typeof entry.details === "object"
              ? (entry.details as Record<string, string | number | boolean | null>)
              : undefined,
        }));

      return entries.slice(-Math.max(1, Math.min(limit, 100))).reverse();
    } catch {
      return [];
    }
  }

  async listOpenClawEventAudit(limit = 30): Promise<OpenClawEventAuditEntry[]> {
    return this.openClawRuntimeStateService.listEventAudit(limit);
  }

  async listOpenClawSessionRegistry(limit = 100): Promise<OpenClawSessionRegistryEntry[]> {
    return this.openClawRuntimeStateService.listSessionRegistry(limit);
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
      await this.stopOpenClawEventSync();
      await this.openClawBridge?.close?.();
      await this.openClawBridge?.start?.();
      await this.startOpenClawEventSync();
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
    const status = await this.evaluateWeChatLifecycle({ allowRestart: false });
    if (this.wechatProviderMode !== "openclaw") {
      return status;
    }

    const registry = await this.readOpenClawSessionRegistry().catch(() => ({
      updatedAt: nowIso(),
      sessions: [] as OpenClawSessionRegistryEntry[],
    }));
    return {
      ...status,
      hostSessionRegistryCount: registry.sessions.length,
      hostSessionRegistryUpdatedAt: registry.updatedAt,
    };
  }

  private async tryHandleNaturalLanguageIntent(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
    source?: "ui" | "wechat" | "openclaw" | undefined;
  }): Promise<WeChatInboundResult | null> {
    const message = input.text.trim();
    const preferChinese = containsCjk(message);
    const directionLabel = extractDirectionLabelFromIntent(message);

    if (directionLabel) {
      try {
        const profile = await this.directionService.upsertProfile({
          label: directionLabel,
          priority: "primary",
          enabled: true,
        });
        return {
          accepted: true,
          reply: buildDirectionSavedReply(profile.label, preferChinese),
        };
      } catch (error) {
        return {
          accepted: true,
          reply: buildIntentFailureReply(error, preferChinese),
        };
      }
    }

    if (!isTodayPapersIntent(message)) {
      return null;
    }

    try {
      const profiles = (await this.directionService.listProfiles()).filter((profile) => profile.enabled);
      if (profiles.length === 0) {
        return {
          accepted: true,
          reply: buildMissingDirectionReply(preferChinese),
        };
      }
      const singleDirectionId = profiles.length === 1 ? profiles[0]?.id : undefined;

      const result = await this.discoveryService.runDiscovery({
        ...(singleDirectionId ? { directionId: singleDirectionId } : {}),
        senderId: input.senderId,
        ...(input.senderName?.trim() ? { senderName: input.senderName.trim() } : {}),
        topK: 5,
        maxPapersPerQuery: 4,
        pushToWechat: false,
      });

      return {
        accepted: true,
        reply: formatDiscoveryReply(result, preferChinese),
      };
    } catch (error) {
      return {
        accepted: true,
        reply: buildIntentFailureReply(error, preferChinese),
      };
    }
  }

  private buildInboundSlashCommandHandlers(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
    source?: "ui" | "wechat" | "openclaw" | undefined;
  }): Record<
    InboundSlashCommandSpec["id"],
    (argsText: string) => Promise<InboundCommandExecutionResult>
  > {
    const safeAndMaintenanceHandlers = createSafeAndMaintenanceHandlers({
      buildHelpReply: () => buildCommandHelpReply(),
      buildStatusReply: async () => {
        const summary = hasAgentRuntimeControls(this.chatService)
          ? await this.chatService.describeSession(input.senderId)
          : null;
        const wechatStatus = await this.getWeChatStatus();
        return buildCommandStatusReply({
          wechatStatus,
          sessionSummary: summary,
        });
      },
      recallMemory: async (query) =>
        this.memoryRecallService
          .recall(query, {
            limit: 6,
            includeWorkspace: true,
            includeArtifacts: true,
          })
          .then((result) => result.hits),
      formatMemoryReply: (query, hits) => buildMemoryReply(query, hits),
      compactMemory: async (olderThanDays) =>
        this.memoryCompactionService.compact({
          source: "manual",
          ...(olderThanDays ? { olderThanDays } : {}),
        }),
    });

    const workspaceMutationHandlers = createWorkspaceMutationHandlers(
      {
        senderId: input.senderId,
        senderName: input.senderName,
      },
      {
        researchService: this.researchService,
        memoryService: this.memoryService,
        feedbackService: this.feedbackService,
      },
    );

    const controlledChatService = hasAgentRuntimeControls(this.chatService)
      ? this.chatService
      : null;

    const sessionControlHandlers = controlledChatService
      ? createSessionControlHandlers(
          {
            senderId: input.senderId,
          },
          {
            describeSession: (senderId) => controlledChatService.describeSession(senderId),
            setRole: (senderId, roleId) => controlledChatService.setRole(senderId, roleId),
            setModel: (senderId, providerId, modelId) => controlledChatService.setModel(senderId, providerId, modelId),
            clearModel: (senderId) => controlledChatService.clearModel(senderId),
            setFallbacks: (senderId, selections) => controlledChatService.setFallbacks(senderId, selections),
            setReasoning: (senderId, reasoningEffort) => controlledChatService.setReasoning(senderId, reasoningEffort),
          },
        )
      : null;

    return {
      ...safeAndMaintenanceHandlers,
      ...workspaceMutationHandlers,
      ...(sessionControlHandlers ?? {
        role: async () => ({ reply: "Agent role controls are unavailable in the current chat backend." }),
        skills: async () => ({ reply: "Agent skill inspection is unavailable in the current chat backend." }),
        model: async () => ({ reply: "Agent model controls are unavailable in the current chat backend." }),
        fallbacks: async () => ({ reply: "Agent fallback controls are unavailable in the current chat backend." }),
        reasoning: async () => ({ reply: "Agent reasoning controls are unavailable in the current chat backend." }),
      }),
    };
  }

  private async handleWeChatInput(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
    source?: "ui" | "wechat" | "openclaw" | undefined;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    let reply: string;
    let researchTaskId: string | undefined;
    const resolvedSource = input.source ?? (this.wechatProviderMode === "openclaw" ? "openclaw" : "wechat");

    const slashCommand = parseInboundSlashCommand(message);
    if (slashCommand) {
      const { spec, argsText } = slashCommand;
      const allowedSources = resolveAllowedSourcesForInboundCommand(spec);
      if (!allowedSources.includes(resolvedSource)) {
        reply = buildCommandSourceBlockedReply(spec);
        return {
          accepted: true,
          reply,
        };
      }
      const remoteTier = resolvedSource === "ui" ? null : toRemoteAuthorizedCommandTier(spec.tier);
      if (remoteTier) {
        const authorization = await this.inboundCommandPolicyService.authorizeRemoteTier(remoteTier, input.senderId);
        if (!authorization.allowed) {
          reply = buildCommandAuthorizationBlockedReply({
            spec,
            senderId: input.senderId,
            allowlist: authorization.policy.senderIds,
          });
          return {
            accepted: true,
            reply,
          };
        }
      }
      const handlers = this.buildInboundSlashCommandHandlers(input);
      const handler = handlers[spec.id];
      const result = await handler(argsText);
      reply = result.reply;
      researchTaskId = result.researchTaskId;
    } else if (message.startsWith("/")) {
      const unknownCommand = message.split(/\s+/u)[0]?.trim() || "/";
      reply = buildCommandHelpReply(unknownCommand);
    } else {
      const directIntentResult = await this.tryHandleNaturalLanguageIntent({
        ...input,
        source: resolvedSource,
      });
      if (directIntentResult) {
        return directIntentResult;
      }
      const intent = classifyInboundMessageIntent(message);
      if (intent === "plain-chat" && hasPlainChatSupport(this.chatService)) {
        reply = await this.chatService.plainReply({
          ...input,
          source: resolvedSource,
        });
      } else {
        reply = await this.chatService.reply({
          ...input,
          source: resolvedSource,
        });
      }
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

    const result = await this.handleWeChatInput({
      ...input,
      source: "ui",
    });

    await this.appendTranscriptMessage({
      direction: "outbound",
      senderId: input.senderId,
      senderName: input.senderName,
      text: result.reply
    });

    return result;
  }

  private async appendOpenClawOutboundReply(input: {
    reply: string;
    senderId?: string | undefined;
    senderName?: string | undefined;
    messageId?: string | undefined;
  }): Promise<WeChatInboundResult> {
    await this.appendTranscriptMessage({
      ...(input.messageId ? { id: input.messageId } : {}),
      direction: "outbound",
      senderId: input.senderId,
      senderName: input.senderName,
      text: input.reply
    });
    return {
      accepted: true,
      reply: input.reply
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
    if (this.wechatProviderMode === "openclaw") {
      return this.listOpenClawCanonicalMessages();
    }
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
    if (this.wechatProviderMode === "native") {
      const transcriptMessages = await this.listTranscriptMessages();
      return mergeMessages(await this.nativeProvider!.listMessages(), transcriptMessages);
    }
    if (this.wechatProviderMode === "openclaw") {
      return this.listOpenClawCanonicalMessages();
    }
    const transcriptMessages = await this.listTranscriptMessages();
    return mergeMessages(await this.mockProvider!.listMessages(), transcriptMessages);
  }

  async pushWeChatMessage(input: {
    senderId?: string | undefined;
    senderName?: string | undefined;
    sessionKey?: string | undefined;
    text: string;
    mediaUrl?: string | undefined;
    accountId?: string | undefined;
    threadId?: string | undefined;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    const mediaUrl = input.mediaUrl?.trim() || undefined;
    const senderId = input.senderId?.trim() || "";
    const sessionKey = input.sessionKey?.trim() || "";
    if (!senderId && !sessionKey) {
      throw new Error("Push target requires senderId or sessionKey.");
    }
    if (!message && !mediaUrl) {
      throw new Error("Push payload requires text or media.");
    }

    if (this.wechatProviderMode === "native") {
      if (!senderId) {
        throw new Error("Native WeChat push requires senderId.");
      }
      if (mediaUrl) {
        throw new Error("Native WeChat push currently supports text only from the ReAgent push surface.");
      }
      return this.nativeProvider!.pushMessage({
        senderId,
        senderName: input.senderName,
        text: message,
      });
    }

    if (this.wechatProviderMode === "openclaw") {
      const status = await this.getWeChatStatus();
      if (!status.connected) {
        throw new Error("WeChat is not connected. Complete QR login before pushing messages.");
      }
      if (sessionKey && hasOpenClawSessionSendSupport(this.openClawBridge)) {
        try {
          const delivery = await this.openClawBridge.sendSessionMessage({
            sessionKey,
            text: message,
            ...(mediaUrl ? { mediaUrl } : {}),
          });
          return this.appendOpenClawOutboundReply({
            reply: message || `[media] ${mediaUrl}`,
            ...(delivery.to ? { senderId: delivery.to } : {}),
            ...(delivery.messageId ? { messageId: delivery.messageId } : {}),
          });
        } catch {
          // Fall through to local registry-based resolution when the host shortcut fails.
        }
      }
      const matchedSenderSession =
        !sessionKey && senderId
          ? await this.findOpenClawSessionRegistryEntryByTarget({
              senderId,
              ...(input.accountId?.trim() ? { accountId: input.accountId.trim() } : {}),
              ...(input.threadId?.trim() ? { threadId: input.threadId.trim() } : {}),
            })
          : null;
      if (
        !sessionKey &&
        matchedSenderSession &&
        hasOpenClawSessionSendSupport(this.openClawBridge) &&
        !input.accountId?.trim() &&
        !input.threadId?.trim()
      ) {
        try {
          const delivery = await this.openClawBridge.sendSessionMessage({
            sessionKey: matchedSenderSession.sessionKey,
            text: message,
            ...(mediaUrl ? { mediaUrl } : {}),
          });
          return this.appendOpenClawOutboundReply({
            reply: message || `[media] ${mediaUrl}`,
            senderId: matchedSenderSession.to ?? senderId,
            ...(delivery.messageId ? { messageId: delivery.messageId } : {}),
          });
        } catch {
          // Fall through to direct send with cached session context.
        }
      }
      if (sessionKey) {
        let session = await this.getOpenClawSessionRegistryEntry(sessionKey);
        if (!session && this.openClawBridge && typeof this.openClawBridge.listSessions === "function") {
          const sessions = await this.openClawBridge.listSessions({
            limit: 500,
            includeDerivedTitles: true,
            includeLastMessage: true,
          }).catch(() => []);
          await this.replaceOpenClawSessionRegistry(
            sessions.map((entry) => this.mapOpenClawSessionSummary(entry)),
          ).catch(() => undefined);
          session = await this.getOpenClawSessionRegistryEntry(sessionKey);
        }
        if (!session?.to) {
          throw new Error(`OpenClaw session has no cached delivery target: ${sessionKey}`);
        }
        if (!hasOpenClawSendSupport(this.openClawBridge)) {
          return this.appendOpenClawOutboundReply({
            reply: message || `[media] ${mediaUrl}`,
            senderId: session.to,
          });
        }
        const delivery = await this.openClawBridge.sendMessage({
          to: session.to,
          text: message,
          ...(mediaUrl ? { mediaUrl } : {}),
          ...(input.accountId?.trim()
            ? { accountId: input.accountId.trim() }
            : session.accountId
              ? { accountId: session.accountId }
              : {}),
          ...(input.threadId?.trim()
            ? { threadId: input.threadId.trim() }
            : session.threadId != null
              ? { threadId: String(session.threadId) }
              : {}),
        });
        return this.appendOpenClawOutboundReply({
          reply: message || `[media] ${mediaUrl}`,
          senderId: session.to,
          ...(delivery.messageId ? { messageId: delivery.messageId } : {}),
        });
      }
      if (!senderId) {
        throw new Error("OpenClaw push requires senderId unless sessionKey is provided.");
      }
      if (!hasOpenClawSendSupport(this.openClawBridge)) {
        return this.appendOpenClawOutboundReply({
          reply: message || `[media] ${mediaUrl}`,
          senderId,
          senderName: input.senderName,
        });
      }
      const resolvedTarget = matchedSenderSession?.to ?? senderId;
      const delivery = await this.openClawBridge!.sendMessage({
        to: resolvedTarget,
        text: message,
        ...(mediaUrl ? { mediaUrl } : {}),
        ...(input.accountId?.trim()
          ? { accountId: input.accountId.trim() }
          : matchedSenderSession?.accountId
            ? { accountId: matchedSenderSession.accountId }
          : status.accountId?.trim()
            ? { accountId: status.accountId.trim() }
            : {}),
        ...(input.threadId?.trim()
          ? { threadId: input.threadId.trim() }
          : matchedSenderSession?.threadId != null
            ? { threadId: String(matchedSenderSession.threadId) }
            : {}),
      });
      return this.appendOpenClawOutboundReply({
        reply: message || `[media] ${mediaUrl}`,
        senderId: resolvedTarget,
        senderName: input.senderName,
        ...(delivery.messageId ? { messageId: delivery.messageId } : {}),
      });
    }

    if (!senderId) {
      throw new Error("Mock WeChat push requires senderId.");
    }
    if (mediaUrl) {
      throw new Error("Mock WeChat push currently supports text only from the ReAgent push surface.");
    }
    return this.mockProvider!.pushOutbound(senderId, message, input.senderName);
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
      const result = await this.handleWeChatInput({
        ...input,
        source: "openclaw",
      });
      const matchedSenderSession = await this.findOpenClawSessionRegistryEntryByTarget({
        senderId: input.senderId,
      });
      let delivery:
        | {
            messageId?: string | undefined;
            channel: string;
          }
        | null = null;

      if (
        matchedSenderSession &&
        hasOpenClawSessionSendSupport(this.openClawBridge)
      ) {
        try {
          delivery = await this.openClawBridge.sendSessionMessage({
            sessionKey: matchedSenderSession.sessionKey,
            text: result.reply,
          });
        } catch {
          delivery = null;
        }
      }

      if (!delivery && hasOpenClawSendSupport(this.openClawBridge)) {
        delivery = await this.openClawBridge.sendMessage({
          to: matchedSenderSession?.to ?? input.senderId,
          text: result.reply,
          ...(matchedSenderSession?.accountId
            ? { accountId: matchedSenderSession.accountId }
            : status.accountId?.trim()
              ? { accountId: status.accountId.trim() }
              : {}),
          ...(matchedSenderSession?.threadId != null
            ? { threadId: String(matchedSenderSession.threadId) }
            : {}),
        });
      }
      const outbound = await this.appendOpenClawOutboundReply({
        reply: result.reply,
        senderId: matchedSenderSession?.to ?? input.senderId,
        senderName: input.senderName,
        ...(delivery?.messageId ? { messageId: delivery.messageId } : {}),
      });
      return {
        ...outbound,
        researchTaskId: result.researchTaskId
      };
    }

    await this.mockProvider!.appendInbound(input.senderId, message, input.senderName);
    const result = await this.handleWeChatInput({
      ...input,
      source: "wechat",
    });
    const outbound = await this.mockProvider!.appendOutbound(result.reply);
    return {
      ...outbound,
      researchTaskId: result.researchTaskId
    };
  }
}
