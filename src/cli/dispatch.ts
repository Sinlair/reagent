import process from "node:process";

import { consumePositionals, getBooleanFlag, serializeParsedOptions, type ParsedOptions } from "./args.js";

type CliCommandHandler = (options: ParsedOptions) => Promise<void>;

type ExternalCliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type ExternalCliRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number; inheritStdio?: boolean },
) => Promise<ExternalCliResult>;

export const OPENCLAW_COMMAND_FAMILIES = [
  "qr",
  "devices",
  "pairing",
  "acp",
  "dns",
  "exec-approvals",
  "hooks",
  "nodes",
  "sandbox",
  "secrets",
  "security",
  "tui",
  "webhooks",
] as const;

export type OpenClawCommandFamily = (typeof OPENCLAW_COMMAND_FAMILIES)[number];

export type PluginDelegateSubcommand =
  | "install"
  | "uninstall"
  | "enable"
  | "disable"
  | "update"
  | "doctor";

type CommandGroupConfig = {
  groupName: string;
  renderHelp?: (() => void) | undefined;
  recognizeHelpSubcommand?: boolean | undefined;
  defaultHandler?: CliCommandHandler | undefined;
  defaultAliases?: string[] | undefined;
  fallbackHandler?: CliCommandHandler | undefined;
  handlers: Record<string, CliCommandHandler>;
};

async function dispatchCommandGroup(options: ParsedOptions, config: CommandGroupConfig): Promise<void> {
  if (config.renderHelp && getBooleanFlag(options, "help", "h")) {
    config.renderHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined) {
    if (config.defaultHandler) {
      await config.defaultHandler(options);
      return;
    }
    if (config.renderHelp) {
      config.renderHelp();
      return;
    }
    throw new Error(`Unknown ${config.groupName} command`);
  }

  if (
    config.renderHelp &&
    config.recognizeHelpSubcommand &&
    (subcommand === "help" || subcommand === "--help" || subcommand === "-h")
  ) {
    config.renderHelp();
    return;
  }

  if (config.defaultHandler && config.defaultAliases?.includes(subcommand)) {
    await config.defaultHandler(consumePositionals(options, 1));
    return;
  }

  const directHandler = config.handlers[subcommand];
  if (directHandler) {
    await directHandler(consumePositionals(options, 1));
    return;
  }

  if (config.fallbackHandler) {
    await config.fallbackHandler(options);
    return;
  }

  throw new Error(`Unknown ${config.groupName} command: ${subcommand}`);
}

async function forwardDelegatedCliResult(
  result: ExternalCliResult,
  options: ParsedOptions,
): Promise<void> {
  if (getBooleanFlag(options, "json")) {
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `OpenClaw exited with code ${result.exitCode}`);
    }
    process.stdout.write(result.stdout);
    return;
  }

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `OpenClaw exited with code ${result.exitCode}`);
  }
}

export async function delegateOpenClawCommandFamily(
  options: ParsedOptions,
  family: OpenClawCommandFamily,
  deps: {
    resolveOpenClawCliPath(options: ParsedOptions): Promise<string>;
    runExternalCli: ExternalCliRunner;
  },
): Promise<void> {
  const cliPath = await deps.resolveOpenClawCliPath(options);
  const delegatedArgs = [
    family,
    ...serializeParsedOptions(options, [
      "openclaw-cli",
      "workspace",
      "workspace-dir",
      "db-url",
      "database-url",
      "host",
      "port",
    ]),
  ];
  const result = await deps.runExternalCli(cliPath, delegatedArgs, {
    timeoutMs: 120_000,
    inheritStdio: !getBooleanFlag(options, "json"),
  });

  await forwardDelegatedCliResult(result, options);
}

export async function dispatchPluginsCommand(
  options: ParsedOptions,
  deps: {
    renderPluginsHelp(): void;
    pluginsListCommand(options: ParsedOptions): Promise<void>;
    pluginsInspectCommand(options: ParsedOptions): Promise<void>;
    pluginsMarketplaceListCommand(options: ParsedOptions): Promise<void>;
    renderPluginsMarketplaceHelp(): void;
    delegatePluginCommand(options: ParsedOptions, subcommand: PluginDelegateSubcommand): Promise<void>;
  },
): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    deps.renderPluginsHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "list") {
    await deps.pluginsListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    deps.renderPluginsHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "inspect" || subcommand === "info") {
    await deps.pluginsInspectCommand(subOptions);
    return;
  }
  if (subcommand === "marketplace") {
    const marketplaceCommand = subOptions.positionals[0];
    if (marketplaceCommand === undefined || marketplaceCommand === "list") {
      await deps.pluginsMarketplaceListCommand(
        marketplaceCommand === undefined ? subOptions : consumePositionals(subOptions, 1),
      );
      return;
    }
    if (marketplaceCommand === "help" || marketplaceCommand === "--help" || marketplaceCommand === "-h") {
      deps.renderPluginsMarketplaceHelp();
      return;
    }
    throw new Error(`Unknown plugins marketplace command: ${marketplaceCommand}`);
  }

  const delegatedSubcommands = new Set<PluginDelegateSubcommand>([
    "install",
    "uninstall",
    "enable",
    "disable",
    "update",
    "doctor",
  ]);

  if (delegatedSubcommands.has(subcommand as PluginDelegateSubcommand)) {
    await deps.delegatePluginCommand(subOptions, subcommand as PluginDelegateSubcommand);
    return;
  }

  throw new Error(`Unknown plugins command: ${subcommand}`);
}

