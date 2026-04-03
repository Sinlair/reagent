import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Fastify from "fastify";

import { registerResearchRoutes } from "../dist/routes/research.js";
import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDiscoveryService } from "../dist/services/researchDiscoveryService.js";
import { ResearchLinkIngestionService } from "../dist/services/researchLinkIngestionService.js";
import { ResearchMemoryRegistryService } from "../dist/services/researchMemoryRegistryService.js";
import { ResearchModuleAssetService } from "../dist/services/researchModuleAssetService.js";
import { ResearchPaperAnalysisService } from "../dist/services/researchPaperAnalysisService.js";
import { ResearchRepoAnalysisService } from "../dist/services/researchRepoAnalysisService.js";
import { ResearchTaskService } from "../dist/services/researchTaskService.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-memory-graph-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function buildStubResearchService() {
  const generatedAt = new Date().toISOString();
  const report = {
    taskId: "task-1",
    topic: "Weekly RAG Synthesis",
    question: "What changed this week?",
    generatedAt,
    plan: {
      objective: "Weekly RAG Synthesis",
      subquestions: ["What changed?"],
      searchQueries: ["multimodal rag"]
    },
    papers: [
      {
        id: "paper-1",
        title: "A Strong Multimodal RAG Baseline",
        authors: ["A. Researcher"],
        url: "https://example.com/paper-1",
        source: "crossref"
      }
    ],
    chunks: [],
    summary: "Weekly RAG summary.",
    findings: ["Finding one"],
    gaps: [],
    nextActions: ["Follow up on repo code paths"],
    evidence: [],
    warnings: [],
    critique: {
      verdict: "moderate",
      summary: "Some evidence was collected.",
      issues: [],
      recommendations: [],
      supportedEvidenceCount: 1,
      unsupportedEvidenceCount: 0,
      coveredFindingsCount: 1,
      citationDiversity: 1,
      citationCoverage: 1
    }
  };

  return {
    async runResearch() {
      return report;
    },
    async listRecentReports() {
      return [
        {
          taskId: report.taskId,
          topic: report.topic,
          question: report.question,
          generatedAt: report.generatedAt,
          summary: report.summary,
          critiqueVerdict: report.critique.verdict,
          paperCount: report.papers.length,
          evidenceCount: report.evidence.length
        }
      ];
    },
    async getReport(taskId) {
      return taskId === report.taskId ? report : null;
    }
  };
}

