import { getBooleanFlag, getIntegerFlag, getStringFlag, type ParsedOptions } from "./args.js";
import {
  dispatchAgentCommand as runAgentCommandDispatch,
  dispatchAgentHostCommand as runAgentHostCommandDispatch,
} from "./dispatch.js";

type RuntimeEnvLike = {
  PORT: number;
} & Record<string, unknown>;

type GatewayContextLike = {
  runtimeEnv: RuntimeEnvLike;
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

type AgentRuntimeOverview = {
  sessionCount: number;
  sessionCountsByEntrySource: Record<"direct" | "ui" | "wechat" | "openclaw", number>;
  defaultRoute: {
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: string;
    llmSource: string;
    wireApi?: string | undefined;
  };
  availableReasoningEfforts: string[];
  audit: {
    path: string;
    exists: boolean;
    status: string;
  };
};

type AgentSessionEntry = {
  sessionId: string;
  channel: string;
  senderId: string;
  entrySource: "direct" | "ui" | "wechat" | "openclaw";
  activeEntrySource: "direct" | "ui" | "wechat" | "openclaw";
  roleId: string;
  roleLabel: string;
  skillIds: string[];
  skillLabels: string[];
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: string;
  llmSource: string;
  wireApi?: string | undefined;
  turnCount: number;
  lastUserMessage?: string | undefined;
  lastAssistantMessage?: string | undefined;
  updatedAt: string;
};

type AgentSessionListPayload = {
  sessions: AgentSessionEntry[];
};

type AgentSessionProfile = {
  sessionId: string;
  senderId: string;
  entrySource: "direct" | "ui" | "wechat" | "openclaw";
  activeEntrySource: "direct" | "ui" | "wechat" | "openclaw";
  activeEntryLabel: string;
  enabledToolsets: string[];
  availableToolsets: string[];
  roleId: string;
  roleLabel: string;
  skillIds: string[];
  skillLabels: string[];
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: string;
  llmSource: string;
  wireApi?: string | undefined;
  fallbackRoutes: Array<{
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: string;
    llmSource: string;
    wireApi?: string | undefined;
  }>;
  reasoningEffort: string;
  availableRoles: Array<{ id: string; label: string }>;
  availableSkills: Array<{ id: string; label: string }>;
  availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
  availableReasoningEfforts: string[];
  defaultRoute: {
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: string;
    llmSource: string;
    wireApi?: string | undefined;
  };
  hostSessionKey?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | number | undefined;
  lastHostSyncAt?: string | undefined;
};

type AgentSessionHistoryPayload = {
  sessionId: string;
  senderId: string;
  entrySource: string;
  items: Array<{
    role: string;
    content: string;
    createdAt: string;
    name?: string | undefined;
  }>;
};

type AgentSessionCognitionPayload = {
  sessionId: string;
  senderId: string;
  entrySource: string;
  updatedAt: string;
  digestUpdatedAt: string;
  sessionUpdatedAt: string;
  recentUserIntents: string[];
  recentToolOutcomes: string[];
  pendingActions: string[];
  neurons: {
    updatedAt: string;
    perception: AgentNeuronPayload[];
    memory: AgentNeuronPayload[];
    hypothesis: AgentNeuronPayload[];
    reasoning: AgentNeuronPayload[];
    action: AgentNeuronPayload[];
    reflection: AgentNeuronPayload[];
  };
};

type AgentNeuronPayload = {
  id: string;
  kind: string;
  content: string;
  salience: number;
  confidence: number;
  source: string;
  updatedAt: string;
  status?: string | undefined;
  supportingEvidence?: string[] | undefined;
  conflictingEvidence?: string[] | undefined;
};

type AgentSessionHooksPayload = {
  sessionId: string;
  senderId: string;
  entrySource: string;
  items: Array<{
    ts?: string | undefined;
    event: string;
    stage?: string | undefined;
    providerId?: string | undefined;
    modelId?: string | undefined;
    toolName?: string | undefined;
    error?: string | undefined;
    preview?: string | undefined;
  }>;
};

type AgentHostSessionsPayload = {
  sessions: Array<{
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
  }>;
};

type AgentHostHistoryPayload = {
  sessionKey: string;
  items: Array<{
    id: string;
    role?: string | undefined;
    text: string;
    createdAt: string;
  }>;
};

type AgentDelegationRecord = {
  delegationId: string;
  sessionId: string;
  taskId: string;
  kind: "search" | "reading" | "synthesis";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  input: {
    prompt?: string | undefined;
    scope: "research-only";
    allowRecursiveDelegation: boolean;
  };
  rationale?: {
    source: "cognition-state";
    summary: string;
    matchedAction?: string | undefined;
    matchedHypothesis?: string | undefined;
    posture: {
      mode: "evidence-gathering" | "delivery-ready" | "balanced";
      reasons: string[];
      recommendedKinds: Array<"search" | "reading" | "synthesis">;
      deferredKinds: Array<"search" | "reading" | "synthesis">;
      conflictedHypotheses: number;
      provisionalHypotheses: number;
      supportedHypotheses: number;
    };
  } | undefined;
  artifact?: {
    path: string;
    type: "workstream-memo";
  } | undefined;
  createdAt: string;
  updatedAt: string;
  error?: string | null | undefined;
};

type AgentDelegationsPayload = {
  items: AgentDelegationRecord[];
};

export interface AgentCliDeps {
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  formatWhen(value: string | number | null | undefined): string;
  printOpenClawSessions(items: AgentHostSessionsPayload["sessions"]): void;
  printOpenClawHistory(
    items: Array<{ id?: string | undefined; role?: string | undefined; text: string; raw: Record<string, unknown> }>,
  ): void;
  openClawWatchCommand(options: ParsedOptions): Promise<void>;
}

export function createAgentCli(deps: AgentCliDeps) {
  function isCanonicalSessionId(value: string): boolean {
    return /^(direct|ui|wechat|openclaw):.+$/u.test(value.trim());
  }

  function renderAgentHelp(): void {
    console.log(`ReAgent Agent

Commands:
  reagent agent runtime
  reagent agent sessions
  reagent agent session <sessionId|senderId>
  reagent agent profile <sessionId|senderId>
  reagent agent cognition <sessionId|senderId>
  reagent agent history <sessionId|senderId>
  reagent agent hooks <sessionId|senderId>
  reagent agent role <sessionId|senderId> [roleId]
  reagent agent skills <sessionId|senderId> [skillId,skillId...]
  reagent agent model <sessionId|senderId> [providerId modelId]
  reagent agent model <sessionId|senderId> clear
  reagent agent fallbacks <sessionId|senderId> [providerId/modelId,...]
  reagent agent fallbacks <sessionId|senderId> clear
  reagent agent reasoning <sessionId|senderId> [effort]
  reagent agent host sessions
  reagent agent host history <sessionKey>
  reagent agent host watch <sessionKey>
  reagent agent delegates
  reagent agent delegate <sessionId|senderId> <search|reading|synthesis>

Flags:
  --source <direct|ui|wechat|openclaw>  Filter session lookup or list
  --limit <n>                           Limit list/history/hooks output
  --status <value>                      Filter delegation status
  --task <taskId>                       Research task id for delegation creation
  --prompt <value>                      Optional delegation prompt
  --event <value>                       Hook event filter
  --json                                Print JSON output
`);
  }

  function renderAgentHostHelp(): void {
    console.log(`ReAgent Agent Host

Commands:
  reagent agent host sessions
  reagent agent host history <sessionKey>
  reagent agent host watch <sessionKey>

Flags:
  --limit <n>   Limit session or history output
  --json        Print JSON output
`);
  }

  async function listAgentSessions(context: GatewayContextLike, options: ParsedOptions): Promise<AgentSessionEntry[]> {
    const payload = await deps.requestGatewayJson<AgentSessionListPayload>(
      context.baseUrl,
      `/api/agent/sessions?${deps.buildQueryString({
        ...(getStringFlag(options, "source") ? { source: getStringFlag(options, "source") } : {}),
        limit: getIntegerFlag(options, "limit") ?? 100,
      })}`,
      { timeoutMs: context.timeoutMs },
    );
    return payload.sessions;
  }

  async function resolveSessionId(context: GatewayContextLike, options: ParsedOptions, reference?: string): Promise<string> {
    const rawReference = reference?.trim() || options.positionals[0]?.trim() || getStringFlag(options, "session");
    if (!rawReference) {
      throw new Error("An agent session id or sender id is required.");
    }
    if (isCanonicalSessionId(rawReference)) {
      return rawReference;
    }

    const source = getStringFlag(options, "source");
    const sessions = await listAgentSessions(context, options);
    const matches = sessions.filter((session) => session.senderId === rawReference).filter((session) => (source ? session.entrySource === source : true));
    if (matches.length === 0) {
      throw new Error(`Agent session not found for sender ${rawReference}.`);
    }
    return matches[0]!.sessionId;
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

  function printAgentRuntimeOverview(payload: AgentRuntimeOverview): void {
    console.log(`Sessions: ${payload.sessionCount}`);
    console.log(
      `By source: direct=${payload.sessionCountsByEntrySource.direct} ui=${payload.sessionCountsByEntrySource.ui} wechat=${payload.sessionCountsByEntrySource.wechat} openclaw=${payload.sessionCountsByEntrySource.openclaw}`,
    );
    console.log(
      `Default route: ${payload.defaultRoute.providerLabel}/${payload.defaultRoute.modelLabel}${payload.defaultRoute.wireApi ? ` via ${payload.defaultRoute.wireApi}` : ""}`,
    );
    console.log(`Reasoning: ${payload.availableReasoningEfforts.join(", ")}`);
    console.log(`Audit: ${payload.audit.status} (${payload.audit.path})`);
  }

  function printAgentSessionEntries(items: AgentSessionEntry[]): void {
    if (items.length === 0) {
      console.log("No agent sessions found.");
      return;
    }

    for (const session of items) {
      console.log(`${session.sessionId} sender=${session.senderId} entry=${session.entrySource} updated=${session.updatedAt}`);
      console.log(
        `Role=${session.roleLabel} Model=${session.providerLabel}/${session.modelLabel}${session.wireApi ? ` via ${session.wireApi}` : ""} Turns=${session.turnCount}`,
      );
      console.log(`Skills=${session.skillLabels.join(", ") || "-"}`);
      console.log("");
    }
  }

  function printAgentProfile(session: AgentSessionProfile): void {
    console.log(`Session: ${session.sessionId}`);
    console.log(`Sender: ${session.senderId}`);
    console.log(`Entry: ${session.entrySource}`);
    console.log(`Active entry: ${session.activeEntryLabel} (${session.activeEntrySource})`);
    console.log(`Role: ${session.roleLabel} (${session.roleId})`);
    console.log(
      `Model: ${session.providerLabel}/${session.modelLabel}${session.wireApi ? ` via ${session.wireApi}` : ""} [${session.llmStatus}]`,
    );
    console.log(`Reasoning: ${session.reasoningEffort}`);
    console.log(`Toolsets: ${(session.enabledToolsets || []).join(", ") || "-"}`);
    console.log(`Skills: ${session.skillLabels.join(", ") || "-"}`);
    console.log(
      `Fallbacks: ${
        session.fallbackRoutes.length > 0
          ? session.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
          : "none"
      }`,
    );
    console.log(
      `Default route: ${session.defaultRoute.providerLabel}/${session.defaultRoute.modelLabel}${session.defaultRoute.wireApi ? ` via ${session.defaultRoute.wireApi}` : ""}`,
    );
    console.log(`Host session: ${deps.formatWhen(session.hostSessionKey)}`);
    if (session.hostSessionKey) {
      console.log(`Host account: ${deps.formatWhen(session.accountId)}`);
      console.log(`Host thread: ${deps.formatWhen(session.threadId == null ? undefined : String(session.threadId))}`);
      console.log(`Host synced: ${deps.formatWhen(session.lastHostSyncAt)}`);
    }
  }

  function printNeuronLayer(label: string, items: AgentNeuronPayload[]): void {
    console.log(`${label}:`);
    if (items.length === 0) {
      console.log("  - none");
      return;
    }

    for (const item of items) {
      console.log(`  - ${item.content}`);
      console.log(
        `    salience=${item.salience} confidence=${item.confidence} source=${item.source}${item.status ? ` status=${item.status}` : ""}`,
      );
      if (item.supportingEvidence?.length) {
        console.log(`    support=${item.supportingEvidence.join(" | ")}`);
      }
      if (item.conflictingEvidence?.length) {
        console.log(`    conflict=${item.conflictingEvidence.join(" | ")}`);
      }
    }
  }

  function printAgentCognition(payload: AgentSessionCognitionPayload): void {
    console.log(`Session: ${payload.sessionId}`);
    console.log(`Sender: ${payload.senderId}`);
    console.log(`Entry: ${payload.entrySource}`);
    console.log(`Updated: ${deps.formatWhen(payload.updatedAt)}`);
    console.log("");
    printNeuronLayer("Perception", payload.neurons.perception || []);
    console.log("");
    printNeuronLayer("Memory", payload.neurons.memory || []);
    console.log("");
    printNeuronLayer("Hypothesis", payload.neurons.hypothesis || []);
    console.log("");
    printNeuronLayer("Reasoning", payload.neurons.reasoning || []);
    console.log("");
    printNeuronLayer("Action", payload.neurons.action || []);
    console.log("");
    printNeuronLayer("Reflection", payload.neurons.reflection || []);
    console.log("");
    console.log(`Recent intents: ${(payload.recentUserIntents || []).join(" | ") || "none"}`);
    console.log(`Recent tools: ${(payload.recentToolOutcomes || []).join(" | ") || "none"}`);
    console.log(`Pending actions: ${(payload.pendingActions || []).join(" | ") || "none"}`);
  }

  function printAgentHistory(payload: AgentSessionHistoryPayload): void {
    if (payload.items.length === 0) {
      console.log("No agent session history found.");
      return;
    }

    for (const item of payload.items) {
      console.log(`${deps.formatWhen(item.createdAt)} ${item.role}${item.name ? ` ${item.name}` : ""}`);
      console.log(item.content);
      console.log("");
    }
  }

  function printAgentHooks(payload: AgentSessionHooksPayload): void {
    if (payload.items.length === 0) {
      console.log("No agent hook events found.");
      return;
    }

    for (const item of payload.items) {
      console.log(`${deps.formatWhen(item.ts)} event=${item.event}${item.stage ? ` stage=${item.stage}` : ""}`);
      if (item.toolName) {
        console.log(`Tool: ${item.toolName}`);
      }
      if (item.providerId || item.modelId) {
        console.log(`Model: ${deps.formatWhen(item.providerId)}/${deps.formatWhen(item.modelId)}`);
      }
      if (item.error) {
        console.log(`Error: ${item.error}`);
      } else if (item.preview) {
        console.log(item.preview);
      }
      console.log("");
    }
  }

  function printDelegations(items: AgentDelegationRecord[]): void {
    if (items.length === 0) {
      console.log("No agent delegations found.");
      return;
    }

    for (const item of items) {
      console.log(`${item.delegationId} session=${item.sessionId} task=${item.taskId}`);
      console.log(`Kind=${item.kind} Status=${item.status} Updated=${item.updatedAt}`);
      if (item.artifact?.path) {
        console.log(`Artifact=${item.artifact.path}`);
      }
      if (item.input.prompt) {
        console.log(`Prompt=${item.input.prompt}`);
      }
      if (item.rationale) {
        console.log(`Rationale=${item.rationale.summary}`);
        console.log(
          `Posture=${item.rationale.posture.mode} Recommended=${item.rationale.posture.recommendedKinds.join(", ") || "-"}`,
        );
        if (item.rationale.posture.reasons?.length) {
          console.log(`Reasons=${item.rationale.posture.reasons.join(" | ")}`);
        }
        if (item.rationale.matchedAction) {
          console.log(`Matched action=${item.rationale.matchedAction}`);
        }
        if (item.rationale.matchedHypothesis) {
          console.log(`Matched hypothesis=${item.rationale.matchedHypothesis}`);
        }
      }
      if (item.error) {
        console.log(`Error=${item.error}`);
      }
      console.log("");
    }
  }

  async function agentRuntimeCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<AgentRuntimeOverview>(
      context.baseUrl,
      "/api/agent/runtime",
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentRuntimeOverview(payload);
  }

  async function agentSessionsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessions = await listAgentSessions(context, options);
    const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
    const sliced = sessions.slice(0, limit);

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ sessions: sliced });
      return;
    }

    printAgentSessionEntries(sliced);
  }

  async function agentSessionCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const payload = await deps.requestGatewayJson<AgentSessionProfile>(
      context.baseUrl,
      `/api/agent/sessions/${encodeURIComponent(sessionId)}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentProfile(payload);
  }

  async function agentProfileCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const payload = await deps.requestGatewayJson<AgentSessionProfile>(
      context.baseUrl,
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/profile`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentProfile(payload);
  }

  async function agentCognitionCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const payload = await deps.requestGatewayJson<AgentSessionCognitionPayload>(
      context.baseUrl,
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/cognition`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentCognition(payload);
  }

  async function agentHistoryCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const payload = await deps.requestGatewayJson<AgentSessionHistoryPayload>(
      context.baseUrl,
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/history?${deps.buildQueryString({ limit: getIntegerFlag(options, "limit") ?? 20 })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentHistory(payload);
  }

  async function agentHooksCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const payload = await deps.requestGatewayJson<AgentSessionHooksPayload>(
      context.baseUrl,
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/hooks?${deps.buildQueryString({
        limit: getIntegerFlag(options, "limit") ?? 20,
        ...(getStringFlag(options, "event") ? { event: getStringFlag(options, "event") } : {}),
      })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentHooks(payload);
  }

  async function patchAgentProfile(
    context: GatewayContextLike,
    sessionId: string,
    body: Record<string, unknown>,
    options: ParsedOptions,
  ): Promise<void> {
    const payload = await deps.requestGatewayJson<AgentSessionProfile>(
      context.baseUrl,
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/profile`,
      {
        method: "PATCH",
        body,
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printAgentProfile(payload);
  }

  async function agentRoleCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const roleId = options.positionals[1]?.trim();
    if (!roleId) {
      await agentProfileCommand(options);
      return;
    }
    await patchAgentProfile(context, sessionId, { roleId }, options);
  }

  async function agentSkillsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const raw = options.positionals.slice(1).join(" ").trim();
    if (!raw) {
      await agentProfileCommand(options);
      return;
    }
    const skillIds = parseSkillSelections(raw);
    if (skillIds.length === 0) {
      throw new Error("No valid skill ids were provided.");
    }
    await patchAgentProfile(context, sessionId, { skillIds }, options);
  }

  async function agentModelCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const arg1 = options.positionals[1]?.trim();
    const arg2 = options.positionals[2]?.trim();
    if (!arg1) {
      await agentProfileCommand(options);
      return;
    }
    if (["clear", "reset", "default", "none"].includes(arg1.toLowerCase())) {
      await patchAgentProfile(context, sessionId, { clearModel: true }, options);
      return;
    }
    if (!arg2) {
      throw new Error("agent model requires both providerId and modelId, or 'clear'.");
    }
    await patchAgentProfile(context, sessionId, { providerId: arg1, modelId: arg2 }, options);
  }

  async function agentFallbacksCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const raw = options.positionals.slice(1).join(" ").trim();
    if (!raw) {
      await agentProfileCommand(options);
      return;
    }
    const fallbackRoutes =
      ["clear", "reset", "none"].includes(raw.toLowerCase()) ? [] : parseFallbackSelections(raw);
    if (!["clear", "reset", "none"].includes(raw.toLowerCase()) && fallbackRoutes.length === 0) {
      throw new Error("No valid fallback routes were provided.");
    }
    await patchAgentProfile(context, sessionId, { fallbackRoutes }, options);
  }

  async function agentReasoningCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const reasoningEffort = options.positionals[1]?.trim();
    if (!reasoningEffort) {
      await agentProfileCommand(options);
      return;
    }
    await patchAgentProfile(context, sessionId, { reasoningEffort }, options);
  }

  async function agentHostSessionsCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<AgentHostSessionsPayload>(
      context.baseUrl,
      `/api/agent/host/sessions?${deps.buildQueryString({ limit: getIntegerFlag(options, "limit") ?? 20 })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printOpenClawSessions(payload.sessions);
  }

  async function agentHostHistoryCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionKey = options.positionals.join(" ").trim();
    if (!sessionKey) {
      throw new Error("agent host history requires a sessionKey.");
    }
    const payload = await deps.requestGatewayJson<AgentHostHistoryPayload>(
      context.baseUrl,
      `/api/agent/host/sessions/${encodeURIComponent(sessionKey)}/history?${deps.buildQueryString({ limit: getIntegerFlag(options, "limit") ?? 20 })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printOpenClawHistory(
      payload.items.map((item) => ({
        id: item.id,
        role: item.role,
        text: item.text,
        raw: {
          id: item.id,
          role: item.role,
          createdAt: item.createdAt,
        },
      })),
    );
  }

  async function agentHostWatchCommand(options: ParsedOptions): Promise<void> {
    await deps.openClawWatchCommand(options);
  }

  async function agentHostCommand(options: ParsedOptions): Promise<void> {
    await runAgentHostCommandDispatch(options, {
      renderAgentHostHelp,
      agentHostSessionsCommand,
      agentHostHistoryCommand,
      agentHostWatchCommand,
    });
  }

  async function agentDelegatesCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const payload = await deps.requestGatewayJson<AgentDelegationsPayload>(
      context.baseUrl,
      `/api/agent/delegations?${deps.buildQueryString({
        limit: getIntegerFlag(options, "limit") ?? 20,
        ...(getStringFlag(options, "status") ? { status: getStringFlag(options, "status") } : {}),
        ...(getStringFlag(options, "session") ? { sessionId: getStringFlag(options, "session") } : {}),
      })}`,
      { timeoutMs: context.timeoutMs },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printDelegations(payload.items);
  }

  async function agentDelegateCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const sessionId = await resolveSessionId(context, options);
    const kind = options.positionals[1]?.trim();
    if (kind !== "search" && kind !== "reading" && kind !== "synthesis") {
      throw new Error("agent delegate requires one of: search, reading, synthesis.");
    }
    const taskId = getStringFlag(options, "task") ?? options.positionals[2];
    if (!taskId?.trim()) {
      throw new Error("agent delegate requires --task <taskId> or a trailing task id.");
    }

    const payload = await deps.requestGatewayJson<AgentDelegationRecord>(
      context.baseUrl,
      "/api/agent/delegations",
      {
        method: "POST",
        body: {
          sessionId,
          taskId: taskId.trim(),
          kind,
          ...(getStringFlag(options, "prompt") ? { prompt: getStringFlag(options, "prompt") } : {}),
        },
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    printDelegations([payload]);
  }

  async function agentCommand(options: ParsedOptions): Promise<void> {
    await runAgentCommandDispatch(options, {
      renderAgentHelp,
      agentRuntimeCommand,
      agentSessionsCommand,
      agentSessionCommand,
      agentProfileCommand,
      agentCognitionCommand,
      agentHistoryCommand,
      agentHooksCommand,
      agentRoleCommand,
      agentSkillsCommand,
      agentModelCommand,
      agentFallbacksCommand,
      agentReasoningCommand,
      agentHostCommand,
      agentDelegatesCommand,
      agentDelegateCommand,
    });
  }

  return {
    renderAgentHelp,
    renderAgentHostHelp,
    agentRuntimeCommand,
    agentSessionsCommand,
    agentSessionCommand,
    agentProfileCommand,
    agentCognitionCommand,
    agentHistoryCommand,
    agentHooksCommand,
    agentRoleCommand,
    agentSkillsCommand,
    agentModelCommand,
    agentFallbacksCommand,
    agentReasoningCommand,
    agentHostSessionsCommand,
    agentHostHistoryCommand,
    agentHostWatchCommand,
    agentHostCommand,
    agentDelegatesCommand,
    agentDelegateCommand,
    agentCommand,
  };
}
