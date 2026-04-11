import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResearchReport, ResearchRequest } from "../types/research.js";
import type {
  ResearchTaskHandoff,
  ResearchTaskHandoffArtifactRef,
  ResearchTaskReviewStatus,
  ResearchTaskState,
  ResearchTaskWorkstream,
  ResearchTaskWorkstreamId,
} from "../types/researchTask.js";

interface ResearchRoundArtifactStore {
  updatedAt: string;
  items: ResearchTaskHandoffArtifactRef[];
}

interface ResearchRoundWorkstreamEvent {
  workstreamId: ResearchTaskWorkstreamId;
  state: ResearchTaskState;
  progress: number;
  at: string;
  message: string;
}

interface ResearchRoundWorkstreamEventStore {
  updatedAt: string;
  items: ResearchRoundWorkstreamEvent[];
}

interface ResearchRoundManifest {
  taskId: string;
  topic: string;
  question?: string | undefined;
  request?: ResearchRequest | undefined;
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
  workstreamDir: string;
  workstreamEventsFsPath: string;
  workstreamEventsPath: string;
  workstreamPaths: Record<ResearchTaskWorkstreamId, string>;
  workstreamFsPaths: Record<ResearchTaskWorkstreamId, string>;
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

function deriveActiveWorkstreamId(
  state: ResearchTaskState,
  progress: number,
): ResearchTaskWorkstreamId | undefined {
  switch (state) {
    case "queued":
    case "planning":
    case "fetching":
    case "normalizing":
    case "searching-paper":
      return "search";
    case "downloading-paper":
    case "parsing":
    case "analyzing-paper":
    case "checking-repo":
    case "extracting-module":
      return "reading";
    case "generating-summary":
    case "generating-ppt":
    case "persisting":
      return "synthesis";
    case "failed":
      return progress < 40 ? "search" : progress < 80 ? "reading" : "synthesis";
    case "completed":
    default:
      return undefined;
  }
}

function deriveEventWorkstreamId(
  state: ResearchTaskState,
  progress: number,
): ResearchTaskWorkstreamId | undefined {
  if (state === "completed") {
    return "synthesis";
  }

  return deriveActiveWorkstreamId(state, progress);
}

function buildWorkstreams(
  state: ResearchTaskState,
  progress: number,
  reviewStatus: ResearchTaskReviewStatus,
): ResearchTaskWorkstream[] {
  const active = deriveActiveWorkstreamId(state, progress);

  const searchStatus =
    state === "completed"
      ? "completed"
      : active === "search"
        ? state === "failed"
          ? "blocked"
          : "in_progress"
        : ["reading", "synthesis"].includes(active ?? "")
          ? "completed"
          : "pending";
  const readingStatus =
    state === "completed"
      ? "completed"
      : active === "reading"
        ? state === "failed"
          ? "blocked"
          : "in_progress"
        : active === "synthesis"
          ? "completed"
          : active === "search"
            ? "pending"
            : "pending";
  const synthesisStatus =
    state === "completed"
      ? reviewStatus === "needs-review"
        ? "blocked"
        : "completed"
      : active === "synthesis"
        ? state === "failed"
          ? "blocked"
          : "in_progress"
        : "pending";

  return [
    {
      id: "search",
      label: "Search",
      status: searchStatus,
      summary:
        searchStatus === "completed"
          ? "Candidate retrieval and ranking have been completed for this round."
          : searchStatus === "in_progress"
            ? "Discovery, retrieval quality, and candidate ranking are the active focus."
            : searchStatus === "blocked"
              ? "Search work is blocked and needs operator review before continuing."
              : "Search has not started yet for this round.",
      nextStep:
        searchStatus === "completed"
          ? "Reuse the saved candidate set and move into deeper paper/repo reading."
          : "Inspect retrieval quality, candidate breadth, and ranking reasons.",
    },
    {
      id: "reading",
      label: "Reading",
      status: readingStatus,
      summary:
        readingStatus === "completed"
          ? "Paper content, repo evidence, and reusable module signals are captured."
          : readingStatus === "in_progress"
            ? "The round is consolidating paper text, repo evidence, and implementation signals."
            : readingStatus === "blocked"
              ? "Reading and evidence consolidation need review before synthesis can continue."
              : "Reading and evidence extraction have not started yet.",
      nextStep:
        readingStatus === "completed"
          ? "Review evidence coverage and then hand off to synthesis."
          : "Validate content extraction quality and evidence coverage before synthesis.",
    },
    {
      id: "synthesis",
      label: "Synthesis",
      status: synthesisStatus,
      summary:
        synthesisStatus === "completed"
          ? reviewStatus === "needs-review"
            ? "A synthesis exists, but it still needs operator review."
            : "The final synthesis and deliverables are complete for this round."
          : synthesisStatus === "in_progress"
            ? "The round is generating the final synthesis, review, or delivery artifacts."
            : synthesisStatus === "blocked"
              ? "Synthesis is blocked and needs operator review or a retry."
              : "Synthesis has not started yet.",
      nextStep:
        synthesisStatus === "completed"
          ? reviewStatus === "needs-review"
            ? "Open review.md, address critique items, and decide whether a retry is needed."
            : "Reuse the report or continue with the next research direction."
          : "Review the brief, evidence, and current draft before finalizing delivery.",
    },
  ];
}

function workstreamTitle(workstream: ResearchTaskWorkstream): string {
  return `${workstream.label} workstream`;
}

function defaultWorkstreamEventStore(): ResearchRoundWorkstreamEventStore {
  return {
    updatedAt: nowIso(),
    items: [],
  };
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

  async getWorkstreamMemo(
    taskId: string,
    workstreamId: ResearchTaskWorkstreamId,
  ): Promise<{
    workstreamId: ResearchTaskWorkstreamId;
    path: string;
    content: string;
  } | null> {
    try {
      const paths = this.buildPaths(taskId);
      const content = await readFile(paths.workstreamFsPaths[workstreamId], "utf8");
      return {
        workstreamId,
        path: paths.workstreamPaths[workstreamId],
        content,
      };
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
      request: input.request,
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
    const initialWorkstreamId = deriveActiveWorkstreamId("queued", input.progress) ?? "search";
    await this.writeJson(paths.workstreamEventsFsPath, {
      updatedAt: input.createdAt,
      items: [
        {
          workstreamId: initialWorkstreamId,
          state: "queued",
          progress: input.progress,
          at: input.createdAt,
          message: manifest.currentMessage ?? "Task queued.",
        },
      ],
    } satisfies ResearchRoundWorkstreamEventStore);
    await writeFile(paths.briefFsPath, this.buildBriefMarkdown(input), "utf8");
    await writeFile(
      paths.progressLogFsPath,
      `# Progress Log\n\n- [${formatTimestamp(input.createdAt)}] \`queued\` (${input.progress}%) ${manifest.currentMessage}\n`,
      "utf8",
    );
    await this.writeManifestArtifactsAndHandoff(manifest);
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

    const workstreamId = deriveEventWorkstreamId(input.state, input.progress);
    if (workstreamId) {
      await this.appendWorkstreamEvent(input.taskId, {
        workstreamId,
        state: input.state,
        progress: input.progress,
        at: updatedAt,
        message: input.message?.trim() || manifest.currentMessage || "State updated.",
      });
    }

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
    const workstreamDir = path.join(roundDir, "workstreams");
    const workstreamEventsFsPath = path.join(workstreamDir, "events.json");
    const workstreamFsPaths = {
      search: path.join(workstreamDir, "search.md"),
      reading: path.join(workstreamDir, "reading.md"),
      synthesis: path.join(workstreamDir, "synthesis.md"),
    } satisfies Record<ResearchTaskWorkstreamId, string>;
    const workstreamPaths = {
      search: toPosixPath(path.relative(this.workspaceDir, workstreamFsPaths.search)),
      reading: toPosixPath(path.relative(this.workspaceDir, workstreamFsPaths.reading)),
      synthesis: toPosixPath(path.relative(this.workspaceDir, workstreamFsPaths.synthesis)),
    } satisfies Record<ResearchTaskWorkstreamId, string>;

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
      workstreamDir,
      workstreamEventsFsPath,
      workstreamEventsPath: toPosixPath(path.relative(this.workspaceDir, workstreamEventsFsPath)),
      workstreamPaths,
      workstreamFsPaths,
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
    const paths = this.buildPaths(manifest.taskId);
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
      ...(deriveActiveWorkstreamId(manifest.state, manifest.progress)
        ? { activeWorkstreamId: deriveActiveWorkstreamId(manifest.state, manifest.progress) }
        : {}),
      workstreams: buildWorkstreams(manifest.state, manifest.progress, manifest.reviewStatus),
      workstreamPaths: paths.workstreamPaths,
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

  private buildWorkstreamMarkdown(input: {
    manifest: ResearchRoundManifest;
    handoff: ResearchTaskHandoff;
    workstream: ResearchTaskWorkstream;
    events: ResearchRoundWorkstreamEvent[];
    report?: ResearchReport | null;
  }): string {
    const { manifest, handoff, workstream, events, report } = input;
    const reportContext =
      workstream.id === "search" && report
        ? [
            "",
            "## Search Context",
            ...(report.plan.searchQueries.length > 0
              ? [`- Queries: ${report.plan.searchQueries.join(", ")}`]
              : ["- Queries: none recorded."]),
            ...(report.papers.length > 0
              ? [
                  "- Top candidates:",
                  ...report.papers.slice(0, 5).map((paper) => `  - ${paper.title}`),
                ]
              : ["- Top candidates: none recorded."]),
          ]
        : workstream.id === "reading" && report
          ? [
              "",
              "## Reading Context",
              `- Paper candidates: ${report.papers.length}`,
              `- Evidence items: ${report.evidence.length}`,
              ...(report.findings.length > 0
                ? [
                    "- Early findings:",
                    ...report.findings.slice(0, 3).map((finding) => `  - ${finding}`),
                  ]
                : ["- Early findings: none recorded."]),
            ]
          : workstream.id === "synthesis" && report
            ? [
                "",
                "## Synthesis Context",
                `- Summary: ${clipText(report.summary, 220)}`,
                ...(report.nextActions.length > 0
                  ? [
                      "- Next actions:",
                      ...report.nextActions.slice(0, 4).map((action) => `  - ${action}`),
                    ]
                  : ["- Next actions: none recorded."]),
                `- Critique verdict: ${report.critique.verdict}`,
              ]
            : [];
    const lines = [
      `# ${workstream.label} Workstream`,
      "",
      "## Round",
      `- Task ID: ${manifest.taskId}`,
      `- Topic: ${manifest.topic}`,
      ...(manifest.question?.trim() ? [`- Question: ${manifest.question.trim()}`] : []),
      `- Updated At: ${manifest.updatedAt}`,
      `- Round State: ${manifest.state}`,
      `- Workstream Status: ${workstream.status}`,
      ...(handoff.activeWorkstreamId === workstream.id ? ["- Active: yes"] : ["- Active: no"]),
      "",
      "## Summary",
      workstream.summary,
      "",
      "## Next Step",
      workstream.nextStep,
      "",
      "## Coordination",
      `- Recommended action: ${handoff.nextRecommendedAction}`,
      ...(handoff.blockers.length > 0 ? handoff.blockers.map((blocker) => `- Blocker: ${blocker}`) : ["- Blocker: none"]),
      ...reportContext,
      "",
      "## Recent Events",
      ...(events.length > 0
        ? events
            .slice(-6)
            .map((event) => `- [${formatTimestamp(event.at)}] \`${event.state}\` (${event.progress}%) ${event.message}`)
        : ["- No workstream events recorded yet."]),
      "",
      "## Round Artifacts",
      ...(handoff.artifacts.length > 0
        ? handoff.artifacts
            .filter((artifact) => artifact.kind !== "workstream")
            .map((artifact) => `- ${artifact.kind}: ${artifact.title} (${artifact.path})`)
        : ["- No saved artifacts yet."]),
    ];

    return `${lines.join("\n").trim()}\n`;
  }

  private withWorkstreamArtifacts(
    manifest: ResearchRoundManifest,
    handoff: ResearchTaskHandoff,
  ): ResearchRoundManifest {
    const paths = this.buildPaths(manifest.taskId);
    const nextArtifacts = handoff.workstreams.reduce((artifacts, workstream) =>
      upsertArtifact(artifacts, {
        kind: "workstream",
        id: workstream.id,
        title: workstreamTitle(workstream),
        path: paths.workstreamPaths[workstream.id],
        createdAt: manifest.updatedAt,
        notes: [
          `Status: ${workstream.status}`,
          `Summary: ${clipText(workstream.summary, 140)}`,
          `Next: ${clipText(workstream.nextStep, 140)}`,
        ],
      }), manifest.artifacts);

    return {
      ...manifest,
      artifacts: nextArtifacts,
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

  private async readReport(taskId: string): Promise<ResearchReport | null> {
    try {
      const raw = await readFile(this.buildPaths(taskId).reportFsPath, "utf8");
      return JSON.parse(raw) as ResearchReport;
    } catch {
      return null;
    }
  }

  private async readWorkstreamEventStore(taskId: string): Promise<ResearchRoundWorkstreamEventStore> {
    try {
      const raw = await readFile(this.buildPaths(taskId).workstreamEventsFsPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchRoundWorkstreamEventStore>;
      return {
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
        items: Array.isArray(parsed.items)
          ? parsed.items.filter(
              (item): item is ResearchRoundWorkstreamEvent =>
                Boolean(item) &&
                typeof item === "object" &&
                (item.workstreamId === "search" || item.workstreamId === "reading" || item.workstreamId === "synthesis") &&
                typeof item.state === "string" &&
                typeof item.progress === "number" &&
                typeof item.at === "string" &&
                typeof item.message === "string",
            )
          : [],
      };
    } catch {
      return defaultWorkstreamEventStore();
    }
  }

  private async appendWorkstreamEvent(taskId: string, event: ResearchRoundWorkstreamEvent): Promise<void> {
    const paths = this.buildPaths(taskId);
    const current = await this.readWorkstreamEventStore(taskId);
    await this.writeJson(paths.workstreamEventsFsPath, {
      updatedAt: event.at,
      items: [...current.items, event].slice(-60),
    } satisfies ResearchRoundWorkstreamEventStore);
  }

  private async writeManifestArtifactsAndHandoff(manifest: ResearchRoundManifest): Promise<void> {
    const paths = this.buildPaths(manifest.taskId);
    const initialHandoff = this.buildHandoff(manifest);
    const nextManifest = this.withWorkstreamArtifacts(manifest, initialHandoff);
    const nextHandoff = this.buildHandoff(nextManifest);
    const workstreamEventStore = await this.readWorkstreamEventStore(manifest.taskId);
    const report = await this.readReport(manifest.taskId);

    await mkdir(paths.workstreamDir, { recursive: true });
    for (const workstream of nextHandoff.workstreams) {
      await writeFile(
        paths.workstreamFsPaths[workstream.id],
        this.buildWorkstreamMarkdown({
          manifest: nextManifest,
          handoff: nextHandoff,
          workstream,
          events: workstreamEventStore.items.filter((event) => event.workstreamId === workstream.id),
          report,
        }),
        "utf8",
      );
    }

    await this.writeJson(paths.manifestFsPath, nextManifest);
    await this.writeJson(paths.artifactsFsPath, {
      updatedAt: nextManifest.updatedAt,
      items: nextManifest.artifacts,
    } satisfies ResearchRoundArtifactStore);
    await this.writeJson(paths.handoffFsPath, nextHandoff);
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
