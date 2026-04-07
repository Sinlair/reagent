import type { PaperCandidate } from "./types.js";

export type NoveltyVerdict = "likely-novel" | "uncertain" | "likely-known";

export interface NoveltyCheckCandidate {
  paper: PaperCandidate;
  overlapScore: number;
  overlapTerms: string[];
}

export interface NoveltyCheckResult {
  id: string;
  query: string;
  verdict: NoveltyVerdict;
  summary: string;
  overlapTerms: string[];
  candidates: NoveltyCheckCandidate[];
  createdAt: string;
}
