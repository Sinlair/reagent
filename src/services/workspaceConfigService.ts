import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { InboundCommandPolicyService } from "./inboundCommandPolicyService.js";
import { LlmRegistryService } from "./llmRegistryService.js";
import { McpRegistryService } from "./mcpRegistryService.js";
import { SkillRegistryService, type SkillStatusReport } from "./skillRegistryService.js";

export type ManagedConfigAlias = "llm" | "mcp" | "skills" | "commands";

type ConfigPathSegment = string | number;

export interface ManagedConfigFile {
  alias: ManagedConfigAlias;
  path: string;
  description: string;
  exists: boolean;
  size: number | null;
  updatedAt: string | null;
}

export interface ManagedConfigValue {
  alias: ManagedConfigAlias;
  file: ManagedConfigFile;
  value: unknown;
}

export interface ManagedConfigMutationResult {
  alias: ManagedConfigAlias;
  keyPath: string;
  file: ManagedConfigFile;
  previousValue: unknown;
  nextValue: unknown;
  wrote: boolean;
  config: unknown;
}

export interface ManagedConfigReplaceResult {
  alias: ManagedConfigAlias;
  file: ManagedConfigFile;
  previousConfig: unknown;
  nextConfig: unknown;
}

export interface ConfigValidationIssue {
  alias: ManagedConfigAlias;
  level: "error" | "warning";
  message: string;
}

export interface ConfigValidationReport {
  workspaceDir: string;
  files: ManagedConfigFile[];
  ok: boolean;
  issues: ConfigValidationIssue[];
  llm: Awaited<ReturnType<LlmRegistryService["getSummary"]>>;
  mcp: Awaited<ReturnType<McpRegistryService["listServers"]>>;
  skills: SkillStatusReport;
}

const SKILLS_DEFAULT_STORE = {
  entries: {},
};

