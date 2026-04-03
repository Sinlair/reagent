export type ResearchMemoryNodeType =
  | "direction"
  | "discovery_run"
  | "source_item"
  | "paper"
  | "workflow_report"
  | "paper_report"
  | "repo"
  | "repo_report"
  | "module_asset"
  | "presentation";

export interface ResearchMemoryGraphQuery {
  types?: ResearchMemoryNodeType[] | undefined;
  search?: string | undefined;
  topic?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface ResearchMemoryNode {
  id: string;
  type: ResearchMemoryNodeType;
  label: string;
  subtitle?: string | undefined;
  tags: string[];
  meta: Record<string, string | number | boolean | null>;
  occurredAt?: string | undefined;
  externalUrl?: string | undefined;
  artifactPath?: string | undefined;
}

export interface ResearchMemoryEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface ResearchMemoryGraph {
  generatedAt: string;
  stats: {
    nodes: number;
    edges: number;
    byType: Record<string, number>;
  };
  nodes: ResearchMemoryNode[];
  edges: ResearchMemoryEdge[];
}

export interface ResearchMemoryNodeLink {
  label: string;
  href: string;
  kind: "api" | "artifact" | "external";
}

export interface ResearchMemoryNodeDetail {
  generatedAt: string;
  node: ResearchMemoryNode;
  relatedEdges: ResearchMemoryEdge[];
  relatedNodes: ResearchMemoryNode[];
  raw: unknown;
  links: ResearchMemoryNodeLink[];
}
