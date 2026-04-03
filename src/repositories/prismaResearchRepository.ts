import type { ResearchRepository } from "../domain/ports.js";
import type {
  ChunkSourceType,
  CritiqueVerdict,
  EvidenceConfidence,
  EvidenceItem,
  PaperCandidate,
  ResearchChunk,
  ResearchCritique,
  ResearchPlan,
  ResearchReport,
  ResearchReportSummary
} from "../types/research.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";

const confidenceLevels: EvidenceConfidence[] = ["low", "medium", "high"];
const critiqueVerdicts: CritiqueVerdict[] = ["weak", "moderate", "strong"];
const chunkSourceTypes: ChunkSourceType[] = ["abstract", "pdf"];

function toJsonArray(values: string[]): Prisma.InputJsonValue {
  return values;
}

function readStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function readOptionalStringArray(value: Prisma.JsonValue | null): string[] | undefined {
  if (value === null) {
    return undefined;
  }

  return readStringArray(value);
}

function readConfidence(value: string): EvidenceConfidence {
  return confidenceLevels.includes(value as EvidenceConfidence)
    ? (value as EvidenceConfidence)
    : "low";
}

function readChunkSourceType(value: string | null | undefined): ChunkSourceType {
  return chunkSourceTypes.includes(value as ChunkSourceType)
    ? (value as ChunkSourceType)
    : "abstract";
}

function readCritiqueVerdict(value: string | null): CritiqueVerdict {
  return critiqueVerdicts.includes(value as CritiqueVerdict)
    ? (value as CritiqueVerdict)
    : "weak";
}

function mapPlan(report: ResearchReport): Pick<
  Prisma.ResearchReportCreateInput,
  "objective" | "subquestions" | "searchQueries"
> {
  return {
    objective: report.plan.objective,
    subquestions: toJsonArray(report.plan.subquestions),
    searchQueries: toJsonArray(report.plan.searchQueries)
  };
}

function mapPaperCreate(paper: PaperCandidate) {
  return {
    externalId: paper.id,
    title: paper.title,
    abstract: paper.abstract ?? null,
    authors: toJsonArray(paper.authors),
    url: paper.url,
    pdfUrl: paper.pdfUrl ?? null,
    year: paper.year ?? null,
    venue: paper.venue ?? null,
    doi: paper.doi ?? null,
    source: paper.source,
    relevanceReason: paper.relevanceReason ?? null,
    rank: paper.rank ?? null,
    score: paper.score ?? null,
    rankingReasons:
      paper.rankingReasons && paper.rankingReasons.length > 0
        ? toJsonArray(paper.rankingReasons)
        : Prisma.JsonNull
  };
}

function mapChunkCreate(chunk: ResearchChunk) {
  return {
    id: chunk.id,
    paperId: chunk.paperId,
    ordinal: chunk.ordinal,
    sourceType: chunk.sourceType,
    text: chunk.text,
    pageNumber: chunk.pageNumber ?? null
  };
}

function mapEvidenceCreate(evidence: EvidenceItem) {
  return {
    claim: evidence.claim,
    paperId: evidence.paperId,
    chunkId: evidence.chunkId,
    support: evidence.support,
    quote: evidence.quote,
    pageNumber: evidence.pageNumber ?? null,
    sourceType: evidence.sourceType,
    confidence: evidence.confidence
  };
}

function mapRecordToPlan(record: {
  objective: string;
  subquestions: Prisma.JsonValue;
  searchQueries: Prisma.JsonValue;
}): ResearchPlan {
  return {
    objective: record.objective,
    subquestions: readStringArray(record.subquestions),
    searchQueries: readStringArray(record.searchQueries)
  };
}

function mapCritique(report: ResearchReport): Pick<
  Prisma.ResearchReportCreateInput,
  | "critiqueVerdict"
  | "critiqueSummary"
  | "critiqueIssues"
  | "critiqueRecommendations"
  | "supportedEvidenceCount"
  | "unsupportedEvidenceCount"
  | "coveredFindingsCount"
  | "citationDiversity"
  | "citationCoverage"
> {
  return {
    critiqueVerdict: report.critique.verdict,
    critiqueSummary: report.critique.summary,
    critiqueIssues: toJsonArray(report.critique.issues),
    critiqueRecommendations: toJsonArray(report.critique.recommendations),
    supportedEvidenceCount: report.critique.supportedEvidenceCount,
    unsupportedEvidenceCount: report.critique.unsupportedEvidenceCount,
    coveredFindingsCount: report.critique.coveredFindingsCount,
    citationDiversity: report.critique.citationDiversity,
    citationCoverage: report.critique.citationCoverage
  };
}

