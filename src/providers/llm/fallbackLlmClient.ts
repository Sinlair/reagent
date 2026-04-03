import type { LlmClient } from "../../domain/ports.js";
import type {
  EvidenceItem,
  PaperCandidate,
  ResearchChunk,
  ResearchPlan,
  ResearchRequest,
  ResearchSynthesis
} from "../../types/research.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "using",
  "what",
  "which",
  "with"
]);

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      (text.toLowerCase().match(/[a-z0-9]{3,}/gu) ?? []).filter((term) => !STOPWORDS.has(term))
    )
  );
}

function buildDefaultSubquestions(request: ResearchRequest): string[] {
  return [
    `What problem space does ${request.topic} address?`,
    `Which methods or model families are repeatedly used in ${request.topic}?`,
    `How is ${request.topic} evaluated in current literature?`,
    `What limitations or open challenges remain in ${request.topic}?`
  ];
}

function buildSnippet(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/gu, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength);
  const end = boundary > Math.floor(maxLength / 2) ? boundary : maxLength;
  return `${normalized.slice(0, end).trimEnd()}...`;
}

function scoreChunk(
  chunk: ResearchChunk,
  request: ResearchRequest,
  plan: ResearchPlan,
  papersById: Map<string, PaperCandidate>
): number {
  const queryTerms = tokenize(
    [request.topic, request.question ?? "", plan.objective, ...plan.subquestions, ...plan.searchQueries].join(
      " "
    )
  );
  const haystack = ` ${(chunk.text ?? "").toLowerCase()} `;
  const lexicalScore = queryTerms.reduce(
    (total, term) => total + (haystack.includes(` ${term} `) ? 3 : haystack.includes(term) ? 1 : 0),
    0
  );
  const paperRank = papersById.get(chunk.paperId)?.rank ?? 10;
  const rankBonus = Math.max(0, 8 - paperRank);
  const sourceBonus = chunk.sourceType === "pdf" ? 4 : 1;
  return lexicalScore + rankBonus + sourceBonus;
}

function selectTopChunks(
  request: ResearchRequest,
  plan: ResearchPlan,
  papers: PaperCandidate[],
  chunks: ResearchChunk[]
): ResearchChunk[] {
  const papersById = new Map(papers.map((paper) => [paper.id, paper]));

  return [...chunks]
    .sort((left, right) => {
      const scoreDiff =
        scoreChunk(right, request, plan, papersById) - scoreChunk(left, request, plan, papersById);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const leftRank = papersById.get(left.paperId)?.rank ?? 999;
      const rightRank = papersById.get(right.paperId)?.rank ?? 999;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.ordinal - right.ordinal;
    })
    .slice(0, 3);
}

function buildEvidenceItems(
  request: ResearchRequest,
  papers: PaperCandidate[],
  chunks: ResearchChunk[]
): EvidenceItem[] {
  const papersById = new Map(papers.map((paper) => [paper.id, paper]));

  return chunks.map((chunk) => {
    const paper = papersById.get(chunk.paperId);
    const quote = buildSnippet(chunk.text, 260);
    const claim = paper
      ? `${paper.title} contains evidence relevant to \"${request.topic}\".`
      : `Chunk ${chunk.id} contains evidence relevant to \"${request.topic}\".`;

    return {
      claim,
      paperId: chunk.paperId,
      chunkId: chunk.id,
      support:
        chunk.sourceType === "pdf"
          ? `Relevant full-text evidence extracted from page ${chunk.pageNumber ?? "unknown"}.`
          : "Relevant evidence extracted from the paper abstract.",
      quote,
      pageNumber: chunk.pageNumber,
      sourceType: chunk.sourceType,
      confidence: chunk.sourceType === "pdf" ? "high" : "medium"
    };
  });
}

