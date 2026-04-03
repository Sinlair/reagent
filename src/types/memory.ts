export type MemoryFileKind = "long-term" | "daily";
export type MemorySearchMode = "keyword";
export type RememberScope = MemoryFileKind;

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

export interface RememberRequest {
  scope: RememberScope;
  title?: string | undefined;
  content: string;
  source?: string | undefined;
}
