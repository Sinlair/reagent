import { spawn, spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { resolvePackagePath } from "./packagePaths.js";

export const DEFAULT_GATEWAY_PORT = 18789;
const DEFAULT_GATEWAY_TASK_NAME = "ReAgent Gateway";
const DEFAULT_GATEWAY_LAUNCH_AGENT_LABEL = "ai.reagent.gateway";
const DEFAULT_GATEWAY_SYSTEMD_UNIT = "reagent-gateway";
const SCHTASKS_TIMEOUT_MS = 15_000;
const GATEWAY_HEALTH_TIMEOUT_MS = 30_000;

export type GatewayInstallKind =
  | "launch-agent"
  | "systemd-user"
  | "scheduled-task"
  | "startup-entry";

export type GatewayServiceManager = "launchd" | "systemd" | "schtasks" | "startup";

type GatewayServiceMetadata = {
  version: 2;
  platform: NodeJS.Platform;
  installKind: GatewayInstallKind;
  serviceManager: GatewayServiceManager;
  port: number;
  serviceLabel: string;
  serviceConfigPath: string | null;
  taskScriptPath: string | null;
  startupEntryPath: string | null;
  stdoutLogPath: string;
  stderrLogPath: string;
  workingDirectory: string;
  programArguments: string[];
  installedAt: string;
};

type GatewayProbeStatus = {
  reachable: boolean;
  health: Record<string, unknown> | null;
  runtimeMeta: Record<string, unknown> | null;
};

export type GatewayExtraInstallation = {
  platform: NodeJS.Platform;
  manager: GatewayServiceManager;
  label: string;
  scope: "user" | "system";
  path: string | null;
  detail: string;
};

type GatewayRuntimeOverride = {
  healthReachable?: boolean;
  healthStatus?: string | null;
  runtimeWorkspaceDir?: string | null;
  runtimeAgent?: string | null;
  runtimeLlmProvider?: string | null;
  runtimeWechatProvider?: string | null;
  runtimeOpenClawCli?: string | null;
  listenerPid?: number | null;
};

type GatewayStatusOptions = {
  deep?: boolean;
  probe?: boolean;
  runtimeOverride?: GatewayRuntimeOverride;
};

type GatewayAvailability = {
  serviceSupported: boolean;
  serviceAvailable: boolean;
  detail: string | null;
};

type GatewayPlatformDefaults = {
  serviceManager: GatewayServiceManager | null;
  installKind: GatewayInstallKind | null;
  serviceLabel: string | null;
  serviceConfigPath: string | null;
  taskScriptPath: string | null;
  startupEntryPath: string | null;
};

export type GatewayStatusSnapshot = {
  platform: NodeJS.Platform;
  serviceManager: GatewayServiceManager | null;
  serviceSupported: boolean;
  serviceAvailable: boolean;
  availabilityDetail: string | null;
  taskName: string;
  serviceLabel: string | null;
  serviceConfigPath: string | null;
  installed: boolean;
  installKind: GatewayInstallKind | null;
  scheduledTaskRegistered: boolean;
  startupEntryInstalled: boolean;
  loaded: boolean;
  loadedText: string | null;
  port: number;
  workingDirectory: string | null;
  taskScriptPath: string | null;
  startupEntryPath: string | null;
  stdoutLogPath: string;
  stderrLogPath: string;
  healthUrl: string;
  healthReachable: boolean;
  healthStatus: string | null;
  runtimeWorkspaceDir: string | null;
  runtimeAgent: string | null;
  runtimeLlmProvider: string | null;
  runtimeWechatProvider: string | null;
  runtimeOpenClawCli: string | null;
  serviceState: string | null;
  taskState: string | null;
  lastRunTime: string | null;
  lastRunResult: string | null;
  serviceRuntimePid: number | null;
  listenerPid: number | null;
  installCommand: string;
  startCommand: string;
  restartCommand: string;
  statusCommand: string;
  deepStatusCommand: string;
  stopCommand: string;
  uninstallCommand: string;
  logsCommand: string;
  doctorCommand: string;
  deepDoctorCommand: string;
  extraInstallations: GatewayExtraInstallation[];
  issues: string[];
  hints: string[];
};

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type LaunchdServiceInfo = {
  state: string | null;
  pid: number | null;
  lastExitStatus: string | null;
};

type SystemdServiceInfo = {
  loadState: string | null;
  unitFileState: string | null;
  activeState: string | null;
  subState: string | null;
  mainPid: number | null;
  execMainStatus: string | null;
};

type WindowsTaskInfo = {
  entries: Record<string, string>;
  runtimePid: number | null;
};

function resolveGatewayStateDir(): string {
  const override = process.env.REAGENT_STATE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), ".reagent");
}

function resolveGatewayDaemonDir(): string {
  return path.join(resolveGatewayStateDir(), "daemon");
}

function resolveTaskName(): string {
  return process.env.REAGENT_WINDOWS_TASK_NAME?.trim() || DEFAULT_GATEWAY_TASK_NAME;
}

function resolveLaunchAgentLabel(): string {
  return process.env.REAGENT_LAUNCHD_LABEL?.trim() || DEFAULT_GATEWAY_LAUNCH_AGENT_LABEL;
}

function resolveSystemdUnitName(): string {
  const override = process.env.REAGENT_SYSTEMD_UNIT?.trim();
  if (!override) {
    return DEFAULT_GATEWAY_SYSTEMD_UNIT;
  }
  return override.endsWith(".service") ? override.slice(0, -".service".length) : override;
}

function resolveLaunchAgentPlistPath(label = resolveLaunchAgentLabel()): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

function resolveSystemdUnitPath(unitName = resolveSystemdUnitName()): string {
  return path.join(os.homedir(), ".config", "systemd", "user", `${unitName}.service`);
}

function resolveTaskScriptPath(): string {
  return path.join(resolveGatewayDaemonDir(), "gateway.cmd");
}

function resolveGatewayMetadataPath(): string {
  return path.join(resolveGatewayDaemonDir(), "gateway-service.json");
}

function resolveGatewayLogPath(kind: "out" | "err"): string {
  return path.join(resolveGatewayDaemonDir(), `gateway.${kind}.log`);
}

function resolveStartupEntryPath(taskName: string): string {
  const appData = process.env.APPDATA?.trim();
  if (appData) {
    return path.join(
      appData,
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs",
      "Startup",
      `${sanitizeWindowsFilename(taskName)}.cmd`,
    );
  }

  const home = process.env.USERPROFILE?.trim() || process.env.HOME?.trim() || os.homedir();
  return path.join(
    home,
    "AppData",
    "Roaming",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    `${sanitizeWindowsFilename(taskName)}.cmd`,
  );
}

function sanitizeWindowsFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").replace(/\p{Cc}/gu, "_");
}

function normalizePort(port?: number | string | null): number {
  if (typeof port === "number" && Number.isFinite(port) && port > 0 && port <= 65_535) {
    return Math.trunc(port);
  }
  if (typeof port === "string" && /^\d+$/u.test(port.trim())) {
    const parsed = Number.parseInt(port.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65_535) {
      return parsed;
    }
  }
  return DEFAULT_GATEWAY_PORT;
}

function parseKeyValueOutput(raw: string, separator = ":"): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/u)) {
    const index = line.indexOf(separator);
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + separator.length).trim();
    if (key) {
      entries[key] = value;
    }
  }
  return entries;
}

function parsePositiveInteger(input: string | undefined): number | null {
  if (!input || !/^\d+$/u.test(input.trim())) {
    return null;
  }
  const parsed = Number.parseInt(input.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function execCommand(command: string, args: string[], timeout = 15_000): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });
  const stderr =
    (result.stderr ?? "").trim() ||
    (result.error instanceof Error ? result.error.message : String(result.error ?? "")).trim();
  return {
    code: typeof result.status === "number" ? result.status : 1,
    stdout: (result.stdout ?? "").trim(),
    stderr,
  };
}

async function pathExists(targetPath: string | null): Promise<boolean> {
  if (!targetPath) {
    return false;
  }
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveGatewayProgramArguments(port: number): string[] {
  return [process.execPath, resolvePackagePath("dist", "cli.js"), "gateway", "run", "--port", String(port)];
}

function resolvePlatformDefaults(): GatewayPlatformDefaults {
  if (process.platform === "darwin") {
    return {
      serviceManager: "launchd",
      installKind: "launch-agent",
      serviceLabel: resolveLaunchAgentLabel(),
      serviceConfigPath: resolveLaunchAgentPlistPath(),
      taskScriptPath: null,
      startupEntryPath: null,
    };
  }
  if (process.platform === "linux") {
    return {
      serviceManager: "systemd",
      installKind: "systemd-user",
      serviceLabel: resolveSystemdUnitName(),
      serviceConfigPath: resolveSystemdUnitPath(),
      taskScriptPath: null,
      startupEntryPath: null,
    };
  }
  if (process.platform === "win32") {
    const taskName = resolveTaskName();
    return {
      serviceManager: "schtasks",
      installKind: "scheduled-task",
      serviceLabel: taskName,
      serviceConfigPath: resolveTaskScriptPath(),
      taskScriptPath: resolveTaskScriptPath(),
      startupEntryPath: resolveStartupEntryPath(taskName),
    };
  }
  return {
    serviceManager: null,
    installKind: null,
    serviceLabel: null,
    serviceConfigPath: null,
    taskScriptPath: null,
    startupEntryPath: null,
  };
}

function resolveInstallKindForPlatform(): GatewayInstallKind {
  if (process.platform === "darwin") {
    return "launch-agent";
  }
  if (process.platform === "linux") {
    return "systemd-user";
  }
  return "scheduled-task";
}

function buildGatewayMetadata(params: {
  port: number;
  workingDirectory: string;
  installKind: GatewayInstallKind;
}): GatewayServiceMetadata {
  const defaults = resolvePlatformDefaults();
  let serviceManager = defaults.serviceManager;
  let serviceConfigPath = defaults.serviceConfigPath;
  if (params.installKind === "startup-entry") {
    serviceManager = "startup";
    serviceConfigPath = defaults.startupEntryPath;
  }

  if (!defaults.serviceLabel || !serviceManager) {
    throw new Error(`Gateway service install not supported on ${process.platform}.`);
  }

  return {
    version: 2,
    platform: process.platform,
    installKind: params.installKind,
    serviceManager,
    port: params.port,
    serviceLabel: defaults.serviceLabel,
    serviceConfigPath,
    taskScriptPath: defaults.taskScriptPath,
    startupEntryPath: defaults.startupEntryPath,
    stdoutLogPath: resolveGatewayLogPath("out"),
    stderrLogPath: resolveGatewayLogPath("err"),
    workingDirectory: params.workingDirectory,
    programArguments: resolveGatewayProgramArguments(params.port),
    installedAt: new Date().toISOString(),
  };
}

async function readGatewayMetadata(): Promise<GatewayServiceMetadata | null> {
  try {
    const raw = await readFile(resolveGatewayMetadataPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<GatewayServiceMetadata>;
    if (
      parsed.version === 2 &&
      typeof parsed.platform === "string" &&
      typeof parsed.installKind === "string" &&
      typeof parsed.serviceManager === "string" &&
      typeof parsed.port === "number" &&
      typeof parsed.serviceLabel === "string" &&
      typeof parsed.stdoutLogPath === "string" &&
      typeof parsed.stderrLogPath === "string" &&
      typeof parsed.workingDirectory === "string" &&
      Array.isArray(parsed.programArguments) &&
      typeof parsed.installedAt === "string"
    ) {
      return {
        version: 2,
        platform: parsed.platform,
        installKind: parsed.installKind as GatewayInstallKind,
        serviceManager: parsed.serviceManager as GatewayServiceManager,
        port: parsed.port,
        serviceLabel: parsed.serviceLabel,
        serviceConfigPath:
          typeof parsed.serviceConfigPath === "string" || parsed.serviceConfigPath === null
            ? parsed.serviceConfigPath
            : null,
        taskScriptPath:
          typeof parsed.taskScriptPath === "string" || parsed.taskScriptPath === null
            ? parsed.taskScriptPath
            : null,
        startupEntryPath:
          typeof parsed.startupEntryPath === "string" || parsed.startupEntryPath === null
            ? parsed.startupEntryPath
            : null,
        stdoutLogPath: parsed.stdoutLogPath,
        stderrLogPath: parsed.stderrLogPath,
        workingDirectory: parsed.workingDirectory,
        programArguments: parsed.programArguments.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        ),
        installedAt: parsed.installedAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function writeGatewayMetadata(metadata: GatewayServiceMetadata): Promise<void> {
  await mkdir(resolveGatewayDaemonDir(), { recursive: true });
  await writeFile(resolveGatewayMetadataPath(), JSON.stringify(metadata, null, 2), "utf8");
}

async function removeGatewayMetadata(): Promise<void> {
  await rm(resolveGatewayMetadataPath(), { force: true });
}

function execSchtasks(args: string[]): CommandResult {
  return execCommand("schtasks", args, SCHTASKS_TIMEOUT_MS);
}

function execLaunchctl(args: string[]): CommandResult {
  return execCommand("launchctl", args, 15_000);
}

function execSystemctl(args: string[]): CommandResult {
  return execCommand("systemctl", args, 15_000);
}

function quoteCmdScriptArg(value: string): string {
  if (!/[ \t"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteSchtasksArg(value: string): string {
  if (!/[ \t"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function renderCmdProgramCommandLine(programArguments: string[]): string {
  const [program, ...args] = programArguments;
  if (!program) {
    throw new Error("Gateway program arguments are empty.");
  }
  const rendered = [program, ...args].map((value) => quoteCmdScriptArg(String(value))).join(" ");
  return /\.cmd$/iu.test(program) ? `call ${rendered}` : rendered;
}

function buildTaskScript(metadata: GatewayServiceMetadata): string {
  const lines = [
    "@echo off",
    `cd /d ${quoteCmdScriptArg(metadata.workingDirectory)}`,
    `${renderCmdProgramCommandLine(metadata.programArguments)} 1>> ${quoteCmdScriptArg(metadata.stdoutLogPath)} 2>> ${quoteCmdScriptArg(metadata.stderrLogPath)}`,
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function buildStartupLauncherScript(metadata: GatewayServiceMetadata): string {
  const lines = [
    "@echo off",
    `cd /d ${quoteCmdScriptArg(metadata.workingDirectory)}`,
    `start "" /min cmd.exe /d /c ${quoteCmdScriptArg(renderCmdProgramCommandLine(metadata.programArguments))}`,
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildLaunchAgentPlist(metadata: GatewayServiceMetadata): string {
  const programArguments = metadata.programArguments
    .map((value) => `    <string>${xmlEscape(value)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(metadata.serviceLabel)}</string>
  <key>ProgramArguments</key>
  <array>
${programArguments}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(metadata.workingDirectory)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(metadata.stdoutLogPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(metadata.stderrLogPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
</dict>
</plist>
`;
}

function quoteSystemdExecArg(value: string): string {
  if (!/[ \t"'\\]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function buildSystemdUnit(metadata: GatewayServiceMetadata): string {
  const execStart = metadata.programArguments.map((value) => quoteSystemdExecArg(value)).join(" ");
  return `[Unit]
Description=ReAgent Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${metadata.workingDirectory}
ExecStart=${execStart}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=append:${metadata.stdoutLogPath}
StandardError=append:${metadata.stderrLogPath}

[Install]
WantedBy=default.target
`;
}

function resolveLaunchctlDomain(): string {
  if (typeof process.getuid === "function") {
    return `gui/${process.getuid()}`;
  }
  return "gui/501";
}

function resolveLaunchctlTarget(label: string): string {
  return `${resolveLaunchctlDomain()}/${label}`;
}

function readLaunchdAvailability(): GatewayAvailability {
  if (process.platform !== "darwin") {
    return {
      serviceSupported: ["darwin", "linux", "win32"].includes(process.platform),
      serviceAvailable: false,
      detail: null,
    };
  }
  const result = execLaunchctl(["print", resolveLaunchctlDomain()]);
  if (result.code === 0) {
    return {
      serviceSupported: true,
      serviceAvailable: true,
      detail: null,
    };
  }
  return {
    serviceSupported: true,
    serviceAvailable: false,
    detail: result.stderr || result.stdout || "launchctl GUI session is unavailable.",
  };
}

function parseLaunchdPrint(output: string): LaunchdServiceInfo {
  const entries = parseKeyValueOutput(output, "=");
  return {
    state: entries.state ?? null,
    pid: parsePositiveInteger(entries.pid),
    lastExitStatus: entries["last exit code"] ?? entries["last exit status"] ?? null,
  };
}

function readLaunchdServiceState(label: string): LaunchdServiceInfo | null {
  const result = execLaunchctl(["print", resolveLaunchctlTarget(label)]);
  if (result.code !== 0) {
    return null;
  }
  return parseLaunchdPrint(result.stdout);
}

function readSystemdAvailability(): GatewayAvailability {
  if (process.platform !== "linux") {
    return {
      serviceSupported: ["darwin", "linux", "win32"].includes(process.platform),
      serviceAvailable: false,
      detail: null,
    };
  }
  const result = execSystemctl(["--user", "show-environment"]);
  if (result.code === 0) {
    return {
      serviceSupported: true,
      serviceAvailable: true,
      detail: null,
    };
  }
  return {
    serviceSupported: true,
    serviceAvailable: false,
    detail: result.stderr || result.stdout || "systemd user services are unavailable in this session.",
  };
}

function parseSystemdShow(output: string): SystemdServiceInfo {
  const entries = parseKeyValueOutput(output, "=");
  return {
    loadState: entries.loadstate ?? null,
    unitFileState: entries.unitfilestate ?? null,
    activeState: entries.activestate ?? null,
    subState: entries.substate ?? null,
    mainPid: parsePositiveInteger(entries.mainpid),
    execMainStatus: entries.execmainstatus ?? null,
  };
}

function readSystemdServiceState(unitName: string): SystemdServiceInfo | null {
  const result = execSystemctl([
    "--user",
    "show",
    `${unitName}.service`,
    "--property",
    "LoadState,UnitFileState,ActiveState,SubState,MainPID,ExecMainStatus",
  ]);
  if (result.code !== 0) {
    return null;
  }
  return parseSystemdShow(result.stdout);
}

function isSystemdLoaded(info: SystemdServiceInfo | null): boolean {
  if (!info) {
    return false;
  }
  const unitFileState = info.unitFileState?.toLowerCase() ?? "";
  const activeState = info.activeState?.toLowerCase() ?? "";
  return (
    ["enabled", "enabled-runtime", "linked", "linked-runtime", "static"].includes(unitFileState) ||
    activeState === "active" ||
    activeState === "activating"
  );
}

function isScheduledTaskRegistered(taskName?: string): boolean {
  const result = execSchtasks(["/Query", "/TN", taskName ?? resolveTaskName()]);
  return result.code === 0;
}

async function isStartupEntryInstalled(taskName?: string): Promise<boolean> {
  return await pathExists(resolveStartupEntryPath(taskName ?? resolveTaskName()));
}

function queryScheduledTask(taskName: string): WindowsTaskInfo {
  const result = execSchtasks(["/Query", "/TN", taskName, "/V", "/FO", "LIST"]);
  if (result.code !== 0) {
    return {
      entries: {},
      runtimePid: null,
    };
  }
  const entries = parseKeyValueOutput(result.stdout);
  return {
    entries,
    runtimePid: parsePositiveInteger(entries["process id"] ?? entries.pid),
  };
}

function launchGatewayProgram(metadata: GatewayServiceMetadata): void {
  const child = spawn("cmd.exe", ["/d", "/s", "/c", renderCmdProgramCommandLine(metadata.programArguments)], {
    cwd: metadata.workingDirectory,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function readProcessCommandLine(pid: number): string | null {
  if (process.platform === "win32") {
    const script = `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine)`;
    const result = execCommand("powershell.exe", ["-NoProfile", "-Command", script], 10_000);
    return result.code === 0 && result.stdout ? result.stdout : null;
  }
  const result = execCommand("ps", ["-p", String(pid), "-o", "command="], 10_000);
  return result.code === 0 && result.stdout ? result.stdout.split(/\r?\n/u)[0]?.trim() ?? null : null;
}

function looksLikeManagedGatewayProcess(commandLine: string | null): boolean {
  if (!commandLine) {
    return false;
  }
  const normalized = commandLine.toLowerCase();
  return (
    normalized.includes("reagent") &&
    (normalized.includes("gateway run") || normalized.includes("dist\\cli.js") || normalized.includes("dist/cli.js"))
  );
}

function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    execCommand("taskkill", ["/F", "/T", "/PID", String(pid)], 10_000);
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // ignore
  }
}

function resolveWindowsPortListenerPid(port: number): number | null {
  const result = execCommand("netstat", ["-ano", "-p", "tcp"], 10_000);
  if (result.code !== 0) {
    return null;
  }
  for (const rawLine of result.stdout.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line.startsWith("TCP")) {
      continue;
    }
    const columns = line.split(/\s+/u);
    const localAddress = columns[1] ?? "";
    const state = columns[3] ?? "";
    const pidRaw = columns[4] ?? "";
    if (state.toUpperCase() !== "LISTENING") {
      continue;
    }
    const portMatch = localAddress.match(/:(\d+)$/u);
    if (!portMatch || Number.parseInt(portMatch[1] ?? "", 10) !== port) {
      continue;
    }
    return parsePositiveInteger(pidRaw);
  }
  return null;
}

function resolvePosixPortListenerPid(port: number): number | null {
  const result = execCommand("lsof", ["-nP", "-iTCP:" + String(port), "-sTCP:LISTEN", "-t"], 10_000);
  if (result.code !== 0 || !result.stdout) {
    return null;
  }
  return parsePositiveInteger(result.stdout.split(/\r?\n/u)[0]);
}

function resolvePortListenerPid(port: number): number | null {
  return process.platform === "win32" ? resolveWindowsPortListenerPid(port) : resolvePosixPortListenerPid(port);
}

async function stopManagedGatewayPort(port: number): Promise<number | null> {
  const pid = resolvePortListenerPid(port);
  if (!pid) {
    return null;
  }
  if (!looksLikeManagedGatewayProcess(readProcessCommandLine(pid))) {
    return null;
  }
  killProcessTree(pid);
  return pid;
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function probeGateway(port: number): Promise<GatewayProbeStatus> {
  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await fetchJson(`${baseUrl}/health`);
  if (!health) {
    return {
      reachable: false,
      health: null,
      runtimeMeta: null,
    };
  }
  return {
    reachable: true,
    health,
    runtimeMeta: await fetchJson(`${baseUrl}/api/runtime/meta`),
  };
}

async function waitForGatewayHealth(port: number, timeoutMs = GATEWAY_HEALTH_TIMEOUT_MS): Promise<GatewayProbeStatus> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await probeGateway(port);
    if (probe.reachable) {
      return probe;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return await probeGateway(port);
}

function buildCommands(port: number): Pick<
  GatewayStatusSnapshot,
  | "installCommand"
  | "startCommand"
  | "restartCommand"
  | "statusCommand"
  | "deepStatusCommand"
  | "stopCommand"
  | "uninstallCommand"
  | "logsCommand"
  | "doctorCommand"
  | "deepDoctorCommand"
> {
  return {
    installCommand: `reagent service install --port ${port}`,
    startCommand: "reagent service start",
    restartCommand: "reagent service restart",
    statusCommand: "reagent service status",
    deepStatusCommand: "reagent service status --deep",
    stopCommand: "reagent service stop",
    uninstallCommand: "reagent service uninstall",
    logsCommand: "reagent service logs",
    doctorCommand: "reagent runtime doctor",
    deepDoctorCommand: "reagent runtime doctor --deep",
  };
}

async function readGatewayExtraInstallations(metadata: GatewayServiceMetadata | null, deep: boolean): Promise<GatewayExtraInstallation[]> {
  if (!deep) {
    return [];
  }

  const results: GatewayExtraInstallation[] = [];
  const currentConfigPath = metadata?.serviceConfigPath ? path.resolve(metadata.serviceConfigPath) : null;
  const currentLabel = metadata?.serviceLabel ?? resolvePlatformDefaults().serviceLabel;

  if (process.platform === "darwin") {
    const dirs = [path.join(os.homedir(), "Library", "LaunchAgents"), "/Library/LaunchAgents"];
    for (const [index, dir] of dirs.entries()) {
      let entries: string[] = [];
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.endsWith(".plist")) {
          continue;
        }
        const filePath = path.join(dir, entry);
        if (currentConfigPath && path.resolve(filePath) === currentConfigPath) {
          continue;
        }
        let contents = "";
        try {
          contents = await readFile(filePath, "utf8");
        } catch {
          continue;
        }
        const lower = contents.toLowerCase();
        if (!lower.includes("reagent") || !lower.includes("gateway")) {
          continue;
        }
        const labelMatch = contents.match(/<key>Label<\/key>\s*<string>([\s\S]*?)<\/string>/iu);
        const label = labelMatch?.[1]?.trim() || entry.slice(0, -".plist".length);
        if (currentLabel && label === currentLabel) {
          continue;
        }
        results.push({
          platform: "darwin",
          manager: "launchd",
          label,
          scope: index === 0 ? "user" : "system",
          path: filePath,
          detail: `plist: ${filePath}`,
        });
      }
    }
    return results;
  }

  if (process.platform === "linux") {
    const dirs = [
      { dir: path.join(os.homedir(), ".config", "systemd", "user"), scope: "user" as const },
      { dir: "/etc/systemd/system", scope: "system" as const },
      { dir: "/usr/lib/systemd/system", scope: "system" as const },
      { dir: "/lib/systemd/system", scope: "system" as const },
    ];
    for (const item of dirs) {
      let entries: string[] = [];
      try {
        entries = await readdir(item.dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.endsWith(".service")) {
          continue;
        }
        const filePath = path.join(item.dir, entry);
        if (currentConfigPath && path.resolve(filePath) === currentConfigPath) {
          continue;
        }
        let contents = "";
        try {
          contents = await readFile(filePath, "utf8");
        } catch {
          continue;
        }
        const lower = contents.toLowerCase();
        if (!lower.includes("reagent") || !lower.includes("gateway")) {
          continue;
        }
        const unitName = entry.slice(0, -".service".length);
        if (currentLabel && unitName === currentLabel) {
          continue;
        }
        results.push({
          platform: "linux",
          manager: "systemd",
          label: unitName,
          scope: item.scope,
          path: filePath,
          detail: `unit: ${filePath}`,
        });
      }
    }
    return results;
  }

  if (process.platform === "win32") {
    const query = execSchtasks(["/Query", "/FO", "LIST", "/V"]);
    if (query.code === 0) {
      const blocks = query.stdout.split(/\r?\n\r?\n/u);
      for (const block of blocks) {
        const entries = parseKeyValueOutput(block);
        const taskName = entries.taskname?.replace(/^\\/u, "").trim();
        const taskToRun = entries["task to run"] ?? "";
        if (!taskName || (currentLabel && taskName === currentLabel)) {
          continue;
        }
        const haystack = `${taskName} ${taskToRun}`.toLowerCase();
        if (!haystack.includes("reagent") || !haystack.includes("gateway")) {
          continue;
        }
        results.push({
          platform: "win32",
          manager: "schtasks",
          label: taskName,
          scope: "system",
          path: null,
          detail: `schtasks: ${taskName}`,
        });
      }
    }

    const startupDir = path.dirname(resolveStartupEntryPath(resolveTaskName()));
    let entries: string[] = [];
    try {
      entries = await readdir(startupDir);
    } catch {
      return results;
    }
    const currentStartupPath = metadata?.startupEntryPath ? path.resolve(metadata.startupEntryPath) : null;
    for (const entry of entries) {
      if (!/\.(cmd|bat|ps1)$/iu.test(entry)) {
        continue;
      }
      const filePath = path.join(startupDir, entry);
      if (currentStartupPath && path.resolve(filePath) === currentStartupPath) {
        continue;
      }
      let contents = "";
      try {
        contents = await readFile(filePath, "utf8");
      } catch {
        continue;
      }
      const lower = `${entry} ${contents}`.toLowerCase();
      if (!lower.includes("reagent") || !lower.includes("gateway")) {
        continue;
      }
      results.push({
        platform: "win32",
        manager: "startup",
        label: entry,
        scope: "user",
        path: filePath,
        detail: `startup: ${filePath}`,
      });
    }
  }

  return results;
}

function buildDiagnosis(snapshot: GatewayStatusSnapshot): {
  issues: string[];
  hints: string[];
} {
  const issues: string[] = [];
  const hints: string[] = [];

  if (snapshot.platform !== "win32" && snapshot.serviceSupported && !snapshot.serviceAvailable && snapshot.availabilityDetail) {
    issues.push(snapshot.availabilityDetail);
  }
  if (snapshot.installed && snapshot.loaded && !snapshot.healthReachable) {
    issues.push("The gateway supervisor is installed, but the HTTP health probe is not responding.");
  }
  if (snapshot.listenerPid && snapshot.serviceRuntimePid && snapshot.listenerPid !== snapshot.serviceRuntimePid) {
    issues.push(
      `Port ${snapshot.port} is owned by PID ${snapshot.listenerPid}, but the supervisor reports PID ${snapshot.serviceRuntimePid}.`,
    );
  }
  if (snapshot.extraInstallations.length > 0) {
    issues.push(`Found ${snapshot.extraInstallations.length} additional gateway service definition(s) on this host.`);
  }

  if (snapshot.healthReachable && !snapshot.installed) {
    hints.push(`The gateway is running in the foreground. Install the supervisor with "${snapshot.installCommand}" for always-on mode.`);
  }
  if (snapshot.installed && !snapshot.loaded) {
    hints.push(`The service definition exists but is not currently loaded. Start it with "${snapshot.startCommand}".`);
  }
  if (snapshot.platform === "linux" && snapshot.installed) {
    hints.push("Linux installs use systemd user services. If the gateway must survive logout, enable lingering for this user.");
  }
  if (snapshot.extraInstallations.length > 0) {
    hints.push(`Run "${snapshot.deepStatusCommand}" to inspect duplicate gateway installs before enabling another supervisor.`);
  }
  if (snapshot.healthReachable && snapshot.runtimeWorkspaceDir && snapshot.workingDirectory) {
    const expectedWorkspace = path.resolve(snapshot.workingDirectory);
    const actualWorkspace = path.resolve(snapshot.runtimeWorkspaceDir);
    if (!actualWorkspace.startsWith(expectedWorkspace)) {
      hints.push("The running workspace differs from the supervisor working directory. Confirm the intended install root before restarting.");
    }
  }

  return { issues, hints };
}

async function buildGatewayStatusBase(
  portHint?: number | string,
  options: Pick<GatewayStatusOptions, "deep"> = {},
): Promise<Omit<
  GatewayStatusSnapshot,
  | "healthReachable"
  | "healthStatus"
  | "runtimeWorkspaceDir"
  | "runtimeAgent"
  | "runtimeLlmProvider"
  | "runtimeWechatProvider"
  | "runtimeOpenClawCli"
  | "listenerPid"
  | "issues"
  | "hints"
>> {
  const metadata = await readGatewayMetadata();
  const defaults = resolvePlatformDefaults();
  const port = metadata?.port ?? normalizePort(portHint);
  const taskName = metadata?.serviceLabel ?? defaults.serviceLabel ?? resolveTaskName();
  const startupEntryInstalled = process.platform === "win32" ? await isStartupEntryInstalled(taskName) : false;
  const scheduledTaskRegistered = process.platform === "win32" ? isScheduledTaskRegistered(taskName) : false;

  let availability: GatewayAvailability = {
    serviceSupported: ["darwin", "linux", "win32"].includes(process.platform),
    serviceAvailable: ["darwin", "linux", "win32"].includes(process.platform),
    detail: null,
  };
  let loaded = false;
  let loadedText: string | null = null;
  let serviceState: string | null = null;
  let taskState: string | null = null;
  let lastRunTime: string | null = null;
  let lastRunResult: string | null = null;
  let serviceRuntimePid: number | null = null;

  if (process.platform === "darwin") {
    availability = readLaunchdAvailability();
    const info = taskName ? readLaunchdServiceState(taskName) : null;
    loaded = info !== null;
    loadedText = loaded ? "loaded" : "not loaded";
    serviceState = info?.state ?? null;
    taskState = info?.state ?? null;
    lastRunResult = info?.lastExitStatus ?? null;
    serviceRuntimePid = info?.pid ?? null;
  } else if (process.platform === "linux") {
    availability = readSystemdAvailability();
    const info = taskName ? readSystemdServiceState(taskName) : null;
    loaded = isSystemdLoaded(info);
    loadedText = loaded ? "enabled" : "disabled";
    serviceState = info?.activeState && info?.subState ? `${info.activeState}/${info.subState}` : info?.activeState ?? null;
    taskState = serviceState;
    lastRunResult = info?.execMainStatus ?? null;
    serviceRuntimePid = info?.mainPid ?? null;
  } else if (process.platform === "win32") {
    const info = queryScheduledTask(taskName);
    loaded = scheduledTaskRegistered || startupEntryInstalled;
    loadedText = scheduledTaskRegistered ? "registered" : startupEntryInstalled ? "startup entry" : "missing";
    serviceState = info.entries.status ?? (startupEntryInstalled ? "Ready" : null);
    taskState = info.entries.status ?? null;
    lastRunTime = info.entries["last run time"] ?? null;
    lastRunResult = info.entries["last run result"] ?? info.entries["last result"] ?? null;
    serviceRuntimePid = info.runtimePid;
  }

  const commands = buildCommands(port);
  const extraInstallations = await readGatewayExtraInstallations(metadata, Boolean(options.deep));

  return {
    platform: process.platform,
    serviceManager: metadata?.serviceManager ?? defaults.serviceManager,
    serviceSupported: availability.serviceSupported,
    serviceAvailable: availability.serviceAvailable,
    availabilityDetail: availability.detail,
    taskName,
    serviceLabel: metadata?.serviceLabel ?? defaults.serviceLabel,
    serviceConfigPath: metadata?.serviceConfigPath ?? defaults.serviceConfigPath,
    installed:
      Boolean(metadata) ||
      (process.platform === "darwin" && (await pathExists(resolveLaunchAgentPlistPath()))) ||
      (process.platform === "linux" && (await pathExists(resolveSystemdUnitPath()))) ||
      scheduledTaskRegistered ||
      startupEntryInstalled,
    installKind:
      metadata?.installKind ??
      (scheduledTaskRegistered ? "scheduled-task" : startupEntryInstalled ? "startup-entry" : defaults.installKind),
    scheduledTaskRegistered,
    startupEntryInstalled,
    loaded,
    loadedText,
    port,
    workingDirectory: metadata?.workingDirectory ?? null,
    taskScriptPath: metadata?.taskScriptPath ?? defaults.taskScriptPath,
    startupEntryPath: metadata?.startupEntryPath ?? defaults.startupEntryPath,
    stdoutLogPath: metadata?.stdoutLogPath ?? resolveGatewayLogPath("out"),
    stderrLogPath: metadata?.stderrLogPath ?? resolveGatewayLogPath("err"),
    healthUrl: `http://127.0.0.1:${port}/health`,
    serviceState,
    taskState,
    lastRunTime,
    lastRunResult,
    serviceRuntimePid,
    extraInstallations,
    ...commands,
  };
}

export async function getGatewayServiceStatus(
  portHint?: number | string,
  options: GatewayStatusOptions = {},
): Promise<GatewayStatusSnapshot> {
  const base = await buildGatewayStatusBase(portHint, options);
  let healthReachable = options.runtimeOverride?.healthReachable ?? false;
  let healthStatus = options.runtimeOverride?.healthStatus ?? null;
  let runtimeWorkspaceDir = options.runtimeOverride?.runtimeWorkspaceDir ?? null;
  let runtimeAgent = options.runtimeOverride?.runtimeAgent ?? null;
  let runtimeLlmProvider = options.runtimeOverride?.runtimeLlmProvider ?? null;
  let runtimeWechatProvider = options.runtimeOverride?.runtimeWechatProvider ?? null;
  let runtimeOpenClawCli = options.runtimeOverride?.runtimeOpenClawCli ?? null;
  let listenerPid = options.runtimeOverride?.listenerPid ?? resolvePortListenerPid(base.port);

  if (options.probe !== false) {
    const probe = await probeGateway(base.port);
    const runtimeMeta = probe.runtimeMeta;
    const runtimeOpenClaw =
      runtimeMeta?.openclaw && typeof runtimeMeta.openclaw === "object"
        ? (runtimeMeta.openclaw as { cliPath?: unknown }).cliPath
        : null;
    healthReachable = probe.reachable;
    healthStatus = typeof probe.health?.status === "string" ? probe.health.status : null;
    runtimeWorkspaceDir = typeof runtimeMeta?.workspaceDir === "string" ? runtimeMeta.workspaceDir : null;
    runtimeAgent = typeof runtimeMeta?.agent === "string" ? runtimeMeta.agent : null;
    runtimeLlmProvider = typeof runtimeMeta?.llmProvider === "string" ? runtimeMeta.llmProvider : null;
    runtimeWechatProvider = typeof runtimeMeta?.wechatProvider === "string" ? runtimeMeta.wechatProvider : null;
    runtimeOpenClawCli = typeof runtimeOpenClaw === "string" ? runtimeOpenClaw : null;
    listenerPid = resolvePortListenerPid(base.port);
  }

  const snapshot: GatewayStatusSnapshot = {
    ...base,
    healthReachable,
    healthStatus,
    runtimeWorkspaceDir,
    runtimeAgent,
    runtimeLlmProvider,
    runtimeWechatProvider,
    runtimeOpenClawCli,
    listenerPid,
    issues: [],
    hints: [],
  };
  const diagnosis = buildDiagnosis(snapshot);
  snapshot.issues = diagnosis.issues;
  snapshot.hints = diagnosis.hints;
  return snapshot;
}

function ensureGatewayPlatformSupported(action: string): void {
  if (!["darwin", "linux", "win32"].includes(process.platform)) {
    throw new Error(`${action} is not supported on ${process.platform}.`);
  }
}

function ensureLaunchdSupported(action: string): void {
  if (process.platform !== "darwin") {
    throw new Error(`${action} is currently supported only on macOS for launchd installs.`);
  }
}

function ensureSystemdSupported(action: string): void {
  if (process.platform !== "linux") {
    throw new Error(`${action} is currently supported only on Linux for systemd installs.`);
  }
}

function bootoutLaunchAgent(label: string): void {
  execLaunchctl(["bootout", resolveLaunchctlTarget(label)]);
}

function bootstrapLaunchAgent(plistPath: string): void {
  const result = execLaunchctl(["bootstrap", resolveLaunchctlDomain(), plistPath]);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "launchctl bootstrap failed.");
  }
}

function kickstartLaunchAgent(label: string): void {
  const result = execLaunchctl(["kickstart", "-k", resolveLaunchctlTarget(label)]);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "launchctl kickstart failed.");
  }
}

function systemctlMustSucceed(args: string[], failureMessage: string): void {
  const result = execSystemctl(args);
  if (result.code !== 0) {
    throw new Error(`${failureMessage}: ${result.stderr || result.stdout || "unknown error"}`);
  }
}

async function installDarwinService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureLaunchdSupported("Gateway install");
  await mkdir(resolveGatewayDaemonDir(), { recursive: true });
  await mkdir(path.dirname(resolveLaunchAgentPlistPath(metadata.serviceLabel)), { recursive: true });
  await writeFile(resolveLaunchAgentPlistPath(metadata.serviceLabel), buildLaunchAgentPlist(metadata), "utf8");
  bootoutLaunchAgent(metadata.serviceLabel);
  bootstrapLaunchAgent(resolveLaunchAgentPlistPath(metadata.serviceLabel));
  kickstartLaunchAgent(metadata.serviceLabel);
}

async function uninstallDarwinService(metadata: GatewayServiceMetadata | null): Promise<void> {
  ensureLaunchdSupported("Gateway uninstall");
  const label = metadata?.serviceLabel ?? resolveLaunchAgentLabel();
  bootoutLaunchAgent(label);
  await rm(resolveLaunchAgentPlistPath(label), { force: true });
}

async function startDarwinService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureLaunchdSupported("Gateway start");
  if (!(await pathExists(resolveLaunchAgentPlistPath(metadata.serviceLabel)))) {
    throw new Error('Gateway service is not installed. Run "reagent service install" first.');
  }
  const info = readLaunchdServiceState(metadata.serviceLabel);
  if (!info) {
    bootstrapLaunchAgent(resolveLaunchAgentPlistPath(metadata.serviceLabel));
    return;
  }
  kickstartLaunchAgent(metadata.serviceLabel);
}

async function stopDarwinService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureLaunchdSupported("Gateway stop");
  bootoutLaunchAgent(metadata.serviceLabel);
}

async function restartDarwinService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureLaunchdSupported("Gateway restart");
  const info = readLaunchdServiceState(metadata.serviceLabel);
  if (!info) {
    bootstrapLaunchAgent(resolveLaunchAgentPlistPath(metadata.serviceLabel));
    return;
  }
  kickstartLaunchAgent(metadata.serviceLabel);
}

async function installLinuxService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureSystemdSupported("Gateway install");
  const availability = readSystemdAvailability();
  if (!availability.serviceAvailable) {
    throw new Error(availability.detail ?? "systemd user services are unavailable in this session.");
  }
  await mkdir(resolveGatewayDaemonDir(), { recursive: true });
  await mkdir(path.dirname(resolveSystemdUnitPath(metadata.serviceLabel)), { recursive: true });
  await writeFile(resolveSystemdUnitPath(metadata.serviceLabel), buildSystemdUnit(metadata), "utf8");
  systemctlMustSucceed(["--user", "daemon-reload"], "Failed to reload systemd user daemon");
  systemctlMustSucceed(
    ["--user", "enable", "--now", `${metadata.serviceLabel}.service`],
    "Failed to enable/start ReAgent systemd unit",
  );
}

async function uninstallLinuxService(metadata: GatewayServiceMetadata | null): Promise<void> {
  ensureSystemdSupported("Gateway uninstall");
  const unitName = metadata?.serviceLabel ?? resolveSystemdUnitName();
  const availability = readSystemdAvailability();
  if (availability.serviceAvailable) {
    execSystemctl(["--user", "disable", "--now", `${unitName}.service`]);
    execSystemctl(["--user", "daemon-reload"]);
  }
  await rm(resolveSystemdUnitPath(unitName), { force: true });
}

async function startLinuxService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureSystemdSupported("Gateway start");
  const availability = readSystemdAvailability();
  if (!availability.serviceAvailable) {
    throw new Error(availability.detail ?? "systemd user services are unavailable in this session.");
  }
  systemctlMustSucceed(["--user", "start", `${metadata.serviceLabel}.service`], "Failed to start ReAgent systemd unit");
}

async function stopLinuxService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureSystemdSupported("Gateway stop");
  const availability = readSystemdAvailability();
  if (!availability.serviceAvailable) {
    throw new Error(availability.detail ?? "systemd user services are unavailable in this session.");
  }
  systemctlMustSucceed(["--user", "stop", `${metadata.serviceLabel}.service`], "Failed to stop ReAgent systemd unit");
}

async function restartLinuxService(metadata: GatewayServiceMetadata): Promise<void> {
  ensureSystemdSupported("Gateway restart");
  const availability = readSystemdAvailability();
  if (!availability.serviceAvailable) {
    throw new Error(availability.detail ?? "systemd user services are unavailable in this session.");
  }
  systemctlMustSucceed(
    ["--user", "restart", `${metadata.serviceLabel}.service`],
    "Failed to restart ReAgent systemd unit",
  );
}

async function installWindowsService(
  metadata: GatewayServiceMetadata,
): Promise<{ installKind: GatewayInstallKind }> {
  await mkdir(resolveGatewayDaemonDir(), { recursive: true });
  if (metadata.taskScriptPath) {
    await writeFile(metadata.taskScriptPath, buildTaskScript(metadata), "utf8");
  }

  const create = execSchtasks([
    "/Create",
    "/F",
    "/SC",
    "ONLOGON",
    "/RL",
    "LIMITED",
    "/TN",
    metadata.serviceLabel,
    "/TR",
    quoteSchtasksArg(metadata.taskScriptPath ?? resolveTaskScriptPath()),
  ]);

  if (create.code === 0) {
    execSchtasks(["/Run", "/TN", metadata.serviceLabel]);
    return { installKind: "scheduled-task" };
  }

  if (!metadata.startupEntryPath || !metadata.taskScriptPath) {
    throw new Error(create.stderr || create.stdout || "Failed to create scheduled task.");
  }

  await mkdir(path.dirname(metadata.startupEntryPath), { recursive: true });
  await writeFile(metadata.startupEntryPath, buildStartupLauncherScript(metadata), "utf8");
  launchGatewayProgram(metadata);
  return { installKind: "startup-entry" };
}

async function uninstallWindowsService(metadata: GatewayServiceMetadata | null): Promise<void> {
  const taskName = metadata?.serviceLabel ?? resolveTaskName();
  if (isScheduledTaskRegistered(taskName)) {
    execSchtasks(["/Delete", "/F", "/TN", taskName]);
  }
  const startupEntryPath = metadata?.startupEntryPath ?? resolveStartupEntryPath(taskName);
  await rm(startupEntryPath, { force: true });
  await rm(metadata?.taskScriptPath ?? resolveTaskScriptPath(), { force: true });
}

async function startWindowsService(metadata: GatewayServiceMetadata): Promise<void> {
  if (isScheduledTaskRegistered(metadata.serviceLabel)) {
    const result = execSchtasks(["/Run", "/TN", metadata.serviceLabel]);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "Failed to start ReAgent scheduled task.");
    }
    return;
  }

  if (metadata.startupEntryPath && (await pathExists(metadata.startupEntryPath))) {
    launchGatewayProgram(metadata);
    return;
  }

  throw new Error('Gateway service is not installed. Run "reagent service install" first.');
}

async function stopWindowsService(metadata: GatewayServiceMetadata): Promise<void> {
  if (isScheduledTaskRegistered(metadata.serviceLabel)) {
    execSchtasks(["/End", "/TN", metadata.serviceLabel]);
  }
  await stopManagedGatewayPort(metadata.port);
}

async function restartWindowsService(metadata: GatewayServiceMetadata): Promise<void> {
  await stopWindowsService(metadata);
  await startWindowsService(metadata);
}

export async function installGatewayService(params: {
  force?: boolean;
  port?: number | string;
  workingDirectory?: string;
}): Promise<GatewayStatusSnapshot> {
  ensureGatewayPlatformSupported("Gateway install");
  const port = normalizePort(params.port);
  const workingDirectory = path.resolve(params.workingDirectory ?? process.cwd());
  const existing = await getGatewayServiceStatus(port);
  if (existing.installed && !params.force) {
    return existing;
  }

  if (params.force) {
    await uninstallGatewayService();
  }

  const installKind = resolveInstallKindForPlatform();
  let metadata = buildGatewayMetadata({
    port,
    workingDirectory,
    installKind,
  });

  if (process.platform === "darwin") {
    await installDarwinService(metadata);
  } else if (process.platform === "linux") {
    await installLinuxService(metadata);
  } else if (process.platform === "win32") {
    const installed = await installWindowsService(metadata);
    if (installed.installKind === "startup-entry") {
      metadata = {
        ...metadata,
        installKind: "startup-entry",
        serviceManager: "startup",
        serviceConfigPath: metadata.startupEntryPath,
      };
    }
  }

  await writeGatewayMetadata(metadata);
  await waitForGatewayHealth(port);
  return await getGatewayServiceStatus(port);
}

export async function uninstallGatewayService(): Promise<void> {
  ensureGatewayPlatformSupported("Gateway uninstall");
  const metadata = await readGatewayMetadata();
  if (process.platform === "darwin") {
    await uninstallDarwinService(metadata);
  } else if (process.platform === "linux") {
    await uninstallLinuxService(metadata);
  } else if (process.platform === "win32") {
    await uninstallWindowsService(metadata);
  }
  await removeGatewayMetadata();
}

export async function startGatewayService(): Promise<GatewayStatusSnapshot> {
  ensureGatewayPlatformSupported("Gateway start");
  const metadata = await readGatewayMetadata();
  if (!metadata) {
    throw new Error('Gateway service is not installed. Run "reagent service install" first.');
  }

  if (process.platform === "darwin") {
    await startDarwinService(metadata);
  } else if (process.platform === "linux") {
    await startLinuxService(metadata);
  } else if (process.platform === "win32") {
    await startWindowsService(metadata);
  }
  await waitForGatewayHealth(metadata.port);
  return await getGatewayServiceStatus(metadata.port);
}

export async function stopGatewayService(): Promise<GatewayStatusSnapshot> {
  ensureGatewayPlatformSupported("Gateway stop");
  const metadata = await readGatewayMetadata();
  if (!metadata) {
    throw new Error('Gateway service is not installed. Run "reagent service install" first.');
  }

  if (process.platform === "darwin") {
    await stopDarwinService(metadata);
  } else if (process.platform === "linux") {
    await stopLinuxService(metadata);
  } else if (process.platform === "win32") {
    await stopWindowsService(metadata);
  }
  return await getGatewayServiceStatus(metadata.port);
}

export async function restartGatewayService(): Promise<GatewayStatusSnapshot> {
  ensureGatewayPlatformSupported("Gateway restart");
  const metadata = await readGatewayMetadata();
  if (!metadata) {
    throw new Error('Gateway service is not installed. Run "reagent service install" first.');
  }

  if (process.platform === "darwin") {
    await restartDarwinService(metadata);
  } else if (process.platform === "linux") {
    await restartLinuxService(metadata);
  } else if (process.platform === "win32") {
    await restartWindowsService(metadata);
  }
  await waitForGatewayHealth(metadata.port);
  return await getGatewayServiceStatus(metadata.port);
}

export async function readGatewayLogTail(kind: "out" | "err", lines = 40): Promise<string> {
  const logPath = resolveGatewayLogPath(kind);
  try {
    const raw = await readFile(logPath, "utf8");
    return raw.split(/\r?\n/u).slice(-Math.max(1, lines)).join("\n").trim();
  } catch {
    return "";
  }
}

export async function readGatewayLogSnapshot(lines = 120): Promise<{
  source: "gateway-daemon" | "none";
  stdout: { path: string | null; content: string };
  stderr: { path: string | null; content: string };
}> {
  const stdoutPath = resolveGatewayLogPath("out");
  const stderrPath = resolveGatewayLogPath("err");
  const stdoutExists = await pathExists(stdoutPath);
  const stderrExists = await pathExists(stderrPath);
  if (!stdoutExists && !stderrExists) {
    return {
      source: "none",
      stdout: { path: null, content: "" },
      stderr: { path: null, content: "" },
    };
  }
  return {
    source: "gateway-daemon",
    stdout: {
      path: stdoutExists ? stdoutPath : null,
      content: stdoutExists ? await readGatewayLogTail("out", lines) : "",
    },
    stderr: {
      path: stderrExists ? stderrPath : null,
      content: stderrExists ? await readGatewayLogTail("err", lines) : "",
    },
  };
}
