import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PaperCandidate } from "./types.js";
import type {
  DeepPaperAnalysisReport,
  DeepPaperAnalysisStore,
  DeepPaperConclusion,
  DeepPaperConclusionKind,
  DeepPaperEvidenceProfile,
  DeepPaperEvidenceRef,
  DeepPaperSupportKind,
} from "./researchAnalysis.js";
import type { ResearchSourceRepoCandidate } from "./researchArtifacts.js";
import { ArxivPaperSearchProvider } from "./providers/arxivPaperSearchProvider.js";
import { CompositePaperSearchProvider } from "./providers/compositePaperSearchProvider.js";
import { CrossrefPaperSearchProvider } from "./providers/crossrefPaperSearchProvider.js";
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

function buildEvidenceSnippets(paper: PaperCandidate): Array<{ sourceType: "abstract" | "pdf"; text: string }> {
  if (!paper.abstract?.trim()) {
    return [];
  }
  return [
    {
      sourceType: "abstract",
      text: paper.abstract.slice(0, 280)
    }
  ];
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

  if (normalized.includes("rag")) baselines.push("Standard RAG baseline");
  if (normalized.includes("retrieval")) baselines.push("Dense retrieval baseline");
  if (normalized.includes("llm")) baselines.push("Prompt-only LLM baseline");
  if (normalized.includes("multimodal")) baselines.push("Single-modal ablation baseline");

  return baselines.length > 0 ? baselines : ["Task-specific prior SOTA baseline needs manual confirmation."];
}

function inferStrengths(paper: PaperCandidate): string[] {
  const strengths: string[] = [];
  if (paper.abstract) strengths.push("Abstract is available for initial analysis.");
  if (paper.pdfUrl) strengths.push("A PDF link is available for deeper follow-up.");
  if (paper.venue) strengths.push(`Venue metadata is available: ${paper.venue}.`);
  if (paper.year && paper.year >= new Date().getUTCFullYear() - 2) strengths.push("This appears to be a recent paper.");
  return strengths.length > 0 ? strengths : ["Basic metadata was extracted."];
}

function inferWeaknesses(paper: PaperCandidate, repoCount: number): string[] {
  const weaknesses: string[] = [];
  if (!paper.abstract) weaknesses.push("Only limited metadata is available.");
  if (repoCount === 0) weaknesses.push("No GitHub repository was linked automatically.");
  if (!paper.doi) weaknesses.push("DOI metadata is missing.");
  return weaknesses.length > 0 ? weaknesses : ["No obvious metadata weakness was detected automatically."];
}

