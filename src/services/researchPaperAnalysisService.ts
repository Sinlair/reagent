import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PdfjsPaperContentProvider } from "../providers/content/pdfjsPaperContentProvider.js";
import { CrossrefPaperSearchProvider } from "../providers/search/crossrefPaperSearchProvider.js";
import type { PaperCandidate, ResearchChunk } from "../types/research.js";
import type {
  DeepPaperAnalysisReport,
  DeepPaperConclusion,
  DeepPaperConclusionKind,
  DeepPaperEvidenceProfile,
  DeepPaperEvidenceRef,
  DeepPaperSupportKind,
  DeepPaperAnalysisStore,
} from "../types/researchAnalysis.js";
import type { ResearchSourceRepoCandidate } from "../types/researchArtifacts.js";
import { env } from "../config/env.js";
import { ResearchLinkIngestionService } from "./researchLinkIngestionService.js";

const STORE_FILE = "research/deep-paper-reports.json";
const MAX_REPORTS = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStore(): DeepPaperAnalysisStore {
  return {
    updatedAt: nowIso(),
    reports: [],
  };
}

function normalizeText(text?: string | undefined): string {
  return text?.replace(/\s+/gu, " ").trim() || "";
}

function firstSentence(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) {
    return "No clear statement was extracted.";
  }
  const sentence = normalized.match(/.+?[.!?](?:\s|$)/u)?.[0];
  return sentence?.trim() || normalized;
}

function collectEvidenceSnippets(chunks: ResearchChunk[]): Array<{ sourceType: "abstract" | "pdf"; pageNumber?: number | undefined; text: string }> {
  return chunks.slice(0, 3).map((chunk) => ({
    sourceType: chunk.sourceType,
    ...(chunk.pageNumber ? { pageNumber: chunk.pageNumber } : {}),
    text: chunk.text.slice(0, 280),
  }));
}

function confidenceFromPaperEvidence(chunks: ResearchChunk[]): "low" | "medium" | "high" {
  if (chunks.some((chunk) => chunk.sourceType === "pdf")) {
    return "high";
  }
  if (chunks.some((chunk) => chunk.sourceType === "abstract")) {
    return "medium";
  }
  return "low";
}

function evidenceRefsFromSnippets(
  snippets: Array<{ sourceType: "abstract" | "pdf"; pageNumber?: number | undefined; text: string }>,
  limit = 2,
): DeepPaperEvidenceRef[] {
  return snippets.slice(0, limit).map((snippet) => ({
    sourceType: snippet.sourceType,
    ...(snippet.pageNumber ? { pageNumber: snippet.pageNumber } : {}),
    text: snippet.text,
  }));
}

function buildConclusion(input: {
  kind: DeepPaperConclusionKind;
  statement: string;
  supportKind: DeepPaperSupportKind;
  confidence: "low" | "medium" | "high";
  evidenceRefs?: DeepPaperEvidenceRef[] | undefined;
  missingEvidence?: string | undefined;
}): DeepPaperConclusion {
  return {
    id: randomUUID(),
    kind: input.kind,
    statement: input.statement,
    supportKind: input.supportKind,
    confidence: input.confidence,
    evidenceRefs: input.evidenceRefs ?? [],
    ...(input.missingEvidence?.trim() ? { missingEvidence: input.missingEvidence.trim() } : {}),
  };
}

function buildEvidenceProfile(conclusions: DeepPaperConclusion[]): DeepPaperEvidenceProfile {
  return {
    paperSupportedCount: conclusions.filter((item) => item.supportKind === "paper").length,
    codeSupportedCount: conclusions.filter((item) => item.supportKind === "code").length,
    inferenceCount: conclusions.filter((item) => item.supportKind === "inference").length,
    speculationCount: conclusions.filter((item) => item.supportKind === "speculation").length,
    missingEvidenceCount: conclusions.filter((item) => Boolean(item.missingEvidence)).length,
  };
}

