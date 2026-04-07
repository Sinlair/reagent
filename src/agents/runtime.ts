import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { env } from "../config/env.js";
import {
  OpenAiCompatClient,
  type CompatConversationState,
  type CompatToolTurnResult,
  type FunctionToolSpec,
  type OpenAiCompatClientShape,
  type OpenAiReasoningEffort,
  type OpenAiWireApi,
  type ToolCallOutput,
} from "../providers/llm/openAiCompatClient.js";
import {
  LlmRegistryService,
  type LlmProviderStatus,
  type LlmRouteSelection,
  type ResolvedLlmRoute,
} from "../services/llmRegistryService.js";
import { SkillRegistryService, type WorkspaceSkillDefinition } from "../services/skillRegistryService.js";
import { ResearchDirectionService } from "../services/researchDirectionService.js";
import { ResearchDirectionReportService } from "../services/researchDirectionReportService.js";
import { ResearchDiscoveryService } from "../services/researchDiscoveryService.js";
import { ResearchFeedbackService } from "../services/researchFeedbackService.js";
import { ResearchLinkIngestionService } from "../services/researchLinkIngestionService.js";
import { ResearchPaperAnalysisService } from "../services/researchPaperAnalysisService.js";
import { ResearchRepoAnalysisService } from "../services/researchRepoAnalysisService.js";
import { ResearchModuleAssetService } from "../services/researchModuleAssetService.js";
import { ResearchBaselineService } from "../services/researchBaselineService.js";
import { ResearchPresentationService } from "../services/researchPresentationService.js";
import type { ResearchService } from "../services/researchService.js";
import { McpRegistryService } from "../services/mcpRegistryService.js";
import type { MemoryService } from "../services/memoryService.js";

export interface AgentChatInput {
  senderId: string;
  senderName?: string | undefined;
  text: string;
  source?: "direct" | "ui" | "wechat" | "openclaw" | undefined;
}

export interface AgentRole {
  id: string;
  label: string;
  instruction: string;
}

export interface AgentSkill {
  id: string;
  label: string;
  instruction: string;
  status?: "ready" | "needs-setup" | "disabled" | undefined;
  source?: string | undefined;
  notes?: string[] | undefined;
  relatedTools?: string[] | undefined;
}

export interface AgentSessionSummary {
  activeEntrySource: AgentEntrySource;
  activeEntryLabel: string;
  enabledToolsets: AgentToolsetId[];
  availableToolsets: AgentToolsetId[];
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
  wireApi?: OpenAiWireApi | undefined;
  fallbackRoutes: Array<{
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: OpenAiWireApi | undefined;
  }>;
  reasoningEffort: "default" | OpenAiReasoningEffort;
  availableRoles: AgentRole[];
  availableSkills: AgentSkill[];
  availableLlmProviders: LlmProviderStatus[];
  availableReasoningEfforts: Array<"default" | OpenAiReasoningEffort>;
  defaultRoute: {
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: OpenAiWireApi | undefined;
  };
}

export interface AgentSessionListEntry {
  sessionId: string;
  channel: string;
  senderId: string;
  activeEntrySource: AgentEntrySource;
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
  wireApi?: OpenAiWireApi | undefined;
  turnCount: number;
  lastUserMessage?: string | undefined;
  lastAssistantMessage?: string | undefined;
  updatedAt: string;
}

interface AgentTurn {
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
  name?: string | undefined;
}

interface AgentSession {
  updatedAt: string;
  roleId: string;
  skillIds: string[];
  lastEntrySource?: AgentEntrySource | undefined;
  providerId?: string | undefined;
  modelId?: string | undefined;
  fallbackRoutes?: LlmRouteSelection[] | undefined;
  reasoningEffort?: OpenAiReasoningEffort | undefined;
  turns: AgentTurn[];
}

interface AgentSessionStore {
  updatedAt: string;
  sessions: Record<string, AgentSession>;
}

interface AgentToolContext {
  input: AgentChatInput;
  session: AgentSession;
}

interface AgentToolDefinition<T> {
  name: string;
  description: string;
  skillId: string;
  toolsetIds: AgentToolsetId[];
  inputSchema: z.ZodType<T>;
  parameters: Record<string, unknown>;
  execute(args: T, context: AgentToolContext): Promise<unknown>;
}

interface AgentRuntimeOptions {
  client?: OpenAiCompatClientShape;
  model?: string;
  researchService?: Pick<ResearchService, "runResearch" | "listRecentReports" | "getReport">;
  wireApi?: OpenAiWireApi;
}

interface AutoChainStep {
  toolName: string;
  ok: boolean;
  result?: unknown;
  error?: string | undefined;
}

interface RuntimeSkillDefinition extends AgentSkill {
  prompt?: string | undefined;
  always?: boolean | undefined;
}

type AgentResolvedLlmRoute = Omit<ResolvedLlmRoute, "source"> & {
  source: "registry" | "env" | "injected";
};

type AgentEntrySource = "direct" | "ui" | "wechat" | "openclaw";
type AgentToolsetId =
  | "workspace"
  | "memory"
  | "research-core"
  | "research-admin"
  | "research-heavy"
  | "mcp";

