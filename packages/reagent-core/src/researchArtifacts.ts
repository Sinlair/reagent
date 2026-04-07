export interface ResearchSourcePaperCandidate {
  title?: string | undefined;
  url?: string | undefined;
  pdfUrl?: string | undefined;
  arxivId?: string | undefined;
  doi?: string | undefined;
  reason: string;
  confidence: "low" | "medium" | "high";
}

export interface ResearchSourceRepoCandidate {
  url: string;
  owner?: string | undefined;
  repo?: string | undefined;
  reason: string;
  confidence: "low" | "medium" | "high";
}

export interface ResearchSourceItem {
  id: string;
  sourceType: "url" | "text";
  url?: string | undefined;
  title?: string | undefined;
  author?: string | undefined;
  publishedAt?: string | undefined;
  content: string;
  excerpt: string;
  outboundLinks: string[];
  imageUrls: string[];
  paperCandidates: ResearchSourcePaperCandidate[];
  repoCandidates: ResearchSourceRepoCandidate[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchLinkIngestionRequest {
  url?: string | undefined;
  rawContent?: string | undefined;
  sourceLabel?: string | undefined;
}

export interface ResearchSourceStore {
  updatedAt: string;
  items: ResearchSourceItem[];
}

export interface RepoAnalysisReport {
  id: string;
  url: string;
  owner: string;
  repo: string;
  defaultBranch?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  stars?: number | undefined;
  likelyOfficial: boolean;
  keyPaths: string[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RepoAnalysisStore {
  updatedAt: string;
  reports: RepoAnalysisReport[];
}
