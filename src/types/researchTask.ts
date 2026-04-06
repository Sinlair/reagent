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
}

export interface ResearchTaskRecord extends ResearchTaskSummary {
  transitions: ResearchTaskTransition[];
  request: ResearchRequest;
  report?: ResearchReport | undefined;
  error?: string | undefined;
}

export interface ResearchTaskProgressUpdate {
  state: Exclude<ResearchTaskState, "queued" | "completed" | "failed">;
  message?: string | undefined;
}