export async function dispatchChannelsAgentCommand(
  options: ParsedOptions,
  deps: {
    renderChannelsAgentHelp(): void;
    channelsAgentSessionsCommand: CliCommandHandler;
    channelsAgentSessionCommand: CliCommandHandler;
    channelsAgentRoleCommand: CliCommandHandler;
    channelsAgentSkillsCommand: CliCommandHandler;
    channelsAgentModelCommand: CliCommandHandler;
    channelsAgentFallbacksCommand: CliCommandHandler;
    channelsAgentReasoningCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "channels agent",
    renderHelp: deps.renderChannelsAgentHelp,
    recognizeHelpSubcommand: true,
    defaultHandler: deps.channelsAgentSessionsCommand,
    defaultAliases: ["sessions"],
    handlers: {
      session: deps.channelsAgentSessionCommand,
      show: deps.channelsAgentSessionCommand,
      status: deps.channelsAgentSessionCommand,
      role: deps.channelsAgentRoleCommand,
      skills: deps.channelsAgentSkillsCommand,
      model: deps.channelsAgentModelCommand,
      fallbacks: deps.channelsAgentFallbacksCommand,
      reasoning: deps.channelsAgentReasoningCommand,
    },
  });
}

export async function dispatchChannelsCommand(
  options: ParsedOptions,
  deps: {
    renderChannelsHelp(): void;
    channelsStatusCommand: CliCommandHandler;
    channelsLogsCommand: CliCommandHandler;
    channelsMessagesCommand: CliCommandHandler;
    channelsChatCommand: CliCommandHandler;
    channelsInboundCommand: CliCommandHandler;
    channelsPushCommand: CliCommandHandler;
    channelsSessionsCommand: CliCommandHandler;
    channelsAgentCommand: CliCommandHandler;
    channelsLoginCommand: CliCommandHandler;
    channelsWaitCommand: CliCommandHandler;
    channelsLogoutCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "channels",
    renderHelp: deps.renderChannelsHelp,
    recognizeHelpSubcommand: true,
    defaultHandler: deps.channelsStatusCommand,
    defaultAliases: ["status"],
    handlers: {
      list: deps.channelsStatusCommand,
      logs: deps.channelsLogsCommand,
      messages: deps.channelsMessagesCommand,
      chat: deps.channelsChatCommand,
      inbound: deps.channelsInboundCommand,
      push: deps.channelsPushCommand,
      send: deps.channelsPushCommand,
      sessions: deps.channelsSessionsCommand,
      agent: deps.channelsAgentCommand,
      login: deps.channelsLoginCommand,
      wait: deps.channelsWaitCommand,
      logout: deps.channelsLogoutCommand,
    },
  });
}

export async function dispatchAgentHostCommand(
  options: ParsedOptions,
  deps: {
    renderAgentHostHelp(): void;
    agentHostSessionsCommand: CliCommandHandler;
    agentHostHistoryCommand: CliCommandHandler;
    agentHostWatchCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "agent host",
    renderHelp: deps.renderAgentHostHelp,
    recognizeHelpSubcommand: true,
    defaultHandler: deps.agentHostSessionsCommand,
    defaultAliases: ["sessions"],
    handlers: {
      history: deps.agentHostHistoryCommand,
      watch: deps.agentHostWatchCommand,
    },
  });
}

