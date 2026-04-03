import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchPaperAnalysisService } from "../dist/services/researchPaperAnalysisService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-paper-analysis-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchPaperAnalysisService analyzes a paper from an article URL", async () => {
    await withTempDir(async (dir) => {
      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        const href = String(url);
        if (href.includes("example.com/post")) {
          return {
            ok: true,
            text: async () => `
              <html>
                <head><title>Article About RAG Paper</title></head>
                <body>
                  <a href="https://arxiv.org/abs/2501.12345">paper</a>
                  <a href="https://github.com/example/research-repo">code</a>
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
        const service = new ResearchPaperAnalysisService(dir);
        const report = await service.analyze({ url: "https://example.com/post" });

        assert.equal(report.sourceUrl, "https://example.com/post");
        assert.equal(report.paper.url.includes("arxiv.org/abs/2501.12345"), true);
        assert.equal(report.repoCandidates.length, 1);
        assert.equal(report.innovationPoints.length > 0, true);
        assert.equal(report.recommendation.length > 0, true);
        assert.equal(Array.isArray(report.conclusions), true);
        assert.equal(report.conclusions.some((item) => item.kind === "problem_statement"), true);
        assert.equal(report.conclusions.some((item) => item.kind === "recommendation" && item.supportKind === "inference"), true);
        assert.equal(report.conclusions.some((item) => item.kind === "repo_availability" && item.supportKind === "code"), true);
        assert.equal(report.evidenceProfile.inferenceCount > 0, true);
        assert.equal(report.evidenceProfile.missingEvidenceCount > 0, true);
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
