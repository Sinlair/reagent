import type { FastifyInstance } from "fastify";

import { env } from "../config/env.js";
import { LlmRegistryService } from "../services/llmRegistryService.js";
import { McpRegistryService } from "../services/mcpRegistryService.js";

export async function registerHealthRoutes(app: FastifyInstance, workspaceDir?: string): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    agent: env.RESEARCH_AGENT_NAME,
    time: new Date().toISOString()
  }));

  app.get("/api/runtime/meta", async () => {
    const llmRegistry = new LlmRegistryService(workspaceDir ?? env.PLATFORM_WORKSPACE_DIR);
    const llmSummary = await llmRegistry.getSummary();
    const registry = new McpRegistryService(workspaceDir ?? env.PLATFORM_WORKSPACE_DIR);
    const servers = await registry.listServers();
    const activeAgentRoute = llmSummary.routes.agent;

    return {
      agent: env.RESEARCH_AGENT_NAME,
      nodeEnv: env.NODE_ENV,
      llmProvider: activeAgentRoute.providerType,
      llmWireApi: activeAgentRoute.wireApi ?? null,
      llmModel: activeAgentRoute.modelId,
      wechatProvider: env.WECHAT_PROVIDER,
      workspaceDir: env.PLATFORM_WORKSPACE_DIR,
      llm: {
        defaults: llmSummary.defaults,
        routes: llmSummary.routes,
        providers: llmSummary.providers
      },
      mcp: {
        supported: activeAgentRoute.providerType === "openai" && activeAgentRoute.wireApi === "responses",
        connectors: servers.length,
        status:
          servers.length === 0
            ? "not-configured"
            : servers.some((server) => server.status === "ready")
              ? "ready"
              : "needs-setup",
        notes:
          servers.length === 0
            ? ["No MCP servers are configured in workspace/channels/mcp-servers.json."]
            : servers.flatMap((server) => server.notes),
        servers
      },
      openclaw: {
        gatewayUrl: env.OPENCLAW_GATEWAY_URL,
        cliPath: env.OPENCLAW_CLI_PATH,
        channelId: env.OPENCLAW_WECHAT_CHANNEL_ID
      }
    };
  });
}
