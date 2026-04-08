#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import QRCode from "qrcode";

import {
  DEFAULT_GATEWAY_PORT,
  getGatewayServiceStatus,
  installGatewayService,
  readGatewayLogTail,
  restartGatewayService,
  startGatewayService,
  stopGatewayService,
  uninstallGatewayService,
  type GatewayStatusSnapshot,
} from "./gatewayService.js";
import { packageRootDir, resolvePackagePath } from "./packagePaths.js";
import { BundledPluginCatalogService, type BundledPluginRecord } from "./services/bundledPluginCatalogService.js";
import type {
  ChannelsStatusSnapshot,
  WeChatChannelStatus,
  WeChatLifecycleAuditEntry,
  WeChatLoginStartResult,
  WeChatMessage,
} from "./types/channels.js";
import type {
  MemoryCompactionRecord,
  MemoryCompactionResult,
  MemoryFileContent,
  MemoryFileSummary,
  MemoryPolicy,
  MemoryRecallResult,
  MemorySearchResult,
  MemoryStatus,
} from "./types/memory.js";
import type {
  ModuleAsset,
  RepoAnalysisReport,
  ResearchSourceItem,
  WeeklyPresentationResult,
} from "./types/researchArtifacts.js";
import type { ResearchDirectionProfile, ResearchDiscoveryQueryCandidate } from "./types/researchDirection.js";
import type { ResearchDirectionReport } from "./types/researchDirectionReport.js";
import type {
  ResearchDiscoveryRunResult,
  ResearchDiscoveryRunSummary,
} from "./types/researchDiscovery.js";
import type { ResearchDiscoverySchedulerStatus } from "./types/researchDiscoveryScheduler.js";
import type { ResearchFeedbackRecord, ResearchFeedbackSummary } from "./types/researchFeedback.js";
import type {
  DeepPaperAnalysisReport,
} from "./types/researchAnalysis.js";
import type {
  ResearchMemoryGraph,
  ResearchMemoryGraphQuery,
  ResearchMemoryNode,
  ResearchMemoryNodeDetail,
} from "./types/researchMemoryGraph.js";
import type { ResearchReport, ResearchReportSummary, ResearchRequest } from "./types/research.js";
import type { ResearchTaskDetail, ResearchTaskHandoff, ResearchTaskSummary } from "./types/researchTask.js";
import type {
  ConfigValidationReport,
  ManagedConfigAlias,
  ManagedConfigFile,
  WorkspaceConfigService,
} from "./services/workspaceConfigService.js";

const require = createRequire(import.meta.url);

type ParsedOptions = {
  flags: Map<string, string | boolean>;
  positionals: string[];
};

type RuntimeEnv = {
  DATABASE_URL: string;
  HOST: string;
  LLM_PROVIDER: "fallback" | "openai";
  OPENCLAW_CLI_PATH: string;
  OPENCLAW_GATEWAY_URL: string;
  OPENCLAW_WECHAT_CHANNEL_ID: string;
  OPENAI_MODEL: string;
  OPENAI_WIRE_API: string;
  PLATFORM_WORKSPACE_DIR: string;
  PORT: number;
  RESEARCH_AGENT_NAME: string;
  WECHAT_PROVIDER: "mock" | "native" | "openclaw";
};

type GatewayHealthPayload = {
  status: string;
  agent: string;
  time: string;
};

type RuntimeMetaPayload = {
  agent: string;
  llmProvider: string;
  llmWireApi: string | null;
  llmModel: string;
  wechatProvider: string;
  workspaceDir: string;
  openclaw: {
    gatewayUrl: string;
    cliPath: string;
    channelId: string;
  };
  mcp: {
    supported: boolean;
    connectors: number;
    status: string;
    notes: string[];
  };
  deployment: {
    gateway: {
      defaultPort: number;
      runtimePort: number;
      serviceManager: string | null;
      commands: {
        install: string;
        start: string;
        restart: string;
        status: string;
        deepStatus: string;
        stop: string;
        uninstall: string;
        logs: string;
        doctor: string;
        deepDoctor: string;
      };
      runtime: {
        currentProcessPid: number;
        currentProcessOwnsPort: boolean;
        healthUrl: string;
      };
      supervisor: GatewayStatusSnapshot;
    };
  };
};

type RuntimeLogPayload = {
  lines: number;
  source: string;
  stdout: {
    path: string | null;
    content: string;
  };
  stderr: {
    path: string | null;
    content: string;
  };
  ts: number;
};

type GatewayProbePayload = {
  url: string;
  healthReachable: boolean;
  healthStatus: string | null;
  rpcReachable: boolean;
  agent: string | null;
  workspaceDir: string | null;
  llmProvider: string | null;
  wechatProvider: string | null;
  error: string | null;
};

type ChannelMessagesPayload = {
  messages: WeChatMessage[];
};

type ChannelLifecyclePayload = {
  items: WeChatLifecycleAuditEntry[];
};

type ChannelSessionsPayload = {
  sessions: Array<{
    sessionId: string;
    channel: string;
    senderId: string;
    roleId: string;
    roleLabel: string;
    skillIds: string[];
    skillLabels: string[];
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env" | "injected";
    wireApi?: string | undefined;
    turnCount: number;
    lastUserMessage?: string | undefined;
    lastAssistantMessage?: string | undefined;
    updatedAt: string;
  }>;
};

type AgentRouteOption = {
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: "ready" | "needs-setup" | "disabled";
  llmSource: "registry" | "env";
  wireApi?: string | undefined;
};

type AgentSessionSummary = {
  roleId: string;
  roleLabel: string;
  skillIds: string[];
  skillLabels: string[];
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: "ready" | "needs-setup" | "disabled";
  llmSource: "registry" | "env" | "injected";
  wireApi?: string | undefined;
  fallbackRoutes: AgentRouteOption[];
  reasoningEffort: string;
  defaultRoute: AgentRouteOption;
  availableRoles: Array<{ id: string; label: string }>;
  availableSkills: Array<{ id: string; label: string }>;
  availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
  availableReasoningEfforts: string[];
};

type MemoryFilesPayload = {
  files: MemoryFileSummary[];
};

type MemoryCompactionsPayload = {
  items: MemoryCompactionRecord[];
};

type OpenClawPluginListPayload = {
  plugins?: Array<{
    id?: string;
    name?: string;
    version?: string;
    enabled?: boolean;
    status?: string;
    channelIds?: string[];
  }>;
};

type OpenClawPluginState = {
  id: string;
  name?: string | undefined;
  version?: string | undefined;
  enabled: boolean;
  status?: string | undefined;
  channelIds: string[];
};

type ResearchRecentPayload = {
  reports: ResearchReportSummary[];
};

type ResearchTasksPayload = {
  tasks: ResearchTaskSummary[];
};

type ResearchDirectionsPayload = {
  profiles: ResearchDirectionProfile[];
};

type ResearchDiscoveryPlanPayload = {
  candidates: ResearchDiscoveryQueryCandidate[];
};

type ResearchDiscoveryRecentPayload = {
  runs: ResearchDiscoveryRunSummary[];
};

type ResearchFeedbackPayload = {
  summary: ResearchFeedbackSummary;
  items: ResearchFeedbackRecord[];
};

type ResearchModuleAssetsPayload = {
  assets: ModuleAsset[];
};

type ResearchPresentationsPayload = {
  presentations: WeeklyPresentationResult[];
};

type ResearchDirectionReportsPayload = {
  reports: ResearchDirectionReport[];
};

type ResearchGraphReportPayload = {
  generatedAt: string;
  view: "asset" | "paper";
  filters: ResearchMemoryGraphQuery;
  stats: ResearchMemoryGraph["stats"];
  isolatedNodeCount?: number | undefined;
  hubs?: Array<{ node: ResearchMemoryNode; degree: number }> | undefined;
  topNodes?: Array<{ node: ResearchMemoryNode; degree: number }> | undefined;
  strongestEdges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    kind?: string | undefined;
    weight?: number | undefined;
    sourceLabel: string;
    targetLabel: string;
  }>;
  components?: Array<{
    id: string;
    size: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
    leadNodes: Array<{
      id: string;
      label: string;
      type: string;
      degree: number;
    }>;
    supportingLabels: string[];
  }> | undefined;
  isolatedNodes?: ResearchMemoryNode[] | undefined;
  summary?: string[] | undefined;
};

type ResearchGraphPathPayload = {
  generatedAt: string;
  view: "asset" | "paper";
  connected: boolean;
  fromNode: ResearchMemoryNode | null;
  toNode: ResearchMemoryNode | null;
  hops: number;
  pathNodeIds: string[];
  pathNodes: ResearchMemoryNode[];
  pathEdges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    kind?: string | undefined;
    weight?: number | undefined;
    sourceLabel: string;
    targetLabel: string;
  }>;
  summary: string;
};

type ResearchGraphExplainPayload = {
  generatedAt: string;
  view: "asset" | "paper";
  connected: boolean;
  relationType: "missing" | "direct" | "indirect" | "disconnected";
  fromNode: ResearchMemoryNode | null;
  toNode: ResearchMemoryNode | null;
  directEdges: ResearchGraphPathPayload["pathEdges"];
  sharedNeighbors: ResearchMemoryNode[];
  supportingLabels: string[];
  path: {
    hops: number;
    pathNodeIds: string[];
    pathNodes: ResearchMemoryNode[];
    pathEdges: ResearchGraphPathPayload["pathEdges"];
  } | null;
  summary: string;
};

type GatewayContext = {
  runtimeEnv: RuntimeEnv;
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
};

function parseOptions(args: string[]): ParsedOptions {
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  let index = 0;
  while (index < args.length) {
    const token = args[index];
    if (token === undefined) {
      break;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      index += 1;
      continue;
    }

    const body = token.slice(2);
    const eqIndex = body.indexOf("=");
    if (eqIndex >= 0) {
      flags.set(body.slice(0, eqIndex), body.slice(eqIndex + 1));
      index += 1;
      continue;
    }

    const next = args[index + 1];
    if (next !== undefined && !next.startsWith("-")) {
      flags.set(body, next);
      index += 1;
    } else {
      flags.set(body, true);
    }

    index += 1;
  }

  return { flags, positionals };
}

function getStringFlag(options: ParsedOptions, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = options.flags.get(name);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getBooleanFlag(options: ParsedOptions, ...names: string[]): boolean {
  return names.some((name) => options.flags.get(name) === true);
}

function getIntegerFlag(options: ParsedOptions, ...names: string[]): number | undefined {
  const raw = getStringFlag(options, ...names);
  if (!raw || !/^\d+$/u.test(raw)) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanValue(raw: string): boolean | undefined {
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function getOptionalBooleanFlag(options: ParsedOptions, ...names: string[]): boolean | undefined {
  for (const name of names) {
    const value = options.flags.get(name);
    if (value === true) {
      return true;
    }
    if (typeof value === "string") {
      const parsed = parseBooleanValue(value);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
}

function consumePositionals(options: ParsedOptions, count: number): ParsedOptions {
  return {
    flags: new Map(options.flags),
    positionals: options.positionals.slice(count),
  };
}

function applyRuntimeOverrides(options: ParsedOptions): void {
  const host = getStringFlag(options, "host");
  const port = getStringFlag(options, "port");
  const workspaceDir = getStringFlag(options, "workspace", "workspace-dir");
  const databaseUrl = getStringFlag(options, "db-url", "database-url");
  const openClawCliPath = getStringFlag(options, "openclaw-cli");

  if (host) {
    process.env.HOST = host;
  }
  if (port) {
    process.env.PORT = port;
  }
  if (workspaceDir) {
    process.env.PLATFORM_WORKSPACE_DIR = workspaceDir;
  }
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }
  if (openClawCliPath) {
    process.env.OPENCLAW_CLI_PATH = openClawCliPath;
  }
}

async function loadRuntimeEnv(): Promise<RuntimeEnv> {
  const { env } = await import("./config/env.js");
  return env;
}

async function readPackageVersion(): Promise<string> {
  const raw = await readFile(resolvePackagePath("package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: unknown };
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

function printHelp(): void {
  console.log(`ReAgent CLI

Install:
  npm install -g @sinlair/reagent

Core:
  reagent runtime     Inspect health, status, dashboard, logs, and doctor output
  reagent research    Run or inspect research tasks, directions, discovery, and artifacts
  reagent config      Read, write, or validate managed workspace config
  reagent plugins     Inspect bundled OpenClaw plugin packages and delegate plugin lifecycle commands
  reagent channels    Inspect or manage the WeChat channel surface
  reagent memory      Inspect or mutate workspace memory from the CLI

Runtime:
  reagent init        Create a local .env, workspace folders, and push the Prisma schema
  reagent service     Manage the supervised ReAgent gateway runtime
  reagent start       Start the ReAgent server in the current directory
  reagent db push     Push the bundled Prisma schema into the configured database
  reagent version     Print the installed CLI version

Compatibility aliases:
  reagent health      Alias for "reagent runtime health"
  reagent status      Alias for "reagent runtime status"
  reagent dashboard   Alias for "reagent runtime dashboard"
  reagent logs        Alias for "reagent runtime logs"
  reagent doctor      Alias for "reagent runtime doctor"
  reagent gateway     Alias for "reagent service run"
  reagent gateway ... Alias for "reagent service ..."
  reagent daemon ...  Alias for "reagent service ..."

Shared flags:
  --url <value>             Override the HTTP gateway base URL for health/status/channels/memory/research/logs
  --host <value>            Override HOST for this command
  --port <value>            Override PORT for this command
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --db-url <url>            Override DATABASE_URL for this command
  --openclaw-cli <path>     Override OPENCLAW_CLI_PATH for this command
  --timeout <ms>            Override HTTP timeout for gateway-backed commands
  --follow                  Keep polling runtime logs and print appended lines
  --poll <ms>               Poll interval for --follow (default: 2000)
  --json                    Print machine-readable JSON where supported

Init flags:
  --force                   Overwrite .env during init
  --skip-db                 Skip prisma db push during init
`);
}

function renderChannelsHelp(): void {
  console.log(`ReAgent Channels

Commands:
  reagent channels status
  reagent channels list
  reagent channels logs
  reagent channels messages
  reagent channels chat <senderId> <text>
  reagent channels inbound <senderId> <text>
  reagent channels push <senderId> <text>
  reagent channels send <senderId> <text>
  reagent channels sessions
  reagent channels agent ...
  reagent channels login
  reagent channels wait
  reagent channels logout

Flags:
  --channel <id>            Accepted aliases: wechat, weixin, openclaw-weixin
  --probe                   Prefer a live gateway probe before falling back to local status
  --sender <id>             Sender/user id for chat, inbound, push, or send
  --name <value>            Optional sender display name
  --text <value>            Message text instead of positional arguments
  --display-name <value>    Optional account display name for login completion
  --force                   Start a fresh login flow
  --wait                    Wait for login confirmation after "login"
  --limit <n>               Limit message/log/session output
  --json                    Print JSON output
`);
}

function renderMemoryHelp(): void {
  console.log(`ReAgent Memory

Commands:
  reagent memory status
  reagent memory files
  reagent memory file <path>
  reagent memory search <query>
  reagent memory recall <query>
  reagent memory remember <content>
  reagent memory policy
  reagent memory compact
  reagent memory compactions

Flags:
  --query <value>           Explicit query override for search/recall
  --limit <n>               Result limit for files/search/recall/compactions
  --path <value>            Memory file path for "file"
  --scope <daily|long-term> Scope for "remember" (default: daily)
  --title <value>           Title for "remember"
  --content <value>         Content for "remember"
  --source <value>          Source label for "remember"
  --older-than-days <n>     Compaction cutoff
  --min-entries <n>         Minimum compaction candidates
  --max-entries <n>         Maximum compaction candidates
  --dry-run                 Preview compaction without writing
  --json                    Print JSON output
`);
}

function renderRuntimeHelp(): void {
  console.log(`ReAgent Runtime

Commands:
  reagent runtime health
  reagent runtime status
  reagent runtime dashboard
  reagent runtime logs
  reagent runtime doctor

Notes:
  - runtime commands delegate to the same handlers as top-level health/status/dashboard/logs/doctor
  - pass --url, --host, --port, or --timeout when inspecting a non-default gateway
  - use "reagent service ..." when you want to control the supervised runtime itself

Flags:
  --follow                  With "logs", keep polling and print appended lines
  --poll <ms>               Poll interval for "logs --follow" (default: 2000)
  --json                    Print JSON output
`);
}

function renderResearchHelp(): void {
  console.log(`ReAgent Research

Commands:
  reagent research run <topic>
  reagent research enqueue <topic>
  reagent research recent
  reagent research tasks
  reagent research task <taskId>
  reagent research report <taskId>
  reagent research retry <taskId>
  reagent research handoff <taskId>
  reagent research directions
  reagent research direction ...
  reagent research discovery ...
  reagent research feedback ...
  reagent research graph ...
  reagent research artifact <workspace-relative-path>
  reagent research source <sourceItemId>
  reagent research paper-report <reportId>
  reagent research repo-report <reportId>
  reagent research module-assets
  reagent research module-asset <assetId>
  reagent research presentations
  reagent research presentation <presentationId>
  reagent research direction-reports
  reagent research direction-report <reportId>
  reagent research direction-report generate

Direction commands:
  reagent research direction <directionId>
  reagent research direction upsert <file|->
  reagent research direction brief <directionId>
  reagent research direction plan <directionId>
  reagent research direction import-brief <file|->
  reagent research direction delete <directionId>

Discovery commands:
  reagent research discovery plan [directionId]
  reagent research discovery recent
  reagent research discovery inspect <runId>
  reagent research discovery run
  reagent research discovery scheduler [status]
  reagent research discovery scheduler set
  reagent research discovery scheduler tick

Feedback and graph:
  reagent research feedback [list]
  reagent research feedback record <kind>
  reagent research graph [show]
  reagent research graph node <nodeId>
  reagent research graph path <fromNodeId> <toNodeId>
  reagent research graph explain <fromNodeId> <toNodeId>
  reagent research graph report

Examples:
  reagent research run "small language models for tool use" --question "Which open-source baselines are strongest?"
  reagent research enqueue "multimodal web agents" --max-papers 6
  reagent research direction upsert direction.json
  reagent research discovery run --direction web-agents --top-k 4 --max-papers 6
  reagent research feedback record useful --topic "browser agents" --notes "keep ranking engineering-heavy work"
  reagent research graph report --view asset --types direction,workflow_report

Flags:
  --topic <value>           Topic override for run/enqueue/generate flows
  --question <value>        Optional research question
  --max-papers <n>          Max papers for run/enqueue
  --direction <id>          Direction id for discovery or report generation
  --id <value>              Explicit id override for direction/task-oriented commands
  --limit <n>               Result limit for list/report commands
  --view <asset|paper>      Research graph view
  --types <csv>             Research graph node types
  --search <value>          Research graph text filter
  --date-from <YYYY-MM-DD>  Research graph lower date filter
  --date-to <YYYY-MM-DD>    Research graph upper date filter
  --out <file>              Write markdown or artifact output to a file
  --json                    Print JSON output
`);
}

function renderServiceHelp(): void {
  console.log(`ReAgent Service

Commands:
  reagent service status
  reagent service install
  reagent service start
  reagent service stop
  reagent service restart
  reagent service uninstall
  reagent service logs
  reagent service run

Notes:
  - service commands are the preferred control surface for the supervised gateway runtime
  - "run" starts the gateway in the foreground
  - "gateway ..." remains available as a compatibility alias

Flags:
  --json                    Print JSON output where supported
  --deep                    With "status", scan for duplicate installs on this host
`);
}

function renderChannelsAgentHelp(): void {
  console.log(`ReAgent Channels Agent

Commands:
  reagent channels agent sessions
  reagent channels agent session <senderId>
  reagent channels agent role <senderId> [roleId]
  reagent channels agent skills <senderId> [skillId,skillId...]
  reagent channels agent model <senderId> [providerId modelId]
  reagent channels agent fallbacks <senderId> [providerId/modelId, ...]
  reagent channels agent reasoning <senderId> [effort]

Examples:
  reagent channels agent session wx-user-1
  reagent channels agent role wx-user-1 researcher
  reagent channels agent skills wx-user-1 workspace-control,memory-ops
  reagent channels agent model wx-user-1 proxy-a gpt-4o
  reagent channels agent model wx-user-1 clear
  reagent channels agent fallbacks wx-user-1 proxy-a/gpt-5.4,proxy-b/gpt-4.1
  reagent channels agent fallbacks wx-user-1 clear
  reagent channels agent reasoning wx-user-1 high

Notes:
  - omit the trailing value to inspect the current setting
  - model "clear" resets the session to the default route
  - fallbacks "clear" removes all fallback routes

Flags:
  --sender <id>             Use a senderId flag instead of the first positional
  --json                    Print JSON output
`);
}

function renderConfigHelp(): void {
  console.log(`ReAgent Config

Commands:
  reagent config file [llm|mcp|skills]
  reagent config get <path>
  reagent config set <path> <value>
  reagent config unset <path>
  reagent config export [llm|mcp|skills]
  reagent config import <llm|mcp|skills> <file|->
  reagent config edit <llm|mcp|skills>
  reagent config validate
  reagent config schema

Examples:
  reagent config get llm.providers[0].enabled
  reagent config set llm.providers[0].enabled true
  reagent config set mcp.servers[0].allowedTools "[\"maps_search\", \"maps_route\"]"
  reagent config unset skills.entries.workspace:research-brief.apiKey

Flags:
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --out <file>              Write exported config to a file instead of stdout
  --editor <command>        Editor command for "edit"
  --dry-run                 Preview writes without saving
  --json                    Print JSON output
`);
}

function renderPluginsHelp(): void {
  console.log(`ReAgent Plugins

Commands:
  reagent plugins list
  reagent plugins marketplace list [source]
  reagent plugins inspect <id>
  reagent plugins info <id>
  reagent plugins inspect --all
  reagent plugins install <id>
  reagent plugins uninstall <id>
  reagent plugins enable <id>
  reagent plugins disable <id>
  reagent plugins update [id]
  reagent plugins doctor

Notes:
  - "list" and "inspect" merge bundled repo metadata with OpenClaw host state when the OpenClaw CLI is available.
  - lifecycle commands delegate to the configured OpenClaw CLI.
  - pass --openclaw-cli to target a non-default OpenClaw executable.

Flags:
  --source <id>             Marketplace source alias: reagent, bundled, reference
  --json                    Print JSON output
  --yes                     Pass --yes through to OpenClaw install/uninstall commands when supported
`);
}

function resolveSqlitePath(databaseUrl: string, cwd: string): string | null {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const rawPath = databaseUrl.slice("file:".length).trim();
  if (!rawPath || rawPath === ":memory:") {
    return null;
  }

  if (path.isAbsolute(rawPath) || /^[A-Za-z]:[\\/]/u.test(rawPath)) {
    return rawPath;
  }

  return path.resolve(cwd, rawPath);
}

async function ensureDirectoryExists(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
}

function resolvePrismaCliPath(): string {
  return require.resolve("prisma/build/index.js");
}

function resolveManagedGatewayPidPath(cwd: string): string {
  return path.join(cwd, ".reagent", "gateway.pid");
}

async function writeManagedGatewayPid(cwd: string): Promise<void> {
  const pidPath = resolveManagedGatewayPidPath(cwd);
  await mkdir(path.dirname(pidPath), { recursive: true });
  await writeFile(
    pidPath,
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        cwd,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function removeManagedGatewayPid(cwd: string): Promise<void> {
  await rm(resolveManagedGatewayPidPath(cwd), { force: true });
}

function installManagedGatewayPidCleanup(cwd: string): void {
  const cleanup = () => {
    void removeManagedGatewayPid(cwd);
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", cleanup);
  process.on("unhandledRejection", cleanup);
}

function runNodeCommand(modulePath: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [modulePath, ...args], {
      cwd,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `Command terminated by signal ${signal}`
            : `Command exited with code ${String(code ?? "unknown")}`,
        ),
      );
    });
  });
}

async function probeCommand(command: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        env: process.env,
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolve({
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resolve({ ok: false, output: error.message });
    });
    child.on("exit", (code) => {
      resolve({
        ok: code === 0,
        output: (stdout || stderr).trim(),
      });
    });
  });
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/u, "");
}

function normalizeGatewayBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Gateway URL cannot be empty.");
  }

  const withProtocol = /^[a-z]+:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`;
  return stripTrailingSlashes(new URL(withProtocol).toString());
}

function normalizeLoopbackHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed || trimmed === "0.0.0.0" || trimmed === "::" || trimmed === "[::]") {
    return "127.0.0.1";
  }
  return trimmed;
}

function resolveGatewayBaseUrl(runtimeEnv: RuntimeEnv, options: ParsedOptions): string {
  const explicitUrl = getStringFlag(options, "url", "gateway-url");
  if (explicitUrl) {
    return normalizeGatewayBaseUrl(explicitUrl);
  }

  const host = normalizeLoopbackHost(getStringFlag(options, "host") ?? process.env.HOST ?? runtimeEnv.HOST);
  const port = getIntegerFlag(options, "port") ?? DEFAULT_GATEWAY_PORT;
  return normalizeGatewayBaseUrl(`http://${host}:${port}`);
}

