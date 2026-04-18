import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type WorkspaceSnapshotManifest = {
  format: "reagent-workspace-snapshot";
  version: 1;
  createdAt: string;
  workspaceDir: string;
  snapshotDir: string;
  databaseUrl: string;
  sqlitePath: string | null;
  includes: Array<{
    kind: "workspace" | "database";
    sourcePath: string;
    snapshotPath: string;
  }>;
};

export type WorkspaceSnapshotValidation = {
  valid: boolean;
  missingPaths: string[];
  workspaceFileCount: number | null;
  workspaceBytes: number | null;
  databaseBytes: number | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeTimestamp(iso: string): string {
  return iso.replace(/[:]/gu, "-").replace(/[.]/gu, "_");
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function summarizeDirectory(targetPath: string): Promise<{ fileCount: number; totalBytes: number }> {
  let fileCount = 0;
  let totalBytes = 0;
  const entries = await readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await summarizeDirectory(entryPath);
      fileCount += nested.fileCount;
      totalBytes += nested.totalBytes;
      continue;
    }

    const entryStat = await stat(entryPath);
    fileCount += 1;
    totalBytes += entryStat.size;
  }

  return { fileCount, totalBytes };
}

export function resolveSqlitePath(databaseUrl: string, cwd: string): string | null {
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

export class WorkspaceBackupService {
  constructor(
    private readonly workspaceDir: string,
    private readonly databaseUrl: string,
    private readonly cwd: string,
  ) {}

  async createSnapshot(input: {
    outDir?: string | undefined;
    label?: string | undefined;
  } = {}): Promise<{ snapshotDir: string; manifest: WorkspaceSnapshotManifest }> {
    const createdAt = nowIso();
    const sqlitePath = resolveSqlitePath(this.databaseUrl, this.cwd);
    const snapshotName = input.label?.trim()
      ? input.label.trim()
      : `snapshot-${sanitizeTimestamp(createdAt)}`;
    const snapshotRootDir = input.outDir?.trim()
      ? path.resolve(this.cwd, input.outDir.trim())
      : path.resolve(this.cwd, "reagent-workspace-snapshots");
    const snapshotDir = path.join(snapshotRootDir, snapshotName);

    if (isInside(this.workspaceDir, snapshotDir)) {
      throw new Error("Workspace snapshots must be created outside the active workspace directory.");
    }

    try {
      await stat(snapshotDir);
      throw new Error(`Snapshot target already exists: ${snapshotDir}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    await mkdir(snapshotDir, { recursive: true });

    const includes: WorkspaceSnapshotManifest["includes"] = [];
    const workspaceTarget = path.join(snapshotDir, "workspace");
    await cp(this.workspaceDir, workspaceTarget, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    includes.push({
      kind: "workspace",
      sourcePath: this.workspaceDir,
      snapshotPath: workspaceTarget,
    });

    if (sqlitePath) {
      const databaseTarget = path.join(snapshotDir, "database");
      await mkdir(databaseTarget, { recursive: true });
      const sqliteTargetPath = path.join(databaseTarget, path.basename(sqlitePath));
      await cp(sqlitePath, sqliteTargetPath, {
        recursive: false,
        force: false,
        errorOnExist: true,
      });
      includes.push({
        kind: "database",
        sourcePath: sqlitePath,
        snapshotPath: sqliteTargetPath,
      });
    }

    const manifest: WorkspaceSnapshotManifest = {
      format: "reagent-workspace-snapshot",
      version: 1,
      createdAt,
      workspaceDir: this.workspaceDir,
      snapshotDir,
      databaseUrl: this.databaseUrl,
      sqlitePath,
      includes,
    };

    await writeFile(path.join(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { snapshotDir, manifest };
  }

  static async readSnapshotManifest(snapshotPath: string): Promise<WorkspaceSnapshotManifest> {
    const resolvedPath = path.resolve(snapshotPath);
    const stats = await stat(resolvedPath);
    const manifestPath = stats.isDirectory() ? path.join(resolvedPath, "manifest.json") : resolvedPath;
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as WorkspaceSnapshotManifest;

    if (manifest.format !== "reagent-workspace-snapshot") {
      throw new Error(`Unsupported workspace snapshot format in ${manifestPath}`);
    }

    return manifest;
  }

  static async inspectSnapshot(snapshotPath: string): Promise<{
    manifest: WorkspaceSnapshotManifest;
    validation: WorkspaceSnapshotValidation;
  }> {
    const manifest = await WorkspaceBackupService.readSnapshotManifest(snapshotPath);
    const missingPaths: string[] = [];
    let workspaceFileCount: number | null = null;
    let workspaceBytes: number | null = null;
    let databaseBytes: number | null = null;

    for (const item of manifest.includes) {
      try {
        const itemStat = await stat(item.snapshotPath);
        if (item.kind === "workspace" && itemStat.isDirectory()) {
          const summary = await summarizeDirectory(item.snapshotPath);
          workspaceFileCount = summary.fileCount;
          workspaceBytes = summary.totalBytes;
        }
        if (item.kind === "database" && itemStat.isFile()) {
          databaseBytes = itemStat.size;
        }
      } catch {
        missingPaths.push(item.snapshotPath);
      }
    }

    return {
      manifest,
      validation: {
        valid: missingPaths.length === 0,
        missingPaths,
        workspaceFileCount,
        workspaceBytes,
        databaseBytes,
      },
    };
  }

  async applySnapshot(snapshotPath: string, input: { protectionDir?: string | undefined }): Promise<{
    manifest: WorkspaceSnapshotManifest;
    validation: WorkspaceSnapshotValidation;
    protectionDir: string;
    restoredWorkspaceDir: string;
    restoredDatabasePath: string | null;
  }> {
    const inspection = await WorkspaceBackupService.inspectSnapshot(snapshotPath);
    const { manifest, validation } = inspection;
    if (!validation.valid) {
      throw new Error(`Snapshot is incomplete and cannot be restored: ${validation.missingPaths.join(", ")}`);
    }
    const createdAt = nowIso();
    const protectionName = `restore-protection-${sanitizeTimestamp(createdAt)}`;
    const protectionRootDir = input.protectionDir?.trim()
      ? path.resolve(this.cwd, input.protectionDir.trim())
      : path.resolve(this.cwd, "reagent-restore-protection");
    const protectionDir = path.join(protectionRootDir, protectionName);

    if (path.resolve(this.workspaceDir) === path.resolve(this.cwd)) {
      throw new Error("Refusing to restore into the current working directory. Point PLATFORM_WORKSPACE_DIR to a dedicated workspace directory first.");
    }
    if (isInside(this.workspaceDir, protectionDir)) {
      throw new Error("Restore protection data must be written outside the active workspace directory.");
    }

    const workspaceInclude = manifest.includes.find((item) => item.kind === "workspace");
    if (!workspaceInclude) {
      throw new Error("Snapshot manifest does not contain a workspace payload.");
    }

    await mkdir(protectionDir, { recursive: true });

    try {
      await stat(this.workspaceDir);
      await cp(this.workspaceDir, path.join(protectionDir, "workspace-before-restore"), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const currentSqlitePath = resolveSqlitePath(this.databaseUrl, this.cwd);
    const snapshotDatabaseInclude = manifest.includes.find((item) => item.kind === "database");
    if (currentSqlitePath) {
      try {
        await stat(currentSqlitePath);
        await mkdir(path.join(protectionDir, "database-before-restore"), { recursive: true });
        await cp(currentSqlitePath, path.join(protectionDir, "database-before-restore", path.basename(currentSqlitePath)), {
          recursive: false,
          force: false,
          errorOnExist: true,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }

    await rm(this.workspaceDir, { recursive: true, force: true });
    await mkdir(path.dirname(this.workspaceDir), { recursive: true });
    await cp(workspaceInclude.snapshotPath, this.workspaceDir, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });

    let restoredDatabasePath: string | null = null;
    if (currentSqlitePath && snapshotDatabaseInclude) {
      await mkdir(path.dirname(currentSqlitePath), { recursive: true });
      await rm(currentSqlitePath, { recursive: false, force: true });
      await cp(snapshotDatabaseInclude.snapshotPath, currentSqlitePath, {
        recursive: false,
        force: false,
        errorOnExist: true,
      });
      restoredDatabasePath = currentSqlitePath;
    }

    return {
      manifest,
      validation,
      protectionDir,
      restoredWorkspaceDir: this.workspaceDir,
      restoredDatabasePath,
    };
  }
}