export async function dispatchAgentCommand(
  options: ParsedOptions,
  deps: {
    renderAgentHelp(): void;
    agentRuntimeCommand: CliCommandHandler;
    agentSessionsCommand: CliCommandHandler;
    agentSessionCommand: CliCommandHandler;
    agentProfileCommand: CliCommandHandler;
    agentCognitionCommand: CliCommandHandler;
    agentHistoryCommand: CliCommandHandler;
    agentHooksCommand: CliCommandHandler;
    agentRoleCommand: CliCommandHandler;
    agentSkillsCommand: CliCommandHandler;
    agentModelCommand: CliCommandHandler;
    agentFallbacksCommand: CliCommandHandler;
    agentReasoningCommand: CliCommandHandler;
    agentHostCommand: CliCommandHandler;
    agentDelegatesCommand: CliCommandHandler;
    agentDelegateCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "agent",
    renderHelp: deps.renderAgentHelp,
    recognizeHelpSubcommand: true,
    defaultHandler: deps.agentRuntimeCommand,
    defaultAliases: ["runtime"],
    handlers: {
      sessions: deps.agentSessionsCommand,
      session: deps.agentSessionCommand,
      profile: deps.agentProfileCommand,
      cognition: deps.agentCognitionCommand,
      history: deps.agentHistoryCommand,
      hooks: deps.agentHooksCommand,
      role: deps.agentRoleCommand,
      skills: deps.agentSkillsCommand,
      model: deps.agentModelCommand,
      fallbacks: deps.agentFallbacksCommand,
      reasoning: deps.agentReasoningCommand,
      host: deps.agentHostCommand,
      delegates: deps.agentDelegatesCommand,
      delegations: deps.agentDelegatesCommand,
      delegate: deps.agentDelegateCommand,
    },
  });
}

export async function dispatchResearchDirectionCommand(
  options: ParsedOptions,
  deps: {
    renderResearchHelp(): void;
    researchDirectionGetCommand: CliCommandHandler;
    researchDirectionUpsertCommand: CliCommandHandler;
    researchDirectionBriefCommand: CliCommandHandler;
    researchDirectionPlanCommand: CliCommandHandler;
    researchDirectionImportBriefCommand: CliCommandHandler;
    researchDirectionDeleteCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research direction",
    renderHelp: deps.renderResearchHelp,
    recognizeHelpSubcommand: true,
    fallbackHandler: deps.researchDirectionGetCommand,
    handlers: {
      upsert: deps.researchDirectionUpsertCommand,
      brief: deps.researchDirectionBriefCommand,
      plan: deps.researchDirectionPlanCommand,
      "import-brief": deps.researchDirectionImportBriefCommand,
      delete: deps.researchDirectionDeleteCommand,
      remove: deps.researchDirectionDeleteCommand,
      rm: deps.researchDirectionDeleteCommand,
    },
  });
}

export async function dispatchResearchDiscoveryCommand(
  options: ParsedOptions,
  deps: {
    renderResearchHelp(): void;
    researchDiscoveryRecentCommand: CliCommandHandler;
    researchDiscoveryPlanCommand: CliCommandHandler;
    researchDiscoveryInspectCommand: CliCommandHandler;
    researchDiscoveryRunCommand: CliCommandHandler;
    researchDiscoverySchedulerCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research discovery",
    renderHelp: deps.renderResearchHelp,
    recognizeHelpSubcommand: true,
    defaultHandler: deps.researchDiscoveryRecentCommand,
    defaultAliases: ["recent"],
    handlers: {
      plan: deps.researchDiscoveryPlanCommand,
      inspect: deps.researchDiscoveryInspectCommand,
      get: deps.researchDiscoveryInspectCommand,
      run: deps.researchDiscoveryRunCommand,
      scheduler: deps.researchDiscoverySchedulerCommand,
    },
  });
}

export async function dispatchResearchFeedbackCommand(
  options: ParsedOptions,
  deps: {
    renderResearchHelp(): void;
    researchFeedbackListCommand: CliCommandHandler;
    researchFeedbackRecordCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research feedback",
    renderHelp: deps.renderResearchHelp,
    defaultHandler: deps.researchFeedbackListCommand,
    defaultAliases: ["list"],
    handlers: {
      record: deps.researchFeedbackRecordCommand,
    },
  });
}

export async function dispatchResearchGraphCommand(
  options: ParsedOptions,
  deps: {
    renderResearchHelp(): void;
    researchGraphShowCommand: CliCommandHandler;
    researchGraphNodeCommand: CliCommandHandler;
    researchGraphPathCommand: CliCommandHandler;
    researchGraphExplainCommand: CliCommandHandler;
    researchGraphReportCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research graph",
    renderHelp: deps.renderResearchHelp,
    defaultHandler: deps.researchGraphShowCommand,
    defaultAliases: ["show"],
    handlers: {
      node: deps.researchGraphNodeCommand,
      path: deps.researchGraphPathCommand,
      explain: deps.researchGraphExplainCommand,
      report: deps.researchGraphReportCommand,
    },
  });
}

