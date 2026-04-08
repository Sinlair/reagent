import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchReport, ResearchRequest } from "../types/research.js";
import type {
  ResearchTaskHandoff,
  ResearchTaskHandoffArtifactRef,
  ResearchTaskReviewStatus,
  ResearchTaskState,
} from "../types/researchTask.js";

interface ResearchRoundArtifactStore {
  updatedAt: string;
  items: ResearchTaskHandoffArtifactRef[];
}

interface ResearchRoundManifest {
  taskId: string;
  topic: string;
  question?: string | undefined;
  createdAt: string;
  updatedAt: string;
  attempt: number;
  sourceTaskId?: string | undefined;
  state: ResearchTaskState;
  progress: number;
  currentMessage?: string | undefined;
  reviewStatus: ResearchTaskReviewStatus;
  roundPath: string;
  briefPath: string;
  progressLogPath: string;
  handoffPath: string;
  artifactsPath: string;
  reportPath?: string | undefined;
  reviewPath?: string | undefined;
  artifacts: ResearchTaskHandoffArtifactRef[];
}

interface ResearchRoundPaths {
  roundDir: string;
  roundPath: string;
  manifestFsPath: string;
  briefFsPath: string;
  briefPath: string;
  progressLogFsPath: string;
  progressLogPath: string;
  handoffFsPath: string;
  handoffPath: string;
  artifactsFsPath: string;
  artifactsPath: string;
  reportFsPath: string;
  reportPath: string;
  reviewFsPath: string;
  reviewPath: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPosixPath(value: string): string {
  return value.replace(/[\\]+/gu, "/");
}

function formatTimestamp(value: string): string {
  return value.slice(0, 19).replace("T", " ");
}

function clipText(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength);
  const end = boundary > Math.floor(maxLength / 2) ? boundary : maxLength;
  return `${normalized.slice(0, end).trimEnd()}...`;
}

