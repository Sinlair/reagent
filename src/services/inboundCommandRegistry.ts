export type InboundCommandSource = "ui" | "wechat" | "openclaw";

export type InboundSlashCommandId =
  | "help"
  | "status"
  | "research"
  | "memory"
  | "memory-compact"
  | "remember"
  | "feedback"
  | "role"
  | "skills"
  | "model"
  | "fallbacks"
  | "reasoning";

export type InboundSlashCommandTier =
  | "safe"
  | "workspace-mutation"
  | "session-control"
  | "maintenance";

export type InboundSlashCommandSpec = {
  id: InboundSlashCommandId;
  names: string[];
  usage: string;
  tier: InboundSlashCommandTier;
  requiresAgentControls?: boolean;
  allowedSources?: InboundCommandSource[];
};

export const INBOUND_SLASH_COMMAND_SPECS: InboundSlashCommandSpec[] = [
  {
    id: "help",
    names: ["help", "commands", "?"],
    usage: "/help",
    tier: "safe",
  },
  {
    id: "status",
    names: ["status"],
    usage: "/status",
    tier: "safe",
  },
  {
    id: "research",
    names: ["research"],
    usage: "/research <topic>",
    tier: "workspace-mutation",
  },
  {
    id: "memory",
    names: ["memory"],
    usage: "/memory <query>",
    tier: "safe",
  },
  {
    id: "memory-compact",
    names: ["memory-compact"],
    usage: "/memory-compact [days]",
    tier: "maintenance",
    allowedSources: ["ui"],
  },
  {
    id: "remember",
    names: ["remember"],
    usage: "/remember <fact>",
    tier: "workspace-mutation",
  },
  {
    id: "feedback",
    names: ["feedback"],
    usage: "/feedback <signal> [notes]",
    tier: "workspace-mutation",
  },
  {
    id: "role",
    names: ["role"],
    usage: "/role <assistant|operator|researcher>",
    tier: "session-control",
    requiresAgentControls: true,
  },
  {
    id: "skills",
    names: ["skills"],
    usage: "/skills",
    tier: "session-control",
    requiresAgentControls: true,
  },
  {
    id: "model",
    names: ["model"],
    usage: "/model [providerId modelId]",
    tier: "session-control",
    requiresAgentControls: true,
  },
  {
    id: "fallbacks",
    names: ["fallbacks"],
    usage: "/fallbacks [providerId/modelId, ...]",
    tier: "session-control",
    requiresAgentControls: true,
  },
  {
    id: "reasoning",
    names: ["reasoning"],
    usage: "/reasoning [default|none|minimal|low|medium|high|xhigh]",
    tier: "session-control",
    requiresAgentControls: true,
  },
];

export function resolveAllowedSourcesForInboundCommand(
  spec: InboundSlashCommandSpec,
): InboundCommandSource[] {
  if (spec.allowedSources && spec.allowedSources.length > 0) {
    return [...spec.allowedSources];
  }

  if (spec.tier === "maintenance") {
    return ["ui"];
  }

  return ["ui", "wechat", "openclaw"];
}

export function formatInboundCommandUsage(spec: InboundSlashCommandSpec): string {
  const allowedSources = resolveAllowedSourcesForInboundCommand(spec);
  const tierLabel =
    allowedSources.length < 3
      ? `${spec.tier}/${allowedSources.join("/")}`
      : spec.tier === "safe"
        ? ""
        : spec.tier;
  return tierLabel ? `${spec.usage} [${tierLabel}]` : spec.usage;
}

export function resolveInboundSlashCommandSpec(rawCommand: string): InboundSlashCommandSpec | null {
  const normalized = rawCommand.trim().replace(/^\//u, "").toLowerCase();
  if (!normalized) {
    return null;
  }
  return INBOUND_SLASH_COMMAND_SPECS.find((entry) => entry.names.includes(normalized)) ?? null;
}

export function parseInboundSlashCommand(message: string): {
  spec: InboundSlashCommandSpec;
  rawCommand: string;
  argsText: string;
} | null {
  const normalized = message.trim();
  if (!normalized.startsWith("/")) {
    return null;
  }

  const [rawCommandToken = "", ...rest] = normalized.split(/\s+/u);
  const spec = resolveInboundSlashCommandSpec(rawCommandToken);
  if (!spec) {
    return null;
  }

  return {
    spec,
    rawCommand: `/${rawCommandToken.slice(1).trim().toLowerCase()}`,
    argsText: rest.join(" ").trim(),
  };
}