function resolveGatewayTimeoutMs(options: ParsedOptions, fallback = 15_000): number {
  const timeout = getIntegerFlag(options, "timeout", "timeout-ms");
  if (timeout === undefined) {
    return fallback;
  }
  return Math.max(1_000, Math.min(timeout, 120_000));
}

async function resolveGatewayContext(options: ParsedOptions): Promise<GatewayContext> {
  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  return {
    runtimeEnv,
    baseUrl: resolveGatewayBaseUrl(runtimeEnv, options),
    timeoutMs: resolveGatewayTimeoutMs(options),
  };
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  return search.toString();
}

async function requestGatewayJson<T>(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<T> {
  const response = await requestGatewayResponse(baseUrl, endpoint, {
    ...options,
    accept: options.accept ?? "application/json",
  });
  const rawText = await response.text();

  if (!rawText.trim()) {
    return {} as T;
  }

  return JSON.parse(rawText) as T;
}

async function requestGatewayResponse(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(endpoint, `${baseUrl}/`).toString(), {
      method: options.method ?? "GET",
      headers:
        options.body === undefined
          ? { Accept: options.accept ?? "application/json" }
          : { Accept: options.accept ?? "application/json", "Content-Type": "application/json" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawText = await response.text();
      const body = rawText.trim();
      throw new Error(
        body
          ? `Gateway request failed for ${endpoint}: ${response.status} ${response.statusText} - ${body}`
          : `Gateway request failed for ${endpoint}: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gateway request timed out after ${timeoutMs}ms: ${endpoint}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function requestGatewayText(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<string> {
  const response = await requestGatewayResponse(baseUrl, endpoint, {
    ...options,
    accept: options.accept ?? "text/plain, text/markdown, application/json;q=0.9, */*;q=0.8",
  });
  return response.text();
}

async function requestGatewayBytes(
  baseUrl: string,
  endpoint: string,
  options: GatewayRequestOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const response = await requestGatewayResponse(baseUrl, endpoint, {
    ...options,
    accept: options.accept ?? "*/*",
  });
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}

function isLocalGatewayUrl(baseUrl: string): boolean {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function resolveInspectPort(baseUrl: string, fallbackPort: number): number {
  const url = new URL(baseUrl);
  if (url.port && /^\d+$/u.test(url.port)) {
    const parsed = Number.parseInt(url.port, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallbackPort;
}

async function maybeReadLocalGatewayStatus(
  baseUrl: string,
  fallbackPort: number,
  deep: boolean,
): Promise<GatewayStatusSnapshot | null> {
  if (!isLocalGatewayUrl(baseUrl)) {
    return null;
  }
  return getGatewayServiceStatus(resolveInspectPort(baseUrl, fallbackPort), { deep });
}

async function openUrlInBrowser(targetUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    let child;
    try {
      if (process.platform === "win32") {
        child = spawn("cmd.exe", ["/c", "start", "", targetUrl], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
      } else if (process.platform === "darwin") {
        child = spawn("open", [targetUrl], {
          detached: true,
          stdio: "ignore",
        });
      } else {
        child = spawn("xdg-open", [targetUrl], {
          detached: true,
          stdio: "ignore",
        });
      }
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    child.on("error", () => {
      finish(false);
    });
    child.on("spawn", () => {
      finish(true);
    });
    child.unref();
    setTimeout(() => finish(true), 250);
  });
}

async function renderTerminalQr(value: string): Promise<string | null> {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return await QRCode.toString(trimmed, {
      type: "terminal",
      small: true,
    });
  } catch {
    return null;
  }
}

function formatYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function formatWhen(value: string | null | undefined): string {
  return value?.trim() || "-";
}

function sanitizeCliPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCliPayload(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      if (/(api[_-]?key|token|password|authorization)$/iu.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, sanitizeCliPayload(entryValue)];
    });
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(sanitizeCliPayload(value), null, 2));
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function settleCliRequest<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: formatErrorMessage(error) };
  }
}

function ensureSupportedChannel(options: ParsedOptions): void {
  const requested = getStringFlag(options, "channel");
  if (!requested) {
    return;
  }

  const normalized = requested.trim().toLowerCase();
  if (!["wechat", "weixin", "openclaw-weixin"].includes(normalized)) {
    throw new Error(
      `Unsupported channel target: ${requested}. ReAgent CLI currently exposes only the WeChat channel surface.`,
    );
  }
}

function getQueryInput(options: ParsedOptions): string {
  const flagQuery = getStringFlag(options, "query", "q");
  if (flagQuery) {
    return flagQuery;
  }
  return options.positionals.join(" ").trim();
}

function printGatewayStatus(snapshot: GatewayStatusSnapshot, asJson: boolean): void {
  if (asJson) {
    printJson(snapshot);
    return;
  }

  console.log(`Platform: ${snapshot.platform}`);
  console.log(`Gateway: ${snapshot.healthReachable ? "running" : snapshot.installed ? "installed" : "not installed"}`);
  console.log(`Supervisor: ${snapshot.serviceManager ?? "-"}`);
  console.log(`Port: ${snapshot.port}`);
  console.log(`Installed: ${snapshot.installed ? "yes" : "no"}`);
  console.log(`Install kind: ${snapshot.installKind ?? "-"}`);
  console.log(`Loaded: ${snapshot.loaded ? snapshot.loadedText ?? "yes" : snapshot.loadedText ?? "no"}`);
  console.log(`Service label: ${snapshot.serviceLabel ?? snapshot.taskName}`);
  console.log(`Service config: ${snapshot.serviceConfigPath ?? "-"}`);
  console.log(`Task state: ${snapshot.taskState ?? snapshot.serviceState ?? "-"}`);
  console.log(`Health URL: ${snapshot.healthUrl}`);
  console.log(`Health: ${snapshot.healthReachable ? snapshot.healthStatus ?? "ok" : "unreachable"}`);
  console.log(`Workspace: ${snapshot.runtimeWorkspaceDir ?? snapshot.workingDirectory ?? "-"}`);
  console.log(`Agent: ${snapshot.runtimeAgent ?? "-"}`);
  console.log(`LLM provider: ${snapshot.runtimeLlmProvider ?? "-"}`);
  console.log(`WeChat provider: ${snapshot.runtimeWechatProvider ?? "-"}`);
  console.log(`OpenClaw CLI: ${snapshot.runtimeOpenClawCli ?? "-"}`);
  console.log(`Supervisor PID: ${snapshot.serviceRuntimePid ?? "-"}`);
  console.log(`Listener PID: ${snapshot.listenerPid ?? "-"}`);
  console.log(`Stdout log: ${snapshot.stdoutLogPath}`);
  console.log(`Stderr log: ${snapshot.stderrLogPath}`);
  if (snapshot.extraInstallations.length > 0) {
    console.log("Extra installs:");
    for (const extra of snapshot.extraInstallations) {
      console.log(`  - ${extra.manager} ${extra.label} (${extra.scope})${extra.path ? ` -> ${extra.path}` : ""}`);
    }
  }
  if (snapshot.issues.length > 0) {
    console.log("Issues:");
    for (const issue of snapshot.issues) {
      console.log(`  - ${issue}`);
    }
  }
  if (snapshot.hints.length > 0) {
    console.log("Hints:");
    for (const hint of snapshot.hints) {
      console.log(`  - ${hint}`);
    }
  }
}

function printWeChatStatus(status: WeChatChannelStatus): void {
  console.log(`Provider: ${status.providerMode}`);
  console.log(`Configured: ${formatYesNo(status.configured)}`);
  console.log(`Linked: ${formatYesNo(status.linked)}`);
  console.log(`Running: ${formatYesNo(status.running)}`);
  console.log(`Connected: ${formatYesNo(status.connected)}`);
  console.log(`Lifecycle: ${formatWhen(status.lifecycleState)}`);
  console.log(`Reason: ${formatWhen(status.lifecycleReason ?? status.lastMessage)}`);
  console.log(`Requires human action: ${formatYesNo(Boolean(status.requiresHumanAction))}`);
  console.log(`Account ID: ${formatWhen(status.accountId)}`);
  console.log(`Account Name: ${formatWhen(status.accountName)}`);
  console.log(`Updated: ${formatWhen(status.updatedAt)}`);
  console.log(`Last healthy: ${formatWhen(status.lastHealthyAt)}`);
  console.log(`Last restart: ${formatWhen(status.lastRestartAt)}`);
  console.log(`Paused until: ${formatWhen(status.reconnectPausedUntil)}`);
  console.log(`Gateway URL: ${formatWhen(status.gatewayUrl)}`);
  console.log(`Gateway reachable: ${formatYesNo(Boolean(status.gatewayReachable))}`);
  console.log(`CLI version: ${formatWhen(status.cliVersion)}`);
  console.log(`Plugin installed: ${formatYesNo(Boolean(status.pluginInstalled))}`);
  console.log(`Plugin version: ${formatWhen(status.pluginVersion)}`);
  console.log(`Last error: ${formatWhen(status.lastError)}`);
  if (status.notes && status.notes.length > 0) {
    console.log("Notes:");
    for (const note of status.notes) {
      console.log(`  - ${note}`);
    }
  }
}

function printMemoryStatus(status: MemoryStatus): void {
  console.log(`Workspace: ${status.workspaceDir}`);
  console.log(`Files: ${status.files}`);
  console.log(`Search mode: ${status.searchMode}`);
  console.log(`Last updated: ${formatWhen(status.lastUpdatedAt)}`);
}

function buildFallbackMemoryStatus(runtimeEnv: RuntimeEnv): MemoryStatus & {
  available: false;
  source: "local-fallback";
  error: string;
} {
  return {
    workspaceDir: path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR),
    files: 0,
    searchMode: "hybrid",
    lastUpdatedAt: null,
    available: false,
    source: "local-fallback",
    error: "Gateway memory endpoint is unavailable.",
  };
}

async function buildFallbackChannelsSnapshot(
  runtimeEnv: RuntimeEnv,
  gateway: GatewayStatusSnapshot,
  error: string,
  probeRequested: boolean,
): Promise<ChannelsStatusSnapshot & { degraded: true; source: "local-fallback"; warnings: string[] }> {
  const warnings = [`Gateway channel status is unavailable: ${error}`];
  if (probeRequested) {
    warnings.push("Live probe was requested, but the gateway is unreachable. Showing local fallback status.");
  }

  let cliVersion: string | undefined;
  if (runtimeEnv.WECHAT_PROVIDER === "openclaw") {
    const cliStatus = await probeCommand(runtimeEnv.OPENCLAW_CLI_PATH, ["--version"]);
    if (cliStatus.ok && cliStatus.output.trim()) {
      cliVersion = cliStatus.output.trim();
    } else if (!cliStatus.ok && cliStatus.output.trim()) {
      warnings.push(`OpenClaw CLI probe failed: ${cliStatus.output.trim()}`);
    }
  }

  return {
    ts: Date.now(),
    channelOrder: ["wechat"],
    channelLabels: { wechat: "WeChat" },
    channels: {
      wechat: {
        providerMode: runtimeEnv.WECHAT_PROVIDER,
        configured: true,
        linked: false,
        running: gateway.healthReachable,
        connected: false,
        requiresHumanAction: runtimeEnv.WECHAT_PROVIDER !== "mock",
        gatewayUrl: runtimeEnv.WECHAT_PROVIDER === "openclaw" ? runtimeEnv.OPENCLAW_GATEWAY_URL : undefined,
        gatewayReachable: runtimeEnv.WECHAT_PROVIDER === "openclaw" ? gateway.healthReachable : undefined,
        cliVersion,
        lastError: error,
        lastMessage: "Gateway unreachable. Showing local fallback status.",
        updatedAt: new Date().toISOString(),
        notes: warnings,
      },
    },
    degraded: true,
    source: "local-fallback",
    warnings,
  };
}

function buildFallbackRuntimeMeta(
  context: GatewayContext,
  gateway: GatewayStatusSnapshot,
  error: string,
): RuntimeMetaPayload & { available: false; source: "local-fallback"; error: string } {
  const healthUrl = new URL("/health", `${context.baseUrl}/`).toString();
  return {
    agent: context.runtimeEnv.RESEARCH_AGENT_NAME,
    llmProvider: context.runtimeEnv.LLM_PROVIDER,
    llmWireApi: context.runtimeEnv.LLM_PROVIDER === "openai" ? context.runtimeEnv.OPENAI_WIRE_API : null,
    llmModel: context.runtimeEnv.LLM_PROVIDER === "openai" ? context.runtimeEnv.OPENAI_MODEL : "fallback",
    wechatProvider: context.runtimeEnv.WECHAT_PROVIDER,
    workspaceDir: path.resolve(process.cwd(), context.runtimeEnv.PLATFORM_WORKSPACE_DIR),
    openclaw: {
      gatewayUrl: context.runtimeEnv.OPENCLAW_GATEWAY_URL,
      cliPath: context.runtimeEnv.OPENCLAW_CLI_PATH,
      channelId: context.runtimeEnv.OPENCLAW_WECHAT_CHANNEL_ID,
    },
    mcp: {
      supported: false,
      connectors: 0,
      status: "unknown",
      notes: [`Gateway runtime metadata is unavailable: ${error}`],
    },
    deployment: {
      gateway: {
        defaultPort: DEFAULT_GATEWAY_PORT,
        runtimePort: context.runtimeEnv.PORT,
        serviceManager: gateway.serviceManager,
        commands: {
          install: gateway.installCommand,
          start: gateway.startCommand,
          restart: gateway.restartCommand,
          status: gateway.statusCommand,
          deepStatus: gateway.deepStatusCommand,
          stop: gateway.stopCommand,
          uninstall: gateway.uninstallCommand,
          logs: gateway.logsCommand,
          doctor: gateway.doctorCommand,
          deepDoctor: gateway.deepDoctorCommand,
        },
        runtime: {
          currentProcessPid: gateway.serviceRuntimePid ?? gateway.listenerPid ?? 0,
          currentProcessOwnsPort: gateway.healthReachable,
          healthUrl,
        },
        supervisor: gateway,
      },
    },
    available: false,
    source: "local-fallback",
    error,
  };
}

function summarizeCliWarnings(results: Array<{ ok: true; value: unknown } | { ok: false; error: string }>): string[] {
  return results.filter((entry): entry is { ok: false; error: string } => !entry.ok).map((entry) => entry.error);
}

function printMemoryFiles(files: MemoryFileSummary[]): void {
  if (files.length === 0) {
    console.log("No memory files found.");
    return;
  }

  for (const file of files) {
    console.log(`${file.path} [${file.kind}] size=${file.size} updated=${file.updatedAt}`);
  }
}

function printMemorySearchResults(results: MemorySearchResult[]): void {
  if (results.length === 0) {
    console.log("No memory hits found.");
    return;
  }

  for (const result of results) {
    console.log(`${result.path}:${result.startLine} [${result.kind}] score=${result.score}`);
    console.log(result.title);
    console.log(result.snippet);
    console.log("");
  }
}

function printMemoryRecallResults(result: MemoryRecallResult): void {
  if (result.hits.length === 0) {
    console.log(`No recall hits found for "${result.query}".`);
    return;
  }

  for (const hit of result.hits) {
    console.log(
      `${hit.layer} score=${hit.score} confidence=${hit.confidence} ${hit.path ?? hit.artifactType ?? hit.provenance}`,
    );
    console.log(hit.title);
    console.log(hit.snippet);
    console.log("");
  }
}

function printCompactionRecords(items: MemoryCompactionRecord[]): void {
  if (items.length === 0) {
    console.log("No compaction records found.");
    return;
  }

  for (const item of items) {
    console.log(
      `${item.generatedAt} status=${item.status} mode=${item.mode} candidates=${item.candidateCount} compacted=${item.compactedEntryCount}`,
    );
    if (item.summaryTitle) {
      console.log(`Summary: ${item.summaryTitle}`);
    }
    if (item.reason) {
      console.log(`Reason: ${item.reason}`);
    }
    console.log("");
  }
}

function printMemoryFile(file: MemoryFileContent): void {
  console.log(`${file.path} [${file.kind}] updated=${file.updatedAt}`);
  console.log("");
  console.log(file.content.trimEnd());
}

function printMemoryCompactionResult(result: MemoryCompactionResult): void {
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Candidates: ${result.candidateCount}`);
  console.log(`Compacted: ${result.compactedEntryCount}`);
  console.log(`Summary path: ${formatWhen(result.summaryPath)}`);
  console.log(`Summary title: ${formatWhen(result.summaryTitle)}`);
  console.log(`Summary entry ID: ${formatWhen(result.summaryEntryId)}`);
}

function printManagedConfigFiles(files: ManagedConfigFile[]): void {
  for (const file of files) {
    console.log(`${file.alias}: ${file.path}`);
    console.log(`Exists=${formatYesNo(file.exists)} Size=${file.size ?? "-"} Updated=${formatWhen(file.updatedAt)}`);
    console.log(file.description);
    console.log("");
  }
}

function printConfigValue(value: unknown): void {
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    console.log(String(value));
    return;
  }
  if (value === null) {
    console.log("null");
    return;
  }
  if (value === undefined) {
    console.log("(undefined)");
    return;
  }
  printJson(value);
}

function printConfigValidationReport(report: ConfigValidationReport): void {
  console.log(`Workspace: ${report.workspaceDir}`);
  console.log(`Valid: ${formatYesNo(report.ok)}`);
  console.log(`Managed files: ${report.files.length}`);
  if (report.issues.length === 0) {
    console.log("Issues: none");
    return;
  }

  console.log("Issues:");
  for (const issue of report.issues) {
    console.log(`  - [${issue.level}] ${issue.alias}: ${issue.message}`);
  }
}

function printBundledPluginList(
  items: Array<{
    plugin: BundledPluginRecord;
    host: OpenClawPluginState | null;
  }>,
): void {
  if (items.length === 0) {
    console.log("No bundled OpenClaw plugin packages found.");
    return;
  }

  for (const item of items) {
    console.log(`${item.plugin.id} ${item.plugin.version} (${item.plugin.source})`);
    console.log(`Package: ${item.plugin.packageName}`);
    console.log(`Install spec: ${item.plugin.installSpec}`);
    console.log(`OpenClaw installed: ${formatYesNo(Boolean(item.host))}`);
    console.log(`OpenClaw enabled: ${formatYesNo(Boolean(item.host?.enabled))}`);
    if (item.host?.version) {
      console.log(`Host version: ${item.host.version}`);
    }
    if (item.plugin.minHostVersion) {
      console.log(`Min host version: ${item.plugin.minHostVersion}`);
    }
    if (item.plugin.channels.length > 0) {
      console.log(`Channels: ${item.plugin.channels.join(", ")}`);
    }
    console.log(item.plugin.description || "(no description)");
    console.log("");
  }
}

function printAgentSessionSummary(summary: AgentSessionSummary): void {
  console.log(`Role: ${summary.roleLabel} (${summary.roleId})`);
  console.log(
    `Model: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""} [${summary.llmStatus}]`,
  );
  console.log(`Reasoning: ${summary.reasoningEffort}`);
  console.log(`Skills: ${summary.skillLabels.join(", ") || "-"}`);
  console.log(
    `Fallbacks: ${
      summary.fallbackRoutes.length > 0
        ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
        : "none"
    }`,
  );
  console.log(
    `Default route: ${summary.defaultRoute.providerLabel}/${summary.defaultRoute.modelLabel}${summary.defaultRoute.wireApi ? ` via ${summary.defaultRoute.wireApi}` : ""}`,
  );
  console.log(`Available roles: ${summary.availableRoles.map((role) => role.id).join(", ") || "-"}`);
  console.log(`Available skills: ${summary.availableSkills.map((skill) => skill.id).join(", ") || "-"}`);
  console.log(
    `Available reasoning: ${summary.availableReasoningEfforts.join(", ") || "-"}`,
  );
}

function printResearchRecentReports(reports: ResearchReportSummary[]): void {
  if (reports.length === 0) {
    console.log("No research reports found.");
    return;
  }

  for (const report of reports) {
    console.log(
      `${report.generatedAt} ${report.topic} verdict=${report.critiqueVerdict} papers=${report.paperCount} evidence=${report.evidenceCount}`,
    );
    console.log(report.summary);
    console.log("");
  }
}

function printResearchTaskSummaries(tasks: ResearchTaskSummary[]): void {
  if (tasks.length === 0) {
    console.log("No research tasks found.");
    return;
  }

  for (const task of tasks) {
    console.log(
      `${task.taskId} state=${task.state} progress=${task.progress}% attempt=${task.attempt} report=${formatYesNo(task.reportReady)}`,
    );
    console.log(`${task.topic}${task.question ? ` | ${task.question}` : ""}`);
    console.log(`${task.updatedAt}${task.message ? ` | ${task.message}` : ""}`);
    console.log("");
  }
}

function printResearchTaskRecord(task: ResearchTaskDetail & { handoff?: ResearchTaskHandoff | null }): void {
  console.log(`Task: ${task.taskId}`);
  console.log(`Topic: ${task.topic}`);
  console.log(`Question: ${formatWhen(task.question)}`);
  console.log(`State: ${task.state}`);
  console.log(`Progress: ${task.progress}%`);
  console.log(`Attempt: ${task.attempt}`);
  console.log(`Report ready: ${formatYesNo(task.reportReady)}`);
  console.log(`Created: ${task.createdAt}`);
  console.log(`Updated: ${task.updatedAt}`);
  console.log(`Review: ${formatWhen(task.reviewStatus)}`);
  console.log(`Round path: ${formatWhen(task.roundPath)}`);
  console.log(`Handoff path: ${formatWhen(task.handoffPath)}`);
  if (task.message) {
    console.log(`Message: ${task.message}`);
  }
  if (task.error) {
    console.log(`Error: ${task.error}`);
  }
  if (task.transitions.length > 0) {
    console.log("Transitions:");
    for (const transition of task.transitions.slice(-8)) {
      console.log(`  - ${transition.at} ${transition.state}${transition.message ? ` | ${transition.message}` : ""}`);
    }
  }
  if (task.handoff) {
    console.log(`Handoff updated: ${task.handoff.updatedAt}`);
    console.log(`Handoff next step: ${task.handoff.nextRecommendedAction}`);
  }
}

function printResearchTaskHandoff(handoff: ResearchTaskHandoff): void {
  console.log(`Task: ${handoff.taskId}`);
  console.log(`Topic: ${handoff.topic}`);
  console.log(`Question: ${formatWhen(handoff.question)}`);
  console.log(`State: ${handoff.state}`);
  console.log(`Progress: ${handoff.progress}%`);
  console.log(`Updated: ${handoff.updatedAt}`);
  console.log(`Review: ${handoff.reviewStatus}`);
  console.log(`Round path: ${handoff.roundPath}`);
  console.log(`Handoff path: ${handoff.handoffPath}`);
  if (handoff.currentMessage) {
    console.log(`Current message: ${handoff.currentMessage}`);
  }

  console.log("");
  console.log(`Next step: ${handoff.nextRecommendedAction}`);

  if (handoff.blockers.length > 0) {
    console.log("");
    console.log("Blockers:");
    for (const blocker of handoff.blockers) {
      console.log(`  - ${blocker}`);
    }
  }

  const dossierEntries = [
    ["Brief", handoff.briefPath],
    ["Progress log", handoff.progressLogPath],
    ["Artifacts index", handoff.artifactsPath],
    ["Report", handoff.reportPath],
    ["Review", handoff.reviewPath],
  ].filter(([, value]) => Boolean(value));
  if (dossierEntries.length > 0) {
    console.log("");
    console.log("Dossier:");
    for (const [label, value] of dossierEntries) {
      console.log(`  - ${label}: ${value}`);
    }
  }

  if (handoff.artifacts.length > 0) {
    console.log("");
    console.log("Artifacts:");
    for (const artifact of handoff.artifacts) {
      console.log(`  - ${artifact.kind}: ${artifact.title} -> ${artifact.path}`);
      for (const note of artifact.notes.slice(0, 2)) {
        console.log(`    note: ${note}`);
      }
    }
  }
}

function printResearchReport(report: ResearchReport): void {
  console.log(`Task: ${report.taskId}`);
  console.log(`Topic: ${report.topic}`);
  console.log(`Question: ${formatWhen(report.question)}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Verdict: ${report.critique.verdict}`);
  console.log(`Papers: ${report.papers.length}`);
  console.log(`Evidence items: ${report.evidence.length}`);
  console.log("");
  console.log(report.summary);
  if (report.findings.length > 0) {
    console.log("");
    console.log("Findings:");
    for (const finding of report.findings.slice(0, 8)) {
      console.log(`  - ${finding}`);
    }
  }
  if (report.nextActions.length > 0) {
    console.log("");
    console.log("Next actions:");
    for (const action of report.nextActions.slice(0, 8)) {
      console.log(`  - ${action}`);
    }
  }
  if (report.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of report.warnings.slice(0, 6)) {
      console.log(`  - ${warning}`);
    }
  }
}

function printResearchDirections(profiles: ResearchDirectionProfile[]): void {
  if (profiles.length === 0) {
    console.log("No research directions found.");
    return;
  }

  for (const profile of profiles) {
    console.log(`${profile.id} ${profile.label} priority=${profile.priority} enabled=${formatYesNo(profile.enabled)}`);
    if (profile.summary) {
      console.log(profile.summary);
    } else if (profile.tlDr) {
      console.log(profile.tlDr);
    }
    console.log("");
  }
}

function printResearchDirection(profile: ResearchDirectionProfile): void {
  console.log(`ID: ${profile.id}`);
  console.log(`Label: ${profile.label}`);
  console.log(`Priority: ${profile.priority}`);
  console.log(`Enabled: ${formatYesNo(profile.enabled)}`);
  console.log(`Updated: ${profile.updatedAt}`);
  if (profile.summary) {
    console.log(`Summary: ${profile.summary}`);
  }
  if (profile.targetProblem) {
    console.log(`Target problem: ${profile.targetProblem}`);
  }
  if (profile.currentGoals.length > 0) {
    console.log(`Current goals: ${profile.currentGoals.join(", ")}`);
  }
  if (profile.queryHints.length > 0) {
    console.log(`Query hints: ${profile.queryHints.join(", ")}`);
  }
}

function printResearchDiscoveryPlan(candidates: ResearchDiscoveryQueryCandidate[]): void {
  if (candidates.length === 0) {
    console.log("No discovery candidates found.");
    return;
  }

  for (const candidate of candidates) {
    console.log(`${candidate.directionLabel} (${candidate.directionId})`);
    console.log(candidate.query);
    console.log(candidate.reason);
    console.log("");
  }
}

function printResearchDiscoveryRuns(runs: ResearchDiscoveryRunSummary[]): void {
  if (runs.length === 0) {
    console.log("No discovery runs found.");
    return;
  }

  for (const run of runs) {
    console.log(
      `${run.runId} ${run.generatedAt} directions=${run.directionLabels.join(", ") || "-"} items=${run.itemCount} pushed=${formatYesNo(run.pushed)}`,
    );
    if (run.topTitle) {
      console.log(`Top title: ${run.topTitle}`);
    }
    console.log("");
  }
}

function printResearchDiscoveryRun(run: ResearchDiscoveryRunResult): void {
  console.log(`Run: ${run.runId}`);
  console.log(`Generated: ${run.generatedAt}`);
  console.log(`Directions: ${run.directionLabels.join(", ") || "-"}`);
  console.log(`Items: ${run.items.length}`);
  console.log(`Pushed: ${formatYesNo(run.pushed)}`);
  console.log("");
  console.log(run.digest);
  if (run.items.length > 0) {
    console.log("");
    console.log("Top items:");
    for (const item of run.items.slice(0, 5)) {
      console.log(`  - ${item.title} [${item.directionLabel}]`);
    }
  }
  if (run.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of run.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

function printResearchSchedulerStatus(status: ResearchDiscoverySchedulerStatus): void {
  console.log(`Running: ${formatYesNo(status.running)}`);
  console.log(`Enabled: ${formatYesNo(status.enabled)}`);
  console.log(`Time: ${status.dailyTimeLocal}`);
  console.log(`Sender: ${formatWhen(status.senderId)}`);
  console.log(`Directions: ${status.directionIds.join(", ") || "-"}`);
  console.log(`Top K: ${status.topK}`);
  console.log(`Max papers per query: ${status.maxPapersPerQuery}`);
  console.log(`Updated: ${formatWhen(status.updatedAt)}`);
}

function printResearchFeedback(summary: ResearchFeedbackSummary, items: ResearchFeedbackRecord[]): void {
  console.log(`Total: ${summary.total}`);
  console.log(`Updated: ${summary.updatedAt}`);
  console.log(
    `Counts: ${Object.entries(summary.counts)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}`,
  );
  if (items.length > 0) {
    console.log("");
    for (const item of items) {
      console.log(`${item.createdAt} ${item.feedback} ${item.topic ?? item.directionId ?? "-"}`);
      if (item.notes) {
        console.log(item.notes);
      }
      console.log("");
    }
  }
}

function printResearchGraph(graph: ResearchMemoryGraph): void {
  console.log(`Generated: ${graph.generatedAt}`);
  console.log(`Nodes: ${graph.stats.nodes}`);
  console.log(`Edges: ${graph.stats.edges}`);
  console.log(
    `By type: ${Object.entries(graph.stats.byType)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}`,
  );
  if (graph.nodes.length > 0) {
    console.log("");
    console.log("Top nodes:");
    for (const node of graph.nodes.slice(0, 8)) {
      console.log(`  - ${node.type}:${node.label}`);
    }
  }
}

function printResearchGraphReport(report: ResearchGraphReportPayload): void {
  const hubs = report.hubs ?? report.topNodes ?? [];
  const isolatedNodeCount = report.isolatedNodeCount ?? report.isolatedNodes?.length ?? 0;
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`View: ${report.view}`);
  console.log(`Nodes: ${report.stats.nodes}`);
  console.log(`Edges: ${report.stats.edges}`);
  console.log(`Isolated nodes: ${isolatedNodeCount}`);
  if (hubs.length > 0) {
    console.log("");
    console.log("Top hubs:");
    for (const item of hubs) {
      console.log(`  - ${item.node.type}:${item.node.label} degree=${item.degree}`);
    }
  }
  if (report.strongestEdges.length > 0) {
    console.log("");
    console.log("Strongest edges:");
    for (const edge of report.strongestEdges) {
      console.log(`  - ${edge.sourceLabel} -> ${edge.targetLabel} (${edge.label})`);
    }
  }
  if (report.components && report.components.length > 0) {
    console.log("");
    console.log("Components:");
    for (const component of report.components.slice(0, 4)) {
      console.log(`  - ${component.id} size=${component.size} edges=${component.edgeCount}`);
    }
  }
  if (report.summary && report.summary.length > 0) {
    console.log("");
    for (const line of report.summary) {
      console.log(line);
    }
  }
}

function printResearchGraphPath(payload: ResearchGraphPathPayload | ResearchGraphExplainPayload): void {
  console.log(payload.summary);
  if ("hops" in payload) {
    console.log(`Hops: ${payload.hops}`);
    for (const node of payload.pathNodes) {
      console.log(`  - ${node.type}:${node.label}`);
    }
    return;
  }

  console.log(`Relation: ${payload.relationType}`);
  if (payload.path) {
    console.log(`Hops: ${payload.path.hops}`);
    for (const node of payload.path.pathNodes) {
      console.log(`  - ${node.type}:${node.label}`);
    }
  }
}

function printResearchSourceItem(item: ResearchSourceItem): void {
  console.log(`ID: ${item.id}`);
  console.log(`Type: ${item.sourceType}`);
  console.log(`Title: ${formatWhen(item.title)}`);
  console.log(`URL: ${formatWhen(item.url)}`);
  console.log(`Created: ${item.createdAt}`);
  console.log(`Paper candidates: ${item.paperCandidates.length}`);
  console.log(`Repo candidates: ${item.repoCandidates.length}`);
  console.log(item.excerpt);
}

function printResearchPaperReport(report: DeepPaperAnalysisReport): void {
  console.log(`ID: ${report.id}`);
  console.log(`Paper: ${report.paper.title}`);
  console.log(`Recommendation: ${report.recommendation}`);
  console.log(`Source item: ${formatWhen(report.sourceItemId)}`);
  console.log(`Repo candidates: ${report.repoCandidates.length}`);
  console.log(`Innovation: ${report.innovationPoints.join(", ") || "-"}`);
}

function printResearchRepoReport(report: RepoAnalysisReport): void {
  console.log(`ID: ${report.id}`);
  console.log(`Repo: ${report.owner}/${report.repo}`);
  console.log(`URL: ${report.url}`);
  console.log(`Likely official: ${formatYesNo(report.likelyOfficial)}`);
  console.log(`Key paths: ${report.keyPaths.join(", ") || "-"}`);
  if (report.notes.length > 0) {
    console.log(`Notes: ${report.notes.join(" | ")}`);
  }
}

function printResearchModuleAssets(assets: ModuleAsset[]): void {
  if (assets.length === 0) {
    console.log("No module assets found.");
    return;
  }

  for (const asset of assets) {
    console.log(`${asset.id} ${asset.owner}/${asset.repo} paths=${asset.selectedPaths.length}`);
    if (asset.archivePath) {
      console.log(`Archive: ${asset.archivePath}`);
    }
    console.log("");
  }
}

function printResearchModuleAsset(asset: ModuleAsset): void {
  console.log(`ID: ${asset.id}`);
  console.log(`Repo: ${asset.owner}/${asset.repo}`);
  console.log(`Archive: ${formatWhen(asset.archivePath)}`);
  console.log(`Selected paths: ${asset.selectedPaths.join(", ") || "-"}`);
  if (asset.notes.length > 0) {
    console.log(`Notes: ${asset.notes.join(" | ")}`);
  }
}

function printResearchPresentations(presentations: WeeklyPresentationResult[]): void {
  if (presentations.length === 0) {
    console.log("No presentations found.");
    return;
  }

  for (const presentation of presentations) {
    console.log(`${presentation.id} ${presentation.generatedAt} ${presentation.title}`);
    console.log(`File: ${presentation.filePath}`);
    console.log("");
  }
}

function printResearchPresentation(presentation: WeeklyPresentationResult): void {
  console.log(`ID: ${presentation.id}`);
  console.log(`Title: ${presentation.title}`);
  console.log(`Generated: ${presentation.generatedAt}`);
  console.log(`File: ${presentation.filePath}`);
  console.log(`PPTX: ${formatWhen(presentation.pptxPath)}`);
  console.log(`Source tasks: ${presentation.sourceReportTaskIds.join(", ") || "-"}`);
}

function printResearchDirectionReports(reports: ResearchDirectionReport[]): void {
  if (reports.length === 0) {
    console.log("No direction reports found.");
    return;
  }

  for (const report of reports) {
    console.log(`${report.id} ${report.topic}`);
    console.log(report.overview);
    console.log("");
  }
}

function printResearchDirectionReport(report: ResearchDirectionReport): void {
  console.log(`ID: ${report.id}`);
  console.log(`Topic: ${report.topic}`);
  console.log(`Direction: ${formatWhen(report.directionId)}`);
  console.log(`Updated: ${report.updatedAt}`);
  console.log("");
  console.log(report.overview);
  if (report.commonBaselines.length > 0) {
    console.log("");
    console.log(`Baselines: ${report.commonBaselines.join(", ")}`);
  }
  if (report.suggestedRoutes.length > 0) {
    console.log(`Suggested routes: ${report.suggestedRoutes.join(" | ")}`);
  }
}

function resolveResearchTopic(options: ParsedOptions): string {
  const topic = getStringFlag(options, "topic") ?? options.positionals.join(" ").trim();
  if (!topic) {
    throw new Error("A topic is required. Pass it positionally or via --topic.");
  }
  return topic;
}

function resolveResearchRequest(options: ParsedOptions): ResearchRequest {
  const topic = resolveResearchTopic(options);
  const question = getStringFlag(options, "question");
  const maxPapers = getIntegerFlag(options, "max-papers", "maxPapers");
  return {
    topic,
    ...(question ? { question } : {}),
    ...(maxPapers !== undefined ? { maxPapers } : {}),
  };
}

function parseCommaSeparatedValues(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return [...new Set(raw.split(/[,\n]/u).map((entry) => entry.trim()).filter(Boolean))];
}

function resolveResearchGraphQuery(options: ParsedOptions): ResearchMemoryGraphQuery {
  const view = getStringFlag(options, "view");
  const types = parseCommaSeparatedValues(getStringFlag(options, "types"));
  const search = getStringFlag(options, "search");
  const topic = getStringFlag(options, "topic");
  const dateFrom = getStringFlag(options, "date-from", "dateFrom");
  const dateTo = getStringFlag(options, "date-to", "dateTo");

  return {
    ...((view === "asset" || view === "paper") ? { view } : {}),
    ...(types.length > 0 ? { types: types as ResearchMemoryGraphQuery["types"] } : {}),
    ...(search ? { search } : {}),
    ...(topic ? { topic } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };
}

function resolveSenderId(options: ParsedOptions): string {
  const senderId = getStringFlag(options, "sender") ?? options.positionals[0];
  if (!senderId?.trim()) {
    throw new Error("A senderId is required. Pass it positionally or via --sender.");
  }
  return senderId.trim();
}

function parseSkillSelections(raw: string): string[] {
  return [...new Set(raw.split(/[,\n]/u).map((entry) => entry.trim()).filter(Boolean))];
}

function parseFallbackSelections(raw: string): Array<{ providerId: string; modelId: string }> {
  return raw
    .split(/[,\n]/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [providerId, modelId] = entry.split(/[/:]/u);
      return {
        providerId: providerId?.trim() || "",
        modelId: modelId?.trim() || "",
      };
    })
    .filter((entry) => entry.providerId.length > 0 && entry.modelId.length > 0);
}

async function readStdinText(): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => {
      resolve(raw);
    });
    process.stdin.on("error", reject);
  });
}