function upsertArtifact(
  artifacts: ResearchTaskHandoffArtifactRef[],
  nextArtifact: ResearchTaskHandoffArtifactRef,
): ResearchTaskHandoffArtifactRef[] {
  const key = `${nextArtifact.kind}:${nextArtifact.id}`;
  const byKey = new Map<string, ResearchTaskHandoffArtifactRef>(
    artifacts.map((artifact) => [`${artifact.kind}:${artifact.id}`, artifact]),
  );
  byKey.set(key, nextArtifact);
  return [...byKey.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function reviewStatusFromReport(report: ResearchReport): ResearchTaskReviewStatus {
  return report.critique.verdict === "weak" ? "needs-review" : "passed";
}

function nextRecommendedAction(
  state: ResearchTaskState,
  reviewStatus: ResearchTaskReviewStatus,
): string {
  switch (state) {
    case "queued":
      return "Planning has not started yet. Resume from the brief and build the research plan.";
    case "planning":
      return "Wait for the research plan, then review whether the search queries match the brief.";
    case "fetching":
    case "normalizing":
    case "searching-paper":
      return "Inspect candidate retrieval quality before investing in deeper analysis.";
    case "downloading-paper":
    case "parsing":
      return "Wait for paper content extraction, then verify that evidence spans are usable.";
    case "analyzing-paper":
      return "Review evidence coverage and paper signals before final synthesis.";
    case "checking-repo":
      return "Inspect repository evidence and decide whether an implementation path is credible.";
    case "extracting-module":
      return "Capture reusable modules or implementation patterns before synthesis finishes.";
    case "generating-summary":
      return "Review the synthesis draft against the brief and evidence coverage.";
    case "generating-ppt":
      return "Review delivery framing before exporting presentation assets.";
    case "persisting":
      return "Persist the final report snapshot and verify the round artifact index.";
    case "completed":
      return reviewStatus === "needs-review"
        ? "Open review.md, address the critique, then decide whether this round needs a retry."
        : "Reuse the saved report artifact or continue the next research step from this dossier.";
    case "failed":
      return "Inspect blockers in handoff.json, then retry with a revised brief or environment.";
    default:
      return "Review the latest handoff before continuing this round.";
  }
}

function buildReviewMarkdown(report: ResearchReport): string {
  const critique = report.critique;
  const lines = [
    `# Review For ${report.topic}`,
    "",
    "## Verdict",
    `- Verdict: ${critique.verdict}`,
    `- Summary: ${critique.summary}`,
    `- Citation Coverage: ${critique.citationCoverage}`,
    `- Citation Diversity: ${critique.citationDiversity}`,
    `- Unsupported Evidence Count: ${critique.unsupportedEvidenceCount}`,
    "",
    ...(critique.issues.length > 0
      ? ["## Issues", ...critique.issues.map((issue) => `- ${issue}`), ""]
      : ["## Issues", "- No critique issues were recorded.", ""]),
    ...(critique.recommendations.length > 0
      ? ["## Recommended Fixes", ...critique.recommendations.map((item) => `- ${item}`), ""]
      : []),
  ];

  return `${lines.join("\n").trim()}\n`;
}

export class ResearchRoundService {
  constructor(private readonly workspaceDir: string) {}

  async getHandoff(taskId: string): Promise<ResearchTaskHandoff | null> {
    try {
      const raw = await readFile(this.buildPaths(taskId).handoffFsPath, "utf8");
      return JSON.parse(raw) as ResearchTaskHandoff;
    } catch {
      return null;
    }
  }

  getRoundPointers(taskId: string): { roundPath: string; handoffPath: string } {
    const paths = this.buildPaths(taskId);
    return {
      roundPath: paths.roundPath,
      handoffPath: paths.handoffPath,
    };
  }

  async createRound(input: {
    taskId: string;
    topic: string;
    question?: string | undefined;
    request: ResearchRequest;
    attempt: number;
    sourceTaskId?: string | undefined;
    createdAt: string;
    progress: number;
    message?: string | undefined;
  }): Promise<void> {
    const paths = this.buildPaths(input.taskId);
    await mkdir(paths.roundDir, { recursive: true });

    const manifest: ResearchRoundManifest = {
      taskId: input.taskId,
      topic: input.topic,
      ...(input.question?.trim() ? { question: input.question.trim() } : {}),
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      attempt: input.attempt,
      ...(input.sourceTaskId ? { sourceTaskId: input.sourceTaskId } : {}),
      state: "queued",
      progress: input.progress,
      currentMessage: input.message?.trim() || "Task queued.",
      reviewStatus: "pending",
      roundPath: paths.roundPath,
      briefPath: paths.briefPath,
      progressLogPath: paths.progressLogPath,
      handoffPath: paths.handoffPath,
      artifactsPath: paths.artifactsPath,
      artifacts: [],
    };

    await this.writeJson(paths.manifestFsPath, manifest);
    await this.writeJson(paths.artifactsFsPath, {
      updatedAt: input.createdAt,
      items: [],
    } satisfies ResearchRoundArtifactStore);
    await writeFile(paths.briefFsPath, this.buildBriefMarkdown(input), "utf8");
    await writeFile(
      paths.progressLogFsPath,
      `# Progress Log\n\n- [${formatTimestamp(input.createdAt)}] \`queued\` (${input.progress}%) ${manifest.currentMessage}\n`,
      "utf8",
    );
    await this.writeJson(paths.handoffFsPath, this.buildHandoff(manifest));
  }

  async deleteRound(taskId: string): Promise<void> {
    await rm(this.buildPaths(taskId).roundDir, { recursive: true, force: true });
  }

  async recordTaskProgress(input: {
    taskId: string;
    state: ResearchTaskState;
    progress: number;
    message?: string | undefined;
    reviewStatus?: ResearchTaskReviewStatus | undefined;
  }): Promise<void> {
    const manifest = await this.readManifest(input.taskId);
    if (!manifest) {
      return;
    }

    const updatedAt = nowIso();
    const nextManifest: ResearchRoundManifest = {
      ...manifest,
      state: input.state,
      progress: input.progress,
      updatedAt,
      ...(input.message?.trim() ? { currentMessage: input.message.trim() } : {}),
      ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
    };

    await this.writeManifestArtifactsAndHandoff(nextManifest);
    await this.appendProgressEntry(
      this.buildPaths(input.taskId).progressLogFsPath,
      updatedAt,
      input.state,
      input.progress,
      input.message?.trim() || manifest.currentMessage || "State updated.",
    );
  }

  async finalizeReport(taskId: string, report: ResearchReport): Promise<ResearchTaskReviewStatus> {
    const manifest = await this.readManifest(taskId);
    if (!manifest) {
      return reviewStatusFromReport(report);
    }

    const paths = this.buildPaths(taskId);
    const reportGeneratedAt = report.generatedAt?.trim() || nowIso();
    const reviewStatus = reviewStatusFromReport(report);
    const reviewMarkdown = buildReviewMarkdown(report);

    await writeFile(paths.reportFsPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(paths.reviewFsPath, reviewMarkdown, "utf8");

    const withArtifacts = upsertArtifact(
      upsertArtifact(manifest.artifacts, {
        kind: "report",
        id: taskId,
        title: `${report.topic} report`,
        path: paths.reportPath,
        createdAt: reportGeneratedAt,
        notes: [
          `Summary: ${clipText(report.summary, 160)}`,
          `Critique verdict: ${report.critique.verdict}`,
        ],
      }),
      {
        kind: "review",
        id: taskId,
        title: `${report.topic} review`,
        path: paths.reviewPath,
        createdAt: reportGeneratedAt,
        notes:
          report.critique.issues.length > 0
            ? report.critique.issues.slice(0, 3)
            : ["No critique issues were recorded."],
      },
    );

    const nextManifest: ResearchRoundManifest = {
      ...manifest,
      updatedAt: nowIso(),
      reviewStatus,
      reportPath: paths.reportPath,
      reviewPath: paths.reviewPath,
      artifacts: withArtifacts,
    };

    await this.writeManifestArtifactsAndHandoff(nextManifest);
    return reviewStatus;
  }

  private buildPaths(taskId: string): ResearchRoundPaths {
    const roundDir = path.join(this.workspaceDir, "research", "rounds", taskId);
    const roundPath = toPosixPath(path.relative(this.workspaceDir, roundDir));
    const manifestFsPath = path.join(roundDir, "round.json");
    const briefFsPath = path.join(roundDir, "brief.md");
    const progressLogFsPath = path.join(roundDir, "progress-log.md");
    const handoffFsPath = path.join(roundDir, "handoff.json");
    const artifactsFsPath = path.join(roundDir, "artifacts.json");
    const reportFsPath = path.join(roundDir, "report.json");
    const reviewFsPath = path.join(roundDir, "review.md");

    return {
      roundDir,
      roundPath,
      manifestFsPath,
      briefFsPath,
      briefPath: toPosixPath(path.relative(this.workspaceDir, briefFsPath)),
      progressLogFsPath,
      progressLogPath: toPosixPath(path.relative(this.workspaceDir, progressLogFsPath)),
      handoffFsPath,
      handoffPath: toPosixPath(path.relative(this.workspaceDir, handoffFsPath)),
      artifactsFsPath,
      artifactsPath: toPosixPath(path.relative(this.workspaceDir, artifactsFsPath)),
      reportFsPath,
      reportPath: toPosixPath(path.relative(this.workspaceDir, reportFsPath)),
      reviewFsPath,
      reviewPath: toPosixPath(path.relative(this.workspaceDir, reviewFsPath)),
    };
  }

  private buildBriefMarkdown(input: {
    taskId: string;
    topic: string;
    question?: string | undefined;
    request: ResearchRequest;
    attempt: number;
    sourceTaskId?: string | undefined;
    createdAt: string;
  }): string {
    const lines = [
      `# Research Round ${input.taskId}`,
      "",
      "## Task",
      `- Topic: ${input.topic}`,
      ...(input.question?.trim() ? [`- Question: ${input.question.trim()}`] : []),
      `- Attempt: ${input.attempt}`,
      `- Created At: ${input.createdAt}`,
      ...(input.sourceTaskId ? [`- Source Task: ${input.sourceTaskId}`] : []),
      "",
      "## Request",
      `- Topic: ${input.request.topic}`,
      ...(input.request.question?.trim() ? [`- Question: ${input.request.question.trim()}`] : []),
      ...(input.request.maxPapers ? [`- Max Papers: ${input.request.maxPapers}`] : []),
      "",
      "## Notes",
      "- This dossier is the durable coordination layer for the round.",
      "- Inspect handoff.json for the current next step.",
      "- Inspect progress-log.md for the task timeline.",
    ];

    return `${lines.join("\n").trim()}\n`;
  }

  private buildHandoff(manifest: ResearchRoundManifest): ResearchTaskHandoff {
    const blockers =
      manifest.state === "failed" && manifest.currentMessage?.trim()
        ? [manifest.currentMessage.trim()]
        : [];

    return {
      taskId: manifest.taskId,
      topic: manifest.topic,
      ...(manifest.question?.trim() ? { question: manifest.question.trim() } : {}),
      updatedAt: manifest.updatedAt,
      state: manifest.state,
      progress: manifest.progress,
      ...(manifest.currentMessage?.trim() ? { currentMessage: manifest.currentMessage.trim() } : {}),
      reviewStatus: manifest.reviewStatus,
      nextRecommendedAction: nextRecommendedAction(manifest.state, manifest.reviewStatus),
      blockers,
      artifacts: manifest.artifacts,
      roundPath: manifest.roundPath,
      briefPath: manifest.briefPath,
      progressLogPath: manifest.progressLogPath,
      handoffPath: manifest.handoffPath,
      artifactsPath: manifest.artifactsPath,
      ...(manifest.reportPath ? { reportPath: manifest.reportPath } : {}),
      ...(manifest.reviewPath ? { reviewPath: manifest.reviewPath } : {}),
    };
  }

  private async appendProgressEntry(
    progressLogFsPath: string,
    timestamp: string,
    state: ResearchTaskState,
    progress: number,
    message: string,
  ): Promise<void> {
    let existing = "";
    try {
      existing = await readFile(progressLogFsPath, "utf8");
    } catch {
      existing = "# Progress Log\n\n";
    }

    const separator = existing.endsWith("\n") ? "" : "\n";
    const entry = `- [${formatTimestamp(timestamp)}] \`${state}\` (${progress}%) ${message.trim()}\n`;
    await writeFile(progressLogFsPath, `${existing}${separator}${entry}`, "utf8");
  }

  private async readManifest(taskId: string): Promise<ResearchRoundManifest | null> {
    try {
      const raw = await readFile(this.buildPaths(taskId).manifestFsPath, "utf8");
      return JSON.parse(raw) as ResearchRoundManifest;
    } catch {
      return null;
    }
  }

  private async writeManifestArtifactsAndHandoff(manifest: ResearchRoundManifest): Promise<void> {
    const paths = this.buildPaths(manifest.taskId);
    await this.writeJson(paths.manifestFsPath, manifest);
    await this.writeJson(paths.artifactsFsPath, {
      updatedAt: manifest.updatedAt,
      items: manifest.artifacts,
    } satisfies ResearchRoundArtifactStore);
    await this.writeJson(paths.handoffFsPath, this.buildHandoff(manifest));
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
