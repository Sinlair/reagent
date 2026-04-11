export type WeChatProviderMode = "mock" | "native" | "openclaw";
export type ChannelDirection = "system" | "inbound" | "outbound";
export type WeChatLifecycleState =
  | "running"
  | "disconnected"
  | "reconnecting"
  | "stuck"
  | "stale-socket"
  | "waiting-human-action"
  | "failed";

export interface WeChatMessage {
  id: string;
  direction: ChannelDirection;
  text: string;
  senderId?: string | undefined;
  senderName?: string | undefined;
  createdAt: string;
}

export interface WeChatLifecycleAuditEntry {
  ts?: string | undefined;
  providerMode: WeChatProviderMode;
  event:
    | "service-started"
    | "service-stopped"
    | "lifecycle-transition"
    | "auto-restart-scheduled"
    | "auto-restart-completed"
    | "auto-restart-failed"
    | "auto-restart-blocked";
  state?: WeChatLifecycleState | undefined;
  reason?: string | undefined;
  details?: Record<string, string | number | boolean | null> | undefined;
}

export interface OpenClawEventAuditEntry {
  ts?: string | undefined;
  event: string;
  sessionKey?: string | undefined;
  messageId?: string | undefined;
  role?: string | undefined;
  text?: string | undefined;
}

export interface OpenClawSessionRegistryEntry {
  sessionKey: string;
  channel?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | number | undefined;
  label?: string | undefined;
  displayName?: string | undefined;
  derivedTitle?: string | undefined;
  lastMessagePreview?: string | undefined;
  lastMessageId?: string | undefined;
  lastMessageRole?: string | undefined;
  updatedAt?: number | null | undefined;
  lastSyncedAt: string;
}

export interface OpenClawCachedSessionMessage {
  id: string;
  role?: string | undefined;
  text: string;
  createdAt: string;
}

export interface WeChatBridgeDiagnostics {
  providerMode: "openclaw";
  cliPath: string;
  cliAvailable: boolean;
  cliVersion?: string | undefined;
  requiredVersion: string;
  pluginId: string;
  pluginInstalled: boolean;
  pluginEnabled: boolean;
  pluginVersion?: string | undefined;
  gatewayUrl: string;
  gatewayReachable: boolean;
  managedProcessRunning: boolean;
  recommendedActions: string[];
  lastError?: string | undefined;
  logTail: string[];
}

export interface WeChatChannelAccountSummary {
  accountId: string;
  accountName?: string | undefined;
  configured?: boolean | undefined;
  linked?: boolean | undefined;
  running?: boolean | undefined;
  connected?: boolean | undefined;
  lastError?: string | undefined;
}

export interface WeChatChannelStatus {
  providerMode: WeChatProviderMode;
  configured: boolean;
  linked: boolean;
  running: boolean;
  connected: boolean;
  lifecycleState?: WeChatLifecycleState | undefined;
  lifecycleReason?: string | undefined;
  requiresHumanAction?: boolean | undefined;
  reconnectPausedUntil?: string | undefined;
  lastHealthyAt?: string | undefined;
  lastRestartAt?: string | undefined;
  restartCount?: number | undefined;
  pairingCode?: string | undefined;
  qrDataUrl?: string | undefined;
  accountId?: string | undefined;
  accountName?: string | undefined;
  lastMessage?: string | undefined;
  lastError?: string | undefined;
  cliVersion?: string | undefined;
  pluginInstalled?: boolean | undefined;
  pluginVersion?: string | undefined;
  gatewayUrl?: string | undefined;
  gatewayReachable?: boolean | undefined;
  accounts?: WeChatChannelAccountSummary[] | undefined;
  hostSessionRegistryCount?: number | undefined;
  hostSessionRegistryUpdatedAt?: string | undefined;
  updatedAt: string;
  notes?: string[] | undefined;
}

export interface ChannelsStatusSnapshot {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channels: {
    wechat: WeChatChannelStatus;
  };
}

export interface WeChatLoginStartResult {
  message: string;
  pairingCode?: string | undefined;
  qrDataUrl?: string | undefined;
  connected: boolean;
  providerMode: WeChatProviderMode;
}

export interface WeChatInboundResult {
  accepted: boolean;
  reply: string;
  researchTaskId?: string | undefined;
}
