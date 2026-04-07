export interface ResearchDiscoveryScheduleConfig {
  enabled: boolean;
  dailyTimeLocal: string;
  senderId: string;
  senderName?: string | undefined;
  directionIds: string[];
  topK: number;
  maxPapersPerQuery: number;
}

export interface ResearchDiscoveryScheduleState {
  enabled: boolean;
  dailyTimeLocal: string;
  senderId: string;
  senderName?: string | undefined;
  directionIds: string[];
  topK: number;
  maxPapersPerQuery: number;
  lastRunDateByDirection: Record<string, string>;
  updatedAt: string;
}

export interface ResearchDiscoverySchedulerStatus {
  running: boolean;
  enabled: boolean;
  dailyTimeLocal: string;
  senderId?: string | undefined;
  senderName?: string | undefined;
  directionIds: string[];
  topK: number;
  maxPapersPerQuery: number;
  lastRunDateByDirection: Record<string, string>;
  updatedAt?: string | undefined;
}
