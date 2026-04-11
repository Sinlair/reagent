import type { OpenAiReasoningEffort, OpenAiWireApi } from "../providers/llm/openAiCompatClient.js";

export type AgentRuntimeHookEntrySource = "direct" | "ui" | "wechat" | "openclaw";

export interface AgentRuntimeHookContext {
  input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
    source?: AgentRuntimeHookEntrySource | undefined;
  };
  session: {
    roleId: string;
    skillIds: string[];
    lastEntrySource?: AgentRuntimeHookEntrySource | undefined;
    providerId?: string | undefined;
    modelId?: string | undefined;
    reasoningEffort: "default" | OpenAiReasoningEffort;
  };
}

export interface AgentRuntimeLlmCallInfo {
  stage: "plain-text" | "tool-start" | "tool-continue";
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  wireApi?: OpenAiWireApi | undefined;
  toolNames: string[];
  mcpToolNames: string[];
}

export interface AgentRuntimeLlmCallResult {
  success: boolean;
  responseText?: string | undefined;
  functionCallNames: string[];
  error?: string | undefined;
}

export interface AgentRuntimeToolCallInfo {
  toolName: string;
  rawArguments: string;
  parsedArgs?: unknown;
}

export interface AgentRuntimeToolPolicyDecision {
  allow: boolean;
  reason?: string | undefined;
}

export interface AgentRuntimeReplyEmitInfo {
  reply: string;
  usedTools: string[];
}

export interface AgentRuntimeHook {
  preLlmCall?(payload: {
    context: AgentRuntimeHookContext;
    call: AgentRuntimeLlmCallInfo;
  }): Promise<void> | void;
  postLlmCall?(payload: {
    context: AgentRuntimeHookContext;
    call: AgentRuntimeLlmCallInfo;
    result: AgentRuntimeLlmCallResult;
  }): Promise<void> | void;
  checkToolCall?(payload: {
    context: AgentRuntimeHookContext;
    tool: AgentRuntimeToolCallInfo;
  }): Promise<AgentRuntimeToolPolicyDecision | void> | AgentRuntimeToolPolicyDecision | void;
  preToolCall?(payload: {
    context: AgentRuntimeHookContext;
    tool: AgentRuntimeToolCallInfo;
  }): Promise<void> | void;
  postToolCall?(payload: {
    context: AgentRuntimeHookContext;
    tool: AgentRuntimeToolCallInfo;
    output: unknown;
  }): Promise<void> | void;
  toolError?(payload: {
    context: AgentRuntimeHookContext;
    tool: AgentRuntimeToolCallInfo;
    error: string;
  }): Promise<void> | void;
  toolBlocked?(payload: {
    context: AgentRuntimeHookContext;
    tool: AgentRuntimeToolCallInfo;
    reason: string;
  }): Promise<void> | void;
  preReplyEmit?(payload: {
    context: AgentRuntimeHookContext;
    reply: AgentRuntimeReplyEmitInfo;
  }): Promise<void> | void;
}
