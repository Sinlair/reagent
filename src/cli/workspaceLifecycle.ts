import path from "node:path";
import process from "node:process";

import { getBooleanFlag, getStringFlag, type ParsedOptions } from "./args.js";
import { WorkspaceBackupService } from "../services/workspaceBackupService.js";
import { WorkspaceSupportBundleService } from "../services/workspaceSupportBundleService.js";

export interface WorkspaceLifecycleCliDeps {
  resolveWorkspaceDir(options: ParsedOptions): Promise<string>;
  resolveDatabaseUrl(options: ParsedOptions): Promise<string>;
  resolveSqlitePath(databaseUrl: string): string | null;
  pathExists(targetPath: string): Promise<boolean>;
  readGatewayStatus(): Promise<{
    reachable: boolean;
    port: number | null;
    status: string | null;
    issues: string[];
    hints: string[];
  }>;
  readRuntimeLogTail(kind: "out" | "err", lines: number): Promise<string>;
  printJson(value: unknown): void;
  renderWorkspaceHelp(): void;
}

export function createWorkspaceLifecycleCli(deps: WorkspaceLifecycleCliDeps) {
  async function workspaceSnapshotCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const databaseUrl = await deps.resolveDatabaseUrl(options);
    const service = new WorkspaceBackupService(workspaceDir, databaseUrl, process.cwd());
    const result = await service.createSnapshot({
      outDir: getStringFlag(options, "out", "out-dir"),
      label: getStringFlag(options, "label"),
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        snapshotDir: result.snapshotDir,
        manifest: result.manifest,
      });
      return;
    }

    console.log(`Workspace snapshot created: ${path.resolve(result.snapshotDir)}`);
  }

  async function workspaceRestorePreviewCommand(options: ParsedOptions): Promise<void> {
    const snapshotPath = options.positionals.join(" ").trim();
    if (!snapshotPath) {
      throw new Error("workspace restore preview requires a snapshot directory or manifest path.");
    }

    const inspection = await WorkspaceBackupService.inspectSnapshot(path.resolve(process.cwd(), snapshotPath));
    const { manifest, validation } = inspection;
    if (getBooleanFlag(options, "json")) {
      deps.printJson({ manifest, validation });
      return;
    }

    console.log(`Snapshot: ${manifest.snapshotDir}`);
    console.log(`Created: ${manifest.createdAt}`);
    console.log(`Target workspace: ${manifest.workspaceDir}`);
    console.log(`Database: ${manifest.sqlitePath ?? manifest.databaseUrl}`);
    console.log(`Valid: ${validation.valid ? "yes" : "no"}`);
    console.log(`Workspace files: ${validation.workspaceFileCount ?? "-"}`);
    console.log(`Workspace bytes: ${validation.workspaceBytes ?? "-"}`);
    console.log(`Database bytes: ${validation.databaseBytes ?? "-"}`);
    if (validation.missingPaths.length > 0) {
      console.log("Missing:");
      for (const item of validation.missingPaths) {
        console.log(`  - ${item}`);
      }
    }
    console.log("Included:");
    for (const item of manifest.includes) {
      console.log(`  - ${item.kind}: ${item.sourcePath} -> ${item.snapshotPath}`);
    }
  }

  async function workspaceRestoreApplyCommand(options: ParsedOptions): Promise<void> {
    const snapshotPath = options.positionals.join(" ").trim();
    if (!snapshotPath) {
      throw new Error("workspace restore apply requires a snapshot directory or manifest path.");
    }
    if (!getBooleanFlag(options, "yes")) {
      throw new Error("workspace restore apply requires --yes to confirm destructive restore behavior.");
    }

    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const databaseUrl = await deps.resolveDatabaseUrl(options);
    const service = new WorkspaceBackupService(workspaceDir, databaseUrl, process.cwd());
    const result = await service.applySnapshot(path.resolve(process.cwd(), snapshotPath), {
      protectionDir: getStringFlag(options, "protection-dir"),
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        restored: true,
        validation: result.validation,
        protectionDir: result.protectionDir,
        restoredWorkspaceDir: result.restoredWorkspaceDir,
        restoredDatabasePath: result.restoredDatabasePath,
      });
      return;
    }

    console.log(`Workspace restored into ${result.restoredWorkspaceDir}`);
    console.log(`Protection backup: ${result.protectionDir}`);
    if (result.restoredDatabasePath) {
      console.log(`Restored database: ${result.restoredDatabasePath}`);
    }
  }

  async function workspaceSupportBundleCommand(options: ParsedOptions): Promise<void> {
    const workspaceDir = await deps.resolveWorkspaceDir(options);
    const databaseUrl = await deps.resolveDatabaseUrl(options);
    const sqlitePath = deps.resolveSqlitePath(databaseUrl);
    const sqliteDirReady = sqlitePath ? await deps.pathExists(path.dirname(sqlitePath)) : true;
    const envFileExists = await deps.pathExists(path.resolve(process.cwd(), ".env"));
    const status = await deps.readGatewayStatus();
    const service = new WorkspaceSupportBundleService(workspaceDir, databaseUrl, sqlitePath);
    const result = await service.createBundle({
      status,
      envFileExists,
      sqliteDirReady,
      stdoutLog: await deps.readRuntimeLogTail("out", 120),
      stderrLog: await deps.readRuntimeLogTail("err", 120),
      outDir: getStringFlag(options, "out", "out-dir"),
      label: getStringFlag(options, "label"),
    });

    if (getBooleanFlag(options, "json")) {
      deps.printJson({
        bundleDir: result.bundleDir,
        payload: result.payload,
      });
      return;
    }

    console.log(`Support bundle created: ${path.resolve(result.bundleDir)}`);
  }

  async function workspaceCommand(options: ParsedOptions): Promise<void> {
    if (getBooleanFlag(options, "help", "h")) {
      deps.renderWorkspaceHelp();
      return;
    }

    const subcommand = options.positionals[0];
    if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      deps.renderWorkspaceHelp();
      return;
    }

    if (subcommand === "snapshot") {
      await workspaceSnapshotCommand({
        flags: new Map(options.flags),
        positionals: options.positionals.slice(1),
      });
      return;
    }

    if (subcommand === "restore") {
      const nested = options.positionals[1];
      if (nested === "preview") {
        await workspaceRestorePreviewCommand({
          flags: new Map(options.flags),
          positionals: options.positionals.slice(2),
        });
        return;
      }
      if (nested === "apply") {
        await workspaceRestoreApplyCommand({
          flags: new Map(options.flags),
          positionals: options.positionals.slice(2),
        });
        return;
      }
    }

    if (subcommand === "support-bundle") {
      await workspaceSupportBundleCommand({
        flags: new Map(options.flags),
        positionals: options.positionals.slice(1),
      });
      return;
    }

    throw new Error(`Unknown workspace command: ${subcommand}`);
  }

  return {
    workspaceSnapshotCommand,
    workspaceRestorePreviewCommand,
    workspaceRestoreApplyCommand,
    workspaceSupportBundleCommand,
    workspaceCommand,
  };
}
