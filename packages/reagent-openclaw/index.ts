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
    createPluginServices(api);

    api.registerService({
      id: "reagent-openclaw-service",
      start: async (ctx) => {
        ctx.logger.info("ReAgent OpenClaw plugin service started.");
      },
      stop: async (ctx) => {
        ctx.logger.info("ReAgent OpenClaw plugin service stopped.");
      },
    });

    registerReAgentCommands(api);
    registerReAgentTools(api);
  }
});
