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

export interface AgentDelegationRecord {
  delegationId: string;
  sessionId: string;
  taskId: string;
  kind: AgentDelegationKind;
  status: AgentDelegationStatus;
  input: AgentDelegationInput;
  artifact?: AgentDelegationArtifactRef | undefined;
  createdAt: string;
  updatedAt: string;
  error?: string | null | undefined;
}
