export type ResearchFeedbackKind =
  | "useful"
  | "not-useful"
  | "more-like-this"
  | "less-like-this"
  | "too-theoretical"
  | "too-engineering-heavy"
  | "worth-following"
  | "not-worth-following";

export interface ResearchFeedbackRecord {
  id: string;
  feedback: ResearchFeedbackKind;
  senderId?: string | undefined;
  senderName?: string | undefined;
  directionId?: string | undefined;
  topic?: string | undefined;
  paperTitle?: string | undefined;
  venue?: string | undefined;
  sourceUrl?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFeedbackStore {
  updatedAt: string;
  items: ResearchFeedbackRecord[];
}

export interface ResearchFeedbackSummary {
  total: number;
  updatedAt: string;
  counts: Record<ResearchFeedbackKind, number>;
  recent: ResearchFeedbackRecord[];
}
