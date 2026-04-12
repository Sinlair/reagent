#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

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
import {
  applyRuntimeOverrides,
  consumePositionals,
  getBooleanFlag,
  getIntegerFlag,
  getOptionalBooleanFlag,
  getStringFlag,
  parseOptions,
  serializeParsedOptions,
  type ParsedOptions,
} from "./cli/args.js";
import { createChannelsCli } from "./cli/channels.js";
import {
  OPENCLAW_COMMAND_FAMILIES,
  dispatchResearchCommand as runResearchCommandDispatch,
  type OpenClawCommandFamily,
  type PluginDelegateSubcommand,
} from "./cli/dispatch.js";
import { createMemoryCli } from "./cli/memory.js";
import { createResearchArtifactsReportsCli } from "./cli/researchArtifactsReports.js";
import { createResearchCandidatesCli } from "./cli/researchCandidates.js";
import { createResearchDirectionDiscoveryCli } from "./cli/researchDirectionDiscovery.js";
import { createResearchGraphFeedbackCli } from "./cli/researchGraphFeedback.js";
import { createOpenClawCli } from "./cli/openClaw.js";
import { createRuntimeSurfaceCli } from "./cli/runtimeSurface.js";
import { createWorkspaceControlCli } from "./cli/workspaceControl.js";
import type {
  ResearchGraphExplainPayload,
  ResearchGraphPathPayload,
  ResearchGraphReportPayload,
} from "./cli/researchGraphFeedback.js";
import { packageRootDir, resolvePackagePath } from "./packagePaths.js";
import type { BundledPluginRecord } from "./services/bundledPluginCatalogService.js";
import type { OpenClawPluginState } from "./services/openClawHostCatalogService.js";
import type {
  ChannelsStatusSnapshot,
  WeChatChannelStatus,
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
  ResearchEvolutionCandidate,
  ResearchEvolutionCandidateApplyOutcome,
  ResearchEvolutionCandidateRollbackOutcome,
} from "./types/researchEvolutionCandidate.js";
import type {
  ResearchDiscoveryRunResult,
  ResearchDiscoveryRunSummary,
} from "./types/researchDiscovery.js";
import type { ResearchDiscoverySchedulerStatus } from "./types/researchDiscoveryScheduler.js";
import type { JobRuntimeRunAuditEntry, JobRuntimeSnapshot } from "./services/jobRuntimeObservabilityService.js";
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

type RuntimeJobsPayload = {
  items: Array<{
    id: string;
    label: string;
    snapshot: JobRuntimeSnapshot;
    recentRuns: JobRuntimeRunAuditEntry[];
  }>;
};

type OpenClawSessionSummaryPayload = {
  sessionKey: string;
  channel?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | number | undefined;
  label?: string | undefined;
  displayName?: string | undefined;
  derivedTitle?: string | undefined;
  lastMessagePreview?: string | undefined;
  updatedAt?: number | null | undefined;
};

type OpenClawHistoryMessagePayload = {
  id?: string | undefined;
  role?: string | undefined;
  text: string;
  raw: Record<string, unknown>;
};

type OpenClawSessionEventPayload = {
  event: string;
  payload?: unknown;
};

type ResearchRecentPayload = {
  reports: ResearchReportSummary[];
};

type ResearchTasksPayload = {
  tasks: ResearchTaskSummary[];
};

type HomePayload = {
  url: string;
  version: string;
  degraded: boolean;
  warnings?: string[];
  mode:
    | "first-run"
    | "runtime-stopped"
    | "channel-setup"
    | "active-research"
    | "report-ready"
    | "ready";
  headline: string;
  summary: string;
  runtime: RuntimeMetaPayload;
  channels: ChannelsStatusSnapshot;
  memory: MemoryStatus;
  gateway: GatewayStatusSnapshot;
  research: {
    recentReports: ResearchReportSummary[];
    recentTasks: ResearchTaskSummary[];
    activeTaskCount: number;
  };
  nextSteps: string[];
  dashboardUrl: string;
};

