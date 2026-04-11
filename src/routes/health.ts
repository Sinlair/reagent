import type { FastifyInstance } from "fastify";

import { env } from "../config/env.js";
import { DEFAULT_GATEWAY_PORT, getGatewayServiceStatus } from "../gatewayService.js";
import { LlmRegistryService } from "../services/llmRegistryService.js";
import { McpRegistryService } from "../services/mcpRegistryService.js";
import type { RuntimeJobsService } from "../services/runtimeJobsService.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
  workspaceDir?: string,
  runtimeJobsService?: RuntimeJobsService,
): Promise<void> {
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
    const gatewayStatus = await getGatewayServiceStatus(env.PORT, {
      probe: false,
      runtimeOverride: {
        healthReachable: true,
        healthStatus: "ok",
        runtimeWorkspaceDir: effectiveWorkspaceDir,
        runtimeAgent: env.RESEARCH_AGENT_NAME,
        runtimeLlmProvider: activeAgentRoute.providerType,
        runtimeWechatProvider: env.WECHAT_PROVIDER,
        runtimeOpenClawCli: env.OPENCLAW_CLI_PATH,
        listenerPid: process.pid,
      },
    });
    const gatewayModeLabel =
      gatewayStatus.serviceManager === "launchd"
        ? "launchd"
        : gatewayStatus.serviceManager === "systemd"
          ? "systemd user service"
          : gatewayStatus.serviceManager === "schtasks"
            ? "Scheduled Task"
            : gatewayStatus.serviceManager === "startup"
              ? "Startup Entry"
              : "Gateway Service";
    const defaultGatewayCommands = {
      install: `reagent service install --port ${DEFAULT_GATEWAY_PORT}`,
      start: "reagent service start",
      restart: "reagent service restart",
      status: "reagent service status",
      deepStatus: "reagent service status --deep",
      stop: "reagent service stop",
      uninstall: "reagent service uninstall",
      logs: "reagent service logs",
      doctor: "reagent runtime doctor",
      deepDoctor: "reagent runtime doctor --deep",
    };

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
        rootPackage: "@sinlair/reagent",
        rootRuntime: {
          installCommand: "npm install -g @sinlair/reagent",
          startCommand: `reagent service run --port ${DEFAULT_GATEWAY_PORT}`,
          devCommand: `reagent service run --port ${DEFAULT_GATEWAY_PORT}`,
          buildCommand: "npm run build"
        },
        gateway: {
          defaultPort: DEFAULT_GATEWAY_PORT,
          runtimePort: env.PORT,
          platform: gatewayStatus.platform,
          serviceManager: gatewayStatus.serviceManager,
          managerLabel: gatewayModeLabel,
          runtime: {
            currentProcessPid: process.pid,
            currentProcessOwnsPort: gatewayStatus.listenerPid === process.pid,
            healthUrl: gatewayStatus.healthUrl
          },
          commands: defaultGatewayCommands,
          supervisor: gatewayStatus
        },
        alwaysOn: {
          supported: gatewayStatus.serviceSupported,
          modes: gatewayStatus.serviceSupported
            ? [
                {
                  id: gatewayStatus.installKind ?? "gateway-service",
                  label: gatewayModeLabel,
                  installCommand: defaultGatewayCommands.install,
                  startCommand: defaultGatewayCommands.start,
                  restartCommand: defaultGatewayCommands.restart,
                  statusCommand: defaultGatewayCommands.status,
                  deepStatusCommand: defaultGatewayCommands.deepStatus,
                  stopCommand: defaultGatewayCommands.stop,
                  uninstallCommand: defaultGatewayCommands.uninstall,
                  logsCommand: defaultGatewayCommands.logs,
                  doctorCommand: defaultGatewayCommands.doctor,
                  deepDoctorCommand: defaultGatewayCommands.deepDoctor
                }
              ]
            : [],
          notes: [
            "The published CLI now exposes a single runtime surface aligned around reagent service and reagent runtime.",
            "Use reagent service install/start/status/stop/restart/logs and reagent runtime doctor instead of npm scripts when running the packaged CLI.",
            env.PORT === DEFAULT_GATEWAY_PORT
              ? `The active runtime is already bound to the default gateway port ${DEFAULT_GATEWAY_PORT}.`
              : `The active runtime is bound to port ${env.PORT}; install/start commands still default to ${DEFAULT_GATEWAY_PORT}.`
          ]
        },
        openclawPlugin: {
          packageName: "@tencent-weixin/openclaw-weixin",
          installCommand: "openclaw plugins install @tencent-weixin/openclaw-weixin@2.1.1 --yes",
          sampleCommands: ["See plugin docs"]
        }
      }
    };
  });

  if (runtimeJobsService) {
    app.get("/api/runtime/jobs", async (request) => {
      const limit =
        request.query &&
        typeof request.query === "object" &&
        "limit" in request.query &&
        typeof request.query.limit === "string"
          ? Number.parseInt(request.query.limit, 10)
          : 5;

      return {
        items: await runtimeJobsService.listJobs(Number.isFinite(limit) ? limit : 5),
      };
    });
  }
}
