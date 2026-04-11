export type ResearchEvolutionCandidateType = "direction-preset" | "workspace-skill";
export type ResearchEvolutionCandidateSourceType = "direction-report" | "module-asset";
export type ResearchEvolutionCandidateStatus =
  | "draft"
  | "reviewed"
  | "approved"
  | "rejected"
  | "applied";
export type ResearchEvolutionCandidateReviewDecision = "reviewed" | "approved" | "rejected";

export interface ResearchDirectionPresetCandidatePayload {
  directionId?: string | undefined;
  label: string;
  summary: string;
  queryHints: string[];
  knownBaselines: string[];
  evaluationPriorities: string[];
  currentGoals: string[];
  shortTermValidationTargets: string[];
  suggestedRoutes: string[];
  supportingSignals: string[];
}

export interface ResearchWorkspaceSkillCandidatePayload {
  skillKey: string;
  directoryName: string;
  label: string;
  description: string;
  prompt: string;
  relatedTools: string[];
  sourceRepoUrl: string;
  selectedPaths: string[];
  notes: string[];
  referenceFiles: string[];
  homepage?: string | undefined;
  enabled: boolean;
}

export type ResearchEvolutionCandidatePayload =
  | ResearchDirectionPresetCandidatePayload
  | ResearchWorkspaceSkillCandidatePayload;

export interface ResearchEvolutionCandidateEvidenceItem {
  kind: "paper" | "baseline" | "route" | "signal" | "problem" | "module" | "repo";
  summary: string;
  sourceUrl?: string | undefined;
}

export interface ResearchEvolutionCandidateReviewRecord {
  decision: ResearchEvolutionCandidateReviewDecision;
  reviewer?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
}

export interface ResearchEvolutionCandidateDirectionSnapshot {
  directionId: string;
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
  preferredPaperStyles: Array<"theory" | "engineering" | "reproducibility" | "application">;
  openQuestions: string[];
  currentGoals: string[];
  queryHints: string[];
  successCriteria: string[];
  blockedDirections: string[];
  knownBaselines: string[];
  evaluationPriorities: string[];
  shortTermValidationTargets: string[];
  priority: "primary" | "secondary" | "watchlist";
  enabled: boolean;
  createdAt?: string | undefined;
}

export interface ResearchEvolutionCandidateWorkspaceSkillSnapshot {
  skillKey: string;
  directoryName: string;
  label: string;
  description: string;
  relatedTools: string[];
  referencePaths: string[];
  homepage?: string | undefined;
  enabled: boolean;
  skillFilePath: string;
  configPath: string;
}

export type ResearchEvolutionCandidateApplySnapshot =
  | ResearchEvolutionCandidateDirectionSnapshot
  | ResearchEvolutionCandidateWorkspaceSkillSnapshot;

export interface ResearchEvolutionCandidateApplyRecord {
  dryRun: boolean;
  targetType: "research-direction" | "workspace-skill";
  targetId: string;
  changedFields: string[];
  before: ResearchEvolutionCandidateApplySnapshot | null;
  after: ResearchEvolutionCandidateApplySnapshot;
  reviewer?: string | undefined;
  notes?: string | undefined;
  appliedAt: string;
}

export interface ResearchEvolutionCandidateRollbackRecord {
  targetType: "research-direction" | "workspace-skill";
  targetId: string;
  changedFields: string[];
  before: ResearchEvolutionCandidateApplySnapshot | null;
  after: ResearchEvolutionCandidateApplySnapshot | null;
  revertedApplyAppliedAt: string;
  reviewer?: string | undefined;
  notes?: string | undefined;
  rolledBackAt: string;
}

export interface ResearchEvolutionCandidateBase {
  id: string;
  title: string;
  status: ResearchEvolutionCandidateStatus;
  evidence: ResearchEvolutionCandidateEvidenceItem[];
  reviews: ResearchEvolutionCandidateReviewRecord[];
  applyHistory: ResearchEvolutionCandidateApplyRecord[];
  rollbackHistory: ResearchEvolutionCandidateRollbackRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDirectionPresetCandidate extends ResearchEvolutionCandidateBase {
  candidateType: "direction-preset";
  sourceType: "direction-report";
  sourceId: string;
  payload: ResearchDirectionPresetCandidatePayload;
}

export interface ResearchWorkspaceSkillCandidate extends ResearchEvolutionCandidateBase {
  candidateType: "workspace-skill";
  sourceType: "module-asset";
  sourceId: string;
  payload: ResearchWorkspaceSkillCandidatePayload;
}

export type ResearchEvolutionCandidate =
  | ResearchDirectionPresetCandidate
  | ResearchWorkspaceSkillCandidate;

export interface ResearchEvolutionCandidateStore {
  updatedAt: string;
  candidates: ResearchEvolutionCandidate[];
}

export interface ResearchEvolutionCandidateApplyOutcome {
  candidate: ResearchEvolutionCandidate;
  result: ResearchEvolutionCandidateApplyRecord;
}

export interface ResearchEvolutionCandidateRollbackOutcome {
  candidate: ResearchEvolutionCandidate;
  result: ResearchEvolutionCandidateRollbackRecord;
}
