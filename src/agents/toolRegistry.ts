import { z } from "zod";

export interface AgentToolDefinition<TArgs, TContext> {
  name: string;
  description: string;
  skillId: string;
  toolsetIds: string[];
  inputSchema: z.ZodType<TArgs>;
  parameters: Record<string, unknown>;
  execute(args: TArgs, context: TContext): Promise<unknown>;
}

export interface ToolRegistryResolveOptions {
  enabledSkillIds: Iterable<string>;
  allowedToolsetIds: Iterable<string>;
}

export class ToolRegistry<TContext> {
  private readonly tools = new Map<string, AgentToolDefinition<unknown, TContext>>();

  register<TArgs>(tool: AgentToolDefinition<TArgs, TContext>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool registration: ${tool.name}`);
    }

    this.tools.set(tool.name, tool as AgentToolDefinition<unknown, TContext>);
  }

  registerMany(tools: AgentToolDefinition<unknown, TContext>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  list(): AgentToolDefinition<unknown, TContext>[] {
    return [...this.tools.values()];
  }

  resolve(options: ToolRegistryResolveOptions): AgentToolDefinition<unknown, TContext>[] {
    const enabledSkillIds = new Set(options.enabledSkillIds);
    const allowedToolsetIds = new Set(options.allowedToolsetIds);

    return this.list()
      .filter((tool) => enabledSkillIds.has(tool.skillId))
      .filter((tool) => tool.toolsetIds.some((toolsetId) => allowedToolsetIds.has(toolsetId)));
  }
}
