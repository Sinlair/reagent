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

export interface ModuleAsset {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch?: string | undefined;
  archivePath?: string | undefined;
  selectedPaths: string[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ModuleAssetStore {
  updatedAt: string;
  assets: ModuleAsset[];
}

export interface WeeklyPresentationRequest {
  days?: number | undefined;
  topic?: string | undefined;
}

export interface WeeklyPresentationResult {
  id: string;
  title: string;
  generatedAt: string;
  sourceReportTaskIds: string[];
  slideMarkdown: string;
  filePath: string;
  pptxPath?: string | undefined;
  imagePaths: string[];
}
