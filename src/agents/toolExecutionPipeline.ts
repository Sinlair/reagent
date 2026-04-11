import type {
  CompatConversationState,
  CompatToolTurnResult,
  ToolCallOutput,
} from "../providers/llm/openAiCompatClient.js";
import type {
  AgentRuntimeToolCallInfo,
  AgentRuntimeToolPolicyDecision,
} from "./runtimeHooks.js";
import type { AgentToolDefinition } from "./toolRegistry.js";

export interface ToolExecutionTurn {
  role: "tool";
  content: string;
  createdAt: string;
  name?: string | undefined;
}

export interface ToolExecutionResult {
  finalText: string;
  toolTurns: ToolExecutionTurn[];
}

export interface ToolExecutionPipelineOptions<TContext> {
  toolMap: Map<string, AgentToolDefinition<unknown, TContext>>;
  toolContext: TContext;
  initialResponse: CompatToolTurnResult;
  maxRounds: number;
  nowIso(): string;
  continueTurn(input: {
    state: CompatConversationState;
    outputs: ToolCallOutput[];
  }): Promise<CompatToolTurnResult>;
  transformToolResult?(toolName: string, result: unknown): Promise<unknown>;
  checkToolCall?(tool: AgentRuntimeToolCallInfo): Promise<AgentRuntimeToolPolicyDecision> | AgentRuntimeToolPolicyDecision;
  onPreToolCall?(tool: AgentRuntimeToolCallInfo): Promise<void> | void;
  onPostToolCall?(tool: AgentRuntimeToolCallInfo, output: unknown): Promise<void> | void;
  onToolError?(tool: AgentRuntimeToolCallInfo, error: string): Promise<void> | void;
  onToolBlocked?(tool: AgentRuntimeToolCallInfo, reason: string): Promise<void> | void;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class ToolExecutionPipeline<TContext> {
  private response: CompatToolTurnResult;
  private readonly toolTurns: ToolExecutionTurn[] = [];

  constructor(private readonly options: ToolExecutionPipelineOptions<TContext>) {
    this.response = options.initialResponse;
  }

  async run(): Promise<ToolExecutionResult> {
    for (let round = 0; round < this.options.maxRounds; round += 1) {
      const functionCalls = this.response.functionCalls;

      if (functionCalls.length === 0) {
        const text = this.response.text?.trim();
        if (text) {
          return {
            finalText: text,
            toolTurns: [...this.toolTurns],
          };
        }

        throw new Error("Agent runtime response was empty.");
      }

      const outputs = await Promise.all(
        functionCalls.map((call) => this.executeToolCall(call)),
      );

      this.response = await this.options.continueTurn({
        state: this.response.state,
        outputs,
      });
    }

    throw new Error(`Agent runtime exceeded ${this.options.maxRounds} tool rounds without producing a final answer.`);
  }

  private async executeToolCall(call: { id: string; name: string; arguments: string }): Promise<ToolCallOutput> {
    const fallbackToolInfo: AgentRuntimeToolCallInfo = {
      toolName: call.name,
      rawArguments: call.arguments,
    };
    const tool = this.options.toolMap.get(call.name);

    if (!tool) {
      const error = `Unknown tool: ${call.name}`;
      const output = JSON.stringify({ ok: false, error });
      await this.options.onToolError?.(fallbackToolInfo, error);
      this.pushToolTurn(call.name, output);
      return {
        toolCallId: call.id,
        toolName: call.name,
        output,
      };
    }

    try {
      const rawArgs = call.arguments?.trim() ? JSON.parse(call.arguments) : {};
      const parsedArgs = tool.inputSchema.parse(rawArgs);
      const toolInfo: AgentRuntimeToolCallInfo = {
        toolName: call.name,
        rawArguments: call.arguments,
        parsedArgs,
      };

      const decision = this.options.checkToolCall
        ? await this.options.checkToolCall(toolInfo)
        : { allow: true };
      if (!decision.allow) {
        const reason = decision.reason?.trim() || `Tool call blocked by runtime policy: ${call.name}`;
        const output = JSON.stringify({ ok: false, error: reason });
        await this.options.onToolBlocked?.(toolInfo, reason);
        this.pushToolTurn(call.name, output);
        return {
          toolCallId: call.id,
          toolName: call.name,
          output,
        };
      }

      await this.options.onPreToolCall?.(toolInfo);
      const result = await tool.execute(parsedArgs, this.options.toolContext);
      const transformed = this.options.transformToolResult
        ? await this.options.transformToolResult(call.name, result)
        : result;
      await this.options.onPostToolCall?.(toolInfo, transformed);

      const output = JSON.stringify({ ok: true, result: transformed });
      this.pushToolTurn(call.name, output);
      return {
        toolCallId: call.id,
        toolName: call.name,
        output,
      };
    } catch (error) {
      const message = describeError(error);
      const output = JSON.stringify({ ok: false, error: message });
      await this.options.onToolError?.(fallbackToolInfo, message);
      this.pushToolTurn(call.name, output);
      return {
        toolCallId: call.id,
        toolName: call.name,
        output,
      };
    }
  }

  private pushToolTurn(name: string, content: string): void {
    this.toolTurns.push({
      role: "tool",
      name,
      content,
      createdAt: this.options.nowIso(),
    });
  }
}
