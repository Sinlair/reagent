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
    const effectiveWorkspaceDir = workspaceDir ?? env.PLATFORM_WORKSPACE_DIR;

    return {
      agent: env.RESEARCH_AGENT_NAME,
      nodeEnv: env.NODE_ENV,
      llmProvider: activeAgentRoute.providerType,
      llmWireApi: activeAgentRoute.wireApi ?? null,
      llmModel: activeAgentRoute.modelId,
      wechatProvider: env.WECHAT_PROVIDER,
      workspaceDir: effectiveWorkspaceDir,
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
      },
      deployment: {
        workspaceDir: effectiveWorkspaceDir,
        rootPackage: "reagent",
        rootRuntime: {
          installCommand: "npm install",
          startCommand: "npm start",
          devCommand: "npm run dev",
          buildCommand: "npm run build"
        },
        alwaysOn: {
          supported: true,
          modes: [
            {
              id: "pm2",
              label: "PM2",
              installCommand: "npm run pm2:start",
              restartCommand: "npm run pm2:restart",
              stopCommand: "npm run pm2:stop"
            },
            {
              id: "windows-service",
              label: "Windows Service",
              installCommand: "npm run service:install",
              startCommand: "npm run service:start",
              statusCommand: "npm run service:status",
              stopCommand: "npm run service:stop"
            },
            {
              id: "openclaw-bridge",
              label: "OpenClaw Bridge",
              installCommand: "npm install && npm start",
              statusCommand: "Open Settings > Channels to inspect pairing, lifecycle, and gateway state."
            }
          ],
          notes: [
            "The root runtime already supports health monitoring, reconnect gating, and automatic recovery for native/openclaw WeChat providers.",
            "For always-on operation, use PM2 or the bundled Windows service scripts instead of keeping a foreground terminal open."
          ]
        },
        openclawPlugin: {
          packageName: "@sinlair/reagent-openclaw",
          installCommand: "openclaw plugins install @sinlair/reagent-openclaw --yes",
          sampleCommands: [
            "/reagent-status",
            "/reagent-discover [directionId]",
            "/reagent-direction-report <directionId-or-topic>",
            "/reagent-presentation-generate [topic]"
          ]
        }
      }
    };
  });
}