function inferInnovationPoints(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return ["Innovation point could not be extracted automatically."];
  }

  const candidates = normalized
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => /\b(propose|introduce|novel|first|improve|module|framework|architecture)\b/iu.test(sentence))
    .slice(0, 3)
    .map((sentence) => sentence.trim());

  return candidates.length > 0 ? candidates : [firstSentence(normalized)];
}

function inferLikelyBaselines(paper: PaperCandidate, text: string): string[] {
  const normalized = `${paper.title} ${text}`.toLowerCase();
  const baselines: string[] = [];

  if (normalized.includes("rag")) {
    baselines.push("Standard RAG baseline");
  }
  if (normalized.includes("retrieval")) {
    baselines.push("Dense retrieval baseline");
  }
  if (normalized.includes("llm")) {
    baselines.push("Prompt-only LLM baseline");
  }
  if (normalized.includes("multimodal")) {
    baselines.push("Single-modal ablation baseline");
  }

  return baselines.length > 0 ? baselines : ["Task-specific prior SOTA baseline needs manual confirmation."];
}

function inferStrengths(paper: PaperCandidate, chunks: ResearchChunk[]): string[] {
  const strengths: string[] = [];
  if (paper.pdfUrl) {
    strengths.push("PDF is available for deeper review.");
  }
  if (paper.venue) {
    strengths.push(`Venue metadata is available: ${paper.venue}.`);
  }
  if (paper.year && paper.year >= new Date().getUTCFullYear() - 2) {
    strengths.push("This appears to be a recent paper.");
  }
  if (chunks.some((chunk) => chunk.sourceType === "pdf")) {
    strengths.push("Full-text PDF chunks were extracted.");
  }
  return strengths.length > 0 ? strengths : ["Basic metadata was extracted."];
}

function inferWeaknesses(paper: PaperCandidate, repoCount: number, chunks: ResearchChunk[]): string[] {
  const weaknesses: string[] = [];
  if (!paper.pdfUrl && chunks.every((chunk) => chunk.sourceType !== "pdf")) {
    weaknesses.push("Only abstract-level evidence is currently available.");
  }
  if (repoCount === 0) {
    weaknesses.push("No GitHub repository was linked automatically.");
  }
  if (!paper.doi) {
    weaknesses.push("DOI metadata is missing.");
  }
  return weaknesses.length > 0 ? weaknesses : ["No obvious metadata weakness was detected automatically."];
}

function buildRecommendation(paper: PaperCandidate, innovationPoints: string[], chunks: ResearchChunk[]): string {
  if (chunks.some((chunk) => chunk.sourceType === "pdf") && innovationPoints.length > 0) {
    return `Worth reading now. ${paper.title} has extractable full-text evidence and identifiable innovation cues.`;
  }
  if (innovationPoints.length > 0) {
    return `Worth a quick scan. ${paper.title} has promising innovation cues, but evidence depth is still limited.`;
  }
  return `Archive for later. ${paper.title} needs more evidence before investing time.`;
}

