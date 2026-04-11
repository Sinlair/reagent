import path from "node:path";
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";

import {
  consumePositionals,
  getBooleanFlag,
  prefixConfigPath,
  prependPositionals,
  type ParsedOptions,
} from "./args.js";

type ManagedConfigAliasLike = "llm" | "mcp" | "skills" | "commands";

type WorkspaceConfigFileLike = {
  path: string;
};

type WorkspaceConfigGetValueResultLike = {
  alias: ManagedConfigAliasLike;
  file: WorkspaceConfigFileLike;
  value: unknown;
};

type WorkspaceConfigSetValueResultLike = {
  file: WorkspaceConfigFileLike;
  previousValue: unknown;
  nextValue: unknown;
};

type WorkspaceConfigUnsetValueResultLike = {
  file: WorkspaceConfigFileLike;
  previousValue: unknown;
};

type WorkspaceConfigReplaceResultLike = {
  file: WorkspaceConfigFileLike;
};

type WorkspaceConfigServiceLike = {
  getFile(alias: ManagedConfigAliasLike): Promise<WorkspaceConfigFileLike>;
  listFiles(): Promise<any[]>;
  getValue(keyPath: string): Promise<WorkspaceConfigGetValueResultLike>;
  setValue(
    keyPath: string,
    value: unknown,
    options: { dryRun: boolean },
  ): Promise<WorkspaceConfigSetValueResultLike>;
  unsetValue(keyPath: string, options: { dryRun: boolean }): Promise<WorkspaceConfigUnsetValueResultLike>;
  readConfig(alias: ManagedConfigAliasLike): Promise<unknown>;
  replaceConfig(
    alias: ManagedConfigAliasLike,
    config: unknown,
    options: { dryRun: boolean },
  ): Promise<WorkspaceConfigReplaceResultLike>;
  readRawConfig(alias: ManagedConfigAliasLike): Promise<string>;
  validate(): Promise<any>;
  buildSchema(): Promise<unknown>;
};

export interface WorkspaceControlCliDeps {
  resolveWorkspaceConfigService(options: ParsedOptions): Promise<WorkspaceConfigServiceLike>;
  resolveWorkspaceDir(options: ParsedOptions): Promise<string>;
  resolveConfigAlias(input: string | undefined): ManagedConfigAliasLike;
  resolveEditorCommand(options: ParsedOptions): string;
  runEditorCommand(editorCommand: string, targetPath: string): Promise<void>;
  readStdinText(): Promise<string>;
  printJson(value: unknown): void;
  printManagedConfigFiles(files: any[]): void;
  printConfigValue(value: unknown): void;
  printConfigValidationReport(report: any): void;
  printLlmSummary(summary: any, workspaceDir: string): void;
  printMcpServerStatuses(servers: any[], workspaceDir: string): void;
  printSkillStatusReport(report: any): void;
  printInboundCommandRegistry(workspaceDir: string, commands: any[]): void;
  printInboundCommandAuthorization(payload: any): void;
  formatYesNo(value: boolean): string;
  renderConfigHelp(): void;
  renderModelsHelp(): void;
  renderMcpHelp(): void;
  renderSkillsHelp(): void;
  renderCommandsHelp(): void;
}

