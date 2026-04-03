import type { PaperCandidate, ResearchPlan, ResearchRequest } from "./research.js";

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
  pushToWechat?: boolean | undefined;
  senderId?: string | undefined;
  senderName?: string | undefined;
}

export interface ResearchDiscoveryRunResult {
  runId: string;
  generatedAt: string;
  directionIds: string[];
  directionLabels: string[];
  request: Required<Pick<ResearchDiscoveryRunRequest, "maxPapersPerQuery" | "topK">> & {
    directionId?: string | undefined;
    pushToWechat: boolean;
    senderId?: string | undefined;
  };
  items: ResearchDiscoveryItem[];
  digest: string;
  pushed: boolean;
  warnings: string[];
}

export interface ResearchDiscoveryRunSummary {
  runId: string;
  generatedAt: string;
  directionIds: string[];
  directionLabels: string[];
  topTitle?: string | undefined;
  itemCount: number;
  pushed: boolean;
}

export interface ResearchDiscoveryStore {
  updatedAt: string;
  runs: ResearchDiscoveryRunResult[];
}

export interface DiscoveryPaperSearchProvider {
  search(input: { request: ResearchRequest; plan: ResearchPlan }): Promise<PaperCandidate[]>;
}
