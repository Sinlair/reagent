import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ResearchFeedbackKind,
  ResearchFeedbackRecord,
  ResearchFeedbackStore,
  ResearchFeedbackSummary,
} from "../types/researchFeedback.js";

const STORE_FILE = "channels/research-feedback.json";
const MAX_ITEMS = 400;
const MAX_MATCHABLE_TOKENS = 8;

const FEEDBACK_WEIGHTS: Record<ResearchFeedbackKind, number> = {
  useful: 2,
  "not-useful": -2,
  "more-like-this": 3,
  "less-like-this": -3,
  "too-theoretical": -2,
  "too-engineering-heavy": -2,
  "worth-following": 3,
  "not-worth-following": -3,
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): ResearchFeedbackStore {
  return {
    updatedAt: nowIso(),
    items: [],
  };
}

function tokenize(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  )];
}

function uniqueTrimmed(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function countOverlap(left: string[], rightHaystack: string): number {
  return left.filter((token) => rightHaystack.includes(token)).length;
}

function directionMatchScore(item: ResearchFeedbackRecord, input: {
  directionId?: string | undefined;
  topic?: string | undefined;
}): number {
  if (input.directionId?.trim() && item.directionId === input.directionId.trim()) {
    return 3;
  }

  const tokens = uniqueTrimmed([
    item.directionId ?? "",
    item.topic ?? "",
    item.notes ?? "",
  ].flatMap((value) => tokenize(value))).slice(0, MAX_MATCHABLE_TOKENS);
  const haystack = `${input.topic ?? ""} ${input.directionId ?? ""}`.toLowerCase();
  return tokens.length > 0 ? countOverlap(tokens, haystack) : 0;
}

function inferStylePenaltyKinds(haystack: string): Array<"too-theoretical" | "too-engineering-heavy"> {
  const penalties: Array<"too-theoretical" | "too-engineering-heavy"> = [];

  if (/\b(theorem|proof|bound|formal|analysis|lemma|proposition)\b/iu.test(haystack)) {
    penalties.push("too-theoretical");
  }
  if (/\b(system|implementation|practical|deployment|benchmark|ablation|module|pipeline)\b/iu.test(haystack)) {
    penalties.push("too-engineering-heavy");
  }

  return penalties;
}

function emptyCounts(): Record<ResearchFeedbackKind, number> {
  return {
    useful: 0,
    "not-useful": 0,
    "more-like-this": 0,
    "less-like-this": 0,
    "too-theoretical": 0,
    "too-engineering-heavy": 0,
    "worth-following": 0,
    "not-worth-following": 0,
  };
}

export class ResearchFeedbackService {
  private readonly storePath: string;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
  }

  private async readStore(): Promise<ResearchFeedbackStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ResearchFeedbackStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: ResearchFeedbackStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async record(input: {
    feedback: ResearchFeedbackKind;
    senderId?: string | undefined;
    senderName?: string | undefined;
    directionId?: string | undefined;
    topic?: string | undefined;
    paperTitle?: string | undefined;
    venue?: string | undefined;
    sourceUrl?: string | undefined;
    notes?: string | undefined;
  }): Promise<ResearchFeedbackRecord> {
    const record: ResearchFeedbackRecord = {
      id: randomUUID(),
      feedback: input.feedback,
      ...(input.senderId?.trim() ? { senderId: input.senderId.trim() } : {}),
      ...(input.senderName?.trim() ? { senderName: input.senderName.trim() } : {}),
      ...(input.directionId?.trim() ? { directionId: input.directionId.trim() } : {}),
      ...(input.topic?.trim() ? { topic: input.topic.trim() } : {}),
      ...(input.paperTitle?.trim() ? { paperTitle: input.paperTitle.trim() } : {}),
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
      ...(input.sourceUrl?.trim() ? { sourceUrl: input.sourceUrl.trim() } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      items: [record, ...store.items].slice(0, MAX_ITEMS),
    });

    return record;
  }

  async listRecent(limit = 20): Promise<ResearchFeedbackRecord[]> {
    const store = await this.readStore();
    return store.items.slice(0, Math.max(1, Math.min(limit, 100)));
  }

  async getSummary(limit = 20): Promise<ResearchFeedbackSummary> {
    const store = await this.readStore();
    const counts = emptyCounts();

    for (const item of store.items) {
      counts[item.feedback] += 1;
    }

    return {
      total: store.items.length,
      updatedAt: store.updatedAt,
      counts,
      recent: store.items.slice(0, Math.max(1, Math.min(limit, 50))),
    };
  }

  async scoreDiscoveryCandidate(input: {
    directionId?: string | undefined;
    topic?: string | undefined;
    title: string;
    abstract?: string | undefined;
    venue?: string | undefined;
  }): Promise<{ score: number; reasons: string[] }> {
    const recent = await this.listRecent(120);
    const haystack = `${input.title} ${input.abstract ?? ""} ${input.venue ?? ""}`.toLowerCase();
    const stylePenaltyKinds = new Set(inferStylePenaltyKinds(haystack));

    let score = 0;
    const reasons: string[] = [];

    for (const item of recent) {
      const baseWeight = FEEDBACK_WEIGHTS[item.feedback];
      let matched = false;
      let appliedWeight = baseWeight;

      if (input.directionId?.trim() && item.directionId === input.directionId.trim()) {
        matched = true;
        appliedWeight += Math.sign(baseWeight);
        reasons.push(`Feedback match for direction ${item.directionId}: ${item.feedback}.`);
      }

      if (!matched && item.venue?.trim() && input.venue?.toLowerCase().includes(item.venue.trim().toLowerCase())) {
        matched = true;
        reasons.push(`Feedback match for venue ${item.venue}: ${item.feedback}.`);
      }

      const matchTokens = uniqueTrimmed([
        item.topic ?? "",
        item.paperTitle ?? "",
        item.notes ?? "",
      ].flatMap((value) => tokenize(value))).slice(0, MAX_MATCHABLE_TOKENS);

      if (!matched && matchTokens.length > 0) {
        const overlap = countOverlap(matchTokens, haystack);
        if (overlap >= Math.min(2, matchTokens.length)) {
          matched = true;
          appliedWeight += overlap >= 3 ? Math.sign(baseWeight) : 0;
          reasons.push(`Feedback text overlap matched: ${item.feedback}.`);
        }
      }

      if (!matched && (item.feedback === "too-theoretical" || item.feedback === "too-engineering-heavy")) {
        if (stylePenaltyKinds.has(item.feedback)) {
          matched = true;
          reasons.push(`Style feedback matched: ${item.feedback}.`);
        }
      }

      if (matched) {
        score += appliedWeight;
      }
    }

    return {
      score,
      reasons: uniqueTrimmed(reasons),
    };
  }

  async getDirectionPushPolicy(input: {
    directionId?: string | undefined;
    topic?: string | undefined;
  }): Promise<{
    score: number;
    topKAdjustment: number;
    minSpacingDays: number;
    reasons: string[];
  }> {
    const recent = await this.listRecent(120);
    let score = 0;
    const reasons: string[] = [];

    for (const item of recent) {
      const matchScore = directionMatchScore(item, input);
      if (matchScore <= 0) {
        continue;
      }

      const weighted = FEEDBACK_WEIGHTS[item.feedback] + Math.min(2, matchScore - 1) * Math.sign(FEEDBACK_WEIGHTS[item.feedback]);
      score += weighted;
      reasons.push(`Direction feedback matched: ${item.feedback}.`);
    }

    let topKAdjustment = 0;
    let minSpacingDays = 1;

    if (score >= 4) {
      topKAdjustment = 1;
    }
    if (score >= 8) {
      topKAdjustment = 2;
    }
    if (score <= -4) {
      topKAdjustment = -1;
      minSpacingDays = 2;
    }
    if (score <= -8) {
      topKAdjustment = -2;
      minSpacingDays = 3;
    }

    return {
      score,
      topKAdjustment,
      minSpacingDays,
      reasons: uniqueTrimmed(reasons),
    };
  }
}
