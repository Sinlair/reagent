import assert from "node:assert/strict";

import { rankPapers } from "../dist/workflows/paperRanker.js";
import { critiqueResearch } from "../dist/workflows/researchCritique.js";
import { ResearchWorkflow } from "../dist/workflows/researchWorkflow.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await runTest("rankPapers sorts stronger matches first and annotates rank metadata", () => {
    const request = {
      topic: "retrieval augmented generation",
      question: "How is retrieval augmented generation evaluated?"
    };
    const plan = {
      objective: request.question ?? request.topic,
      subquestions: ["What benchmarks are used for retrieval augmented generation?"],
      searchQueries: ["retrieval augmented generation benchmark"]
    };
    const papers = [
      {
        id: "rag-benchmark",
        title: "Retrieval Augmented Generation Benchmarking for Knowledge-Intensive QA",
        abstract: "We study retrieval augmented generation systems and compare benchmark setups.",
        authors: ["A. Researcher"],
        url: "https://example.com/rag-benchmark",
        year: 2025,
        venue: "ACL",
        doi: "10.1000/rag-benchmark",
        source: "crossref"
      },
      {
        id: "vision-paper",
        title: "A Vision Transformer Tutorial",
        abstract: "This tutorial focuses on image classification.",
        authors: ["B. Researcher"],
        url: "https://example.com/vit",
        year: 2019,
        venue: "CVPR",
        source: "crossref"
      }
    ];

    const ranked = rankPapers({ request, plan, papers });

    assert.equal(ranked[0]?.id, "rag-benchmark");
    assert.equal(ranked[0]?.rank, 1);
    assert.equal(ranked[1]?.rank, 2);
    assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));
    assert.ok(ranked[0]?.rankingReasons?.some((reason) => reason.includes("Title matches")));
  });

  await runTest("critiqueResearch flags unsupported evidence when chunk references are invalid", () => {
    const chunks = [
      {
        id: "chunk-1",
        paperId: "paper-1",
        ordinal: 1,
        sourceType: "pdf",
        text: "Retriever evaluation improves answer grounding.",
        pageNumber: 5
      }
    ];

    const critique = critiqueResearch({
      request: { topic: "retrieval augmented generation" },
      papers: [
        {
          id: "paper-1",
          title: "RAG Study",
          authors: ["A. Researcher"],
          url: "https://example.com/paper-1",
          source: "crossref",
          score: 11
        },
        {
          id: "paper-2",
          title: "Another RAG Study",
          authors: ["B. Researcher"],
          url: "https://example.com/paper-2",
          source: "crossref",
          score: 9
        }
      ],
      chunks,
      synthesis: {
        summary: "summary",
        findings: ["finding-1", "finding-2", "finding-3"],
        gaps: [],
        nextActions: [],
        warnings: [],
        evidence: [
          {
            claim: "finding-1",
            paperId: "paper-1",
            chunkId: "chunk-1",
            support: "Supported by the first paper.",
            quote: "Retriever evaluation improves answer grounding.",
            pageNumber: 5,
            sourceType: "pdf",
            confidence: "medium"
          },
          {
            claim: "finding-2",
            paperId: "missing-paper",
            chunkId: "missing-chunk",
            support: "",
            quote: "",
            sourceType: "abstract",
            confidence: "low"
          }
        ]
      }
    });

    assert.equal(critique.verdict, "weak");
    assert.equal(critique.supportedEvidenceCount, 1);
    assert.equal(critique.unsupportedEvidenceCount, 1);
    assert.equal(critique.citationCoverage, 0.33);
    assert.ok(critique.issues.some((issue) => issue.includes("missing papers or chunks")));
  });

  await runTest("ResearchWorkflow persists ranked papers, chunks, and critique metadata", async () => {
    class StubLlmClient {
      async planResearch(request) {
        return {
          objective: request.question ?? request.topic,
          subquestions: ["Which methods are most common?"],
          searchQueries: [request.topic]
        };
      }

      async synthesizeResearch(input) {
        return {
          summary: `Synthesized ${input.papers.length} papers from ${input.chunks.length} chunks.`,
          findings: input.chunks.slice(0, 2).map((chunk) => chunk.text),
          gaps: ["Need more citation-aware reranking."],
          nextActions: ["Add better PDF discovery."],
          warnings: [],
          evidence: input.chunks.slice(0, 2).map((chunk) => ({
            claim: `${chunk.paperId} is relevant.`,
            paperId: chunk.paperId,
            chunkId: chunk.id,
            support: `Matched chunk ${chunk.id}.`,
            quote: chunk.text,
            pageNumber: chunk.pageNumber,
            sourceType: chunk.sourceType,
            confidence: chunk.sourceType === "pdf" ? "high" : "medium"
          }))
        };
      }
    }

    class StubSearchProvider {
      async search() {
        return [
          {
            id: "paper-older",
            title: "Retrieval Systems Overview",
            abstract: "Overview of retrieval systems.",
            authors: ["A. Researcher"],
            url: "https://example.com/paper-older",
            year: 2018,
            venue: "SIGIR",
            source: "crossref"
          },
          {
            id: "paper-rag",
            title: "Retrieval Augmented Generation for Open-Domain QA",
            abstract: "Retrieval augmented generation improves open-domain question answering.",
            authors: ["B. Researcher"],
            url: "https://example.com/paper-rag",
            pdfUrl: "https://example.com/paper-rag.pdf",
            year: 2025,
            venue: "EMNLP",
            doi: "10.1000/paper-rag",
            source: "crossref"
          }
        ];
      }
    }

    class StubContentProvider {
      async collect() {
        return {
          chunks: [
            {
              id: "chunk-paper-rag-1",
              paperId: "paper-rag",
              ordinal: 1,
              sourceType: "pdf",
              text: "Retrieval augmented generation improves open-domain QA with grounded passages.",
              pageNumber: 3
            },
            {
              id: "chunk-paper-older-1",
              paperId: "paper-older",
              ordinal: 1,
              sourceType: "abstract",
              text: "Retrieval systems overview covering indexing and ranking.",
              pageNumber: undefined
            }
          ],
          warnings: []
        };
      }
    }

    class StubRepository {
      savedReport = null;

      async save(report) {
        this.savedReport = report;
      }

      async findByTaskId() {
        return this.savedReport;
      }
    }

    const repository = new StubRepository();
    const workflow = new ResearchWorkflow(
      new StubLlmClient(),
      new StubSearchProvider(),
      new StubContentProvider(),
      repository
    );

    const report = await workflow.run({
      topic: "retrieval augmented generation",
      question: "What are the common methods?"
    });

    assert.equal(report.papers[0]?.id, "paper-rag");
    assert.equal(report.papers[0]?.rank, 1);
    assert.equal(report.chunks[0]?.paperId, "paper-rag");
    assert.equal(report.chunks[0]?.sourceType, "pdf");
    assert.equal(report.evidence[0]?.chunkId, "chunk-paper-rag-1");
    assert.equal(report.critique.verdict, "strong");
    assert.equal(repository.savedReport?.critique.verdict, "strong");
    assert.equal(repository.savedReport?.chunks[0]?.id, "chunk-paper-rag-1");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
