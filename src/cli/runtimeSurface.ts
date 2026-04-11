import {
  DEFAULT_GATEWAY_PORT,
  getGatewayServiceStatus,
  installGatewayService,
  readGatewayLogTail,
  restartGatewayService,
  startGatewayService,
  stopGatewayService,
  uninstallGatewayService,
} from "../gatewayService.js";
import { consumePositionals, getBooleanFlag, getIntegerFlag, getStringFlag, type ParsedOptions } from "./args.js";

type GatewayContextLike = {
  baseUrl: string;
  timeoutMs: number;
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  accept?: string;
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
  deployment: {
    gateway: {
      runtime: {
        healthUrl: string;
      };
    };
  };
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
};

type RuntimeJobsPayload = {
  items: Array<{
    id: string;
    label: string;
    snapshot: unknown;
    recentRuns: unknown[];
  }>;
};

export interface RuntimeSurfaceCliDeps {
  gatewayRunCommand(options: ParsedOptions): Promise<void>;
  resolveGatewayContext(options: ParsedOptions): Promise<GatewayContextLike>;
  resolveGatewayTimeoutMs(options: ParsedOptions, fallback?: number): number;
  normalizeGatewayBaseUrl(value: string): string;
  requestGatewayJson<T>(baseUrl: string, targetPath: string, options?: GatewayRequestOptions): Promise<T>;
  buildQueryString(values: Record<string, string | number | boolean | undefined>): string;
  printJson(value: unknown): void;
  printGatewayStatus(snapshot: unknown, asJson: boolean): void;
  formatYesNo(value: boolean): string;
  formatWhen(value: string | null | undefined): string;
  printRuntimeJobs(items: RuntimeJobsPayload["items"]): void;
  renderRuntimeHelp(): void;
  renderServiceHelp(): void;
  renderSystemHelp(): void;
  statusCommand(options: ParsedOptions): Promise<void>;
  homeCommand(options: ParsedOptions): Promise<void>;
  doctorCommand(options: ParsedOptions): Promise<void>;
  openUrlInBrowser(targetUrl: string): Promise<boolean>;
  renderLogDelta(label: string, previousContent: string, nextContent: string): string[];
  sleep(ms: number): Promise<void>;
}

