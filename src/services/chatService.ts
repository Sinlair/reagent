import {
  AgentRuntime,
  type AgentRuntimeOverview,
  type AgentChatInput,
  type AgentSessionHooks,
  type AgentSessionHistory,
  type AgentSessionListEntry,
  type AgentSessionSummary
} from "../agents/runtime.js";
import type { AgentRuntimeHook } from "../agents/runtimeHooks.js";
import type { OpenAiCompatClientShape, OpenAiReasoningEffort, OpenAiWireApi } from "../providers/llm/openAiCompatClient.js";
import type { LlmRouteSelection } from "./llmRegistryService.js";
import type { MemoryService } from "./memoryService.js";
import type { ResearchService } from "./researchService.js";

interface ChatServiceOptions {
  client?: OpenAiCompatClientShape;
  model?: string;
  researchService?: Pick<ResearchService, "runResearch" | "listRecentReports" | "getReport">;
  wireApi?: OpenAiWireApi;
  hooks?: AgentRuntimeHook[] | undefined;
}

export interface ChatServiceLike {
  reply(input: AgentChatInput): Promise<string>;
  plainReply?(input: AgentChatInput): Promise<string>;
  describeRuntime?(): Promise<AgentRuntimeOverview>;
  findSession?(reference: string): Promise<AgentSessionSummary | null>;
  findSessionHistory?(reference: string, limit?: number): Promise<AgentSessionHistory | null>;
  findSessionHooks?(reference: string, limit?: number, event?: "llm_call" | "tool_call" | "tool_error" | "tool_blocked" | "reply_emit"): Promise<AgentSessionHooks | null>;
  listSessions?(): Promise<AgentSessionListEntry[]>;
  setRole?(senderId: string, roleId: string): Promise<AgentSessionSummary>;
  setSkills?(senderId: string, skillIds: string[]): Promise<AgentSessionSummary>;
  setModel?(senderId: string, providerId: string, modelId: string): Promise<AgentSessionSummary>;
  clearModel?(senderId: string): Promise<AgentSessionSummary>;
  setFallbacks?(senderId: string, selections: LlmRouteSelection[]): Promise<AgentSessionSummary>;
  setReasoning?(senderId: string, reasoningEffort: "default" | OpenAiReasoningEffort): Promise<AgentSessionSummary>;
  describeSession?(senderId: string): Promise<AgentSessionSummary>;
}

export class ChatService implements ChatServiceLike {
  private readonly runtime: AgentRuntime;

  constructor(
    workspaceDir: string,
    memoryService: MemoryService,
    options: ChatServiceOptions = {},
  ) {
    const runtimeOptions = {
      ...(options.client ? { client: options.client } : {}),
      ...(options.model ? { model: options.model } : {}),
      ...(options.researchService ? { researchService: options.researchService } : {}),
      ...(options.wireApi ? { wireApi: options.wireApi } : {}),
      ...(options.hooks ? { hooks: options.hooks } : {}),
    };
    this.runtime = new AgentRuntime(workspaceDir, memoryService, runtimeOptions);
  }

  async reply(input: AgentChatInput): Promise<string> {
    return this.runtime.reply(input);
  }

  async plainReply(input: AgentChatInput): Promise<string> {
    return this.runtime.replyPlain(input);
  }

  async describeRuntime(): Promise<AgentRuntimeOverview> {
    return this.runtime.describeRuntime();
  }

  async findSession(reference: string): Promise<AgentSessionSummary | null> {
    return this.runtime.findSession(reference);
  }

  async findSessionHistory(reference: string, limit?: number): Promise<AgentSessionHistory | null> {
    return this.runtime.findSessionHistory(reference, limit);
  }

  async findSessionHooks(
    reference: string,
    limit?: number,
    event?: "llm_call" | "tool_call" | "tool_error" | "tool_blocked" | "reply_emit",
  ): Promise<AgentSessionHooks | null> {
    return this.runtime.findSessionHooks(reference, limit, event);
  }

  async listSessions(): Promise<AgentSessionListEntry[]> {
    return this.runtime.listSessions();
  }

  async setRole(senderId: string, roleId: string): Promise<AgentSessionSummary> {
    return this.runtime.setRole(senderId, roleId);
  }

  async setSkills(senderId: string, skillIds: string[]): Promise<AgentSessionSummary> {
    return this.runtime.setSkills(senderId, skillIds);
  }

  async setModel(senderId: string, providerId: string, modelId: string): Promise<AgentSessionSummary> {
    return this.runtime.setModel(senderId, providerId, modelId);
  }

  async clearModel(senderId: string): Promise<AgentSessionSummary> {
    return this.runtime.clearModel(senderId);
  }

  async setFallbacks(senderId: string, selections: LlmRouteSelection[]): Promise<AgentSessionSummary> {
    return this.runtime.setFallbacks(senderId, selections);
  }

  async setReasoning(
    senderId: string,
    reasoningEffort: "default" | OpenAiReasoningEffort,
  ): Promise<AgentSessionSummary> {
    return this.runtime.setReasoning(senderId, reasoningEffort);
  }

  async describeSession(senderId: string): Promise<AgentSessionSummary> {
    return this.runtime.describeSession(senderId);
  }
}
