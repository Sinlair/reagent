import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ModuleAsset } from "../types/researchArtifacts.js";
import type { ResearchDirectionProfile, ResearchDirectionProfileInput } from "../types/researchDirection.js";
import type { ResearchDirectionReport } from "../types/researchDirectionReport.js";
import type {
  ResearchDirectionPresetCandidate,
  ResearchEvolutionCandidate,
  ResearchEvolutionCandidateApplyOutcome,
  ResearchEvolutionCandidateApplyRecord,
  ResearchEvolutionCandidateApplySnapshot,
  ResearchEvolutionCandidateDirectionSnapshot,
  ResearchEvolutionCandidateEvidenceItem,
  ResearchEvolutionCandidateReviewDecision,
  ResearchEvolutionCandidateRollbackOutcome,
  ResearchEvolutionCandidateStore,
  ResearchWorkspaceSkillCandidate,
  ResearchWorkspaceSkillCandidatePayload,
} from "../types/researchEvolutionCandidate.js";
import { ResearchDirectionReportService } from "./researchDirectionReportService.js";
import { ResearchDirectionService } from "./researchDirectionService.js";
import { ResearchModuleAssetService } from "./researchModuleAssetService.js";
import { SkillRegistryService } from "./skillRegistryService.js";

const STORE_FILE = "research/evolution-candidates.json";
const MAX_CANDIDATES = 100;
const GENERATED_SKILL_REFERENCE_FILE = "SOURCE.md";

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchEvolutionCandidateStore {
  return {
    updatedAt: nowIso(),
    candidates: [],
  };
}

function normalizeStoredCandidate(value: unknown): ResearchEvolutionCandidate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.status !== "string" ||
    typeof candidate.candidateType !== "string" ||
    typeof candidate.sourceType !== "string" ||
    typeof candidate.sourceId !== "string" ||
    !candidate.payload ||
    typeof candidate.payload !== "object"
  ) {
    return null;
  }

  return {
    ...(candidate as unknown as ResearchEvolutionCandidate),
    evidence: Array.isArray(candidate.evidence)
      ? (candidate.evidence as ResearchEvolutionCandidate["evidence"])
      : [],
    reviews: Array.isArray(candidate.reviews)
      ? (candidate.reviews as ResearchEvolutionCandidate["reviews"])
      : [],
    applyHistory: Array.isArray(candidate.applyHistory)
      ? (candidate.applyHistory as ResearchEvolutionCandidate["applyHistory"])
      : [],
    rollbackHistory: Array.isArray(candidate.rollbackHistory)
      ? (candidate.rollbackHistory as ResearchEvolutionCandidate["rollbackHistory"])
      : [],
  };
}

function uniqueTrimmed(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function trimOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const matched = trimmed.match(/^(.+?[.!?])(?:\s|$)/u);
  return matched?.[1]?.trim() || trimmed;
}

