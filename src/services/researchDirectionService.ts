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
const VALID_PAPER_STYLES = new Set<ResearchPaperStyle>([
  "theory",
  "engineering",
  "reproducibility",
  "application",
]);

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

function normalizeOptionalText(
  value: string | undefined,
  existing?: string | undefined,
): string | undefined {
  if (value === undefined) {
    return existing?.trim() || undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
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
  const summary = normalizeOptionalText(input.summary, existing?.summary);
  const tlDr = normalizeOptionalText(input.tlDr, existing?.tlDr);
  const abstract = normalizeOptionalText(input.abstract, existing?.abstract);
  const background = normalizeOptionalText(input.background, existing?.background);
  const targetProblem = normalizeOptionalText(input.targetProblem, existing?.targetProblem);

  return {
    id: resolveId(input, existing?.id),
    label: input.label.trim(),
    ...(summary ? { summary } : {}),
    ...(tlDr ? { tlDr } : {}),
    ...(abstract ? { abstract } : {}),
    ...(background ? { background } : {}),
    ...(targetProblem ? { targetProblem } : {}),
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
    successCriteria: input.successCriteria ? uniqueTrimmed(input.successCriteria) : (existing?.successCriteria ?? []),
    blockedDirections: input.blockedDirections ? uniqueTrimmed(input.blockedDirections) : (existing?.blockedDirections ?? []),
    knownBaselines: input.knownBaselines ? uniqueTrimmed(input.knownBaselines) : (existing?.knownBaselines ?? []),
    evaluationPriorities:
      input.evaluationPriorities ? uniqueTrimmed(input.evaluationPriorities) : (existing?.evaluationPriorities ?? []),
    shortTermValidationTargets:
      input.shortTermValidationTargets
        ? uniqueTrimmed(input.shortTermValidationTargets)
        : (existing?.shortTermValidationTargets ?? []),
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
    ...(partial.tlDr?.trim() ? { tlDr: partial.tlDr.trim() } : {}),
    ...(partial.abstract?.trim() ? { abstract: partial.abstract.trim() } : {}),
    ...(partial.background?.trim() ? { background: partial.background.trim() } : {}),
    ...(partial.targetProblem?.trim() ? { targetProblem: partial.targetProblem.trim() } : {}),
    subDirections: uniqueTrimmed(partial.subDirections),
    excludedTopics: uniqueTrimmed(partial.excludedTopics),
    preferredVenues: uniqueTrimmed(partial.preferredVenues),
    preferredDatasets: uniqueTrimmed(partial.preferredDatasets),
    preferredBenchmarks: uniqueTrimmed(partial.preferredBenchmarks),
    preferredPaperStyles: normalizePaperStyles(partial.preferredPaperStyles),
    openQuestions: uniqueTrimmed(partial.openQuestions),
    currentGoals: uniqueTrimmed(partial.currentGoals),
    queryHints: uniqueTrimmed(partial.queryHints),
    successCriteria: uniqueTrimmed(partial.successCriteria),
    blockedDirections: uniqueTrimmed(partial.blockedDirections),
    knownBaselines: uniqueTrimmed(partial.knownBaselines),
    evaluationPriorities: uniqueTrimmed(partial.evaluationPriorities),
    shortTermValidationTargets: uniqueTrimmed(partial.shortTermValidationTargets),
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

  const seeds = uniqueTrimmed([
    profile.label,
    profile.targetProblem ?? "",
    ...profile.subDirections,
    ...profile.queryHints,
    ...profile.shortTermValidationTargets,
  ]);
  const venueSeeds = uniqueTrimmed(profile.preferredVenues).slice(0, 3);
  const datasetSeeds = uniqueTrimmed(profile.preferredDatasets).slice(0, 2);
  const benchmarkSeeds = uniqueTrimmed(profile.preferredBenchmarks).slice(0, 2);
  const baselineSeeds = uniqueTrimmed(profile.knownBaselines).slice(0, 2);
  const evaluationSeeds = uniqueTrimmed(profile.evaluationPriorities).slice(0, 2);
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

    for (const baseline of baselineSeeds) {
      queries.set(`${seed} ${baseline}`, "known baseline");
    }

    for (const evaluation of evaluationSeeds) {
      queries.set(`${seed} ${evaluation}`, "evaluation priority");
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

function formatTextSection(title: string, value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return [`## ${title}`, value.trim(), ""];
}

function formatListSection(title: string, values: string[]): string[] {
  if (values.length === 0) {
    return [];
  }

  return [`## ${title}`, ...values.map((value) => `- ${value}`), ""];
}

function serializeProfileToMarkdown(profile: ResearchDirectionProfile): string {
  const lines = [
    `# ${profile.label}`,
    "",
    "## Metadata",
    `- Id: ${profile.id}`,
    `- Priority: ${profile.priority}`,
    `- Enabled: ${String(profile.enabled)}`,
    "",
    ...formatTextSection("Summary", profile.summary),
    ...formatTextSection("TL;DR", profile.tlDr),
    ...formatTextSection("Abstract", profile.abstract),
    ...formatTextSection("Background", profile.background),
    ...formatTextSection("Target Problem", profile.targetProblem),
    ...formatListSection("Success Criteria", profile.successCriteria),
    ...formatListSection("Sub-Directions", profile.subDirections),
    ...formatListSection("Excluded Topics", profile.excludedTopics),
    ...formatListSection("Preferred Venues", profile.preferredVenues),
    ...formatListSection("Preferred Datasets", profile.preferredDatasets),
    ...formatListSection("Preferred Benchmarks", profile.preferredBenchmarks),
    ...formatListSection("Preferred Paper Styles", profile.preferredPaperStyles),
    ...formatListSection("Open Questions", profile.openQuestions),
    ...formatListSection("Current Goals", profile.currentGoals),
    ...formatListSection("Query Hints", profile.queryHints),
    ...formatListSection("Blocked Directions", profile.blockedDirections),
    ...formatListSection("Known Baselines", profile.knownBaselines),
    ...formatListSection("Evaluation Priorities", profile.evaluationPriorities),
    ...formatListSection("Short-Term Validation Targets", profile.shortTermValidationTargets),
  ];

  return `${lines.join("\n").trim()}\n`;
}

function normalizeSectionTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function parseMarkdownSections(markdown: string): {
  label: string;
  sections: Map<string, string>;
} {
  const normalized = markdown.replace(/\r\n/gu, "\n").trim();
  const labelMatch = normalized.match(/^#\s+(.+)$/mu);
  const label = labelMatch?.[1]?.trim();
  if (!label) {
    throw new Error("Research brief markdown must start with a top-level heading.");
  }

  const sections = new Map<string, string[]>();
  let currentSection: string | null = null;

  for (const line of normalized.split("\n")) {
    if (/^#\s+/u.test(line)) {
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/u);
    if (sectionMatch?.[1]) {
      currentSection = normalizeSectionTitle(sectionMatch[1]);
      sections.set(currentSection, []);
      continue;
    }

    if (currentSection) {
      sections.get(currentSection)?.push(line);
    }
  }

  return {
    label,
    sections: new Map(
      [...sections.entries()].map(([key, lines]) => [key, lines.join("\n").trim()])
    ),
  };
}

function parseListSection(sections: Map<string, string>, title: string): string[] {
  const raw = sections.get(normalizeSectionTitle(title));
  if (!raw) {
    return [];
  }

  return uniqueTrimmed(
    raw
      .split("\n")
      .map((line) => line.match(/^\s*-\s+(.+)$/u)?.[1] ?? "")
  );
}

function parseTextSection(sections: Map<string, string>, title: string): string | undefined {
  const raw = sections.get(normalizeSectionTitle(title));
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function parseMetadataSection(sections: Map<string, string>): {
  id?: string | undefined;
  priority?: ResearchDirectionPriority | undefined;
  enabled?: boolean | undefined;
} {
  const raw = sections.get("metadata");
  if (!raw) {
    return {};
  }

  const metadata: {
    id?: string | undefined;
    priority?: ResearchDirectionPriority | undefined;
    enabled?: boolean | undefined;
  } = {};

  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*-\s+([^:]+):\s*(.+)$/u);
    const key = match?.[1]?.trim().toLowerCase();
    const value = match?.[2]?.trim();
    if (!key || !value) {
      continue;
    }

    if (key === "id") {
      metadata.id = value;
    } else if (
      key === "priority" &&
      (value === "primary" || value === "secondary" || value === "watchlist")
    ) {
      metadata.priority = value;
    } else if (key === "enabled") {
      metadata.enabled = value.toLowerCase() === "true";
    }
  }

  return metadata;
}

function parseBriefMarkdown(
  markdown: string,
  options: { id?: string | undefined } = {}
): ResearchDirectionProfileInput {
  const { label, sections } = parseMarkdownSections(markdown);
  const metadata = parseMetadataSection(sections);
  const preferredPaperStyles = parseListSection(sections, "Preferred Paper Styles").filter(
    (value): value is ResearchPaperStyle => VALID_PAPER_STYLES.has(value as ResearchPaperStyle)
  );
  const summary = parseTextSection(sections, "Summary");
  const tlDr = parseTextSection(sections, "TL;DR");
  const abstract = parseTextSection(sections, "Abstract");
  const background = parseTextSection(sections, "Background");
  const targetProblem = parseTextSection(sections, "Target Problem");

  return {
    ...(options.id?.trim() ? { id: options.id.trim() } : metadata.id?.trim() ? { id: metadata.id.trim() } : {}),
    label,
    ...(summary ? { summary } : {}),
    ...(tlDr ? { tlDr } : {}),
    ...(abstract ? { abstract } : {}),
    ...(background ? { background } : {}),
    ...(targetProblem ? { targetProblem } : {}),
    subDirections: parseListSection(sections, "Sub-Directions"),
    excludedTopics: parseListSection(sections, "Excluded Topics"),
    preferredVenues: parseListSection(sections, "Preferred Venues"),
    preferredDatasets: parseListSection(sections, "Preferred Datasets"),
    preferredBenchmarks: parseListSection(sections, "Preferred Benchmarks"),
    preferredPaperStyles,
    openQuestions: parseListSection(sections, "Open Questions"),
    currentGoals: parseListSection(sections, "Current Goals"),
    queryHints: parseListSection(sections, "Query Hints"),
    successCriteria: parseListSection(sections, "Success Criteria"),
    blockedDirections: parseListSection(sections, "Blocked Directions"),
    knownBaselines: parseListSection(sections, "Known Baselines"),
    evaluationPriorities: parseListSection(sections, "Evaluation Priorities"),
    shortTermValidationTargets: parseListSection(sections, "Short-Term Validation Targets"),
    ...(metadata.priority ? { priority: metadata.priority } : {}),
    ...(metadata.enabled !== undefined ? { enabled: metadata.enabled } : {}),
  };
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

  async listBriefs(): Promise<ResearchDirectionProfile[]> {
    return this.listProfiles();
  }

  async getProfile(directionId: string): Promise<ResearchDirectionProfile | null> {
    const id = directionId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.profiles.find((profile) => profile.id === id) ?? null;
  }

  async getBrief(directionId: string): Promise<ResearchDirectionProfile | null> {
    return this.getProfile(directionId);
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

  async upsertBrief(input: ResearchDirectionProfileInput): Promise<ResearchDirectionProfile> {
    return this.upsertProfile(input);
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

  async deleteBrief(directionId: string): Promise<boolean> {
    return this.deleteProfile(directionId);
  }

  async exportBriefMarkdown(directionId: string): Promise<string | null> {
    const profile = await this.getProfile(directionId);
    return profile ? serializeProfileToMarkdown(profile) : null;
  }

  async importBriefMarkdown(
    markdown: string,
    options: { id?: string | undefined } = {}
  ): Promise<ResearchDirectionProfile> {
    return this.upsertProfile(parseBriefMarkdown(markdown, options));
  }

  async buildDiscoveryPlan(directionId?: string | undefined): Promise<ResearchDiscoveryQueryCandidate[]> {
    if (directionId?.trim()) {
      const profile = await this.getProfile(directionId.trim());
      return profile ? buildQueryCandidatesForProfile(profile) : [];
    }

    return (await this.listProfiles()).flatMap((profile) => buildQueryCandidatesForProfile(profile));
  }
}
