import { z } from "zod";

const NonEmptyStringSchema = z.string().trim().min(1);
const StringListSchema = z.array(NonEmptyStringSchema);

export const ResearchRequestSchema = z.object({
  topic: z.string().trim().min(3, "topic must contain at least 3 characters"),
  question: z.string().trim().min(3).optional(),
  maxPapers: z.number().int().min(1).max(20).default(10)
});

export const ResearchPlanSchema = z.object({
  objective: NonEmptyStringSchema,
  subquestions: StringListSchema,
  searchQueries: StringListSchema
});

export const ChunkSourceTypeSchema = z.enum(["abstract", "pdf"]);
export const EvidenceConfidenceSchema = z.enum(["low", "medium", "high"]);

export const EvidenceItemSchema = z.object({
  claim: NonEmptyStringSchema,
  paperId: NonEmptyStringSchema,
  chunkId: NonEmptyStringSchema,
  support: NonEmptyStringSchema,
  quote: NonEmptyStringSchema,
  pageNumber: z.number().int().positive().optional(),
  sourceType: ChunkSourceTypeSchema,
  confidence: EvidenceConfidenceSchema
});

export const ResearchSynthesisSchema = z.object({
  summary: NonEmptyStringSchema,
  findings: StringListSchema,
  gaps: StringListSchema,
  nextActions: StringListSchema,
  evidence: z.array(EvidenceItemSchema),
  warnings: z.array(NonEmptyStringSchema)
});

export type ResearchRequestInput = z.infer<typeof ResearchRequestSchema>;
