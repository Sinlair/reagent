export interface ResearchDirectionReport {
  id: string;
  directionId?: string | undefined;
  topic: string;
  overview: string;
  representativePapers: Array<{
    title: string;
    reason: string;
    sourceUrl?: string | undefined;
  }>;
  commonBaselines: string[];
  commonModules: string[];
  openProblems: string[];
  suggestedRoutes: string[];
  supportingSignals: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDirectionReportStore {
  updatedAt: string;
  reports: ResearchDirectionReport[];
}
