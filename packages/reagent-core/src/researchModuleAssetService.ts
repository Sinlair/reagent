import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ModuleAsset, ModuleAssetStore } from "./researchArtifacts.js";
import { ResearchRepoAnalysisService } from "./researchRepoAnalysisService.js";

const STORE_FILE = "research/module-assets.json";
const MAX_ASSETS = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ModuleAssetStore {
  return {
    updatedAt: nowIso(),
    assets: [],
  };
}

export class ResearchModuleAssetService {
  private readonly storePath: string;
  private readonly archiveDir: string;
  private readonly repoAnalysisService: ResearchRepoAnalysisService;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.archiveDir = path.join(workspaceDir, "research", "repo-archives");
    this.repoAnalysisService = new ResearchRepoAnalysisService(workspaceDir);
  }

  private async readStore(): Promise<ModuleAssetStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ModuleAssetStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ModuleAssetStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 20): Promise<ModuleAsset[]> {
    const store = await this.readStore();
    return store.assets.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getAsset(assetId: string): Promise<ModuleAsset | null> {
    const id = assetId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.assets.find((asset) => asset.id === id) ?? null;
  }

  async extract(input: {
    url: string;
    contextTitle?: string | undefined;
    selectedPaths?: string[] | undefined;
  }): Promise<ModuleAsset> {
    const repoReport = await this.repoAnalysisService.analyze({
      url: input.url,
      ...(input.contextTitle?.trim() ? { contextTitle: input.contextTitle.trim() } : {}),
    });

    const defaultBranch = repoReport.defaultBranch || "main";
    const archiveUrl = `https://github.com/${repoReport.owner}/${repoReport.repo}/archive/refs/heads/${defaultBranch}.zip`;
    const response = await fetch(archiveUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "ReAgentCore/0.1",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to download GitHub archive: ${response.status}`);
    }

    const archiveBytes = Buffer.from(await response.arrayBuffer());
    await mkdir(this.archiveDir, { recursive: true });
    const archiveFileName = `${repoReport.owner}-${repoReport.repo}-${defaultBranch}.zip`;
    const archivePath = path.join(this.archiveDir, archiveFileName);
    await writeFile(archivePath, archiveBytes);

    const selectedPaths = (
      input.selectedPaths && input.selectedPaths.length > 0
        ? input.selectedPaths
        : repoReport.keyPaths.slice(0, 5)
    )
      .map((item) => item.trim())
      .filter(Boolean);

    const asset: ModuleAsset = {
      id: randomUUID(),
      repoUrl: repoReport.url,
      owner: repoReport.owner,
      repo: repoReport.repo,
      ...(repoReport.defaultBranch ? { defaultBranch: repoReport.defaultBranch } : {}),
      archivePath,
      selectedPaths,
      notes: [
        `Archive downloaded to ${archiveFileName}.`,
        ...repoReport.notes,
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      assets: [asset, ...store.assets].slice(0, MAX_ASSETS),
    });

    return asset;
  }
}
