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
  compactedAt?: string | undefined;
  compactedIntoId?: string | undefined;
  compactionSourceIds?: string[] | undefined;
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

export interface MemoryCompactionOptions {
  olderThanDays?: number | undefined;
  minEntries?: number | undefined;
  maxEntries?: number | undefined;
  dryRun?: boolean | undefined;
  source?: "auto" | "manual" | undefined;
}

export interface MemoryCompactionResult {
  generatedAt: string;
  candidateCount: number;
  compactedEntryCount: number;
  sourceEntryIds: string[];
  summaryTitle?: string | undefined;
  summaryPath?: string | undefined;
  summaryEntryId?: string | undefined;
  mode: "auto" | "manual";
}

export interface MemoryPolicy {
  updatedAt: string;
  autoCompactionEnabled: boolean;
  autoCompactionIntervalMinutes: number;
  autoCompactionOlderThanDays: number;
  autoCompactionMinEntries: number;
  autoCompactionMaxEntries: number;
  maxDailyEntriesBeforeAutoCompact: number;
  neverCompactTags: string[];
  highConfidenceLongTermOnly: boolean;
}

export interface MemoryPolicyPatch {
  autoCompactionEnabled?: boolean | undefined;
  autoCompactionIntervalMinutes?: number | undefined;
  autoCompactionOlderThanDays?: number | undefined;
  autoCompactionMinEntries?: number | undefined;
  autoCompactionMaxEntries?: number | undefined;
  maxDailyEntriesBeforeAutoCompact?: number | undefined;
  neverCompactTags?: string[] | undefined;
  highConfidenceLongTermOnly?: boolean | undefined;
}

export interface MemoryCompactionRecord extends MemoryCompactionResult {
  id: string;
  status: "compacted" | "skipped";
  reason?: string | undefined;
}

export interface MemoryCompactionRecordStore {
  updatedAt: string;
  items: MemoryCompactionRecord[];
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
  compactionSourceIds?: string[] | undefined;
}
