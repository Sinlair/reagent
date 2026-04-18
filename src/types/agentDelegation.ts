export type AgentDelegationKind = "search" | "reading" | "synthesis";

export type AgentDelegationStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AgentDelegationArtifactRef {
  path: string;
  type: "workstream-memo";
}

export interface AgentDelegationInput {
  prompt?: string | undefined;
  scope: "research-only";
  allowRecursiveDelegation: boolean;
}

export interface AgentDelegationCognitionPosture {
  mode: "evidence-gathering" | "delivery-ready" | "balanced";
  reasons: string[];
  recommendedKinds: AgentDelegationKind[];
  deferredKinds: AgentDelegationKind[];
  conflictedHypotheses: number;
  provisionalHypotheses: number;
  supportedHypotheses: number;
}

export interface AgentDelegationRationale {
  source: "cognition-state";
  summary: string;
  matchedAction?: string | undefined;
  matchedHypothesis?: string | undefined;
  posture: AgentDelegationCognitionPosture;
}

export interface AgentDelegationRecord {
  delegationId: string;
  sessionId: string;
  taskId: string;
  kind: AgentDelegationKind;
  status: AgentDelegationStatus;
  input: AgentDelegationInput;
  rationale?: AgentDelegationRationale | undefined;
  artifact?: AgentDelegationArtifactRef | undefined;
  createdAt: string;
  updatedAt: string;
  error?: string | null | undefined;
}
