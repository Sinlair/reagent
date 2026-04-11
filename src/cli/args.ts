import process from "node:process";

import type { ManagedConfigAlias } from "../services/workspaceConfigService.js";

export type ParsedOptions = {
  flags: Map<string, string | boolean>;
  positionals: string[];
};

export function parseOptions(args: string[]): ParsedOptions {
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

export function getStringFlag(options: ParsedOptions, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = options.flags.get(name);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

export function getBooleanFlag(options: ParsedOptions, ...names: string[]): boolean {
  return names.some((name) => options.flags.get(name) === true);
}

export function getIntegerFlag(options: ParsedOptions, ...names: string[]): number | undefined {
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

export function getOptionalBooleanFlag(options: ParsedOptions, ...names: string[]): boolean | undefined {
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

export function consumePositionals(options: ParsedOptions, count: number): ParsedOptions {
  return {
    flags: new Map(options.flags),
    positionals: options.positionals.slice(count),
  };
}

export function prependPositionals(options: ParsedOptions, prefix: string[]): ParsedOptions {
  return {
    flags: new Map(options.flags),
    positionals: [...prefix, ...options.positionals],
  };
}

export function prefixConfigPath(options: ParsedOptions, alias: ManagedConfigAlias): ParsedOptions {
  const [first = "", ...rest] = options.positionals;
  return {
    flags: new Map(options.flags),
    positionals: [`${alias}.${first}`, ...rest],
  };
}

export function serializeParsedOptions(options: ParsedOptions, excludeNames: string[] = []): string[] {
  const excluded = new Set(excludeNames);
  const args = [...options.positionals];
  for (const [name, value] of options.flags.entries()) {
    if (excluded.has(name)) {
      continue;
    }
    args.push(`--${name}`);
    if (typeof value === "string") {
      args.push(value);
    }
  }
  return args;
}

export function applyRuntimeOverrides(options: ParsedOptions): void {
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
