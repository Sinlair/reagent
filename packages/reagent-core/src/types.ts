export interface ResearchRequest {
  topic: string;
  question?: string | undefined;
  maxPapers?: number | undefined;
}

export interface ResearchPlan {
  objective: string;
  subquestions: string[];
  searchQueries: string[];
}

export interface PaperCandidate {
  id: string;
  title: string;
  abstract?: string | undefined;
  authors: string[];
  url: string;
  pdfUrl?: string | undefined;
  year?: number | undefined;
  venue?: string | undefined;
  doi?: string | undefined;
  source: string;
  relevanceReason?: string | undefined;
  rank?: number | undefined;
  score?: number | undefined;
  rankingReasons?: string[] | undefined;
}

export type ResearchDirectionPriority = "primary" | "secondary" | "watchlist";
export type ResearchPaperStyle = "theory" | "engineering" | "reproducibility" | "application";

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

export type ResearchFeedbackKind =
  | "useful"
  | "not-useful"
  | "more-like-this"
  | "less-like-this"
  | "too-theoretical"
  | "too-engineering-heavy"
  | "worth-following"
  | "not-worth-following";

export interface ResearchFeedbackRecord {
  id: string;
  feedback: ResearchFeedbackKind;
  senderId?: string | undefined;
  senderName?: string | undefined;
  directionId?: string | undefined;
  topic?: string | undefined;
  paperTitle?: string | undefined;
  venue?: string | undefined;
  sourceUrl?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFeedbackStore {
  updatedAt: string;
  items: ResearchFeedbackRecord[];
}

export interface ResearchFeedbackSummary {
  total: number;
  updatedAt: string;
  counts: Record<ResearchFeedbackKind, number>;
  recent: ResearchFeedbackRecord[];
}

export interface ResearchDiscoveryItem extends PaperCandidate {
  directionId: string;
  directionLabel: string;
  query: string;
  queryReason: string;
  venuePreferenceMatched: boolean;
  datasetOrBenchmarkMatched: boolean;
}

export interface ResearchDiscoveryRunRequest {
  directionId?: string | undefined;
  maxPapersPerQuery?: number | undefined;
  topK?: number | undefined;
}

export interface ResearchDiscoveryRunResult {
  runId: string;
  generatedAt: string;
  directionIds: string[];
  directionLabels: string[];
  request: Required<Pick<ResearchDiscoveryRunRequest, "maxPapersPerQuery" | "topK">> & {
    directionId?: string | undefined;
  };
  items: ResearchDiscoveryItem[];
  digest: string;
  warnings: string[];
}

export interface ResearchDiscoveryRunSummary {
  runId: string;
  generatedAt: string;
  directionIds: string[];
  directionLabels: string[];
  topTitle?: string | undefined;
  itemCount: number;
}

export interface ResearchDiscoveryStore {
  updatedAt: string;
  runs: ResearchDiscoveryRunResult[];
}

export interface PaperSearchProvider {
  search(input: { request: ResearchRequest; plan: ResearchPlan }): Promise<PaperCandidate[]>;
}