function extractPrefixedValues(values: string[], prefix: string): string[] {
  const normalizedPrefix = prefix.trim().toLowerCase();
  return values
    .map((value) => value.trim())
    .filter((value) => value.toLowerCase().startsWith(normalizedPrefix))
    .map((value) => value.slice(prefix.length).trim())
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function snapshotDirectionProfile(
  profile: {
    directionId: string;
    label: string;
    summary?: string | undefined;
    tlDr?: string | undefined;
    abstract?: string | undefined;
    background?: string | undefined;
    targetProblem?: string | undefined;
    subDirections?: string[] | undefined;
    excludedTopics?: string[] | undefined;
    preferredVenues?: string[] | undefined;
    preferredDatasets?: string[] | undefined;
    preferredBenchmarks?: string[] | undefined;
    preferredPaperStyles?: ResearchDirectionProfile["preferredPaperStyles"] | undefined;
    openQuestions?: string[] | undefined;
    currentGoals?: string[] | undefined;
    queryHints?: string[] | undefined;
    successCriteria?: string[] | undefined;
    blockedDirections?: string[] | undefined;
    knownBaselines?: string[] | undefined;
    evaluationPriorities?: string[] | undefined;
    shortTermValidationTargets?: string[] | undefined;
    priority?: ResearchDirectionProfile["priority"] | undefined;
    enabled?: boolean | undefined;
    createdAt?: string | undefined;
  },
): ResearchEvolutionCandidateDirectionSnapshot {
  return {
    directionId: profile.directionId,
    label: profile.label.trim(),
    ...(trimOptionalText(profile.summary) ? { summary: trimOptionalText(profile.summary) } : {}),
    ...(trimOptionalText(profile.tlDr) ? { tlDr: trimOptionalText(profile.tlDr) } : {}),
    ...(trimOptionalText(profile.abstract) ? { abstract: trimOptionalText(profile.abstract) } : {}),
    ...(trimOptionalText(profile.background) ? { background: trimOptionalText(profile.background) } : {}),
    ...(trimOptionalText(profile.targetProblem) ? { targetProblem: trimOptionalText(profile.targetProblem) } : {}),
    subDirections: uniqueTrimmed(profile.subDirections ?? []),
    excludedTopics: uniqueTrimmed(profile.excludedTopics ?? []),
    preferredVenues: uniqueTrimmed(profile.preferredVenues ?? []),
    preferredDatasets: uniqueTrimmed(profile.preferredDatasets ?? []),
    preferredBenchmarks: uniqueTrimmed(profile.preferredBenchmarks ?? []),
    preferredPaperStyles: [...new Set(profile.preferredPaperStyles ?? [])],
    openQuestions: uniqueTrimmed(profile.openQuestions ?? []),
    currentGoals: uniqueTrimmed(profile.currentGoals ?? []),
    queryHints: uniqueTrimmed(profile.queryHints ?? []),
    successCriteria: uniqueTrimmed(profile.successCriteria ?? []),
    blockedDirections: uniqueTrimmed(profile.blockedDirections ?? []),
    knownBaselines: uniqueTrimmed(profile.knownBaselines ?? []),
    evaluationPriorities: uniqueTrimmed(profile.evaluationPriorities ?? []),
    shortTermValidationTargets: uniqueTrimmed(profile.shortTermValidationTargets ?? []),
    priority: profile.priority ?? "secondary",
    enabled: profile.enabled ?? true,
    ...(trimOptionalText(profile.createdAt) ? { createdAt: trimOptionalText(profile.createdAt) } : {}),
  };
}

function snapshotFromProfile(profile: ResearchDirectionProfile): ResearchEvolutionCandidateDirectionSnapshot {
  return snapshotDirectionProfile({
    directionId: profile.id,
    label: profile.label,
    summary: profile.summary,
    tlDr: profile.tlDr,
    abstract: profile.abstract,
    background: profile.background,
    targetProblem: profile.targetProblem,
    subDirections: profile.subDirections,
    excludedTopics: profile.excludedTopics,
    preferredVenues: profile.preferredVenues,
    preferredDatasets: profile.preferredDatasets,
    preferredBenchmarks: profile.preferredBenchmarks,
    preferredPaperStyles: profile.preferredPaperStyles,
    openQuestions: profile.openQuestions,
    currentGoals: profile.currentGoals,
    queryHints: profile.queryHints,
    successCriteria: profile.successCriteria,
    blockedDirections: profile.blockedDirections,
    knownBaselines: profile.knownBaselines,
    evaluationPriorities: profile.evaluationPriorities,
    shortTermValidationTargets: profile.shortTermValidationTargets,
    priority: profile.priority,
    enabled: profile.enabled,
    createdAt: profile.createdAt,
  });
}

function changedFields(
  before: ResearchEvolutionCandidateApplySnapshot | null,
  after: ResearchEvolutionCandidateApplySnapshot | null,
): string[] {
  const fields = [...new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])])] as Array<
    keyof ResearchEvolutionCandidateApplySnapshot
  >;
  return fields.filter((field) => {
    const beforeValue = before?.[field] ?? null;
    const afterValue = after?.[field] ?? null;
    return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
  });
}

function buildDirectionCandidateEvidence(report: ResearchDirectionReport): ResearchEvolutionCandidateEvidenceItem[] {
  return [
    ...report.representativePapers.map((paper) => ({
      kind: "paper" as const,
      summary: `${paper.title}: ${paper.reason}`,
      ...(paper.sourceUrl ? { sourceUrl: paper.sourceUrl } : {}),
    })),
    ...report.commonBaselines.slice(0, 4).map((baseline) => ({
      kind: "baseline" as const,
      summary: baseline,
    })),
    ...report.suggestedRoutes.slice(0, 4).map((route) => ({
      kind: "route" as const,
      summary: route,
    })),
    ...report.openProblems.slice(0, 3).map((problem) => ({
      kind: "problem" as const,
      summary: problem,
    })),
    ...report.supportingSignals.slice(0, 4).map((signal) => ({
      kind: "signal" as const,
      summary: signal,
    })),
  ].slice(0, 14);
}

