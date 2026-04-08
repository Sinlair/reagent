import { MemoryCompactionSchedulerService } from "@sinlair/reagent-core";
import { definePluginEntry } from "openclaw/plugin-sdk/core";

import { ReAgentPluginConfigSchema } from "./src/config.js";
import { registerReAgentCommands } from "./src/commands.js";
import { createPluginServices } from "./src/services.js";
import { registerReAgentTools } from "./src/tools.js";

export default definePluginEntry({
  id: "reagent-openclaw",
  name: "ReAgent",
  description: "Research workflow plugin for OpenClaw",
  configSchema: ReAgentPluginConfigSchema,
  register(api) {
    const services = createPluginServices(api);
    const memoryScheduler = new MemoryCompactionSchedulerService(services.memoryCompactionService, {
      info: (message: string) => api.logger.info(message),
      warn: (message: string) => api.logger.warn(message),
      error: (message: string) => api.logger.error(message),
    });

    api.registerService({
      id: "reagent-openclaw-service",
      start: async (ctx) => {
        await memoryScheduler.start();
        ctx.logger.info("ReAgent OpenClaw plugin service started.");
      },
      stop: async (ctx) => {
        await memoryScheduler.stop();
        ctx.logger.info("ReAgent OpenClaw plugin service stopped.");
      },
    });

    registerReAgentCommands(api);
    registerReAgentTools(api);
  }
});