async function readInputSource(source: string): Promise<string> {
  return source === "-"
    ? readStdinText()
    : readFile(path.resolve(process.cwd(), source), "utf8");
}

function splitRenderedLogLines(content: string): string[] {
  const normalized = content.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n");
  if (!normalized.trim()) {
    return [];
  }
  return normalized.split("\n");
}

function diffLogLines(previousContent: string, nextContent: string): string[] {
  const previousLines = splitRenderedLogLines(previousContent);
  const nextLines = splitRenderedLogLines(nextContent);

  if (previousLines.length === 0) {
    return nextLines;
  }
  if (nextLines.length === 0) {
    return [];
  }

  const maxOverlap = Math.min(previousLines.length, nextLines.length);
  for (let overlap = maxOverlap; overlap >= 0; overlap -= 1) {
    let matches = true;
    for (let index = 0; index < overlap; index += 1) {
      if (previousLines[previousLines.length - overlap + index] !== nextLines[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return nextLines.slice(overlap);
    }
  }

  return nextLines;
}

function renderLogDelta(label: string, previousContent: string, nextContent: string): string[] {
  const appendedLines = diffLogLines(previousContent, nextContent).filter((line) => line.trim().length > 0);
  if (appendedLines.length === 0) {
    return [];
  }
  return [`---${label}---`, ...appendedLines];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveMessagePayload(
  options: ParsedOptions,
  textStartIndex: number,
): { senderId: string; senderName?: string | undefined; text: string } {
  const senderId = resolveSenderId(options);
  const senderName = getStringFlag(options, "name", "sender-name");
  const text =
    getStringFlag(options, "text") ??
    options.positionals.slice(textStartIndex).join(" ").trim();
  if (!text) {
    throw new Error("A message text is required. Pass it positionally or via --text.");
  }
  return {
    senderId,
    ...(senderName ? { senderName } : {}),
    text,
  };
}

function printChannelInboundResult(result: { accepted: boolean; reply: string; researchTaskId?: string | undefined }): void {
  console.log(`Accepted: ${formatYesNo(result.accepted)}`);
  if (result.researchTaskId) {
    console.log(`Research task: ${result.researchTaskId}`);
  }
  console.log("");
  console.log(result.reply);
}

function matchOpenClawPluginState(
  plugin: BundledPluginRecord,
  states: OpenClawPluginState[],
): OpenClawPluginState | null {
  const normalizedIds = new Set([
    plugin.id.toLowerCase(),
    plugin.packageName.toLowerCase(),
    plugin.installSpec.toLowerCase(),
  ]);

  return (
    states.find((state) => {
      const candidates = [
        state.id.toLowerCase(),
        state.name?.toLowerCase(),
        ...state.channelIds.map((entry) => entry.toLowerCase()),
      ].filter(Boolean) as string[];
      return candidates.some((candidate) => normalizedIds.has(candidate));
    }) ?? null
  );
}

async function runExternalCli(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; inheritStdio?: boolean } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      shell: process.platform === "win32",
      stdio: options.inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, options.timeoutMs ?? 30_000);

    if (!options.inheritStdio) {
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1,
      });
    });
  });
}

