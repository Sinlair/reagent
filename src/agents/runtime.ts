import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { env } from "../config/env.js";
import { AgentRuntimeAuditService } from "./runtimeAuditService.js";
import type { AgentRuntimeAuditEntry } from "./runtimeAuditService.js";
import { ToolExecutionPipeline } from "./toolExecutionPipeline.js";
import type {
  AgentRuntimeHook,
  AgentRuntimeHookContext,
  AgentRuntimeLlmCallInfo,
  AgentRuntimeLlmCallResult,
  AgentRuntimeReplyEmitInfo,
  AgentRuntimeToolCallInfo,
  AgentRuntimeToolPolicyDecision,
} from "./runtimeHooks.js";
import { ToolRegistry, type AgentToolDefinition } from "./toolRegistry.js";
import {
  OpenAiCompatClient,
  type CompatToolTurnResult,
  type FunctionToolSpec,
  type OpenAiCompatClientShape,
  type OpenAiReasoningEffort,
  type OpenAiWireApi,
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
import { ResearchMemoryRegistryService } from "../services/researchMemoryRegistryService.js";
import { MemoryCompactionService } from "../services/memoryCompactionService.js";
import { MemoryRecallService } from "../services/memoryRecallService.js";
import type { ResearchService } from "../services/researchService.js";
import { McpRegistryService } from "../services/mcpRegistryService.js";
import type { MemoryService } from "../services/memoryService.js";
import type { MemoryRecallHit } from "../types/memory.js";

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
  sessionId: string;
  senderId: string;
  entrySource: AgentEntrySource;
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

export interface AgentRuntimeOverview {
  sessionCount: number;
  sessionCountsByEntrySource: Record<AgentEntrySource, number>;
  defaultRoute: {
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: OpenAiWireApi | undefined;
  };
  availableReasoningEfforts: Array<"default" | OpenAiReasoningEffort>;
  audit: {
    path: string;
    exists: boolean;
    status: "ready" | "not-found";
  };
}

export interface AgentSessionHistoryItem {
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
  name?: string | undefined;
}

export interface AgentSessionHistory {
  sessionId: string;
  senderId: string;
  entrySource: AgentEntrySource;
  items: AgentSessionHistoryItem[];
}

export interface AgentSessionHooks {
  sessionId: string;
  senderId: string;
  entrySource: AgentEntrySource;
  items: AgentRuntimeAuditEntry[];
}

export interface AgentSessionListEntry {
  sessionId: string;
  channel: string;
  senderId: string;
  entrySource: AgentEntrySource;
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

interface AgentSessionDigest {
  updatedAt: string;
  recentUserIntents: string[];
  recentToolOutcomes: string[];
  pendingActions: string[];
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
  digest: AgentSessionDigest;
  turns: AgentTurn[];
}

interface ResolvedAgentSession {
  sessionId: string;
  session: AgentSession;
}

interface AgentSessionStore {
  updatedAt: string;
  sessions: Record<string, AgentSession>;
}

interface AgentToolContext {
  input: AgentChatInput;
  session: AgentSession;
}

interface AgentRuntimeOptions {
  client?: OpenAiCompatClientShape;
  model?: string;
  researchService?: Pick<ResearchService, "runResearch" | "listRecentReports" | "getReport">;
  wireApi?: OpenAiWireApi;
  hooks?: AgentRuntimeHook[] | undefined;
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
  referencePaths?: string[] | undefined;
}

interface AgentReplyResult {
  text: string;
  usedTools: string[];
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

const GRAPH_NODE_TYPE_VALUES = [
  "direction",
  "discovery_run",
  "source_item",
  "paper",
  "workflow_report",
  "paper_report",
  "repo",
  "repo_report",
  "module_asset",
  "presentation",
] as const;

const MAX_TURNS_PER_SESSION = 16;
const PROMPT_TURN_HISTORY_LIMIT = 8;
const MEMORY_PRIMER_LIMIT = 2;
const MAX_TOOL_ROUNDS = 6;
const MAX_FALLBACK_ECHO_CHARS = 120;
const MAX_RESPONSE_RETRIES = 3;
const MAX_DISCLOSED_WORKSPACE_SKILLS = 2;
const MAX_DISCLOSED_SKILL_REFERENCES_PER_SKILL = 2;
const MAX_DISCLOSED_SKILL_REFERENCE_CHARS = 1000;
const MAX_DIGEST_USER_INTENTS = 6;
const MAX_DIGEST_TOOL_OUTCOMES = 6;
const MAX_DIGEST_PENDING_ACTIONS = 4;
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
    digest: defaultSessionDigest(),
    turns: [],
  };
}

function defaultSessionDigest(): AgentSessionDigest {
  return {
    updatedAt: nowIso(),
    recentUserIntents: [],
    recentToolOutcomes: [],
    pendingActions: [],
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

function trimDigestItems(items: string[], limit: number): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(-limit);
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
    try {
      const payload = JSON.parse(turn.content) as {
        ok?: boolean | undefined;
        result?: { autoChain?: Array<{ toolName?: string | undefined }> | undefined } | undefined;
      };
      if (payload.ok !== false && turn.name?.trim()) {
        names.push(toolLabel(turn.name.trim()));
      }
      const autoChain = Array.isArray(payload.result?.autoChain) ? payload.result.autoChain : [];
      for (const step of autoChain) {
        if (step?.toolName?.trim()) {
          names.push(toolLabel(step.toolName.trim()));
        }
      }
    } catch {
      if (turn.name?.trim()) {
        names.push(toolLabel(turn.name.trim()));
      }
    }
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

function isAgentEntrySource(value: string): value is AgentEntrySource {
  return value === "direct" || value === "ui" || value === "wechat" || value === "openclaw";
}

function buildCanonicalSessionId(source: AgentEntrySource, senderId: string): string {
  return `${source}:${senderId.trim()}`;
}

function parseSessionId(sessionId: string): {
  sessionId: string;
  entrySource: AgentEntrySource;
  senderId: string;
} | null {
  const normalized = sessionId.trim();
  if (!normalized) {
    return null;
  }

  const separatorIndex = normalized.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const source = normalized.slice(0, separatorIndex).trim();
  const senderId = normalized.slice(separatorIndex + 1).trim();
  if (!isAgentEntrySource(source) || !senderId) {
    return null;
  }

  return {
    sessionId: buildCanonicalSessionId(source, senderId),
    entrySource: source,
    senderId,
  };
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

function buildMemoryPrimer(hits: MemoryRecallHit[]): string {
  if (hits.length === 0) {
    return "No relevant memory snippets were preloaded for this turn.";
  }

  return hits
    .map(
      (hit, index) =>
        `${index + 1}. [${hit.layer}] ${hit.title}${hit.path ? ` | ${hit.path}` : hit.artifactType ? ` | ${hit.artifactType}` : ""}\n${hit.snippet}\nprovenance=${hit.provenance} confidence=${hit.confidence}`,
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

function extractPendingActionsFromAssistantReply(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const headings = [
    "What you should do next",
    "浣犳帴涓嬫潵鍙互鍋氫粈涔?",
  ];

  for (const heading of headings) {
    const index = normalized.indexOf(heading);
    if (index === -1) {
      continue;
    }

    const body = normalized
      .slice(index + heading.length)
      .trim()
      .split(/\n+/u)
      .map((line) => line.replace(/^[-*\d.\s]+/u, "").trim())
      .filter(Boolean);

    if (body.length > 0) {
      return body.slice(0, MAX_DIGEST_PENDING_ACTIONS).map((line) => clipText(line, 180));
    }
  }

  const lines = normalized
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.find((line) => /^if you want\b/iu.test(line) || /^濡傛灉浣犳効鎰?/u.test(line));
  return candidate ? [clipText(candidate, 180)] : [];
}

function summarizeToolTurn(turn: AgentTurn): string | null {
  if (turn.role !== "tool") {
    return null;
  }

  try {
    const payload = JSON.parse(turn.content) as {
      ok?: boolean | undefined;
      result?: unknown;
      error?: string | undefined;
    };
    const label = toolLabel(turn.name?.trim() || "tool");
    if (payload.ok === false) {
      return `${label}: failed (${clipText(payload.error ?? "unknown error", 120)})`;
    }

    if (payload.result != null) {
      if (typeof payload.result === "string") {
        return `${label}: ${clipText(payload.result, 120)}`;
      }

      if (typeof payload.result === "object") {
        const record = payload.result as Record<string, unknown>;
        const summary =
          (typeof record.summary === "string" && record.summary.trim()) ||
          (typeof record.title === "string" && record.title.trim()) ||
          (typeof record.topic === "string" && record.topic.trim()) ||
          (typeof record.label === "string" && record.label.trim()) ||
          (typeof record.path === "string" && record.path.trim()) ||
          "";
        return summary ? `${label}: ${clipText(summary, 120)}` : `${label}: completed`;
      }
    }

    return `${label}: completed`;
  } catch {
    return turn.name?.trim() ? `${toolLabel(turn.name.trim())}: completed` : null;
  }
}

function buildDigestFromTurns(turns: AgentTurn[]): AgentSessionDigest {
  const recentUserIntents = trimDigestItems(
    turns
      .filter((turn) => turn.role === "user")
      .map((turn) => `User asked: ${clipText(turn.content, 160)}`),
    MAX_DIGEST_USER_INTENTS,
  );
  const recentToolOutcomes = trimDigestItems(
    turns.map((turn) => summarizeToolTurn(turn)).filter((item): item is string => Boolean(item)),
    MAX_DIGEST_TOOL_OUTCOMES,
  );
  const assistantTurns = turns.filter((turn) => turn.role === "assistant");
  const latestPendingActions = assistantTurns.length > 0
    ? extractPendingActionsFromAssistantReply(assistantTurns[assistantTurns.length - 1]!.content)
    : [];

  return {
    updatedAt: nowIso(),
    recentUserIntents,
    recentToolOutcomes,
    pendingActions: trimDigestItems(latestPendingActions, MAX_DIGEST_PENDING_ACTIONS),
  };
}

function mergeSessionDigest(current: AgentSessionDigest, turns: AgentTurn[]): AgentSessionDigest {
  const nextUserIntents = trimDigestItems(
    [
      ...current.recentUserIntents,
      ...turns
        .filter((turn) => turn.role === "user")
        .map((turn) => `User asked: ${clipText(turn.content, 160)}`),
    ],
    MAX_DIGEST_USER_INTENTS,
  );
  const nextToolOutcomes = trimDigestItems(
    [
      ...current.recentToolOutcomes,
      ...turns.map((turn) => summarizeToolTurn(turn)).filter((item): item is string => Boolean(item)),
    ],
    MAX_DIGEST_TOOL_OUTCOMES,
  );
  const latestAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
  const nextPendingActions = latestAssistant
    ? trimDigestItems(
        extractPendingActionsFromAssistantReply(latestAssistant.content),
        MAX_DIGEST_PENDING_ACTIONS,
      )
    : current.pendingActions;

  return {
    updatedAt: nowIso(),
    recentUserIntents: nextUserIntents,
    recentToolOutcomes: nextToolOutcomes,
    pendingActions: nextPendingActions,
  };
}

function buildSessionDigestBlock(digest: AgentSessionDigest): string {
  const sections = [
    digest.recentUserIntents.length > 0
      ? ["Recent user intents:", ...digest.recentUserIntents.map((item) => `- ${item}`)]
      : [],
    digest.recentToolOutcomes.length > 0
      ? ["Recent tool outcomes:", ...digest.recentToolOutcomes.map((item) => `- ${item}`)]
      : [],
    digest.pendingActions.length > 0
      ? ["Pending actions:", ...digest.pendingActions.map((item) => `- ${item}`)]
      : [],
  ].flat();

  return sections.length > 0 ? sections.join("\n") : "No structured session digest yet.";
}

function tokenizeForSkillMatch(value: string): string[] {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "asks",
    "ask",
    "for",
    "from",
    "into",
    "that",
    "the",
    "their",
    "them",
    "then",
    "this",
    "use",
    "user",
    "when",
    "with",
    "your",
  ]);

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopwords.has(token));
}

function scoreWorkspaceSkillForTurn(inputText: string, skill: RuntimeSkillDefinition): number {
  const inputTokens = new Set(tokenizeForSkillMatch(inputText));
  if (inputTokens.size === 0) {
    return skill.always ? 10 : 0;
  }

  const skillTokens = new Set([
    ...tokenizeForSkillMatch(skill.label),
    ...tokenizeForSkillMatch(skill.id.replace(/^workspace:/u, "")),
    ...tokenizeForSkillMatch(skill.instruction),
    ...(skill.relatedTools ?? []).flatMap((tool) => tokenizeForSkillMatch(tool)),
  ]);

  let score = skill.always ? 10 : 0;
  for (const token of inputTokens) {
    if (skillTokens.has(token)) {
      score += token.length >= 6 ? 4 : 2;
    }
  }

  return score;
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
  private readonly auditService: AgentRuntimeAuditService;
  private readonly hooks: AgentRuntimeHook[];
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
  private readonly researchMemoryRegistryService: ResearchMemoryRegistryService;
  private readonly memoryCompactionService: MemoryCompactionService;
  private readonly memoryRecallService: MemoryRecallService;
  private readonly toolRegistry: ToolRegistry<AgentToolContext>;
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
    this.auditService = new AgentRuntimeAuditService(workspaceDir);
    this.hooks = [this.auditService.createHook(), ...(options.hooks ?? [])];
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
    this.researchMemoryRegistryService = new ResearchMemoryRegistryService(workspaceDir, options.researchService);
    this.memoryCompactionService = new MemoryCompactionService(workspaceDir);
    this.memoryRecallService = new MemoryRecallService(workspaceDir, options.researchService);
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
    this.toolRegistry = this.createToolRegistry();
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
      referencePaths: [...skill.referencePaths],
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

  private buildHookContext(input: AgentChatInput, session: AgentSession): AgentRuntimeHookContext {
    return {
      input: {
        senderId: input.senderId,
        ...(input.senderName ? { senderName: input.senderName } : {}),
        text: input.text,
        ...(input.source ? { source: input.source } : {}),
      },
      session: {
        roleId: session.roleId,
        skillIds: [...session.skillIds],
        ...(session.lastEntrySource ? { lastEntrySource: session.lastEntrySource } : {}),
        ...(session.providerId ? { providerId: session.providerId } : {}),
        ...(session.modelId ? { modelId: session.modelId } : {}),
        reasoningEffort: session.reasoningEffort ?? "default",
      },
    };
  }

  private buildLlmCallInfo(
    stage: AgentRuntimeLlmCallInfo["stage"],
    route: AgentResolvedLlmRoute,
    functionTools: FunctionToolSpec[] = [],
    mcpTools: Array<{ server_label?: string | undefined; connector_id?: string | undefined }> = [],
  ): AgentRuntimeLlmCallInfo {
    return {
      stage,
      providerId: route.providerId,
      providerLabel: route.providerLabel,
      modelId: route.modelId,
      modelLabel: route.modelLabel,
      ...(route.wireApi ? { wireApi: route.wireApi } : {}),
      toolNames: functionTools.map((tool) => tool.name),
      mcpToolNames: mcpTools
        .map((tool) => tool.server_label?.trim() || tool.connector_id?.trim() || "")
        .filter(Boolean),
    };
  }

  private summarizeToolTurnResult(result: CompatToolTurnResult): AgentRuntimeLlmCallResult {
    return {
      success: true,
      ...(result.text.trim() ? { responseText: clipText(result.text.trim(), 240) } : {}),
      functionCallNames: result.functionCalls.map((call) => call.name),
    };
  }

  private summarizeTextResult(text: string): AgentRuntimeLlmCallResult {
    return {
      success: true,
      ...(text.trim() ? { responseText: clipText(text.trim(), 240) } : {}),
      functionCallNames: [],
    };
  }

  private async emitPreLlmCall(
    input: AgentChatInput,
    session: AgentSession,
    call: AgentRuntimeLlmCallInfo,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.preLlmCall?.({ context, call });
    }
  }

  private async emitPostLlmCall(
    input: AgentChatInput,
    session: AgentSession,
    call: AgentRuntimeLlmCallInfo,
    result: AgentRuntimeLlmCallResult,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.postLlmCall?.({ context, call, result });
    }
  }

  private async emitPreToolCall(
    input: AgentChatInput,
    session: AgentSession,
    tool: AgentRuntimeToolCallInfo,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.preToolCall?.({ context, tool });
    }
  }

  private async emitPostToolCall(
    input: AgentChatInput,
    session: AgentSession,
    tool: AgentRuntimeToolCallInfo,
    output: unknown,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.postToolCall?.({ context, tool, output });
    }
  }

  private async emitToolError(
    input: AgentChatInput,
    session: AgentSession,
    tool: AgentRuntimeToolCallInfo,
    error: string,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.toolError?.({ context, tool, error });
    }
  }

  private async emitToolBlocked(
    input: AgentChatInput,
    session: AgentSession,
    tool: AgentRuntimeToolCallInfo,
    reason: string,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.toolBlocked?.({ context, tool, reason });
    }
  }

  private async evaluateToolPolicy(
    input: AgentChatInput,
    session: AgentSession,
    tool: AgentRuntimeToolCallInfo,
  ): Promise<AgentRuntimeToolPolicyDecision> {
    const context = this.buildHookContext(input, session);

    for (const hook of this.hooks) {
      const decision = await hook.checkToolCall?.({ context, tool });
      if (decision && decision.allow === false) {
        return {
          allow: false,
          reason: decision.reason?.trim() || `Tool call blocked by runtime policy: ${tool.toolName}`,
        };
      }
    }

    return {
      allow: true,
    };
  }

  private async emitPreReplyEmit(
    input: AgentChatInput,
    session: AgentSession,
    reply: AgentRuntimeReplyEmitInfo,
  ): Promise<void> {
    const context = this.buildHookContext(input, session);
    for (const hook of this.hooks) {
      await hook.preReplyEmit?.({ context, reply });
    }
  }

  private async runLlmOperation<T>(
    input: AgentChatInput,
    session: AgentSession,
    call: AgentRuntimeLlmCallInfo,
    operation: () => Promise<T>,
    summarize: (result: T) => AgentRuntimeLlmCallResult,
  ): Promise<T> {
    await this.emitPreLlmCall(input, session, call);

    try {
      const result = await this.runWithRetry(operation);
      await this.emitPostLlmCall(input, session, call, summarize(result));
      return result;
    } catch (error) {
      await this.emitPostLlmCall(input, session, call, {
        success: false,
        functionCallNames: [],
        error: describeError(error),
      });
      throw error;
    }
  }

  private async buildSessionSummary(senderId: string, session: AgentSession): Promise<AgentSessionSummary> {
    const parsedSession = parseSessionId(senderId);
    const canonicalSenderId = parsedSession?.senderId ?? senderId;
    const entrySource = parsedSession?.entrySource ?? session.lastEntrySource ?? "direct";
    const canonicalSessionId = parsedSession?.sessionId ?? buildCanonicalSessionId(entrySource, canonicalSenderId);
    const activeEntrySource = session.lastEntrySource ?? entrySource;
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
      sessionId: canonicalSessionId,
      senderId: canonicalSenderId,
      entrySource,
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
    const { sessionId, session } = await this.getSession(senderId);
    return this.buildSessionSummary(sessionId, session);
  }

  async findSession(reference: string, source?: AgentEntrySource): Promise<AgentSessionSummary | null> {
    const store = await this.readStore();
    const sessionId = this.findExistingSessionId(store, reference, source);
    if (!sessionId) {
      return null;
    }

    return this.buildSessionSummary(sessionId, store.sessions[sessionId]!);
  }

  async findSessionHistory(
    reference: string,
    limit = 50,
    source?: AgentEntrySource,
  ): Promise<AgentSessionHistory | null> {
    const store = await this.readStore();
    const sessionId = this.findExistingSessionId(store, reference, source);
    if (!sessionId) {
      return null;
    }

    const parsedSession = parseSessionId(sessionId);
    const items = store.sessions[sessionId]!.turns.slice(-Math.max(1, limit)).map((turn) => ({
      role: turn.role,
      content: turn.content,
      createdAt: turn.createdAt,
      ...(turn.name ? { name: turn.name } : {}),
    }));

    return {
      sessionId,
      senderId: parsedSession?.senderId ?? reference,
      entrySource: parsedSession?.entrySource ?? store.sessions[sessionId]!.lastEntrySource ?? "direct",
      items,
    };
  }

  async findSessionHooks(
    reference: string,
    limit = 50,
    event?: AgentRuntimeAuditEntry["event"],
    source?: AgentEntrySource,
  ): Promise<AgentSessionHooks | null> {
    const store = await this.readStore();
    const sessionId = this.findExistingSessionId(store, reference, source);
    if (!sessionId) {
      return null;
    }

    const parsedSession = parseSessionId(sessionId);
    const senderId = parsedSession?.senderId ?? reference;
    const entrySource = parsedSession?.entrySource ?? store.sessions[sessionId]!.lastEntrySource ?? "direct";
    const items = (await this.auditService.listRecent(200))
      .filter((item) => item.senderId === senderId && item.source === entrySource)
      .filter((item) => (event ? item.event === event : true))
      .slice(0, Math.max(1, limit));

    return {
      sessionId,
      senderId,
      entrySource,
      items,
    };
  }

  async describeRuntime(): Promise<AgentRuntimeOverview> {
    const store = await this.readStore();
    const sessionCountsByEntrySource: Record<AgentEntrySource, number> = {
      direct: 0,
      ui: 0,
      wechat: 0,
      openclaw: 0,
    };

    for (const sessionId of Object.keys(store.sessions)) {
      const source = parseSessionId(sessionId)?.entrySource ?? store.sessions[sessionId]?.lastEntrySource ?? "direct";
      sessionCountsByEntrySource[source] += 1;
    }

    const defaultRoute = await this.llmRegistry.resolvePurpose("agent");
    const auditPath = this.auditService.getAuditPath();
    const auditExists = await readFile(auditPath, "utf8")
      .then(() => true)
      .catch(() => false);

    return {
      sessionCount: Object.keys(store.sessions).length,
      sessionCountsByEntrySource,
      defaultRoute: {
        providerId: defaultRoute.providerId,
        providerLabel: defaultRoute.providerLabel,
        modelId: defaultRoute.modelId,
        modelLabel: defaultRoute.modelLabel,
        llmStatus: defaultRoute.status,
        llmSource: defaultRoute.source,
        ...(defaultRoute.wireApi ? { wireApi: defaultRoute.wireApi } : {}),
      },
      availableReasoningEfforts: [...REASONING_EFFORT_OPTIONS],
      audit: {
        path: auditPath,
        exists: auditExists,
        status: auditExists ? "ready" : "not-found",
      },
    };
  }

  async listSessions(): Promise<AgentSessionListEntry[]> {
    const store = await this.readStore();

    const entries = await Promise.all(
      Object.entries(store.sessions).map(async ([sessionId, session]) => {
        const summary = await this.buildSessionSummary(sessionId, session);
        const lastUserTurn = [...session.turns].reverse().find((turn) => turn.role === "user");
        const lastAssistantTurn = [...session.turns].reverse().find((turn) => turn.role === "assistant");

        return {
          sessionId: summary.sessionId,
          channel: summary.entrySource,
          senderId: summary.senderId,
          entrySource: summary.entrySource,
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
      const key = this.resolveSessionId(store, senderId);
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
      const key = this.resolveSessionId(store, senderId);
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
      const key = this.resolveSessionId(store, senderId);
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
      const key = this.resolveSessionId(store, senderId);
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
      const key = this.resolveSessionId(store, senderId);
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
      const key = this.resolveSessionId(store, senderId);
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

    const inputSource = resolveInputSource(input);
    await this.setLastEntrySource(input.senderId, inputSource, input.source ? inputSource : undefined);
    const { sessionId, session } = await this.getSession(input.senderId, input.source ? inputSource : undefined);
    const memoryPrimer = await this.memoryRecallService
      .recall(text, {
        limit: MEMORY_PRIMER_LIMIT,
        includeWorkspace: true,
        includeArtifacts: true,
      })
      .then((result) => result.hits)
      .catch(() => []);
    const llmRoute = await this.resolveLlmRouteForSession(session);
    const llmClient = this.injectedClient ?? this.buildCompatClient(llmRoute);

    const result: AgentReplyResult = llmClient
      ? await this.replyWithTools(input, session, memoryPrimer, llmClient, llmRoute).catch((error) => {
          this.logRuntimeFailure("tool-turn", input, llmRoute, error);
          return {
            text: this.buildFallbackReply(input, memoryPrimer),
            usedTools: [],
          };
        })
      : {
          text: this.buildFallbackReply(input, memoryPrimer),
          usedTools: [],
        };

    await this.emitPreReplyEmit(input, session, {
      reply: result.text,
      usedTools: result.usedTools,
    });

    await this.appendTurns(input.senderId, [
      {
        role: "user",
        content: text,
        createdAt: nowIso(),
      },
      {
        role: "assistant",
        content: result.text,
        createdAt: nowIso(),
      },
    ], input.source ? inputSource : parseSessionId(sessionId)?.entrySource);

    return result.text;
  }

  async replyPlain(input: AgentChatInput): Promise<string> {
    const text = input.text.trim();
    if (!text) {
      return "Please enter a message.";
    }

    const inputSource = resolveInputSource(input);
    await this.setLastEntrySource(input.senderId, inputSource, input.source ? inputSource : undefined);
    const { sessionId, session } = await this.getSession(input.senderId, input.source ? inputSource : undefined);
    const memoryPrimer = await this.memoryRecallService
      .recall(text, {
        limit: MEMORY_PRIMER_LIMIT,
        includeWorkspace: true,
        includeArtifacts: true,
      })
      .then((result) => result.hits)
      .catch(() => []);
    const llmRoute = await this.resolveLlmRouteForSession(session);
    const llmClient = this.injectedClient ?? this.buildCompatClient(llmRoute);

    const result: AgentReplyResult = llmClient
      ? await this.replyPlainText(input, session, memoryPrimer, llmClient, llmRoute).catch((error) => {
          this.logRuntimeFailure("plain-text", input, llmRoute, error);
          return {
            text: this.buildFallbackReply(input, memoryPrimer),
            usedTools: [],
          };
        })
      : {
          text: this.buildFallbackReply(input, memoryPrimer),
          usedTools: [],
        };

    await this.emitPreReplyEmit(input, session, {
      reply: result.text,
      usedTools: result.usedTools,
    });

    await this.appendTurns(input.senderId, [
      {
        role: "user",
        content: text,
        createdAt: nowIso(),
      },
      {
        role: "assistant",
        content: result.text,
        createdAt: nowIso(),
      },
    ], input.source ? inputSource : parseSessionId(sessionId)?.entrySource);

    return result.text;
  }

  private resolveSessionId(
    store: AgentSessionStore,
    reference: string,
    source?: AgentEntrySource,
  ): string {
    const existingSessionId = this.findExistingSessionId(store, reference, source);
    if (existingSessionId) {
      return existingSessionId;
    }

    const normalizedReference = reference.trim();
    if (source) {
      return buildCanonicalSessionId(source, normalizedReference);
    }

    return buildCanonicalSessionId("wechat", normalizedReference);
  }

  private findExistingSessionId(
    store: AgentSessionStore,
    reference: string,
    source?: AgentEntrySource,
  ): string | null {
    const normalizedReference = reference.trim();
    const parsedReference = parseSessionId(normalizedReference);
    if (parsedReference) {
      return store.sessions[parsedReference.sessionId] ? parsedReference.sessionId : null;
    }

    if (source) {
      const sourcedSessionId = buildCanonicalSessionId(source, normalizedReference);
      return store.sessions[sourcedSessionId] ? sourcedSessionId : null;
    }

    const matchingKeys = Object.entries(store.sessions)
      .filter(([sessionId]) => parseSessionId(sessionId)?.senderId === normalizedReference)
      .sort((left, right) => right[1].updatedAt.localeCompare(left[1].updatedAt))
      .map(([sessionId]) => sessionId);

    if (matchingKeys.length > 0) {
      return matchingKeys[0]!;
    }

    return null;
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
                const parsedSession = parseSessionId(sessionId);
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
                  isAgentEntrySource(partial.lastEntrySource)
                    ? (partial.lastEntrySource as AgentEntrySource)
                    : parsedSession?.entrySource ?? "direct";
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
                const rawDigest =
                  partial.digest && typeof partial.digest === "object"
                    ? (partial.digest as Partial<AgentSessionDigest>)
                    : null;
                const digest = rawDigest
                  ? {
                      updatedAt: typeof rawDigest.updatedAt === "string" ? rawDigest.updatedAt : nowIso(),
                      recentUserIntents: trimDigestItems(
                        Array.isArray(rawDigest.recentUserIntents)
                          ? rawDigest.recentUserIntents.filter((item): item is string => typeof item === "string")
                          : [],
                        MAX_DIGEST_USER_INTENTS,
                      ),
                      recentToolOutcomes: trimDigestItems(
                        Array.isArray(rawDigest.recentToolOutcomes)
                          ? rawDigest.recentToolOutcomes.filter((item): item is string => typeof item === "string")
                          : [],
                        MAX_DIGEST_TOOL_OUTCOMES,
                      ),
                      pendingActions: trimDigestItems(
                        Array.isArray(rawDigest.pendingActions)
                          ? rawDigest.pendingActions.filter((item): item is string => typeof item === "string")
                          : [],
                        MAX_DIGEST_PENDING_ACTIONS,
                      ),
                    }
                  : buildDigestFromTurns(turns);

                return [
                  parsedSession?.sessionId ?? sessionId,
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
                    digest,
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

  private async getSession(senderId: string, source?: AgentEntrySource): Promise<ResolvedAgentSession> {
    const store = await this.readStore();
    const key = this.resolveSessionId(store, senderId, source);
    const existing = store.sessions[key];
    if (existing) {
      return {
        sessionId: key,
        session: existing,
      };
    }

    const session = defaultSession();
    store.sessions[key] = session;
    await this.writeStore(store);
    return {
      sessionId: key,
      session,
    };
  }

  private async appendTurns(senderId: string, turns: AgentTurn[], source?: AgentEntrySource): Promise<void> {
    await this.mutateStore((store) => {
      const key = this.resolveSessionId(store, senderId, source);
      const current = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...current,
        updatedAt: nowIso(),
        digest: mergeSessionDigest(current.digest, turns),
        turns: trimTurns([...current.turns, ...turns]),
      };
      return store;
    });
  }

  private async setLastEntrySource(
    senderId: string,
    source: AgentEntrySource,
    sessionSource?: AgentEntrySource,
  ): Promise<void> {
    await this.mutateStore((store) => {
      const key = this.resolveSessionId(store, senderId, sessionSource);
      const current = store.sessions[key] ?? defaultSession();
      store.sessions[key] = {
        ...current,
        lastEntrySource: source,
        updatedAt: nowIso(),
      };
      return store;
    });
  }

  private getEnabledSkillsForSession(
    session: AgentSession,
    allSkills: RuntimeSkillDefinition[],
  ): RuntimeSkillDefinition[] {
    const skillMap = new Map(allSkills.map((skill) => [skill.id, skill]));
    const enabledSkillIds = new Set([
      ...session.skillIds,
      ...allSkills.filter((skill) => skill.always).map((skill) => skill.id),
    ]);

    return [...enabledSkillIds]
      .map((skillId) => skillMap.get(skillId))
      .filter((skill): skill is RuntimeSkillDefinition => Boolean(skill));
  }

  private async buildWorkspaceSkillDisclosure(
    input: AgentChatInput,
    enabledSkills: RuntimeSkillDefinition[],
  ): Promise<{
    catalogLines: string[];
    disclosedPromptBlocks: string[];
    referenceBlocks: string[];
  }> {
    const workspaceSkills = enabledSkills.filter(
      (skill) =>
        skill.source === "workspace-skill" &&
        typeof skill.prompt === "string" &&
        skill.prompt.trim().length > 0,
    );

    const catalogLines = workspaceSkills.map((skill) => {
      const relatedTools = (skill.relatedTools ?? []).slice(0, 4).join(", ");
      return `- ${skill.label} (${skill.id}): ${skill.instruction}${relatedTools ? ` | tools: ${relatedTools}` : ""}`;
    });

    const scored = workspaceSkills
      .map((skill) => ({
        skill,
        score: scoreWorkspaceSkillForTurn(input.text, skill),
      }))
      .sort((left, right) => right.score - left.score || left.skill.label.localeCompare(right.skill.label));

    const matched = scored.filter((entry) => entry.score > 0).slice(0, MAX_DISCLOSED_WORKSPACE_SKILLS);
    const selected =
      matched.length > 0
        ? matched.map((entry) => entry.skill)
        : workspaceSkills.length === 1
          ? [workspaceSkills[0]!]
          : [];
    const referenceBlocks = await this.loadWorkspaceSkillReferenceBlocks(selected);

    return {
      catalogLines,
      disclosedPromptBlocks: selected.flatMap((skill) => [
        `### ${skill.label} (${skill.id})`,
        skill.prompt ?? "",
      ]),
      referenceBlocks,
    };
  }

  private async loadWorkspaceSkillReferenceBlocks(skills: RuntimeSkillDefinition[]): Promise<string[]> {
    const blocks: string[] = [];

    for (const skill of skills) {
      const paths = (skill.referencePaths ?? []).slice(0, MAX_DISCLOSED_SKILL_REFERENCES_PER_SKILL);
      for (const referencePath of paths) {
        try {
          const content = await readFile(referencePath, "utf8");
          blocks.push(
            `### ${skill.label} reference: ${path.basename(referencePath)}`,
            clipText(content, MAX_DISCLOSED_SKILL_REFERENCE_CHARS),
          );
        } catch {}
      }
    }

    return blocks;
  }

  private async buildInstructions(
    input: AgentChatInput,
    session: AgentSession,
    llmRoute: AgentResolvedLlmRoute,
    allSkills: RuntimeSkillDefinition[],
  ): Promise<string> {
    const source = resolveInputSource(input);
    const allowedToolsets = resolveAllowedToolsetsForSource(source);
    const role = this.getRoleOrDefault(session.roleId);
    const skills = this.getEnabledSkillsForSession(session, allSkills);
    const workspaceSkillDisclosure = await this.buildWorkspaceSkillDisclosure(input, skills);

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
      "- If the user asks how papers, repos, or artifacts relate, use graph_query, graph_report, graph_explain, or graph_path.",
      "- Keep the final answer concise and actionable.",
      "- When tools or research actions were involved, structure the final answer as: What I understood / What I did / What you should do next.",
      "- Reply in the same language as the user.",
      ...(workspaceSkillDisclosure.catalogLines.length > 0
        ? [
            "",
            "Enabled workspace skills:",
            ...workspaceSkillDisclosure.catalogLines,
          ]
        : []),
      ...(workspaceSkillDisclosure.disclosedPromptBlocks.length > 0
        ? [
            "",
            "Disclosed workspace skill instructions for this turn:",
            ...workspaceSkillDisclosure.disclosedPromptBlocks,
          ]
        : []),
      ...(workspaceSkillDisclosure.referenceBlocks.length > 0
        ? [
            "",
            "Referenced workspace skill files for this turn:",
            ...workspaceSkillDisclosure.referenceBlocks,
          ]
        : []),
    ].join("\n");
  }

  private async buildPlainChatInstructions(
    input: AgentChatInput,
    session: AgentSession,
    llmRoute: AgentResolvedLlmRoute,
    allSkills: RuntimeSkillDefinition[],
  ): Promise<string> {
    const source = resolveInputSource(input);
    const role = this.getRoleOrDefault(session.roleId);
    const skills = this.getEnabledSkillsForSession(session, allSkills);
    const workspaceSkillDisclosure = await this.buildWorkspaceSkillDisclosure(input, skills);

    return [
      "You are ReAgent, speaking directly with the user inside a workspace runtime.",
      "This turn is plain chat only.",
      "Do not call, mention, or simulate tools unless the user explicitly asks for slash commands or workspace control.",
      `Active role: ${role.label} (${role.id})`,
      `Active entry: ${labelForEntrySource(source)} (${source})`,
      `Model route: ${llmRoute.providerLabel}/${llmRoute.modelLabel}${llmRoute.wireApi ? ` via ${llmRoute.wireApi}` : ""}`,
      role.instruction,
      "",
      "Enabled skills:",
      ...skills.map((skill) => `- ${skill.label} (${skill.id})`),
      "",
      "Plain chat rules:",
      "- Reply naturally and directly.",
      "- Keep the answer concise unless the user asks for depth.",
      "- Reply in the same language as the user.",
      "- If the user asks for runtime controls, tell them the relevant slash commands briefly.",
      "- If the user asks for deep research, memory operations, or saved workspace state, you may suggest slash commands or a more structured follow-up.",
      ...(workspaceSkillDisclosure.catalogLines.length > 0
        ? [
            "",
            "Enabled workspace skills:",
            ...workspaceSkillDisclosure.catalogLines,
          ]
        : []),
      ...(workspaceSkillDisclosure.disclosedPromptBlocks.length > 0
        ? [
            "",
            "Disclosed workspace skill instructions for this turn:",
            ...workspaceSkillDisclosure.disclosedPromptBlocks,
          ]
        : []),
      ...(workspaceSkillDisclosure.referenceBlocks.length > 0
        ? [
            "",
            "Referenced workspace skill files for this turn:",
            ...workspaceSkillDisclosure.referenceBlocks,
          ]
        : []),
    ].join("\n");
  }

  private buildUserInput(
    input: AgentChatInput,
    session: AgentSession,
    memoryPrimer: MemoryRecallHit[],
  ): string {
    return [
      "Current workspace primer:",
      buildMemoryPrimer(memoryPrimer),
      "",
      "Structured session digest:",
      buildSessionDigestBlock(session.digest),
      "",
      "Recent session history:",
      buildTurnHistory(session.turns.slice(-PROMPT_TURN_HISTORY_LIMIT)),
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

  private createToolRegistry(): ToolRegistry<AgentToolContext> {
    const registry = new ToolRegistry<AgentToolContext>();
    const tools: AgentToolDefinition<unknown, AgentToolContext>[] = [
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
        execute: async (_args, context) => this.describeSession(context.input.senderId),
      },
      {
        name: "memory_search",
        description: "Run v3 memory recall across saved workspace memory and durable artifacts.",
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
            recall: await this.memoryRecallService.recall(parsed.query, {
              limit: parsed.limit ?? 4,
              includeWorkspace: true,
              includeArtifacts: true,
            }),
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
      {
        name: "memory_compact",
        description: "Compact older memory notes into one long-term summary entry.",
        skillId: "memory-ops",
        toolsetIds: ["memory"],
        inputSchema: z.object({
          olderThanDays: z.number().int().min(1).max(365).optional(),
          minEntries: z.number().int().min(2).max(50).optional(),
          maxEntries: z.number().int().min(2).max(50).optional(),
          dryRun: z.boolean().optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            olderThanDays: { type: "integer", minimum: 1, maximum: 365 },
            minEntries: { type: "integer", minimum: 2, maximum: 50 },
            maxEntries: { type: "integer", minimum: 2, maximum: 50 },
            dryRun: { type: "boolean" },
          },
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as {
            olderThanDays?: number | undefined;
            minEntries?: number | undefined;
            maxEntries?: number | undefined;
            dryRun?: boolean | undefined;
          };
          return this.memoryCompactionService.compact({
            source: "manual",
            ...(typeof parsed.olderThanDays === "number" ? { olderThanDays: parsed.olderThanDays } : {}),
            ...(typeof parsed.minEntries === "number" ? { minEntries: parsed.minEntries } : {}),
            ...(typeof parsed.maxEntries === "number" ? { maxEntries: parsed.maxEntries } : {}),
            ...(typeof parsed.dryRun === "boolean" ? { dryRun: parsed.dryRun } : {}),
          });
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
        execute: async (args, context) => {
          const parsed = args as {
            topic: string;
            question?: string | undefined;
            maxPapers?: number | undefined;
          };
          const report = await this.options.researchService!.runResearch({
            topic: parsed.topic,
            question:
                parsed.question ??
                `Agent runtime request from ${context.input.senderName?.trim() || context.input.senderId}: ${parsed.topic}`,
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
        name: "graph_query",
        description: "Query the research memory graph and return the strongest nodes and links for the current filters.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          view: z.enum(["asset", "paper"]).optional(),
          types: z.array(z.enum(GRAPH_NODE_TYPE_VALUES)).optional(),
          search: z.string().trim().min(1).optional(),
          topic: z.string().trim().min(1).optional(),
          dateFrom: z.string().trim().min(1).optional(),
          dateTo: z.string().trim().min(1).optional(),
          limit: z.number().int().min(1).max(12).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            view: { type: "string", enum: ["asset", "paper"] },
            types: { type: "array", items: { type: "string", enum: [...GRAPH_NODE_TYPE_VALUES] } },
            search: { type: "string", minLength: 1 },
            topic: { type: "string", minLength: 1 },
            dateFrom: { type: "string", minLength: 1 },
            dateTo: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 12 },
          },
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as {
            view?: "asset" | "paper" | undefined;
            types?: Array<(typeof GRAPH_NODE_TYPE_VALUES)[number]> | undefined;
            search?: string | undefined;
            topic?: string | undefined;
            dateFrom?: string | undefined;
            dateTo?: string | undefined;
            limit?: number | undefined;
          };
          return this.researchMemoryRegistryService.queryGraph(
            {
              ...(parsed.view ? { view: parsed.view } : {}),
              ...(parsed.types?.length ? { types: parsed.types } : {}),
              ...(parsed.search ? { search: parsed.search } : {}),
              ...(parsed.topic ? { topic: parsed.topic } : {}),
              ...(parsed.dateFrom ? { dateFrom: parsed.dateFrom } : {}),
              ...(parsed.dateTo ? { dateTo: parsed.dateTo } : {}),
            },
            parsed.limit ?? 6,
          );
        },
      },
      {
        name: "graph_report",
        description: "Summarize the current research memory graph with hubs, clusters, and strongest links.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          view: z.enum(["asset", "paper"]).optional(),
          types: z.array(z.enum(GRAPH_NODE_TYPE_VALUES)).optional(),
          search: z.string().trim().min(1).optional(),
          topic: z.string().trim().min(1).optional(),
          dateFrom: z.string().trim().min(1).optional(),
          dateTo: z.string().trim().min(1).optional(),
          limit: z.number().int().min(1).max(12).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            view: { type: "string", enum: ["asset", "paper"] },
            types: { type: "array", items: { type: "string", enum: [...GRAPH_NODE_TYPE_VALUES] } },
            search: { type: "string", minLength: 1 },
            topic: { type: "string", minLength: 1 },
            dateFrom: { type: "string", minLength: 1 },
            dateTo: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 12 },
          },
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as {
            view?: "asset" | "paper" | undefined;
            types?: Array<(typeof GRAPH_NODE_TYPE_VALUES)[number]> | undefined;
            search?: string | undefined;
            topic?: string | undefined;
            dateFrom?: string | undefined;
            dateTo?: string | undefined;
            limit?: number | undefined;
          };
          return this.researchMemoryRegistryService.buildGraphReport(
            {
              ...(parsed.view ? { view: parsed.view } : {}),
              ...(parsed.types?.length ? { types: parsed.types } : {}),
              ...(parsed.search ? { search: parsed.search } : {}),
              ...(parsed.topic ? { topic: parsed.topic } : {}),
              ...(parsed.dateFrom ? { dateFrom: parsed.dateFrom } : {}),
              ...(parsed.dateTo ? { dateTo: parsed.dateTo } : {}),
            },
            parsed.limit ?? 6,
          );
        },
      },
      {
        name: "graph_path",
        description: "Find the shortest visible path between two research graph nodes.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          fromNodeId: z.string().trim().min(1),
          toNodeId: z.string().trim().min(1),
          view: z.enum(["asset", "paper"]).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            fromNodeId: { type: "string", minLength: 1 },
            toNodeId: { type: "string", minLength: 1 },
            view: { type: "string", enum: ["asset", "paper"] },
          },
          required: ["fromNodeId", "toNodeId"],
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as {
            fromNodeId: string;
            toNodeId: string;
            view?: "asset" | "paper" | undefined;
          };
          return this.researchMemoryRegistryService.findPath(
            parsed.fromNodeId,
            parsed.toNodeId,
            parsed.view ? { view: parsed.view } : {},
          );
        },
      },
      {
        name: "graph_explain",
        description: "Explain why two research graph nodes are directly or indirectly related.",
        skillId: "research-ops",
        toolsetIds: ["research-core"],
        inputSchema: z.object({
          fromNodeId: z.string().trim().min(1),
          toNodeId: z.string().trim().min(1),
          view: z.enum(["asset", "paper"]).optional(),
        }),
        parameters: {
          type: "object",
          properties: {
            fromNodeId: { type: "string", minLength: 1 },
            toNodeId: { type: "string", minLength: 1 },
            view: { type: "string", enum: ["asset", "paper"] },
          },
          required: ["fromNodeId", "toNodeId"],
          additionalProperties: false,
        },
        execute: async (args) => {
          const parsed = args as {
            fromNodeId: string;
            toNodeId: string;
            view?: "asset" | "paper" | undefined;
          };
          return this.researchMemoryRegistryService.explainConnection(
            parsed.fromNodeId,
            parsed.toNodeId,
            parsed.view ? { view: parsed.view } : {},
          );
        },
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
    registry.registerMany(tools);
    return registry;
  }

  private buildTools(
    input: AgentChatInput,
    session: AgentSession,
  ): AgentToolDefinition<unknown, AgentToolContext>[] {
    return this.toolRegistry.resolve({
      enabledSkillIds: session.skillIds,
      allowedToolsetIds: resolveAllowedToolsetsForSource(resolveInputSource(input)),
    });
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
    memoryPrimer: MemoryRecallHit[],
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
        const instructions = await this.buildInstructions(input, session, route, allSkills);
        const response = await this.runLlmOperation(
          input,
          session,
          this.buildLlmCallInfo("tool-start", route, functionTools, mcpTools),
          () =>
            client.startToolTurn({
              instructions,
              input: this.buildUserInput(input, session, memoryPrimer),
              tools: functionTools,
              mcpTools,
              ...(session.reasoningEffort ? { reasoningEffort: session.reasoningEffort } : {}),
            }),
          (result) => this.summarizeToolTurnResult(result),
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

  private async replyPlainText(
    input: AgentChatInput,
    session: AgentSession,
    memoryPrimer: MemoryRecallHit[],
    llmClient: OpenAiCompatClient,
    llmRoute: AgentResolvedLlmRoute,
  ): Promise<AgentReplyResult> {
    const allSkills = await this.listAllSkills();
    const systemPrompt = await this.buildPlainChatInstructions(input, session, llmRoute, allSkills);
    const text = await this.runLlmOperation(
      input,
      session,
      this.buildLlmCallInfo("plain-text", llmRoute),
      () =>
        llmClient.createText({
          systemPrompt,
          userPayload: this.buildUserInput(input, session, memoryPrimer),
          ...(session.reasoningEffort ? { reasoningEffort: session.reasoningEffort } : {}),
        }),
      (result) => this.summarizeTextResult(result),
    );

    const normalized = text.trim();
    if (!normalized) {
      throw new Error("Agent runtime plain-text response was empty.");
    }

    return {
      text: normalized,
      usedTools: [],
    };
  }

  private async replyWithTools(
    input: AgentChatInput,
    session: AgentSession,
    memoryPrimer: MemoryRecallHit[],
    _client: OpenAiCompatClient,
    llmRoute: AgentResolvedLlmRoute,
  ): Promise<AgentReplyResult> {
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
    const allowedToolsets = new Set(resolveAllowedToolsetsForSource(resolveInputSource(input)));
    const activeMcpTools =
      session.skillIds.includes("mcp-ops") && allowedToolsets.has("mcp") && activeRoute.wireApi === "responses"
        ? await this.mcpRegistry.buildOpenAiTools()
        : [];
    const pipeline = new ToolExecutionPipeline<AgentToolContext>({
      toolMap,
      toolContext: { input, session },
      initialResponse: initial.response,
      maxRounds: MAX_TOOL_ROUNDS,
      nowIso,
      continueTurn: ({ state, outputs }) =>
        this.runLlmOperation(
          input,
          session,
          this.buildLlmCallInfo("tool-continue", activeRoute, functionTools, activeMcpTools),
          () =>
            activeClient.continueToolTurn({
              state,
              tools: functionTools,
              mcpTools: activeMcpTools,
              outputs,
              ...(session.reasoningEffort ? { reasoningEffort: session.reasoningEffort } : {}),
            }),
          (result) => this.summarizeToolTurnResult(result),
        ),
      transformToolResult: (toolName, result) => this.enrichResearchToolResult(toolName, result, input),
      checkToolCall: (tool) => this.evaluateToolPolicy(input, session, tool),
      onPreToolCall: (tool) => this.emitPreToolCall(input, session, tool),
      onPostToolCall: (tool, output) => this.emitPostToolCall(input, session, tool, output),
      onToolError: (tool, error) => this.emitToolError(input, session, tool, error),
      onToolBlocked: (tool, reason) => this.emitToolBlocked(input, session, tool, reason),
    });
    const execution = await pipeline.run();
    const toolTurns = execution.toolTurns as AgentTurn[];
    const usedTools = collectExecutedToolNames(toolTurns);

    if (toolTurns.length > 0) {
      await this.appendTurns(input.senderId, toolTurns);
    }

    return {
      text: toolTurns.length > 0 ? formatStructuredToolReply(input, execution.finalText, toolTurns) : execution.finalText,
      usedTools,
    };
  }

  private buildFallbackReply(
    input: AgentChatInput,
    memoryHits: MemoryRecallHit[],
  ): string {
    const normalized = input.text.trim();
    const preferChinese = /[\u3400-\u9fff]/u.test(normalized);
    const capabilityPattern =
      /(help|commands?|what can you do|how do you work|features?|usage|support|abilities|role|skills?|model|provider|你的作用是什么|你能做什么|功能|能力)/iu;
    const greetingPattern = /^(hi|hello|hey)\b|^(你好|您好|嗨|哈喽)/iu;

    if (capabilityPattern.test(normalized)) {
      return preferChinese
        ? [
            "我是你的工作区助手，可以直接聊天，也可以帮你处理研究方向、论文、记忆和工作区操作。",
            "常用命令有：/research <topic>、/memory <query>、/remember <fact>、/role <id>、/skills、/model。",
          ].join("\n")
        : [
            "I support direct chat and can help with research directions, papers, memory, and workspace control.",
            "Common slash commands: /research <topic>, /memory <query>, /remember <fact>, /role <id>, /skills, /model.",
          ].join("\n");
    }

    if (greetingPattern.test(normalized)) {
      return preferChinese
        ? [
            "你好，我在。",
            "你可以直接告诉我你想做什么，比如设研究方向、看近期论文、总结论文，或者就一个问题继续聊。",
          ].join("\n")
        : [
            "Hi, I am here.",
            "You can talk to me normally here, ask for recent papers, set a research direction, or ask for a paper summary.",
          ].join("\n");
    }

    const memoryLine =
      memoryHits.length > 0
        ? preferChinese
          ? `我还找到了相关上下文：${memoryHits
              .slice(0, 2)
              .map((hit) => `${hit.title}（${hit.path ?? hit.artifactType ?? hit.layer}）`)
              .join("；")}。`
          : `I also found relevant memory context: ${memoryHits
              .slice(0, 2)
              .map((hit) => `${hit.title} (${hit.path ?? hit.artifactType ?? hit.layer})`)
              .join("; ")}.`
        : "";

    return preferChinese
      ? [
          `我先记下你的需求：${clipText(normalized)}`,
          memoryLine,
          "如果你想让我直接动手，尽量说具体一点，比如“把半监督图像学习设为研究方向”或“推送今天的论文”。",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `I noted your request: ${clipText(normalized)}`,
          memoryLine,
          "If you want me to take action directly, be a bit more specific, for example \"set semi-supervised image learning as my research direction\" or \"push today's papers\".",
        ]
          .filter(Boolean)
          .join("\n");
  }

  private logRuntimeFailure(
    stage: "tool-turn" | "plain-text",
    input: AgentChatInput,
    llmRoute: AgentResolvedLlmRoute,
    error: unknown,
  ): void {
    const payload = {
      stage,
      senderId: input.senderId,
      source: resolveInputSource(input),
      providerId: llmRoute.providerId,
      modelId: llmRoute.modelId,
      wireApi: llmRoute.wireApi ?? null,
      message: describeError(error),
    };
    console.error(`[ReAgent AgentRuntime] ${JSON.stringify(payload)}`);
  }
}