const REASONING_EFFORT_OPTIONS: Array<"default" | OpenAiReasoningEffort> = [
  "default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

const MAX_TURNS_PER_SESSION = 16;
const MEMORY_PRIMER_LIMIT = 2;
const MAX_TOOL_ROUNDS = 6;
const MAX_FALLBACK_ECHO_CHARS = 120;
const MAX_RESPONSE_RETRIES = 3;
const ALL_AGENT_TOOLSETS: AgentToolsetId[] = [
  "workspace",
  "memory",
  "research-core",
  "research-admin",
  "research-heavy",
  "mcp",
];

const ROLE_DEFINITIONS: AgentRole[] = [
  {
    id: "operator",
    label: "Operator",
    instruction:
      "You are an operator agent for a live workspace. Prefer using tools for stateful actions and current workspace facts.",
  },
  {
    id: "assistant",
    label: "Assistant",
    instruction:
      "You are a concise general assistant. Answer directly unless a workspace tool would materially improve correctness.",
  },
  {
    id: "researcher",
    label: "Researcher",
    instruction:
      "You are a research-focused agent. Prefer evidence, explicit uncertainty, and research-oriented tool usage when the user asks analytical questions.",
  },
];

const SKILL_DEFINITIONS: AgentSkill[] = [
  {
    id: "workspace-control",
    label: "Workspace Control",
    instruction: "Use workspace tools instead of guessing live project state or available actions.",
  },
  {
    id: "memory-ops",
    label: "Memory Ops",
    instruction: "Use memory tools when user-specific facts, prior notes, or saved preferences matter.",
  },
  {
    id: "research-ops",
    label: "Research Ops",
    instruction: "Use research tools when the user asks for literature review, evidence gathering, or a structured research run.",
  },
  {
    id: "mcp-ops",
    label: "MCP Ops",
    instruction: "Use configured MCP servers and connectors when external tools should augment the workspace runtime.",
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function defaultSession(): AgentSession {
  return {
    updatedAt: nowIso(),
    roleId: "operator",
    skillIds: SKILL_DEFINITIONS.map((skill) => skill.id),
    lastEntrySource: "direct",
    providerId: undefined,
    modelId: undefined,
    fallbackRoutes: [],
    reasoningEffort: undefined,
    turns: [],
  };
}

function defaultStore(): AgentSessionStore {
  return {
    updatedAt: nowIso(),
    sessions: {},
  };
}

function trimTurns(turns: AgentTurn[]): AgentTurn[] {
  return turns.slice(-MAX_TURNS_PER_SESSION);
}

function clipPreview(text: string, maxLength = 96): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function clipText(text: string, maxLength = MAX_FALLBACK_ECHO_CHARS): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function includesCjk(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function toolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    agent_describe: "agent_describe",
    memory_search: "memory_search",
    memory_remember: "memory_remember",
    research_run: "research_run",
    research_recent: "research_recent",
    direction_list: "direction_list",
    direction_upsert: "direction_upsert",
    discovery_run: "discovery_run",
    discovery_recent: "discovery_recent",
    link_ingest: "link_ingest",
    paper_analyze: "paper_analyze",
    repo_analyze: "repo_analyze",
    module_extract: "module_extract",
    baseline_suggest: "baseline_suggest",
    feedback_record: "feedback_record",
    direction_report_generate: "direction_report_generate",
    presentation_generate: "presentation_generate",
  };
  return labels[toolName] ?? toolName;
}

function collectExecutedToolNames(toolTurns: AgentTurn[]): string[] {
  const names: string[] = [];

  for (const turn of toolTurns) {
    if (turn.name?.trim()) {
      names.push(toolLabel(turn.name.trim()));
    }

    try {
      const payload = JSON.parse(turn.content) as {
        ok?: boolean | undefined;
        result?: { autoChain?: Array<{ toolName?: string | undefined }> | undefined } | undefined;
      };
      const autoChain = Array.isArray(payload.result?.autoChain) ? payload.result.autoChain : [];
      for (const step of autoChain) {
        if (step?.toolName?.trim()) {
          names.push(toolLabel(step.toolName.trim()));
        }
      }
    } catch {}
  }

  return [...new Set(names)];
}

function hasActionReplyShape(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.includes("what i understood") ||
    normalized.includes("what i did") ||
    normalized.includes("what you should do next") ||
    text.includes("我理解的是") ||
    text.includes("我做了什么") ||
    text.includes("你接下来可以做什么")
  );
}

function buildNextStepHint(inputText: string, executedTools: string[], useChinese: boolean): string {
  if (executedTools.includes("presentation_generate")) {
    return useChinese
      ? "如果需要，我可以继续把这份内容收敛成某个主题的组会版本。"
      : "If you want, I can narrow this into a meeting-ready deck for one topic.";
  }

  if (executedTools.includes("discovery_run")) {
    return useChinese
      ? "如果其中有值得跟进的论文，直接把标题或链接发给我，我会继续深挖。"
      : "If one of the surfaced papers looks promising, send me its title or link and I will keep going.";
  }

  if (
    executedTools.includes("paper_analyze") ||
    executedTools.includes("repo_analyze") ||
    executedTools.includes("module_extract")
  ) {
    return useChinese
      ? "如果你愿意，我可以继续做基线对比、复现判断，或者生成组会摘要。"
      : "If you want, I can continue with baseline comparison, reproducibility review, or a meeting-ready summary.";
  }

  if (/direction|topic|research|paper|repo|module/iu.test(inputText)) {
    return useChinese
      ? "如果你愿意，继续给我一个链接、论文标题或研究方向，我会沿着当前上下文继续处理。"
      : "If you want, send one more link, paper title, or research topic and I will continue from the current context.";
  }

  return useChinese
    ? "如果你愿意，可以继续给我下一步目标，我会基于当前上下文接着做。"
    : "If you want, give me the next target and I will continue from the current context.";
}

function resolveInputSource(input: AgentChatInput): AgentEntrySource {
  return input.source ?? "direct";
}

function labelForEntrySource(source: AgentEntrySource): string {
  const labels: Record<AgentEntrySource, string> = {
    direct: "Direct",
    ui: "UI",
    wechat: "WeChat",
    openclaw: "OpenClaw",
  };
  return labels[source];
}

function resolveAllowedToolsetsForSource(source: AgentEntrySource): AgentToolsetId[] {
  if (source === "wechat" || source === "openclaw") {
    return ["workspace", "memory", "research-core"];
  }

  return [...ALL_AGENT_TOOLSETS];
}

function formatStructuredToolReply(
  input: AgentChatInput,
  rawReply: string,
  toolTurns: AgentTurn[],
): string {
  const normalized = rawReply.trim();
  if (!normalized || hasActionReplyShape(normalized)) {
    return normalized;
  }

  const useChinese = includesCjk(input.text);
  const executedTools = collectExecutedToolNames(toolTurns);
  const toolSummary =
    executedTools.length > 0
      ? useChinese
        ? `已执行工具：${executedTools.join("、")}。`
        : `Executed tools: ${executedTools.join(", ")}.`
      : "";

  const understoodHeading = useChinese ? "我理解的是" : "What I understood";
  const didHeading = useChinese ? "我做了什么" : "What I did";
  const nextHeading = useChinese ? "你接下来可以做什么" : "What you should do next";
  const didBody = [toolSummary, normalized].filter(Boolean).join("\n");

  return [
    understoodHeading,
    clipText(input.text.trim(), 180),
    "",
    didHeading,
    didBody,
    "",
    nextHeading,
    buildNextStepHint(input.text, executedTools, useChinese),
  ].join("\n");
}

function buildMemoryPrimer(hits: Awaited<ReturnType<MemoryService["search"]>>): string {
  if (hits.length === 0) {
    return "No relevant memory snippets were preloaded for this turn.";
  }

  return hits
    .map(
      (hit, index) =>
        `${index + 1}. ${hit.path}:${hit.startLine}-${hit.endLine} | ${hit.title}\n${hit.snippet}`,
    )
    .join("\n\n");
}

function buildTurnHistory(turns: AgentTurn[]): string {
  if (turns.length === 0) {
    return "No previous session history.";
  }

  return turns
    .map((turn) => {
      if (turn.role === "tool") {
        return `Tool ${turn.name ?? "unknown"}: ${turn.content}`;
      }
      return `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.content}`;
    })
    .join("\n");
}

function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRetryableResponsesError(error: unknown): boolean {
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  if (status && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = describeError(error).toLowerCase();
  return (
    message.includes("bad gateway") ||
    message.includes("gateway") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("rate limit")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class AgentRuntime {
  private readonly storePath: string;
  private readonly llmRegistry: LlmRegistryService;
  private readonly skillRegistry: SkillRegistryService;
  private readonly injectedClient: OpenAiCompatClient | null;
  private readonly injectedModel?: string | undefined;
  private readonly injectedWireApi?: OpenAiWireApi | undefined;
  private readonly mcpRegistry: McpRegistryService;
  private readonly researchDirectionService: ResearchDirectionService;
  private readonly researchDirectionReportService: ResearchDirectionReportService;
  private readonly researchDiscoveryService: ResearchDiscoveryService;
  private readonly researchFeedbackService: ResearchFeedbackService;
  private readonly researchLinkIngestionService: ResearchLinkIngestionService;
  private readonly researchPaperAnalysisService: ResearchPaperAnalysisService;
  private readonly researchRepoAnalysisService: ResearchRepoAnalysisService;
  private readonly researchModuleAssetService: ResearchModuleAssetService;
  private readonly researchBaselineService: ResearchBaselineService;
  private readonly researchPresentationService: ResearchPresentationService | null;
  private readonly roleMap = new Map(ROLE_DEFINITIONS.map((role) => [role.id, role]));
  private readonly skillMap = new Map(SKILL_DEFINITIONS.map((skill) => [skill.id, skill]));

  constructor(
    workspaceDir: string,
    private readonly memoryService: MemoryService,
    private readonly options: AgentRuntimeOptions = {},
  ) {
    this.storePath = path.join(workspaceDir, "channels", "agent-runtime.json");
    this.llmRegistry = new LlmRegistryService(workspaceDir);
    this.skillRegistry = new SkillRegistryService(workspaceDir);
    this.mcpRegistry = new McpRegistryService(workspaceDir);
    this.researchDirectionService = new ResearchDirectionService(workspaceDir);
    this.researchDirectionReportService = new ResearchDirectionReportService(workspaceDir);
    this.researchDiscoveryService = new ResearchDiscoveryService(workspaceDir);
    this.researchFeedbackService = new ResearchFeedbackService(workspaceDir);
    this.researchLinkIngestionService = new ResearchLinkIngestionService(workspaceDir);
    this.researchPaperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
    this.researchRepoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
    this.researchModuleAssetService = new ResearchModuleAssetService(workspaceDir);
    this.researchBaselineService = new ResearchBaselineService(workspaceDir);
    this.researchPresentationService =
      options.researchService && typeof options.researchService.getReport === "function"
        ? new ResearchPresentationService(workspaceDir, options.researchService)
        : null;
    this.injectedWireApi = options.wireApi;
    this.injectedModel = options.model;
    this.injectedClient =
      options.client
        ? new OpenAiCompatClient(
            env.OPENAI_API_KEY ?? "injected-openai-key",
            options.model ?? env.OPENAI_MODEL,
            options.wireApi ?? env.OPENAI_WIRE_API,
            env.OPENAI_BASE_URL,
            options.client,
          )
        : null;
  }

  listRoles(): AgentRole[] {
    return ROLE_DEFINITIONS.map((role) => ({ ...role }));
  }

  listSkills(): AgentSkill[] {
    return SKILL_DEFINITIONS.map((skill) => ({ ...skill }));
  }

  private async listAllSkills(): Promise<RuntimeSkillDefinition[]> {
    const workspaceSkills = await this.skillRegistry.listSkills();
    return [
      ...SKILL_DEFINITIONS.map((skill) => ({ ...skill }) satisfies RuntimeSkillDefinition),
      ...workspaceSkills.map((skill) => this.workspaceSkillToRuntimeSkill(skill)),
    ];
  }

  private workspaceSkillToRuntimeSkill(skill: WorkspaceSkillDefinition): RuntimeSkillDefinition {
    return {
      id: skill.id,
      label: skill.label,
      instruction: skill.instruction,
      status: skill.status,
      source: skill.source,
      notes: [...skill.notes],
      relatedTools: [...skill.relatedTools],
      ...(skill.prompt ? { prompt: skill.prompt } : {}),
      ...(skill.always ? { always: true } : {}),
    };
  }

  private getRoleOrDefault(roleId: string): AgentRole {
    return this.roleMap.get(roleId) ?? this.roleMap.get("operator")!;
  }

  private getLlmSelection(session: AgentSession): LlmRouteSelection | undefined {
    return session.providerId?.trim() && session.modelId?.trim()
      ? {
          providerId: session.providerId.trim(),
          modelId: session.modelId.trim(),
        }
      : undefined;
  }

  private getFallbackSelections(session: AgentSession): LlmRouteSelection[] {
    return Array.isArray(session.fallbackRoutes)
      ? session.fallbackRoutes.filter(
          (entry): entry is LlmRouteSelection =>
            Boolean(entry?.providerId?.trim()) && Boolean(entry?.modelId?.trim()),
        )
      : [];
  }

  private async resolveLlmRouteForSession(
    session: AgentSession,
  ): Promise<AgentResolvedLlmRoute> {
    if (this.injectedClient) {
      return {
        source: "injected",
        purpose: "agent",
        providerId: "injected-openai",
        providerLabel: "Injected OpenAI Client",
        providerType: "openai",
        modelId: this.injectedModel ?? env.OPENAI_MODEL,
        modelLabel: this.injectedModel ?? env.OPENAI_MODEL,
        wireApi: this.injectedWireApi ?? env.OPENAI_WIRE_API,
        status: "ready",
        notes: ["Using the injected test client for agent runtime requests."],
      };
    }

    return this.llmRegistry.resolvePurpose("agent", this.getLlmSelection(session));
  }

  private buildCompatClient(route: AgentResolvedLlmRoute): OpenAiCompatClient | null {
    if (route.providerType !== "openai" || route.status !== "ready" || !route.apiKey || !route.wireApi) {
      return null;
    }

    return new OpenAiCompatClient(route.apiKey, route.modelId, route.wireApi, route.baseUrl);
  }

  private async buildSessionSummary(senderId: string, session: AgentSession): Promise<AgentSessionSummary> {
    const activeEntrySource = session.lastEntrySource ?? "direct";
    const allowedToolsets = resolveAllowedToolsetsForSource(activeEntrySource);
    const role = this.getRoleOrDefault(session.roleId);
    const llmRoute = await this.resolveLlmRouteForSession(session);
    const defaultRoute = await this.llmRegistry.resolvePurpose("agent");
    const fallbackRoutes = await Promise.all(
      this.getFallbackSelections(session).map((selection) => this.llmRegistry.resolvePurpose("agent", selection)),
    );
    const availableLlmProviders = await this.llmRegistry.listProviders();
    const mcpServers = await this.mcpRegistry.listServers();
    const hasReadyMcpServer = mcpServers.some((server) => server.status === "ready");
    const hasMcpSetupIssue = mcpServers.some((server) => server.status === "needs-setup");
    const llmClient = this.buildCompatClient(llmRoute) ?? this.injectedClient;
    const allSkills = await this.listAllSkills();
    const validSkillIds = new Set(allSkills.map((skill) => skill.id));
    const normalizedSkillIds = [
      ...new Set(
        [
          ...session.skillIds.filter((skillId) => validSkillIds.has(skillId)),
          ...allSkills.filter((skill) => skill.always).map((skill) => skill.id),
        ],
      ),
    ];
    const skills = allSkills.map((skill) => {
      const enabled = normalizedSkillIds.includes(skill.id);
      if (skill.id === "mcp-ops") {
        return {
          ...skill,
          source: "mcp-registry",
          relatedTools: hasReadyMcpServer
            ? [`${mcpServers.filter((server) => server.status === "ready").length} remote MCP server(s)`]
            : [],
          status:
            !enabled
              ? "disabled"
              : hasReadyMcpServer && !hasMcpSetupIssue && llmClient && llmRoute.wireApi === "responses"
                ? "ready"
                : "needs-setup",
          notes:
            llmRoute.wireApi !== "responses"
              ? ["MCP remote tools require a responses-based model route in the current ReAgent runtime."]
              : mcpServers.length === 0
                ? ["No MCP servers are configured in workspace/channels/mcp-servers.json."]
                : mcpServers.flatMap((server) => server.notes),
        } satisfies AgentSkill;
      }

      if (skill.source === "workspace-skill") {
        return {
          ...skill,
          status: enabled ? skill.status ?? "ready" : "disabled",
          relatedTools: [...(skill.relatedTools ?? [])],
          notes: [...(skill.notes ?? [])],
        } satisfies AgentSkill;
      }

      return {
        ...skill,
        source: "local-runtime",
        status: enabled ? "ready" : "disabled",
        relatedTools:
          skill.id === "workspace-control"
            ? ["agent_describe"]
            : skill.id === "memory-ops"
              ? ["memory_search", "memory_remember"]
              : skill.id === "research-ops"
                ? ["research_run", "research_recent", "direction_list", "direction_upsert", "discovery_run", "discovery_recent", "link_ingest", "paper_analyze", "repo_analyze", "module_extract", "baseline_suggest", "feedback_record", "direction_report_generate", "presentation_generate"]
                : [],
      } satisfies AgentSkill;
    });

    return {
      activeEntrySource,
      activeEntryLabel: labelForEntrySource(activeEntrySource),
      enabledToolsets: allowedToolsets,
      availableToolsets: [...ALL_AGENT_TOOLSETS],
      roleId: role.id,
      roleLabel: role.label,
      skillIds: normalizedSkillIds,
      skillLabels: skills.filter((skill) => normalizedSkillIds.includes(skill.id)).map((skill) => skill.label),
      providerId: llmRoute.providerId,
      providerLabel: llmRoute.providerLabel,
      modelId: llmRoute.modelId,
      modelLabel: llmRoute.modelLabel,
      llmStatus: llmRoute.status,
      llmSource: llmRoute.source,
      ...(llmRoute.wireApi ? { wireApi: llmRoute.wireApi } : {}),
      fallbackRoutes: fallbackRoutes.map((route) => ({
        providerId: route.providerId,
        providerLabel: route.providerLabel,
        modelId: route.modelId,
        modelLabel: route.modelLabel,
        llmStatus: route.status,
        llmSource: route.source,
        ...(route.wireApi ? { wireApi: route.wireApi } : {}),
      })),
      reasoningEffort: session.reasoningEffort ?? "default",
      availableRoles: this.listRoles(),
      availableSkills: skills,
      availableLlmProviders,
      availableReasoningEfforts: [...REASONING_EFFORT_OPTIONS],
      defaultRoute: {
        providerId: defaultRoute.providerId,
        providerLabel: defaultRoute.providerLabel,
        modelId: defaultRoute.modelId,
        modelLabel: defaultRoute.modelLabel,
        llmStatus: defaultRoute.status,
        llmSource: defaultRoute.source,
        ...(defaultRoute.wireApi ? { wireApi: defaultRoute.wireApi } : {}),
      },
    };
  }

  async describeSession(senderId: string): Promise<AgentSessionSummary> {
    const session = await this.getSession(senderId);
    return this.buildSessionSummary(senderId, session);
  }

  async listSessions(): Promise<AgentSessionListEntry[]> {
    const store = await this.readStore();

    const entries = await Promise.all(
      Object.entries(store.sessions).map(async ([sessionId, session]) => {
        const summary = await this.buildSessionSummary(sessionId.split(":").slice(1).join(":") || sessionId, session);
        const lastUserTurn = [...session.turns].reverse().find((turn) => turn.role === "user");
        const lastAssistantTurn = [...session.turns].reverse().find((turn) => turn.role === "assistant");
        const [channel, ...senderParts] = sessionId.split(":");
        const senderId = senderParts.join(":") || sessionId;

        return {
          sessionId,
          channel: channel || "workspace",
          senderId,
          activeEntrySource: summary.activeEntrySource,
          roleId: summary.roleId,
          roleLabel: summary.roleLabel,
          skillIds: summary.skillIds,
          skillLabels: summary.skillLabels,
          providerId: summary.providerId,
          providerLabel: summary.providerLabel,
          modelId: summary.modelId,
          modelLabel: summary.modelLabel,
          llmStatus: summary.llmStatus,
          llmSource: summary.llmSource,
          ...(summary.wireApi ? { wireApi: summary.wireApi } : {}),
          turnCount: session.turns.length,
          ...(lastUserTurn ? { lastUserMessage: clipPreview(lastUserTurn.content) } : {}),
          ...(lastAssistantTurn ? { lastAssistantMessage: clipPreview(lastAssistantTurn.content) } : {}),
          updatedAt: session.updatedAt,
        } satisfies AgentSessionListEntry;
      }),
    );

    return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async setRole(senderId: string, roleId: string): Promise<AgentSessionSummary> {
    const normalized = roleId.trim().toLowerCase();
    const role = this.roleMap.get(normalized);
    if (!role) {
      throw new Error(
        `Unknown agent role "${roleId}". Available roles: ${ROLE_DEFINITIONS.map((item) => item.id).join(", ")}`,
      );
    }

    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const session = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...session,
        roleId: role.id,
        updatedAt: nowIso(),
      };
      return store;
    });

    return this.describeSession(senderId);
  }

  async setSkills(senderId: string, skillIds: string[]): Promise<AgentSessionSummary> {
    const availableSkillIds = new Set((await this.listAllSkills()).map((skill) => skill.id));
    const normalized = [...new Set(skillIds.map((skillId) => skillId.trim().toLowerCase()).filter(Boolean))];
    const validSkillIds = normalized.filter((skillId) => availableSkillIds.has(skillId));

    if (validSkillIds.length === 0) {
      const available = [...availableSkillIds].sort().join(", ");
      throw new Error(`At least one valid skill is required. Available skills: ${available}`);
    }

    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const session = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...session,
        skillIds: validSkillIds,
        updatedAt: nowIso(),
      };
      return store;
    });

    return this.describeSession(senderId);
  }

  async setModel(senderId: string, providerId: string, modelId: string): Promise<AgentSessionSummary> {
    const normalizedProviderId = providerId.trim();
    const normalizedModelId = modelId.trim();
    if (!normalizedProviderId || !normalizedModelId) {
      throw new Error("Both providerId and modelId are required.");
    }

    const route = await this.llmRegistry.resolvePurpose("agent", {
      providerId: normalizedProviderId,
      modelId: normalizedModelId,
    });

    if (route.source === "registry" && route.status === "needs-setup" && route.notes.some((note) => note.includes("not found"))) {
      throw new Error(route.notes[0] ?? "Unknown provider/model selection.");
    }

    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const session = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...session,
        providerId: normalizedProviderId,
        modelId: normalizedModelId,
        updatedAt: nowIso(),
      };
      return store;
    });

    return this.describeSession(senderId);
  }

  async clearModel(senderId: string): Promise<AgentSessionSummary> {
    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const session = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...session,
        providerId: undefined,
        modelId: undefined,
        updatedAt: nowIso(),
      };
      return store;
    });

    return this.describeSession(senderId);
  }

  async setFallbacks(senderId: string, selections: LlmRouteSelection[]): Promise<AgentSessionSummary> {
    const normalizedSelections = [
      ...new Map(
        selections
          .map((selection) => ({
            providerId: selection.providerId.trim(),
            modelId: selection.modelId.trim(),
          }))
          .filter((selection) => selection.providerId && selection.modelId)
          .map((selection) => [`${selection.providerId}::${selection.modelId}`, selection]),
      ).values(),
    ];

    for (const selection of normalizedSelections) {
      const route = await this.llmRegistry.resolvePurpose("agent", selection);
      if (
        route.source === "registry" &&
        route.status === "needs-setup" &&
        route.notes.some((note) => note.includes("not found"))
      ) {
        throw new Error(route.notes[0] ?? "Unknown fallback route.");
      }
    }

    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const session = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...session,
        fallbackRoutes: normalizedSelections,
        updatedAt: nowIso(),
      };
      return store;
    });

    return this.describeSession(senderId);
  }

  async setReasoning(
    senderId: string,
    reasoningEffort: "default" | OpenAiReasoningEffort,
  ): Promise<AgentSessionSummary> {
    if (!REASONING_EFFORT_OPTIONS.includes(reasoningEffort)) {
      throw new Error(`Unsupported reasoning effort "${reasoningEffort}".`);
    }

    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const session = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...session,
        reasoningEffort: reasoningEffort === "default" ? undefined : reasoningEffort,
        updatedAt: nowIso(),
      };
      return store;
    });

    return this.describeSession(senderId);
  }

  async reply(input: AgentChatInput): Promise<string> {
    const text = input.text.trim();
    if (!text) {
      return "Please enter a message.";
    }

    await this.setLastEntrySource(input.senderId, resolveInputSource(input));
    const session = await this.getSession(input.senderId);
    const memoryPrimer = await this.memoryService.search(text, MEMORY_PRIMER_LIMIT).catch(() => []);
    const llmRoute = await this.resolveLlmRouteForSession(session);
    const llmClient = this.injectedClient ?? this.buildCompatClient(llmRoute);

    const reply = llmClient
      ? await this.replyWithTools(input, session, memoryPrimer, llmClient, llmRoute).catch(() =>
          this.buildFallbackReply(input, memoryPrimer),
        )
      : this.buildFallbackReply(input, memoryPrimer);

    await this.appendTurns(input.senderId, [
      {
        role: "user",
        content: text,
        createdAt: nowIso(),
      },
      {
        role: "assistant",
        content: reply,
        createdAt: nowIso(),
      },
    ]);

    return reply;
  }

  private buildSessionKey(senderId: string): string {
    return `wechat:${senderId}`;
  }

  private async readStore(): Promise<AgentSessionStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AgentSessionStore>;
      const sessions =
        parsed.sessions && typeof parsed.sessions === "object"
          ? Object.fromEntries(
              Object.entries(parsed.sessions).map(([sessionId, session]) => {
                const partial = session as Partial<AgentSession>;
                const roleId = this.roleMap.has(String(partial.roleId)) ? String(partial.roleId) : "operator";
                const skillIds = Array.isArray(partial.skillIds)
                  ? partial.skillIds
                      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                      .map((value) => value.trim())
                  : SKILL_DEFINITIONS.map((skill) => skill.id);
                const providerId =
                  typeof partial.providerId === "string" && partial.providerId.trim()
                    ? partial.providerId.trim()
                    : undefined;
                const lastEntrySource =
                  typeof partial.lastEntrySource === "string" &&
                  ["direct", "ui", "wechat", "openclaw"].includes(partial.lastEntrySource)
                    ? (partial.lastEntrySource as AgentEntrySource)
                    : "direct";
                const modelId =
                  typeof partial.modelId === "string" && partial.modelId.trim()
                    ? partial.modelId.trim()
                    : undefined;
                const fallbackRoutes = Array.isArray(partial.fallbackRoutes)
                  ? partial.fallbackRoutes
                      .filter(
                        (entry): entry is LlmRouteSelection =>
                          Boolean(entry) &&
                          typeof entry === "object" &&
                          typeof entry.providerId === "string" &&
                          typeof entry.modelId === "string" &&
                          entry.providerId.trim().length > 0 &&
                          entry.modelId.trim().length > 0,
                      )
                      .map((entry) => ({
                        providerId: entry.providerId.trim(),
                        modelId: entry.modelId.trim(),
                      }))
                  : [];
                const rawReasoningEffort =
                  typeof partial.reasoningEffort === "string" ? partial.reasoningEffort.trim() : undefined;
                const reasoningEffort =
                  rawReasoningEffort &&
                  rawReasoningEffort !== "default" &&
                  REASONING_EFFORT_OPTIONS.includes(rawReasoningEffort as "default" | OpenAiReasoningEffort)
                    ? (rawReasoningEffort as OpenAiReasoningEffort)
                    : undefined;
                const turns = Array.isArray(partial.turns)
                  ? partial.turns
                      .filter(
                        (turn): turn is AgentTurn =>
                          Boolean(turn) &&
                          typeof turn === "object" &&
                          (turn.role === "user" || turn.role === "assistant" || turn.role === "tool") &&
                          typeof turn.content === "string" &&
                          typeof turn.createdAt === "string",
                      )
                      .map((turn) => ({
                        role: turn.role,
                        content: turn.content,
                        createdAt: turn.createdAt,
                        ...(turn.name ? { name: turn.name } : {}),
                      }))
                  : [];

                return [
                  sessionId,
                  {
                    updatedAt:
                      typeof partial.updatedAt === "string" ? partial.updatedAt : nowIso(),
                    roleId,
                    skillIds: skillIds.length ? skillIds : SKILL_DEFINITIONS.map((skill) => skill.id),
                    lastEntrySource,
                    ...(providerId ? { providerId } : {}),
                    ...(modelId ? { modelId } : {}),
                    fallbackRoutes,
                    ...(reasoningEffort ? { reasoningEffort } : {}),
                    turns,
                  } satisfies AgentSession,
                ];
              }),
            )
          : {};

      return {
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
        sessions,
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: AgentSessionStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  private async mutateStore(
    mutator: (store: AgentSessionStore) => AgentSessionStore | Promise<AgentSessionStore>,
  ): Promise<void> {
    const nextStore = await mutator(await this.readStore());
    await this.writeStore(nextStore);
  }

  private async getSession(senderId: string): Promise<AgentSession> {
    const store = await this.readStore();
    const key = this.buildSessionKey(senderId);
    const existing = store.sessions[key];
    if (existing) {
      return existing;
    }

    const session = defaultSession();
    store.sessions[key] = session;
    await this.writeStore(store);
    return session;
  }

  private async appendTurns(senderId: string, turns: AgentTurn[]): Promise<void> {
    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const current = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...current,
        updatedAt: nowIso(),
        turns: trimTurns([...current.turns, ...turns]),
      };
      return store;
    });
  }

  private async setLastEntrySource(senderId: string, source: AgentEntrySource): Promise<void> {
    await this.mutateStore((store) => {
      const key = this.buildSessionKey(senderId);
      const current = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...current,
        lastEntrySource: source,
        updatedAt: nowIso(),
      };
      return store;
    });
  }

  private buildInstructions(
    input: AgentChatInput,
    session: AgentSession,
    llmRoute: AgentResolvedLlmRoute,
    allSkills: RuntimeSkillDefinition[],
  ): string {
    const source = resolveInputSource(input);
    const allowedToolsets = resolveAllowedToolsetsForSource(source);
    const role = this.getRoleOrDefault(session.roleId);
    const skillMap = new Map(allSkills.map((skill) => [skill.id, skill]));
    const enabledSkillIds = new Set([
      ...session.skillIds,
      ...allSkills.filter((skill) => skill.always).map((skill) => skill.id),
    ]);
    const skills = [...enabledSkillIds]
      .map((skillId) => skillMap.get(skillId))
      .filter((skill): skill is AgentSkill => Boolean(skill));
    const workspaceSkillPrompts = allSkills.filter(
      (skill) =>
        enabledSkillIds.has(skill.id) &&
        skill.source === "workspace-skill" &&
        typeof skill.prompt === "string" &&
        skill.prompt.trim().length > 0,
    );

    return [
      "You are ReAgent, operating inside a host-style workspace runtime.",
      "Act like a tool-using operator agent, not a generic chatbot shell.",
      `Active role: ${role.label} (${role.id})`,
      `Active entry: ${labelForEntrySource(source)} (${source})`,
      `Enabled toolsets for this entry: ${allowedToolsets.join(", ")}`,
      `Model route: ${llmRoute.providerLabel}/${llmRoute.modelLabel}${llmRoute.wireApi ? ` via ${llmRoute.wireApi}` : ""}`,
      role.instruction,
      "",
      "Enabled skills:",
      ...skills.map((skill) => `- ${skill.label} (${skill.id}): ${skill.instruction}`),
      "",
      "Tool usage rules:",
      "- Use tools for workspace state, saved memory, and research tasks when they improve correctness.",
      "- When the user sends an article link, paper link, or GitHub link, prefer using the corresponding research tools instead of guessing.",
      "- If you call a tool, wait for its result and then answer with the updated facts.",
      "- Do not invent tool results.",
      "- Respect the active entry and toolsets. If a tool is unavailable in this entry, do not assume you can call it.",
      "- If the user describes a research direction or preference, use direction_upsert when it should become lasting workspace state.",
      "- If the user sends an article link, start with link_ingest, then use paper_analyze or repo_analyze if the extracted candidates are useful.",
      "- Prefer continuing the research pipeline when one strong candidate is found: link_ingest -> paper_analyze -> repo_analyze -> module_extract.",
      "- If the user asks for recent papers, use discovery_run or discovery_recent instead of giving generic suggestions.",
      "- If the user asks for baselines or innovation directions, use baseline_suggest.",
      "- If the user gives explicit positive or negative research feedback, use feedback_record so later discovery can adapt.",
      "- If the user asks for a direction overview, weekly synthesis, or topic summary, use direction_report_generate.",
      "- If the user asks for meeting slides or a weekly deck, use presentation_generate.",
      "- Keep the final answer concise and actionable.",
      "- When tools or research actions were involved, structure the final answer as: What I understood / What I did / What you should do next.",
      "- Reply in the same language as the user.",
      ...(workspaceSkillPrompts.length > 0
        ? [
            "",
            "Enabled workspace skills:",
            ...workspaceSkillPrompts.flatMap((skill) => [
              `### ${skill.label} (${skill.id})`,
              skill.prompt ?? "",
            ]),
          ]
        : []),
    ].join("\n");
  }

  private buildUserInput(
    input: AgentChatInput,
    session: AgentSession,
    memoryPrimer: Awaited<ReturnType<MemoryService["search"]>>,
  ): string {
    return [
      "Current workspace primer:",
      buildMemoryPrimer(memoryPrimer),
      "",
      "Recent session history:",
      buildTurnHistory(session.turns),
      "",
      `Current user (${input.senderName?.trim() || input.senderId}): ${input.text.trim()}`,
    ].join("\n");
  }

  private buildAutoChainSummary(autoChain: AutoChainStep[]): string[] {
    return autoChain.map((step) =>
      step.ok
        ? `${step.toolName}: completed`
        : `${step.toolName}: failed${step.error ? ` (${step.error})` : ""}`,
    );
  }

  private pickSingleRepoUrl(
    repoCandidates: Array<{ url?: string | undefined }> | undefined,
  ): string | undefined {
    const urls = [
      ...new Set(
        (repoCandidates ?? [])
          .map((candidate) => candidate?.url?.trim())
          .filter((url): url is string => Boolean(url)),
      ),
    ];

    return urls.length === 1 ? urls[0] : undefined;
  }

  private shouldAutoExtractModules(inputText: string, triggerToolName: string): boolean {
    if (triggerToolName === "repo_analyze") {
      return true;
    }

    return /(module|extract|download|archive|reuse|reusable|implementation|implement|codebase|repo snapshot|代码|模块|下载|归档|复现|实现)/iu.test(
      inputText,
    );
  }

  private async runRepoFollowUps(
    repoUrl: string,
    contextTitle: string | undefined,
    inputText: string,
    triggerToolName: string,
  ): Promise<AutoChainStep[]> {
    const autoChain: AutoChainStep[] = [];

    try {
      const repoReport = await this.researchRepoAnalysisService.analyze({
        url: repoUrl,
        ...(contextTitle ? { contextTitle } : {}),
      });
      autoChain.push({
        toolName: "repo_analyze",
        ok: true,
        result: repoReport,
      });

      if (this.shouldAutoExtractModules(inputText, triggerToolName)) {
        try {
          const moduleAsset = await this.researchModuleAssetService.extract({
            url: repoUrl,
            ...(contextTitle ? { contextTitle } : {}),
          });
          autoChain.push({
            toolName: "module_extract",
            ok: true,
            result: moduleAsset,
          });
        } catch (error) {
          autoChain.push({
            toolName: "module_extract",
            ok: false,
            error: describeError(error),
          });
        }
      }
    } catch (error) {
      autoChain.push({
        toolName: "repo_analyze",
        ok: false,
        error: describeError(error),
      });
    }

    return autoChain;
  }

  private async enrichResearchToolResult(
    toolName: string,
    result: unknown,
    input: AgentChatInput,
  ): Promise<unknown> {
    if (!result || typeof result !== "object") {
      return result;
    }

    if (toolName === "link_ingest") {
      const sourceItem = result as {
        id: string;
        title?: string | undefined;
        paperCandidates?: Array<unknown> | undefined;
        repoCandidates?: Array<{ url?: string | undefined }> | undefined;
      };
      const autoChain: AutoChainStep[] = [];
      const hasSinglePaperCandidate = Array.isArray(sourceItem.paperCandidates) && sourceItem.paperCandidates.length === 1;

      if (sourceItem.id && hasSinglePaperCandidate) {
        try {
          const paperReport = await this.researchPaperAnalysisService.analyze({
            sourceItemId: sourceItem.id,
          });
          autoChain.push({
            toolName: "paper_analyze",
            ok: true,
            result: paperReport,
          });

          const repoUrl = this.pickSingleRepoUrl(
            Array.isArray(paperReport.repoCandidates) ? paperReport.repoCandidates : [],
          );
          if (repoUrl) {
            autoChain.push(
              ...(await this.runRepoFollowUps(repoUrl, paperReport.paper?.title, input.text, toolName)),
            );
          }
        } catch (error) {
          autoChain.push({
            toolName: "paper_analyze",
            ok: false,
            error: describeError(error),
          });
        }
      } else {
        const repoUrl = this.pickSingleRepoUrl(sourceItem.repoCandidates);
        if (repoUrl) {
          autoChain.push(
            ...(await this.runRepoFollowUps(repoUrl, sourceItem.title, input.text, toolName)),
          );
        }
      }

      return autoChain.length > 0
        ? {
            ...sourceItem,
            autoChain,
            autoChainSummary: this.buildAutoChainSummary(autoChain),
          }
        : sourceItem;
    }

    if (toolName === "paper_analyze") {
      const paperReport = result as {
        paper?: { title?: string | undefined } | undefined;
        repoCandidates?: Array<{ url?: string | undefined }> | undefined;
      };
      const repoUrl = this.pickSingleRepoUrl(paperReport.repoCandidates);
      if (!repoUrl) {
        return paperReport;
      }

      const autoChain = await this.runRepoFollowUps(
        repoUrl,
        paperReport.paper?.title,
        input.text,
        toolName,
      );

      return autoChain.length > 0
        ? {
            ...paperReport,
            autoChain,
            autoChainSummary: this.buildAutoChainSummary(autoChain),
          }
        : paperReport;
    }

    if (toolName === "repo_analyze") {
      const repoReport = result as {
        url?: string | undefined;
        title?: string | undefined;
      };
      const repoUrl = repoReport.url?.trim();
      if (!repoUrl) {
        return repoReport;
      }

      const autoChain = await this.runRepoFollowUps(
        repoUrl,
        repoReport.title,
        input.text,
        toolName,
      );
      const filteredAutoChain = autoChain.filter((step) => step.toolName !== "repo_analyze");

      return filteredAutoChain.length > 0
        ? {
            ...repoReport,
            autoChain: filteredAutoChain,
            autoChainSummary: this.buildAutoChainSummary(filteredAutoChain),
          }
        : repoReport;
    }

    return result;
  }

  private buildTools(
    input: AgentChatInput,
    session: AgentSession,
  ): AgentToolDefinition<unknown>[] {
    const allowedToolsets = new Set(resolveAllowedToolsetsForSource(resolveInputSource(input)));
    const tools: AgentToolDefinition<unknown>[] = [
      {
        name: "agent_describe",
        description: "Read the current agent session configuration, including active role and enabled skills.",
        skillId: "workspace-control",
        toolsetIds: ["workspace"],
        inputSchema: z.object({}),
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => this.describeSession(input.senderId),
      },
      {
        name: "memory_search",
        description: "Search saved memory files for relevant notes, decisions, and prior facts.",
        skillId: "memory-ops",
        toolsetIds: ["memory"],
        inputSchema: z.object({
          query: z.string().trim().min(1),
          limit: z.number().int().min(1).max(6).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 6 },
          },
          required: ["query"],
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as { query: string; limit?: number | undefined };
          return {
            query: parsed.query,
            results: await this.memoryService.search(parsed.query, parsed.limit ?? 4),
          };
        },
      },
      {
        name: "memory_remember",
        description: "Write a new note into daily or long-term memory.",
        skillId: "memory-ops",
        toolsetIds: ["memory"],
        inputSchema: z.object({
          content: z.string().trim().min(1),
          scope: z.enum(["daily", "long-term"]).optional(),
          title: z.string().trim().min(1).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", minLength: 1 },
            scope: { type: "string", enum: ["daily", "long-term"] },
            title: { type: "string", minLength: 1 },
          },
          required: ["content"],
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as {
            content: string;
            scope?: "daily" | "long-term" | undefined;
            title?: string | undefined;
          };
          const saved = await this.memoryService.remember({
            scope: parsed.scope ?? "daily",
            title: parsed.title,
            content: parsed.content,
            source: "agent-runtime",
          });
          return {
            saved: true,
            path: saved.path,
            kind: saved.kind,
            updatedAt: saved.updatedAt,
          };
        },
      },
    ];

    if (this.options.researchService) {
      tools.push(
        {
          name: "research_run",
          description: "Launch a new structured research workflow and return the generated report summary.",
          skillId: "research-ops",
          toolsetIds: ["research-core"],
          inputSchema: z.object({
            topic: z.string().trim().min(1),
            question: z.string().trim().min(1).optional(),
            maxPapers: z.number().int().min(1).max(20).optional(),
          }),
          parameters: {
            type: "object",
            properties: {
              topic: { type: "string", minLength: 1 },
              question: { type: "string", minLength: 1 },
              maxPapers: { type: "integer", minimum: 1, maximum: 20 },
            },
            required: ["topic"],
            additionalProperties: false,
          },
          execute: async (args) => {
            const parsed = args as {
              topic: string;
              question?: string | undefined;
              maxPapers?: number | undefined;
            };
            const report = await this.options.researchService!.runResearch({
              topic: parsed.topic,
              question:
                parsed.question ??
                `Agent runtime request from ${input.senderName?.trim() || input.senderId}: ${parsed.topic}`,
              maxPapers: parsed.maxPapers ?? 10,
            });
            return {
              taskId: report.taskId,
              topic: report.topic,
              summary: report.summary,
              findings: report.findings.slice(0, 3),
              verdict: report.critique.verdict,
            };
          },
        },
        {
          name: "research_recent",
          description: "List recent research runs stored in the workspace.",
          skillId: "research-ops",
          toolsetIds: ["research-core"],
          inputSchema: z.object({
            limit: z.number().int().min(1).max(10).optional(),
          }),
          parameters: {
            type: "object",
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 10 },
            },
            additionalProperties: false,
          },
          execute: async (args) => {
            const parsed = args as { limit?: number | undefined };
            return {
              reports: await this.options.researchService!.listRecentReports(parsed.limit ?? 5),
            };
          },
        },
      );
    }

    tools.push(
      {
        name: "direction_list",
        description: "List structured research direction profiles stored in the workspace.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({}),
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => ({
          profiles: await this.researchDirectionService.listProfiles(),
        }),
      },
      {
        name: "direction_upsert",
        description: "Create or update a structured research direction profile in the workspace.",
        skillId: "research-ops",
        toolsetIds: ["research-admin"],
        inputSchema: z.object({
          id: z.string().trim().min(1).optional(),
          label: z.string().trim().min(1),
          summary: z.string().trim().min(1).optional(),
          subDirections: z.array(z.string().trim().min(1)).optional(),
          excludedTopics: z.array(z.string().trim().min(1)).optional(),
          preferredVenues: z.array(z.string().trim().min(1)).optional(),
          preferredDatasets: z.array(z.string().trim().min(1)).optional(),
          preferredBenchmarks: z.array(z.string().trim().min(1)).optional(),
          preferredPaperStyles: z.array(z.enum(["theory", "engineering", "reproducibility", "application"])).optional(),
          openQuestions: z.array(z.string().trim().min(1)).optional(),
          currentGoals: z.array(z.string().trim().min(1)).optional(),
          queryHints: z.array(z.string().trim().min(1)).optional(),
          priority: z.enum(["primary", "secondary", "watchlist"]).optional(),
          enabled: z.boolean().optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
            label: { type: "string", minLength: 1 },
            summary: { type: "string", minLength: 1 },
            subDirections: { type: "array", items: { type: "string", minLength: 1 } },
            excludedTopics: { type: "array", items: { type: "string", minLength: 1 } },
            preferredVenues: { type: "array", items: { type: "string", minLength: 1 } },
            preferredDatasets: { type: "array", items: { type: "string", minLength: 1 } },
            preferredBenchmarks: { type: "array", items: { type: "string", minLength: 1 } },
            preferredPaperStyles: { type: "array", items: { type: "string", enum: ["theory", "engineering", "reproducibility", "application"] } },
            openQuestions: { type: "array", items: { type: "string", minLength: 1 } },
            currentGoals: { type: "array", items: { type: "string", minLength: 1 } },
            queryHints: { type: "array", items: { type: "string", minLength: 1 } },
            priority: { type: "string", enum: ["primary", "secondary", "watchlist"] },
            enabled: { type: "boolean" },
          },
          required: ["label"],
          additionalProperties: false,
        },
        execute: async (args) => this.researchDirectionService.upsertProfile(args as {
          id?: string | undefined;
          label: string;
          summary?: string | undefined;
          subDirections?: string[] | undefined;
          excludedTopics?: string[] | undefined;
          preferredVenues?: string[] | undefined;
          preferredDatasets?: string[] | undefined;
          preferredBenchmarks?: string[] | undefined;
          preferredPaperStyles?: Array<"theory" | "engineering" | "reproducibility" | "application"> | undefined;
          openQuestions?: string[] | undefined;
          currentGoals?: string[] | undefined;
          queryHints?: string[] | undefined;
          priority?: "primary" | "secondary" | "watchlist" | undefined;
          enabled?: boolean | undefined;
        }),
      },
      {
        name: "discovery_run",
        description: "Run paper discovery for the configured research directions and optionally push the digest to WeChat.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          directionId: z.string().trim().min(1).optional(),
          maxPapersPerQuery: z.number().int().min(1).max(10).optional(),
          topK: z.number().int().min(1).max(10).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            directionId: { type: "string", minLength: 1 },
            maxPapersPerQuery: { type: "integer", minimum: 1, maximum: 10 },
            topK: { type: "integer", minimum: 1, maximum: 10 },
          },
          additionalProperties: false,
        },
        execute: async (args) => this.researchDiscoveryService.runDiscovery(args as {
          directionId?: string | undefined;
          maxPapersPerQuery?: number | undefined;
          topK?: number | undefined;
        }),
      },
      {
        name: "discovery_recent",
        description: "List recent discovery runs and digests.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          limit: z.number().int().min(1).max(20).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as { limit?: number | undefined };
          return {
            runs: await this.researchDiscoveryService.listRecentRuns(parsed.limit ?? 10),
          };
        },
      },
      {
        name: "link_ingest",
        description: "Read an article or raw content, extract outbound links, paper candidates, and GitHub repo candidates.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          url: z.string().trim().url().optional(),
          rawContent: z.string().trim().min(1).optional(),
        }).refine((value) => Boolean(value.url || value.rawContent), {
          message: "Either url or rawContent is required.",
        }),
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            rawContent: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        execute: async (args) => this.researchLinkIngestionService.ingest(args as {
          url?: string | undefined;
          rawContent?: string | undefined;
        }),
      },
            {
        name: "paper_analyze",
        description: "Perform a deep analysis for a paper from a title, paper URL, article URL, or stored source item.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          sourceItemId: z.string().trim().min(1).optional(),
          url: z.string().trim().url().optional(),
          title: z.string().trim().min(1).optional(),
        }).refine((value) => Boolean(value.sourceItemId || value.url || value.title), {
          message: "sourceItemId, url, or title is required.",
        }),
        parameters: {
          type: "object",
          properties: {
            sourceItemId: { type: "string", minLength: 1 },
            url: { type: "string", format: "uri" },
            title: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        execute: async (args) => this.researchPaperAnalysisService.analyze(args as {
          sourceItemId?: string | undefined;
          url?: string | undefined;
          title?: string | undefined;
        }),
      },      {
        name: "repo_analyze",
        description: "Inspect a GitHub repository linked to a paper or article and return a structured repo report.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          url: z.string().trim().url(),
          contextTitle: z.string().trim().min(1).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            contextTitle: { type: "string", minLength: 1 },
          },
          required: ["url"],
          additionalProperties: false,
        },
        execute: async (args) => this.researchRepoAnalysisService.analyze(args as {
          url: string;
          contextTitle?: string | undefined;
        }),
      },
                  {
        name: "module_extract",
        description: "Download a GitHub repository archive and record reusable module paths for later reuse.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          url: z.string().trim().url(),
          contextTitle: z.string().trim().min(1).optional(),
          selectedPaths: z.array(z.string().trim().min(1)).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            contextTitle: { type: "string", minLength: 1 },
            selectedPaths: { type: "array", items: { type: "string", minLength: 1 } },
          },
          required: ["url"],
          additionalProperties: false,
        },
        execute: async (args) => this.researchModuleAssetService.extract(args as {
          url: string;
          contextTitle?: string | undefined;
          selectedPaths?: string[] | undefined;
        }),
      },
      {
        name: "baseline_suggest",
        description: "Suggest likely baselines, reusable modules, and innovation directions for a topic or direction.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          directionId: z.string().trim().min(1).optional(),
          topic: z.string().trim().min(1).optional(),
        }).refine((value) => Boolean(value.directionId || value.topic), {
          message: "directionId or topic is required.",
        }),
        parameters: {
          type: "object",
          properties: {
            directionId: { type: "string", minLength: 1 },
            topic: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        execute: async (args) => this.researchBaselineService.suggest(args as {
          directionId?: string | undefined;
          topic?: string | undefined;
        }),
      },
      {
        name: "feedback_record",
        description: "Record explicit user feedback about paper quality, direction preference, or recommendation usefulness.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          feedback: z.enum([
            "useful",
            "not-useful",
            "more-like-this",
            "less-like-this",
            "too-theoretical",
            "too-engineering-heavy",
            "worth-following",
            "not-worth-following"
          ]),
          directionId: z.string().trim().min(1).optional(),
          topic: z.string().trim().min(1).optional(),
          paperTitle: z.string().trim().min(1).optional(),
          venue: z.string().trim().min(1).optional(),
          sourceUrl: z.string().trim().url().optional(),
          notes: z.string().trim().min(1).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            feedback: {
              type: "string",
              enum: [
                "useful",
                "not-useful",
                "more-like-this",
                "less-like-this",
                "too-theoretical",
                "too-engineering-heavy",
                "worth-following",
                "not-worth-following"
              ]
            },
            directionId: { type: "string", minLength: 1 },
            topic: { type: "string", minLength: 1 },
            paperTitle: { type: "string", minLength: 1 },
            venue: { type: "string", minLength: 1 },
            sourceUrl: { type: "string", format: "uri" },
            notes: { type: "string", minLength: 1 },
          },
          required: ["feedback"],
          additionalProperties: false,
        },
        execute: async (args, context) =>
          this.researchFeedbackService.record({
            ...(context.input.senderId ? { senderId: context.input.senderId } : {}),
            ...(context.input.senderName?.trim() ? { senderName: context.input.senderName.trim() } : {}),
            ...(args as {
              feedback:
                | "useful"
                | "not-useful"
                | "more-like-this"
                | "less-like-this"
                | "too-theoretical"
                | "too-engineering-heavy"
                | "worth-following"
                | "not-worth-following";
              directionId?: string | undefined;
              topic?: string | undefined;
              paperTitle?: string | undefined;
              venue?: string | undefined;
              sourceUrl?: string | undefined;
              notes?: string | undefined;
            }),
          }),
      },
      {
        name: "direction_report_generate",
        description: "Generate a reusable direction report with representative papers, baselines, modules, and suggested routes.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          directionId: z.string().trim().min(1).optional(),
          topic: z.string().trim().min(1).optional(),
          days: z.number().int().min(1).max(30).optional(),
        }).refine((value) => Boolean(value.directionId || value.topic), {
          message: "directionId or topic is required.",
        }),
        parameters: {
          type: "object",
          properties: {
            directionId: { type: "string", minLength: 1 },
            topic: { type: "string", minLength: 1 },
            days: { type: "integer", minimum: 1, maximum: 30 },
          },
          additionalProperties: false,
        },
        execute: async (args) => this.researchDirectionReportService.generate(args as {
          directionId?: string | undefined;
          topic?: string | undefined;
          days?: number | undefined;
        }),
      },
      {
        name: "presentation_generate",
        description: "Generate a markdown draft for a group meeting presentation from recent research reports.",
        skillId: "research-ops",
        toolsetIds: ["research-heavy"],
        inputSchema: z.object({
          days: z.number().int().min(1).max(30).optional(),
          topic: z.string().trim().min(1).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            days: { type: "integer", minimum: 1, maximum: 30 },
            topic: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        execute: async (args) => {
          if (!this.researchPresentationService) {
            throw new Error("Presentation generation is unavailable because full research report access is not configured.");
          }
          return this.researchPresentationService.generateWeeklyPresentation(args as {
            days?: number | undefined;
            topic?: string | undefined;
          });
        },
      },
    );
    const enabledSkills = new Set(session.skillIds);
    return tools
      .filter((tool) => enabledSkills.has(tool.skillId))
      .filter((tool) => tool.toolsetIds.some((toolsetId) => allowedToolsets.has(toolsetId)))
      .map((tool) => ({
        ...tool,
        execute: (args, context) => tool.execute(args, context),
      }));
  }

  private async runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RESPONSE_RETRIES; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryableResponsesError(error) || attempt === MAX_RESPONSE_RETRIES) {
          throw error;
        }
        await sleep(500 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(describeError(lastError));
  }

  private async startToolTurnWithRouteFallback(
    input: AgentChatInput,
    session: AgentSession,
    memoryPrimer: Awaited<ReturnType<MemoryService["search"]>>,
    primaryRoute: AgentResolvedLlmRoute,
    allSkills: RuntimeSkillDefinition[],
    functionTools: FunctionToolSpec[],
  ): Promise<{
    route: AgentResolvedLlmRoute;
    client: OpenAiCompatClient;
    response: CompatToolTurnResult;
  }> {
    const fallbackRoutes = await Promise.all(
      this.getFallbackSelections(session).map((selection) => this.llmRegistry.resolvePurpose("agent", selection)),
    );
    const routes = [primaryRoute, ...fallbackRoutes];
    let lastError: unknown;

    for (const route of routes) {
      const client = route.source === "injected" ? this.injectedClient : this.buildCompatClient(route);
      if (!client) {
        continue;
      }

      try {
        const allowedToolsets = new Set(resolveAllowedToolsetsForSource(resolveInputSource(input)));
        const mcpTools =
          session.skillIds.includes("mcp-ops") && allowedToolsets.has("mcp") && route.wireApi === "responses"
            ? await this.mcpRegistry.buildOpenAiTools()
            : [];
        const response = await this.runWithRetry(() =>
          client.startToolTurn({
            instructions: this.buildInstructions(input, session, route, allSkills),
            input: this.buildUserInput(input, session, memoryPrimer),
            tools: functionTools,
            mcpTools,
            ...(session.reasoningEffort ? { reasoningEffort: session.reasoningEffort } : {}),
          }),
        );

        return {
          route,
          client,
          response,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(describeError(lastError));
  }

  private async replyWithTools(
    input: AgentChatInput,
    session: AgentSession,
    memoryPrimer: Awaited<ReturnType<MemoryService["search"]>>,
    _client: OpenAiCompatClient,
    llmRoute: AgentResolvedLlmRoute,
  ): Promise<string> {
    const allSkills = await this.listAllSkills();
    const tools = this.buildTools(input, session);
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    const functionTools: FunctionToolSpec[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    const initial = await this.startToolTurnWithRouteFallback(
      input,
      session,
      memoryPrimer,
      llmRoute,
      allSkills,
      functionTools,
    );
    const activeClient = initial.client;
    const activeRoute = initial.route;
    let response = initial.response;
    const allowedToolsets = new Set(resolveAllowedToolsetsForSource(resolveInputSource(input)));
    const activeMcpTools =
      session.skillIds.includes("mcp-ops") && allowedToolsets.has("mcp") && activeRoute.wireApi === "responses"
        ? await this.mcpRegistry.buildOpenAiTools()
        : [];

    const toolTurns: AgentTurn[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const functionCalls = response.functionCalls;

      if (functionCalls.length === 0) {
        const text = response.text?.trim();
        if (text) {
          if (toolTurns.length > 0) {
            await this.appendTurns(input.senderId, toolTurns);
          }
          return toolTurns.length > 0 ? formatStructuredToolReply(input, text, toolTurns) : text;
        }
        throw new Error("Agent runtime response was empty.");
      }

      const outputs: ToolCallOutput[] = await Promise.all(
        functionCalls.map(async (call: { id: string; name: string; arguments: string }) => {
          const tool = toolMap.get(call.name);
          if (!tool) {
            const missing = JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` });
            toolTurns.push({
              role: "tool",
              name: call.name,
              content: missing,
              createdAt: nowIso(),
            });
            return {
              toolCallId: call.id,
              toolName: call.name,
              output: missing,
            };
          }

          try {
            const rawArgs = call.arguments?.trim() ? JSON.parse(call.arguments) : {};
            const parsedArgs = tool.inputSchema.parse(rawArgs);
            const result = await tool.execute(parsedArgs, { input, session });
            const enrichedResult = await this.enrichResearchToolResult(call.name, result, input);
            const output = JSON.stringify({ ok: true, result: enrichedResult });
            toolTurns.push({
              role: "tool",
              name: call.name,
              content: output,
              createdAt: nowIso(),
            });
            return {
              toolCallId: call.id,
              toolName: call.name,
              output,
            };
          } catch (error) {
            const output = JSON.stringify({ ok: false, error: describeError(error) });
            toolTurns.push({
              role: "tool",
              name: call.name,
              content: output,
              createdAt: nowIso(),
            });
            return {
              toolCallId: call.id,
              toolName: call.name,
              output,
            };
          }
        }),
      );

      response = await this.runWithRetry(() =>
        activeClient.continueToolTurn({
          state: response.state as CompatConversationState,
          tools: functionTools,
          mcpTools: activeMcpTools,
          outputs,
          ...(session.reasoningEffort ? { reasoningEffort: session.reasoningEffort } : {}),
        }),
      );
    }

    throw new Error(`Agent runtime exceeded ${MAX_TOOL_ROUNDS} tool rounds without producing a final answer.`);
  }

  private buildFallbackReply(
    input: AgentChatInput,
    memoryHits: Awaited<ReturnType<MemoryService["search"]>>,
  ): string {
    const normalized = input.text.trim();
    const capabilityPattern =
      /(help|commands?|what can you do|how do you work|features?|usage|support|abilities|role|skills?|model|provider)/iu;
    const greetingPattern = /^(hi|hello|hey)\b/iu;

    if (capabilityPattern.test(normalized)) {
      return [
        "I support direct chat and agent-style workspace control with roles, skills, and local tools.",
        "Available slash commands remain: /research <topic>, /memory <query>, /remember <fact>, /role <id>, /skills, /model.",
      ].join("\n");
    }

    if (greetingPattern.test(normalized)) {
      return [
        "Yes. Talk to me normally here, or use slash commands when you want explicit workspace control.",
        "Agent runtime roles and model routes are available via /role, /skills, and /model.",
      ].join("\n");
    }

    const memoryLine =
      memoryHits.length > 0
        ? `I also found relevant memory context: ${memoryHits
            .slice(0, 2)
            .map((hit) => `${hit.title} (${hit.path})`)
            .join("; ")}.`
        : "";

    return [
      `Received. I will handle this in the agent runtime. You asked about: ${clipText(normalized)}`,
      memoryLine,
      "Use /role, /skills, or /model to inspect the active runtime configuration.",
    ]
      .filter(Boolean)
      .join("\n");
  }
}
