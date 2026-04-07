import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchBaselineService } from "../dist/services/researchBaselineService.js";
import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDiscoveryService } from "../dist/services/researchDiscoveryService.js";
import { ResearchPaperAnalysisService } from "../dist/services/researchPaperAnalysisService.js";
import { ResearchRepoAnalysisService } from "../dist/services/researchRepoAnalysisService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-baseline-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchBaselineService builds baseline suggestions from stored signals", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      const direction = await directionService.upsertProfile({
        label: "Multimodal RAG",
        targetProblem: "Improve long-document multimodal retrieval quality.",
        openQuestions: ["How to improve retrieval quality?"],
        currentGoals: ["Find reusable retrieval modules"],
        knownBaselines: ["RAG"],
        evaluationPriorities: ["retrieval recall"],
        successCriteria: ["Beat current retrieval baseline on LongDocBench"],
      });

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

      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        const href = String(url);
        if (href.includes("example.com/post")) {
          return {
            ok: true,
            text: async () => `
              <html><body>
                <a href="https://arxiv.org/abs/2501.12345">paper</a>
                <a href="https://github.com/example/research-repo">code</a>
              </body></html>
            `,
          };
        }
        if (href.includes("github.com/example/research-repo")) {
          return {
            ok: true,
            text: async () => `
              <html>
                <head>
                  <meta property="og:title" content="example/research-repo" />
                  <meta property="og:description" content="Repository for multimodal rag" />
                </head>
                <body>
                  <script type="application/json">{"stargazerCount":45}</script>
                  <a href="/example/research-repo/tree/main/src">src</a>
                </body>
              </html>
            `,
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

      try {
        const paperService = new ResearchPaperAnalysisService(dir);
        await paperService.analyze({ url: "https://example.com/post" });
        const repoService = new ResearchRepoAnalysisService(dir);
        await repoService.analyze({ url: "https://github.com/example/research-repo", contextTitle: "Multimodal RAG repo" });

        const baselineService = new ResearchBaselineService(dir);
        const report = await baselineService.suggest({ directionId: direction.id });

        assert.equal(report.baselines.length > 0, true);
        assert.equal(report.baselines.some((item) => item.title === "RAG" && item.reason.includes("research brief")), true);
        assert.equal(report.reusableModules.includes("src"), true);
        assert.equal(report.innovationSuggestions.some((item) => item.includes("Investigate")), true);
        assert.equal(report.innovationSuggestions.some((item) => item.includes("Solve: Improve long-document multimodal retrieval quality.")), true);
        assert.equal(report.innovationSuggestions.some((item) => item.includes("Validate against: Beat current retrieval baseline on LongDocBench")), true);
        assert.equal(report.supportingSignals.some((item) => item.includes("Metric: retrieval recall")), true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