function resolveConfigAlias(input: string | undefined): ManagedConfigAlias {
  const alias = input?.trim();
  if (alias === "llm" || alias === "mcp" || alias === "skills") {
    return alias;
  }
  throw new Error(`Unsupported config namespace: ${String(input ?? "")}. Use llm, mcp, or skills.`);
}

function resolveEditorCommand(options: ParsedOptions): string {
  const explicit = getStringFlag(options, "editor");
  if (explicit) {
    return explicit;
  }
  if (process.env.VISUAL?.trim()) {
    return process.env.VISUAL.trim();
  }
  if (process.env.EDITOR?.trim()) {
    return process.env.EDITOR.trim();
  }
  return process.platform === "win32" ? "notepad.exe" : "vi";
}

async function runEditorCommand(editorCommand: string, targetPath: string): Promise<void> {
  const shellCommand =
    process.platform === "win32"
      ? `${editorCommand} "${targetPath}"`
      : `${editorCommand} "${targetPath.replace(/"/g, '\\"')}"`;

  const result = await runExternalCli(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32" ? ["/c", shellCommand] : ["-lc", shellCommand],
    {
      timeoutMs: 24 * 60 * 60 * 1000,
      inheritStdio: true,
    },
  );

  if (result.exitCode !== 0) {
    throw new Error(`Editor exited with code ${result.exitCode}`);
  }
}

function parseOpenClawPluginStates(raw: string): OpenClawPluginState[] {
  if (!raw.trim()) {
    return [];
  }

  try {
    const payload = JSON.parse(raw) as OpenClawPluginListPayload;
    return (payload.plugins ?? [])
      .filter((plugin): plugin is NonNullable<OpenClawPluginListPayload["plugins"]>[number] => Boolean(plugin))
      .map((plugin) => ({
        id: plugin.id?.trim() || plugin.name?.trim() || "",
        ...(plugin.name?.trim() ? { name: plugin.name.trim() } : {}),
        ...(plugin.version?.trim() ? { version: plugin.version.trim() } : {}),
        enabled: Boolean(plugin.enabled || plugin.status === "loaded"),
        ...(plugin.status?.trim() ? { status: plugin.status.trim() } : {}),
        channelIds: (plugin.channelIds ?? []).filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
      }))
      .filter((plugin) => plugin.id.length > 0);
  } catch {
    return [];
  }
}

async function runDbPush(runtimeEnv: RuntimeEnv): Promise<void> {
  await runNodeCommand(
    resolvePrismaCliPath(),
    [
      "db",
      "push",
      "--schema",
      resolvePackagePath("prisma", "schema.prisma"),
      "--url",
      runtimeEnv.DATABASE_URL,
    ],
    process.cwd(),
  );
}

async function initCommand(options: ParsedOptions): Promise<void> {
  const envTargetPath = path.join(process.cwd(), ".env");
  const overwriteEnv = getBooleanFlag(options, "force");
  const skipDbPush = getBooleanFlag(options, "skip-db");

  try {
    await access(envTargetPath, fsConstants.F_OK);
    if (overwriteEnv) {
      await copyFile(resolvePackagePath(".env.example"), envTargetPath);
      console.log(`Overwrote ${envTargetPath}`);
    } else {
      console.log(`Keeping existing ${envTargetPath}`);
    }
  } catch {
    await copyFile(resolvePackagePath(".env.example"), envTargetPath);
    console.log(`Created ${envTargetPath}`);
  }

  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  const workspacePath = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
  await ensureDirectoryExists(workspacePath);

  const sqlitePath = resolveSqlitePath(runtimeEnv.DATABASE_URL, process.cwd());
  if (sqlitePath) {
    await ensureDirectoryExists(path.dirname(sqlitePath));
  }

  if (!skipDbPush) {
    await runDbPush(runtimeEnv);
  }

  console.log(`Workspace directory: ${workspacePath}`);
  console.log(`Package assets: ${packageRootDir}`);
  console.log(`Next step: reagent service run --port ${DEFAULT_GATEWAY_PORT}`);
}

async function startCommand(options: ParsedOptions): Promise<void> {
  applyRuntimeOverrides(options);
  process.env.NODE_ENV ??= "production";
  await import("./server.js");
}

function applyGatewayDefaults(options: ParsedOptions): void {
  if (getStringFlag(options, "port") === undefined && process.env.PORT === undefined) {
    process.env.PORT = String(DEFAULT_GATEWAY_PORT);
  }
}

async function gatewayRunCommand(options: ParsedOptions): Promise<void> {
  applyGatewayDefaults(options);
  applyRuntimeOverrides(options);
  process.env.NODE_ENV ??= "production";
  const cwd = process.cwd();
  await writeManagedGatewayPid(cwd);
  installManagedGatewayPidCleanup(cwd);
  await import("./server.js");
}

function renderGatewayHelp(): void {
  console.log(`ReAgent Gateway (Legacy Alias)

Foreground:
  reagent gateway
  reagent gateway run
  reagent gateway health
  reagent gateway probe

Service:
  reagent gateway install
  reagent gateway status
  reagent gateway start
  reagent gateway stop
  reagent gateway restart
  reagent gateway uninstall
  reagent gateway logs

Notes:
  - Gateway commands default to port ${DEFAULT_GATEWAY_PORT}
  - "reagent service ..." is the preferred control surface for supervised runtime control
  - "reagent gateway ..." is kept as a compatibility alias
  - "reagent daemon ..." is available as an OpenClaw-style compatibility alias
  - macOS uses launchd, Linux uses systemd user services, Windows uses Scheduled Task with Startup-folder fallback
  - Use --deep with "status" to scan for duplicate gateway installs on this host

Flags:
  --no-probe                Skip the live health probe for "status"
  --require-rpc             Exit non-zero when "probe" cannot reach the runtime RPC surface
`);
}

async function gatewayInstallCommand(options: ParsedOptions): Promise<void> {
  const port = getStringFlag(options, "port");
  const snapshot = await installGatewayService({
    force: getBooleanFlag(options, "force"),
    ...(port ? { port } : {}),
    workingDirectory: process.cwd(),
  });
  printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
}

async function gatewayStatusCommand(options: ParsedOptions): Promise<void> {
  const snapshot = await getGatewayServiceStatus(getStringFlag(options, "port"), {
    deep: getBooleanFlag(options, "deep"),
    probe: !getBooleanFlag(options, "no-probe"),
  });
  printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
}

