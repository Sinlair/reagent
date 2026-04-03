import OpenAI from "openai";

export type OpenAiWireApi = "responses" | "chat-completions";
export type OpenAiReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

type OpenAiResponsesClient = Pick<OpenAI, "responses">;
type OpenAiChatClient = Pick<OpenAI, "chat">;

export type OpenAiCompatClientShape = Partial<OpenAiResponsesClient & OpenAiChatClient>;

export interface RepairContext {
  rawText: string;
  reason: string;
}

export interface FunctionToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallOutput {
  toolCallId: string;
  toolName: string;
  output: string;
}

export interface CompatToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type CompatConversationState =
  | {
      wireApi: "responses";
      previousResponseId: string;
    }
  | {
      wireApi: "chat-completions";
      messages: OpenAI.ChatCompletionMessageParam[];
    };

export interface CompatToolTurnResult {
  text: string;
  functionCalls: CompatToolCall[];
  state: CompatConversationState;
}

function buildInput(systemPrompt: string, userPayload: string, repairContext?: RepairContext): string {
  const parts = [systemPrompt, "", "Payload:", userPayload];

  if (repairContext) {
    parts.push(
      "",
      "The previous response was invalid.",
      `Reason: ${repairContext.reason}`,
      "Previous response:",
      repairContext.rawText,
      "",
      "Return corrected JSON only. Do not include markdown fences or commentary.",
    );
  }

  return parts.join("\n");
}

function extractChatText(message: { content?: unknown | null }): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((item) =>
        item && typeof item === "object" && "type" in item && item.type === "text" && "text" in item
          ? String(item.text ?? "")
          : "",
      )
      .join("")
      .trim();
  }
  return "";
}

