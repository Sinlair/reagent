import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MemoryPolicy, MemoryPolicyPatch } from "../types/memory.js";

const STORE_FILE = "memory-policy.json";

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueTrimmed(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function defaultMemoryPolicy(): MemoryPolicy {
  return {
    updatedAt: nowIso(),
    autoCompactionEnabled: true,
    autoCompactionIntervalMinutes: 30,
    autoCompactionOlderThanDays: 14,
    autoCompactionMinEntries: 6,
    autoCompactionMaxEntries: 12,
    maxDailyEntriesBeforeAutoCompact: 24,
    neverCompactTags: ["pinned", "never-compact", "memory-summary"],
    highConfidenceLongTermOnly: false,
  };
}

function normalizePolicy(partial: Partial<MemoryPolicy>): MemoryPolicy {
  const defaults = defaultMemoryPolicy();
  return {
    updatedAt: partial.updatedAt?.trim() || defaults.updatedAt,
    autoCompactionEnabled: partial.autoCompactionEnabled ?? defaults.autoCompactionEnabled,
    autoCompactionIntervalMinutes:
      typeof partial.autoCompactionIntervalMinutes === "number" &&
      Number.isFinite(partial.autoCompactionIntervalMinutes)
        ? Math.max(5, Math.min(partial.autoCompactionIntervalMinutes, 24 * 60))
        : defaults.autoCompactionIntervalMinutes,
    autoCompactionOlderThanDays:
      typeof partial.autoCompactionOlderThanDays === "number" &&
      Number.isFinite(partial.autoCompactionOlderThanDays)
        ? Math.max(1, Math.min(partial.autoCompactionOlderThanDays, 365))
        : defaults.autoCompactionOlderThanDays,
    autoCompactionMinEntries:
      typeof partial.autoCompactionMinEntries === "number" &&
      Number.isFinite(partial.autoCompactionMinEntries)
        ? Math.max(2, Math.min(partial.autoCompactionMinEntries, 50))
        : defaults.autoCompactionMinEntries,
    autoCompactionMaxEntries:
      typeof partial.autoCompactionMaxEntries === "number" &&
      Number.isFinite(partial.autoCompactionMaxEntries)
        ? Math.max(
            partial.autoCompactionMinEntries ?? defaults.autoCompactionMinEntries,
            Math.min(partial.autoCompactionMaxEntries, 100),
          )
        : defaults.autoCompactionMaxEntries,
    maxDailyEntriesBeforeAutoCompact:
      typeof partial.maxDailyEntriesBeforeAutoCompact === "number" &&
      Number.isFinite(partial.maxDailyEntriesBeforeAutoCompact)
        ? Math.max(3, Math.min(partial.maxDailyEntriesBeforeAutoCompact, 500))
        : defaults.maxDailyEntriesBeforeAutoCompact,
    neverCompactTags: uniqueTrimmed(partial.neverCompactTags ?? defaults.neverCompactTags),
    highConfidenceLongTermOnly: partial.highConfidenceLongTermOnly ?? defaults.highConfidenceLongTermOnly,
  };
}

export class MemoryPolicyService {
  constructor(private readonly workspaceDir: string) {}

  private get storePath(): string {
    return path.join(this.workspaceDir, STORE_FILE);
  }

  async getPolicy(): Promise<MemoryPolicy> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      return normalizePolicy(JSON.parse(raw) as Partial<MemoryPolicy>);
    } catch {
      return defaultMemoryPolicy();
    }
  }

  async updatePolicy(patch: MemoryPolicyPatch): Promise<MemoryPolicy> {
    const current = await this.getPolicy();
    const next = normalizePolicy({
      ...current,
      updatedAt: nowIso(),
      ...(patch.autoCompactionEnabled !== undefined
        ? { autoCompactionEnabled: patch.autoCompactionEnabled }
        : {}),
      ...(patch.autoCompactionIntervalMinutes !== undefined
        ? { autoCompactionIntervalMinutes: patch.autoCompactionIntervalMinutes }
        : {}),
      ...(patch.autoCompactionOlderThanDays !== undefined
        ? { autoCompactionOlderThanDays: patch.autoCompactionOlderThanDays }
        : {}),
      ...(patch.autoCompactionMinEntries !== undefined
        ? { autoCompactionMinEntries: patch.autoCompactionMinEntries }
        : {}),
      ...(patch.autoCompactionMaxEntries !== undefined
        ? { autoCompactionMaxEntries: patch.autoCompactionMaxEntries }
        : {}),
      ...(patch.maxDailyEntriesBeforeAutoCompact !== undefined
        ? { maxDailyEntriesBeforeAutoCompact: patch.maxDailyEntriesBeforeAutoCompact }
        : {}),
      ...(patch.neverCompactTags !== undefined ? { neverCompactTags: patch.neverCompactTags } : {}),
      ...(patch.highConfidenceLongTermOnly !== undefined
        ? { highConfidenceLongTermOnly: patch.highConfidenceLongTermOnly }
        : {}),
    });
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }
}