async function gatewayProbeRuntime(baseUrl: string, timeoutMs: number): Promise<GatewayProbePayload> {
  try {
    const health = await requestGatewayJson<GatewayHealthPayload>(baseUrl, "/health", {
      timeoutMs,
    });
    try {
      const runtime = await requestGatewayJson<RuntimeMetaPayload>(baseUrl, "/api/runtime/meta", {
        timeoutMs,
      });
      return {
        url: baseUrl,
        healthReachable: true,
        healthStatus: health.status,
        rpcReachable: true,
        agent: runtime.agent,
        workspaceDir: runtime.workspaceDir,
        llmProvider: runtime.llmProvider,
        wechatProvider: runtime.wechatProvider,
        error: null,
      };
    } catch (error) {
      return {
        url: baseUrl,
        healthReachable: true,
        healthStatus: health.status,
        rpcReachable: false,
        agent: health.agent,
        workspaceDir: null,
        llmProvider: null,
        wechatProvider: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } catch (error) {
    return {
      url: baseUrl,
      healthReachable: false,
      healthStatus: null,
      rpcReachable: false,
      agent: null,
      workspaceDir: null,
      llmProvider: null,
      wechatProvider: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function gatewayProbeCommand(options: ParsedOptions): Promise<void> {
  const timeoutMs = resolveGatewayTimeoutMs(options);
  const explicitUrl = getStringFlag(options, "url", "gateway-url");
  const baseUrl =
    explicitUrl
      ? normalizeGatewayBaseUrl(explicitUrl)
      : (await resolveGatewayContext(options)).baseUrl;
  const payload = await gatewayProbeRuntime(baseUrl, timeoutMs);

  if (getBooleanFlag(options, "require-rpc") && !payload.rpcReachable) {
    throw new Error(payload.error ?? `Gateway probe could not reach the runtime RPC surface at ${payload.url}.`);
  }

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Gateway URL: ${payload.url}`);
  console.log(`Health reachable: ${formatYesNo(payload.healthReachable)}`);
  console.log(`Health status: ${formatWhen(payload.healthStatus)}`);
  console.log(`Runtime RPC reachable: ${formatYesNo(payload.rpcReachable)}`);
  console.log(`Agent: ${formatWhen(payload.agent)}`);
  console.log(`Workspace: ${formatWhen(payload.workspaceDir)}`);
  console.log(`LLM provider: ${formatWhen(payload.llmProvider)}`);
  console.log(`WeChat provider: ${formatWhen(payload.wechatProvider)}`);
  if (payload.error) {
    console.log(`Error: ${payload.error}`);
  }
}

async function gatewayStartCommand(options: ParsedOptions): Promise<void> {
  const snapshot = await startGatewayService();
  printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
}

async function gatewayStopCommand(options: ParsedOptions): Promise<void> {
  const snapshot = await stopGatewayService();
  if (getBooleanFlag(options, "json")) {
    printGatewayStatus(snapshot, true);
    return;
  }
  console.log("Gateway stop sent.");
  printGatewayStatus(snapshot, false);
}

async function gatewayRestartCommand(options: ParsedOptions): Promise<void> {
  const snapshot = await restartGatewayService();
  printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
}

async function gatewayUninstallCommand(options: ParsedOptions): Promise<void> {
  await uninstallGatewayService();
  if (getBooleanFlag(options, "json")) {
    printJson({ ok: true, uninstalled: true });
    return;
  }
  console.log("Gateway service uninstalled.");
}

async function gatewayLogsCommand(options: ParsedOptions): Promise<void> {
  const lines = getIntegerFlag(options, "lines") ?? 40;
  const stdoutTail = await readGatewayLogTail("out", lines);
  const stderrTail = await readGatewayLogTail("err", lines);
  console.log("---STDOUT---");
  console.log(stdoutTail || "(empty)");
  console.log("---STDERR---");
  console.log(stderrTail || "(empty)");
}

async function gatewayCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderGatewayHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined) {
    await gatewayRunCommand(options);
    return;
  }

  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    renderGatewayHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "run") {
    await gatewayRunCommand(subOptions);
    return;
  }
  if (subcommand === "health") {
    await healthCommand(subOptions);
    return;
  }
  if (subcommand === "probe") {
    await gatewayProbeCommand(subOptions);
    return;
  }
  if (subcommand === "install") {
    await gatewayInstallCommand(subOptions);
    return;
  }
  if (subcommand === "status") {
    await gatewayStatusCommand(subOptions);
    return;
  }
  if (subcommand === "start") {
    await gatewayStartCommand(subOptions);
    return;
  }
  if (subcommand === "stop") {
    await gatewayStopCommand(subOptions);
    return;
  }
  if (subcommand === "restart") {
    await gatewayRestartCommand(subOptions);
    return;
  }
  if (subcommand === "uninstall") {
    await gatewayUninstallCommand(subOptions);
    return;
  }
  if (subcommand === "logs") {
    await gatewayLogsCommand(subOptions);
    return;
  }

  throw new Error(`Unknown gateway command: ${subcommand}`);
}

async function runtimeCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderRuntimeHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "status") {
    await statusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    renderRuntimeHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "health") {
    await healthCommand(subOptions);
    return;
  }
  if (subcommand === "dashboard") {
    await dashboardCommand(subOptions);
    return;
  }
  if (subcommand === "logs") {
    await logsCommand(subOptions);
    return;
  }
  if (subcommand === "doctor") {
    await doctorCommand(subOptions);
    return;
  }

  throw new Error(`Unknown runtime command: ${subcommand}`);
}

async function serviceCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderServiceHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "status") {
    await gatewayStatusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    renderServiceHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "run") {
    await gatewayRunCommand(subOptions);
    return;
  }
  if (subcommand === "install") {
    await gatewayInstallCommand(subOptions);
    return;
  }
  if (subcommand === "start") {
    await gatewayStartCommand(subOptions);
    return;
  }
  if (subcommand === "stop") {
    await gatewayStopCommand(subOptions);
    return;
  }
  if (subcommand === "restart") {
    await gatewayRestartCommand(subOptions);
    return;
  }
  if (subcommand === "uninstall") {
    await gatewayUninstallCommand(subOptions);
    return;
  }
  if (subcommand === "logs") {
    await gatewayLogsCommand(subOptions);
    return;
  }

  throw new Error(`Unknown service command: ${subcommand}`);
}

async function healthCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const health = await requestGatewayJson<GatewayHealthPayload>(context.baseUrl, "/health", {
    timeoutMs: context.timeoutMs,
  });
  const verbose = getBooleanFlag(options, "verbose", "deep");
  const runtime =
    verbose
      ? await requestGatewayJson<RuntimeMetaPayload>(context.baseUrl, "/api/runtime/meta", {
          timeoutMs: context.timeoutMs,
        })
      : null;
  const payload = {
    url: context.baseUrl,
    health,
    ...(runtime ? { runtime } : {}),
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Gateway URL: ${context.baseUrl}`);
  console.log(`Status: ${health.status}`);
  console.log(`Agent: ${health.agent}`);
  console.log(`Time: ${health.time}`);
  if (runtime) {
    console.log(`Workspace: ${runtime.workspaceDir}`);
    console.log(`LLM: ${runtime.llmProvider}/${runtime.llmModel}${runtime.llmWireApi ? ` via ${runtime.llmWireApi}` : ""}`);
    console.log(`WeChat provider: ${runtime.wechatProvider}`);
    console.log(`Health URL: ${runtime.deployment.gateway.runtime.healthUrl}`);
  }
}

async function statusCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const detailed = getBooleanFlag(options, "all", "verbose");
  const [runtimeResult, channelsResult, memoryResult, localGateway] = await Promise.all([
    settleCliRequest(
      requestGatewayJson<RuntimeMetaPayload>(context.baseUrl, "/api/runtime/meta", {
        timeoutMs: context.timeoutMs,
      }),
    ),
    settleCliRequest(
      requestGatewayJson<ChannelsStatusSnapshot>(context.baseUrl, "/api/channels/status", {
        timeoutMs: context.timeoutMs,
      }),
    ),
    settleCliRequest(
      requestGatewayJson<MemoryStatus>(context.baseUrl, "/api/memory/status", {
        timeoutMs: context.timeoutMs,
      }),
    ),
    maybeReadLocalGatewayStatus(context.baseUrl, context.runtimeEnv.PORT, getBooleanFlag(options, "deep", "all")),
  ]);
  const gateway = localGateway ?? (runtimeResult.ok ? runtimeResult.value.deployment.gateway.supervisor : null);
  if (!gateway) {
    const [firstError] = summarizeCliWarnings([runtimeResult, channelsResult, memoryResult]);
    throw new Error(firstError ?? "Runtime status is unavailable.");
  }

  const runtime = runtimeResult.ok ? runtimeResult.value : buildFallbackRuntimeMeta(context, gateway, runtimeResult.error);
  const channels = channelsResult.ok
    ? channelsResult.value
    : await buildFallbackChannelsSnapshot(context.runtimeEnv, gateway, channelsResult.error, detailed);
  const memory = memoryResult.ok ? memoryResult.value : buildFallbackMemoryStatus(context.runtimeEnv);
  const warnings = summarizeCliWarnings([runtimeResult, channelsResult, memoryResult]);
  const payload = {
    url: context.baseUrl,
    degraded: warnings.length > 0,
    ...(warnings.length > 0 ? { warnings } : {}),
    runtime,
    channels,
    memory,
    gateway,
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
    console.log("");
  }

  console.log(`Gateway URL: ${context.baseUrl}`);
  console.log(`Health URL: ${runtime.deployment.gateway.runtime.healthUrl}`);
  console.log(`Agent: ${runtime.agent}`);
  console.log(`LLM: ${runtime.llmProvider}/${runtime.llmModel}${runtime.llmWireApi ? ` via ${runtime.llmWireApi}` : ""}`);
  console.log(`WeChat provider: ${runtime.wechatProvider}`);
  console.log(`Workspace: ${runtime.workspaceDir}`);
  console.log(`MCP: ${runtime.mcp.status} (${runtime.mcp.connectors} connector(s))`);
  console.log(`Channel connected: ${formatYesNo(channels.channels.wechat.connected)}`);
  console.log(`Memory files: ${memory.files}`);
  console.log(`Memory updated: ${formatWhen(memory.lastUpdatedAt)}`);
  console.log("");
  printGatewayStatus(gateway, false);
  if (!detailed) {
    return;
  }

  console.log("");
  console.log("WeChat:");
  printWeChatStatus(channels.channels.wechat);
  console.log("");
  console.log("Memory:");
  printMemoryStatus(memory);
}

async function dashboardCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const url = `${context.baseUrl}/`;
  const shouldOpen = !getBooleanFlag(options, "no-open");
  const opened = shouldOpen ? await openUrlInBrowser(url) : false;
  const payload = {
    url,
    opened,
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Dashboard: ${url}`);
  if (shouldOpen) {
    console.log(opened ? "Opened the dashboard in the default browser." : "Could not open the browser automatically.");
  }
}

async function logsCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "json") && getBooleanFlag(options, "follow")) {
    throw new Error('logs --follow does not support --json. Use plain text output for streaming logs.');
  }

  const context = await resolveGatewayContext(options);
  const lines = Math.max(20, Math.min(getIntegerFlag(options, "lines", "limit") ?? 120, 400));
  const payload = await requestGatewayJson<RuntimeLogPayload>(
    context.baseUrl,
    `/api/ui/runtime-log?${buildQueryString({ lines })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Source: ${payload.source}`);
  console.log(`Lines: ${payload.lines}`);
  console.log(`Stdout log: ${payload.stdout.path ?? "-"}`);
  console.log("---STDOUT---");
  console.log(payload.stdout.content || "(empty)");
  console.log(`Stderr log: ${payload.stderr.path ?? "-"}`);
  console.log("---STDERR---");
  console.log(payload.stderr.content || "(empty)");

  if (!getBooleanFlag(options, "follow")) {
    return;
  }

  const pollMs = Math.max(250, Math.min(getIntegerFlag(options, "poll", "poll-ms") ?? 2_000, 60_000));
  let previousPayload = payload;

  for (;;) {
    await sleep(pollMs);
    const nextPayload = await requestGatewayJson<RuntimeLogPayload>(
      context.baseUrl,
      `/api/ui/runtime-log?${buildQueryString({ lines })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );
    const stdoutDelta = renderLogDelta("STDOUT", previousPayload.stdout.content, nextPayload.stdout.content);
    const stderrDelta = renderLogDelta("STDERR", previousPayload.stderr.content, nextPayload.stderr.content);
    for (const line of [...stdoutDelta, ...stderrDelta]) {
      console.log(line);
    }
    previousPayload = nextPayload;
  }
}

async function channelsStatusCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const probeRequested = getBooleanFlag(options, "probe", "deep");
  const payload = await settleCliRequest(
    requestGatewayJson<ChannelsStatusSnapshot>(context.baseUrl, "/api/channels/status", {
      timeoutMs: context.timeoutMs,
    }),
  );

  if (payload.ok) {
    if (getBooleanFlag(options, "json")) {
      printJson(payload.value);
      return;
    }

    console.log(`Channels: ${payload.value.channelOrder.map((id) => payload.value.channelLabels[id] ?? id).join(", ")}`);
    console.log("");
    printWeChatStatus(payload.value.channels.wechat);
    return;
  }

  const gateway = await maybeReadLocalGatewayStatus(context.baseUrl, context.runtimeEnv.PORT, probeRequested);
  if (!gateway) {
    throw new Error(payload.error);
  }
  const fallback = await buildFallbackChannelsSnapshot(context.runtimeEnv, gateway, payload.error, probeRequested);

  if (getBooleanFlag(options, "json")) {
    printJson(fallback);
    return;
  }

  console.log("Channels: WeChat");
  console.log("Mode: local fallback");
  console.log("");
  printWeChatStatus(fallback.channels.wechat);
}

async function channelsLogsCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit", "lines") ?? 20, 100));
  const payload = await requestGatewayJson<ChannelLifecyclePayload>(
    context.baseUrl,
    `/api/channels/wechat/lifecycle-audit?${buildQueryString({ limit })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  if (payload.items.length === 0) {
    console.log("No channel lifecycle records found.");
    return;
  }

  for (const item of payload.items) {
    console.log(`${formatWhen(item.ts)} event=${item.event} state=${formatWhen(item.state)}`);
    if (item.reason) {
      console.log(`Reason: ${item.reason}`);
    }
    if (item.details) {
      console.log(`Details: ${JSON.stringify(item.details)}`);
    }
    console.log("");
  }
}

async function channelsMessagesCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit", "lines") ?? 20, 100));
  const payload = await requestGatewayJson<ChannelMessagesPayload>(
    context.baseUrl,
    "/api/channels/wechat/messages",
    {
      timeoutMs: context.timeoutMs,
    },
  );
  const messages = payload.messages.slice(-limit);

  if (getBooleanFlag(options, "json")) {
    printJson({ messages });
    return;
  }

  if (messages.length === 0) {
    console.log("No channel messages found.");
    return;
  }

  for (const message of messages) {
    const sender = message.senderName?.trim() || message.senderId?.trim() || "-";
    console.log(`${message.createdAt} ${message.direction} ${sender}`);
    console.log(message.text);
    console.log("");
  }
}

async function channelsChatCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const payload = resolveMessagePayload(options, 1);
  const result = await requestGatewayJson<{ accepted: boolean; reply: string; researchTaskId?: string }>(
    context.baseUrl,
    "/api/channels/wechat/chat",
    {
      method: "POST",
      body: payload,
      timeoutMs: Math.max(context.timeoutMs, 60_000),
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson({ ...payload, ...result });
    return;
  }

  printChannelInboundResult(result);
}

async function channelsInboundCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const payload = resolveMessagePayload(options, 1);
  const result = await requestGatewayJson<{ accepted: boolean; reply: string; researchTaskId?: string }>(
    context.baseUrl,
    "/api/channels/wechat/inbound",
    {
      method: "POST",
      body: payload,
      timeoutMs: Math.max(context.timeoutMs, 60_000),
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson({ ...payload, ...result });
    return;
  }

  printChannelInboundResult(result);
}

async function channelsPushCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const payload = resolveMessagePayload(options, 1);
  const result = await requestGatewayJson<{ accepted: boolean; reply: string; researchTaskId?: string }>(
    context.baseUrl,
    "/api/channels/wechat/push",
    {
      method: "POST",
      body: payload,
      timeoutMs: Math.max(context.timeoutMs, 60_000),
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson({ ...payload, ...result });
    return;
  }

  printChannelInboundResult(result);
}

async function channelsSessionsCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
  const payload = await requestGatewayJson<ChannelSessionsPayload>(
    context.baseUrl,
    "/api/channels/wechat/agent/sessions",
    {
      timeoutMs: context.timeoutMs,
    },
  );
  const sessions = payload.sessions.slice(0, limit);

  if (getBooleanFlag(options, "json")) {
    printJson({ sessions });
    return;
  }

  if (sessions.length === 0) {
    console.log("No agent sessions found.");
    return;
  }

  for (const session of sessions) {
    console.log(`${session.sessionId} sender=${session.senderId} updated=${session.updatedAt}`);
    console.log(
      `Role=${session.roleLabel} Model=${session.providerLabel}/${session.modelLabel}${session.wireApi ? ` via ${session.wireApi}` : ""} Turns=${session.turnCount}`,
    );
    console.log(`Skills=${session.skillLabels.join(", ") || "-"}`);
    console.log("");
  }
}

async function fetchAgentSessionSummary(context: GatewayContext, senderId: string): Promise<AgentSessionSummary> {
  return requestGatewayJson<AgentSessionSummary>(
    context.baseUrl,
    `/api/channels/wechat/agent?${buildQueryString({ senderId })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );
}

async function channelsAgentSessionsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
  const payload = await requestGatewayJson<ChannelSessionsPayload>(
    context.baseUrl,
    "/api/channels/wechat/agent/sessions",
    {
      timeoutMs: context.timeoutMs,
    },
  );
  const sessions = payload.sessions.slice(0, limit);

  if (getBooleanFlag(options, "json")) {
    printJson({ sessions });
    return;
  }

  if (sessions.length === 0) {
    console.log("No agent sessions found.");
    return;
  }

  for (const session of sessions) {
    console.log(`${session.senderId} role=${session.roleId} updated=${session.updatedAt}`);
    console.log(
      `Model=${session.providerId}/${session.modelId}${session.wireApi ? ` via ${session.wireApi}` : ""} Turns=${session.turnCount}`,
    );
    console.log(`Skills=${session.skillIds.join(", ") || "-"}`);
    console.log("");
  }
}

async function channelsAgentSessionCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const senderId = resolveSenderId(options);
  const summary = await fetchAgentSessionSummary(context, senderId);

  if (getBooleanFlag(options, "json")) {
    printJson({ senderId, ...summary });
    return;
  }

  console.log(`Sender: ${senderId}`);
  printAgentSessionSummary(summary);
}

async function channelsAgentRoleCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const senderId = resolveSenderId(options);
  const roleId = options.positionals[1]?.trim();

  if (!roleId) {
    const summary = await fetchAgentSessionSummary(context, senderId);
    if (getBooleanFlag(options, "json")) {
      printJson({ senderId, roleId: summary.roleId, roleLabel: summary.roleLabel, availableRoles: summary.availableRoles });
      return;
    }
    console.log(`Sender: ${senderId}`);
    console.log(`Current role: ${summary.roleLabel} (${summary.roleId})`);
    console.log(`Available roles: ${summary.availableRoles.map((role) => `${role.id} (${role.label})`).join(", ") || "-"}`);
    return;
  }

  const summary = await requestGatewayJson<AgentSessionSummary>(context.baseUrl, "/api/channels/wechat/agent/role", {
    method: "POST",
    body: {
      senderId,
      roleId,
    },
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson({ senderId, ...summary });
    return;
  }

  console.log(`Sender: ${senderId}`);
  console.log(`Role updated to ${summary.roleLabel} (${summary.roleId})`);
}

async function channelsAgentSkillsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const senderId = resolveSenderId(options);
  const raw = options.positionals.slice(1).join(" ").trim();

  if (!raw) {
    const summary = await fetchAgentSessionSummary(context, senderId);
    if (getBooleanFlag(options, "json")) {
      printJson({ senderId, skillIds: summary.skillIds, skillLabels: summary.skillLabels, availableSkills: summary.availableSkills });
      return;
    }
    console.log(`Sender: ${senderId}`);
    console.log(`Current skills: ${summary.skillLabels.join(", ") || "-"}`);
    console.log(`Available skills: ${summary.availableSkills.map((skill) => `${skill.id} (${skill.label})`).join(", ") || "-"}`);
    return;
  }

  const skillIds = parseSkillSelections(raw);
  if (skillIds.length === 0) {
    throw new Error("No valid skill ids were provided.");
  }

  const summary = await requestGatewayJson<AgentSessionSummary>(context.baseUrl, "/api/channels/wechat/agent/skills", {
    method: "POST",
    body: {
      senderId,
      skillIds,
    },
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson({ senderId, ...summary });
    return;
  }

  console.log(`Sender: ${senderId}`);
  console.log(`Skills updated: ${summary.skillLabels.join(", ") || "-"}`);
}