export function createWorkspaceControlCli(deps: WorkspaceControlCliDeps) {
  async function configFileCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const alias = options.positionals[0] as ManagedConfigAliasLike | undefined;
    if (alias && !["llm", "mcp", "skills", "commands"].includes(alias)) {
      throw new Error(`Unsupported config namespace: ${alias}. Use llm, mcp, skills, or commands.`);
    }

    if (alias) {
      const file = await service.getFile(alias);
      if (getBooleanFlag(options, "json")) {
        deps.printJson(file);
        return;
      }
      deps.printManagedConfigFiles([file]);
      return;
    }

    const files = await service.listFiles();
    if (getBooleanFlag(options, "json")) {
      deps.printJson({ files });
      return;
    }
    deps.printManagedConfigFiles(files);
  }

  async function configGetCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const keyPath = options.positionals.join(" ").trim();
    if (!keyPath) {
      throw new Error("config get requires a path. Example: reagent config get llm.providers[0].enabled");
    }

    const result = await service.getValue(keyPath);
    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        ...result,
        found: result.value !== undefined,
        ...(result.value === undefined ? { value: null } : { value: result.value }),
      });
      return;
    }

    console.log(`${result.alias}: ${result.file.path}`);
    console.log("");
    deps.printConfigValue(result.value);
  }

  async function configSetCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const keyPath = options.positionals[0]?.trim();
    if (!keyPath) {
      throw new Error("config set requires a path.");
    }

    const rawValue = options.positionals.slice(1).join(" ").trim();
    if (!rawValue) {
      throw new Error("config set requires a value.");
    }

    let value: unknown;
    if (getBooleanFlag(options, "strict-json")) {
      value = JSON.parse(rawValue);
    } else {
      const module = await import("../services/workspaceConfigService.js");
      value = module.coerceConfigValue(rawValue);
    }

    const result = await service.setValue(keyPath, value, {
      dryRun: getBooleanFlag(options, "dry-run"),
    });
    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    console.log(`${getBooleanFlag(options, "dry-run") ? "Previewed" : "Updated"} ${keyPath}`);
    console.log(`File: ${result.file.path}`);
    console.log("Previous:");
    deps.printConfigValue(result.previousValue);
    console.log("Next:");
    deps.printConfigValue(result.nextValue);
  }

  async function configUnsetCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const keyPath = options.positionals.join(" ").trim();
    if (!keyPath) {
      throw new Error("config unset requires a path.");
    }

    const result = await service.unsetValue(keyPath, {
      dryRun: getBooleanFlag(options, "dry-run"),
    });
    if (getBooleanFlag(options, "json")) {
      deps.printJson(result);
      return;
    }

    console.log(`${getBooleanFlag(options, "dry-run") ? "Previewed" : "Unset"} ${keyPath}`);
    console.log(`File: ${result.file.path}`);
    console.log("Previous:");
    deps.printConfigValue(result.previousValue);
  }

  async function configExportCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const aliasRaw = options.positionals[0];
    const outPath = options.flags.get("out");

    if (aliasRaw) {
      const alias = deps.resolveConfigAlias(aliasRaw);
      const config = await service.readConfig(alias);
      const rendered = `${JSON.stringify(config, null, 2)}\n`;
      if (typeof outPath === "string" && outPath.trim()) {
        const resolvedOutPath = path.resolve(process.cwd(), outPath);
        await writeFile(resolvedOutPath, rendered, "utf8");
        if (!getBooleanFlag(options, "json")) {
          console.log(`Exported ${alias} config to ${resolvedOutPath}`);
        } else {
          deps.printJson({ alias, outPath: resolvedOutPath });
        }
        return;
      }
      process.stdout.write(rendered);
      return;
    }

    const bundle = {
      llm: await service.readConfig("llm"),
      mcp: await service.readConfig("mcp"),
      skills: await service.readConfig("skills"),
      commands: await service.readConfig("commands"),
    };
    const rendered = `${JSON.stringify(bundle, null, 2)}\n`;
    if (typeof outPath === "string" && outPath.trim()) {
      const resolvedOutPath = path.resolve(process.cwd(), outPath);
      await writeFile(resolvedOutPath, rendered, "utf8");
      if (!getBooleanFlag(options, "json")) {
        console.log(`Exported managed config bundle to ${resolvedOutPath}`);
      } else {
        deps.printJson({ outPath: resolvedOutPath });
      }
      return;
    }
    process.stdout.write(rendered);
  }

  async function configImportCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const alias = deps.resolveConfigAlias(options.positionals[0]);
    const source = options.positionals[1]?.trim();
    if (!source) {
      throw new Error("config import requires a source file path or '-' for stdin.");
    }

    const raw = source === "-" ? await deps.readStdinText() : await readFile(path.resolve(process.cwd(), source), "utf8");
    const parsed = raw.trim() ? (JSON.parse(raw) as unknown) : {};
    const result = await service.replaceConfig(alias, parsed, {
      dryRun: getBooleanFlag(options, "dry-run"),
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson({ ...result, source });
      return;
    }

    console.log(`${getBooleanFlag(options, "dry-run") ? "Previewed" : "Imported"} ${alias} config from ${source}`);
    console.log(`File: ${result.file.path}`);
  }

  async function configEditCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const alias = deps.resolveConfigAlias(options.positionals[0]);
    const file = await service.getFile(alias);
    const editor = deps.resolveEditorCommand(options);
    const before = await service.readRawConfig(alias);

    await deps.runEditorCommand(editor, file.path);

    let afterRaw: string;
    try {
      afterRaw = await service.readRawConfig(alias);
      JSON.parse(afterRaw);
    } catch (error) {
      await writeFile(file.path, before, "utf8");
      throw new Error(
        `Edited config is not valid JSON and was reverted: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        alias,
        path: file.path,
        editor,
        changed: before !== afterRaw,
      });
      return;
    }

    console.log(`Edited ${alias} config with ${editor}`);
    console.log(`Path: ${file.path}`);
    console.log(`Changed: ${deps.formatYesNo(before !== afterRaw)}`);
  }

  async function configValidateCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const report = await service.validate();
    if (getBooleanFlag(options, "json")) {
      deps.printJson(report);
      return;
    }
    deps.printConfigValidationReport(report);
  }

  async function configSchemaCommand(options: ParsedOptions): Promise<void> {
    const service = await deps.resolveWorkspaceConfigService(options);
    const schema = await service.buildSchema();
    deps.printJson(schema);
  }

  async function configCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderConfigHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "file") {
      await configFileCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderConfigHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);

    if (subcommand === "get") {
      await configGetCommand(subOptions);
      return;
    }
    if (subcommand === "set") {
      await configSetCommand(subOptions);
      return;
    }
    if (subcommand === "unset") {
      await configUnsetCommand(subOptions);
      return;
    }
    if (subcommand === "export") {
      await configExportCommand(subOptions);
      return;
    }
    if (subcommand === "import") {
      await configImportCommand(subOptions);
      return;
    }
    if (subcommand === "edit") {
      await configEditCommand(subOptions);
      return;
    }
    if (subcommand === "validate") {
      await configValidateCommand(subOptions);
      return;
    }
    if (subcommand === "schema") {
      await configSchemaCommand(subOptions);
      return;
    }

    throw new Error(`Unknown config command: ${subcommand}`);
  }

  async function modelsListCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const { LlmRegistryService } = await import("../services/llmRegistryService.js");
    const registry = new LlmRegistryService(workspaceDir);
    const summary = await registry.getSummary();
    const payload = {
      workspaceDir,
      ...summary,
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printLlmSummary(summary, workspaceDir);
  }

  async function modelsRoutesCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const { LlmRegistryService } = await import("../services/llmRegistryService.js");
    const registry = new LlmRegistryService(workspaceDir);
    const summary = await registry.getSummary();
    const payload = {
      workspaceDir,
      defaults: summary.defaults,
      routes: summary.routes,
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printLlmSummary(
      {
        defaults: summary.defaults,
        routes: summary.routes,
        providers: [],
      },
      workspaceDir,
    );
  }

  async function modelsCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderModelsHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "list" || subcommand === "status") {
      await modelsListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderModelsHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);
    if (subcommand === "routes" || subcommand === "route") {
      await modelsRoutesCommand(subOptions);
      return;
    }
    if (subcommand === "file") {
      await configFileCommand(prependPositionals(subOptions, ["llm"]));
      return;
    }
    if (subcommand === "get") {
      await configGetCommand(prefixConfigPath(subOptions, "llm"));
      return;
    }
    if (subcommand === "set") {
      await configSetCommand(prefixConfigPath(subOptions, "llm"));
      return;
    }
    if (subcommand === "unset") {
      await configUnsetCommand(prefixConfigPath(subOptions, "llm"));
      return;
    }
    if (subcommand === "export") {
      await configExportCommand(prependPositionals(subOptions, ["llm"]));
      return;
    }
    if (subcommand === "import") {
      await configImportCommand(prependPositionals(subOptions, ["llm"]));
      return;
    }
    if (subcommand === "edit") {
      await configEditCommand(prependPositionals(subOptions, ["llm"]));
      return;
    }

    throw new Error(`Unknown models command: ${subcommand}`);
  }

  async function mcpListCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const { McpRegistryService } = await import("../services/mcpRegistryService.js");
    const registry = new McpRegistryService(workspaceDir);
    const servers = await registry.listServers();
    const payload = {
      workspaceDir,
      servers,
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printMcpServerStatuses(servers, workspaceDir);
  }

  async function mcpCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderMcpHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "list" || subcommand === "status") {
      await mcpListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderMcpHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);
    if (subcommand === "file") {
      await configFileCommand(prependPositionals(subOptions, ["mcp"]));
      return;
    }
    if (subcommand === "get") {
      await configGetCommand(prefixConfigPath(subOptions, "mcp"));
      return;
    }
    if (subcommand === "set") {
      await configSetCommand(prefixConfigPath(subOptions, "mcp"));
      return;
    }
    if (subcommand === "unset") {
      await configUnsetCommand(prefixConfigPath(subOptions, "mcp"));
      return;
    }
    if (subcommand === "export") {
      await configExportCommand(prependPositionals(subOptions, ["mcp"]));
      return;
    }
    if (subcommand === "import") {
      await configImportCommand(prependPositionals(subOptions, ["mcp"]));
      return;
    }
    if (subcommand === "edit") {
      await configEditCommand(prependPositionals(subOptions, ["mcp"]));
      return;
    }

    throw new Error(`Unknown mcp command: ${subcommand}`);
  }

  async function skillsListCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const { SkillRegistryService } = await import("../services/skillRegistryService.js");
    const registry = new SkillRegistryService(workspaceDir);
    const report = await registry.buildStatusReport();

    if (getBooleanFlag(options, "json")) {
      deps.printJson(report);
      return;
    }

    deps.printSkillStatusReport(report);
  }

  async function skillsCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderSkillsHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "list" || subcommand === "status") {
      await skillsListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderSkillsHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);
    if (subcommand === "file") {
      await configFileCommand(prependPositionals(subOptions, ["skills"]));
      return;
    }
    if (subcommand === "get") {
      await configGetCommand(prefixConfigPath(subOptions, "skills"));
      return;
    }
    if (subcommand === "set") {
      await configSetCommand(prefixConfigPath(subOptions, "skills"));
      return;
    }
    if (subcommand === "unset") {
      await configUnsetCommand(prefixConfigPath(subOptions, "skills"));
      return;
    }
    if (subcommand === "export") {
      await configExportCommand(prependPositionals(subOptions, ["skills"]));
      return;
    }
    if (subcommand === "import") {
      await configImportCommand(prependPositionals(subOptions, ["skills"]));
      return;
    }
    if (subcommand === "edit") {
      await configEditCommand(prependPositionals(subOptions, ["skills"]));
      return;
    }

    throw new Error(`Unknown skills command: ${subcommand}`);
  }

  async function commandsListCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const [{ INBOUND_SLASH_COMMAND_SPECS, resolveAllowedSourcesForInboundCommand, formatInboundCommandUsage }, { InboundCommandPolicyService }] =
      await Promise.all([
        import("../services/inboundCommandRegistry.js"),
        import("../services/inboundCommandPolicyService.js"),
      ]);
    const policyService = new InboundCommandPolicyService(workspaceDir);
    const policy = await policyService.getPolicy();
    const commands = INBOUND_SLASH_COMMAND_SPECS.map((spec) => ({
      id: spec.id,
      names: spec.names,
      usage: formatInboundCommandUsage(spec),
      tier: spec.tier,
      allowedSources: resolveAllowedSourcesForInboundCommand(spec),
      requiresAgentControls: spec.requiresAgentControls === true,
    }));
    const payload = {
      workspaceDir,
      policy,
      commands,
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printInboundCommandRegistry(workspaceDir, commands);
  }

  async function commandsPolicyCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const { InboundCommandPolicyService } = await import("../services/inboundCommandPolicyService.js");
    const service = new InboundCommandPolicyService(workspaceDir);
    const payload = {
      workspaceDir,
      path: service.getPolicyPath(),
      policy: await service.getPolicy(),
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    console.log(`Workspace: ${workspaceDir}`);
    console.log(`Path: ${payload.path}`);
    deps.printJson(payload.policy);
  }

  async function commandsAuthorizeCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const source = options.positionals[0]?.trim() || "";
    const senderId = options.positionals[1]?.trim() || "";
    const commandInput = options.positionals.slice(2).join(" ").trim();

    if (!["ui", "wechat", "openclaw"].includes(source)) {
      throw new Error("commands authorize requires a source: ui, wechat, or openclaw.");
    }
    if (!senderId) {
      throw new Error("commands authorize requires a senderId.");
    }
    if (!commandInput) {
      throw new Error("commands authorize requires a command, for example /remember or remember.");
    }

    const [{ resolveInboundSlashCommandSpec, resolveAllowedSourcesForInboundCommand }, { InboundCommandPolicyService }] =
      await Promise.all([
        import("../services/inboundCommandRegistry.js"),
        import("../services/inboundCommandPolicyService.js"),
      ]);
    const service = new InboundCommandPolicyService(workspaceDir);
    const spec = resolveInboundSlashCommandSpec(commandInput);

    if (!spec) {
      const payload = {
        workspaceDir,
        source,
        senderId,
        command: commandInput,
        allowed: false,
        reason: "unknown-command",
      };
      if (getBooleanFlag(options, "json")) {
        deps.printJson(payload);
        return;
      }
      deps.printInboundCommandAuthorization(payload);
      return;
    }

    const allowedSources = resolveAllowedSourcesForInboundCommand(spec);
    const sourceAllowed = allowedSources.includes(source as "ui" | "wechat" | "openclaw");
    const remoteTier =
      source === "ui"
        ? null
        : spec.tier === "workspace-mutation" || spec.tier === "session-control"
          ? spec.tier
          : null;
    const policyDecision = remoteTier ? await service.authorizeRemoteTier(remoteTier, senderId) : null;
    const allowed = sourceAllowed && (policyDecision ? policyDecision.allowed : true);
    const reason = !sourceAllowed
      ? "source-blocked"
      : policyDecision && !policyDecision.allowed
        ? "sender-not-allowlisted"
        : remoteTier
          ? `allowed-by-${policyDecision?.policy.mode ?? "allow"}`
          : spec.tier === "maintenance"
            ? "local-only-command"
            : "allowed";

    const payload = {
      workspaceDir,
      source,
      senderId,
      command: commandInput,
      allowed,
      reason,
      spec: {
        usage: spec.usage,
        tier: spec.tier,
        allowedSources,
        requiresAgentControls: spec.requiresAgentControls === true,
      },
      ...(policyDecision
        ? {
            policy: {
              mode: policyDecision.policy.mode,
              senderIds: policyDecision.policy.senderIds,
            },
          }
        : {}),
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    deps.printInboundCommandAuthorization(payload);
  }

  async function commandsCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderCommandsHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "list") {
      await commandsListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderCommandsHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);
    if (subcommand === "policy" || subcommand === "show") {
      await commandsPolicyCommand(subOptions);
      return;
    }
    if (subcommand === "authorize" || subcommand === "explain") {
      await commandsAuthorizeCommand(subOptions);
      return;
    }
    if (subcommand === "file") {
      await configFileCommand(prependPositionals(subOptions, ["commands"]));
      return;
    }
    if (subcommand === "get") {
      await configGetCommand(prefixConfigPath(subOptions, "commands"));
      return;
    }
    if (subcommand === "set") {
      await configSetCommand(prefixConfigPath(subOptions, "commands"));
      return;
    }
    if (subcommand === "unset") {
      await configUnsetCommand(prefixConfigPath(subOptions, "commands"));
      return;
    }
    if (subcommand === "export") {
      await configExportCommand(prependPositionals(subOptions, ["commands"]));
      return;
    }
    if (subcommand === "import") {
      await configImportCommand(prependPositionals(subOptions, ["commands"]));
      return;
    }
    if (subcommand === "edit") {
      await configEditCommand(prependPositionals(subOptions, ["commands"]));
      return;
    }

    throw new Error(`Unknown commands command: ${subcommand}`);
  }

  return {
    configFileCommand,
    configGetCommand,
    configSetCommand,
    configUnsetCommand,
    configExportCommand,
    configImportCommand,
    configEditCommand,
    configValidateCommand,
    configSchemaCommand,
    configCommand,
    modelsListCommand,
    modelsRoutesCommand,
    modelsCommand,
    mcpListCommand,
    mcpCommand,
    skillsListCommand,
    skillsCommand,
    commandsListCommand,
    commandsPolicyCommand,
    commandsAuthorizeCommand,
    commandsCommand,
  };
}
