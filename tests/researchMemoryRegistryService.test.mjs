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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 1500, intervalMs = 25) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for condition.");
}

function buildStubResearchService() {
  const reports = new Map();

  function buildReport(taskId = "task-1", request = {}) {
    return {
      taskId,
      topic: request.topic || "Weekly RAG Synthesis",
      question: request.question || "What changed this week?",
      generatedAt: new Date().toISOString(),
      plan: {
        objective: request.topic || "Weekly RAG Synthesis",
        subquestions: ["What changed?"],
        searchQueries: [request.topic || "multimodal rag"]
      },
      papers: [
        {
          id: "paper-1",
          title: "A Strong Multimodal RAG Baseline",
          authors: ["A. Researcher"],
          url: "https://example.com/paper-1",
          source: "crossref"
        },
        {
          id: "paper-2",
          title: "Retriever Planning for Multimodal Agents",
          authors: ["B. Scientist"],
          url: "https://example.com/paper-2",
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
  }

  return {
    async runResearch(request = {}, options = {}) {
      const report = buildReport(options.taskId || "task-1", request);
      reports.set(report.taskId, report);
      return report;
    },
    async listRecentReports() {
      const recent = [...reports.values()];
      if (recent.length > 0) {
        return recent.map((report) => ({
          taskId: report.taskId,
          topic: report.topic,
          question: report.question,
          generatedAt: report.generatedAt,
          summary: report.summary,
          critiqueVerdict: report.critique.verdict,
          paperCount: report.papers.length,
          evidenceCount: report.evidence.length
        }));
      }

      const report = buildReport();
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
      return reports.get(taskId) || (taskId === "task-1" ? buildReport() : null);
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

        const workflowPaper = graph.nodes.find(
          (node) => node.type === "paper" && node.label === "Retriever Planning for Multimodal Agents"
        );
        assert.ok(workflowPaper);
        assert.equal(Number(workflowPaper.meta.workflowReports || 0) > 0, true);

        const paperGraph = await registry.buildGraph({ view: "paper" });
        assert.equal(paperGraph.nodes.every((node) => node.type === "paper"), true);
        assert.equal(
          paperGraph.edges.some((edge) => edge.kind === "shared_workflow_report"),
          true
        );

        const paperDetail = await registry.getNodeDetail(workflowPaper.id, { view: "paper" });
        assert.ok(paperDetail);
        assert.equal(paperDetail.raw.kind, "paper_relation_node");
        assert.equal(
          paperDetail.relatedNodes.some((node) => node.label === "A Strong Multimodal RAG Baseline"),
          true
        );

        const graphQuery = await registry.queryGraph({ view: "paper", search: "Retriever" }, 4);
        assert.equal(graphQuery.view, "paper");
        assert.equal(
          graphQuery.topNodes.some((item) => item.node.label === "Retriever Planning for Multimodal Agents"),
          true
        );

        const paperBaseline = paperGraph.nodes.find((node) => node.label === "A Strong Multimodal RAG Baseline");
        assert.ok(paperBaseline);

        const pathResult = await registry.findPath(paperBaseline.id, workflowPaper.id, { view: "paper" });
        assert.equal(pathResult.connected, true);
        assert.equal(pathResult.hops, 1);
        assert.deepEqual(pathResult.pathNodeIds, [paperBaseline.id, workflowPaper.id]);

        const explainResult = await registry.explainConnection(paperBaseline.id, workflowPaper.id, { view: "paper" });
        assert.equal(explainResult.connected, true);
        assert.equal(explainResult.relationType, "direct");
        assert.equal(explainResult.directEdges.some((edge) => edge.kind === "shared_workflow_report"), true);

        const report = await registry.buildGraphReport({ view: "paper" }, 5);
        assert.equal(report.view, "paper");
        assert.equal(report.hubs.length > 0, true);
        assert.equal(report.components.length > 0, true);
        assert.equal(report.summary.length > 0, true);
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

        const createdTask = await taskService.enqueueTask({
          topic: "Retryable research round",
          question: "What should be reviewed?"
        });
        const completedTask = await waitFor(async () => {
          const current = await taskService.getTask(createdTask.taskId);
          return current?.state === "completed" ? current : null;
        });

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

        const paperGraphResponse = await app.inject({
          method: "GET",
          url: "/api/research/memory-graph?view=paper"
        });
        assert.equal(paperGraphResponse.statusCode, 200);
        const paperGraphPayload = paperGraphResponse.json();
        assert.equal(paperGraphPayload.nodes.every((node) => node.type === "paper"), true);
        assert.equal(
          paperGraphPayload.edges.some((edge) => edge.kind === "shared_workflow_report"),
          true
        );

        const nodeId = encodeURIComponent(graphPayload.nodes[0].id);
        const detailResponse = await app.inject({
          method: "GET",
          url: `/api/research/memory-graph/${nodeId}`
        });
        assert.equal(detailResponse.statusCode, 200);
        const detailPayload = detailResponse.json();
        assert.equal(detailPayload.node.type, "repo_report");
        assert.equal(detailPayload.raw.url, "https://github.com/example/research-repo");

        const paperNodeId = encodeURIComponent(
          paperGraphPayload.nodes.find((node) => node.label === "Retriever Planning for Multimodal Agents").id
        );
        const paperDetailResponse = await app.inject({
          method: "GET",
          url: `/api/research/memory-graph/${paperNodeId}?view=paper`
        });
        assert.equal(paperDetailResponse.statusCode, 200);
        const paperDetailPayload = paperDetailResponse.json();
        assert.equal(paperDetailPayload.raw.kind, "paper_relation_node");

        const paperBaselineId = encodeURIComponent(
          paperGraphPayload.nodes.find((node) => node.label === "A Strong Multimodal RAG Baseline").id
        );

        const pathResponse = await app.inject({
          method: "GET",
          url: `/api/research/memory-graph/path?from=${paperBaselineId}&to=${paperNodeId}&view=paper`
        });
        assert.equal(pathResponse.statusCode, 200);
        const pathPayload = pathResponse.json();
        assert.equal(pathPayload.connected, true);
        assert.equal(pathPayload.hops, 1);

        const explainResponse = await app.inject({
          method: "GET",
          url: `/api/research/memory-graph/explain?from=${paperBaselineId}&to=${paperNodeId}&view=paper`
        });
        assert.equal(explainResponse.statusCode, 200);
        const explainPayload = explainResponse.json();
        assert.equal(explainPayload.connected, true);
        assert.equal(explainPayload.relationType, "direct");

        const reportResponse = await app.inject({
          method: "GET",
          url: "/api/research/memory-graph/report?view=paper&limit=4"
        });
        assert.equal(reportResponse.statusCode, 200);
        const reportPayload = reportResponse.json();
        assert.equal(reportPayload.view, "paper");
        assert.equal(reportPayload.hubs.length > 0, true);
        assert.equal(reportPayload.components.length > 0, true);

        const artifactResponse = await app.inject({
          method: "GET",
          url: "/api/research/artifact?path=research/presentations/deck.md"
        });
        assert.equal(artifactResponse.statusCode, 200);
        assert.equal(artifactResponse.headers["content-type"], "text/markdown; charset=utf-8");
        assert.ok(artifactResponse.body.includes("# Deck"));

        const blockedArtifactResponse = await app.inject({
          method: "GET",
          url: "/api/research/artifact?path=package.json"
        });
        assert.equal(blockedArtifactResponse.statusCode, 400);

        const taskResponse = await app.inject({
          method: "GET",
          url: `/api/research/tasks/${completedTask.taskId}`
        });
        assert.equal(taskResponse.statusCode, 200);
        const taskPayload = taskResponse.json();
        assert.equal(taskPayload.taskId, completedTask.taskId);
        assert.equal(taskPayload.handoff.taskId, completedTask.taskId);
        assert.equal(taskPayload.handoff.reviewStatus, "passed");
        assert.equal(taskPayload.handoff.handoffPath, `research/rounds/${completedTask.taskId}/handoff.json`);
        assert.equal("report" in taskPayload, false);

        const handoffResponse = await app.inject({
          method: "GET",
          url: `/api/research/tasks/${completedTask.taskId}/handoff`
        });
        assert.equal(handoffResponse.statusCode, 200);
        const handoffPayload = handoffResponse.json();
        assert.equal(handoffPayload.taskId, completedTask.taskId);
        assert.equal(handoffPayload.state, "completed");

        const reportResponseWithTaskMeta = await app.inject({
          method: "GET",
          url: `/api/research/${completedTask.taskId}`
        });
        assert.equal(reportResponseWithTaskMeta.statusCode, 200);
        const reportWithTaskMetaPayload = reportResponseWithTaskMeta.json();
        assert.equal(reportWithTaskMetaPayload.taskId, completedTask.taskId);
        assert.equal(reportWithTaskMetaPayload.taskMeta.taskId, completedTask.taskId);
        assert.equal(reportWithTaskMetaPayload.taskMeta.handoff.taskId, completedTask.taskId);
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