function buildConclusions(input: {
  paper: PaperCandidate;
  repoCandidates: ResearchSourceRepoCandidate[];
  problemStatement: string;
  coreMethod: string;
  innovationPoints: string[];
  strengths: string[];
  weaknesses: string[];
  likelyBaselines: string[];
  recommendation: string;
  chunks: ResearchChunk[];
  evidenceSnippets: Array<{ sourceType: "abstract" | "pdf"; pageNumber?: number | undefined; text: string }>;
}): DeepPaperConclusion[] {
  const paperConfidence = confidenceFromPaperEvidence(input.chunks);
  const paperEvidenceRefs = evidenceRefsFromSnippets(input.evidenceSnippets, 2);
  const hasPaperEvidence = paperEvidenceRefs.length > 0;
  const conclusions: DeepPaperConclusion[] = [];

  conclusions.push(
    buildConclusion({
      kind: "problem_statement",
      statement: input.problemStatement,
      supportKind: hasPaperEvidence ? "paper" : "speculation",
      confidence: hasPaperEvidence ? paperConfidence : "low",
      evidenceRefs: paperEvidenceRefs,
      ...(hasPaperEvidence
        ? {}
        : { missingEvidence: "No extractable abstract or PDF text was available for the problem statement." }),
    }),
    buildConclusion({
      kind: "core_method",
      statement: input.coreMethod,
      supportKind: hasPaperEvidence ? "paper" : "speculation",
      confidence: hasPaperEvidence ? paperConfidence : "low",
      evidenceRefs: paperEvidenceRefs,
      ...(hasPaperEvidence
        ? {}
        : { missingEvidence: "No extractable abstract or PDF text was available for the core method." }),
    }),
  );

  for (const innovationPoint of input.innovationPoints) {
    conclusions.push(
      buildConclusion({
        kind: "innovation",
        statement: innovationPoint,
        supportKind: hasPaperEvidence ? "paper" : "inference",
        confidence: hasPaperEvidence ? paperConfidence : "low",
        evidenceRefs: paperEvidenceRefs,
        ...(hasPaperEvidence
          ? {}
          : { missingEvidence: "Innovation cues were inferred without strong extractable paper text." }),
      }),
    );
  }

  for (const strength of input.strengths) {
    conclusions.push(
      buildConclusion({
        kind: "strength",
        statement: strength,
        supportKind: hasPaperEvidence ? "paper" : "inference",
        confidence: hasPaperEvidence ? paperConfidence : "medium",
        evidenceRefs: paperEvidenceRefs,
        ...(hasPaperEvidence ? {} : { missingEvidence: "This strength is supported mainly by metadata or heuristics." }),
      }),
    );
  }

  for (const weakness of input.weaknesses) {
    conclusions.push(
      buildConclusion({
        kind: "weakness",
        statement: weakness,
        supportKind: "inference",
        confidence: hasPaperEvidence ? "medium" : "low",
        evidenceRefs: paperEvidenceRefs,
        missingEvidence: hasPaperEvidence
          ? "Weaknesses were inferred from available evidence rather than extracted as direct claims."
          : "Weaknesses were inferred with limited paper evidence.",
      }),
    );
  }

  for (const baseline of input.likelyBaselines) {
    conclusions.push(
      buildConclusion({
        kind: "baseline",
        statement: baseline,
        supportKind: "inference",
        confidence:
          /needs manual confirmation|task-specific prior sota/i.test(baseline)
            ? "low"
            : hasPaperEvidence
              ? "medium"
              : "low",
        evidenceRefs: paperEvidenceRefs,
        missingEvidence: "No explicit experiment table or benchmark comparison was parsed for this baseline inference.",
      }),
    );
  }

  conclusions.push(
    buildConclusion({
      kind: "recommendation",
      statement: input.recommendation,
      supportKind: "inference",
      confidence: input.chunks.some((chunk) => chunk.sourceType === "pdf") ? "medium" : "low",
      evidenceRefs: paperEvidenceRefs,
      missingEvidence: input.chunks.some((chunk) => chunk.sourceType === "pdf")
        ? "Recommendation still involves agent judgment beyond direct paper text."
        : "Recommendation was made without full-text PDF evidence.",
    }),
  );

  if (input.repoCandidates.length > 0) {
    const repoCandidate = input.repoCandidates[0]!;
    conclusions.push(
      buildConclusion({
        kind: "repo_availability",
        statement: `A linked implementation repository was found: ${repoCandidate.url}`,
        supportKind: "code",
        confidence: repoCandidate.confidence === "high" ? "high" : "medium",
        evidenceRefs: input.repoCandidates.slice(0, 2).map((candidate) => ({
          sourceType: "repo_link",
          note: candidate.url,
        })),
      }),
    );
  }

  return conclusions;
}

