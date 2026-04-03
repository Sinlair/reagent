import type {
  PaperCandidate,
  ResearchChunk,
  ResearchCritique,
  ResearchRequest,
  ResearchSynthesis
} from "../types/research.js";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function deriveVerdict(input: {
  citationCoverage: number;
  unsupportedEvidenceCount: number;
  citationDiversity: number;
}): ResearchCritique["verdict"] {
  if (
    input.citationCoverage >= 0.8 &&
    input.unsupportedEvidenceCount === 0 &&
    input.citationDiversity >= 2
  ) {
    return "strong";
  }

  if (input.citationCoverage >= 0.5 && input.unsupportedEvidenceCount <= 1) {
    return "moderate";
  }

  return "weak";
}

export function critiqueResearch(input: {
  request: ResearchRequest;
  papers: PaperCandidate[];
  chunks: ResearchChunk[];
  synthesis: ResearchSynthesis;
}): ResearchCritique {
  const { papers, chunks, synthesis } = input;
  const retrievedPaperIds = new Set(papers.map((paper) => paper.id));
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const supportedEvidence = synthesis.evidence.filter((evidence) => {
    const chunk = chunksById.get(evidence.chunkId);

    return (
      retrievedPaperIds.has(evidence.paperId) &&
      evidence.support.trim().length > 0 &&
      evidence.quote.trim().length > 0 &&
      Boolean(chunk) &&
      chunk?.paperId === evidence.paperId
    );
  });

  const supportedEvidenceCount = supportedEvidence.length;
  const unsupportedEvidenceCount = synthesis.evidence.length - supportedEvidenceCount;
  const coveredFindingsCount = Math.min(synthesis.findings.length, supportedEvidenceCount);
  const citationDiversity = new Set(supportedEvidence.map((evidence) => evidence.paperId)).size;
  const citationCoverage =
    synthesis.findings.length === 0 ? 0 : round(coveredFindingsCount / synthesis.findings.length);
  const averagePaperScore =
    papers.length === 0
      ? 0
      : round(papers.reduce((total, paper) => total + (paper.score ?? 0), 0) / papers.length);

  const issues: string[] = [];

  if (papers.length === 0) {
    issues.push("No papers were retrieved, so the report cannot ground its findings in source evidence.");
  }

  if (chunks.length === 0 && papers.length > 0) {
    issues.push("No abstract or PDF chunks were extracted, so evidence cannot point to grounded text spans.");
  }

  if (supportedEvidenceCount === 0 && papers.length > 0) {
    issues.push("No findings are backed by valid paper and chunk references.");
  } else if (citationCoverage < 0.5) {
    issues.push("Less than half of the findings are covered by explicit evidence items.");
  }

  if (unsupportedEvidenceCount > 0) {
    issues.push(
      `${unsupportedEvidenceCount} evidence item(s) reference missing papers or chunks, or omit support / quote text.`
    );
  }

  if (papers.length > 1 && citationDiversity < 2) {
    issues.push("Evidence relies on too few distinct papers.");
  }

  if (papers.length > 0 && averagePaperScore < 8) {
    issues.push("Retrieved papers have weak keyword alignment with the current request.");
  }

  const verdict = deriveVerdict({
    citationCoverage,
    unsupportedEvidenceCount,
    citationDiversity
  });

  const recommendations = [
    "Increase citation coverage so each major finding has at least one explicit evidence item.",
    "Diversify supporting evidence across multiple retrieved papers.",
    "Ensure each evidence item references a valid chunk with a non-empty quote."
  ];

  const summary =
    verdict === "strong"
      ? `The report for \"${input.request.topic}\" has strong citation support and acceptable evidence diversity.`
      : verdict === "moderate"
        ? `The report for \"${input.request.topic}\" is usable, but some findings still need stronger evidence coverage.`
        : `The report for \"${input.request.topic}\" needs more evidence before it should be treated as reliable.`;

  return {
    verdict,
    summary,
    issues,
    recommendations,
    supportedEvidenceCount,
    unsupportedEvidenceCount,
    coveredFindingsCount,
    citationDiversity,
    citationCoverage
  };
}