type ManagedConfigDefinition = {
  alias: ManagedConfigAlias;
  path: string;
  description: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseQuotedSegment(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      if (trimmed.startsWith("\"")) {
        return JSON.parse(trimmed) as string;
      }
      return JSON.parse(`"${trimmed.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseConfigPath(input: string): { alias: ManagedConfigAlias; segments: ConfigPathSegment[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Config path cannot be empty.");
  }

  const matches = [...trimmed.matchAll(/([^[.\]]+)|\[(\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\]/gu)];
  const segments = matches
    .map((match) => {
      if (match[1]) {
        return match[1];
      }
      const bracket = match[2];
      if (!bracket) {
        return "";
      }
      if (/^\d+$/u.test(bracket)) {
        return Number.parseInt(bracket, 10);
      }
      return parseQuotedSegment(bracket);
    })
    .filter((segment) => segment !== "");

  if (segments.length === 0) {
    throw new Error(`Invalid config path: ${input}`);
  }

  const [alias, ...rest] = segments;
  if (alias !== "llm" && alias !== "mcp" && alias !== "skills" && alias !== "commands") {
    throw new Error(`Unsupported config namespace: ${String(alias)}. Use llm, mcp, skills, or commands.`);
  }

  return {
    alias,
    segments: rest,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getNestedValue(root: unknown, segments: ConfigPathSegment[]): unknown {
  let current = root;
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function setNestedValue(root: unknown, segments: ConfigPathSegment[], value: unknown): unknown {
  if (segments.length === 0) {
    return value;
  }

  const nextRoot = cloneJson(root);
  let current: unknown = nextRoot;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const nextSegment = segments[index + 1]!;

    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        throw new Error(`Cannot index into a non-array at segment ${segment}.`);
      }
      if (current[segment] === undefined) {
        current[segment] = typeof nextSegment === "number" ? [] : {};
      }
      current = current[segment];
      continue;
    }

    if (!isRecord(current)) {
      throw new Error(`Cannot assign nested property under non-object segment "${segment}".`);
    }
    if (current[segment] === undefined) {
      current[segment] = typeof nextSegment === "number" ? [] : {};
    }
    current = current[segment];
  }

  const leaf = segments.at(-1)!;
  if (typeof leaf === "number") {
    if (!Array.isArray(current)) {
      throw new Error(`Cannot assign array index ${leaf} under a non-array container.`);
    }
    current[leaf] = value;
    return nextRoot;
  }

  if (!isRecord(current)) {
    throw new Error(`Cannot assign property "${leaf}" under a non-object container.`);
  }
  current[leaf] = value;
  return nextRoot;
}

function unsetNestedValue(root: unknown, segments: ConfigPathSegment[]): { nextRoot: unknown; previousValue: unknown } {
  if (segments.length === 0) {
    throw new Error("Cannot unset the root config object.");
  }

  const nextRoot = cloneJson(root);
  let current: unknown = nextRoot;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return { nextRoot, previousValue: undefined };
      }
      current = current[segment];
      continue;
    }
    if (!isRecord(current)) {
      return { nextRoot, previousValue: undefined };
    }
    current = current[segment];
  }

  const leaf = segments.at(-1)!;
  if (typeof leaf === "number") {
    if (!Array.isArray(current)) {
      return { nextRoot, previousValue: undefined };
    }
    const previousValue = current[leaf];
    current.splice(leaf, 1);
    return { nextRoot, previousValue };
  }

  if (!isRecord(current)) {
    return { nextRoot, previousValue: undefined };
  }
  const previousValue = current[leaf];
  delete current[leaf];
  return { nextRoot, previousValue };
}

export function coerceConfigValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  if (/^(true|false|null|-?\d+(?:\.\d+)?)$/u.test(trimmed)) {
    return JSON.parse(trimmed) as unknown;
  }
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
  ) {
    return JSON.parse(trimmed) as unknown;
  }

  return raw;
}

export class WorkspaceConfigService {
  private readonly llmRegistry: LlmRegistryService;
  private readonly mcpRegistry: McpRegistryService;
  private readonly skillRegistry: SkillRegistryService;
  private readonly inboundCommandPolicyService: InboundCommandPolicyService;
  private readonly configDir: string;

  constructor(private readonly workspaceDir: string) {
    this.llmRegistry = new LlmRegistryService(workspaceDir);
    this.mcpRegistry = new McpRegistryService(workspaceDir);
    this.skillRegistry = new SkillRegistryService(workspaceDir);
    this.inboundCommandPolicyService = new InboundCommandPolicyService(workspaceDir);
    this.configDir = path.join(this.workspaceDir, "channels");
  }

  getManagedConfigDefinitions(): ManagedConfigDefinition[] {
    return [
      {
        alias: "llm",
        path: path.join(this.workspaceDir, "channels", "llm-providers.json"),
        description: "LLM provider registry and default routes.",
      },
      {
        alias: "mcp",
        path: path.join(this.workspaceDir, "channels", "mcp-servers.json"),
        description: "Remote MCP server registry for tool augmentation.",
      },
      {
        alias: "skills",
        path: path.join(this.workspaceDir, "channels", "skills-config.json"),
        description: "Workspace skill enablement and stored environment overrides.",
      },
      {
        alias: "commands",
        path: path.join(this.workspaceDir, "channels", "inbound-command-policy.json"),
        description: "Inbound slash-command policy, including remote tier allowlists.",
      },
    ];
  }

  async listFiles(): Promise<ManagedConfigFile[]> {
    const definitions = this.getManagedConfigDefinitions();
    return Promise.all(definitions.map((definition) => this.describeFile(definition)));
  }

  async getFile(alias: ManagedConfigAlias): Promise<ManagedConfigFile> {
    const definition = this.getManagedConfigDefinitions().find((entry) => entry.alias === alias);
    if (!definition) {
      throw new Error(`Unsupported config namespace: ${alias}`);
    }
    await this.ensureConfigFile(alias);
    return this.describeFile(definition);
  }

  async readConfig(alias: ManagedConfigAlias): Promise<unknown> {
    await this.ensureConfigFile(alias);
    const file = await this.getFile(alias);
    const raw = await readFile(file.path, "utf8");
    return raw.trim() ? (JSON.parse(raw) as unknown) : {};
  }

  async readRawConfig(alias: ManagedConfigAlias): Promise<string> {
    await this.ensureConfigFile(alias);
    const file = await this.getFile(alias);
    return readFile(file.path, "utf8");
  }

  async getValue(keyPath: string): Promise<ManagedConfigValue> {
    const parsed = parseConfigPath(keyPath);
    const value = getNestedValue(await this.readConfig(parsed.alias), parsed.segments);
    return {
      alias: parsed.alias,
      file: await this.getFile(parsed.alias),
      value,
    };
  }

  async setValue(keyPath: string, value: unknown, options: { dryRun?: boolean } = {}): Promise<ManagedConfigMutationResult> {
    const parsed = parseConfigPath(keyPath);
    const config = await this.readConfig(parsed.alias);
    const previousValue = getNestedValue(config, parsed.segments);
    const nextConfig = setNestedValue(config, parsed.segments, value);
    if (!options.dryRun) {
      await this.writeConfig(parsed.alias, nextConfig);
    }
    return {
      alias: parsed.alias,
      keyPath,
      file: await this.getFile(parsed.alias),
      previousValue,
      nextValue: value,
      wrote: !options.dryRun,
      config: nextConfig,
    };
  }

  async unsetValue(keyPath: string, options: { dryRun?: boolean } = {}): Promise<ManagedConfigMutationResult> {
    const parsed = parseConfigPath(keyPath);
    const config = await this.readConfig(parsed.alias);
    const result = unsetNestedValue(config, parsed.segments);
    if (!options.dryRun) {
      await this.writeConfig(parsed.alias, result.nextRoot);
    }
    return {
      alias: parsed.alias,
      keyPath,
      file: await this.getFile(parsed.alias),
      previousValue: result.previousValue,
      nextValue: undefined,
      wrote: !options.dryRun,
      config: result.nextRoot,
    };
  }

  async replaceConfig(
    alias: ManagedConfigAlias,
    nextConfig: unknown,
    options: { dryRun?: boolean } = {},
  ): Promise<ManagedConfigReplaceResult> {
    const previousConfig = await this.readConfig(alias);
    if (!options.dryRun) {
      await this.writeConfig(alias, nextConfig);
    }
    return {
      alias,
      file: await this.getFile(alias),
      previousConfig,
      nextConfig,
    };
  }

  async buildSchema(): Promise<Record<string, unknown>> {
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "ReAgent Managed Workspace Config",
      type: "object",
      additionalProperties: false,
      properties: {
        llm: {
          type: "object",
          description: "Stored in workspace/channels/llm-providers.json",
          properties: {
            defaults: {
              type: "object",
              properties: {
                agent: {
                  type: "object",
                  properties: {
                    providerId: { type: "string" },
                    modelId: { type: "string" },
                  },
                  additionalProperties: false,
                },
                research: {
                  type: "object",
                  properties: {
                    providerId: { type: "string" },
                    modelId: { type: "string" },
                  },
                  additionalProperties: false,
                },
              },
              additionalProperties: false,
            },
            providers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  type: { enum: ["fallback", "openai"] },
                  enabled: { type: "boolean" },
                  baseUrl: { type: "string" },
                  apiKeyEnv: { type: "string" },
                  wireApi: { enum: ["responses", "chat-completions"] },
                  models: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        label: { type: "string" },
                        enabled: { type: "boolean" },
                        wireApi: { enum: ["responses", "chat-completions"] },
                        baseUrl: { type: "string" },
                        apiKeyEnv: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        mcp: {
          type: "object",
          description: "Stored in workspace/channels/mcp-servers.json",
          properties: {
            servers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  serverLabel: { type: "string" },
                  description: { type: "string" },
                  serverUrl: { type: "string" },
                  connectorId: { type: "string" },
                  authorizationEnv: { type: "string" },
                  requireApproval: { enum: ["always", "never"] },
                  allowedTools: {
                    type: "array",
                    items: { type: "string" },
                  },
                  enabled: { type: "boolean" },
                },
              },
            },
          },
        },
        skills: {
          type: "object",
          description: "Stored in workspace/channels/skills-config.json",
          properties: {
            entries: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  apiKey: { type: "string" },
                  env: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
              },
            },
          },
        },
        commands: {
          type: "object",
          description: "Stored in workspace/channels/inbound-command-policy.json",
          properties: {
            remote: {
              type: "object",
              properties: {
                "workspace-mutation": {
                  type: "object",
                  properties: {
                    mode: { enum: ["allow", "allowlist"] },
                    senderIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
                "session-control": {
                  type: "object",
                  properties: {
                    mode: { enum: ["allow", "allowlist"] },
                    senderIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  additionalProperties: false,
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
    };
  }

  async validate(): Promise<ConfigValidationReport> {
    await Promise.all(this.getManagedConfigDefinitions().map((definition) => this.ensureConfigFile(definition.alias)));
    const files = await this.listFiles();
    const issues: ConfigValidationIssue[] = [];

    for (const file of files) {
      try {
        const raw = await readFile(file.path, "utf8");
        if (raw.trim()) {
          JSON.parse(raw);
        }
      } catch (error) {
        issues.push({
          alias: file.alias,
          level: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const [llm, mcp, skills] = await Promise.all([
      this.llmRegistry.getSummary(),
      this.mcpRegistry.listServers(),
      this.skillRegistry.buildStatusReport(),
    ]);

    for (const route of Object.values(llm.routes)) {
      if (route.status === "needs-setup") {
        issues.push({
          alias: "llm",
          level: "warning",
          message: `${route.purpose} route: ${route.notes.join(" ") || "needs setup"}`,
        });
      }
    }

    for (const server of mcp) {
      if (server.status === "needs-setup") {
        issues.push({
          alias: "mcp",
          level: "warning",
          message: `${server.serverLabel}: ${server.notes.join(" ")}`,
        });
      }
    }

    for (const skill of skills.skills) {
      if (skill.missing.env.length > 0 || skill.missing.config.length > 0 || skill.missing.bins.length > 0) {
        issues.push({
          alias: "skills",
          level: "warning",
          message: `${skill.skillKey}: missing ${[
            ...skill.missing.env,
            ...skill.missing.config,
            ...skill.missing.bins,
          ].join(", ")}`,
        });
      }
    }

    return {
      workspaceDir: this.workspaceDir,
      files,
      ok: issues.every((issue) => issue.level !== "error"),
      issues,
      llm,
      mcp,
      skills,
    };
  }

  private async ensureConfigFile(alias: ManagedConfigAlias): Promise<void> {
    if (alias === "llm") {
      await this.llmRegistry.ensureConfigFile();
      return;
    }
    if (alias === "mcp") {
      await this.mcpRegistry.ensureConfigFile();
      return;
    }
    if (alias === "commands") {
      await this.inboundCommandPolicyService.ensurePolicyFile();
      return;
    }

    await mkdir(this.configDir, { recursive: true });
    const skillsPath = path.join(this.configDir, "skills-config.json");
    try {
      await access(skillsPath);
    } catch {
      await writeFile(skillsPath, `${JSON.stringify(SKILLS_DEFAULT_STORE, null, 2)}\n`, "utf8");
    }
    await this.skillRegistry.ensureSkillsDir();
  }

  private async writeConfig(alias: ManagedConfigAlias, config: unknown): Promise<void> {
    const file = await this.getFile(alias);
    await mkdir(path.dirname(file.path), { recursive: true });
    await writeFile(file.path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  private async describeFile(definition: ManagedConfigDefinition): Promise<ManagedConfigFile> {
    let exists = false;
    let size: number | null = null;
    let updatedAt: string | null = null;

    try {
      const fileStat = await stat(definition.path);
      exists = true;
      size = fileStat.size;
      updatedAt = fileStat.mtime.toISOString();
    } catch {
      exists = false;
    }

    return {
      alias: definition.alias,
      path: definition.path,
      description: definition.description,
      exists,
      size,
      updatedAt,
    };
  }
}