function installMockFetch() {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const href = String(url);
    if (href === "https://example.com/post") {
      return {
        ok: true,
        text: async () => `
          <html>
            <head><title>Article About RAG</title></head>
            <body>
              <img src="https://example.com/image.png" />
              <a href="https://arxiv.org/abs/2501.12345">paper</a>
              <a href="https://github.com/example/research-repo">code</a>
            </body>
          </html>
        `,
      };
    }
    if (href === "https://github.com/example/research-repo") {
      return {
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="example/research-repo" />
              <meta property="og:description" content="Reference implementation for multimodal RAG." />
            </head>
            <body><a href="/example/research-repo/tree/main/src">src</a></body>
          </html>
        `,
      };
    }
    if (href.includes("archive/refs/heads/main.zip")) {
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      };
    }
    if (href === "https://example.com/image.png") {
      return {
        ok: true,
        headers: { get: (name) => name === "content-type" ? "image/png" : null },
        arrayBuffer: async () => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z0xUAAAAASUVORK5CYII=", "base64"),
      };
    }
    if (href.includes("arxiv.org/pdf/2501.12345.pdf")) {
      return {
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };

  return () => {
    global.fetch = originalFetch;
  };
}

async function seedGraphWorkspace(dir) {
  const researchService = buildStubResearchService();
  const directionService = new ResearchDirectionService(dir);
  const direction = await directionService.upsertProfile({ label: "Multimodal RAG" });

  const discoveryService = new ResearchDiscoveryService(dir, {
    searchProvider: {
      async search() {
        return [
          {
            id: "paper-1",
            title: "A Strong Multimodal RAG Baseline",
            abstract: "rag abstract",
            authors: ["A. Researcher"],
            url: "https://example.com/paper-1",
            year: 2026,
            venue: "NeurIPS",
            source: "crossref"
          }
        ];
      }
    }
  });
  await discoveryService.runDiscovery({ directionId: direction.id, topK: 3 });

  const restoreFetch = installMockFetch();

  try {
    const linkService = new ResearchLinkIngestionService(dir);
    const sourceItem = await linkService.ingest({ url: "https://example.com/post" });
    const paperService = new ResearchPaperAnalysisService(dir);
    const paperReport = await paperService.analyze({ sourceItemId: sourceItem.id });
    const repoService = new ResearchRepoAnalysisService(dir);
    const repoReport = await repoService.analyze({ url: "https://github.com/example/research-repo" });
    const moduleService = new ResearchModuleAssetService(dir);
    const moduleAsset = await moduleService.extract({ url: "https://github.com/example/research-repo" });

    const presentationsDir = path.join(dir, "research", "presentations");
    const markdownPath = path.join(presentationsDir, "deck.md");
    const pptxPath = path.join(presentationsDir, "deck.pptx");
    await mkdir(presentationsDir, { recursive: true });
    await writeFile(markdownPath, "# Deck\n", "utf8");
    await writeFile(pptxPath, Buffer.from([1, 2, 3]));
    await writeFile(
      path.join(presentationsDir, "index.json"),
      `${JSON.stringify({
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: "deck-1",
            title: "Deck",
            generatedAt: new Date().toISOString(),
            sourceReportTaskIds: ["task-1"],
            slideMarkdown: "# Deck",
            filePath: markdownPath,
            pptxPath,
            imagePaths: []
          }
        ]
      }, null, 2)}\n`,
      "utf8"
    );

    return {
      researchService,
      directionService,
      discoveryService,
      sourceItem,
      paperReport,
      repoReport,
      moduleAsset,
      restoreFetch,
    };
  } catch (error) {
    restoreFetch();
    throw error;
  }
}

async function main() {
  await runTest("ResearchMemoryRegistryService builds filtered graph views and node detail payloads", async () => {
    await withTempDir(async (dir) => {
      const seeded = await seedGraphWorkspace(dir);

      try {
        const registry = new ResearchMemoryRegistryService(dir, seeded.researchService);
        const graph = await registry.buildGraph();
        assert.equal(graph.nodes.some((node) => node.type === "direction"), true);
        assert.equal(graph.nodes.some((node) => node.type === "source_item"), true);
        assert.equal(graph.nodes.some((node) => node.type === "paper"), true);
        assert.equal(graph.nodes.some((node) => node.type === "paper_report"), true);
        assert.equal(graph.nodes.some((node) => node.type === "repo"), true);
        assert.equal(graph.nodes.some((node) => node.type === "repo_report"), true);
        assert.equal(graph.nodes.some((node) => node.type === "module_asset"), true);
        assert.equal(graph.nodes.some((node) => node.type === "presentation"), true);
        assert.equal(graph.nodes.some((node) => node.type === "workflow_report"), true);
        assert.equal(graph.edges.length > 0, true);

        const repoOnly = await registry.buildGraph({
          types: ["repo_report"],
          search: "research-repo"
        });
        assert.equal(repoOnly.nodes.length, 1);
        assert.equal(repoOnly.nodes[0]?.type, "repo_report");
        assert.equal(repoOnly.nodes[0]?.externalUrl, "https://github.com/example/research-repo");

        const repoNode = graph.nodes.find((node) => node.type === "repo_report");
        assert.ok(repoNode);
        const detail = await registry.getNodeDetail(repoNode.id);
        assert.ok(detail);
        assert.equal(detail.node.id, repoNode.id);
        assert.equal(detail.relatedNodes.some((node) => node.type === "paper_report"), true);
        assert.equal(detail.links.some((link) => link.href.includes("/api/research/repo-reports/")), true);
        assert.equal(detail.links.some((link) => link.href === "https://github.com/example/research-repo"), true);

        const canonicalPaper = graph.nodes.find(
          (node) => node.type === "paper" && Number(node.meta.paperReports || 0) > 0
        );
        assert.ok(canonicalPaper);
        const canonicalPaperDetail = await registry.getNodeDetail(canonicalPaper.id);
        assert.ok(canonicalPaperDetail);
        assert.equal(canonicalPaperDetail.raw.kind, "canonical_paper");
        assert.equal(canonicalPaperDetail.relatedEdges.some((edge) => edge.label === "analyzes_paper"), true);
      } finally {
        seeded.restoreFetch();
      }
    });
  });

  await runTest("Research graph routes expose filtered graph, node detail, and artifact download endpoints", async () => {
    await withTempDir(async (dir) => {
      const seeded = await seedGraphWorkspace(dir);
      const app = Fastify();

      try {
        const taskService = new ResearchTaskService(dir, seeded.researchService);
        await registerResearchRoutes(
          app,
          dir,
          seeded.researchService,
          taskService,
          seeded.directionService,
          seeded.discoveryService,
          {
            async getStatus() {
              return { enabled: false };
            },
            async configure() {
              return { enabled: false };
            }
          }
        );

        const graphResponse = await app.inject({
          method: "GET",
          url: "/api/research/memory-graph?types=repo_report&search=research-repo"
        });
        assert.equal(graphResponse.statusCode, 200);
        const graphPayload = graphResponse.json();
        assert.equal(graphPayload.nodes.length, 1);
        assert.equal(graphPayload.nodes[0]?.type, "repo_report");

        const canonicalGraphResponse = await app.inject({
          method: "GET",
          url: "/api/research/memory-graph?types=paper,repo"
        });
        assert.equal(canonicalGraphResponse.statusCode, 200);
        const canonicalGraphPayload = canonicalGraphResponse.json();
        assert.equal(canonicalGraphPayload.nodes.some((node) => node.type === "paper"), true);
        assert.equal(canonicalGraphPayload.nodes.some((node) => node.type === "repo"), true);

        const nodeId = encodeURIComponent(graphPayload.nodes[0].id);
        const detailResponse = await app.inject({
          method: "GET",
          url: `/api/research/memory-graph/${nodeId}`
        });
        assert.equal(detailResponse.statusCode, 200);
        const detailPayload = detailResponse.json();
        assert.equal(detailPayload.node.type, "repo_report");
        assert.equal(detailPayload.raw.url, "https://github.com/example/research-repo");

        const artifactResponse = await app.inject({
          method: "GET",
          url: "/api/research/artifact?path=research/presentations/deck.md"
        });
        assert.equal(artifactResponse.statusCode, 200);
        assert.equal(artifactResponse.headers["content-type"], "text/markdown; charset=utf-8");
        assert.ok(artifactResponse.body.includes("# Deck"));
      } finally {
        seeded.restoreFetch();
        await app.close();
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
