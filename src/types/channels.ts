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
