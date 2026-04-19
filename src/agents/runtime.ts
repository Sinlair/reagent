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
  seededFromSessionId?: string | undefined;
  seededAt?: string | undefined;
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

export interface AgentSessionCognition {
  sessionId: string;
  senderId: string;
  entrySource: AgentEntrySource;
  seededFromSessionId?: string | undefined;
  seededAt?: string | undefined;
  updatedAt: string;
  digestUpdatedAt: string;
  sessionUpdatedAt: string;
  recentUserIntents: string[];
  recentToolOutcomes: string[];
  pendingActions: string[];
  neurons: AgentSessionNeuronState;
}

export interface AgentSessionListEntry {
  sessionId: string;
  channel: string;
  senderId: string;
  entrySource: AgentEntrySource;
  activeEntrySource: AgentEntrySource;
  seededFromSessionId?: string | undefined;
  seededAt?: string | undefined;
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

export type AgentNeuronKind = "perception" | "memory" | "hypothesis" | "reasoning" | "action" | "reflection";
export type AgentHypothesisStatus = "provisional" | "supported" | "conflicted";
export type AgentNeuronSource =
  | "user-input"
  | "workspace-memory"
  | "artifact-memory"
  | "tool-outcome"
  | "session-history"
  | "session-digest"
  | "assistant-reply"
  | "runtime-inference";

export interface AgentNeuronNode {
  id: string;
  kind: AgentNeuronKind;
  content: string;
  salience: number;
  confidence: number;
  source: AgentNeuronSource;
  updatedAt: string;
  status?: AgentHypothesisStatus | undefined;
  supportingEvidence?: string[] | undefined;
  conflictingEvidence?: string[] | undefined;
}

interface AgentSessionDigest {
  updatedAt: string;
  recentUserIntents: string[];
  recentToolOutcomes: string[];
  pendingActions: string[];
  neurons: AgentSessionNeuronState;
}

export interface AgentSessionNeuronState {
  updatedAt: string;
  perception: AgentNeuronNode[];
  memory: AgentNeuronNode[];
  hypothesis: AgentNeuronNode[];
  reasoning: AgentNeuronNode[];
  action: AgentNeuronNode[];
  reflection: AgentNeuronNode[];
}

interface AgentSession {
  updatedAt: string;
  roleId: string;
  skillIds: string[];
  lastEntrySource?: AgentEntrySource | undefined;
  seededFromSessionId?: string | undefined;
  seededAt?: string | undefined;
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

interface AgentCognitionToolPosture {
  mode: "evidence-gathering" | "delivery-ready" | "balanced";
  reasons: string[];
  preferredTools: string[];
  deferredTools: string[];
  conflictedHypotheses: number;
  provisionalHypotheses: number;
  supportedHypotheses: number;
}

type AgentResolvedLlmRoute = Omit<ResolvedLlmRoute, "source"> & {
  source: "registry" | "env" | "injected";
};

export type AgentEntrySource = "direct" | "ui" | "wechat" | "openclaw";
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
const MAX_NEURON_ITEMS = 4;
const EVIDENCE_GATHERING_TOOLS = new Set([
  "memory_search",
  "research_recent",
  "direction_list",
  "discovery_run",
  "discovery_recent",
  "link_ingest",
  "paper_analyze",
  "repo_analyze",
  "graph_query",
  "graph_report",
  "graph_path",
  "graph_explain",
]);
const SYNTHESIS_OR_DELIVERY_TOOLS = new Set([
  "baseline_suggest",
  "direction_report_generate",
  "presentation_generate",
  "module_extract",
]);
const ENTRY_CONSTRAINED_TOOLS = new Set([
  "direction_report_generate",
  "presentation_generate",
  "module_extract",
]);
const ASSISTANT_LIGHTWEIGHT_BLOCKED_TOOLS = new Set([
  "direction_report_generate",
  "presentation_generate",
]);
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

function cloneSessionDigest(digest: AgentSessionDigest): AgentSessionDigest {
  return {
    updatedAt: digest.updatedAt,
    recentUserIntents: [...digest.recentUserIntents],
    recentToolOutcomes: [...digest.recentToolOutcomes],
    pendingActions: [...digest.pendingActions],
    neurons: cloneNeuronState(digest.neurons),
  };
}

function seedSessionFromExisting(
  seedSessionId: string,
  seed: AgentSession,
  source: AgentEntrySource,
): AgentSession {
  return {
    updatedAt: nowIso(),
    roleId: seed.roleId,
    skillIds: [...seed.skillIds],
    lastEntrySource: source,
    seededFromSessionId: seedSessionId,
    seededAt: nowIso(),
    ...(seed.providerId ? { providerId: seed.providerId } : {}),
    ...(seed.modelId ? { modelId: seed.modelId } : {}),
    ...(seed.fallbackRoutes ? { fallbackRoutes: [...seed.fallbackRoutes] } : {}),
    ...(seed.reasoningEffort ? { reasoningEffort: seed.reasoningEffort } : {}),
    digest: cloneSessionDigest(seed.digest),
    turns: [],
  };
}

function defaultSessionDigest(): AgentSessionDigest {
  return {
    updatedAt: nowIso(),
    recentUserIntents: [],
    recentToolOutcomes: [],
    pendingActions: [],
    neurons: defaultNeuronState(),
  };
}

function defaultNeuronState(): AgentSessionNeuronState {
  return {
    updatedAt: nowIso(),
    perception: [],
    memory: [],
    hypothesis: [],
    reasoning: [],
    action: [],
    reflection: [],
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

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function buildNeuronNode(input: {
  kind: AgentNeuronKind;
  content: string;
  salience: number;
  confidence: number;
  source: AgentNeuronSource;
  updatedAt?: string | undefined;
  id?: string | undefined;
  status?: AgentHypothesisStatus | undefined;
  supportingEvidence?: string[] | undefined;
  conflictingEvidence?: string[] | undefined;
}): AgentNeuronNode {
  const updatedAt = input.updatedAt ?? nowIso();
  const supportingEvidence = trimDigestItems(input.supportingEvidence ?? [], 3);
  const conflictingEvidence = trimDigestItems(input.conflictingEvidence ?? [], 3);
  return {
    id: input.id?.trim() || `${input.kind}:${updatedAt}:${clipPreview(input.content, 32)}`,
    kind: input.kind,
    content: input.content.trim(),
    salience: clampScore(input.salience),
    confidence: clampScore(input.confidence),
    source: input.source,
    updatedAt,
    ...(input.status ? { status: input.status } : {}),
    ...(supportingEvidence.length > 0 ? { supportingEvidence } : {}),
    ...(conflictingEvidence.length > 0 ? { conflictingEvidence } : {}),
  };
}

function trimNeuronNodes(nodes: AgentNeuronNode[], limit = MAX_NEURON_ITEMS): AgentNeuronNode[] {
  const deduped = new Map<string, AgentNeuronNode>();
  for (const node of nodes) {
    const key = `${node.kind}:${node.content}`.trim();
    deduped.set(key, node);
  }

  return [...deduped.values()]
    .sort((left, right) => {
      const salienceDelta = right.salience - left.salience;
      if (salienceDelta !== 0) {
        return salienceDelta;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .slice(0, limit);
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

function isAgentHypothesisStatus(value: string): value is AgentHypothesisStatus {
  return value === "provisional" || value === "supported" || value === "conflicted";
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

function actionSuggestsEvidence(actionNodes: AgentNeuronNode[]): boolean {
  return actionNodes.some((node) =>
    /\b(compare|inspect|verify|search|read|gather|evidence|analyze|investigate|recall|discover)\b/iu.test(node.content),
  );
}

function actionSuggestsDelivery(actionNodes: AgentNeuronNode[]): boolean {
  return actionNodes.some((node) =>
    /\b(report|summary|deck|presentation|reuse|extract|deliver|handoff|save|persist)\b/iu.test(node.content),
  );
}

function deriveCognitionToolPosture(digest: AgentSessionDigest): AgentCognitionToolPosture {
  const hypothesisNodes = digest.neurons.hypothesis;
  const reasoningNodes = digest.neurons.reasoning;
  const actionNodes = digest.neurons.action;
  const conflictedHypotheses = hypothesisNodes.filter(
    (node) => node.status === "conflicted" || (node.conflictingEvidence?.length ?? 0) > 0,
  ).length;
  const provisionalHypotheses = hypothesisNodes.filter((node) => node.status === "provisional").length;
  const supportedHypotheses = hypothesisNodes.filter(
    (node) => node.status === "supported" && node.confidence >= 0.72,
  ).length;
  const highConfidenceReasoning = reasoningNodes.filter((node) => node.confidence >= 0.74).length;
  const evidenceAction = actionSuggestsEvidence(actionNodes);
  const deliveryAction = actionSuggestsDelivery(actionNodes);
  const reasons: string[] = [];

  if (conflictedHypotheses > 0) {
    reasons.push(`${conflictedHypotheses} conflicted hypothesis node(s) still need disambiguation.`);
  }
  if (provisionalHypotheses > 0) {
    reasons.push(`${provisionalHypotheses} provisional hypothesis node(s) remain unresolved.`);
  }
  if (supportedHypotheses > 0) {
    reasons.push(`${supportedHypotheses} supported high-confidence hypothesis node(s) are ready for reuse.`);
  }
  if (evidenceAction) {
    reasons.push("The current action layer points toward evidence gathering.");
  }
  if (deliveryAction) {
    reasons.push("The current action layer points toward delivery or reuse.");
  }
  if (highConfidenceReasoning > 0 && reasons.length === 0) {
    reasons.push("Reasoning confidence is high enough to prepare a deliverable.");
  }

  if (conflictedHypotheses > 0 || provisionalHypotheses > 1 || (evidenceAction && supportedHypotheses === 0)) {
    return {
      mode: "evidence-gathering",
      reasons: reasons.length > 0 ? reasons : ["Uncertainty is still high."],
      preferredTools: [...EVIDENCE_GATHERING_TOOLS],
      deferredTools: [...SYNTHESIS_OR_DELIVERY_TOOLS],
      conflictedHypotheses,
      provisionalHypotheses,
      supportedHypotheses,
    };
  }

  if (supportedHypotheses > 0 && conflictedHypotheses === 0 && (deliveryAction || highConfidenceReasoning > 0)) {
    return {
      mode: "delivery-ready",
      reasons: reasons.length > 0 ? reasons : ["Supported conclusions are stable enough to reuse or deliver."],
      preferredTools: ["direction_report_generate", "presentation_generate", "module_extract", "memory_remember"],
      deferredTools: ["discovery_run", "discovery_recent", "link_ingest", "paper_analyze", "repo_analyze"],
      conflictedHypotheses,
      provisionalHypotheses,
      supportedHypotheses,
    };
  }

  return {
    mode: "balanced",
    reasons: reasons.length > 0 ? reasons : ["Cognition is mixed; keep tool selection aligned with the next action."],
    preferredTools: [...EVIDENCE_GATHERING_TOOLS, "baseline_suggest", "direction_report_generate"],
    deferredTools: [],
    conflictedHypotheses,
    provisionalHypotheses,
    supportedHypotheses,
  };
}

function buildCognitionToolGuidance(digest: AgentSessionDigest): string[] {
  const posture = deriveCognitionToolPosture(digest);

  return [
    "Cognition-driven tool guidance:",
    `- Read the hypothesis, reasoning, and action neuron layers before calling tools.`,
    `- Current tool posture: ${posture.mode}.`,
    ...posture.reasons.slice(0, 3).map((reason) => `- Reason: ${reason}`),
    `- Prefer these tools now: ${posture.preferredTools.join(", ")}.`,
    ...(posture.deferredTools.length > 0
      ? [`- Defer these tools unless the user explicitly asks for the deliverable: ${posture.deferredTools.join(", ")}.`]
      : []),
  ];
}

function userExplicitlyRequestsToolAlignedOutput(inputText: string, toolName: string): boolean {
  const patterns: Record<string, RegExp> = {
    baseline_suggest: /\b(baseline|innovation|route|direction|novelty|idea|方案|基线|路线|创新)\b/iu,
    direction_report_generate: /\b(report|overview|summary|weekly|digest|briefing|报告|综述|总结|周报)\b/iu,
    presentation_generate: /\b(deck|slides|presentation|meeting|group meeting|组会|汇报|幻灯片|演示)\b/iu,
    module_extract: /\b(module|extract|reuse|download|archive|模块|提取|复用|下载)\b/iu,
  };
  const pattern = patterns[toolName];
  return pattern ? pattern.test(inputText) : false;
}

function deriveCognitionToolPolicyReason(
  digest: AgentSessionDigest,
  inputText: string,
  toolName: string,
): string | null {
  const posture = deriveCognitionToolPosture(digest);
  if (
    posture.mode === "evidence-gathering" &&
    SYNTHESIS_OR_DELIVERY_TOOLS.has(toolName) &&
    !userExplicitlyRequestsToolAlignedOutput(inputText, toolName)
  ) {
    return `Cognition policy prefers evidence-gathering before ${toolName} because ${posture.reasons[0] ?? "uncertainty is still high"}`;
  }

  return null;
}

function deriveRoleAndEntryToolPolicyReason(
  session: AgentSession,
  source: AgentEntrySource,
  inputText: string,
  toolName: string,
): string | null {
  if (
    (source === "wechat" || source === "openclaw") &&
    ENTRY_CONSTRAINED_TOOLS.has(toolName) &&
    !userExplicitlyRequestsToolAlignedOutput(inputText, toolName)
  ) {
    return `Active entry ${source} should stay in compact evidence mode before ${toolName}.`;
  }

  if (
    session.roleId === "assistant" &&
    ASSISTANT_LIGHTWEIGHT_BLOCKED_TOOLS.has(toolName) &&
    !userExplicitlyRequestsToolAlignedOutput(inputText, toolName)
  ) {
    return `Assistant role stays lightweight until report or deck output is explicitly requested before ${toolName}.`;
  }

  return null;
}

function buildRoleAndEntryToolGuidance(
  session: AgentSession,
  source: AgentEntrySource,
): string[] {
  const lines = ["Role-and-entry policy guidance:"];

  if (source === "wechat" || source === "openclaw") {
    lines.push(
      "- WeChat/OpenClaw entries should prefer compact evidence-gathering tools before long-form synthesis or delivery.",
    );
  } else {
    lines.push("- Direct/UI entries can move into synthesis once cognition is delivery-ready.");
  }

  if (session.roleId === "assistant") {
    lines.push("- Assistant role should stay lightweight and avoid report/deck generation unless the user explicitly asks.");
  } else if (session.roleId === "researcher") {
    lines.push("- Researcher role should bias toward search, reading, and evidence-backed analysis before delivery.");
  } else if (session.roleId === "operator") {
    lines.push("- Operator role may transition into delivery once the cognition state shows stable support.");
  }

  return lines;
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

function inferReasoningNeuronSignals(inputText: string, recentToolOutcomes: string[]): string[] {
  const normalized = inputText.toLowerCase();
  const signals: string[] = [];

  if (/\b(compare|versus|vs|tradeoff|difference)\b/iu.test(normalized) || /(瀵规瘮|姣旇緝|宸紓)/u.test(inputText)) {
    signals.push("Compare alternatives before committing to one conclusion.");
  }
  if (/\b(summarize|summary|briefing|tldr|digest)\b/iu.test(normalized) || /(鎬荤粨|鎽樿|绠€鎶?)/u.test(inputText)) {
    signals.push("Compress the strongest signals into a reviewable synthesis.");
  }
  if (/\b(why|reason|because|evidence|support|confidence)\b/iu.test(normalized) || /(涓轰粈涔?璇佹嵁|鏀寔|淇″績)/u.test(inputText)) {
    signals.push("Ground the answer in evidence and separate support from inference.");
  }
  if (/\b(next|plan|should|what now|action)\b/iu.test(normalized) || /(涓嬩竴姝?璁″垝|鎬庝箞鍋?)/u.test(inputText)) {
    signals.push("End with a concrete next action instead of only analysis.");
  }
  if (recentToolOutcomes.length === 0) {
    signals.push("Use live workspace state before guessing.");
  }

  if (signals.length === 0) {
    signals.push("Synthesize the current session state into one clear working judgment.");
  }

  return trimDigestItems(signals, MAX_NEURON_ITEMS);
}

function inferHypothesisNeuronSignals(inputText: string, pendingActions: string[]): string[] {
  const normalized = inputText.toLowerCase();
  const signals: string[] = [];

  if (/\b(compare|versus|vs|baseline|alternative)\b/iu.test(normalized) || /(瀵规瘮|鍩虹嚎|鏇夸唬)/u.test(inputText)) {
    signals.push("There may be multiple valid alternatives worth keeping in play.");
  }
  if (/\b(uncertain|maybe|possibly|likely|hypothesis)\b/iu.test(normalized) || /(鍙兘|鍋囪|涓嶇‘瀹?)/u.test(inputText)) {
    signals.push("Keep the current conclusion provisional until stronger evidence arrives.");
  }
  if (pendingActions.length > 0) {
    signals.push("The next action should reduce uncertainty instead of merely restating context.");
  }

  if (signals.length === 0) {
    signals.push("Preserve at least one working hypothesis until the next evidence update.");
  }

  return trimDigestItems(signals, MAX_NEURON_ITEMS);
}

function describeMemoryHitEvidence(hit: MemoryRecallHit): string {
  const location = hit.layer === "artifact" ? hit.artifactType ?? hit.provenance : hit.path ?? hit.provenance;
  return clipText(`${hit.title} (${location})`, 96);
}

function buildHypothesisNeuronNodes(input: {
  latestUserTurn: string;
  pendingActions: string[];
  memoryHits: MemoryRecallHit[];
  recentToolOutcomes: string[];
  recentUserIntents: string[];
  updatedAt: string;
}): AgentNeuronNode[] {
  const workspaceHits = input.memoryHits.filter((hit) => hit.layer === "workspace");
  const artifactHits = input.memoryHits.filter((hit) => hit.layer === "artifact");
  const compareRequested =
    /\b(compare|versus|vs|baseline|alternative|tradeoff|difference)\b/iu.test(input.latestUserTurn) ||
    /(鐎佃鐦畖閸╄櫣鍤巪閺囧じ鍞?|瀵规瘮|鍩虹嚎|鏇夸唬|宸紓)/u.test(input.latestUserTurn);
  const workspaceEvidence = workspaceHits.map((hit) => describeMemoryHitEvidence(hit));
  const artifactEvidence = artifactHits.map((hit) => describeMemoryHitEvidence(hit));
  const toolEvidence = input.recentToolOutcomes.map((item) => clipText(`Tool outcome: ${item}`, 96));
  const sessionEvidence = input.recentUserIntents.map((item) =>
    clipText(item.replace(/^User asked:\s*/u, "").trim(), 96),
  );
  const nextActionEvidence = input.pendingActions.map((item) => clipText(`Next action: ${item}`, 96));
  const nodes: AgentNeuronNode[] = [];

  if (workspaceEvidence.length > 0) {
    nodes.push(
      buildNeuronNode({
        id: `hypothesis:${input.updatedAt}:workspace`,
        kind: "hypothesis",
        content: "Workspace memory likely contains relevant operating context for the current turn.",
        salience: 0.8,
        confidence: compareRequested && artifactEvidence.length > 0 ? 0.64 : 0.74,
        source: "runtime-inference",
        updatedAt: input.updatedAt,
        status: compareRequested && artifactEvidence.length > 0 ? "conflicted" : "supported",
        supportingEvidence: workspaceEvidence,
        conflictingEvidence: compareRequested ? artifactEvidence : [],
      }),
    );
  }

  if (artifactEvidence.length > 0) {
    nodes.push(
      buildNeuronNode({
        id: `hypothesis:${input.updatedAt}:artifact`,
        kind: "hypothesis",
        content: "Artifact-backed evidence may refine the current conclusion before it is finalized.",
        salience: 0.78,
        confidence: compareRequested && workspaceEvidence.length > 0 ? 0.62 : 0.72,
        source: "runtime-inference",
        updatedAt: input.updatedAt,
        status: compareRequested && workspaceEvidence.length > 0 ? "conflicted" : "supported",
        supportingEvidence: artifactEvidence,
        conflictingEvidence: compareRequested ? workspaceEvidence : [],
      }),
    );
  }

  const provisionalSignals = inferHypothesisNeuronSignals(input.latestUserTurn, input.pendingActions);
  const provisionalEvidence = trimDigestItems(
    [...nextActionEvidence, ...toolEvidence, ...sessionEvidence],
    3,
  );

  for (const [index, signal] of provisionalSignals.entries()) {
    nodes.push(
      buildNeuronNode({
        id: `hypothesis:${input.updatedAt}:provisional:${index}`,
        kind: "hypothesis",
        content: signal,
        salience: 0.74 - index * 0.06,
        confidence: compareRequested ? 0.5 : 0.56,
        source: "runtime-inference",
        updatedAt: input.updatedAt,
        status: "provisional",
        supportingEvidence: provisionalEvidence,
        conflictingEvidence: compareRequested ? trimDigestItems([...workspaceEvidence, ...artifactEvidence], 2) : [],
      }),
    );
  }

  return trimNeuronNodes(nodes);
}

function buildReflectionNeuronNodes(input: {
  latestAssistantTurn: string;
  recentToolOutcomes: string[];
  nextActions: string[];
  hypothesis: AgentNeuronNode[];
  updatedAt: string;
}): AgentNeuronNode[] {
  const nodes: AgentNeuronNode[] = [];
  const confirmedSignal = input.recentToolOutcomes[0] || clipText(input.latestAssistantTurn, 140);
  if (confirmedSignal) {
    nodes.push(
      buildNeuronNode({
        id: `reflection:${input.updatedAt}:confirmed`,
        kind: "reflection",
        content: `Confirmed this turn: ${confirmedSignal}`,
        salience: 0.72,
        confidence: input.recentToolOutcomes.length > 0 ? 0.8 : input.latestAssistantTurn ? 0.68 : 0.3,
        source: input.recentToolOutcomes.length > 0 ? "tool-outcome" : "assistant-reply",
        updatedAt: input.updatedAt,
        supportingEvidence: confirmedSignal ? [confirmedSignal] : [],
      }),
    );
  }

  const unresolvedHypothesis = input.hypothesis.find(
    (node) => node.status === "conflicted" || node.status === "provisional",
  );
  if (unresolvedHypothesis) {
    nodes.push(
      buildNeuronNode({
        id: `reflection:${input.updatedAt}:uncertain`,
        kind: "reflection",
        content: `Still uncertain: ${unresolvedHypothesis.content}`,
        salience: 0.68,
        confidence: 0.6,
        source: "runtime-inference",
        updatedAt: input.updatedAt,
        supportingEvidence: unresolvedHypothesis.supportingEvidence ?? [],
        conflictingEvidence: unresolvedHypothesis.conflictingEvidence ?? [],
      }),
    );
  }

  if (input.nextActions.length > 0) {
    nodes.push(
      buildNeuronNode({
        id: `reflection:${input.updatedAt}:next`,
        kind: "reflection",
        content: `Recommended next action: ${input.nextActions[0]}`,
        salience: 0.74,
        confidence: 0.78,
        source: "assistant-reply",
        updatedAt: input.updatedAt,
        supportingEvidence: [input.nextActions[0]!],
      }),
    );
  }

  if (nodes.length === 0) {
    nodes.push(
      buildNeuronNode({
        id: `reflection:${input.updatedAt}:empty`,
        kind: "reflection",
        content: "No assistant reflection has been produced yet.",
        salience: 0.3,
        confidence: 0.3,
        source: "assistant-reply",
        updatedAt: input.updatedAt,
      }),
    );
  }

  return trimNeuronNodes(nodes);
}

function neuronKey(node: AgentNeuronNode): string {
  return `${node.kind}:${node.content}`.trim().toLowerCase();
}

function reconcileNeuronLayer(input: {
  previous: AgentNeuronNode[];
  next: AgentNeuronNode[];
  updatedAt: string;
  staleSaliencePenalty: number;
  staleConfidencePenalty: number;
  carryStale: boolean;
}): AgentNeuronNode[] {
  const previousByKey = new Map(input.previous.map((node) => [neuronKey(node), node]));
  const nextKeys = new Set(input.next.map((node) => neuronKey(node)));

  const activated = input.next.map((node) => {
    const previous = previousByKey.get(neuronKey(node));
    if (!previous) {
      return node;
    }

    const isConflictedHypothesis =
      node.kind === "hypothesis" && (node.status === "conflicted" || (node.conflictingEvidence?.length ?? 0) > 0);
    let confidence = clampScore(Math.max(node.confidence, previous.confidence * 0.9 + 0.06));
    if (isConflictedHypothesis && previous.status !== "conflicted") {
      confidence = clampScore(Math.min(confidence, Math.max(node.confidence - 0.08, 0.35)));
    } else if (isConflictedHypothesis) {
      confidence = clampScore(Math.max(node.confidence, previous.confidence - 0.02));
    }

    return {
      ...node,
      salience: clampScore(Math.max(node.salience, previous.salience * 0.84 + 0.12)),
      confidence,
      updatedAt: input.updatedAt,
      ...(node.supportingEvidence || previous.supportingEvidence
        ? {
            supportingEvidence: trimDigestItems(
              [...(previous.supportingEvidence ?? []), ...(node.supportingEvidence ?? [])],
              3,
            ),
          }
        : {}),
      ...(node.conflictingEvidence || previous.conflictingEvidence
        ? {
            conflictingEvidence: trimDigestItems(
              [...(previous.conflictingEvidence ?? []), ...(node.conflictingEvidence ?? [])],
              3,
            ),
          }
        : {}),
      ...(node.status ? { status: node.status } : previous.status ? { status: previous.status } : {}),
    };
  });

  if (!input.carryStale) {
    return trimNeuronNodes(activated);
  }

  const decayed = input.previous
    .filter((node) => !nextKeys.has(neuronKey(node)))
    .map((node) => {
      const salience = clampScore(node.salience - input.staleSaliencePenalty);
      const confidence = clampScore(node.confidence - input.staleConfidencePenalty);
      if (salience < 0.35) {
        return null;
      }

      return {
        ...node,
        salience,
        confidence,
        updatedAt: input.updatedAt,
        ...(node.kind === "hypothesis" && node.status === "supported" ? { status: "provisional" as const } : {}),
      };
    })
    .filter((node): node is AgentNeuronNode => Boolean(node));

  return trimNeuronNodes([...activated, ...decayed]);
}

function buildMemoryNeuronNodes(input: {
  memoryHits: MemoryRecallHit[];
  recentToolOutcomes: string[];
  recentUserIntents: string[];
  updatedAt: string;
}): AgentNeuronNode[] {
  const hitNodes = input.memoryHits.map((hit, index) =>
    buildNeuronNode({
      id: `memory:hit:${input.updatedAt}:${index}`,
      kind: "memory",
      content: clipText(`${hit.title}: ${hit.snippet}`, 160),
      salience: 0.86 - index * 0.08,
      confidence: hit.confidence === "high" ? 0.9 : hit.confidence === "medium" ? 0.75 : 0.55,
      source: hit.layer === "artifact" ? "artifact-memory" : "workspace-memory",
      updatedAt: hit.updatedAt ?? hit.createdAt ?? input.updatedAt,
    }),
  );
  const toolNodes = input.recentToolOutcomes.map((item, index) =>
    buildNeuronNode({
      id: `memory:tool:${input.updatedAt}:${index}`,
      kind: "memory",
      content: item,
      salience: 0.72 - index * 0.08,
      confidence: 0.8,
      source: "tool-outcome",
      updatedAt: input.updatedAt,
    }),
  );
  const sessionNodes = input.recentUserIntents.map((item, index) =>
    buildNeuronNode({
      id: `memory:session:${input.updatedAt}:${index}`,
      kind: "memory",
      content: item.replace(/^User asked:\s*/u, "").trim(),
      salience: 0.62 - index * 0.06,
      confidence: 0.68,
      source: "session-history",
      updatedAt: input.updatedAt,
    }),
  );

  return trimNeuronNodes([...hitNodes, ...toolNodes, ...sessionNodes]);
}

function buildNeuronState(input: {
  recentUserIntents: string[];
  recentToolOutcomes: string[];
  pendingActions: string[];
  turns: AgentTurn[];
  memoryHits?: MemoryRecallHit[] | undefined;
  previousState?: AgentSessionNeuronState | undefined;
}): AgentSessionNeuronState {
  const updatedAt = nowIso();
  const latestUserTurn = [...input.turns].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const latestAssistantTurn = [...input.turns].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
  const previousState = input.previousState ?? defaultNeuronState();
  const nextActions =
    input.pendingActions.length > 0
      ? input.pendingActions
      : ["Leave one concrete next step instead of ending with only descriptive context."];

  const perception = trimNeuronNodes(
    input.turns
      .filter((turn) => turn.role === "user")
      .slice(-MAX_NEURON_ITEMS)
      .map((turn, index) =>
        buildNeuronNode({
          id: `perception:${updatedAt}:${index}`,
          kind: "perception",
          content: clipText(turn.content, 140),
          salience: 0.9 - index * 0.1,
          confidence: 0.85,
          source: "user-input",
          updatedAt: turn.createdAt,
        }),
      ),
  );
  const memory = trimNeuronNodes(
    buildMemoryNeuronNodes({
      memoryHits: input.memoryHits ?? [],
      recentToolOutcomes: input.recentToolOutcomes,
      recentUserIntents: input.recentUserIntents,
      updatedAt,
    }),
  );
  const hypothesis = trimNeuronNodes(
    buildHypothesisNeuronNodes({
      latestUserTurn,
      pendingActions: nextActions,
      memoryHits: input.memoryHits ?? [],
      recentToolOutcomes: input.recentToolOutcomes,
      recentUserIntents: input.recentUserIntents,
      updatedAt,
    }),
  );
  const reasoning = trimNeuronNodes(
    inferReasoningNeuronSignals(latestUserTurn, input.recentToolOutcomes).map((item, index) =>
      buildNeuronNode({
        id: `reasoning:${updatedAt}:${index}`,
        kind: "reasoning",
        content: item,
        salience: 0.84 - index * 0.08,
        confidence: 0.72,
        source: "runtime-inference",
        updatedAt,
      }),
    ),
  );
  const action = trimNeuronNodes(
    nextActions.map((item, index) =>
      buildNeuronNode({
        id: `action:${updatedAt}:${index}`,
        kind: "action",
        content: item,
        salience: 0.88 - index * 0.08,
        confidence: 0.78,
        source: "assistant-reply",
        updatedAt,
      }),
    ),
  );
  const reflection = trimNeuronNodes(
    buildReflectionNeuronNodes({
      latestAssistantTurn,
      recentToolOutcomes: input.recentToolOutcomes,
      nextActions,
      hypothesis,
      updatedAt,
    }),
  );

  return {
    updatedAt,
    perception: reconcileNeuronLayer({
      previous: previousState.perception,
      next: perception,
      updatedAt,
      staleSaliencePenalty: 0.18,
      staleConfidencePenalty: 0.06,
      carryStale: false,
    }),
    memory: reconcileNeuronLayer({
      previous: previousState.memory,
      next: memory,
      updatedAt,
      staleSaliencePenalty: 0.1,
      staleConfidencePenalty: 0.04,
      carryStale: true,
    }),
    hypothesis: reconcileNeuronLayer({
      previous: previousState.hypothesis,
      next: hypothesis,
      updatedAt,
      staleSaliencePenalty: 0.14,
      staleConfidencePenalty: 0.07,
      carryStale: true,
    }),
    reasoning: reconcileNeuronLayer({
      previous: previousState.reasoning,
      next: reasoning,
      updatedAt,
      staleSaliencePenalty: 0.12,
      staleConfidencePenalty: 0.05,
      carryStale: true,
    }),
    action: reconcileNeuronLayer({
      previous: previousState.action,
      next: action,
      updatedAt,
      staleSaliencePenalty: 0.16,
      staleConfidencePenalty: 0.06,
      carryStale: false,
    }),
    reflection: reconcileNeuronLayer({
      previous: previousState.reflection,
      next: reflection,
      updatedAt,
      staleSaliencePenalty: 0.2,
      staleConfidencePenalty: 0.08,
      carryStale: false,
    }),
  };
}

function buildDigestFromTurns(turns: AgentTurn[], memoryHits: MemoryRecallHit[] = []): AgentSessionDigest {
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
    neurons: buildNeuronState({
      recentUserIntents,
      recentToolOutcomes,
      pendingActions: trimDigestItems(latestPendingActions, MAX_DIGEST_PENDING_ACTIONS),
      turns,
      memoryHits,
      previousState: undefined,
    }),
  };
}

function mergeSessionDigest(current: AgentSessionDigest, turns: AgentTurn[], memoryHits: MemoryRecallHit[] = []): AgentSessionDigest {
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
    neurons: buildNeuronState({
      recentUserIntents: nextUserIntents,
      recentToolOutcomes: nextToolOutcomes,
      pendingActions: nextPendingActions,
      turns,
      memoryHits,
      previousState: current.neurons,
    }),
  };
}

function buildSessionDigestBlock(digest: AgentSessionDigest): string {
  const renderNeuronLine = (item: AgentNeuronNode): string => {
    const annotations = [
      `salience=${item.salience}`,
      `confidence=${item.confidence}`,
      `source=${item.source}`,
      ...(item.status ? [`status=${item.status}`] : []),
      ...(item.supportingEvidence && item.supportingEvidence.length > 0
        ? [`support=${item.supportingEvidence.join(" | ")}`]
        : []),
      ...(item.conflictingEvidence && item.conflictingEvidence.length > 0
        ? [`conflict=${item.conflictingEvidence.join(" | ")}`]
        : []),
    ];
    return `- ${item.content} [${annotations.join(" ")}]`;
  };
  const sections = [
    digest.neurons.perception.length > 0
      ? ["Neuron state / perception:", ...digest.neurons.perception.map((item) => renderNeuronLine(item))]
      : [],
    digest.neurons.memory.length > 0
      ? ["Neuron state / memory:", ...digest.neurons.memory.map((item) => renderNeuronLine(item))]
      : [],
    digest.neurons.hypothesis.length > 0
      ? ["Neuron state / hypothesis:", ...digest.neurons.hypothesis.map((item) => renderNeuronLine(item))]
      : [],
    digest.neurons.reasoning.length > 0
      ? ["Neuron state / reasoning:", ...digest.neurons.reasoning.map((item) => renderNeuronLine(item))]
      : [],
    digest.neurons.action.length > 0
      ? ["Neuron state / action:", ...digest.neurons.action.map((item) => renderNeuronLine(item))]
      : [],
    digest.neurons.reflection.length > 0
      ? ["Neuron state / reflection:", ...digest.neurons.reflection.map((item) => renderNeuronLine(item))]
      : [],
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

function parseNeuronNodeArray(
  kind: AgentNeuronKind,
  source: AgentNeuronSource,
  raw: unknown,
): AgentNeuronNode[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return trimNeuronNodes(
    raw
      .map((item, index) => {
        if (typeof item === "string") {
          return buildNeuronNode({
            id: `${kind}:legacy:${index}`,
            kind,
            content: item,
            salience: 0.6,
            confidence: 0.6,
            source,
          });
        }
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Partial<AgentNeuronNode>;
        if (typeof record.content !== "string" || !record.content.trim()) {
          return null;
        }
        return buildNeuronNode({
          id: typeof record.id === "string" ? record.id : undefined,
          kind,
          content: record.content,
          salience: typeof record.salience === "number" ? record.salience : 0.6,
          confidence: typeof record.confidence === "number" ? record.confidence : 0.6,
          source: typeof record.source === "string" ? (record.source as AgentNeuronSource) : source,
          updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
          status:
            typeof record.status === "string" && isAgentHypothesisStatus(record.status)
              ? record.status
              : undefined,
          supportingEvidence: Array.isArray(record.supportingEvidence)
            ? record.supportingEvidence.filter((entry): entry is string => typeof entry === "string")
            : [],
          conflictingEvidence: Array.isArray(record.conflictingEvidence)
            ? record.conflictingEvidence.filter((entry): entry is string => typeof entry === "string")
            : [],
        });
      })
      .filter((item): item is AgentNeuronNode => Boolean(item)),
    MAX_NEURON_ITEMS,
  );
}

function cloneNeuronNode(node: AgentNeuronNode): AgentNeuronNode {
  return {
    ...node,
    ...(node.supportingEvidence ? { supportingEvidence: [...node.supportingEvidence] } : {}),
    ...(node.conflictingEvidence ? { conflictingEvidence: [...node.conflictingEvidence] } : {}),
  };
}

function cloneNeuronState(state: AgentSessionNeuronState): AgentSessionNeuronState {
  return {
    updatedAt: state.updatedAt,
    perception: state.perception.map((node) => cloneNeuronNode(node)),
    memory: state.memory.map((node) => cloneNeuronNode(node)),
    hypothesis: state.hypothesis.map((node) => cloneNeuronNode(node)),
    reasoning: state.reasoning.map((node) => cloneNeuronNode(node)),
    action: state.action.map((node) => cloneNeuronNode(node)),
    reflection: state.reflection.map((node) => cloneNeuronNode(node)),
  };
}

function replaceDigestItemsByPrefix(items: string[], prefix: string, nextItem?: string | undefined): string[] {
  return [
    ...items.filter((item) => !item.startsWith(prefix)),
    ...(nextItem?.trim() ? [nextItem.trim()] : []),
  ];
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
    const source = resolveInputSource(input);
    const cognitionPolicyReason = deriveCognitionToolPolicyReason(session.digest, input.text, tool.toolName);
    if (cognitionPolicyReason) {
      return {
        allow: false,
        reason: cognitionPolicyReason,
      };
    }
    const roleAndEntryPolicyReason = deriveRoleAndEntryToolPolicyReason(
      session,
      source,
      input.text,
      tool.toolName,
    );
    if (roleAndEntryPolicyReason) {
      return {
        allow: false,
        reason: roleAndEntryPolicyReason,
      };
    }

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
      ...(session.seededFromSessionId ? { seededFromSessionId: session.seededFromSessionId } : {}),
      ...(session.seededAt ? { seededAt: session.seededAt } : {}),
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

  private buildSessionCognition(sessionIdOrSenderId: string, session: AgentSession): AgentSessionCognition {
    const parsedSession = parseSessionId(sessionIdOrSenderId);
    const senderId = parsedSession?.senderId ?? sessionIdOrSenderId;
    const entrySource = parsedSession?.entrySource ?? session.lastEntrySource ?? "direct";
    const sessionId = parsedSession?.sessionId ?? buildCanonicalSessionId(entrySource, senderId);

    return {
      sessionId,
      senderId,
      entrySource,
      ...(session.seededFromSessionId ? { seededFromSessionId: session.seededFromSessionId } : {}),
      ...(session.seededAt ? { seededAt: session.seededAt } : {}),
      updatedAt: session.digest.neurons.updatedAt || session.digest.updatedAt,
      digestUpdatedAt: session.digest.updatedAt,
      sessionUpdatedAt: session.updatedAt,
      recentUserIntents: [...session.digest.recentUserIntents],
      recentToolOutcomes: [...session.digest.recentToolOutcomes],
      pendingActions: [...session.digest.pendingActions],
      neurons: cloneNeuronState(session.digest.neurons),
    };
  }

  async describeSession(senderId: string): Promise<AgentSessionSummary> {
    const { sessionId, session } = await this.getSession(senderId);
    return this.buildSessionSummary(sessionId, session);
  }

  async describeSessionCognition(senderId: string): Promise<AgentSessionCognition> {
    const { sessionId, session } = await this.getSession(senderId);
    return this.buildSessionCognition(sessionId, session);
  }

  async findSession(reference: string, source?: AgentEntrySource): Promise<AgentSessionSummary | null> {
    const store = await this.readStore();
    const sessionId = this.findExistingSessionId(store, reference, source);
    if (!sessionId) {
      return null;
    }

    return this.buildSessionSummary(sessionId, store.sessions[sessionId]!);
  }

  async findSessionCognition(reference: string, source?: AgentEntrySource): Promise<AgentSessionCognition | null> {
    const store = await this.readStore();
    const sessionId = this.findExistingSessionId(store, reference, source);
    if (!sessionId) {
      return null;
    }

    return this.buildSessionCognition(sessionId, store.sessions[sessionId]!);
  }

  async syncDelegationCognition(reference: string, input: {
    delegationId: string;
    taskId: string;
    kind: "search" | "reading" | "synthesis";
    status: "queued" | "running" | "completed" | "failed" | "cancelled";
    artifactPath?: string | undefined;
    error?: string | null | undefined;
  }): Promise<AgentSessionCognition | null> {
    let nextCognition: AgentSessionCognition | null = null;

    await this.mutateStore((store) => {
      const sessionId = this.findExistingSessionId(store, reference);
      if (!sessionId) {
        return store;
      }

      const current = store.sessions[sessionId]!;
      const prefix = `Delegation ${input.delegationId}:`;
      const toolOutcome = input.status === "completed"
        ? `${prefix} ${input.kind} completed for task ${input.taskId}${input.artifactPath ? ` (${input.artifactPath})` : ""}`
        : input.status === "failed"
          ? `${prefix} ${input.kind} failed for task ${input.taskId}${input.error ? ` (${clipText(input.error, 120)})` : ""}`
          : input.status === "cancelled"
            ? `${prefix} ${input.kind} cancelled for task ${input.taskId}`
            : `${prefix} ${input.kind} ${input.status} for task ${input.taskId}`;
      const pendingAction = input.status === "completed"
        ? `Review the completed ${input.kind} delegation for task ${input.taskId}${input.artifactPath ? ` at ${input.artifactPath}` : ""}.`
        : input.status === "failed"
          ? `Review blockers and decide whether to retry the failed ${input.kind} delegation for task ${input.taskId}.`
          : input.status === "cancelled"
            ? `Decide whether to restart the cancelled ${input.kind} delegation for task ${input.taskId} or switch strategy.`
            : `Wait for the ${input.kind} delegation on task ${input.taskId} and continue once new evidence arrives.`;
      const nextToolOutcomes = trimDigestItems(
        replaceDigestItemsByPrefix(current.digest.recentToolOutcomes, prefix, toolOutcome),
        MAX_DIGEST_TOOL_OUTCOMES,
      );
      const nextPendingActions = trimDigestItems(
        replaceDigestItemsByPrefix(current.digest.pendingActions, "Review the completed", undefined)
          .filter((item) => !item.includes(`delegation for task ${input.taskId}`))
          .concat(pendingAction ? [pendingAction] : []),
        MAX_DIGEST_PENDING_ACTIONS,
      );
      const nextDigest: AgentSessionDigest = {
        ...current.digest,
        updatedAt: nowIso(),
        recentToolOutcomes: nextToolOutcomes,
        pendingActions: nextPendingActions,
        neurons: buildNeuronState({
          recentUserIntents: current.digest.recentUserIntents,
          recentToolOutcomes: nextToolOutcomes,
          pendingActions: nextPendingActions,
          turns: current.turns,
          memoryHits: [],
          previousState: current.digest.neurons,
        }),
      };

      const nextSession: AgentSession = {
        ...current,
        updatedAt: nowIso(),
        digest: nextDigest,
      };
      store.sessions[sessionId] = nextSession;
      nextCognition = this.buildSessionCognition(sessionId, nextSession);
      return store;
    });

    return nextCognition;
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
          ...(session.seededFromSessionId ? { seededFromSessionId: session.seededFromSessionId } : {}),
          ...(session.seededAt ? { seededAt: session.seededAt } : {}),
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
      const session = this.getOrCreateSessionForKey(store, key);
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
      const session = this.getOrCreateSessionForKey(store, key);
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
      const session = this.getOrCreateSessionForKey(store, key);
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
      const session = this.getOrCreateSessionForKey(store, key);
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
      const session = this.getOrCreateSessionForKey(store, key);
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
      const session = this.getOrCreateSessionForKey(store, key);
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
    ], input.source ? inputSource : parseSessionId(sessionId)?.entrySource, memoryPrimer);

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
    ], input.source ? inputSource : parseSessionId(sessionId)?.entrySource, memoryPrimer);

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
                      neurons:
                        rawDigest.neurons && typeof rawDigest.neurons === "object"
                          ? {
                              updatedAt:
                                typeof rawDigest.neurons.updatedAt === "string" ? rawDigest.neurons.updatedAt : nowIso(),
                              perception: parseNeuronNodeArray("perception", "user-input", rawDigest.neurons.perception),
                              memory: parseNeuronNodeArray("memory", "session-digest", rawDigest.neurons.memory),
                              hypothesis: parseNeuronNodeArray("hypothesis", "runtime-inference", rawDigest.neurons.hypothesis),
                              reasoning: parseNeuronNodeArray("reasoning", "runtime-inference", rawDigest.neurons.reasoning),
                              action: parseNeuronNodeArray("action", "assistant-reply", rawDigest.neurons.action),
                              reflection: parseNeuronNodeArray("reflection", "assistant-reply", rawDigest.neurons.reflection),
                            }
                          : buildNeuronState({
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
                              turns,
                            }),
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
                    ...(typeof partial.seededFromSessionId === "string" && partial.seededFromSessionId.trim()
                      ? { seededFromSessionId: partial.seededFromSessionId.trim() }
                      : {}),
                    ...(typeof partial.seededAt === "string" && partial.seededAt.trim()
                      ? { seededAt: partial.seededAt.trim() }
                      : {}),
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

  private getOrCreateSessionForKey(
    store: AgentSessionStore,
    key: string,
  ): AgentSession {
    const existing = store.sessions[key];
    if (existing) {
      return existing;
    }

    const parsed = parseSessionId(key);
    if (parsed) {
      const latestSeed = Object.entries(store.sessions)
        .filter(([sessionId]) => sessionId !== key)
        .filter(([sessionId]) => parseSessionId(sessionId)?.senderId === parsed.senderId)
        .sort((left, right) => right[1].updatedAt.localeCompare(left[1].updatedAt))
        [0];
      if (latestSeed) {
        const seeded = seedSessionFromExisting(latestSeed[0], latestSeed[1], parsed.entrySource);
        store.sessions[key] = seeded;
        return seeded;
      }
    }

    const fallback = defaultSession();
    if (parsed) {
      fallback.lastEntrySource = parsed.entrySource;
    }
    store.sessions[key] = fallback;
    return fallback;
  }

  private async getSession(senderId: string, source?: AgentEntrySource): Promise<ResolvedAgentSession> {
    const store = await this.readStore();
    const key = this.resolveSessionId(store, senderId, source);
    const session = this.getOrCreateSessionForKey(store, key);
    await this.writeStore(store);
    return {
      sessionId: key,
      session,
    };
  }

  private async appendTurns(
    senderId: string,
    turns: AgentTurn[],
    source?: AgentEntrySource,
    memoryHits: MemoryRecallHit[] = [],
  ): Promise<void> {
    await this.mutateStore((store) => {
      const key = this.resolveSessionId(store, senderId, source);
      const current = this.getOrCreateSessionForKey(store, key);
      store.sessions[key] = {
        ...current,
        updatedAt: nowIso(),
        digest: mergeSessionDigest(current.digest, turns, memoryHits),
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
      const current = this.getOrCreateSessionForKey(store, key);
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
      "- Organize internal reasoning like a human-style neural loop: perception -> memory -> reasoning -> action.",
      "- Reply in the same language as the user.",
      "",
      ...buildCognitionToolGuidance(session.digest),
      "",
      ...buildRoleAndEntryToolGuidance(session, source),
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
      await this.appendTurns(input.senderId, toolTurns, undefined, memoryPrimer);
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