function buildDirectionPresetPayload(
  report: ResearchDirectionReport,
  direction: ResearchDirectionProfile | null,
): ResearchDirectionPresetCandidate["payload"] {
  const evaluationPriorities = uniqueTrimmed([
    ...extractPrefixedValues(report.supportingSignals, "Metric:"),
    ...(direction?.evaluationPriorities ?? []),
  ]).slice(0, 8);

  const shortTermValidationTargets = uniqueTrimmed([
    ...extractPrefixedValues(report.suggestedRoutes, "Short-term validation:"),
    ...extractPrefixedValues(report.suggestedRoutes, "Validate against:"),
    ...(direction?.shortTermValidationTargets ?? []),
  ]).slice(0, 8);

  return {
    ...(report.directionId?.trim() ? { directionId: report.directionId.trim() } : {}),
    label: direction?.label ?? report.topic.trim(),
    summary:
      trimOptionalText(direction?.summary) ??
      trimOptionalText(firstSentence(report.overview)) ??
      `Preset candidate distilled from ${report.topic}.`,
    queryHints: uniqueTrimmed([
      ...(direction?.queryHints ?? []),
      report.topic,
      ...report.commonModules.slice(0, 3).map((item) => `${report.topic} ${item}`),
      ...report.commonBaselines.slice(0, 2).map((item) => `${report.topic} ${item}`),
    ]).slice(0, 10),
    knownBaselines: uniqueTrimmed([
      ...(direction?.knownBaselines ?? []),
      ...report.commonBaselines,
    ]).slice(0, 10),
    evaluationPriorities,
    currentGoals: uniqueTrimmed([
      ...(direction?.currentGoals ?? []),
      ...report.suggestedRoutes,
      ...report.openProblems.map((problem) => `Close evidence gap: ${problem.replace(/^Need evidence for:\s*/u, "").trim()}`),
    ]).slice(0, 10),
    shortTermValidationTargets,
    suggestedRoutes: uniqueTrimmed(report.suggestedRoutes).slice(0, 10),
    supportingSignals: uniqueTrimmed(report.supportingSignals).slice(0, 12),
  };
}

function buildDirectionTargetId(candidate: ResearchDirectionPresetCandidate): string {
  return candidate.payload.directionId?.trim() || slugify(candidate.payload.label) || `direction-${Date.now()}`;
}

function buildDirectionPatch(
  candidate: ResearchDirectionPresetCandidate,
  existing: ResearchDirectionProfile | null,
): ResearchDirectionProfileInput {
  return {
    ...(existing?.id ? { id: existing.id } : {}),
    ...(!existing?.id && candidate.payload.directionId?.trim() ? { id: candidate.payload.directionId.trim() } : {}),
    label: existing?.label ?? candidate.payload.label,
    ...(existing?.summary?.trim()
      ? {}
      : trimOptionalText(candidate.payload.summary)
        ? { summary: trimOptionalText(candidate.payload.summary) }
        : {}),
    queryHints: uniqueTrimmed([...(existing?.queryHints ?? []), ...candidate.payload.queryHints]),
    knownBaselines: uniqueTrimmed([...(existing?.knownBaselines ?? []), ...candidate.payload.knownBaselines]),
    evaluationPriorities: uniqueTrimmed([
      ...(existing?.evaluationPriorities ?? []),
      ...candidate.payload.evaluationPriorities,
    ]),
    currentGoals: uniqueTrimmed([...(existing?.currentGoals ?? []), ...candidate.payload.currentGoals]),
    shortTermValidationTargets: uniqueTrimmed([
      ...(existing?.shortTermValidationTargets ?? []),
      ...candidate.payload.shortTermValidationTargets,
    ]),
  };
}

function buildWorkspaceSkillCandidatePayload(asset: ModuleAsset): ResearchWorkspaceSkillCandidatePayload {
  const directoryName = slugify(asset.repo) || `skill-${Date.now()}`;
  const label = titleCase(asset.repo) || asset.repo;
  const relatedTools = uniqueTrimmed([
    "repo_analyze",
    "module_extract",
    asset.selectedPaths.some((item) => /eval|benchmark|test/iu.test(item)) ? "research_run" : undefined,
  ]);
  const prompt = [
    `Use this skill when the user asks about reusable implementation patterns, repo-grounded guidance, or baseline extraction related to ${asset.owner}/${asset.repo}.`,
    "",
    "- ground recommendations in the referenced module asset before generalizing",
    "- separate what is directly supported by the repo paths from inference",
    ...(asset.selectedPaths.length > 0
      ? [`- prefer these high-signal paths when relevant: ${asset.selectedPaths.slice(0, 5).join(", ")}`]
      : []),
    "- if the user needs fresher repository facts, combine this skill with repo_analyze or module_extract",
  ].join("\n");

  return {
    skillKey: `workspace:${directoryName}`,
    directoryName,
    label,
    description: `Repo-grounded guidance for ${asset.owner}/${asset.repo}.`,
    prompt,
    relatedTools,
    sourceRepoUrl: asset.repoUrl,
    selectedPaths: uniqueTrimmed(asset.selectedPaths),
    notes: uniqueTrimmed(asset.notes),
    referenceFiles: [GENERATED_SKILL_REFERENCE_FILE],
    homepage: asset.repoUrl,
    enabled: false,
  };
}