function buildFindings(papers: PaperCandidate[], chunks: ResearchChunk[]): string[] {
  const papersById = new Map(papers.map((paper) => [paper.id, paper]));

  return chunks.map((chunk, index) => {
    const paper = papersById.get(chunk.paperId);
    const prefix = chunk.sourceType === "pdf" ? `PDF p.${chunk.pageNumber ?? "?"}` : "abstract";
    const title = paper?.title ?? chunk.paperId;
    return `${index + 1}. [${prefix}] ${title}: ${buildSnippet(chunk.text, 180)}`;
  });
}

export class FallbackLlmClient implements LlmClient {
  async planResearch(request: ResearchRequest): Promise<ResearchPlan> {
    const objective = request.question?.trim()
      ? request.question
      : `Map the research landscape, main methods, evaluation setup, and gaps for ${request.topic}.`;

    return {
      objective,
      subquestions: buildDefaultSubquestions(request),
      searchQueries: [
        request.topic,
        `${request.topic} survey`,
        `${request.topic} benchmark`,
        `${request.topic} limitations`
      ]
    };
  }

  async synthesizeResearch(input: {
    request: ResearchRequest;
    plan: ResearchPlan;
    papers: PaperCandidate[];
    chunks: ResearchChunk[];
  }): Promise<ResearchSynthesis> {
    const { request, plan, papers, chunks } = input;

    if (papers.length === 0) {
      return {
        summary:
          "The workflow ran successfully, but no papers were retrieved. Configure a reachable paper source or verify the query topic.",
        findings: [
          `The planning stage completed for \"${request.topic}\".`,
          "The current search stage returned zero candidate papers."
        ],
        gaps: [
          "No literature evidence is available yet.",
          "No citation-level support can be produced without retrieved papers."
        ],
        nextActions: [
          "Verify network access for the search provider.",
          "Add additional sources such as arXiv or Semantic Scholar.",
          "Refine the topic wording or broaden the search scope."
        ],
        evidence: [],
        warnings: ["No papers were found for this run."]
      };
    }

    if (chunks.length === 0) {
      return {
        summary:
          "ReAgent retrieved papers but could not extract any abstract or PDF text chunks to ground the synthesis.",
        findings: papers.slice(0, 3).map((paper, index) => `${index + 1}. ${paper.title}`),
        gaps: [
          "No extractable chunk text was available from the retrieved papers.",
          "Chunk-level evidence cannot be produced without abstract or PDF content."
        ],
        nextActions: [
          "Improve PDF discovery for the retrieved papers.",
          "Add more resilient text extraction and OCR fallbacks.",
          "Expand paper sources with direct full-text links."
        ],
        evidence: [],
        warnings: [
          "The fallback LLM client is active. Outputs are deterministic scaffolding, not model-generated analysis."
        ]
      };
    }

    const topChunks = selectTopChunks(request, plan, papers, chunks);
    const pdfChunkCount = chunks.filter((chunk) => chunk.sourceType === "pdf").length;
    const abstractChunkCount = chunks.length - pdfChunkCount;

    return {
      summary: `ReAgent found ${papers.length} candidate papers and extracted ${chunks.length} evidence chunks (${pdfChunkCount} PDF, ${abstractChunkCount} abstract) for \"${request.topic}\". The fallback synthesis is still heuristic, but the evidence layer now points to concrete chunks instead of paper-level placeholders.`,
      findings: buildFindings(papers, topChunks),
      gaps: [
        pdfChunkCount === 0
          ? "No direct PDF full text was parsed in this run, so evidence remains abstract-heavy."
          : "PDF text extraction is working, but chunk scoring is still lexical and not citation-aware.",
        "Ranking is heuristic and does not yet use citation counts or venue quality signals.",
        "An automated evaluation suite for chunk relevance and citation coverage is not implemented yet."
      ],
      nextActions: [
        "Add citation-aware chunk reranking before synthesis.",
        "Add additional sources such as arXiv or Semantic Scholar for broader recall.",
        "Add evaluation cases that score chunk relevance, citation coverage, and evidence quality."
      ],
      evidence: buildEvidenceItems(request, papers, topChunks),
      warnings: [
        "The fallback LLM client is active. Outputs are deterministic scaffolding, not model-generated analysis."
      ]
    };
  }
}
