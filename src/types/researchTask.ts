import type { ResearchReport, ResearchRequest } from "./research.js";

export type ResearchTaskState =
  | "queued"
  | "planning"
  | "fetching"
  | "parsing"
  | "normalizing"
  | "searching-paper"
  | "downloading-paper"
  | "analyzing-paper"
  | "checking-repo"
  | "extracting-module"
  | "generating-summary"
  | "generating-ppt"
  | "persisting"
  | "completed"
  | "failed";

export type ResearchTaskReviewStatus = "pending" | "passed" | "needs-review";
export type ResearchTaskWorkstreamId = "search" | "reading" | "synthesis";
export type ResearchTaskWorkstreamStatus = "pending" | "in_progress" | "completed" | "blocked";

export interface ResearchTaskHandoffArtifactRef {
  kind: "report" | "review" | "workstream";
  id: string;
  title: string;
  path: string;
  createdAt: string;
  notes: string[];
}

export interface ResearchTaskWorkstream {
  id: ResearchTaskWorkstreamId;
  label: string;
  status: ResearchTaskWorkstreamStatus;
  summary: string;
  nextStep: string;
}

export interface ResearchTaskHandoff {
  taskId: string;
  topic: string;
  question?: string | undefined;
  updatedAt: string;
  state: ResearchTaskState;
  progress: number;
  currentMessage?: string | undefined;
  reviewStatus: ResearchTaskReviewStatus;
  nextRecommendedAction: string;
  blockers: string[];
  activeWorkstreamId?: ResearchTaskWorkstreamId | undefined;
  workstreams: ResearchTaskWorkstream[];
  workstreamPaths: Record<ResearchTaskWorkstreamId, string>;
  artifacts: ResearchTaskHandoffArtifactRef[];
  roundPath: string;
  briefPath: string;
  progressLogPath: string;
  handoffPath: string;
  artifactsPath: string;
  reportPath?: string | undefined;
  reviewPath?: string | undefined;
}

export interface ResearchTaskTransition {
  state: ResearchTaskState;
  at: string;
  message?: string | undefined;
}

export interface ResearchTaskSummary {
  taskId: string;
  topic: string;
  question?: string | undefined;
  state: ResearchTaskState;
  createdAt: string;
  updatedAt: string;
  message?: string | undefined;
  progress: number;
  attempt: number;
  sourceTaskId?: string | undefined;
  reportReady: boolean;
  generatedAt?: string | undefined;
  roundPath?: string | undefined;
  handoffPath?: string | undefined;
  reviewStatus?: ResearchTaskReviewStatus | undefined;
}

export interface ResearchTaskRecord extends ResearchTaskSummary {
  transitions: ResearchTaskTransition[];
  request: ResearchRequest;
  report?: ResearchReport | undefined;
  error?: string | undefined;
}

export interface ResearchTaskDetail extends ResearchTaskSummary {
  transitions: ResearchTaskTransition[];
  request: ResearchRequest;
  error?: string | undefined;
}

export interface ResearchTaskProgressUpdate {
  state: Exclude<ResearchTaskState, "queued" | "completed" | "failed">;
  message?: string | undefined;
}