function normalizeLoadedReport(report: DeepPaperAnalysisReport): DeepPaperAnalysisReport {
  const conclusions = Array.isArray(report.conclusions)
    ? report.conclusions
    : buildConclusions({
        paper: report.paper,
        repoCandidates: report.repoCandidates,
        problemStatement: report.problemStatement,
        coreMethod: report.coreMethod,
        innovationPoints: report.innovationPoints,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        likelyBaselines: report.likelyBaselines,
        recommendation: report.recommendation,
        chunks: report.evidenceSnippets.map((snippet, index) => ({
          id: `legacy-evidence-${index + 1}`,
          paperId: report.paper.id,
          ordinal: index + 1,
          sourceType: snippet.sourceType,
          text: snippet.text,
          ...(snippet.pageNumber ? { pageNumber: snippet.pageNumber } : {}),
        })),
        evidenceSnippets: report.evidenceSnippets,
      });

  const evidenceProfile =
    report.evidenceProfile && typeof report.evidenceProfile === "object"
      ? report.evidenceProfile
      : buildEvidenceProfile(conclusions);

  return {
    ...report,
    conclusions,
    evidenceProfile,
  };
}

export class ResearchPaperAnalysisService {
  private readonly storePath: string;
  private readonly searchProvider: CrossrefPaperSearchProvider;
  private readonly contentProvider: PdfjsPaperContentProvider;
  private readonly linkIngestionService: ResearchLinkIngestionService;