function buildRecommendation(paper: PaperCandidate, innovationPoints: string[]): string {
  if (paper.abstract && innovationPoints.length > 0) {
    return `Worth reading now. ${paper.title} has extractable evidence and identifiable innovation cues.`;
  }
  if (innovationPoints.length > 0) {
    return `Worth a quick scan. ${paper.title} looks promising, but evidence depth is still limited.`;
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
  evidenceSnippets: Array<{ sourceType: "abstract" | "pdf"; pageNumber?: number | undefined; text: string }>;
}): DeepPaperConclusion[] {
  const evidenceRefs = evidenceRefsFromSnippets(input.evidenceSnippets, 2);
  const hasPaperEvidence = evidenceRefs.length > 0;
  const conclusions: DeepPaperConclusion[] = [];

  conclusions.push(
    buildConclusion({
      kind: "problem_statement",
      statement: input.problemStatement,
      supportKind: hasPaperEvidence ? "paper" : "speculation",
      confidence: hasPaperEvidence ? "medium" : "low",
      evidenceRefs,
      ...(hasPaperEvidence ? {} : { missingEvidence: "No extractable abstract or full text was available." }),
    }),
    buildConclusion({
      kind: "core_method",
      statement: input.coreMethod,
      supportKind: hasPaperEvidence ? "paper" : "speculation",
      confidence: hasPaperEvidence ? "medium" : "low",
      evidenceRefs,
      ...(hasPaperEvidence ? {} : { missingEvidence: "No extractable abstract or full text was available." }),
    }),
  );

  for (const innovationPoint of input.innovationPoints) {
    conclusions.push(
      buildConclusion({
        kind: "innovation",
        statement: innovationPoint,
        supportKind: hasPaperEvidence ? "paper" : "inference",
        confidence: hasPaperEvidence ? "medium" : "low",
        evidenceRefs,
        ...(hasPaperEvidence ? {} : { missingEvidence: "Innovation cues were inferred from limited metadata." }),
      }),
    );
  }

  for (const strength of input.strengths) {
    conclusions.push(
      buildConclusion({
        kind: "strength",
        statement: strength,
        supportKind: hasPaperEvidence ? "paper" : "inference",
        confidence: hasPaperEvidence ? "medium" : "low",
        evidenceRefs,
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
        evidenceRefs,
        missingEvidence: "Weaknesses were inferred rather than extracted as direct claims.",
      }),
    );
  }

  for (const baseline of input.likelyBaselines) {
    conclusions.push(
      buildConclusion({
        kind: "baseline",
        statement: baseline,
        supportKind: "inference",
        confidence: /needs manual confirmation/i.test(baseline) ? "low" : "medium",
        evidenceRefs,
        missingEvidence: "Baseline inference was made from title and abstract signals.",
      }),
    );
  }

  conclusions.push(
    buildConclusion({
      kind: "recommendation",
      statement: input.recommendation,
      supportKind: "inference",
      confidence: hasPaperEvidence ? "medium" : "low",
      evidenceRefs,
      missingEvidence: hasPaperEvidence
        ? "Recommendation still involves agent judgment beyond direct text."
        : "Recommendation was made without enough extractable evidence.",
    }),
  );

  if (input.repoCandidates.length > 0) {
    conclusions.push(
      buildConclusion({
        kind: "repo_availability",
        statement: `A linked implementation repository was found: ${input.repoCandidates[0]!.url}`,
        supportKind: "code",
        confidence: input.repoCandidates[0]!.confidence === "high" ? "high" : "medium",
        evidenceRefs: input.repoCandidates.slice(0, 2).map((candidate) => ({
          sourceType: "repo_link",
          note: candidate.url,
        })),
      }),
    );
  }

  return conclusions;
}

export class ResearchPaperAnalysisService {
  private readonly storePath: string;
  private readonly searchProvider: CompositePaperSearchProvider;
  private readonly linkIngestionService: ResearchLinkIngestionService;

  constructor(
    private readonly workspaceDir: string,
    options: {
      crossrefMailto?: string | undefined;
    } = {}
  ) {
    this.storePath = path.join(workspaceDir, STORE_FILE);
    this.searchProvider = new CompositePaperSearchProvider([
      new CrossrefPaperSearchProvider(options.crossrefMailto),
      new ArxivPaperSearchProvider()
    ]);
    this.linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
  }

  private async readStore(): Promise<DeepPaperAnalysisStore> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DeepPaperAnalysisStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
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
  }): Promise<{
    paper: PaperCandidate;
    sourceItemId?: string | undefined;
    sourceUrl?: string | undefined;
    repoCandidates: ResearchSourceRepoCandidate[];
  }> {
    if (input.sourceItemId?.trim()) {
      const sourceItem = await this.linkIngestionService.getItem(input.sourceItemId.trim());
      if (!sourceItem) {
        throw new Error("Source item was not found.");
      }

      const candidate = sourceItem.paperCandidates[0];
      if (candidate?.url || candidate?.title) {
        const paper = await this.resolvePaperFromTitleOrUrl(candidate.title || candidate.url || "");
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
    const evidenceSnippets = buildEvidenceSnippets(resolved.paper);
    const mainText = normalizeText(resolved.paper.abstract || resolved.paper.title);
    const innovationPoints = inferInnovationPoints(mainText);
    const problemStatement = firstSentence(resolved.paper.abstract ?? mainText);
    const coreMethod = firstSentence(mainText);
    const strengths = inferStrengths(resolved.paper);
    const weaknesses = inferWeaknesses(resolved.paper, resolved.repoCandidates.length);
    const likelyBaselines = inferLikelyBaselines(resolved.paper, mainText);
    const recommendation = buildRecommendation(resolved.paper, innovationPoints);
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