async function channelsAgentModelCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const senderId = resolveSenderId(options);
  const arg1 = options.positionals[1]?.trim();
  const arg2 = options.positionals[2]?.trim();

  if (!arg1) {
    const summary = await fetchAgentSessionSummary(context, senderId);
    if (getBooleanFlag(options, "json")) {
      printJson({
        senderId,
        providerId: summary.providerId,
        providerLabel: summary.providerLabel,
        modelId: summary.modelId,
        modelLabel: summary.modelLabel,
        wireApi: summary.wireApi,
        availableLlmProviders: summary.availableLlmProviders,
      });
      return;
    }
    console.log(`Sender: ${senderId}`);
    console.log(
      `Current model: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
    );
    console.log(
      `Available providers: ${summary.availableLlmProviders.map((provider) => provider.id).join(", ") || "-"}`,
    );
    return;
  }

  if (["clear", "reset", "default", "none"].includes(arg1.toLowerCase())) {
    const summary = await requestGatewayJson<AgentSessionSummary>(context.baseUrl, "/api/channels/wechat/agent/model", {
      method: "POST",
      body: {
        senderId,
      },
      timeoutMs: context.timeoutMs,
    });
    if (getBooleanFlag(options, "json")) {
      printJson({ senderId, ...summary });
      return;
    }
    console.log(`Sender: ${senderId}`);
    console.log(
      `Model reset to ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
    );
    return;
  }

  if (!arg2) {
    throw new Error("channels agent model requires both providerId and modelId, or 'clear'.");
  }

  const summary = await requestGatewayJson<AgentSessionSummary>(context.baseUrl, "/api/channels/wechat/agent/model", {
    method: "POST",
    body: {
      senderId,
      providerId: arg1,
      modelId: arg2,
    },
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson({ senderId, ...summary });
    return;
  }

  console.log(`Sender: ${senderId}`);
  console.log(
    `Model updated to ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
  );
}

async function channelsAgentFallbacksCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const senderId = resolveSenderId(options);
  const raw = options.positionals.slice(1).join(" ").trim();

  if (!raw) {
    const summary = await fetchAgentSessionSummary(context, senderId);
    if (getBooleanFlag(options, "json")) {
      printJson({ senderId, fallbackRoutes: summary.fallbackRoutes });
      return;
    }
    console.log(`Sender: ${senderId}`);
    console.log(
      `Fallbacks: ${
        summary.fallbackRoutes.length > 0
          ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
          : "none"
      }`,
    );
    return;
  }

  const routes =
    ["clear", "reset", "none"].includes(raw.toLowerCase()) ? [] : parseFallbackSelections(raw);

  if (!["clear", "reset", "none"].includes(raw.toLowerCase()) && routes.length === 0) {
    throw new Error("No valid fallback routes were provided.");
  }

  const summary = await requestGatewayJson<AgentSessionSummary>(
    context.baseUrl,
    "/api/channels/wechat/agent/fallbacks",
    {
      method: "POST",
      body: {
        senderId,
        routes,
      },
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson({ senderId, ...summary });
    return;
  }

  console.log(`Sender: ${senderId}`);
  console.log(
    `Fallbacks updated: ${
      summary.fallbackRoutes.length > 0
        ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
        : "none"
    }`,
  );
}

async function channelsAgentReasoningCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const senderId = resolveSenderId(options);
  const reasoningEffort = options.positionals[1]?.trim();

  if (!reasoningEffort) {
    const summary = await fetchAgentSessionSummary(context, senderId);
    if (getBooleanFlag(options, "json")) {
      printJson({
        senderId,
        reasoningEffort: summary.reasoningEffort,
        availableReasoningEfforts: summary.availableReasoningEfforts,
      });
      return;
    }
    console.log(`Sender: ${senderId}`);
    console.log(`Current reasoning: ${summary.reasoningEffort}`);
    console.log(`Available reasoning: ${summary.availableReasoningEfforts.join(", ") || "-"}`);
    return;
  }

  const summary = await requestGatewayJson<AgentSessionSummary>(
    context.baseUrl,
    "/api/channels/wechat/agent/reasoning",
    {
      method: "POST",
      body: {
        senderId,
        reasoningEffort,
      },
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson({ senderId, ...summary });
    return;
  }

  console.log(`Sender: ${senderId}`);
  console.log(`Reasoning updated to ${summary.reasoningEffort}`);
}

async function printLoginPreview(result: WeChatLoginStartResult): Promise<void> {
  console.log(result.message);
  if (result.pairingCode) {
    console.log(`Pairing code: ${result.pairingCode}`);
    const qr = await renderTerminalQr(result.pairingCode);
    if (qr) {
      console.log(qr);
    }
  }
  if (result.qrDataUrl) {
    console.log("QR image is available in the dashboard/UI flow.");
  }
}

async function channelsLoginCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const displayName = getStringFlag(options, "display-name", "name");
  const startBody = {
    force: getBooleanFlag(options, "force"),
    ...(displayName ? { displayName } : {}),
  };
  const startResult = await requestGatewayJson<WeChatLoginStartResult>(
    context.baseUrl,
    "/api/channels/wechat/login/start",
    {
      method: "POST",
      body: startBody,
      timeoutMs: Math.max(context.timeoutMs, 30_000),
    },
  );

  if (getBooleanFlag(options, "wait")) {
    const completeResult = await requestGatewayJson<WeChatChannelStatus>(
      context.baseUrl,
      "/api/channels/wechat/login/complete",
      {
        method: "POST",
        body: displayName ? { displayName } : {},
        timeoutMs: Math.max(context.timeoutMs, 120_000),
      },
    );

    if (getBooleanFlag(options, "json")) {
      printJson({ start: startResult, complete: completeResult });
      return;
    }

    await printLoginPreview(startResult);
    console.log("");
    printWeChatStatus(completeResult);
    return;
  }

  if (getBooleanFlag(options, "json")) {
    printJson(startResult);
    return;
  }

  await printLoginPreview(startResult);
}

async function channelsWaitCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const displayName = getStringFlag(options, "display-name", "name");
  const result = await requestGatewayJson<WeChatChannelStatus>(
    context.baseUrl,
    "/api/channels/wechat/login/complete",
    {
      method: "POST",
      body: displayName ? { displayName } : {},
      timeoutMs: Math.max(context.timeoutMs, 120_000),
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  printWeChatStatus(result);
}

async function channelsLogoutCommand(options: ParsedOptions): Promise<void> {
  ensureSupportedChannel(options);
  const context = await resolveGatewayContext(options);
  const result = await requestGatewayJson<WeChatChannelStatus>(
    context.baseUrl,
    "/api/channels/wechat/logout",
    {
      method: "POST",
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  printWeChatStatus(result);
}

async function channelsAgentCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderChannelsAgentHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "sessions") {
    await channelsAgentSessionsCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderChannelsAgentHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "session" || subcommand === "show" || subcommand === "status") {
    await channelsAgentSessionCommand(subOptions);
    return;
  }
  if (subcommand === "role") {
    await channelsAgentRoleCommand(subOptions);
    return;
  }
  if (subcommand === "skills") {
    await channelsAgentSkillsCommand(subOptions);
    return;
  }
  if (subcommand === "model") {
    await channelsAgentModelCommand(subOptions);
    return;
  }
  if (subcommand === "fallbacks") {
    await channelsAgentFallbacksCommand(subOptions);
    return;
  }
  if (subcommand === "reasoning") {
    await channelsAgentReasoningCommand(subOptions);
    return;
  }

  throw new Error(`Unknown channels agent command: ${subcommand}`);
}

async function channelsCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderChannelsHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "status") {
    await channelsStatusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderChannelsHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "list") {
    await channelsStatusCommand(subOptions);
    return;
  }
  if (subcommand === "logs") {
    await channelsLogsCommand(subOptions);
    return;
  }
  if (subcommand === "messages") {
    await channelsMessagesCommand(subOptions);
    return;
  }
  if (subcommand === "chat") {
    await channelsChatCommand(subOptions);
    return;
  }
  if (subcommand === "inbound") {
    await channelsInboundCommand(subOptions);
    return;
  }
  if (subcommand === "push" || subcommand === "send") {
    await channelsPushCommand(subOptions);
    return;
  }
  if (subcommand === "sessions") {
    await channelsSessionsCommand(subOptions);
    return;
  }
  if (subcommand === "agent") {
    await channelsAgentCommand(subOptions);
    return;
  }
  if (subcommand === "login") {
    await channelsLoginCommand(subOptions);
    return;
  }
  if (subcommand === "wait") {
    await channelsWaitCommand(subOptions);
    return;
  }
  if (subcommand === "logout") {
    await channelsLogoutCommand(subOptions);
    return;
  }

  throw new Error(`Unknown channels command: ${subcommand}`);
}

async function memoryStatusCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const status = await requestGatewayJson<MemoryStatus>(context.baseUrl, "/api/memory/status", {
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(status);
    return;
  }

  printMemoryStatus(status);
}

async function memoryFilesCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 100, 500));
  const payload = await requestGatewayJson<MemoryFilesPayload>(context.baseUrl, "/api/memory/files", {
    timeoutMs: context.timeoutMs,
  });
  const files = payload.files.slice(0, limit);

  if (getBooleanFlag(options, "json")) {
    printJson({ files });
    return;
  }

  printMemoryFiles(files);
}

async function memoryFileCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const filePath = getStringFlag(options, "path") ?? options.positionals[0];
  if (!filePath) {
    throw new Error("memory file requires a path. Example: reagent memory file MEMORY.md");
  }

  const file = await requestGatewayJson<MemoryFileContent>(
    context.baseUrl,
    `/api/memory/file?${buildQueryString({ path: filePath })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(file);
    return;
  }

  printMemoryFile(file);
}

async function memorySearchCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const query = getQueryInput(options);
  if (!query) {
    throw new Error("memory search requires a query. Example: reagent memory search model routing");
  }

  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 6, 20));
  const payload = await requestGatewayJson<{ query: string; results: MemorySearchResult[] }>(
    context.baseUrl,
    `/api/memory/search?${buildQueryString({ q: query, limit })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Query: ${payload.query}`);
  console.log("");
  printMemorySearchResults(payload.results);
}

async function memoryRecallCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const query = getQueryInput(options);
  if (!query) {
    throw new Error("memory recall requires a query. Example: reagent memory recall prior research choices");
  }

  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 6, 20));
  const payload = await requestGatewayJson<MemoryRecallResult>(
    context.baseUrl,
    `/api/memory/recall?${buildQueryString({
      q: query,
      limit,
      includeWorkspace: getBooleanFlag(options, "include-workspace"),
      includeArtifacts: getBooleanFlag(options, "include-artifacts"),
    })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Query: ${payload.query}`);
  console.log(`Generated: ${payload.generatedAt}`);
  console.log("");
  printMemoryRecallResults(payload);
}

