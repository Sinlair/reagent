import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface BundledPluginManifest {
  id: string;
  version?: string | undefined;
  channels?: string[] | undefined;
  configSchema?: unknown;
}

export interface BundledPluginRecord {
  id: string;
  packageName: string;
  version: string;
  description: string;
  packageRoot: string;
  packageJsonPath: string;
  manifestPath: string;
  source: "bundled" | "reference" | "upstream";
  installSpec: string;
  minHostVersion?: string | undefined;
  channels: string[];
  manifest: BundledPluginManifest;
}

interface PackageJsonShape {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  openclaw?: {
    install?: {
      npmSpec?: unknown;
      minHostVersion?: unknown;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseManifest(value: unknown): BundledPluginManifest | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }

  return {
    id: value.id.trim(),
    ...(typeof value.version === "string" && value.version.trim() ? { version: value.version.trim() } : {}),
    ...(Array.isArray(value.channels)
      ? { channels: value.channels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) }
      : {}),
    ...("configSchema" in value ? { configSchema: value.configSchema } : {}),
  };
}

function parsePackageJson(value: unknown): PackageJsonShape | null {
  if (!isRecord(value)) {
    return null;
  }
  return value as PackageJsonShape;
}

export class BundledPluginCatalogService {
  constructor(private readonly repoRoot: string) {}

  async listPlugins(): Promise<BundledPluginRecord[]> {
    const candidateDirs = await this.findCandidatePluginDirs();
    const plugins = await Promise.all(candidateDirs.map((dir) => this.readPlugin(dir.path, dir.source)));
    return plugins.filter((entry): entry is BundledPluginRecord => Boolean(entry));
  }

  async getPlugin(id: string): Promise<BundledPluginRecord | null> {
    const normalized = id.trim().toLowerCase();
    const plugins = await this.listPlugins();
    return (
      plugins.find(
        (plugin) =>
          plugin.id.toLowerCase() === normalized ||
          plugin.packageName.toLowerCase() === normalized ||
          plugin.installSpec.toLowerCase() === normalized,
      ) ?? null
    );
  }

  private async findCandidatePluginDirs(): Promise<Array<{ path: string; source: "bundled" | "reference" | "upstream" }>> {
    const results: Array<{ path: string; source: "bundled" | "reference" | "upstream" }> = [];

    const packagesDir = path.join(this.repoRoot, "packages");
    try {
      const entries = await readdir(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        results.push({
          path: path.join(packagesDir, entry.name),
          source: "bundled",
        });
      }
    } catch {
      // ignore
    }

    results.push({
      path: path.join(this.repoRoot, "package"),
      source: "reference",
    });

    const upstreamExtensionsDir = path.join(this.repoRoot, "upstream", "openclaw", "extensions");
    try {
      const entries = await readdir(upstreamExtensionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        results.push({
          path: path.join(upstreamExtensionsDir, entry.name),
          source: "upstream",
        });
      }
    } catch {
      // ignore
    }

    return results;
  }

  private async readPlugin(packageRoot: string, source: "bundled" | "reference" | "upstream"): Promise<BundledPluginRecord | null> {
    const manifestPath = path.join(packageRoot, "openclaw.plugin.json");
    const packageJsonPath = path.join(packageRoot, "package.json");

    try {
      const [manifestRaw, packageRaw] = await Promise.all([
        readFile(manifestPath, "utf8"),
        readFile(packageJsonPath, "utf8"),
      ]);
      const manifest = parseManifest(JSON.parse(manifestRaw));
      const packageJson = parsePackageJson(JSON.parse(packageRaw));
      if (!manifest || !packageJson || typeof packageJson.name !== "string" || !packageJson.name.trim()) {
        return null;
      }

      const installSpec =
        typeof packageJson.openclaw?.install?.npmSpec === "string" && packageJson.openclaw.install.npmSpec.trim()
          ? packageJson.openclaw.install.npmSpec.trim()
          : packageJson.name.trim();

      return {
        id: manifest.id,
        packageName: packageJson.name.trim(),
        version:
          typeof packageJson.version === "string" && packageJson.version.trim()
            ? packageJson.version.trim()
            : manifest.version ?? "0.0.0",
        description: typeof packageJson.description === "string" ? packageJson.description.trim() : "",
        packageRoot,
        packageJsonPath,
        manifestPath,
        source,
        installSpec,
        ...(typeof packageJson.openclaw?.install?.minHostVersion === "string" &&
        packageJson.openclaw.install.minHostVersion.trim()
          ? { minHostVersion: packageJson.openclaw.install.minHostVersion.trim() }
          : {}),
        channels: manifest.channels ?? [],
        manifest,
      };
    } catch {
      return null;
    }
  }
}
