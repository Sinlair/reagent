export type ResearchDirectionPriority = "primary" | "secondary" | "watchlist";
export type ResearchPaperStyle =
  | "theory"
  | "engineering"
  | "reproducibility"
  | "application";

export interface ResearchDirectionProfile {
  id: string;
  label: string;
  summary?: string | undefined;
  tlDr?: string | undefined;
  abstract?: string | undefined;
  background?: string | undefined;
  targetProblem?: string | undefined;
  subDirections: string[];
  excludedTopics: string[];
  preferredVenues: string[];
  preferredDatasets: string[];
  preferredBenchmarks: string[];
  preferredPaperStyles: ResearchPaperStyle[];
  openQuestions: string[];
  currentGoals: string[];
  queryHints: string[];
  successCriteria: string[];
  blockedDirections: string[];
  knownBaselines: string[];
  evaluationPriorities: string[];
  shortTermValidationTargets: string[];
  priority: ResearchDirectionPriority;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDirectionProfileInput {
  id?: string | undefined;
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
  preferredPaperStyles?: ResearchPaperStyle[] | undefined;
  openQuestions?: string[] | undefined;
  currentGoals?: string[] | undefined;
  queryHints?: string[] | undefined;
  successCriteria?: string[] | undefined;
  blockedDirections?: string[] | undefined;
  knownBaselines?: string[] | undefined;
  evaluationPriorities?: string[] | undefined;
  shortTermValidationTargets?: string[] | undefined;
  priority?: ResearchDirectionPriority | undefined;
  enabled?: boolean | undefined;
}

export interface ResearchBrief extends ResearchDirectionProfile {}
export interface ResearchBriefInput extends ResearchDirectionProfileInput {}
export interface ResearchBriefStore extends ResearchDirectionStore {}

export interface ResearchDirectionStore {
  updatedAt: string;
  profiles: ResearchDirectionProfile[];
}

export interface ResearchDiscoveryQueryCandidate {
  directionId: string;
  directionLabel: string;
  query: string;
  reason: string;
}