async function memoryRememberCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const scope = getStringFlag(options, "scope") ?? "daily";
  if (scope !== "daily" && scope !== "long-term") {
    throw new Error(`Unsupported memory scope: ${scope}. Use "daily" or "long-term".`);
  }

  const content = getStringFlag(options, "content") ?? options.positionals.join(" ").trim();
  if (!content) {
    throw new Error("memory remember requires content. Example: reagent memory remember The user prefers evidence-led reports");
  }

  const title = getStringFlag(options, "title");
  const source = getStringFlag(options, "source");
  const body = {
    scope,
    content,
    ...(title ? { title } : {}),
    ...(source ? { source } : {}),
  };
  const result = await requestGatewayJson<MemoryFileContent>(context.baseUrl, "/api/memory/remember", {
    method: "POST",
    body,
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  printMemoryFile(result);
}

async function memoryPolicyCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const result = await requestGatewayJson<MemoryPolicy>(context.baseUrl, "/api/memory/policy", {
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  console.log(`Updated: ${result.updatedAt}`);
  console.log(`Auto compaction: ${formatYesNo(result.autoCompactionEnabled)}`);
  console.log(`Interval minutes: ${result.autoCompactionIntervalMinutes}`);
  console.log(`Older than days: ${result.autoCompactionOlderThanDays}`);
  console.log(`Min entries: ${result.autoCompactionMinEntries}`);
  console.log(`Max entries: ${result.autoCompactionMaxEntries}`);
  console.log(`Max daily entries before auto compact: ${result.maxDailyEntriesBeforeAutoCompact}`);
  console.log(`High-confidence long-term only: ${formatYesNo(result.highConfidenceLongTermOnly)}`);
  console.log(`Never compact tags: ${result.neverCompactTags.join(", ") || "-"}`);
}

async function memoryCompactCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const olderThanDays = getIntegerFlag(options, "older-than-days");
  const minEntries = getIntegerFlag(options, "min-entries");
  const maxEntries = getIntegerFlag(options, "max-entries");
  const body = {
    ...(olderThanDays !== undefined ? { olderThanDays } : {}),
    ...(minEntries !== undefined ? { minEntries } : {}),
    ...(maxEntries !== undefined ? { maxEntries } : {}),
    ...(getBooleanFlag(options, "dry-run") ? { dryRun: true } : {}),
  };
  const result = await requestGatewayJson<MemoryCompactionResult>(context.baseUrl, "/api/memory/compact", {
    method: "POST",
    body,
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  printMemoryCompactionResult(result);
}

async function memoryCompactionsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = Math.max(1, Math.min(getIntegerFlag(options, "limit") ?? 20, 100));
  const payload = await requestGatewayJson<MemoryCompactionsPayload>(
    context.baseUrl,
    `/api/memory/compactions?${buildQueryString({ limit })}`,
    {
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  printCompactionRecords(payload.items);
}

async function memoryCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderMemoryHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "status") {
    await memoryStatusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderMemoryHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "files") {
    await memoryFilesCommand(subOptions);
    return;
  }
  if (subcommand === "file") {
    await memoryFileCommand(subOptions);
    return;
  }
  if (subcommand === "search") {
    await memorySearchCommand(subOptions);
    return;
  }
  if (subcommand === "recall") {
    await memoryRecallCommand(subOptions);
    return;
  }
  if (subcommand === "remember") {
    await memoryRememberCommand(subOptions);
    return;
  }
  if (subcommand === "policy") {
    await memoryPolicyCommand(subOptions);
    return;
  }
  if (subcommand === "compact") {
    await memoryCompactCommand(subOptions);
    return;
  }
  if (subcommand === "compactions") {
    await memoryCompactionsCommand(subOptions);
    return;
  }

  throw new Error(`Unknown memory command: ${subcommand}`);
}

function resolveRequiredEntityId(options: ParsedOptions, label: string): string {
  const value = getStringFlag(options, "id") ?? options.positionals[0];
  if (!value?.trim()) {
    throw new Error(`${label} id is required.`);
  }
  return value.trim();
}

async function researchRunCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const report = await requestGatewayJson<ResearchReport>(context.baseUrl, "/api/research", {
    method: "POST",
    body: resolveResearchRequest(options),
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(report);
    return;
  }
  printResearchReport(report);
}

async function researchEnqueueCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const task = await requestGatewayJson<ResearchTaskSummary>(context.baseUrl, "/api/research/tasks", {
    method: "POST",
    body: resolveResearchRequest(options),
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(task);
    return;
  }
  printResearchTaskSummaries([task]);
}

async function researchRecentCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 10;
  const payload = await requestGatewayJson<ResearchRecentPayload>(
    context.baseUrl,
    `/api/research/recent?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchRecentReports(payload.reports);
}

async function researchTasksCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 20;
  const payload = await requestGatewayJson<ResearchTasksPayload>(
    context.baseUrl,
    `/api/research/tasks?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchTaskSummaries(payload.tasks);
}

async function researchTaskCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const taskId = resolveRequiredEntityId(options, "research task");
  const task = await requestGatewayJson<ResearchTaskDetail & { handoff?: ResearchTaskHandoff | null }>(
    context.baseUrl,
    `/api/research/tasks/${encodeURIComponent(taskId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(task);
    return;
  }
  printResearchTaskRecord(task);
}

async function researchReportCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const taskId = resolveRequiredEntityId(options, "research report");
  const report = await requestGatewayJson<ResearchReport>(
    context.baseUrl,
    `/api/research/${encodeURIComponent(taskId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(report);
    return;
  }
  printResearchReport(report);
}

async function researchRetryCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const taskId = resolveRequiredEntityId(options, "research task");
  const task = await requestGatewayJson<ResearchTaskSummary>(
    context.baseUrl,
    `/api/research/tasks/${encodeURIComponent(taskId)}/retry`,
    { method: "POST", timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(task);
    return;
  }
  printResearchTaskSummaries([task]);
}

async function researchHandoffCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const taskId = resolveRequiredEntityId(options, "research task");
  const handoff = await requestGatewayJson<ResearchTaskHandoff>(
    context.baseUrl,
    `/api/research/tasks/${encodeURIComponent(taskId)}/handoff`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(handoff);
    return;
  }

  printResearchTaskHandoff(handoff);
}

async function researchDirectionsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<ResearchDirectionsPayload>(context.baseUrl, "/api/research/directions", {
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDirections(payload.profiles);
}

async function researchDirectionGetCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const directionId = resolveRequiredEntityId(options, "research direction");
  const profile = await requestGatewayJson<ResearchDirectionProfile>(
    context.baseUrl,
    `/api/research/directions/${encodeURIComponent(directionId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(profile);
    return;
  }
  printResearchDirection(profile);
}

async function researchDirectionUpsertCommand(options: ParsedOptions): Promise<void> {
  const source = options.positionals[0]?.trim();
  if (!source) {
    throw new Error("research direction upsert requires a JSON file path or '-' for stdin.");
  }

  const raw = await readInputSource(source);
  const payload = raw.trim() ? (JSON.parse(raw) as unknown) : {};
  const context = await resolveGatewayContext(options);
  const result = await requestGatewayJson<ResearchDirectionProfile>(context.baseUrl, "/api/research/directions", {
    method: "POST",
    body: payload,
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson({ source, profile: result });
    return;
  }
  printResearchDirection(result);
}

async function researchDirectionBriefCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const directionId = resolveRequiredEntityId(options, "research direction");
  const markdown = await requestGatewayText(
    context.baseUrl,
    `/api/research/directions/${encodeURIComponent(directionId)}/brief-markdown`,
    { timeoutMs: context.timeoutMs },
  );
  const outPath = getStringFlag(options, "out");

  if (outPath) {
    const resolvedOutPath = path.resolve(process.cwd(), outPath);
    await mkdir(path.dirname(resolvedOutPath), { recursive: true });
    await writeFile(resolvedOutPath, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");
    if (getBooleanFlag(options, "json")) {
      printJson({ directionId, outPath: resolvedOutPath });
      return;
    }
    console.log(`Wrote research brief to ${resolvedOutPath}`);
    return;
  }

  if (getBooleanFlag(options, "json")) {
    printJson({ directionId, markdown });
    return;
  }
  process.stdout.write(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
}

async function researchDirectionPlanCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const directionId = resolveRequiredEntityId(options, "research direction");
  const payload = await requestGatewayJson<{
    profile: ResearchDirectionProfile;
    candidates: ResearchDiscoveryQueryCandidate[];
  }>(context.baseUrl, `/api/research/directions/${encodeURIComponent(directionId)}/plan`, {
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  printResearchDirection(payload.profile);
  console.log("");
  printResearchDiscoveryPlan(payload.candidates);
}

async function researchDirectionImportBriefCommand(options: ParsedOptions): Promise<void> {
  const source = options.positionals[0]?.trim();
  if (!source) {
    throw new Error("research direction import-brief requires a markdown file path or '-' for stdin.");
  }

  const markdown = await readInputSource(source);
  const directionId = getStringFlag(options, "id");
  const context = await resolveGatewayContext(options);
  const profile = await requestGatewayJson<ResearchDirectionProfile>(
    context.baseUrl,
    "/api/research/directions/import-markdown",
    {
      method: "POST",
      body: {
        markdown,
        ...(directionId ? { id: directionId } : {}),
      },
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson({ source, profile });
    return;
  }
  printResearchDirection(profile);
}

async function researchDirectionDeleteCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const directionId = resolveRequiredEntityId(options, "research direction");
  await requestGatewayResponse(context.baseUrl, `/api/research/directions/${encodeURIComponent(directionId)}`, {
    method: "DELETE",
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson({ directionId, deleted: true });
    return;
  }
  console.log(`Deleted research direction ${directionId}`);
}

async function researchDirectionCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderResearchHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (!subcommand) {
    renderResearchHelp();
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderResearchHelp();
    return;
  }

  if (subcommand === "upsert") {
    await researchDirectionUpsertCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "brief") {
    await researchDirectionBriefCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "plan") {
    await researchDirectionPlanCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "import-brief") {
    await researchDirectionImportBriefCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "delete" || subcommand === "remove" || subcommand === "rm") {
    await researchDirectionDeleteCommand(consumePositionals(options, 1));
    return;
  }

  await researchDirectionGetCommand(options);
}

async function researchDiscoveryPlanCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const directionId = getStringFlag(options, "direction", "id") ?? options.positionals[0];
  const payload = await requestGatewayJson<ResearchDiscoveryPlanPayload>(
    context.baseUrl,
    `/api/research/discovery-plan?${buildQueryString({
      ...(directionId?.trim() ? { directionId: directionId.trim() } : {}),
    })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDiscoveryPlan(payload.candidates);
}

async function researchDiscoveryRecentCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 10;
  const payload = await requestGatewayJson<ResearchDiscoveryRecentPayload>(
    context.baseUrl,
    `/api/research/discovery/recent?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDiscoveryRuns(payload.runs);
}

async function researchDiscoveryInspectCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const runId = resolveRequiredEntityId(options, "discovery run");
  const payload = await requestGatewayJson<ResearchDiscoveryRunResult>(
    context.baseUrl,
    `/api/research/discovery/runs/${encodeURIComponent(runId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDiscoveryRun(payload);
}

async function researchDiscoveryRunCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const directionId = getStringFlag(options, "direction");
  const topK = getIntegerFlag(options, "top-k", "topK");
  const maxPapersPerQuery = getIntegerFlag(options, "max-papers-per-query", "max-papers");
  const senderId = getStringFlag(options, "sender");
  const senderName = getStringFlag(options, "name", "sender-name");
  const payload = await requestGatewayJson<ResearchDiscoveryRunResult>(
    context.baseUrl,
    "/api/research/discovery/run",
    {
      method: "POST",
      body: {
        ...(directionId ? { directionId } : {}),
        ...(topK !== undefined ? { topK } : {}),
        ...(maxPapersPerQuery !== undefined ? { maxPapersPerQuery } : {}),
        ...(getBooleanFlag(options, "push", "push-to-wechat") ? { pushToWechat: true } : {}),
        ...(senderId ? { senderId } : {}),
        ...(senderName ? { senderName } : {}),
      },
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDiscoveryRun(payload);
}

async function researchDiscoverySchedulerStatusCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<ResearchDiscoverySchedulerStatus>(
    context.baseUrl,
    "/api/research/discovery/scheduler",
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchSchedulerStatus(payload);
}

async function researchDiscoverySchedulerSetCommand(options: ParsedOptions): Promise<void> {
  const enabled =
    getOptionalBooleanFlag(options, "enabled") ??
    (getBooleanFlag(options, "disable") ? false : undefined) ??
    (getBooleanFlag(options, "enable") ? true : undefined);
  const dailyTimeLocal = getStringFlag(options, "time", "daily-time", "dailyTimeLocal");
  const senderId = getStringFlag(options, "sender");
  const senderName = getStringFlag(options, "name", "sender-name");
  const directionIds = parseCommaSeparatedValues(getStringFlag(options, "direction-ids", "directions"));
  const topK = getIntegerFlag(options, "top-k", "topK");
  const maxPapersPerQuery = getIntegerFlag(options, "max-papers-per-query", "max-papers");

  const body = {
    ...(enabled !== undefined ? { enabled } : {}),
    ...(dailyTimeLocal ? { dailyTimeLocal } : {}),
    ...(senderId ? { senderId } : {}),
    ...(senderName ? { senderName } : {}),
    ...(directionIds.length > 0 ? { directionIds } : {}),
    ...(topK !== undefined ? { topK } : {}),
    ...(maxPapersPerQuery !== undefined ? { maxPapersPerQuery } : {}),
  };

  if (Object.keys(body).length === 0) {
    throw new Error("research discovery scheduler set requires at least one configuration flag.");
  }

  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<ResearchDiscoverySchedulerStatus>(
    context.baseUrl,
    "/api/research/discovery/scheduler",
    {
      method: "POST",
      body,
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchSchedulerStatus(payload);
}

async function researchDiscoverySchedulerTickCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<{
    results: ResearchDiscoveryRunResult[];
    status: ResearchDiscoverySchedulerStatus;
  }>(context.baseUrl, "/api/research/discovery/scheduler/tick", {
    method: "POST",
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  printResearchSchedulerStatus(payload.status);
  if (payload.results.length > 0) {
    console.log("");
    printResearchDiscoveryRuns(
      payload.results.map((item) => ({
        runId: item.runId,
        generatedAt: item.generatedAt,
        directionIds: item.directionIds,
        directionLabels: item.directionLabels,
        topTitle: item.items[0]?.title,
        itemCount: item.items.length,
        pushed: item.pushed,
      })),
    );
  }
}

async function researchDiscoverySchedulerCommand(options: ParsedOptions): Promise<void> {
  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "status") {
    await researchDiscoverySchedulerStatusCommand(
      subcommand === undefined ? options : consumePositionals(options, 1),
    );
    return;
  }
  if (subcommand === "set" || subcommand === "configure") {
    await researchDiscoverySchedulerSetCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "tick") {
    await researchDiscoverySchedulerTickCommand(consumePositionals(options, 1));
    return;
  }

  throw new Error(`Unknown research discovery scheduler command: ${subcommand}`);
}

async function researchDiscoveryCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderResearchHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "recent") {
    await researchDiscoveryRecentCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderResearchHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);
  if (subcommand === "plan") {
    await researchDiscoveryPlanCommand(subOptions);
    return;
  }
  if (subcommand === "inspect" || subcommand === "get") {
    await researchDiscoveryInspectCommand(subOptions);
    return;
  }
  if (subcommand === "run") {
    await researchDiscoveryRunCommand(subOptions);
    return;
  }
  if (subcommand === "scheduler") {
    await researchDiscoverySchedulerCommand(subOptions);
    return;
  }

  throw new Error(`Unknown research discovery command: ${subcommand}`);
}

async function researchFeedbackListCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 20;
  const payload = await requestGatewayJson<ResearchFeedbackPayload>(
    context.baseUrl,
    `/api/research/feedback?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchFeedback(payload.summary, payload.items);
}

async function researchFeedbackRecordCommand(options: ParsedOptions): Promise<void> {
  const feedback = getStringFlag(options, "kind") ?? options.positionals[0];
  if (!feedback?.trim()) {
    throw new Error("research feedback record requires a feedback kind.");
  }

  const senderId = getStringFlag(options, "sender");
  const senderName = getStringFlag(options, "name", "sender-name");
  const directionId = getStringFlag(options, "direction");
  const topic = getStringFlag(options, "topic");
  const paperTitle = getStringFlag(options, "paper-title", "paper");
  const venue = getStringFlag(options, "venue");
  const sourceUrl = getStringFlag(options, "source-url", "url");
  const notes = getStringFlag(options, "notes");

  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<ResearchFeedbackRecord>(context.baseUrl, "/api/research/feedback", {
    method: "POST",
    body: {
      feedback: feedback.trim(),
      ...(senderId ? { senderId } : {}),
      ...(senderName ? { senderName } : {}),
      ...(directionId ? { directionId } : {}),
      ...(topic ? { topic } : {}),
      ...(paperTitle ? { paperTitle } : {}),
      ...(venue ? { venue } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(notes ? { notes } : {}),
    },
    timeoutMs: context.timeoutMs,
  });

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  console.log(`Recorded feedback ${payload.feedback} at ${payload.createdAt}`);
}

async function researchFeedbackCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderResearchHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "list") {
    await researchFeedbackListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "record") {
    await researchFeedbackRecordCommand(consumePositionals(options, 1));
    return;
  }

  throw new Error(`Unknown research feedback command: ${subcommand}`);
}

function buildResearchGraphQueryString(options: ParsedOptions, extra: Record<string, string | number | boolean | undefined> = {}): string {
  const query = resolveResearchGraphQuery(options);
  return buildQueryString({
    ...(query.view ? { view: query.view } : {}),
    ...(query.types ? { types: query.types.join(",") } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.topic ? { topic: query.topic } : {}),
    ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
    ...(query.dateTo ? { dateTo: query.dateTo } : {}),
    ...extra,
  });
}

async function researchGraphShowCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<ResearchMemoryGraph>(
    context.baseUrl,
    `/api/research/memory-graph?${buildResearchGraphQueryString(options)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchGraph(payload);
}

async function researchGraphNodeCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const nodeId = resolveRequiredEntityId(options, "graph node");
  const payload = await requestGatewayJson<ResearchMemoryNodeDetail>(
    context.baseUrl,
    `/api/research/memory-graph/${encodeURIComponent(nodeId)}?${buildResearchGraphQueryString(options)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  console.log(`${payload.node.type}:${payload.node.label}`);
  console.log(`Links: ${payload.links.length}`);
  console.log(`Related nodes: ${payload.relatedNodes.length}`);
}

async function researchGraphPathCommand(options: ParsedOptions): Promise<void> {
  const from = getStringFlag(options, "from") ?? options.positionals[0];
  const to = getStringFlag(options, "to") ?? options.positionals[1];
  if (!from?.trim() || !to?.trim()) {
    throw new Error("research graph path requires both from and to node ids.");
  }

  const context = await resolveGatewayContext(options);
  const view = getStringFlag(options, "view");
  const payload = await requestGatewayJson<ResearchGraphPathPayload>(
    context.baseUrl,
    `/api/research/memory-graph/path?${buildQueryString({
      from: from.trim(),
      to: to.trim(),
      ...((view === "asset" || view === "paper") ? { view } : {}),
    })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchGraphPath(payload);
}

async function researchGraphExplainCommand(options: ParsedOptions): Promise<void> {
  const from = getStringFlag(options, "from") ?? options.positionals[0];
  const to = getStringFlag(options, "to") ?? options.positionals[1];
  if (!from?.trim() || !to?.trim()) {
    throw new Error("research graph explain requires both from and to node ids.");
  }

  const context = await resolveGatewayContext(options);
  const view = getStringFlag(options, "view");
  const payload = await requestGatewayJson<ResearchGraphExplainPayload>(
    context.baseUrl,
    `/api/research/memory-graph/explain?${buildQueryString({
      from: from.trim(),
      to: to.trim(),
      ...((view === "asset" || view === "paper") ? { view } : {}),
    })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchGraphPath(payload);
}

async function researchGraphReportCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 6;
  const payload = await requestGatewayJson<ResearchGraphReportPayload>(
    context.baseUrl,
    `/api/research/memory-graph/report?${buildResearchGraphQueryString(options, { limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchGraphReport(payload);
}

async function researchGraphCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderResearchHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "show") {
    await researchGraphShowCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "node") {
    await researchGraphNodeCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "path") {
    await researchGraphPathCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "explain") {
    await researchGraphExplainCommand(consumePositionals(options, 1));
    return;
  }
  if (subcommand === "report") {
    await researchGraphReportCommand(consumePositionals(options, 1));
    return;
  }

  throw new Error(`Unknown research graph command: ${subcommand}`);
}

async function researchArtifactCommand(options: ParsedOptions): Promise<void> {
  const artifactPath = options.positionals.join(" ").trim();
  if (!artifactPath) {
    throw new Error("research artifact requires a workspace-relative path.");
  }

  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayBytes(
    context.baseUrl,
    `/api/research/artifact?${buildQueryString({ path: artifactPath })}`,
    { timeoutMs: context.timeoutMs },
  );
  const outPath = getStringFlag(options, "out");

  if (outPath) {
    const resolvedOutPath = path.resolve(process.cwd(), outPath);
    await mkdir(path.dirname(resolvedOutPath), { recursive: true });
    await writeFile(resolvedOutPath, Buffer.from(payload.bytes));
    if (getBooleanFlag(options, "json")) {
      printJson({
        artifactPath,
        outPath: resolvedOutPath,
        contentType: payload.contentType,
        bytes: payload.bytes.length,
      });
      return;
    }
    console.log(`Wrote research artifact to ${resolvedOutPath}`);
    return;
  }

  const contentType = payload.contentType?.toLowerCase() ?? "";
  const isTextual =
    contentType.startsWith("text/") ||
    contentType.includes("application/json") ||
    contentType.includes("application/markdown");
  if (!isTextual) {
    throw new Error("Binary artifacts require --out <file>.");
  }

  const text = Buffer.from(payload.bytes).toString("utf8");
  if (getBooleanFlag(options, "json")) {
    printJson({ artifactPath, contentType: payload.contentType, content: text });
    return;
  }
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

async function researchSourceCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const sourceItemId = resolveRequiredEntityId(options, "source item");
  const payload = await requestGatewayJson<ResearchSourceItem>(
    context.baseUrl,
    `/api/research/source-items/${encodeURIComponent(sourceItemId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchSourceItem(payload);
}

async function researchPaperReportCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const reportId = resolveRequiredEntityId(options, "paper report");
  const payload = await requestGatewayJson<DeepPaperAnalysisReport>(
    context.baseUrl,
    `/api/research/paper-reports/${encodeURIComponent(reportId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchPaperReport(payload);
}

async function researchRepoReportCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const reportId = resolveRequiredEntityId(options, "repo report");
  const payload = await requestGatewayJson<RepoAnalysisReport>(
    context.baseUrl,
    `/api/research/repo-reports/${encodeURIComponent(reportId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchRepoReport(payload);
}

async function researchModuleAssetsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 20;
  const payload = await requestGatewayJson<ResearchModuleAssetsPayload>(
    context.baseUrl,
    `/api/research/module-assets/recent?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchModuleAssets(payload.assets);
}

async function researchModuleAssetCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const assetId = resolveRequiredEntityId(options, "module asset");
  const payload = await requestGatewayJson<ModuleAsset>(
    context.baseUrl,
    `/api/research/module-assets/${encodeURIComponent(assetId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchModuleAsset(payload);
}

async function researchPresentationsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 20;
  const payload = await requestGatewayJson<ResearchPresentationsPayload>(
    context.baseUrl,
    `/api/research/presentations/recent?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchPresentations(payload.presentations);
}

async function researchPresentationCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const presentationId = resolveRequiredEntityId(options, "presentation");
  const payload = await requestGatewayJson<WeeklyPresentationResult>(
    context.baseUrl,
    `/api/research/presentations/${encodeURIComponent(presentationId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchPresentation(payload);
}

async function researchDirectionReportsCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const limit = getIntegerFlag(options, "limit") ?? 20;
  const payload = await requestGatewayJson<ResearchDirectionReportsPayload>(
    context.baseUrl,
    `/api/research/direction-reports/recent?${buildQueryString({ limit })}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDirectionReports(payload.reports);
}

async function researchDirectionReportGetCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const reportId = resolveRequiredEntityId(options, "direction report");
  const payload = await requestGatewayJson<ResearchDirectionReport>(
    context.baseUrl,
    `/api/research/direction-reports/${encodeURIComponent(reportId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDirectionReport(payload);
}

async function researchDirectionReportGenerateCommand(options: ParsedOptions): Promise<void> {
  const directionId = getStringFlag(options, "direction");
  const positionalTopic = options.positionals.join(" ").trim();
  const topic = getStringFlag(options, "topic") ?? (positionalTopic ? positionalTopic : undefined);
  const days = getIntegerFlag(options, "days");
  if (!directionId && !topic) {
    throw new Error("research direction-report generate requires --direction <id> or --topic <value>.");
  }

  const context = await resolveGatewayContext(options);
  const payload = await requestGatewayJson<ResearchDirectionReport>(
    context.baseUrl,
    "/api/research/direction-reports/generate",
    {
      method: "POST",
      body: {
        ...(directionId ? { directionId } : {}),
        ...(topic ? { topic } : {}),
        ...(days !== undefined ? { days } : {}),
      },
      timeoutMs: context.timeoutMs,
    },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }
  printResearchDirectionReport(payload);
}

async function researchCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderResearchHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "recent") {
    await researchRecentCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderResearchHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "run") {
    await researchRunCommand(subOptions);
    return;
  }
  if (subcommand === "enqueue") {
    await researchEnqueueCommand(subOptions);
    return;
  }
  if (subcommand === "tasks") {
    await researchTasksCommand(subOptions);
    return;
  }
  if (subcommand === "task") {
    await researchTaskCommand(subOptions);
    return;
  }
  if (subcommand === "report") {
    await researchReportCommand(subOptions);
    return;
  }
  if (subcommand === "retry") {
    await researchRetryCommand(subOptions);
    return;
  }
  if (subcommand === "handoff") {
    await researchHandoffCommand(subOptions);
    return;
  }
  if (subcommand === "directions") {
    await researchDirectionsCommand(subOptions);
    return;
  }
  if (subcommand === "direction") {
    await researchDirectionCommand(subOptions);
    return;
  }
  if (subcommand === "discovery") {
    await researchDiscoveryCommand(subOptions);
    return;
  }
  if (subcommand === "feedback") {
    await researchFeedbackCommand(subOptions);
    return;
  }
  if (subcommand === "graph") {
    await researchGraphCommand(subOptions);
    return;
  }
  if (subcommand === "artifact") {
    await researchArtifactCommand(subOptions);
    return;
  }
  if (subcommand === "source") {
    await researchSourceCommand(subOptions);
    return;
  }
  if (subcommand === "paper-report") {
    await researchPaperReportCommand(subOptions);
    return;
  }
  if (subcommand === "repo-report") {
    await researchRepoReportCommand(subOptions);
    return;
  }
  if (subcommand === "module-assets") {
    await researchModuleAssetsCommand(subOptions);
    return;
  }
  if (subcommand === "module-asset") {
    await researchModuleAssetCommand(subOptions);
    return;
  }
  if (subcommand === "presentations") {
    await researchPresentationsCommand(subOptions);
    return;
  }
  if (subcommand === "presentation") {
    await researchPresentationCommand(subOptions);
    return;
  }
  if (subcommand === "direction-reports") {
    await researchDirectionReportsCommand(subOptions);
    return;
  }
  if (subcommand === "direction-report") {
    if (subOptions.positionals[0] === "generate") {
      await researchDirectionReportGenerateCommand(consumePositionals(subOptions, 1));
      return;
    }
    await researchDirectionReportGetCommand(subOptions);
    return;
  }

  throw new Error(`Unknown research command: ${subcommand}`);
}

async function resolveWorkspaceConfigService(options: ParsedOptions): Promise<WorkspaceConfigService> {
  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  const workspaceDir = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
  const module = await import("./services/workspaceConfigService.js");
  return new module.WorkspaceConfigService(workspaceDir);
}

async function configFileCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const alias = options.positionals[0] as ManagedConfigAlias | undefined;
  if (alias && !["llm", "mcp", "skills"].includes(alias)) {
    throw new Error(`Unsupported config namespace: ${alias}. Use llm, mcp, or skills.`);
  }

  if (alias) {
    const file = await service.getFile(alias);
    if (getBooleanFlag(options, "json")) {
      printJson(file);
      return;
    }
    printManagedConfigFiles([file]);
    return;
  }

  const files = await service.listFiles();
  if (getBooleanFlag(options, "json")) {
    printJson({ files });
    return;
  }
  printManagedConfigFiles(files);
}

async function configGetCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const keyPath = options.positionals.join(" ").trim();
  if (!keyPath) {
    throw new Error("config get requires a path. Example: reagent config get llm.providers[0].enabled");
  }

  const result = await service.getValue(keyPath);
  if (getBooleanFlag(options, "json")) {
    printJson({
      ...result,
      found: result.value !== undefined,
      ...(result.value === undefined ? { value: null } : { value: result.value }),
    });
    return;
  }

  console.log(`${result.alias}: ${result.file.path}`);
  console.log("");
  printConfigValue(result.value);
}

async function configSetCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
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
    const module = await import("./services/workspaceConfigService.js");
    value = module.coerceConfigValue(rawValue);
  }

  const result = await service.setValue(keyPath, value, {
    dryRun: getBooleanFlag(options, "dry-run"),
  });
  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  console.log(`${getBooleanFlag(options, "dry-run") ? "Previewed" : "Updated"} ${keyPath}`);
  console.log(`File: ${result.file.path}`);
  console.log("Previous:");
  printConfigValue(result.previousValue);
  console.log("Next:");
  printConfigValue(result.nextValue);
}

async function configUnsetCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const keyPath = options.positionals.join(" ").trim();
  if (!keyPath) {
    throw new Error("config unset requires a path.");
  }

  const result = await service.unsetValue(keyPath, {
    dryRun: getBooleanFlag(options, "dry-run"),
  });
  if (getBooleanFlag(options, "json")) {
    printJson(result);
    return;
  }

  console.log(`${getBooleanFlag(options, "dry-run") ? "Previewed" : "Unset"} ${keyPath}`);
  console.log(`File: ${result.file.path}`);
  console.log("Previous:");
  printConfigValue(result.previousValue);
}

async function configExportCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const aliasRaw = options.positionals[0];
  const outPath = getStringFlag(options, "out");

  if (aliasRaw) {
    const alias = resolveConfigAlias(aliasRaw);
    const config = await service.readConfig(alias);
    const rendered = `${JSON.stringify(config, null, 2)}\n`;
    if (outPath) {
      await writeFile(path.resolve(process.cwd(), outPath), rendered, "utf8");
      if (!getBooleanFlag(options, "json")) {
        console.log(`Exported ${alias} config to ${path.resolve(process.cwd(), outPath)}`);
      } else {
        printJson({ alias, outPath: path.resolve(process.cwd(), outPath) });
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
  };
  const rendered = `${JSON.stringify(bundle, null, 2)}\n`;
  if (outPath) {
    await writeFile(path.resolve(process.cwd(), outPath), rendered, "utf8");
    if (!getBooleanFlag(options, "json")) {
      console.log(`Exported managed config bundle to ${path.resolve(process.cwd(), outPath)}`);
    } else {
      printJson({ outPath: path.resolve(process.cwd(), outPath) });
    }
    return;
  }
  process.stdout.write(rendered);
}

async function configImportCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const alias = resolveConfigAlias(options.positionals[0]);
  const source = options.positionals[1]?.trim();
  if (!source) {
    throw new Error("config import requires a source file path or '-' for stdin.");
  }

  const raw =
    source === "-"
      ? await readStdinText()
      : await readFile(path.resolve(process.cwd(), source), "utf8");
  const parsed = raw.trim() ? (JSON.parse(raw) as unknown) : {};
  const result = await service.replaceConfig(alias, parsed, {
    dryRun: getBooleanFlag(options, "dry-run"),
  });

  if (getBooleanFlag(options, "json")) {
    printJson({ ...result, source });
    return;
  }

  console.log(`${getBooleanFlag(options, "dry-run") ? "Previewed" : "Imported"} ${alias} config from ${source}`);
  console.log(`File: ${result.file.path}`);
}

async function configEditCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const alias = resolveConfigAlias(options.positionals[0]);
  const file = await service.getFile(alias);
  const editor = resolveEditorCommand(options);
  const before = await service.readRawConfig(alias);

  await runEditorCommand(editor, file.path);

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
    printJson({
      alias,
      path: file.path,
      editor,
      changed: before !== afterRaw,
    });
    return;
  }

  console.log(`Edited ${alias} config with ${editor}`);
  console.log(`Path: ${file.path}`);
  console.log(`Changed: ${formatYesNo(before !== afterRaw)}`);
}

async function configValidateCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const report = await service.validate();
  if (getBooleanFlag(options, "json")) {
    printJson(report);
    return;
  }
  printConfigValidationReport(report);
}

async function configSchemaCommand(options: ParsedOptions): Promise<void> {
  const service = await resolveWorkspaceConfigService(options);
  const schema = await service.buildSchema();
  printJson(schema);
}

async function configCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderConfigHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "file") {
    await configFileCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderConfigHelp();
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

async function resolveOpenClawCliPath(options: ParsedOptions): Promise<string> {
  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  return runtimeEnv.OPENCLAW_CLI_PATH;
}

async function readOpenClawPluginStates(cliPath: string): Promise<{ states: OpenClawPluginState[]; error?: string }> {
  try {
    const result = await runExternalCli(cliPath, ["plugins", "list", "--json"], {
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) {
      return {
        states: [],
        error: result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`,
      };
    }
    return {
      states: parseOpenClawPluginStates(result.stdout),
    };
  } catch (error) {
    return {
      states: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function collectPluginDelegateFlags(options: ParsedOptions, names: string[]): string[] {
  const args: string[] = [];
  for (const name of names) {
    const value = options.flags.get(name);
    if (value === true) {
      args.push(`--${name}`);
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      args.push(`--${name}`, value.trim());
    }
  }
  return args;
}

async function pluginsListCommand(options: ParsedOptions): Promise<void> {
  const cliPath = await resolveOpenClawCliPath(options);
  const catalog = new BundledPluginCatalogService(packageRootDir);
  const [plugins, hostState] = await Promise.all([catalog.listPlugins(), readOpenClawPluginStates(cliPath)]);
  const items = plugins
    .map((plugin) => ({
      plugin,
      host: matchOpenClawPluginState(plugin, hostState.states),
    }))
    .filter((item) => !getBooleanFlag(options, "enabled") || Boolean(item.host?.enabled));

  if (getBooleanFlag(options, "json")) {
    printJson({
      cliPath,
      host: {
        available: !hostState.error,
        ...(hostState.error ? { error: hostState.error } : {}),
        plugins: hostState.states,
      },
      bundled: items,
    });
    return;
  }

  if (hostState.error) {
    console.log(`OpenClaw host probe: ${hostState.error}`);
    console.log("");
  }
  printBundledPluginList(items);
}

function resolveMarketplaceSource(options: ParsedOptions): "reagent" | "bundled" | "reference" {
  const raw = (getStringFlag(options, "source") ?? options.positionals[0] ?? "reagent").trim().toLowerCase();
  if (raw === "reagent" || raw === "all" || raw === "repo") {
    return "reagent";
  }
  if (raw === "bundled" || raw === "bundle") {
    return "bundled";
  }
  if (raw === "reference" || raw === "compat" || raw === "package") {
    return "reference";
  }
  throw new Error(`Unknown marketplace source: ${raw}`);
}

async function pluginsMarketplaceListCommand(options: ParsedOptions): Promise<void> {
  const catalog = new BundledPluginCatalogService(packageRootDir);
  const source = resolveMarketplaceSource(options);
  const plugins = (await catalog.listPlugins()).filter((plugin) => source === "reagent" || plugin.source === source);
  const payload = {
    marketplace: {
      requestedSource: getStringFlag(options, "source") ?? options.positionals[0] ?? "reagent",
      resolvedSource: source,
      available: true,
      pluginCount: plugins.length,
    },
    plugins,
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Marketplace: ${payload.marketplace.resolvedSource}`);
  console.log(`Plugins: ${payload.marketplace.pluginCount}`);
  console.log("");
  printBundledPluginList(plugins.map((plugin) => ({ plugin, host: null })));
}

function renderPluginsMarketplaceHelp(): void {
  console.log(`ReAgent Plugins Marketplace

Commands:
  reagent plugins marketplace list [source]

Sources:
  reagent                List all plugin packages shipped in this repo
  bundled                List bundled packages from packages/*
  reference              List compatibility/reference packages from package/

Flags:
  --source <id>          Marketplace source alias
  --json                 Print JSON output
`);
}

async function pluginsInspectCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "all")) {
    await pluginsListCommand(options);
    return;
  }

  const target = options.positionals.join(" ").trim();
  if (!target) {
    throw new Error("plugins inspect requires a plugin id or package name.");
  }

  const cliPath = await resolveOpenClawCliPath(options);
  const catalog = new BundledPluginCatalogService(packageRootDir);
  const [plugin, hostState] = await Promise.all([catalog.getPlugin(target), readOpenClawPluginStates(cliPath)]);
  const host = plugin ? matchOpenClawPluginState(plugin, hostState.states) : null;
  const payload = {
    target,
    ...(plugin ? { bundled: plugin } : {}),
    host: {
      available: !hostState.error,
      ...(hostState.error ? { error: hostState.error } : {}),
      ...(host ? { plugin: host } : {}),
    },
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  if (plugin) {
    printBundledPluginList([{ plugin, host }]);
    return;
  }

  if (host) {
    console.log(`${host.id} installed in OpenClaw`);
    console.log(`Enabled: ${formatYesNo(host.enabled)}`);
    console.log(`Version: ${formatWhen(host.version)}`);
    return;
  }

  throw new Error(`Plugin not found in bundled catalog or OpenClaw host inventory: ${target}`);
}

async function delegatePluginCommand(
  options: ParsedOptions,
  subcommand: "install" | "uninstall" | "enable" | "disable" | "update" | "doctor",
): Promise<void> {
  const cliPath = await resolveOpenClawCliPath(options);
  const catalog = new BundledPluginCatalogService(packageRootDir);
  const target = options.positionals[0]?.trim();
  const delegatedArgs = ["plugins", subcommand];

  if (subcommand !== "doctor") {
    if (!target && !(subcommand === "update" && getBooleanFlag(options, "all"))) {
      throw new Error(`plugins ${subcommand} requires a plugin id.`);
    }
    const resolvedTarget = target ?? "";
    if (subcommand === "install") {
      const plugin = await catalog.getPlugin(resolvedTarget);
      delegatedArgs.push(plugin?.installSpec ?? resolvedTarget);
      delegatedArgs.push(...collectPluginDelegateFlags(options, ["yes", "force", "pin", "link", "json"]));
    } else if (subcommand === "update") {
      if (target) {
        delegatedArgs.push(target);
      }
      delegatedArgs.push(...collectPluginDelegateFlags(options, ["all", "yes", "json"]));
    } else if (subcommand === "uninstall") {
      delegatedArgs.push(resolvedTarget);
      delegatedArgs.push(...collectPluginDelegateFlags(options, ["dry-run", "keep-files", "json", "yes"]));
    } else {
      delegatedArgs.push(resolvedTarget);
      delegatedArgs.push(...collectPluginDelegateFlags(options, ["json", "yes"]));
    }
  } else {
    delegatedArgs.push(...collectPluginDelegateFlags(options, ["json"]));
  }

  const result = await runExternalCli(cliPath, delegatedArgs, {
    timeoutMs: 120_000,
    inheritStdio: !getBooleanFlag(options, "json"),
  });

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

async function pluginsCommand(options: ParsedOptions): Promise<void> {
  if (getBooleanFlag(options, "help", "h")) {
    renderPluginsHelp();
    return;
  }

  const subcommand = options.positionals[0];
  if (subcommand === undefined || subcommand === "list") {
    await pluginsListCommand(subcommand === undefined ? options : consumePositionals(options, 1));
    return;
  }
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    renderPluginsHelp();
    return;
  }

  const subOptions = consumePositionals(options, 1);

  if (subcommand === "inspect" || subcommand === "info") {
    await pluginsInspectCommand(subOptions);
    return;
  }
  if (subcommand === "marketplace") {
    const marketplaceCommand = subOptions.positionals[0];
    if (marketplaceCommand === undefined || marketplaceCommand === "list") {
      await pluginsMarketplaceListCommand(
        marketplaceCommand === undefined ? subOptions : consumePositionals(subOptions, 1),
      );
      return;
    }
    if (marketplaceCommand === "help" || marketplaceCommand === "--help" || marketplaceCommand === "-h") {
      renderPluginsMarketplaceHelp();
      return;
    }
    throw new Error(`Unknown plugins marketplace command: ${marketplaceCommand}`);
  }
  if (subcommand === "install") {
    await delegatePluginCommand(subOptions, "install");
    return;
  }
  if (subcommand === "uninstall") {
    await delegatePluginCommand(subOptions, "uninstall");
    return;
  }
  if (subcommand === "enable") {
    await delegatePluginCommand(subOptions, "enable");
    return;
  }
  if (subcommand === "disable") {
    await delegatePluginCommand(subOptions, "disable");
    return;
  }
  if (subcommand === "update") {
    await delegatePluginCommand(subOptions, "update");
    return;
  }
  if (subcommand === "doctor") {
    await delegatePluginCommand(subOptions, "doctor");
    return;
  }

  throw new Error(`Unknown plugins command: ${subcommand}`);
}

async function doctorCommand(options: ParsedOptions): Promise<void> {
  applyRuntimeOverrides(options);
  const version = await readPackageVersion();
  const runtimeEnv = await loadRuntimeEnv();
  const sqlitePath = resolveSqlitePath(runtimeEnv.DATABASE_URL, process.cwd());
  const openClawStatus = await probeCommand(runtimeEnv.OPENCLAW_CLI_PATH, ["--version"]);
  const gatewayPort = getStringFlag(options, "port") ?? DEFAULT_GATEWAY_PORT;
  const gatewayStatus = await getGatewayServiceStatus(gatewayPort, {
    deep: getBooleanFlag(options, "deep"),
  });

  const payload = {
    cliVersion: version,
    packageRoot: packageRootDir,
    currentDirectory: process.cwd(),
    host: runtimeEnv.HOST,
    port: runtimeEnv.PORT,
    workspace: path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR),
    databaseUrl: runtimeEnv.DATABASE_URL,
    sqlitePath: sqlitePath ?? "(non-file datasource)",
    schemaPath: resolvePackagePath("prisma", "schema.prisma"),
    webAssets: resolvePackagePath("web"),
    openclawCli: runtimeEnv.OPENCLAW_CLI_PATH,
    openclawStatus: openClawStatus.ok ? openClawStatus.output || "available" : openClawStatus.output || "unavailable",
    gatewayDefaultPort: DEFAULT_GATEWAY_PORT,
    gatewayInspectPort: gatewayStatus.port,
    gateway: gatewayStatus,
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`ReAgent CLI: ${payload.cliVersion}`);
  console.log(`Package root: ${payload.packageRoot}`);
  console.log(`Current directory: ${payload.currentDirectory}`);
  console.log(`Host: ${payload.host}`);
  console.log(`Port: ${payload.port}`);
  console.log(`Workspace: ${payload.workspace}`);
  console.log(`Database URL: ${payload.databaseUrl}`);
  console.log(`SQLite path: ${payload.sqlitePath}`);
  console.log(`Schema path: ${payload.schemaPath}`);
  console.log(`Web assets: ${payload.webAssets}`);
  console.log(`OpenClaw CLI: ${payload.openclawCli}`);
  console.log(`OpenClaw status: ${payload.openclawStatus}`);
  console.log(`Gateway default port: ${payload.gatewayDefaultPort}`);
  console.log(`Gateway inspect port: ${payload.gatewayInspectPort}`);
  printGatewayStatus(gatewayStatus, false);
}

async function versionCommand(): Promise<void> {
  console.log(await readPackageVersion());
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    printHelp();
    return;
  }

  if (rawArgs[0] === "--help" || rawArgs[0] === "-h" || rawArgs[0] === "help") {
    printHelp();
    return;
  }

  if (rawArgs[0] === "--version" || rawArgs[0] === "-v" || rawArgs[0] === "version") {
    await versionCommand();
    return;
  }

  const command = rawArgs[0];
  const options = parseOptions(rawArgs.slice(1));

  if (command === "health") {
    await healthCommand(options);
    return;
  }

  if (command === "status") {
    await statusCommand(options);
    return;
  }

  if (command === "dashboard") {
    await dashboardCommand(options);
    return;
  }

  if (command === "logs") {
    await logsCommand(options);
    return;
  }

  if (command === "runtime") {
    await runtimeCommand(options);
    return;
  }

  if (command === "research") {
    await researchCommand(options);
    return;
  }

  if (command === "config") {
    await configCommand(options);
    return;
  }

  if (command === "plugins") {
    await pluginsCommand(options);
    return;
  }

  if (command === "channels") {
    await channelsCommand(options);
    return;
  }

  if (command === "memory") {
    await memoryCommand(options);
    return;
  }

  if (command === "gateway") {
    await gatewayCommand(options);
    return;
  }

  if (command === "service") {
    await serviceCommand(options);
    return;
  }

  if (command === "daemon") {
    await serviceCommand(options);
    return;
  }

  if (command === "start") {
    await startCommand(options);
    return;
  }

  if (command === "init") {
    await initCommand(options);
    return;
  }

  if (command === "doctor") {
    await doctorCommand(options);
    return;
  }

  if (command === "db" && options.positionals[0] === "push") {
    applyRuntimeOverrides(options);
    await runDbPush(await loadRuntimeEnv());
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
