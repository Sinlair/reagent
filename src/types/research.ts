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

export type EvidenceConfidence = "low" | "medium" | "high";
export type ChunkSourceType = "abstract" | "pdf";

export interface ResearchChunk {
  id: string;
  paperId: string;
  ordinal: number;
  sourceType: ChunkSourceType;
  text: string;
  pageNumber?: number | undefined;
}

export interface EvidenceItem {
  claim: string;
  paperId: string;
  chunkId: string;
  support: string;
  quote: string;
  pageNumber?: number | undefined;
  sourceType: ChunkSourceType;
  confidence: EvidenceConfidence;
}

export interface ResearchSynthesis {
  summary: string;
  findings: string[];
  gaps: string[];
  nextActions: string[];
  evidence: EvidenceItem[];
  warnings: string[];
}

export type CritiqueVerdict = "weak" | "moderate" | "strong";

export interface ResearchCritique {
  verdict: CritiqueVerdict;
  summary: string;
  issues: string[];
  recommendations: string[];
  supportedEvidenceCount: number;
  unsupportedEvidenceCount: number;
  coveredFindingsCount: number;
  citationDiversity: number;
  citationCoverage: number;
}

export interface ResearchReport extends ResearchSynthesis {
  taskId: string;
  topic: string;
  question?: string | undefined;
  generatedAt: string;
  plan: ResearchPlan;
  papers: PaperCandidate[];
  chunks: ResearchChunk[];
  critique: ResearchCritique;
}

export interface ResearchReportSummary {
  taskId: string;
  topic: string;
  question?: string | undefined;
  generatedAt: string;
  summary: string;
  critiqueVerdict: CritiqueVerdict;
  paperCount: number;
  evidenceCount: number;
}
