import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ResearchDirectionPriority,
  ResearchDirectionProfile,
  ResearchDirectionProfileInput,
  ResearchDirectionStore,
  ResearchDiscoveryQueryCandidate,
  ResearchPaperStyle,
} from "../types/researchDirection.js";

const STORE_FILE = "channels/research-directions.json";
const MAX_QUERY_CANDIDATES = 12;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchDirectionStore {
  return {
    updatedAt: nowIso(),
    profiles: [],
  };
}

function uniqueTrimmed(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function resolveId(input: ResearchDirectionProfileInput, existingId?: string | undefined): string {
  const candidate = input.id?.trim() || existingId?.trim() || slugify(input.label);
  return candidate || `direction-${Date.now()}`;
}

function normalizePriority(
  value: ResearchDirectionPriority | undefined,
): ResearchDirectionPriority {
  return value ?? "secondary";
}

function normalizePaperStyles(
  values: ResearchPaperStyle[] | undefined,
): ResearchPaperStyle[] {
  return values ? [...new Set(values)] : [];
}

function normalizeProfile(
  input: ResearchDirectionProfileInput,
  existing?: ResearchDirectionProfile | undefined,
): ResearchDirectionProfile {
  const createdAt = existing?.createdAt ?? nowIso();
  const updatedAt = nowIso();

  return {
    id: resolveId(input, existing?.id),
    label: input.label.trim(),
    ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
    subDirections: input.subDirections ? uniqueTrimmed(input.subDirections) : (existing?.subDirections ?? []),
    excludedTopics: input.excludedTopics ? uniqueTrimmed(input.excludedTopics) : (existing?.excludedTopics ?? []),
    preferredVenues: input.preferredVenues ? uniqueTrimmed(input.preferredVenues) : (existing?.preferredVenues ?? []),
    preferredDatasets: input.preferredDatasets ? uniqueTrimmed(input.preferredDatasets) : (existing?.preferredDatasets ?? []),
    preferredBenchmarks:
      input.preferredBenchmarks ? uniqueTrimmed(input.preferredBenchmarks) : (existing?.preferredBenchmarks ?? []),
    preferredPaperStyles:
      input.preferredPaperStyles ? normalizePaperStyles(input.preferredPaperStyles) : (existing?.preferredPaperStyles ?? []),
    openQuestions: input.openQuestions ? uniqueTrimmed(input.openQuestions) : (existing?.openQuestions ?? []),
    currentGoals: input.currentGoals ? uniqueTrimmed(input.currentGoals) : (existing?.currentGoals ?? []),
    queryHints: input.queryHints ? uniqueTrimmed(input.queryHints) : (existing?.queryHints ?? []),
    priority: normalizePriority(input.priority ?? existing?.priority),
    enabled: input.enabled ?? existing?.enabled ?? true,
    createdAt,
    updatedAt,
  };
}

function normalizeLoadedProfile(partial: Partial<ResearchDirectionProfile>): ResearchDirectionProfile | null {
  const label = partial.label?.trim();
  if (!label) {
    return null;
  }

  const id = partial.id?.trim() || slugify(label) || `direction-${Date.now()}`;
  return {
    id,
    label,
    ...(partial.summary?.trim() ? { summary: partial.summary.trim() } : {}),
    subDirections: uniqueTrimmed(partial.subDirections),
    excludedTopics: uniqueTrimmed(partial.excludedTopics),
    preferredVenues: uniqueTrimmed(partial.preferredVenues),
    preferredDatasets: uniqueTrimmed(partial.preferredDatasets),
    preferredBenchmarks: uniqueTrimmed(partial.preferredBenchmarks),
    preferredPaperStyles: normalizePaperStyles(partial.preferredPaperStyles),
    openQuestions: uniqueTrimmed(partial.openQuestions),
    currentGoals: uniqueTrimmed(partial.currentGoals),
    queryHints: uniqueTrimmed(partial.queryHints),
    priority: normalizePriority(partial.priority),
    enabled: partial.enabled ?? true,
    createdAt: partial.createdAt?.trim() || nowIso(),
    updatedAt: partial.updatedAt?.trim() || nowIso(),
  };
}

function buildQueryCandidatesForProfile(
  profile: ResearchDirectionProfile,
): ResearchDiscoveryQueryCandidate[] {
  if (!profile.enabled) {
    return [];
  }

  const seeds = uniqueTrimmed([profile.label, ...profile.subDirections, ...profile.queryHints]);
  const venueSeeds = uniqueTrimmed(profile.preferredVenues).slice(0, 3);
  const datasetSeeds = uniqueTrimmed(profile.preferredDatasets).slice(0, 2);
  const benchmarkSeeds = uniqueTrimmed(profile.preferredBenchmarks).slice(0, 2);
  const styles = normalizePaperStyles(profile.preferredPaperStyles);
  const queries = new Map<string, string>();

  for (const seed of seeds) {
    queries.set(seed, "core direction");
    queries.set(`${seed} recent paper`, "recent-paper scan");
    queries.set(`${seed} arXiv`, "arXiv scan");

    for (const venue of venueSeeds) {
      queries.set(`${seed} ${venue}`, "preferred venue");
    }

    for (const dataset of datasetSeeds) {
      queries.set(`${seed} ${dataset}`, "preferred dataset");
    }

    for (const benchmark of benchmarkSeeds) {
      queries.set(`${seed} ${benchmark}`, "preferred benchmark");
    }

    if (styles.includes("reproducibility")) {
      queries.set(`${seed} code github`, "code-oriented search");
    }
    if (styles.includes("engineering")) {
      queries.set(`${seed} implementation`, "engineering-oriented search");
    }
  }

  return [...queries.entries()]
    .slice(0, MAX_QUERY_CANDIDATES)
    .map(([query, reason]) => ({
      directionId: profile.id,
      directionLabel: profile.label,
      query,
      reason,
    }));
}

export class ResearchDirectionService {
  private readonly storePath: string;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
  }

  private async readStore(): Promise<ResearchDirectionStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchDirectionStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        profiles: Array.isArray(parsed.profiles)
          ? parsed.profiles
              .map((profile) => normalizeLoadedProfile(profile))
              .filter((profile): profile is ResearchDirectionProfile => Boolean(profile))
              .sort((left, right) => left.label.localeCompare(right.label))
          : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchDirectionStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listProfiles(): Promise<ResearchDirectionProfile[]> {
    const store = await this.readStore();
    return [...store.profiles];
  }

  async getProfile(directionId: string): Promise<ResearchDirectionProfile | null> {
    const id = directionId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.profiles.find((profile) => profile.id === id) ?? null;
  }

  async upsertProfile(input: ResearchDirectionProfileInput): Promise<ResearchDirectionProfile> {
    const store = await this.readStore();
    const requestedId = input.id?.trim();
    const existing = requestedId
      ? store.profiles.find((profile) => profile.id === requestedId)
      : store.profiles.find((profile) => profile.label.toLowerCase() === input.label.trim().toLowerCase());
    const profile = normalizeProfile(input, existing);
    const nextProfiles = store.profiles.filter((item) => item.id !== profile.id);
    nextProfiles.push(profile);
    nextProfiles.sort((left, right) => left.label.localeCompare(right.label));
    await this.writeStore({
      ...store,
      profiles: nextProfiles,
    });
    return profile;
  }

  async deleteProfile(directionId: string): Promise<boolean> {
    const id = directionId.trim();
    if (!id) {
      return false;
    }

    const store = await this.readStore();
    const nextProfiles = store.profiles.filter((profile) => profile.id !== id);
    if (nextProfiles.length === store.profiles.length) {
      return false;
    }

    await this.writeStore({
      ...store,
      profiles: nextProfiles,
    });
    return true;
  }

  async buildDiscoveryPlan(directionId?: string | undefined): Promise<ResearchDiscoveryQueryCandidate[]> {
    if (directionId?.trim()) {
      const profile = await this.getProfile(directionId.trim());
      return profile ? buildQueryCandidatesForProfile(profile) : [];
    }

    return (await this.listProfiles()).flatMap((profile) => buildQueryCandidatesForProfile(profile));
  }
}
