import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type OpenAI from "openai";

export interface McpServerConfig {
  serverLabel: string;
  description?: string | undefined;
  serverUrl?: string | undefined;
  connectorId?: string | undefined;
  authorizationEnv?: string | undefined;
  requireApproval?: "always" | "never" | undefined;
  allowedTools?: string[] | undefined;
  enabled?: boolean | undefined;
}

export interface McpServerStatus extends McpServerConfig {
  status: "ready" | "needs-setup" | "disabled";
  authorizationPresent: boolean;
  notes: string[];
}

type OpenAiMcpTool = OpenAI.Responses.Tool.Mcp;
type OpenAiMcpConnectorId = NonNullable<OpenAiMcpTool["connector_id"]>;

const OPENAI_MCP_CONNECTOR_IDS: readonly OpenAiMcpConnectorId[] = [
  "connector_dropbox",
  "connector_gmail",
  "connector_googlecalendar",
  "connector_googledrive",
  "connector_microsoftteams",
  "connector_outlookcalendar",
  "connector_outlookemail",
  "connector_sharepoint",
];

interface McpRegistryStore {
  servers: McpServerConfig[];
}

const ENV_TEMPLATE_PATTERN = /\$\{([A-Z0-9_]+)\}/gu;

function defaultStore(): McpRegistryStore {
  return {
    servers: [],
  };
}

export class McpRegistryService {
  private readonly configPath: string;

  constructor(private readonly workspaceDir: string) {
    this.configPath = path.join(this.workspaceDir, "channels", "mcp-servers.json");
  }

  async ensureConfigFile(): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      await readFile(this.configPath, "utf8");
    } catch {
      await writeFile(this.configPath, `${JSON.stringify(defaultStore(), null, 2)}\n`, "utf8");
    }
  }

  async listServers(): Promise<McpServerStatus[]> {
    const store = await this.readStore();
    return store.servers.map((server) => this.buildStatus(server));
  }

  async buildOpenAiTools(): Promise<OpenAiMcpTool[]> {
    const servers = await this.listServers();

    return servers
      .filter((server) => server.status === "ready")
      .map((server) => {
        const connectorId = OPENAI_MCP_CONNECTOR_IDS.find((value) => value === server.connectorId?.trim());
        return {
          type: "mcp" as const,
          server_label: server.serverLabel,
          ...(server.description ? { server_description: server.description } : {}),
          ...(server.serverUrl ? { server_url: server.serverUrl } : {}),
          ...(connectorId ? { connector_id: connectorId } : {}),
          ...(server.authorizationEnv && process.env[server.authorizationEnv]?.trim()
            ? { authorization: process.env[server.authorizationEnv]!.trim() }
            : {}),
          ...(server.allowedTools?.length ? { allowed_tools: server.allowedTools } : {}),
          require_approval: server.requireApproval ?? "never",
        } satisfies OpenAiMcpTool;
      });
  }

  private async readStore(): Promise<McpRegistryStore> {
    await this.ensureConfigFile();

    try {
      const raw = await readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<McpRegistryStore>;
      const servers = Array.isArray(parsed.servers)
        ? parsed.servers.filter(
            (server): server is McpServerConfig =>
              Boolean(server) &&
              typeof server === "object" &&
              typeof (server as { serverLabel?: unknown }).serverLabel === "string",
          )
        : [];

      return { servers };
    } catch {
      return defaultStore();
    }
  }

  private buildStatus(server: McpServerConfig): McpServerStatus {
    const notes: string[] = [];
    const enabled = server.enabled !== false;
    const missingTemplateEnvNames = this.collectMissingTemplateEnvNames(server.serverUrl);
    const resolvedServerUrl = this.resolveTemplateValue(server.serverUrl);
    const hasTarget = Boolean(resolvedServerUrl?.trim() || server.connectorId?.trim());
    const authorizationPresent = Boolean(
      server.authorizationEnv?.trim() ? process.env[server.authorizationEnv.trim()]?.trim() : true,
    );

    if (!enabled) {
      return {
        ...server,
        status: "disabled",
        authorizationPresent,
        notes: ["This MCP server is disabled in the local registry."],
      };
    }

    if (!hasTarget) {
      notes.push("Missing serverUrl or connectorId.");
    }

    if (missingTemplateEnvNames.length > 0) {
      notes.push(
        ...missingTemplateEnvNames.map((name) => `Environment variable ${name} is required to resolve the MCP serverUrl.`),
      );
    }

    if (server.authorizationEnv?.trim() && !authorizationPresent) {
      notes.push(`Environment variable ${server.authorizationEnv.trim()} is not set.`);
    }

    return {
      ...server,
      ...(resolvedServerUrl ? { serverUrl: resolvedServerUrl } : {}),
      status: notes.length === 0 ? "ready" : "needs-setup",
      authorizationPresent,
      notes: notes.length ? notes : ["Ready to expose MCP tools to the OpenAI runtime."],
    };
  }

  private resolveTemplateValue(value?: string | undefined): string | undefined {
    if (!value?.trim()) {
      return value;
    }

    return value.replace(ENV_TEMPLATE_PATTERN, (_match, envName) => process.env[envName]?.trim() || "");
  }

  private collectMissingTemplateEnvNames(value?: string | undefined): string[] {
    if (!value?.trim()) {
      return [];
    }

    const missing = new Set<string>();
    for (const match of value.matchAll(ENV_TEMPLATE_PATTERN)) {
      const envName = match[1]?.trim();
      if (!envName) {
        continue;
      }
      if (!process.env[envName]?.trim()) {
        missing.add(envName);
      }
    }

    return [...missing];
  }
}
