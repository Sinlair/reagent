import { createHash } from "node:crypto";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { PaperContentProvider } from "../../domain/ports.js";
import type {
  ChunkSourceType,
  PaperCandidate,
  ResearchChunk,
  ResearchPlan,
  ResearchRequest
} from "../../types/research.js";

const MAX_FULL_TEXT_PAPERS = 3;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 40;
const CHUNK_SIZE = 1400;
const CHUNK_OVERLAP = 240;
const MIN_TEXT_LENGTH = 80;

interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

interface PdfTextItemLike {
  str?: string;
  hasEOL?: boolean;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function createChunkId(input: {
  taskId: string;
  paperId: string;
  sourceType: ChunkSourceType;
  ordinal: number;
  pageNumber?: number;
  text: string;
}): string {
  const hash = createHash("sha1")
    .update(
      [
        input.taskId,
        input.paperId,
        input.sourceType,
        String(input.ordinal),
        String(input.pageNumber ?? 0),
        input.text
      ].join("|")
    )
    .digest("hex");

  return `chunk_${hash}`;
}

function splitTextIntoChunks(text: string): string[] {
  const normalized = normalizeWhitespace(text);

  if (normalized.length === 0) {
    return [];
  }

  if (normalized.length <= CHUNK_SIZE) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + CHUNK_SIZE);

    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(CHUNK_SIZE / 2)) {
        end = boundary;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function buildAbstractChunk(taskId: string, paper: PaperCandidate): ResearchChunk[] {
  const text = normalizeWhitespace(paper.abstract ?? "");

  if (text.length === 0) {
    return [];
  }

  return [
    {
      id: createChunkId({
        taskId,
        paperId: paper.id,
        sourceType: "abstract",
        ordinal: 1,
        text
      }),
      paperId: paper.id,
      ordinal: 1,
      sourceType: "abstract",
      text
    }
  ];
}

function buildPdfChunks(
  taskId: string,
  paper: PaperCandidate,
  pages: ExtractedPdfPage[]
): ResearchChunk[] {
  const chunks: ResearchChunk[] = [];
  let ordinal = 1;

  for (const page of pages) {
    for (const text of splitTextIntoChunks(page.text)) {
      chunks.push({
        id: createChunkId({
          taskId,
          paperId: paper.id,
          sourceType: "pdf",
          ordinal,
          pageNumber: page.pageNumber,
          text
        }),
        paperId: paper.id,
        ordinal,
        sourceType: "pdf",
        text,
        pageNumber: page.pageNumber
      });
      ordinal += 1;
    }
  }

  return chunks;
}

async function extractPdfPages(pdfUrl: string): Promise<ExtractedPdfPage[]> {
  const response = await fetch(pdfUrl, {
    headers: {
      "User-Agent": "ReAgent/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`PDF request failed with status ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new Error("PDF response was empty");
  }

  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF exceeded ${MAX_PDF_BYTES} bytes`);
  }

  const loadingTask = getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false
  });
  const pdfDocument = await loadingTask.promise;

  try {
    const pageCount = Math.min(pdfDocument.numPages, MAX_PDF_PAGES);
    const pages: ExtractedPdfPage[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = normalizeWhitespace(
        textContent.items
          .map((item) => {
            const textItem = item as PdfTextItemLike;
            const segment = textItem.str ?? "";
            return textItem.hasEOL ? `${segment}\n` : `${segment} `;
          })
          .join("")
      );

      if (text.length >= MIN_TEXT_LENGTH) {
        pages.push({ pageNumber, text });
      }
    }

    return pages;
  } finally {
    await pdfDocument.destroy();
  }
}

export class PdfjsPaperContentProvider implements PaperContentProvider {
  async collect(input: {
    taskId: string;
    request: ResearchRequest;
    plan: ResearchPlan;
    papers: PaperCandidate[];
  }): Promise<{ chunks: ResearchChunk[]; warnings: string[] }> {
    const chunks: ResearchChunk[] = [];
    const warnings: string[] = [];

    for (const [index, paper] of input.papers.entries()) {
      let paperChunks: ResearchChunk[] = [];
      const shouldAttemptPdf = index < MAX_FULL_TEXT_PAPERS && Boolean(paper.pdfUrl);

      if (shouldAttemptPdf && paper.pdfUrl) {
        try {
          const pages = await extractPdfPages(paper.pdfUrl);
          paperChunks = buildPdfChunks(input.taskId, paper, pages);

          if (paperChunks.length === 0) {
            warnings.push(`PDF parsing produced no usable text for \"${paper.title}\".`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown PDF parsing error";
          warnings.push(`PDF parsing failed for \"${paper.title}\": ${message}`);
        }
      }

      if (paperChunks.length === 0) {
        paperChunks = buildAbstractChunk(input.taskId, paper);
      }

      if (paperChunks.length === 0) {
        warnings.push(`No extractable text was available for \"${paper.title}\".`);
        continue;
      }

      chunks.push(...paperChunks);
    }

    return { chunks, warnings };
  }
}