function toChatTools(tools: FunctionToolSpec[]): OpenAI.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export class OpenAiCompatClient {
  private readonly client: OpenAiCompatClientShape;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly wireApi: OpenAiWireApi,
    private readonly baseURL?: string,
    client?: OpenAiCompatClientShape,
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });
  }

  async createText(params: {
    systemPrompt: string;
    userPayload: string;
    repairContext?: RepairContext;
    reasoningEffort?: OpenAiReasoningEffort | undefined;
  }): Promise<string> {
    if (this.wireApi === "responses") {
      if (!this.client.responses) {
        throw new Error("OpenAI responses client is unavailable.");
      }
      const response = await this.client.responses.create({
        model: this.model,
        store: false,
        input: buildInput(params.systemPrompt, params.userPayload, params.repairContext),
        ...(params.reasoningEffort ? { reasoning: { effort: params.reasoningEffort } } : {}),
      });
      return response.output_text?.trim() ?? "";
    }

    if (!this.client.chat) {
      throw new Error("OpenAI chat completions client is unavailable.");
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        {
          role: "user",
          content: buildInput(params.systemPrompt, params.userPayload, params.repairContext),
        },
      ],
      ...(params.reasoningEffort ? { reasoning_effort: params.reasoningEffort } : {}),
    });

    return extractChatText(completion.choices[0]?.message ?? {});
  }

  async startToolTurn(params: {
    instructions: string;
    input: string;
    tools: FunctionToolSpec[];
    mcpTools?: OpenAI.Responses.Tool.Mcp[];
    reasoningEffort?: OpenAiReasoningEffort | undefined;
  }): Promise<CompatToolTurnResult> {
    if (this.wireApi === "responses") {
      if (!this.client.responses) {
        throw new Error("OpenAI responses client is unavailable.");
      }
      const response = await this.client.responses.create({
        model: this.model,
        store: false,
        instructions: params.instructions,
        input: params.input,
        ...(params.reasoningEffort ? { reasoning: { effort: params.reasoningEffort } } : {}),
        tools: [
          ...params.tools.map((tool) => ({
            type: "function" as const,
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: true,
          })),
          ...(params.mcpTools ?? []),
        ],
      });

      return {
        text: response.output_text?.trim() ?? "",
        functionCalls: (response.output ?? [])
          .filter(
            (item): item is { type: "function_call"; name: string; arguments: string; call_id: string } =>
              item.type === "function_call",
          )
          .map((call) => ({
            id: call.call_id,
            name: call.name,
            arguments: call.arguments,
          })),
        state: {
          wireApi: "responses",
          previousResponseId: response.id,
        },
      };
    }

    if (!this.client.chat) {
      throw new Error("OpenAI chat completions client is unavailable.");
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: params.instructions },
      { role: "user", content: params.input },
    ];

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      ...(params.reasoningEffort ? { reasoning_effort: params.reasoningEffort } : {}),
      ...(params.tools.length ? { tools: toChatTools(params.tools), tool_choice: "auto" as const } : {}),
    });

    const message = completion.choices[0]?.message;
    const nextMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: "assistant",
        ...(message?.content ? { content: message.content } : {}),
        ...(message?.tool_calls ? { tool_calls: message.tool_calls } : {}),
      },
    ];

    return {
      text: extractChatText(message ?? {}),
      functionCalls: (message?.tool_calls ?? [])
        .filter((call): call is OpenAI.ChatCompletionMessageFunctionToolCall => call.type === "function")
        .map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })),
      state: {
        wireApi: "chat-completions",
        messages: nextMessages,
      },
    };
  }

  async continueToolTurn(params: {
    state: CompatConversationState;
    tools: FunctionToolSpec[];
    mcpTools?: OpenAI.Responses.Tool.Mcp[];
    outputs: ToolCallOutput[];
    reasoningEffort?: OpenAiReasoningEffort | undefined;
  }): Promise<CompatToolTurnResult> {
    if (params.state.wireApi === "responses") {
      if (!this.client.responses) {
        throw new Error("OpenAI responses client is unavailable.");
      }

      const response = await this.client.responses.create({
        model: this.model,
        store: false,
        previous_response_id: params.state.previousResponseId,
        input: params.outputs.map((output) => ({
          type: "function_call_output" as const,
          call_id: output.toolCallId,
          output: output.output,
        })),
        ...(params.reasoningEffort ? { reasoning: { effort: params.reasoningEffort } } : {}),
        tools: [
          ...params.tools.map((tool) => ({
            type: "function" as const,
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: true,
          })),
          ...(params.mcpTools ?? []),
        ],
      });

      return {
        text: response.output_text?.trim() ?? "",
        functionCalls: (response.output ?? [])
          .filter(
            (item): item is { type: "function_call"; name: string; arguments: string; call_id: string } =>
              item.type === "function_call",
          )
          .map((call) => ({
            id: call.call_id,
            name: call.name,
            arguments: call.arguments,
          })),
        state: {
          wireApi: "responses",
          previousResponseId: response.id,
        },
      };
    }

    if (!this.client.chat) {
      throw new Error("OpenAI chat completions client is unavailable.");
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      ...params.state.messages,
      ...params.outputs.map(
        (output) =>
          ({
            role: "tool",
            tool_call_id: output.toolCallId,
            content: output.output,
          }) satisfies OpenAI.ChatCompletionToolMessageParam,
      ),
    ];

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      ...(params.reasoningEffort ? { reasoning_effort: params.reasoningEffort } : {}),
      ...(params.tools.length ? { tools: toChatTools(params.tools), tool_choice: "auto" as const } : {}),
    });

    const message = completion.choices[0]?.message;
    const nextMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: "assistant",
        ...(message?.content ? { content: message.content } : {}),
        ...(message?.tool_calls ? { tool_calls: message.tool_calls } : {}),
      },
    ];

    return {
      text: extractChatText(message ?? {}),
      functionCalls: (message?.tool_calls ?? [])
        .filter((call): call is OpenAI.ChatCompletionMessageFunctionToolCall => call.type === "function")
        .map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })),
      state: {
        wireApi: "chat-completions",
        messages: nextMessages,
      },
    };
  }
}