  constructor(private readonly workspaceDir: string) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.searchProvider = new CrossrefPaperSearchProvider(env.CROSSREF_MAILTO);
    this.contentProvider = new PdfjsPaperContentProvider();
    this.linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
  }

  private async readStore(): Promise<DeepPaperAnalysisStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DeepPaperAnalysisStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        reports: Array.isArray(parsed.reports)
          ? parsed.reports.map((report) => normalizeLoadedReport(report as DeepPaperAnalysisReport))
          : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: DeepPaperAnalysisStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 20): Promise<DeepPaperAnalysisReport[]> {
    const store = await this.readStore();
    return store.reports.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getReport(reportId: string): Promise<DeepPaperAnalysisReport | null> {
    const id = reportId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.reports.find((report) => report.id === id) ?? null;
  }

  private async resolvePaper(input: {
    sourceItemId?: string | undefined;
    url?: string | undefined;
    title?: string | undefined;
  }): Promise<{ paper: PaperCandidate; sourceItemId?: string | undefined; sourceUrl?: string | undefined; repoCandidates: any[] }> {
    if (input.sourceItemId?.trim()) {
      const sourceItem = await this.linkIngestionService.getItem(input.sourceItemId.trim());
      if (!sourceItem) {
        throw new Error("Source item was not found.");
      }
      const candidate = sourceItem.paperCandidates[0];
      if (candidate?.url || candidate?.title) {
        const paper = candidate.url?.includes("arxiv.org/abs/")
          ? {
              id: candidate.arxivId || candidate.url,
              title: candidate.title || `arXiv paper ${candidate.arxivId || "unknown"}`,
              authors: [],
              url: candidate.url || "",
              ...(candidate.pdfUrl ? { pdfUrl: candidate.pdfUrl } : {}),
              ...(candidate.arxivId ? { doi: candidate.arxivId } : {}),
              source: "source-item",
            }
          : await this.resolvePaperFromTitleOrUrl(candidate.title || candidate.url || "");
        return {
          paper,
          sourceItemId: sourceItem.id,
          ...(sourceItem.url ? { sourceUrl: sourceItem.url } : {}),
          repoCandidates: sourceItem.repoCandidates,
        };
      }
      throw new Error("No paper candidate could be extracted from the source item.");
    }

    if (input.url?.trim() && !/arxiv\.org|doi\.org/iu.test(input.url.trim())) {
      const sourceItem = await this.linkIngestionService.ingest({ url: input.url.trim() });
      return this.resolvePaper({ sourceItemId: sourceItem.id });
    }

    const paper = await this.resolvePaperFromTitleOrUrl(input.url?.trim() || input.title?.trim() || "");
    return {
      paper,
      ...(input.url?.trim() ? { sourceUrl: input.url.trim() } : {}),
      repoCandidates: [],
    };
  }

  private async resolvePaperFromTitleOrUrl(query: string): Promise<PaperCandidate> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new Error("A paper title or URL is required.");
    }

    if (/arxiv\.org\/abs\//iu.test(trimmed)) {
      const arxivId = trimmed.split("/abs/")[1]?.split(/[?#]/u)[0]?.trim() || trimmed;
      return {
        id: arxivId,
        title: `arXiv paper ${arxivId}`,
        authors: [],
        url: `https://arxiv.org/abs/${arxivId}`,
        pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
        source: "arxiv",
      };
    }

    const searchResults = await this.searchProvider.search({
      request: {
        topic: trimmed,
        question: trimmed,
        maxPapers: 1,
      },
      plan: {
        objective: trimmed,
        subquestions: [],
        searchQueries: [trimmed],
      },
    });

    if (searchResults.length === 0) {
      throw new Error(`No paper could be resolved for: ${trimmed}`);
    }

    return searchResults[0]!;
  }

  async analyze(input: {
    sourceItemId?: string | undefined;
    url?: string | undefined;
    title?: string | undefined;
  }): Promise<DeepPaperAnalysisReport> {
    const resolved = await this.resolvePaper(input);
    const taskId = randomUUID();
    const collectResult = await this.contentProvider.collect({
      taskId,
      request: {
        topic: resolved.paper.title,
        question: resolved.paper.abstract ?? resolved.paper.title,
        maxPapers: 1,
      },
      plan: {
        objective: resolved.paper.title,
        subquestions: [],
        searchQueries: [resolved.paper.title],
      },
      papers: [resolved.paper],
    });

    const chunks = collectResult.chunks;
    const evidenceSnippets = collectEvidenceSnippets(chunks);
    const mainText = normalizeText(
      chunks.map((chunk) => chunk.text).join(" ") || resolved.paper.abstract || resolved.paper.title,
    );
    const innovationPoints = inferInnovationPoints(mainText);
    const problemStatement = firstSentence(resolved.paper.abstract ?? mainText);
    const coreMethod = firstSentence(mainText);
    const strengths = inferStrengths(resolved.paper, chunks);
    const weaknesses = inferWeaknesses(resolved.paper, resolved.repoCandidates.length, chunks);
    const likelyBaselines = inferLikelyBaselines(resolved.paper, mainText);
    const recommendation = buildRecommendation(resolved.paper, innovationPoints, chunks);
    const conclusions = buildConclusions({
      paper: resolved.paper,
      repoCandidates: resolved.repoCandidates,
      problemStatement,
      coreMethod,
      innovationPoints,
      strengths,
      weaknesses,
      likelyBaselines,
      recommendation,
      chunks,
      evidenceSnippets,
    });
    const report: DeepPaperAnalysisReport = {
      id: randomUUID(),
      ...(resolved.sourceItemId ? { sourceItemId: resolved.sourceItemId } : {}),
      ...(resolved.sourceUrl ? { sourceUrl: resolved.sourceUrl } : {}),
      paper: resolved.paper,
      repoCandidates: resolved.repoCandidates,
      problemStatement,
      coreMethod,
      innovationPoints,
      strengths,
      weaknesses,
      likelyBaselines,
      recommendation,
      evidenceSnippets,
      conclusions,
      evidenceProfile: buildEvidenceProfile(conclusions),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      reports: [report, ...store.reports].slice(0, MAX_REPORTS),
    });

    return report;
  }
}
