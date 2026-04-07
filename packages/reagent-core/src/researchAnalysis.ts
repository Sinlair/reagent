import type { PaperCandidate } from "./types.js";
import type { ResearchSourceRepoCandidate } from "./researchArtifacts.js";

export type DeepPaperSupportKind = "paper" | "code" | "inference" | "speculation";
export type DeepPaperConclusionKind =
  | "problem_statement"
  | "core_method"
  | "innovation"
  | "strength"
  | "weakness"
  | "baseline"
  | "recommendation"
  | "repo_availability";

export interface DeepPaperEvidenceRef {
  sourceType: "abstract" | "pdf" | "repo_link" | "metadata";
  pageNumber?: number | undefined;
  text?: string | undefined;
  note?: string | undefined;
}

export interface DeepPaperConclusion {
  id: string;
  kind: DeepPaperConclusionKind;
  statement: string;
  supportKind: DeepPaperSupportKind;
  confidence: "low" | "medium" | "high";
  evidenceRefs: DeepPaperEvidenceRef[];
  missingEvidence?: string | undefined;
}

export interface DeepPaperEvidenceProfile {
  paperSupportedCount: number;
  codeSupportedCount: number;
  inferenceCount: number;
  speculationCount: number;
  missingEvidenceCount: number;
}

export interface DeepPaperAnalysisReport {
  id: string;
  sourceItemId?: string | undefined;
  sourceUrl?: string | undefined;
  paper: PaperCandidate;
  repoCandidates: ResearchSourceRepoCandidate[];
  problemStatement: string;
  coreMethod: string;
  innovationPoints: string[];
  strengths: string[];
  weaknesses: string[];
  likelyBaselines: string[];
  recommendation: string;
  evidenceSnippets: Array<{
    sourceType: "abstract" | "pdf";
    pageNumber?: number | undefined;
    text: string;
  }>;
  conclusions: DeepPaperConclusion[];
  evidenceProfile: DeepPaperEvidenceProfile;
  createdAt: string;
  updatedAt: string;
}

export interface DeepPaperAnalysisStore {
  updatedAt: string;
  reports: DeepPaperAnalysisReport[];
}