export function createRuntimeSurfaceCli(deps: RuntimeSurfaceCliDeps) {
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
    deps.printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
  }

  async function gatewayStatusCommand(options: ParsedOptions): Promise<void> {
    const snapshot = await getGatewayServiceStatus(getStringFlag(options, "port"), {
      deep: getBooleanFlag(options, "deep"),
      probe: !getBooleanFlag(options, "no-probe"),
    });
    deps.printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
  }

  async function gatewayProbeRuntime(baseUrl: string, timeoutMs: number): Promise<GatewayProbePayload> {
    try {
      const health = await deps.requestGatewayJson<GatewayHealthPayload>(baseUrl, "/health", {
        timeoutMs,
      });
      try {
        const runtime = await deps.requestGatewayJson<RuntimeMetaPayload>(baseUrl, "/api/runtime/meta", {
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
    const timeoutMs = deps.resolveGatewayTimeoutMs(options);
    const explicitUrl = getStringFlag(options, "url", "gateway-url");
    const baseUrl = explicitUrl ? deps.normalizeGatewayBaseUrl(explicitUrl) : (await deps.resolveGatewayContext(options)).baseUrl;
    const payload = await gatewayProbeRuntime(baseUrl, timeoutMs);

    if (getBooleanFlag(options, "require-rpc") && !payload.rpcReachable) {
      throw new Error(payload.error ?? `Gateway probe could not reach the runtime RPC surface at ${payload.url}.`);
    }

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
      return;
    }

    console.log(`Gateway URL: ${payload.url}`);
    console.log(`Health reachable: ${deps.formatYesNo(payload.healthReachable)}`);
    console.log(`Health status: ${deps.formatWhen(payload.healthStatus)}`);
    console.log(`Runtime RPC reachable: ${deps.formatYesNo(payload.rpcReachable)}`);
    console.log(`Agent: ${deps.formatWhen(payload.agent)}`);
    console.log(`Workspace: ${deps.formatWhen(payload.workspaceDir)}`);
    console.log(`LLM provider: ${deps.formatWhen(payload.llmProvider)}`);
    console.log(`WeChat provider: ${deps.formatWhen(payload.wechatProvider)}`);
    if (payload.error) {
      console.log(`Error: ${payload.error}`);
    }
  }

  async function gatewayStartCommand(options: ParsedOptions): Promise<void> {
    const snapshot = await startGatewayService();
    deps.printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
  }

  async function gatewayStopCommand(options: ParsedOptions): Promise<void> {
    const snapshot = await stopGatewayService();
    if (getBooleanFlag(options, "json")) {
      deps.printGatewayStatus(snapshot, true);
      return;
    }
    console.log("Gateway stop sent.");
    deps.printGatewayStatus(snapshot, false);
  }

  async function gatewayRestartCommand(options: ParsedOptions): Promise<void> {
    const snapshot = await restartGatewayService();
    deps.printGatewayStatus(snapshot, getBooleanFlag(options, "json"));
  }

  async function gatewayUninstallCommand(options: ParsedOptions): Promise<void> {
    await uninstallGatewayService();
    if (getBooleanFlag(options, "json")) {
      deps.printJson({ ok: true, uninstalled: true });
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

  async function healthCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const health = await deps.requestGatewayJson<GatewayHealthPayload>(context.baseUrl, "/health", {
      timeoutMs: context.timeoutMs,
    });
    const verbose = getBooleanFlag(options, "verbose", "deep");
    const runtime = verbose
      ? await deps.requestGatewayJson<RuntimeMetaPayload>(context.baseUrl, "/api/runtime/meta", {
          timeoutMs: context.timeoutMs,
        })
      : null;
    const payload = {
      url: context.baseUrl,
      health,
      ...(runtime ? { runtime } : {}),
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
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

  async function dashboardCommand(options: ParsedOptions): Promise<void> {
    const context = await deps.resolveGatewayContext(options);
    const url = `${context.baseUrl}/`;
    const shouldOpen = !getBooleanFlag(options, "no-open");
    const opened = shouldOpen ? await deps.openUrlInBrowser(url) : false;
    const payload = {
      url,
      opened,
    };

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
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

    const context = await deps.resolveGatewayContext(options);
    const lines = Math.max(20, Math.min(getIntegerFlag(options, "lines", "limit") ?? 120, 400));
    const payload = await deps.requestGatewayJson<RuntimeLogPayload>(
      context.baseUrl,
      `/api/ui/runtime-log?${deps.buildQueryString({ lines })}`,
      {
        timeoutMs: context.timeoutMs,
      },
    );

    if (getBooleanFlag(options, "json")) {
      deps.printJson(payload);
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
      await deps.sleep(pollMs);
      const nextPayload = await deps.requestGatewayJson<RuntimeLogPayload>(
        context.baseUrl,
        `/api/ui/runtime-log?${deps.buildQueryString({ lines })}`,
        {
          timeoutMs: context.timeoutMs,
        },
      );
      const stdoutDelta = deps.renderLogDelta("STDOUT", previousPayload.stdout.content, nextPayload.stdout.content);
      const stderrDelta = deps.renderLogDelta("STDERR", previousPayload.stderr.content, nextPayload.stderr.content);
      for (const line of [...stdoutDelta, ...stderrDelta]) {
        console.log(line);
      }
      previousPayload = nextPayload;
    }
  }

  async function gatewayCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      renderGatewayHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined) {
      await deps.gatewayRunCommand(options);
      return;
    }

    if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
      renderGatewayHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);

    if (subcommand === "run") {
      await deps.gatewayRunCommand(subOptions);
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
      deps.renderRuntimeHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "status") {
      await deps.statusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
      deps.renderRuntimeHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);

    if (subcommand === "health") {
      await healthCommand(subOptions);
      return;
    }
    if (subcommand === "home") {
      await deps.homeCommand(subOptions);
      return;
    }
    if (subcommand === "jobs") {
      const context = await deps.resolveGatewayContext(subOptions);
      const limit = Math.max(1, Math.min(getIntegerFlag(subOptions, "limit") ?? 5, 50));
      const payload = await deps.requestGatewayJson<RuntimeJobsPayload>(
        context.baseUrl,
        `/api/runtime/jobs?${deps.buildQueryString({ limit })}`,
        { timeoutMs: context.timeoutMs },
      );
      if (getBooleanFlag(subOptions, "json")) {
        deps.printJson(payload);
        return;
      }
      deps.printRuntimeJobs(payload.items);
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
      await deps.doctorCommand(subOptions);
      return;
    }

    throw new Error(`Unknown runtime command: ${subcommand}`);
  }

  async function serviceCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderServiceHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "status") {
      await gatewayStatusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
      deps.renderServiceHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);

    if (subcommand === "run") {
      await deps.gatewayRunCommand(subOptions);
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

  async function systemCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderSystemHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (subcommand === undefined || subcommand === "status") {
      await deps.statusCommand(subcommand === undefined ? options : consumePositionals(options, 1));
      return;
    }
    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderSystemHelp();
      return;
    }

    const subOptions = consumePositionals(options, 1);
    if (subcommand === "health") {
      await healthCommand(subOptions);
      return;
    }
    if (subcommand === "home") {
      await deps.homeCommand(subOptions);
      return;
    }
    if (subcommand === "doctor") {
      await deps.doctorCommand(subOptions);
      return;
    }
    if (subcommand === "logs") {
      await logsCommand(subOptions);
      return;
    }
    if (subcommand === "runtime") {
      await runtimeCommand(subOptions);
      return;
    }
    if (subcommand === "service") {
      await serviceCommand(subOptions);
      return;
    }

    throw new Error(`Unknown system command: ${subcommand}`);
  }

  return {
    renderGatewayHelp,
    gatewayInstallCommand,
    gatewayStatusCommand,
    gatewayProbeCommand,
    gatewayStartCommand,
    gatewayStopCommand,
    gatewayRestartCommand,
    gatewayUninstallCommand,
    gatewayLogsCommand,
    gatewayCommand,
    healthCommand,
    dashboardCommand,
    logsCommand,
    runtimeCommand,
    serviceCommand,
    systemCommand,
  };
}