function mapRecordToCritique(record: {
  critiqueVerdict: string | null;
  critiqueSummary: string | null;
  critiqueIssues: Prisma.JsonValue | null;
  critiqueRecommendations: Prisma.JsonValue | null;
  supportedEvidenceCount: number | null;
  unsupportedEvidenceCount: number | null;
  coveredFindingsCount: number | null;
  citationDiversity: number | null;
  citationCoverage: number | null;
}): ResearchCritique {
  if (!record.critiqueSummary) {
    return {
      verdict: "weak",
      summary: "Critique metadata is not available for this report.",
      issues: ["Regenerate the report to populate critique metadata."],
      recommendations: [
        "Re-run the workflow so ranking and critique data are persisted with the report."
      ],
      supportedEvidenceCount: 0,
      unsupportedEvidenceCount: 0,
      coveredFindingsCount: 0,
      citationDiversity: 0,
      citationCoverage: 0
    };
  }

  return {
    verdict: readCritiqueVerdict(record.critiqueVerdict),
    summary: record.critiqueSummary,
    issues: readStringArray(record.critiqueIssues ?? []),
    recommendations: readStringArray(record.critiqueRecommendations ?? []),
    supportedEvidenceCount: record.supportedEvidenceCount ?? 0,
    unsupportedEvidenceCount: record.unsupportedEvidenceCount ?? 0,
    coveredFindingsCount: record.coveredFindingsCount ?? 0,
    citationDiversity: record.citationDiversity ?? 0,
    citationCoverage: record.citationCoverage ?? 0
  };
}

export class PrismaResearchRepository implements ResearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(report: ResearchReport): Promise<void> {
    const baseData = {
      topic: report.topic,
      question: report.question ?? null,
      generatedAt: new Date(report.generatedAt),
      summary: report.summary,
      findings: toJsonArray(report.findings),
      gaps: toJsonArray(report.gaps),
      nextActions: toJsonArray(report.nextActions),
      warnings: toJsonArray(report.warnings),
      ...mapPlan(report),
      ...mapCritique(report)
    } satisfies Omit<Prisma.ResearchReportCreateInput, "taskId" | "papers" | "chunks" | "evidence">;

    await this.prisma.researchReport.upsert({
      where: { taskId: report.taskId },
      create: {
        taskId: report.taskId,
        ...baseData,
        papers: {
          create: report.papers.map(mapPaperCreate)
        },
        chunks: {
          create: report.chunks.map(mapChunkCreate)
        },
        evidence: {
          create: report.evidence.map(mapEvidenceCreate)
        }
      },
      update: {
        ...baseData,
        papers: {
          deleteMany: {},
          create: report.papers.map(mapPaperCreate)
        },
        chunks: {
          deleteMany: {},
          create: report.chunks.map(mapChunkCreate)
        },
        evidence: {
          deleteMany: {},
          create: report.evidence.map(mapEvidenceCreate)
        }
      }
    });
  }

  async findByTaskId(taskId: string): Promise<ResearchReport | null> {
    const record = await this.prisma.researchReport.findUnique({
      where: { taskId },
      include: {
        papers: {
          orderBy: [{ rank: "asc" }, { id: "asc" }]
        },
        chunks: {
          orderBy: [{ paperId: "asc" }, { ordinal: "asc" }]
        },
        evidence: {
          orderBy: { id: "asc" }
        }
      }
    });

    if (!record) {
      return null;
    }

    return {
      taskId: record.taskId,
      topic: record.topic,
      question: record.question ?? undefined,
      generatedAt: record.generatedAt.toISOString(),
      plan: mapRecordToPlan(record),
      papers: record.papers.map((paper) => ({
        id: paper.externalId,
        title: paper.title,
        abstract: paper.abstract ?? undefined,
        authors: readStringArray(paper.authors),
        url: paper.url,
        pdfUrl: paper.pdfUrl ?? undefined,
        year: paper.year ?? undefined,
        venue: paper.venue ?? undefined,
        doi: paper.doi ?? undefined,
        source: paper.source,
        relevanceReason: paper.relevanceReason ?? undefined,
        rank: paper.rank ?? undefined,
        score: paper.score ?? undefined,
        rankingReasons: readOptionalStringArray(paper.rankingReasons)
      })),
      chunks: record.chunks.map((chunk) => ({
        id: chunk.id,
        paperId: chunk.paperId,
        ordinal: chunk.ordinal,
        sourceType: readChunkSourceType(chunk.sourceType),
        text: chunk.text,
        pageNumber: chunk.pageNumber ?? undefined
      })),
      summary: record.summary,
      findings: readStringArray(record.findings),
      gaps: readStringArray(record.gaps),
      nextActions: readStringArray(record.nextActions),
      warnings: readStringArray(record.warnings),
      critique: mapRecordToCritique(record),
      evidence: record.evidence.map((evidence) => ({
        claim: evidence.claim,
        paperId: evidence.paperId,
        chunkId: evidence.chunkId ?? "",
        support: evidence.support,
        quote: evidence.quote ?? evidence.support,
        pageNumber: evidence.pageNumber ?? undefined,
        sourceType: readChunkSourceType(evidence.sourceType),
        confidence: readConfidence(evidence.confidence)
      }))
    };
  }

  async listRecent(limit: number): Promise<ResearchReportSummary[]> {
    const records = await this.prisma.researchReport.findMany({
      orderBy: [{ generatedAt: "desc" }, { taskId: "desc" }],
      take: limit,
      include: {
        papers: {
          select: { id: true }
        },
        evidence: {
          select: { id: true }
        }
      }
    });

    return records.map((record) => ({
      taskId: record.taskId,
      topic: record.topic,
      question: record.question ?? undefined,
      generatedAt: record.generatedAt.toISOString(),
      summary: record.summary,
      critiqueVerdict: readCritiqueVerdict(record.critiqueVerdict),
      paperCount: record.papers.length,
      evidenceCount: record.evidence.length
    }));
  }
}
