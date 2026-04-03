import path from "node:path";

import Fastify from "fastify";

import { env } from "./config/env.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMemoryRoutes } from "./routes/memory.js";
import { registerResearchRoutes } from "./routes/research.js";
import { registerUiRoutes } from "./routes/ui.js";
import { ChannelService } from "./services/channelService.js";
import { MemoryService } from "./services/memoryService.js";
import { ResearchDirectionService } from "./services/researchDirectionService.js";
import { ResearchDiscoverySchedulerService } from "./services/researchDiscoverySchedulerService.js";
import { ResearchDiscoveryService } from "./services/researchDiscoveryService.js";
import { buildResearchService } from "./services/researchService.js";
import { ResearchTaskService } from "./services/researchTaskService.js";

export async function createApp() {
  const app = Fastify({
    logger: true
  });

  const workspaceDir = path.resolve(process.cwd(), env.PLATFORM_WORKSPACE_DIR);
  const researchService = buildResearchService(workspaceDir);
  const researchTaskService = new ResearchTaskService(workspaceDir, researchService);
  await researchTaskService.recoverInterruptedTasks();
  const researchDirectionService = new ResearchDirectionService(workspaceDir);
  const memoryService = new MemoryService(workspaceDir);
  await memoryService.ensureWorkspace();
  const channelService = new ChannelService(workspaceDir, researchService, memoryService, {
    wechatProvider: env.WECHAT_PROVIDER,
    openClaw: {
      cliPath: env.OPENCLAW_CLI_PATH,
      gatewayUrl: env.OPENCLAW_GATEWAY_URL,
      channelId: env.OPENCLAW_WECHAT_CHANNEL_ID,
      token: env.OPENCLAW_GATEWAY_TOKEN,
      password: env.OPENCLAW_GATEWAY_PASSWORD
    }
  });
  const researchDiscoveryService = new ResearchDiscoveryService(workspaceDir, {
    pushDigest: async (input) => {
      await channelService.pushWeChatMessage(input);
    }
  });
  const researchDiscoverySchedulerService = new ResearchDiscoverySchedulerService(
    workspaceDir,
    researchDiscoveryService,
  );

  await registerHealthRoutes(app, workspaceDir);
  await registerResearchRoutes(
    app,
    workspaceDir,
    researchService,
    researchTaskService,
    researchDirectionService,
    researchDiscoveryService,
    researchDiscoverySchedulerService,
  );
  await registerMemoryRoutes(app, memoryService);
  await registerChannelRoutes(app, channelService);
  await registerUiRoutes(app);

  try {
    await channelService.start();
    await researchDiscoverySchedulerService.start();
  } catch (error) {
    app.log.error(
      { err: error },
      "Channel service startup warmup failed. ReAgent will continue in degraded mode."
    );
  }

  app.addHook("onClose", async () => {
    await researchDiscoverySchedulerService.stop();
    await channelService.close();
  });

  return app;
}