function buildWorkspaceSkillCandidateEvidence(asset: ModuleAsset): ResearchEvolutionCandidateEvidenceItem[] {
  return [
    {
      kind: "repo" as const,
      summary: `${asset.owner}/${asset.repo}`,
      sourceUrl: asset.repoUrl,
    },
    ...asset.selectedPaths.slice(0, 6).map((item) => ({
      kind: "module" as const,
      summary: item,
    })),
    ...asset.notes.slice(0, 6).map((note) => ({
      kind: "signal" as const,
      summary: note,
    })),
  ].slice(0, 12);
}

function renderWorkspaceSkillReferenceMarkdown(candidate: ResearchWorkspaceSkillCandidate): string {
  const payload = candidate.payload;
  const lines = [
    `# ${payload.label} Source`,
    "",
    `- Candidate id: ${candidate.id}`,
    `- Source asset id: ${candidate.sourceId}`,
    `- Repository: ${payload.sourceRepoUrl}`,
    `- Default enabled: ${String(payload.enabled)}`,
    "",
    "## Selected Paths",
    ...(payload.selectedPaths.length > 0 ? payload.selectedPaths.map((item) => `- ${item}`) : ["- (none captured)"]),
    "",
    "## Asset Notes",
    ...(payload.notes.length > 0 ? payload.notes.map((item) => `- ${item}`) : ["- (none captured)"]),
    "",
  ];

  return lines.join("\n");
}

function toDirectionProfileInput(
  snapshot: ResearchEvolutionCandidateDirectionSnapshot,
): ResearchDirectionProfileInput {
  return {
    id: snapshot.directionId,
    label: snapshot.label,
    ...(snapshot.summary?.trim() ? { summary: snapshot.summary.trim() } : {}),
    ...(snapshot.tlDr?.trim() ? { tlDr: snapshot.tlDr.trim() } : {}),
    ...(snapshot.abstract?.trim() ? { abstract: snapshot.abstract.trim() } : {}),
    ...(snapshot.background?.trim() ? { background: snapshot.background.trim() } : {}),
    ...(snapshot.targetProblem?.trim() ? { targetProblem: snapshot.targetProblem.trim() } : {}),
    subDirections: [...snapshot.subDirections],
    excludedTopics: [...snapshot.excludedTopics],
    preferredVenues: [...snapshot.preferredVenues],
    preferredDatasets: [...snapshot.preferredDatasets],
    preferredBenchmarks: [...snapshot.preferredBenchmarks],
    preferredPaperStyles: [...snapshot.preferredPaperStyles],
    openQuestions: [...snapshot.openQuestions],
    successCriteria: [...snapshot.successCriteria],
    blockedDirections: [...snapshot.blockedDirections],
    queryHints: [...snapshot.queryHints],
    knownBaselines: [...snapshot.knownBaselines],
    evaluationPriorities: [...snapshot.evaluationPriorities],
    currentGoals: [...snapshot.currentGoals],
    shortTermValidationTargets: [...snapshot.shortTermValidationTargets],
    priority: snapshot.priority,
    enabled: snapshot.enabled,
  };
}

function resolveStatusAfterRollback(candidate: ResearchEvolutionCandidate): ResearchEvolutionCandidate["status"] {
  return candidate.reviews[0]?.decision ?? "draft";
}

function isDirectionPresetCandidate(candidate: ResearchEvolutionCandidate): candidate is ResearchDirectionPresetCandidate {
  return candidate.candidateType === "direction-preset";
}

function isWorkspaceSkillCandidate(candidate: ResearchEvolutionCandidate): candidate is ResearchWorkspaceSkillCandidate {
  return candidate.candidateType === "workspace-skill";
}

export class ResearchEvolutionCandidateError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_STATE" | "INVALID_INPUT",
  ) {
    super(message);
    this.name = "ResearchEvolutionCandidateError";
  }
}