export async function dispatchResearchDirectionReportCommand(
  options: ParsedOptions,
  deps: {
    researchDirectionReportGetCommand: CliCommandHandler;
    researchDirectionReportGenerateCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research direction-report",
    defaultHandler: deps.researchDirectionReportGetCommand,
    fallbackHandler: deps.researchDirectionReportGetCommand,
    handlers: {
      generate: deps.researchDirectionReportGenerateCommand,
    },
  });
}

export async function dispatchResearchCandidateCommand(
  options: ParsedOptions,
  deps: {
    researchCandidateGetCommand: CliCommandHandler;
    researchCandidateGenerateCommand: CliCommandHandler;
    researchCandidateReviewCommand: CliCommandHandler;
    researchCandidateApproveCommand: CliCommandHandler;
    researchCandidateRejectCommand: CliCommandHandler;
    researchCandidateApplyCommand: CliCommandHandler;
    researchCandidateRollbackCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research candidate",
    defaultHandler: deps.researchCandidateGetCommand,
    fallbackHandler: deps.researchCandidateGetCommand,
    handlers: {
      generate: deps.researchCandidateGenerateCommand,
      review: deps.researchCandidateReviewCommand,
      approve: deps.researchCandidateApproveCommand,
      reject: deps.researchCandidateRejectCommand,
      apply: deps.researchCandidateApplyCommand,
      rollback: deps.researchCandidateRollbackCommand,
    },
  });
}

export async function dispatchResearchCommand(
  options: ParsedOptions,
  deps: {
    renderResearchHelp(): void;
    researchRecentCommand: CliCommandHandler;
    researchRunCommand: CliCommandHandler;
    researchEnqueueCommand: CliCommandHandler;
    researchTasksCommand: CliCommandHandler;
    researchTaskCommand: CliCommandHandler;
    researchReportCommand: CliCommandHandler;
    researchRetryCommand: CliCommandHandler;
    researchHandoffCommand: CliCommandHandler;
    researchWorkstreamCommand: CliCommandHandler;
    researchDirectionsCommand: CliCommandHandler;
    researchDirectionCommand: CliCommandHandler;
    researchDiscoveryCommand: CliCommandHandler;
    researchFeedbackCommand: CliCommandHandler;
    researchGraphCommand: CliCommandHandler;
    researchArtifactCommand: CliCommandHandler;
    researchBundleCommand: CliCommandHandler;
    researchSourceCommand: CliCommandHandler;
    researchPaperReportCommand: CliCommandHandler;
    researchRepoReportCommand: CliCommandHandler;
    researchModuleAssetsCommand: CliCommandHandler;
    researchModuleAssetCommand: CliCommandHandler;
    researchPresentationsCommand: CliCommandHandler;
    researchPresentationCommand: CliCommandHandler;
    researchDirectionReportsCommand: CliCommandHandler;
    researchDirectionReportCommand: CliCommandHandler;
    researchCandidatesCommand: CliCommandHandler;
    researchCandidateCommand: CliCommandHandler;
  },
): Promise<void> {
  await dispatchCommandGroup(options, {
    groupName: "research",
    renderHelp: deps.renderResearchHelp,
    recognizeHelpSubcommand: true,
    defaultHandler: deps.researchRecentCommand,
    defaultAliases: ["recent"],
    handlers: {
      run: deps.researchRunCommand,
      enqueue: deps.researchEnqueueCommand,
      tasks: deps.researchTasksCommand,
      task: deps.researchTaskCommand,
      report: deps.researchReportCommand,
      retry: deps.researchRetryCommand,
      handoff: deps.researchHandoffCommand,
      workstream: deps.researchWorkstreamCommand,
      directions: deps.researchDirectionsCommand,
      direction: deps.researchDirectionCommand,
      discovery: deps.researchDiscoveryCommand,
      feedback: deps.researchFeedbackCommand,
      graph: deps.researchGraphCommand,
      artifact: deps.researchArtifactCommand,
      bundle: deps.researchBundleCommand,
      source: deps.researchSourceCommand,
      "paper-report": deps.researchPaperReportCommand,
      "repo-report": deps.researchRepoReportCommand,
      "module-assets": deps.researchModuleAssetsCommand,
      "module-asset": deps.researchModuleAssetCommand,
      presentations: deps.researchPresentationsCommand,
      presentation: deps.researchPresentationCommand,
      "direction-reports": deps.researchDirectionReportsCommand,
      "direction-report": deps.researchDirectionReportCommand,
      candidates: deps.researchCandidatesCommand,
      candidate: deps.researchCandidateCommand,
    },
  });
}