type OnboardPayload = {
  version: string;
  envFile: {
    path: string;
    exists: boolean;
  };
  workspace: {
    path: string;
    exists: boolean;
  };
  database: {
    url: string;
    sqlitePath: string | null;
    ready: boolean;
  };
  runtime: {
    gatewayUrl: string;
    gatewayInstalled: boolean;
    gatewayReachable: boolean;
  };
  actions: {
    apply: boolean;
    skipDb: boolean;
    installService: boolean;
  };
  nextSteps: string[];
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
  reagent home        Show the main runtime and workspace overview
  reagent onboard     Inspect or apply first-run setup for the standalone runtime
  reagent watch       Watch live OpenClaw host session events from the root CLI
  reagent sessions    List live OpenClaw host sessions from the root CLI
  reagent history     Read OpenClaw host chat history for a session
  reagent login       Start the channel login flow
  reagent wait        Wait for channel login completion
  reagent logout      Log out the active channel session
  reagent send        Send through the active OpenClaw/WeChat host path
  reagent inspect     Inspect one OpenClaw plugin across snapshot and host state
  reagent install     Install an OpenClaw plugin through the host path
  reagent uninstall   Uninstall an OpenClaw plugin through the host path
  reagent enable      Enable an OpenClaw plugin through the host path
  reagent disable     Disable an OpenClaw plugin through the host path
  reagent update      Update an OpenClaw plugin through the host path
  reagent runtime     Inspect health, status, dashboard, logs, and doctor output
  reagent system      OpenClaw-style system surface over runtime and service control
  reagent commands    Inspect inbound command registry, policy, and authorization
  reagent models      Inspect or edit managed LLM provider routes
  reagent mcp         Inspect or edit managed MCP server registry
  reagent skills      Inspect or edit managed workspace skill state
  reagent qr          Delegate to the OpenClaw qr command family
  reagent devices     Delegate to the OpenClaw devices command family
  reagent pairing     Delegate to the OpenClaw pairing command family
  reagent acp / dns / hooks / nodes / sandbox / secrets / security / webhooks / exec-approvals / tui
                     Delegate additional OpenClaw command families through the host CLI
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
  --apply                   With onboard, apply the bootstrap actions locally
  --install-service         With onboard --apply, also install the supervised service
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
  reagent memory scheduler runtime
  reagent memory scheduler runs [--limit N]

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
  reagent runtime home
  reagent runtime health
  reagent runtime status
  reagent runtime jobs
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
  --fix                     With "doctor", apply safe local repairs
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
  reagent research workstream <taskId> <search|reading|synthesis>
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
  reagent research candidates
  reagent research candidate <candidateId>
  reagent research candidate generate --report <directionReportId>
  reagent research candidate generate --asset <moduleAssetId>
  reagent research candidate review <candidateId>
  reagent research candidate approve <candidateId>
  reagent research candidate reject <candidateId>
  reagent research candidate apply <candidateId>
  reagent research candidate rollback <candidateId>

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
  reagent research discovery scheduler runtime
  reagent research discovery scheduler runs [--limit N]
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
  --report <id>             Direction report id for candidate generation
  --asset <id>              Module asset id for skill candidate generation
  --id <value>              Explicit id override for direction/task-oriented commands
  --limit <n>               Result limit for list/report commands
  --status <value>          Status filter for candidate lists
  --type <value>            Candidate type filter for candidate lists
  --view <asset|paper>      Research graph view
  --types <csv>             Research graph node types
  --search <value>          Research graph text filter
  --date-from <YYYY-MM-DD>  Research graph lower date filter
  --date-to <YYYY-MM-DD>    Research graph upper date filter
  --reviewer <value>        Reviewer name for candidate review/apply actions
  --notes <value>           Notes for candidate review/apply actions
  --dry-run                 Preview candidate application without writing
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

function renderConfigHelp(): void {
  console.log(`ReAgent Config

Commands:
  reagent config file [llm|mcp|skills|commands]
  reagent config get <path>
  reagent config set <path> <value>
  reagent config unset <path>
  reagent config export [llm|mcp|skills|commands]
  reagent config import <llm|mcp|skills|commands> <file|->
  reagent config edit <llm|mcp|skills|commands>
  reagent config validate
  reagent config schema

Examples:
  reagent config get llm.providers[0].enabled
  reagent config set llm.providers[0].enabled true
  reagent config set mcp.servers[0].allowedTools "[\"maps_search\", \"maps_route\"]"
  reagent config unset skills.entries.workspace:research-brief.apiKey
  reagent config set commands.remote.workspace-mutation.mode allowlist

Flags:
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --out <file>              Write exported config to a file instead of stdout
  --editor <command>        Editor command for "edit"
  --dry-run                 Preview writes without saving
  --json                    Print JSON output
`);
}

function renderModelsHelp(): void {
  console.log(`ReAgent Models

Commands:
  reagent models
  reagent models list
  reagent models routes
  reagent models file
  reagent models get <path>
  reagent models set <path> <value>
  reagent models unset <path>
  reagent models export
  reagent models import <file|->
  reagent models edit

Notes:
  - this is the OpenClaw-style model family over the managed llm registry
  - get/set/unset paths are relative to "llm", for example "defaults.agent.providerId"
  - file/export/import/edit delegate to the managed config surface for llm

Flags:
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --out <file>              Write exported config to a file instead of stdout
  --editor <command>        Editor command for "edit"
  --dry-run                 Preview writes without saving
  --strict-json             Parse "set" values as strict JSON
  --json                    Print JSON output
`);
}

function renderMcpHelp(): void {
  console.log(`ReAgent MCP

Commands:
  reagent mcp
  reagent mcp list
  reagent mcp file
  reagent mcp get <path>
  reagent mcp set <path> <value>
  reagent mcp unset <path>
  reagent mcp export
  reagent mcp import <file|->
  reagent mcp edit

Notes:
  - this is the OpenClaw-style MCP family over the managed mcp registry
  - get/set/unset paths are relative to "mcp", for example "servers[0].serverUrl"
  - file/export/import/edit delegate to the managed config surface for mcp

Flags:
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --out <file>              Write exported config to a file instead of stdout
  --editor <command>        Editor command for "edit"
  --dry-run                 Preview writes without saving
  --strict-json             Parse "set" values as strict JSON
  --json                    Print JSON output
`);
}

function renderSkillsHelp(): void {
  console.log(`ReAgent Skills

Commands:
  reagent skills
  reagent skills list
  reagent skills file
  reagent skills get <path>
  reagent skills set <path> <value>
  reagent skills unset <path>
  reagent skills export
  reagent skills import <file|->
  reagent skills edit

Notes:
  - this is the OpenClaw-style skills family over workspace skill state
  - get/set/unset paths are relative to "skills", for example "entries.workspace:demo.enabled"
  - file/export/import/edit delegate to the managed config surface for skills

Flags:
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --out <file>              Write exported config to a file instead of stdout
  --editor <command>        Editor command for "edit"
  --dry-run                 Preview writes without saving
  --strict-json             Parse "set" values as strict JSON
  --json                    Print JSON output
`);
}

function renderSystemHelp(): void {
  console.log(`ReAgent System

Commands:
  reagent system
  reagent system status
  reagent system health
  reagent system home
  reagent system doctor
  reagent system logs
  reagent system runtime ...
  reagent system service ...

Notes:
  - this is the OpenClaw-style system family over the root runtime and service surfaces
  - "runtime" and "service" delegate to the existing ReAgent command families

Flags:
  --url <value>             Override the HTTP gateway base URL for gateway-backed commands
  --host <value>            Override HOST for this command
  --port <value>            Override PORT for this command
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --timeout <ms>            Override HTTP timeout for gateway-backed commands
  --follow                  With "logs", keep polling and print appended lines
  --poll <ms>               Poll interval for "logs --follow" (default: 2000)
  --fix                     With "doctor", apply safe local repairs
  --json                    Print JSON output
`);
}

function renderCommandsHelp(): void {
  console.log(`ReAgent Commands

Commands:
  reagent commands
  reagent commands list
  reagent commands policy
  reagent commands authorize <ui|wechat|openclaw> <senderId> <command>
  reagent commands explain <ui|wechat|openclaw> <senderId> <command>
  reagent commands file
  reagent commands get <path>
  reagent commands set <path> <value>
  reagent commands unset <path>
  reagent commands export
  reagent commands import <file|->
  reagent commands edit

Notes:
  - "list" shows the shared inbound slash-command registry used by the runtime
  - "policy" reads the managed inbound command policy config
  - "authorize" and "explain" evaluate source, command tier, and remote allowlist policy
  - config-oriented subcommands delegate to the managed "commands" config namespace

Flags:
  --workspace <path>        Override PLATFORM_WORKSPACE_DIR for this command
  --out <file>              Write exported config to a file instead of stdout
  --editor <command>        Editor command for "edit"
  --dry-run                 Preview writes without saving
  --strict-json             Parse "set" values as strict JSON
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
  --source <id>             Marketplace source alias: reagent, bundled, upstream, foundation, reference
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
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
  console.log(`Host session registry: ${status.hostSessionRegistryCount ?? 0}`);
  console.log(`Host session registry updated: ${formatWhen(status.hostSessionRegistryUpdatedAt)}`);
  console.log(`Last error: ${formatWhen(status.lastError)}`);
  if (status.accounts && status.accounts.length > 0) {
    console.log("Accounts:");
    for (const account of status.accounts) {
      console.log(
        `  - ${account.accountId}${account.accountName ? ` (${account.accountName})` : ""} connected=${formatYesNo(Boolean(account.connected))} running=${formatYesNo(Boolean(account.running))}`,
      );
    }
  }
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

function printLlmSummary(summary: {
  defaults: Partial<Record<"agent" | "research", { providerId: string; modelId: string }>>;
  routes: Record<
    "agent" | "research",
    {
      providerLabel: string;
      modelLabel: string;
      wireApi?: string | undefined;
      status: string;
      notes: string[];
    }
  >;
  providers: Array<{
    id: string;
    label: string;
    type: string;
    status: string;
    models: Array<{ id: string; label: string; status: string }>;
  }>;
}, workspaceDir: string): void {
  console.log(`Workspace: ${workspaceDir}`);
  console.log(
    `Defaults: agent=${
      summary.defaults.agent ? `${summary.defaults.agent.providerId}/${summary.defaults.agent.modelId}` : "-"
    } research=${
      summary.defaults.research ? `${summary.defaults.research.providerId}/${summary.defaults.research.modelId}` : "-"
    }`,
  );
  console.log("Routes:");
  for (const [purpose, route] of Object.entries(summary.routes)) {
    console.log(
      `  - ${purpose}: ${route.providerLabel}/${route.modelLabel}${route.wireApi ? ` via ${route.wireApi}` : ""} [${route.status}]`,
    );
    if (route.notes.length > 0) {
      console.log(`    notes: ${route.notes.join(" ")}`);
    }
  }
  console.log("Providers:");
  if (summary.providers.length === 0) {
    console.log("  - none");
    return;
  }
  for (const provider of summary.providers) {
    console.log(`  - ${provider.id} (${provider.label}) type=${provider.type} status=${provider.status}`);
    console.log(
      `    models: ${provider.models.length > 0 ? provider.models.map((model) => `${model.id} [${model.status}]`).join(", ") : "-"}`,
    );
  }
}

function printMcpServerStatuses(
  servers: Array<{
    serverLabel: string;
    status: string;
    serverUrl?: string | undefined;
    connectorId?: string | undefined;
    authorizationEnv?: string | undefined;
    notes: string[];
  }>,
  workspaceDir: string,
): void {
  console.log(`Workspace: ${workspaceDir}`);
  if (servers.length === 0) {
    console.log("No MCP servers configured.");
    return;
  }
  for (const server of servers) {
    console.log(`${server.serverLabel} status=${server.status}`);
    console.log(`Target=${server.serverUrl ?? server.connectorId ?? "-"}`);
    console.log(`Authorization=${server.authorizationEnv ?? "-"}`);
    if (server.notes.length > 0) {
      console.log(`Notes=${server.notes.join(" ")}`);
    }
    console.log("");
  }
}

function printSkillStatusReport(report: {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: Array<{
    skillKey: string;
    name: string;
    eligible: boolean;
    disabled: boolean;
    always: boolean;
    primaryEnv?: string | undefined;
    missing: {
      env: string[];
      config: string[];
      bins: string[];
      os: string[];
    };
  }>;
}): void {
  console.log(`Workspace: ${report.workspaceDir}`);
  console.log(`Skills dir: ${report.managedSkillsDir}`);
  if (report.skills.length === 0) {
    console.log("No workspace skills found.");
    return;
  }
  for (const skill of report.skills) {
    console.log(
      `${skill.skillKey} name=${skill.name} eligible=${formatYesNo(skill.eligible)} disabled=${formatYesNo(skill.disabled)} always=${formatYesNo(skill.always)}`,
    );
    console.log(`Primary env=${skill.primaryEnv ?? "-"}`);
    const missing = [...skill.missing.env, ...skill.missing.config, ...skill.missing.bins, ...skill.missing.os];
    console.log(`Missing=${missing.length > 0 ? missing.join(", ") : "-"}`);
    console.log("");
  }
}

function printInboundCommandRegistry(
  workspaceDir: string,
  commands: Array<{
    id: string;
    names: string[];
    usage: string;
    tier: string;
    allowedSources: string[];
    requiresAgentControls: boolean;
  }>,
): void {
  console.log(`Workspace: ${workspaceDir}`);
  if (commands.length === 0) {
    console.log("No inbound commands registered.");
    return;
  }
  for (const command of commands) {
    console.log(`${command.usage} tier=${command.tier}`);
    console.log(`Names=${command.names.join(", ")}`);
    console.log(`Sources=${command.allowedSources.join(", ")}`);
    console.log(`Agent controls=${formatYesNo(command.requiresAgentControls)}`);
    console.log("");
  }
}

function printInboundCommandAuthorization(payload: {
  source: string;
  senderId: string;
  command: string;
  allowed: boolean;
  reason: string;
  spec?: {
    usage: string;
    tier: string;
    allowedSources: string[];
    requiresAgentControls: boolean;
  } | undefined;
  policy?: {
    mode: string;
    senderIds: string[];
  } | undefined;
}): void {
  console.log(`Source: ${payload.source}`);
  console.log(`Sender: ${payload.senderId}`);
  console.log(`Command: ${payload.command}`);
  console.log(`Allowed: ${formatYesNo(payload.allowed)}`);
  console.log(`Reason: ${payload.reason}`);
  if (payload.spec) {
    console.log(`Usage: ${payload.spec.usage}`);
    console.log(`Tier: ${payload.spec.tier}`);
    console.log(`Allowed sources: ${payload.spec.allowedSources.join(", ")}`);
    console.log(`Requires agent controls: ${formatYesNo(payload.spec.requiresAgentControls)}`);
  }
  if (payload.policy) {
    console.log(`Policy mode: ${payload.policy.mode}`);
    console.log(`Policy senders: ${payload.policy.senderIds.join(", ") || "-"}`);
  }
}

function printBundledPluginList(
  items: Array<{
    plugin: BundledPluginRecord;
    host: OpenClawPluginState | null;
  }>,
): void {
  if (items.length === 0) {
    console.log("No OpenClaw plugin packages found.");
    return;
  }

  for (const item of items) {
    console.log(`${item.plugin.id} ${item.plugin.version} (${formatPluginSource(item.plugin.source)})`);
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

function printOpenClawSessions(items: OpenClawSessionSummaryPayload[]): void {
  if (items.length === 0) {
    console.log("No OpenClaw sessions found.");
    return;
  }

  for (const item of items) {
    console.log(item.sessionKey);
    console.log(`Channel: ${formatWhen(item.channel)}`);
    console.log(`Target: ${formatWhen(item.to)}`);
    console.log(`Account: ${formatWhen(item.accountId)}`);
    console.log(`Thread: ${formatWhen(item.threadId == null ? undefined : String(item.threadId))}`);
    console.log(`Title: ${formatWhen(item.displayName ?? item.derivedTitle ?? item.label)}`);
    console.log(`Updated: ${formatWhen(typeof item.updatedAt === "number" ? new Date(item.updatedAt).toISOString() : undefined)}`);
    if (item.lastMessagePreview) {
      console.log(`Last: ${item.lastMessagePreview}`);
    }
    console.log("");
  }
}

function printOpenClawHistory(messages: OpenClawHistoryMessagePayload[]): void {
  if (messages.length === 0) {
    console.log("No OpenClaw chat history messages found.");
    return;
  }

  for (const message of messages) {
    console.log(`${formatWhen(message.role)} ${formatWhen(message.id)}`);
    console.log(message.text || "(non-text content)");
    console.log("");
  }
}

function extractOpenClawEventText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as {
    reason?: unknown;
    message?: { content?: unknown } | undefined;
    sessionKey?: unknown;
  };
  if (typeof record.reason === "string" && record.reason.trim()) {
    return record.reason.trim();
  }
  if (record.message && typeof record.message === "object" && record.message) {
    const message = record.message as { content?: unknown };
    const content = message.content;
    if (Array.isArray(content)) {
      const text = content
        .flatMap((entry) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }
          const item = entry as { text?: unknown };
          return typeof item.text === "string" && item.text.trim() ? [item.text.trim()] : [];
        })
        .join("\n")
        .trim();
      return text || null;
    }
  }
  return null;
}

function printOpenClawEvents(events: OpenClawSessionEventPayload[]): void {
  if (events.length === 0) {
    console.log("No OpenClaw session events captured.");
    return;
  }

  for (const event of events) {
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as { sessionKey?: unknown })
        : {};
    const sessionKey =
      typeof payload.sessionKey === "string" && payload.sessionKey.trim()
        ? payload.sessionKey.trim()
        : "-";
    const text = extractOpenClawEventText(event.payload);
    console.log(`[${event.event}] ${sessionKey}`);
    if (text) {
      console.log(text);
    }
    console.log("");
  }
}

function printHomeSection(title: string, lines: string[]): void {
  console.log(`${title}:`);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log("");
}

function formatPluginSource(source: BundledPluginRecord["source"]): string {
  return source === "reference" ? "foundation" : source;
}

function formatMarketplaceSource(source: "reagent" | "bundled" | "reference" | "upstream"): string {
  return source === "reference" ? "foundation" : source;
}

function isFoundationPlugin(plugin: BundledPluginRecord): boolean {
  return plugin.source === "reference";
}

function isUpstreamPlugin(plugin: BundledPluginRecord): boolean {
  return plugin.source === "upstream";
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

  if (handoff.workstreams.length > 0) {
    console.log("");
    console.log("Workstreams:");
    for (const workstream of handoff.workstreams) {
      const active = handoff.activeWorkstreamId === workstream.id ? " active" : "";
      console.log(`  - ${workstream.label} (${workstream.id}) status=${workstream.status}${active}`);
      console.log(`    summary: ${workstream.summary}`);
      console.log(`    next: ${workstream.nextStep}`);
      console.log(`    path: ${handoff.workstreamPaths[workstream.id]}`);
    }
  }

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
    ["Search workstream", handoff.workstreamPaths.search],
    ["Reading workstream", handoff.workstreamPaths.reading],
    ["Synthesis workstream", handoff.workstreamPaths.synthesis],
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

function printJobRuntimeSnapshot(snapshot: JobRuntimeSnapshot): void {
  console.log(`Job: ${snapshot.jobName}`);
  console.log(`Running: ${formatYesNo(snapshot.running)}`);
  console.log(`Last trigger: ${formatWhen(snapshot.lastTrigger)}`);
  console.log(`Last started: ${formatWhen(snapshot.lastStartedAt)}`);
  console.log(`Last finished: ${formatWhen(snapshot.lastFinishedAt)}`);
  console.log(`Last state: ${formatWhen(snapshot.lastState)}`);
  console.log(`Last summary: ${formatWhen(snapshot.lastSummary)}`);
  console.log(`Last error: ${formatWhen(snapshot.lastError)}`);
  console.log(`Updated: ${formatWhen(snapshot.updatedAt)}`);
}

function printJobRuntimeRuns(items: JobRuntimeRunAuditEntry[]): void {
  if (items.length === 0) {
    console.log("No recent job runs recorded.");
    return;
  }

  for (const item of items) {
    console.log(`${item.ts} ${item.event} ${item.trigger} ${item.jobName}`);
    if (item.state) {
      console.log(`State: ${item.state}`);
    }
    if (item.summary) {
      console.log(`Summary: ${item.summary}`);
    }
    if (item.error) {
      console.log(`Error: ${item.error}`);
    }
    console.log("");
  }
}

function printRuntimeJobs(items: RuntimeJobsPayload["items"]): void {
  if (items.length === 0) {
    console.log("No runtime jobs found.");
    return;
  }

  for (const item of items) {
    console.log(`${item.label} (${item.id})`);
    printJobRuntimeSnapshot(item.snapshot);
    if (item.recentRuns.length > 0) {
      console.log("");
      console.log("Recent runs:");
      printJobRuntimeRuns(item.recentRuns);
    }
    console.log("");
  }
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

function printResearchEvolutionCandidates(candidates: ResearchEvolutionCandidate[]): void {
  if (candidates.length === 0) {
    console.log("No evolution candidates found.");
    return;
  }

  for (const candidate of candidates) {
    const label = candidate.payload.label;
    console.log(`${candidate.id} ${candidate.status} ${candidate.candidateType} ${label}`);
    console.log(`Source: ${candidate.sourceType}/${candidate.sourceId}`);
    console.log("");
  }
}

function printResearchEvolutionCandidate(candidate: ResearchEvolutionCandidate): void {
  console.log(`ID: ${candidate.id}`);
  console.log(`Title: ${candidate.title}`);
  console.log(`Status: ${candidate.status}`);
  console.log(`Type: ${candidate.candidateType}`);
  console.log(`Source: ${candidate.sourceType}/${candidate.sourceId}`);
  console.log(`Updated: ${candidate.updatedAt}`);
  console.log("");

  if (candidate.candidateType === "direction-preset") {
    console.log(`Direction: ${formatWhen(candidate.payload.directionId)}`);
    console.log("");
    console.log(candidate.payload.summary);

    if (candidate.payload.queryHints.length > 0) {
      console.log("");
      console.log(`Query hints: ${candidate.payload.queryHints.join(" | ")}`);
    }
    if (candidate.payload.knownBaselines.length > 0) {
      console.log(`Baselines: ${candidate.payload.knownBaselines.join(", ")}`);
    }
    if (candidate.payload.evaluationPriorities.length > 0) {
      console.log(`Evaluation: ${candidate.payload.evaluationPriorities.join(", ")}`);
    }
    if (candidate.payload.currentGoals.length > 0) {
      console.log(`Goals: ${candidate.payload.currentGoals.join(" | ")}`);
    }
  } else {
    console.log(`Skill: ${candidate.payload.skillKey}`);
    console.log(`Repo: ${candidate.payload.sourceRepoUrl}`);
    console.log(`Enabled by default: ${formatYesNo(candidate.payload.enabled)}`);
    console.log("");
    console.log(candidate.payload.description);
    if (candidate.payload.relatedTools.length > 0) {
      console.log("");
      console.log(`Related tools: ${candidate.payload.relatedTools.join(", ")}`);
    }
    if (candidate.payload.selectedPaths.length > 0) {
      console.log(`Selected paths: ${candidate.payload.selectedPaths.join(" | ")}`);
    }
  }

  if (candidate.reviews[0]) {
    console.log(`Latest review: ${candidate.reviews[0].decision} at ${candidate.reviews[0].createdAt}`);
  }
  if (candidate.applyHistory[0]) {
    console.log(
      `Latest apply: ${candidate.applyHistory[0].dryRun ? "dry-run" : "applied"} at ${candidate.applyHistory[0].appliedAt}`,
    );
  }
  if (candidate.rollbackHistory[0]) {
    console.log(`Latest rollback: ${candidate.rollbackHistory[0].rolledBackAt}`);
  }
}

function printResearchEvolutionCandidateApplyOutcome(outcome: ResearchEvolutionCandidateApplyOutcome): void {
  console.log(`Candidate: ${outcome.candidate.id}`);
  console.log(`Target: ${outcome.result.targetType}/${outcome.result.targetId}`);
  console.log(`Mode: ${outcome.result.dryRun ? "dry-run" : "apply"}`);
  console.log(`Changed fields: ${outcome.result.changedFields.join(", ") || "-"}`);

  if (outcome.result.notes) {
    console.log(`Notes: ${outcome.result.notes}`);
  }
}

function printResearchEvolutionCandidateRollbackOutcome(outcome: ResearchEvolutionCandidateRollbackOutcome): void {
  console.log(`Candidate: ${outcome.candidate.id}`);
  console.log(`Target: ${outcome.result.targetType}/${outcome.result.targetId}`);
  console.log(`Reverted apply: ${outcome.result.revertedApplyAppliedAt}`);
  console.log(`Changed fields: ${outcome.result.changedFields.join(", ") || "-"}`);

  if (outcome.result.notes) {
    console.log(`Notes: ${outcome.result.notes}`);
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
  if (alias === "llm" || alias === "mcp" || alias === "skills" || alias === "commands") {
    return alias;
  }
  throw new Error(`Unsupported config namespace: ${String(input ?? "")}. Use llm, mcp, skills, or commands.`);
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

async function onboardCommand(options: ParsedOptions): Promise<void> {
  applyRuntimeOverrides(options);
  const context = await resolveGatewayContext(options);
  const version = await readPackageVersion();
  const apply = getBooleanFlag(options, "apply");
  const skipDbPush = getBooleanFlag(options, "skip-db");
  const installService = getBooleanFlag(options, "install-service");
  const envTargetPath = path.join(process.cwd(), ".env");
  const workspacePath = path.resolve(process.cwd(), context.runtimeEnv.PLATFORM_WORKSPACE_DIR);
  const sqlitePath = resolveSqlitePath(context.runtimeEnv.DATABASE_URL, process.cwd());

  let envExists = false;
  try {
    await access(envTargetPath, fsConstants.F_OK);
    envExists = true;
  } catch {
    envExists = false;
  }

  let workspaceExists = false;
  try {
    await access(workspacePath, fsConstants.F_OK);
    workspaceExists = true;
  } catch {
    workspaceExists = false;
  }

  if (apply) {
    const initOptions: ParsedOptions = {
      flags: new Map(options.flags),
      positionals: [...options.positionals],
    };
    await initCommand(initOptions);
    envExists = true;
    workspaceExists = true;

    if (installService) {
      await gatewayInstallCommand({
        flags: new Map(options.flags),
        positionals: [],
      });
    }
  }

  const gateway = await maybeReadLocalGatewayStatus(context.baseUrl, context.runtimeEnv.PORT, false);
  const nextSteps: string[] = [];

  if (!envExists) {
    nextSteps.push("Create the local environment file with `reagent onboard --apply`.");
  }
  if (!skipDbPush && !apply) {
    nextSteps.push("Apply the initial database and workspace bootstrap with `reagent onboard --apply`.");
  }
  if (gateway?.installed) {
    if (!gateway.healthReachable) {
      nextSteps.push("Start the supervised runtime with `reagent service start`.");
    }
  } else {
    nextSteps.push("Run the runtime in the foreground with `reagent service run`.");
    nextSteps.push("Install the supervised service with `reagent service install` when you want always-on startup.");
  }
  nextSteps.push("Inspect the runtime overview with `reagent home`.");
  nextSteps.push("Start the first research task with `reagent research enqueue \"topic\" --question \"...\"`.");

  const payload: OnboardPayload = {
    version,
    envFile: {
      path: envTargetPath,
      exists: envExists,
    },
    workspace: {
      path: workspacePath,
      exists: workspaceExists,
    },
    database: {
      url: context.runtimeEnv.DATABASE_URL,
      sqlitePath,
      ready: skipDbPush || apply,
    },
    runtime: {
      gatewayUrl: context.baseUrl,
      gatewayInstalled: Boolean(gateway?.installed),
      gatewayReachable: Boolean(gateway?.healthReachable),
    },
    actions: {
      apply,
      skipDb: skipDbPush,
      installService,
    },
    nextSteps,
  };

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log("ReAgent Onboard");
  console.log(`Version: ${payload.version}`);
  console.log(`Env file: ${payload.envFile.path} (${payload.envFile.exists ? "ready" : "missing"})`);
  console.log(`Workspace: ${payload.workspace.path} (${payload.workspace.exists ? "ready" : "missing"})`);
  console.log(`Database: ${payload.database.sqlitePath ?? payload.database.url} (${payload.database.ready ? "ready" : "pending"})`);
  console.log(`Gateway URL: ${payload.runtime.gatewayUrl}`);
  console.log(`Gateway installed: ${formatYesNo(payload.runtime.gatewayInstalled)}`);
  console.log(`Gateway reachable: ${formatYesNo(payload.runtime.gatewayReachable)}`);
  console.log("");
  console.log("Next steps:");
  for (const step of payload.nextSteps) {
    console.log(`  - ${step}`);
  }
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

async function statusCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const detailed = getBooleanFlag(options, "all", "verbose");
  const [runtimeResult, channelsResult, memoryResult, localGateway, openclawOverview] = await Promise.all([
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
    buildOpenClawOverview(),
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
    openclaw: {
      ...openclawOverview,
      cliPath: runtime.openclaw.cliPath,
      gatewayUrl: runtime.openclaw.gatewayUrl,
      channelId: runtime.openclaw.channelId,
    },
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
  console.log(
    `OpenClaw: imported=${formatYesNo(payload.openclaw.upstreamAvailable)} foundation=${payload.openclaw.foundationPackageCount} upstream=${payload.openclaw.importedExtensionCount} sessions=${payload.openclaw.sessionRegistryCount}`,
  );
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
  printHomeSection("OpenClaw", [
    `CLI: ${payload.openclaw.cliPath}`,
    `Gateway URL: ${payload.openclaw.gatewayUrl}`,
    `Channel: ${payload.openclaw.channelId}`,
    `Imported upstream: ${formatYesNo(payload.openclaw.upstreamAvailable)}`,
    `Foundation packages: ${payload.openclaw.foundationPackageCount}`,
    `Imported upstream extensions: ${payload.openclaw.importedExtensionCount}`,
    `Cached host sessions: ${payload.openclaw.sessionRegistryCount}`,
    `Session registry updated: ${formatWhen(payload.openclaw.sessionRegistryUpdatedAt)}`,
    `Imported commit: ${payload.openclaw.sourceCommit ?? "-"}`,
  ]);
  console.log("");
  console.log("Memory:");
  printMemoryStatus(memory);
}

function buildHomeNextSteps(input: {
  gateway: GatewayStatusSnapshot;
  runtime: RuntimeMetaPayload;
  channels: ChannelsStatusSnapshot;
  memory: MemoryStatus;
  recentReports: ResearchReportSummary[];
  recentTasks: ResearchTaskSummary[];
}): string[] {
  const steps: string[] = [];

  if (!input.gateway.healthReachable) {
    steps.push(
      input.gateway.installed
        ? "Start the supervised runtime with `reagent service start`."
        : "Start the runtime with `reagent service run`.",
    );
    steps.push("Check the current runtime state with `reagent service status`.");
    return steps;
  }

  if (input.runtime.wechatProvider === "openclaw") {
    steps.push("Inspect OpenClaw host and imported upstream details with `reagent status --all`.");
  }

  if (input.runtime.wechatProvider !== "mock" && !input.channels.channels.wechat.connected) {
    steps.push("Complete channel setup with `reagent channels login`.");
  }

  if (input.memory.files === 0) {
    steps.push("Store the first durable note with `reagent memory remember \"...\" --title \"...\"`.");
  }

  const activeTask = input.recentTasks.find((task) => task.state !== "completed" && task.state !== "failed");
  if (activeTask) {
    steps.push(`Inspect the active research task with \`reagent research task ${activeTask.taskId}\`.`);
  } else if (input.recentReports.length === 0) {
    steps.push("Start the next research run with `reagent research enqueue \"topic\" --question \"...\"`.");
  } else {
    steps.push(`Review the latest report with \`reagent research report ${input.recentReports[0]!.taskId}\`.`);
  }

  steps.push("Open the dashboard when needed with `reagent dashboard --no-open`.");
  return steps;
}

function buildHomeState(input: {
  gateway: GatewayStatusSnapshot;
  runtime: RuntimeMetaPayload;
  channels: ChannelsStatusSnapshot;
  memory: MemoryStatus;
  recentReports: ResearchReportSummary[];
  recentTasks: ResearchTaskSummary[];
  activeTaskCount: number;
}): Pick<HomePayload, "mode" | "headline" | "summary"> {
  if (!input.gateway.healthReachable) {
    return {
      mode: "runtime-stopped",
      headline: "Runtime needs attention",
      summary: input.gateway.installed
        ? "The supervised runtime is installed but not currently reachable."
        : "The runtime is not running yet. Start it before using research and memory surfaces.",
    };
  }

  if (
    input.memory.files === 0 &&
    input.recentReports.length === 0 &&
    input.recentTasks.length === 0
  ) {
    return {
      mode: "first-run",
      headline: "First run setup",
      summary: "The runtime is reachable, but this workspace has not produced memory or research artifacts yet.",
    };
  }

  if (input.runtime.wechatProvider !== "mock" && !input.channels.channels.wechat.connected) {
    return {
      mode: "channel-setup",
      headline: "Channel setup is still pending",
      summary: "The runtime is healthy, but the configured WeChat channel is not connected yet.",
    };
  }

  if (input.activeTaskCount > 0) {
    return {
      mode: "active-research",
      headline: "Research is currently in progress",
      summary: "At least one research task is active. Review the task state before starting another long run.",
    };
  }

  if (input.recentReports.length > 0) {
    return {
      mode: "report-ready",
      headline: "Recent research output is ready",
      summary: "The runtime is healthy and there is at least one reusable report available to review or extend.",
    };
  }

  return {
    mode: "ready",
    headline: "Runtime is ready",
    summary: "Core runtime surfaces are available. Continue from research, memory, or the dashboard.",
  };
}

async function homeCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const [version, runtimeResult, channelsResult, memoryResult, recentReportsResult, recentTasksResult, localGateway] =
    await Promise.all([
      readPackageVersion(),
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
      settleCliRequest(
        requestGatewayJson<ResearchRecentPayload>(
          context.baseUrl,
          `/api/research/recent?${buildQueryString({ limit: 3 })}`,
          { timeoutMs: context.timeoutMs },
        ),
      ),
      settleCliRequest(
        requestGatewayJson<ResearchTasksPayload>(
          context.baseUrl,
          `/api/research/tasks?${buildQueryString({ limit: 5 })}`,
          { timeoutMs: context.timeoutMs },
        ),
      ),
      maybeReadLocalGatewayStatus(context.baseUrl, context.runtimeEnv.PORT, false),
    ]);

  const gateway = localGateway ?? (runtimeResult.ok ? runtimeResult.value.deployment.gateway.supervisor : null);
  if (!gateway) {
    const [firstError] = summarizeCliWarnings([
      runtimeResult,
      channelsResult,
      memoryResult,
      recentReportsResult,
      recentTasksResult,
    ]);
    throw new Error(firstError ?? "Home overview is unavailable.");
  }

  const runtime = runtimeResult.ok ? runtimeResult.value : buildFallbackRuntimeMeta(context, gateway, runtimeResult.error);
  const channels = channelsResult.ok
    ? channelsResult.value
    : await buildFallbackChannelsSnapshot(context.runtimeEnv, gateway, channelsResult.error, false);
  const memory = memoryResult.ok ? memoryResult.value : buildFallbackMemoryStatus(context.runtimeEnv);
  const recentReports = recentReportsResult.ok ? recentReportsResult.value.reports : [];
  const recentTasks = recentTasksResult.ok ? recentTasksResult.value.tasks : [];
  const warnings = summarizeCliWarnings([
    runtimeResult,
    channelsResult,
    memoryResult,
    recentReportsResult,
    recentTasksResult,
  ]);
  const dashboardUrl = `${context.baseUrl}/`;
  const activeTaskCount = recentTasks.filter((task) => task.state !== "completed" && task.state !== "failed").length;
  const homeState = buildHomeState({
    gateway,
    runtime,
    channels,
    memory,
    recentReports,
    recentTasks,
    activeTaskCount,
  });
  const payload: HomePayload = {
    url: context.baseUrl,
    version,
    degraded: warnings.length > 0,
    ...(warnings.length > 0 ? { warnings } : {}),
    mode: homeState.mode,
    headline: homeState.headline,
    summary: homeState.summary,
    runtime,
    channels,
    memory,
    gateway,
    research: {
      recentReports,
      recentTasks,
      activeTaskCount,
    },
    nextSteps: buildHomeNextSteps({
      gateway,
      runtime,
      channels,
      memory,
      recentReports,
      recentTasks,
    }),
    dashboardUrl,
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

  console.log("ReAgent Home");
  console.log("");
  console.log(`Mode: ${payload.mode}`);
  console.log(`Headline: ${payload.headline}`);
  console.log(`${payload.summary}`);
  console.log("");

  printHomeSection("Overview", [
    `Version: ${version}`,
    `Gateway URL: ${context.baseUrl}`,
    `Dashboard: ${dashboardUrl}`,
    `Workspace: ${runtime.workspaceDir}`,
  ]);

  printHomeSection("Runtime", [
    `Gateway: ${gateway.healthReachable ? "running" : gateway.installed ? "installed" : "not installed"}`,
    `Agent: ${runtime.agent}`,
    `LLM: ${runtime.llmProvider}/${runtime.llmModel}${runtime.llmWireApi ? ` via ${runtime.llmWireApi}` : ""}`,
    `WeChat provider: ${runtime.wechatProvider}`,
    `Channel connected: ${formatYesNo(channels.channels.wechat.connected)}`,
  ]);

  printHomeSection("OpenClaw", [
    `CLI: ${runtime.openclaw.cliPath}`,
    `Gateway URL: ${runtime.openclaw.gatewayUrl}`,
    `Channel: ${runtime.openclaw.channelId}`,
  ]);

  printHomeSection("Research", [
    `Recent reports: ${recentReports.length}`,
    `Recent tasks: ${recentTasks.length}`,
    `Active tasks: ${payload.research.activeTaskCount}`,
    `Latest report: ${recentReports[0] ? `${recentReports[0].topic} (${recentReports[0].generatedAt})` : "-"}`,
    `Latest task: ${recentTasks[0] ? `${recentTasks[0].topic} | state=${recentTasks[0].state} | progress=${recentTasks[0].progress}%` : "-"}`,
  ]);

  printHomeSection("Memory", [
    `Files: ${memory.files}`,
    `Updated: ${formatWhen(memory.lastUpdatedAt)}`,
  ]);

  console.log("Next Steps:");
  for (const step of payload.nextSteps) {
    console.log(`  - ${step}`);
  }
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

async function researchWorkstreamCommand(options: ParsedOptions): Promise<void> {
  const context = await resolveGatewayContext(options);
  const taskId = options.positionals[0]?.trim();
  const workstreamId = options.positionals[1]?.trim();
  if (!taskId) {
    throw new Error("research workstream requires a task id.");
  }
  if (workstreamId !== "search" && workstreamId !== "reading" && workstreamId !== "synthesis") {
    throw new Error("research workstream requires one of: search, reading, synthesis.");
  }

  const payload = await requestGatewayJson<{
    workstreamId: "search" | "reading" | "synthesis";
    path: string;
    content: string;
  }>(
    context.baseUrl,
    `/api/research/tasks/${encodeURIComponent(taskId)}/workstreams/${encodeURIComponent(workstreamId)}`,
    { timeoutMs: context.timeoutMs },
  );

  if (getBooleanFlag(options, "json")) {
    printJson(payload);
    return;
  }

  console.log(`Workstream: ${payload.workstreamId}`);
  console.log(`Path: ${payload.path}`);
  console.log("");
  process.stdout.write(payload.content.endsWith("\n") ? payload.content : `${payload.content}\n`);
}

async function researchCommand(options: ParsedOptions): Promise<void> {
  await runResearchCommandDispatch(options, {
    renderResearchHelp,
    researchRecentCommand,
    researchRunCommand,
    researchEnqueueCommand,
    researchTasksCommand,
    researchTaskCommand,
    researchReportCommand,
    researchRetryCommand,
    researchHandoffCommand,
    researchWorkstreamCommand,
    researchDirectionsCommand,
    researchDirectionCommand,
    researchDiscoveryCommand,
    researchFeedbackCommand,
    researchGraphCommand,
    researchArtifactCommand,
    researchSourceCommand,
    researchPaperReportCommand,
    researchRepoReportCommand,
    researchModuleAssetsCommand,
    researchModuleAssetCommand,
    researchPresentationsCommand,
    researchPresentationCommand,
    researchDirectionReportsCommand,
    researchDirectionReportCommand,
    researchCandidatesCommand,
    researchCandidateCommand,
  });
}

async function resolveWorkspaceConfigService(options: ParsedOptions): Promise<WorkspaceConfigService> {
  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  const workspaceDir = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
  const module = await import("./services/workspaceConfigService.js");
  return new module.WorkspaceConfigService(workspaceDir);
}

async function resolveWorkspaceDir(options: ParsedOptions): Promise<string> {
  applyRuntimeOverrides(options);
  const runtimeEnv = await loadRuntimeEnv();
  return path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
}

async function doctorCommand(options: ParsedOptions): Promise<void> {
  applyRuntimeOverrides(options);
  const version = await readPackageVersion();
  const runtimeEnv = await loadRuntimeEnv();
  const envTargetPath = path.join(process.cwd(), ".env");
  const workspacePath = path.resolve(process.cwd(), runtimeEnv.PLATFORM_WORKSPACE_DIR);
  const sqlitePath = resolveSqlitePath(runtimeEnv.DATABASE_URL, process.cwd());
  const sqliteDirPath = sqlitePath ? path.dirname(sqlitePath) : null;
  const fix = getBooleanFlag(options, "fix");
  const skipDbPush = getBooleanFlag(options, "skip-db");
  let envExists = await pathExists(envTargetPath);
  let workspaceExists = await pathExists(workspacePath);
  let sqliteDirExists = sqliteDirPath ? await pathExists(sqliteDirPath) : true;
  const fixesApplied: string[] = [];

  if (fix) {
    if (!envExists) {
      await copyFile(resolvePackagePath(".env.example"), envTargetPath);
      envExists = true;
      fixesApplied.push(`Created ${envTargetPath}`);
    }
    if (!workspaceExists) {
      await ensureDirectoryExists(workspacePath);
      workspaceExists = true;
      fixesApplied.push(`Created workspace directory ${workspacePath}`);
    }
    if (sqliteDirPath && !sqliteDirExists) {
      await ensureDirectoryExists(sqliteDirPath);
      sqliteDirExists = true;
      fixesApplied.push(`Created SQLite directory ${sqliteDirPath}`);
    }
    if (!skipDbPush) {
      await runDbPush(runtimeEnv);
      fixesApplied.push("Applied Prisma db push.");
    }
  }

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
    workspace: workspacePath,
    databaseUrl: runtimeEnv.DATABASE_URL,
    sqlitePath: sqlitePath ?? "(non-file datasource)",
    sqliteDirPath: sqliteDirPath ?? null,
    envFile: {
      path: envTargetPath,
      exists: envExists,
    },
    workspaceReady: workspaceExists,
    sqliteDirReady: sqliteDirExists,
    schemaPath: resolvePackagePath("prisma", "schema.prisma"),
    webAssets: resolvePackagePath("web"),
    openclawCli: runtimeEnv.OPENCLAW_CLI_PATH,
    openclawStatus: openClawStatus.ok ? openClawStatus.output || "available" : openClawStatus.output || "unavailable",
    gatewayDefaultPort: DEFAULT_GATEWAY_PORT,
    gatewayInspectPort: gatewayStatus.port,
    gateway: gatewayStatus,
    actions: {
      fix,
      skipDb: skipDbPush,
      fixesApplied,
    },
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
  console.log(`Env file: ${payload.envFile.path} (${payload.envFile.exists ? "ready" : "missing"})`);
  console.log(`Workspace: ${payload.workspace}`);
  console.log(`Workspace ready: ${formatYesNo(payload.workspaceReady)}`);
  console.log(`Database URL: ${payload.databaseUrl}`);
  console.log(`SQLite path: ${payload.sqlitePath}`);
  console.log(`SQLite dir: ${payload.sqliteDirPath ?? "-"}`);
  console.log(`SQLite dir ready: ${formatYesNo(payload.sqliteDirReady)}`);
  console.log(`Schema path: ${payload.schemaPath}`);
  console.log(`Web assets: ${payload.webAssets}`);
  console.log(`OpenClaw CLI: ${payload.openclawCli}`);
  console.log(`OpenClaw status: ${payload.openclawStatus}`);
  console.log(`Gateway default port: ${payload.gatewayDefaultPort}`);
  console.log(`Gateway inspect port: ${payload.gatewayInspectPort}`);
  if (payload.actions.fix) {
    console.log(`Fix mode: yes${payload.actions.skipDb ? " (db push skipped)" : ""}`);
    if (payload.actions.fixesApplied.length > 0) {
      console.log("Applied fixes:");
      for (const item of payload.actions.fixesApplied) {
        console.log(`  - ${item}`);
      }
    } else {
      console.log("Applied fixes: none");
    }
  }
  printGatewayStatus(gatewayStatus, false);
}

async function versionCommand(): Promise<void> {
  console.log(await readPackageVersion());
}

const {
  renderChannelsHelp,
  renderChannelsAgentHelp,
  channelsStatusCommand,
  channelsLogsCommand,
  channelsMessagesCommand,
  channelsChatCommand,
  channelsInboundCommand,
  channelsPushCommand,
  channelsSessionsCommand,
  channelsAgentSessionsCommand,
  channelsAgentSessionCommand,
  channelsAgentRoleCommand,
  channelsAgentSkillsCommand,
  channelsAgentModelCommand,
  channelsAgentFallbacksCommand,
  channelsAgentReasoningCommand,
  channelsLoginCommand,
  channelsWaitCommand,
  channelsLogoutCommand,
  channelsAgentCommand,
  channelsCommand,
} = createChannelsCli({
  resolveGatewayContext,
  settleCliRequest,
  requestGatewayJson,
  maybeReadLocalGatewayStatus,
  buildFallbackChannelsSnapshot,
  printJson,
  printWeChatStatus,
  formatWhen,
  printOpenClawSessions,
  buildQueryString,
});

const {
  buildOpenClawOverview,
  openClawInspectCommand,
  openClawSessionsCommand,
  openClawHistoryCommand,
  openClawWatchCommand,
  openClawSyncCommand,
  pluginsListCommand,
  pluginsMarketplaceListCommand,
  renderPluginsMarketplaceHelp,
  pluginsInspectCommand,
  delegatePluginCommand,
  delegateOpenClawCommandFamily,
  pluginsCommand,
} = createOpenClawCli({
  loadRuntimeEnv,
  renderPluginsHelp,
  printJson,
  printBundledPluginList,
  formatMarketplaceSource,
  formatYesNo,
  formatWhen,
  printOpenClawSessions,
  printOpenClawHistory,
  printOpenClawEvents,
  runExternalCli,
});

const {
  gatewayInstallCommand,
  gatewayCommand,
  healthCommand,
  dashboardCommand,
  logsCommand,
  runtimeCommand,
  serviceCommand,
  systemCommand,
} = createRuntimeSurfaceCli({
  gatewayRunCommand,
  resolveGatewayContext,
  resolveGatewayTimeoutMs,
  normalizeGatewayBaseUrl,
  requestGatewayJson,
  buildQueryString,
  printJson,
  printGatewayStatus,
  formatYesNo,
  formatWhen,
  printRuntimeJobs,
  renderRuntimeHelp,
  renderServiceHelp,
  renderSystemHelp,
  statusCommand,
  homeCommand,
  doctorCommand,
  openUrlInBrowser,
  renderLogDelta,
  sleep,
});

const {
  memoryStatusCommand,
  memoryFilesCommand,
  memoryFileCommand,
  memorySearchCommand,
  memoryRecallCommand,
  memoryRememberCommand,
  memoryPolicyCommand,
  memoryCompactCommand,
  memoryCompactionsCommand,
  memorySchedulerRuntimeCommand,
  memorySchedulerRunsCommand,
  memoryCommand,
} = createMemoryCli({
  resolveGatewayContext,
  requestGatewayJson,
  buildQueryString,
  printJson,
  renderMemoryHelp,
  printMemoryStatus,
  printMemoryFiles,
  printMemoryFile,
  printMemorySearchResults,
  printMemoryRecallResults,
  printMemoryCompactionResult,
  printCompactionRecords,
  printJobRuntimeSnapshot,
  printJobRuntimeRuns,
  getQueryInput,
  formatYesNo,
});

const {
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
} = createWorkspaceControlCli({
  resolveWorkspaceConfigService,
  resolveWorkspaceDir,
  resolveConfigAlias,
  resolveEditorCommand,
  runEditorCommand,
  readStdinText,
  printJson,
  printManagedConfigFiles,
  printConfigValue,
  printConfigValidationReport,
  printLlmSummary,
  printMcpServerStatuses,
  printSkillStatusReport,
  printInboundCommandRegistry,
  printInboundCommandAuthorization,
  formatYesNo,
  renderConfigHelp,
  renderModelsHelp,
  renderMcpHelp,
  renderSkillsHelp,
  renderCommandsHelp,
});

const {
  researchArtifactCommand,
  researchSourceCommand,
  researchPaperReportCommand,
  researchRepoReportCommand,
  researchModuleAssetsCommand,
  researchModuleAssetCommand,
  researchPresentationsCommand,
  researchPresentationCommand,
  researchDirectionReportsCommand,
  researchDirectionReportGetCommand,
  researchDirectionReportGenerateCommand,
  researchDirectionReportCommand,
} = createResearchArtifactsReportsCli({
  resolveGatewayContext,
  requestGatewayBytes,
  requestGatewayJson,
  buildQueryString,
  printJson,
  resolveRequiredEntityId,
  printResearchSourceItem,
  printResearchPaperReport,
  printResearchRepoReport,
  printResearchModuleAssets,
  printResearchModuleAsset,
  printResearchPresentations,
  printResearchPresentation,
  printResearchDirectionReports,
  printResearchDirectionReport,
});

const {
  researchCandidatesCommand,
  researchCandidateGetCommand,
  researchCandidateGenerateCommand,
  researchCandidateReviewCommand,
  researchCandidateApproveCommand,
  researchCandidateRejectCommand,
  researchCandidateApplyCommand,
  researchCandidateRollbackCommand,
  researchCandidateCommand,
} = createResearchCandidatesCli({
  resolveGatewayContext,
  requestGatewayJson,
  buildQueryString,
  printJson,
  resolveRequiredEntityId,
  printResearchEvolutionCandidates,
  printResearchEvolutionCandidate,
  printResearchEvolutionCandidateApplyOutcome,
  printResearchEvolutionCandidateRollbackOutcome,
});

const {
  researchDirectionsCommand,
  researchDirectionGetCommand,
  researchDirectionUpsertCommand,
  researchDirectionBriefCommand,
  researchDirectionPlanCommand,
  researchDirectionImportBriefCommand,
  researchDirectionDeleteCommand,
  researchDirectionCommand,
  researchDiscoveryPlanCommand,
  researchDiscoveryRecentCommand,
  researchDiscoveryInspectCommand,
  researchDiscoveryRunCommand,
  researchDiscoverySchedulerStatusCommand,
  researchDiscoverySchedulerSetCommand,
  researchDiscoverySchedulerTickCommand,
  researchDiscoverySchedulerRuntimeCommand,
  researchDiscoverySchedulerRunsCommand,
  researchDiscoverySchedulerCommand,
  researchDiscoveryCommand,
} = createResearchDirectionDiscoveryCli({
  resolveGatewayContext,
  requestGatewayJson,
  requestGatewayText,
  requestGatewayResponse,
  buildQueryString,
  printJson,
  printResearchDirections,
  printResearchDirection,
  printResearchDiscoveryPlan,
  printResearchDiscoveryRuns,
  printResearchDiscoveryRun,
  printResearchSchedulerStatus,
  printJobRuntimeSnapshot,
  printJobRuntimeRuns,
  resolveRequiredEntityId,
  parseCommaSeparatedValues,
  readInputSource,
  renderResearchHelp,
});

const {
  researchFeedbackListCommand,
  researchFeedbackRecordCommand,
  researchFeedbackCommand,
  researchGraphShowCommand,
  researchGraphNodeCommand,
  researchGraphPathCommand,
  researchGraphExplainCommand,
  researchGraphReportCommand,
  researchGraphCommand,
} = createResearchGraphFeedbackCli({
  resolveGatewayContext,
  requestGatewayJson,
  buildQueryString,
  printJson,
  printResearchFeedback,
  resolveResearchGraphQuery,
  printResearchGraph,
  printResearchGraphReport,
  printResearchGraphPath,
  resolveRequiredEntityId,
  renderResearchHelp,
});

type CliCommandHandler = (options: ParsedOptions) => Promise<void>;

function createOpenClawFamilyHandler(family: OpenClawCommandFamily): CliCommandHandler {
  return async (options) => delegateOpenClawCommandFamily(options, family);
}

function createPluginDelegateHandler(subcommand: PluginDelegateSubcommand): CliCommandHandler {
  return async (options) => delegatePluginCommand(options, subcommand);
}

const ROOT_OPENCLAW_FAMILY_HANDLERS = Object.fromEntries(
  OPENCLAW_COMMAND_FAMILIES.map((family) => [family, createOpenClawFamilyHandler(family)]),
) as Record<OpenClawCommandFamily, CliCommandHandler>;

const ROOT_PLUGIN_DELEGATE_HANDLERS = Object.fromEntries(
  (["install", "uninstall", "enable", "disable", "update"] as PluginDelegateSubcommand[])
    .map((subcommand) => [subcommand, createPluginDelegateHandler(subcommand)]),
) as Record<Exclude<PluginDelegateSubcommand, "doctor">, CliCommandHandler>;

const ROOT_COMMAND_HANDLERS: Record<string, CliCommandHandler> = {
  health: healthCommand,
  login: channelsLoginCommand,
  wait: channelsWaitCommand,
  logout: channelsLogoutCommand,
  ...ROOT_OPENCLAW_FAMILY_HANDLERS,
  send: channelsPushCommand,
  push: channelsPushCommand,
  sessions: openClawSessionsCommand,
  history: openClawHistoryCommand,
  inspect: openClawInspectCommand,
  ...ROOT_PLUGIN_DELEGATE_HANDLERS,
  onboard: onboardCommand,
  home: homeCommand,
  status: statusCommand,
  watch: openClawWatchCommand,
  dashboard: dashboardCommand,
  logs: logsCommand,
  runtime: runtimeCommand,
  system: systemCommand,
  commands: commandsCommand,
  models: modelsCommand,
  mcp: mcpCommand,
  skills: skillsCommand,
  research: researchCommand,
  config: configCommand,
  plugins: pluginsCommand,
  channels: channelsCommand,
  memory: memoryCommand,
  gateway: gatewayCommand,
  service: serviceCommand,
  daemon: serviceCommand,
  start: startCommand,
  init: initCommand,
  doctor: doctorCommand,
};

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

  const command = rawArgs[0]!;
  const options = parseOptions(rawArgs.slice(1));

  const commandHandler = ROOT_COMMAND_HANDLERS[command];
  if (commandHandler) {
    await commandHandler(options);
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