export class ResearchEvolutionCandidateService {
  private readonly storePath: string;
  private readonly directionService: ResearchDirectionService;
  private readonly directionReportService: ResearchDirectionReportService;
  private readonly moduleAssetService: ResearchModuleAssetService;
  private readonly skillRegistryService: SkillRegistryService;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.directionService = new ResearchDirectionService(workspaceDir);
    this.directionReportService = new ResearchDirectionReportService(workspaceDir);
    this.moduleAssetService = new ResearchModuleAssetService(workspaceDir);
    this.skillRegistryService = new SkillRegistryService(workspaceDir);
  }

  private async readStore(): Promise<ResearchEvolutionCandidateStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchEvolutionCandidateStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        candidates: Array.isArray(parsed.candidates)
          ? parsed.candidates
              .map((candidate) => normalizeStoredCandidate(candidate))
              .filter((candidate): candidate is ResearchEvolutionCandidate => Boolean(candidate))
          : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchEvolutionCandidateStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  private async readCandidateOrThrow(
    candidateId: string,
  ): Promise<{ store: ResearchEvolutionCandidateStore; candidate: ResearchEvolutionCandidate; index: number }> {
    const id = candidateId.trim();
    if (!id) {
      throw new ResearchEvolutionCandidateError("Candidate id is required.", "INVALID_INPUT");
    }

    const store = await this.readStore();
    const index = store.candidates.findIndex((candidate) => candidate.id === id);
    if (index < 0) {
      throw new ResearchEvolutionCandidateError("Evolution candidate not found.", "NOT_FOUND");
    }

    return {
      store,
      candidate: store.candidates[index] as ResearchEvolutionCandidate,
      index,
    };
  }

  async listRecent(
    limit = 20,
    status?: ResearchEvolutionCandidate["status"],
    candidateType?: ResearchEvolutionCandidate["candidateType"],
  ): Promise<ResearchEvolutionCandidate[]> {
    const store = await this.readStore();
    const normalizedStatus = status?.trim();
    const normalizedType = candidateType?.trim();
    const items = store.candidates.filter((candidate) => {
      if (normalizedStatus && candidate.status !== normalizedStatus) {
        return false;
      }
      if (normalizedType && candidate.candidateType !== normalizedType) {
        return false;
      }
      return true;
    });

    return items.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getCandidate(candidateId: string): Promise<ResearchEvolutionCandidate | null> {
    const id = candidateId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.candidates.find((candidate) => candidate.id === id) ?? null;
  }

  async generateDirectionPresetCandidateFromReport(reportId: string): Promise<ResearchDirectionPresetCandidate> {
    const report = await this.directionReportService.getReport(reportId);
    if (!report) {
      throw new ResearchEvolutionCandidateError("Direction report not found.", "NOT_FOUND");
    }

    const direction = report.directionId?.trim()
      ? await this.directionService.getProfile(report.directionId.trim())
      : null;
    const payload = buildDirectionPresetPayload(report, direction);
    const timestamp = nowIso();
    const candidate: ResearchDirectionPresetCandidate = {
      id: randomUUID(),
      candidateType: "direction-preset",
      sourceType: "direction-report",
      sourceId: report.id,
      title: `${payload.label} direction preset candidate`,
      status: "draft",
      payload,
      evidence: buildDirectionCandidateEvidence(report),
      reviews: [],
      applyHistory: [],
      rollbackHistory: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      candidates: [candidate, ...store.candidates].slice(0, MAX_CANDIDATES),
    });

    return candidate;
  }

  async generateWorkspaceSkillCandidateFromAsset(assetId: string): Promise<ResearchWorkspaceSkillCandidate> {
    const asset = await this.moduleAssetService.getAsset(assetId);
    if (!asset) {
      throw new ResearchEvolutionCandidateError("Module asset not found.", "NOT_FOUND");
    }

    const payload = buildWorkspaceSkillCandidatePayload(asset);
    const timestamp = nowIso();
    const candidate: ResearchWorkspaceSkillCandidate = {
      id: randomUUID(),
      candidateType: "workspace-skill",
      sourceType: "module-asset",
      sourceId: asset.id,
      title: `${payload.label} workspace skill candidate`,
      status: "draft",
      payload,
      evidence: buildWorkspaceSkillCandidateEvidence(asset),
      reviews: [],
      applyHistory: [],
      rollbackHistory: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      candidates: [candidate, ...store.candidates].slice(0, MAX_CANDIDATES),
    });

    return candidate;
  }

  async reviewCandidate(
    candidateId: string,
    input: {
      decision: ResearchEvolutionCandidateReviewDecision;
      reviewer?: string | undefined;
      notes?: string | undefined;
    },
  ): Promise<ResearchEvolutionCandidate> {
    const { store, candidate, index } = await this.readCandidateOrThrow(candidateId);
    if (candidate.status === "applied") {
      throw new ResearchEvolutionCandidateError("Applied candidates cannot be reviewed again.", "INVALID_STATE");
    }

    const record = {
      decision: input.decision,
      ...(trimOptionalText(input.reviewer) ? { reviewer: trimOptionalText(input.reviewer) } : {}),
      ...(trimOptionalText(input.notes) ? { notes: trimOptionalText(input.notes) } : {}),
      createdAt: nowIso(),
    };

    const updated: ResearchEvolutionCandidate = {
      ...candidate,
      status: input.decision,
      reviews: [record, ...candidate.reviews],
      updatedAt: nowIso(),
    };

    const nextCandidates = [...store.candidates];
    nextCandidates[index] = updated;
    await this.writeStore({
      ...store,
      candidates: nextCandidates,
    });

    return updated;
  }

  private async buildDirectionApplyOutcome(
    candidate: ResearchDirectionPresetCandidate,
    input: { dryRun?: boolean | undefined; reviewer?: string | undefined; notes?: string | undefined },
  ): Promise<ResearchEvolutionCandidateApplyOutcome> {
    const targetId = buildDirectionTargetId(candidate);
    const existing = await this.directionService.getProfile(targetId);
    const patch = buildDirectionPatch(candidate, existing);
    const before = existing ? snapshotFromProfile(existing) : null;
    const after = snapshotDirectionProfile({
      directionId: targetId,
      label: patch.label,
      summary: patch.summary ?? existing?.summary,
      tlDr: existing?.tlDr,
      abstract: existing?.abstract,
      background: existing?.background,
      targetProblem: existing?.targetProblem,
      subDirections: existing?.subDirections ?? [],
      excludedTopics: existing?.excludedTopics ?? [],
      preferredVenues: existing?.preferredVenues ?? [],
      preferredDatasets: existing?.preferredDatasets ?? [],
      preferredBenchmarks: existing?.preferredBenchmarks ?? [],
      preferredPaperStyles: existing?.preferredPaperStyles ?? [],
      openQuestions: existing?.openQuestions ?? [],
      currentGoals: patch.currentGoals ?? existing?.currentGoals ?? [],
      queryHints: patch.queryHints ?? existing?.queryHints ?? [],
      successCriteria: existing?.successCriteria ?? [],
      blockedDirections: existing?.blockedDirections ?? [],
      knownBaselines: patch.knownBaselines ?? existing?.knownBaselines ?? [],
      evaluationPriorities: patch.evaluationPriorities ?? existing?.evaluationPriorities ?? [],
      shortTermValidationTargets: patch.shortTermValidationTargets ?? existing?.shortTermValidationTargets ?? [],
      priority: existing?.priority ?? "secondary",
      enabled: existing?.enabled ?? true,
      createdAt: existing?.createdAt,
    });
    const result: ResearchEvolutionCandidateApplyRecord = {
      dryRun: input.dryRun ?? false,
      targetType: "research-direction",
      targetId,
      changedFields: changedFields(before, after),
      before,
      after,
      ...(trimOptionalText(input.reviewer) ? { reviewer: trimOptionalText(input.reviewer) } : {}),
      ...(trimOptionalText(input.notes) ? { notes: trimOptionalText(input.notes) } : {}),
      appliedAt: nowIso(),
    };

    if (input.dryRun) {
      return { candidate, result };
    }

    await this.directionService.upsertProfile(patch);
    return {
      candidate: {
        ...candidate,
        status: "applied",
        applyHistory: [result, ...candidate.applyHistory],
        rollbackHistory: [...candidate.rollbackHistory],
        updatedAt: nowIso(),
      },
      result,
    };
  }

  private async buildWorkspaceSkillApplyOutcome(
    candidate: ResearchWorkspaceSkillCandidate,
    input: { dryRun?: boolean | undefined; reviewer?: string | undefined; notes?: string | undefined },
  ): Promise<ResearchEvolutionCandidateApplyOutcome> {
    const target = this.skillRegistryService.resolveMaterializationTarget(
      candidate.payload.directoryName,
      candidate.payload.referenceFiles[0],
    );
    const existing = await this.skillRegistryService.getSkill(target.skillKey);
    const before = existing
      ? {
          skillKey: existing.id,
          directoryName: target.directoryName,
          label: existing.label,
          description: existing.instruction,
          relatedTools: [...existing.relatedTools],
          referencePaths: [...existing.referencePaths],
          ...(existing.homepage ? { homepage: existing.homepage } : {}),
          enabled: existing.status !== "disabled",
          skillFilePath: existing.filePath,
          configPath: target.configPath,
        }
      : null;
    const after = {
      skillKey: target.skillKey,
      directoryName: target.directoryName,
      label: candidate.payload.label,
      description: candidate.payload.description,
      relatedTools: [...candidate.payload.relatedTools],
      referencePaths: target.referenceFilePath ? [target.referenceFilePath] : [],
      ...(candidate.payload.homepage ? { homepage: candidate.payload.homepage } : {}),
      enabled: candidate.payload.enabled,
      skillFilePath: target.skillFilePath,
      configPath: target.configPath,
    };
    const result: ResearchEvolutionCandidateApplyRecord = {
      dryRun: input.dryRun ?? false,
      targetType: "workspace-skill",
      targetId: target.skillKey,
      changedFields: changedFields(before, after),
      before,
      after,
      ...(trimOptionalText(input.reviewer) ? { reviewer: trimOptionalText(input.reviewer) } : {}),
      ...(trimOptionalText(input.notes) ? { notes: trimOptionalText(input.notes) } : {}),
      appliedAt: nowIso(),
    };

    if (input.dryRun) {
      return { candidate, result };
    }

    if (existing) {
      throw new ResearchEvolutionCandidateError(
        `Workspace skill ${target.skillKey} already exists; refusing to overwrite it automatically.`,
        "INVALID_STATE",
      );
    }

    await this.skillRegistryService.materializeSkill({
      directoryName: candidate.payload.directoryName,
      label: candidate.payload.label,
      description: candidate.payload.description,
      prompt: candidate.payload.prompt,
      relatedTools: candidate.payload.relatedTools,
      referenceFileName: candidate.payload.referenceFiles[0],
      referenceContent: renderWorkspaceSkillReferenceMarkdown(candidate),
      ...(candidate.payload.homepage ? { homepage: candidate.payload.homepage } : {}),
      enabled: candidate.payload.enabled,
    });

    return {
      candidate: {
        ...candidate,
        status: "applied",
        applyHistory: [result, ...candidate.applyHistory],
        rollbackHistory: [...candidate.rollbackHistory],
        updatedAt: nowIso(),
      },
      result,
    };
  }

  async applyCandidate(
    candidateId: string,
    input: {
      dryRun?: boolean | undefined;
      reviewer?: string | undefined;
      notes?: string | undefined;
    } = {},
  ): Promise<ResearchEvolutionCandidateApplyOutcome> {
    const { store, candidate, index } = await this.readCandidateOrThrow(candidateId);
    const dryRun = input.dryRun ?? false;
    if (!dryRun && candidate.status === "applied") {
      throw new ResearchEvolutionCandidateError("Candidate has already been applied.", "INVALID_STATE");
    }
    if (!dryRun && candidate.status !== "approved") {
      throw new ResearchEvolutionCandidateError("Only approved candidates can be applied.", "INVALID_STATE");
    }

    const outcome = isDirectionPresetCandidate(candidate)
      ? await this.buildDirectionApplyOutcome(candidate, input)
      : await this.buildWorkspaceSkillApplyOutcome(candidate, input);

    if (dryRun) {
      return outcome;
    }

    const nextCandidates = [...store.candidates];
    nextCandidates[index] = outcome.candidate;
    await this.writeStore({
      ...store,
      candidates: nextCandidates,
    });

    return outcome;
  }

  private async rollbackDirectionCandidate(
    candidate: ResearchDirectionPresetCandidate,
    latestApply: ResearchEvolutionCandidateApplyRecord,
    input: { reviewer?: string | undefined; notes?: string | undefined },
  ): Promise<ResearchEvolutionCandidateRollbackOutcome> {
    const current = await this.directionService.getProfile(latestApply.targetId);
    const before = current ? snapshotFromProfile(current) : null;
    const previous = latestApply.before;

    if (previous === null) {
      await this.directionService.deleteProfile(latestApply.targetId);
    } else {
      const snapshot = previous as ResearchEvolutionCandidateDirectionSnapshot;
      await this.directionService.replaceProfile({
        id: snapshot.directionId,
        label: snapshot.label,
        ...(snapshot.summary?.trim() ? { summary: snapshot.summary.trim() } : {}),
        ...(snapshot.tlDr?.trim() ? { tlDr: snapshot.tlDr.trim() } : {}),
        ...(snapshot.abstract?.trim() ? { abstract: snapshot.abstract.trim() } : {}),
        ...(snapshot.background?.trim() ? { background: snapshot.background.trim() } : {}),
        ...(snapshot.targetProblem?.trim() ? { targetProblem: snapshot.targetProblem.trim() } : {}),
        subDirections: [...snapshot.subDirections],
        excludedTopics: [...snapshot.excludedTopics],
        preferredVenues: [...snapshot.preferredVenues],
        preferredDatasets: [...snapshot.preferredDatasets],
        preferredBenchmarks: [...snapshot.preferredBenchmarks],
        preferredPaperStyles: [...snapshot.preferredPaperStyles],
        openQuestions: [...snapshot.openQuestions],
        currentGoals: [...snapshot.currentGoals],
        queryHints: [...snapshot.queryHints],
        successCriteria: [...snapshot.successCriteria],
        blockedDirections: [...snapshot.blockedDirections],
        knownBaselines: [...snapshot.knownBaselines],
        evaluationPriorities: [...snapshot.evaluationPriorities],
        shortTermValidationTargets: [...snapshot.shortTermValidationTargets],
        priority: snapshot.priority,
        enabled: snapshot.enabled,
        createdAt: snapshot.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      });
    }

    const result = {
      targetType: "research-direction" as const,
      targetId: latestApply.targetId,
      changedFields: changedFields(before, previous),
      before,
      after: previous,
      revertedApplyAppliedAt: latestApply.appliedAt,
      ...(trimOptionalText(input.reviewer) ? { reviewer: trimOptionalText(input.reviewer) } : {}),
      ...(trimOptionalText(input.notes) ? { notes: trimOptionalText(input.notes) } : {}),
      rolledBackAt: nowIso(),
    };

    return {
      candidate: {
        ...candidate,
        status: resolveStatusAfterRollback(candidate),
        applyHistory: [...candidate.applyHistory],
        rollbackHistory: [result, ...candidate.rollbackHistory],
        updatedAt: nowIso(),
      },
      result,
    };
  }

  private async rollbackWorkspaceSkillCandidate(
    candidate: ResearchWorkspaceSkillCandidate,
    latestApply: ResearchEvolutionCandidateApplyRecord,
    input: { reviewer?: string | undefined; notes?: string | undefined },
  ): Promise<ResearchEvolutionCandidateRollbackOutcome> {
    const current = await this.skillRegistryService.getSkill(latestApply.targetId);
    const target = this.skillRegistryService.resolveMaterializationTarget(
      candidate.payload.directoryName,
      candidate.payload.referenceFiles[0],
    );
    const before = current
      ? {
          skillKey: current.id,
          directoryName: candidate.payload.directoryName,
          label: current.label,
          description: current.instruction,
          relatedTools: [...current.relatedTools],
          referencePaths: [...current.referencePaths],
          ...(current.homepage ? { homepage: current.homepage } : {}),
          enabled: current.status !== "disabled",
          skillFilePath: current.filePath,
          configPath: target.configPath,
        }
      : null;

    if (latestApply.before !== null) {
      throw new ResearchEvolutionCandidateError(
        "Rollback for pre-existing workspace skills is not supported by this controlled path.",
        "INVALID_STATE",
      );
    }

    await this.skillRegistryService.deleteSkill(latestApply.targetId);

    const result = {
      targetType: "workspace-skill" as const,
      targetId: latestApply.targetId,
      changedFields: changedFields(before, null),
      before,
      after: null,
      revertedApplyAppliedAt: latestApply.appliedAt,
      ...(trimOptionalText(input.reviewer) ? { reviewer: trimOptionalText(input.reviewer) } : {}),
      ...(trimOptionalText(input.notes) ? { notes: trimOptionalText(input.notes) } : {}),
      rolledBackAt: nowIso(),
    };

    return {
      candidate: {
        ...candidate,
        status: resolveStatusAfterRollback(candidate),
        applyHistory: [...candidate.applyHistory],
        rollbackHistory: [result, ...candidate.rollbackHistory],
        updatedAt: nowIso(),
      },
      result,
    };
  }

  async rollbackCandidate(
    candidateId: string,
    input: {
      reviewer?: string | undefined;
      notes?: string | undefined;
    } = {},
  ): Promise<ResearchEvolutionCandidateRollbackOutcome> {
    const { store, candidate, index } = await this.readCandidateOrThrow(candidateId);
    if (candidate.status !== "applied") {
      throw new ResearchEvolutionCandidateError("Only applied candidates can be rolled back.", "INVALID_STATE");
    }

    const latestApply = candidate.applyHistory[0];
    if (!latestApply) {
      throw new ResearchEvolutionCandidateError("Candidate has no apply history to roll back.", "INVALID_STATE");
    }

    const outcome = isDirectionPresetCandidate(candidate)
      ? await this.rollbackDirectionCandidate(candidate, latestApply, input)
      : await this.rollbackWorkspaceSkillCandidate(candidate, latestApply, input);

    const nextCandidates = [...store.candidates];
    nextCandidates[index] = outcome.candidate;
    await this.writeStore({
      ...store,
      candidates: nextCandidates,
    });

    return outcome;
  }
}
