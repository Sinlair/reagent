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
  subDirections: string[];
  excludedTopics: string[];
  preferredVenues: string[];
  preferredDatasets: string[];
  preferredBenchmarks: string[];
  preferredPaperStyles: ResearchPaperStyle[];
  openQuestions: string[];
  currentGoals: string[];
  queryHints: string[];
  priority: ResearchDirectionPriority;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDirectionProfileInput {
  id?: string | undefined;
  label: string;
  summary?: string | undefined;
  subDirections?: string[] | undefined;
  excludedTopics?: string[] | undefined;
  preferredVenues?: string[] | undefined;
  preferredDatasets?: string[] | undefined;
  preferredBenchmarks?: string[] | undefined;
  preferredPaperStyles?: ResearchPaperStyle[] | undefined;
  openQuestions?: string[] | undefined;
  currentGoals?: string[] | undefined;
  queryHints?: string[] | undefined;
  priority?: ResearchDirectionPriority | undefined;
  enabled?: boolean | undefined;
}

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
