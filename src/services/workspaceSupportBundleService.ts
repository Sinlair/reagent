import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type SupportBundlePayload = {
  format: "reagent-support-bundle";
  version: 1;
  createdAt: string;
  workspaceDir: string;
  databaseUrl: string;
  sqlitePath: string | null;
  runtimeStatus: {
    reachable: boolean;
    port: number | null;
    status: string | null;
    issues: string[];
    hints: string[];
  };
  doctorSummary: {
    envFileExists: boolean;
    workspaceReady: boolean;
    sqliteDirReady: boolean;
  };
  recentLogs: {
    stdout: string;
    stderr: string;
  };
  channelLifecycleAudit: string;
  agentRuntimeAudit: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeTimestamp(iso: string): string {
  return iso.replace(/[:]/gu, "-").replace(/[.]/gu, "_");
}

async function readTextIfPresent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export class WorkspaceSupportBundleService {
  constructor(
    private readonly workspaceDir: string,
    private readonly databaseUrl: string,
    private readonly sqlitePath: string | null,
  ) {}

  async createBundle(input: {
    status: {
      reachable: boolean;
      port: number | null;
      status: string | null;
      issues: string[];
      hints: string[];
    };
    envFileExists: boolean;
    sqliteDirReady: boolean;
    stdoutLog: string;
    stderrLog: string;
    outDir?: string | undefined;
    label?: string | undefined;
  }): Promise<{ bundleDir: string; payload: SupportBundlePayload }> {
    const createdAt = nowIso();
    const bundleName = input.label?.trim()
      ? input.label.trim()
      : `support-bundle-${sanitizeTimestamp(createdAt)}`;
    const bundleRootDir = input.outDir?.trim()
      ? path.resolve(input.outDir.trim())
      : path.resolve("reagent-support-bundles");
    const bundleDir = path.join(bundleRootDir, bundleName);

    try {
      await stat(bundleDir);
      throw new Error(`Support bundle target already exists: ${bundleDir}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    await mkdir(bundleDir, { recursive: true });

    const payload: SupportBundlePayload = {
      format: "reagent-support-bundle",
      version: 1,
      createdAt,
      workspaceDir: this.workspaceDir,
      databaseUrl: this.databaseUrl,
      sqlitePath: this.sqlitePath,
      runtimeStatus: input.status,
      doctorSummary: {
        envFileExists: input.envFileExists,
        workspaceReady: true,
        sqliteDirReady: input.sqliteDirReady,
      },
      recentLogs: {
        stdout: input.stdoutLog,
        stderr: input.stderrLog,
      },
      channelLifecycleAudit: await readTextIfPresent(path.join(this.workspaceDir, "channels", "wechat-lifecycle-audit.jsonl")),
      agentRuntimeAudit: await readTextIfPresent(path.join(this.workspaceDir, "channels", "agent-runtime-audit.jsonl")),
    };

    await writeFile(path.join(bundleDir, "bundle.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return { bundleDir, payload };
  }
}
