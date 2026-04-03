import type {
  PaperCandidate,
  ResearchChunk,
  ResearchPlan,
  ResearchReport,
  ResearchReportSummary,
  ResearchRequest,
  ResearchSynthesis
} from "../types/research.js";

export interface PaperSearchProvider {
  search(input: { request: ResearchRequest; plan: ResearchPlan }): Promise<PaperCandidate[]>;
}

export interface LlmClient {
  planResearch(request: ResearchRequest): Promise<ResearchPlan>;
  synthesizeResearch(input: {
    request: ResearchRequest;
    plan: ResearchPlan;
    papers: PaperCandidate[];
    chunks: ResearchChunk[];
  }): Promise<ResearchSynthesis>;
}

export interface PaperContentProvider {
  collect(input: {
    taskId: string;
    request: ResearchRequest;
    plan: ResearchPlan;
    papers: PaperCandidate[];
  }): Promise<{ chunks: ResearchChunk[]; warnings: string[] }>;
}

export interface ResearchRepository {
  save(report: ResearchReport): Promise<void>;
  findByTaskId(taskId: string): Promise<ResearchReport | null>;
  listRecent(limit: number): Promise<ResearchReportSummary[]>;
}
