import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDiscoveryService } from "../dist/services/researchDiscoveryService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-discovery-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchDiscoveryService ranks papers from direction profiles", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        label: "Multimodal RAG",
        targetProblem: "Improve long-document multimodal retrieval quality.",
        preferredVenues: ["NeurIPS"],
        preferredDatasets: ["MMMU"],
        preferredBenchmarks: ["LongDocBench"],
        preferredPaperStyles: ["engineering", "reproducibility"],
        knownBaselines: ["RAG"],
        evaluationPriorities: ["retrieval recall"],
        shortTermValidationTargets: ["LongDocBench"],
        blockedDirections: ["image classification"],
        currentGoals: ["Find practical retrieval modules"],
        queryHints: ["multimodal rag retrieval augmentation"]
      });

      const searchCalls = [];
      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search(input) {
            searchCalls.push(input.plan.searchQueries[0]);
            return [
              {
                id: `${input.plan.searchQueries[0]}-paper-a`,
                title: `A Strong ${input.request.topic} Paper`,
                abstract: "We improve long-document multimodal retrieval on MMMU and LongDocBench, beat a RAG baseline, and optimize retrieval recall with a practical module.",
                authors: ["A. Researcher"],
                url: `https://example.com/${encodeURIComponent(input.plan.searchQueries[0])}/a`,
                pdfUrl: `https://example.com/${encodeURIComponent(input.plan.searchQueries[0])}/a.pdf`,
                year: 2026,
                venue: "NeurIPS",
                doi: `10.1000/${encodeURIComponent(input.plan.searchQueries[0])}-a`,
                source: "crossref",
                relevanceReason: `Retrieved for ${input.plan.searchQueries[0]}`
              },
              {
                id: `${input.plan.searchQueries[0]}-paper-b`,
                title: `A Weak ${input.request.topic} Image Classification Baseline`,
                abstract: "Generic image classification baseline paper.",
                authors: ["B. Researcher"],
                url: `https://example.com/${encodeURIComponent(input.plan.searchQueries[0])}/b`,
                year: 2021,
                venue: "Workshop",
                source: "crossref",
                relevanceReason: `Retrieved for ${input.plan.searchQueries[0]}`
              }
            ];
          }
        }
      });

      const result = await discoveryService.runDiscovery({ topK: 10, maxPapersPerQuery: 2 });

      assert.equal(result.items.length > 0, true);
      assert.equal(result.items[0]?.rank, 1);
      assert.equal(result.items[0]?.venuePreferenceMatched, true);
      assert.equal(result.items[0]?.datasetOrBenchmarkMatched, true);
      assert.equal(result.items[0]?.targetProblemMatched, true);
      assert.equal(result.items[0]?.baselineOrEvaluationMatched, true);
      assert.equal(result.items[0]?.blockedTopicMatched, false);
      assert.equal(result.items.some((item) => item.blockedTopicMatched), true);
      assert.equal(result.items[0]?.rankingReasons?.some((reason) => reason.includes("Target problem / validation match.")), true);
      assert.equal(result.digest.includes("Daily discovery for Multimodal RAG"), true);
      assert.equal(searchCalls.length > 0, true);

      const runs = await discoveryService.listRecentRuns();
      assert.equal(runs.length, 1);
      assert.equal(runs[0]?.itemCount, result.items.length);
    });
  });

  await runTest("ResearchDiscoveryService can push digest to WeChat callback", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        label: "Agentic Retrieval",
        queryHints: ["agentic retrieval"]
      });

      const pushes = [];
      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search() {
            return [
              {
                id: "paper-1",
                title: "Agentic Retrieval with Tool Use",
                abstract: "A recent paper on agentic retrieval.",
                authors: ["A. Researcher"],
                url: "https://example.com/paper-1",
                year: 2026,
                venue: "ICLR",
                source: "crossref"
              }
            ];
          }
        },
        pushDigest: async (input) => {
          pushes.push(input);
        }
      });

      const result = await discoveryService.runDiscovery({
        pushToWechat: true,
        senderId: "wx-user-discovery",
        senderName: "Research Owner"
      });

      assert.equal(result.pushed, true);
      assert.equal(pushes.length, 1);
      assert.equal(pushes[0]?.senderId, "wx-user-discovery");
      assert.equal(String(pushes[0]?.text).includes("Agentic Retrieval with Tool Use"), true);
    });
  });

  await runTest("ResearchDiscoveryService deduplicates normalized and near-duplicate discovery candidates", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        label: "Browser Agents",
        targetProblem: "Find strong browser-agent baselines with reproducible evaluations.",
        knownBaselines: ["Browser agent baseline"],
        evaluationPriorities: ["task success rate"],
        queryHints: ["browser agents"],
      });

      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search(input) {
            return [
              {
                id: `${input.plan.searchQueries[0]}-crossref`,
                title: "Browser Agents for Web Tasks: A Strong Baseline",
                abstract: "A reproducible browser agent baseline with task success rate results.",
                authors: ["A. Researcher"],
                url: "https://example.com/browser-agents-baseline?ref=crossref",
                year: 2026,
                venue: "ICLR",
                doi: "10.1000/browser-agents-baseline",
                source: "crossref",
                relevanceReason: `Retrieved for ${input.plan.searchQueries[0]}`,
              },
              {
                id: `${input.plan.searchQueries[0]}-arxiv`,
                title: "Browser Agents for Web Tasks - A Strong Baseline",
                abstract: "An arXiv version of the same browser agent baseline with task success rate results.",
                authors: ["A. Researcher"],
                url: "https://arxiv.org/abs/2501.00001",
                pdfUrl: "https://arxiv.org/pdf/2501.00001.pdf",
                year: 2026,
                source: "arxiv",
                relevanceReason: `Retrieved for ${input.plan.searchQueries[0]}`,
              },
            ];
          }
        }
      });

      const result = await discoveryService.runDiscovery({ topK: 5, maxPapersPerQuery: 2 });

      assert.equal(result.items.length, 1);
      assert.equal(result.items[0]?.title.includes("Browser Agents for Web Tasks"), true);
      assert.equal(result.items[0]?.venue, "ICLR");
      assert.equal(result.items[0]?.pdfUrl, "https://arxiv.org/pdf/2501.00001.pdf");
      assert.equal(
        result.items[0]?.rankingReasons?.some((reason) => reason.includes("Baseline / evaluation priority match.")),
        true,
      );
    });
  });

  await runTest("ResearchDiscoveryService keeps deterministic ordering after deduplication", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        label: "Tool-Using Agents",
        queryHints: ["tool using agents"],
      });

      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search() {
            return [
              {
                id: "dup-1",
                title: "Tool-Using Agents for the Web",
                abstract: "A strong tool-using web agent.",
                authors: ["A. Researcher"],
                url: "https://example.com/tool-using-agents",
                year: 2026,
                venue: "NeurIPS",
                source: "crossref",
                score: 5,
              },
              {
                id: "dup-2",
                title: "Tool Using Agents for the Web",
                abstract: "Same paper with normalized title variation.",
                authors: ["A. Researcher"],
                url: "https://example.com/tool-using-agents/",
                year: 2026,
                source: "arxiv",
                score: 5,
              },
              {
                id: "unique-1",
                title: "Web Agent Benchmarks",
                abstract: "Benchmarking web agents.",
                authors: ["B. Researcher"],
                url: "https://example.com/web-agent-benchmarks",
                year: 2025,
                venue: "ACL",
                source: "crossref",
                score: 5,
              },
            ];
          }
        }
      });

      const first = await discoveryService.runDiscovery({ topK: 10, maxPapersPerQuery: 3 });
      const second = await discoveryService.runDiscovery({ topK: 10, maxPapersPerQuery: 3 });

      assert.deepEqual(
        first.items.map((item) => item.title),
        second.items.map((item) => item.title),
      );
      assert.equal(first.items.length, 2);
      assert.equal(first.items[0]?.title, "Tool-Using Agents for the Web");
      assert.equal(first.items[1]?.title, "Web Agent Benchmarks");
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
