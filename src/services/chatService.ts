import {
  AgentRuntime,
  type AgentChatInput,
  type AgentSessionListEntry,
  type AgentSessionSummary
} from "../agents/runtime.js";
import type { OpenAiCompatClientShape, OpenAiReasoningEffort, OpenAiWireApi } from "../providers/llm/openAiCompatClient.js";
import type { LlmRouteSelection } from "./llmRegistryService.js";
import type { MemoryService } from "./memoryService.js";
import type { ResearchService } from "./researchService.js";

interface ChatServiceOptions {
  client?: OpenAiCompatClientShape;
  model?: string;
  researchService?: Pick<ResearchService, "runResearch" | "listRecentReports" | "getReport">;
  wireApi?: OpenAiWireApi;
}

export interface ChatServiceLike {
  reply(input: AgentChatInput): Promise<string>;
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
    };
    this.runtime = new AgentRuntime(workspaceDir, memoryService, runtimeOptions);
  }

  async reply(input: AgentChatInput): Promise<string> {
    return this.runtime.reply(input);
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
