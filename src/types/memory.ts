export type MemoryFileKind = "long-term" | "daily";
export type MemorySearchMode = "hybrid";
export type RememberScope = MemoryFileKind;
export type MemorySourceType =
  | "user-stated"
  | "agent-inferred"
  | "report-derived"
  | "tool-derived"
  | "imported";
export type MemoryConfidence = "low" | "medium" | "high";
export type MemoryRecallLayer = "conversation" | "workspace" | "artifact";

export interface MemoryFileSummary {
  path: string;
  kind: MemoryFileKind;
  size: number;
  updatedAt: string;
}

export interface MemoryFileContent {
  path: string;
  kind: MemoryFileKind;
  content: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  path: string;
  kind: MemoryFileKind;
  title: string;
  snippet: string;
  score: number;
  startLine: number;
  endLine: number;
}

export interface MemoryStatus {
  workspaceDir: string;
  files: number;
  searchMode: MemorySearchMode;
  lastUpdatedAt: string | null;
}

export interface MemoryIndexEntry {
  id: string;
  path: string;
  kind: MemoryFileKind;
  title: string;
  content: string;
  snippet: string;
  source?: string | undefined;
  sourceId?: string | undefined;
  sourceType: MemorySourceType;
  confidence: MemoryConfidence;
  tags: string[];
  entityIds: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | undefined;
}

export interface MemoryIndexStore {
  updatedAt: string;
  entries: MemoryIndexEntry[];
}

export interface MemoryRecallHit {
  id: string;
  layer: MemoryRecallLayer;
  title: string;
  snippet: string;
  score: number;
  confidence: MemoryConfidence;
  sourceType: MemorySourceType;
  provenance: string;
  tags: string[];
  entityIds: string[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  sourceId?: string | undefined;
  path?: string | undefined;
  kind?: MemoryFileKind | undefined;
  artifactType?: string | undefined;
}

export interface MemoryRecallOptions {
  limit?: number | undefined;
  includeWorkspace?: boolean | undefined;
  includeArtifacts?: boolean | undefined;
}

export interface MemoryRecallResult {
  query: string;
  generatedAt: string;
  hits: MemoryRecallHit[];
}

export interface RememberRequest {
  scope: RememberScope;
  title?: string | undefined;
  content: string;
  source?: string | undefined;
  sourceId?: string | undefined;
  sourceType?: MemorySourceType | undefined;
  confidence?: MemoryConfidence | undefined;
  tags?: string[] | undefined;
  entityIds?: string[] | undefined;
}
