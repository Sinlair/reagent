import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-repo-analysis-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchRepoAnalysisService parses GitHub repo metadata", async () => {
    await withTempDir(async (dir) => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:title" content="example/research-repo" />
              <meta property="og:description" content="Repository for Multimodal RAG" />
            </head>
            <body>
              <script type="application/json">{"stargazerCount":123}</script>
              <a href="/example/research-repo/tree/main/src">src</a>
              <a href="/example/research-repo/tree/main/models">models</a>
            </body>
          </html>
        `,
      });

      try {
        const service = new ResearchRepoAnalysisService(dir);
        const report = await service.analyze({
          url: "https://github.com/example/research-repo",
          contextTitle: "Multimodal RAG research repo"
        });

        assert.equal(report.owner, "example");
        assert.equal(report.repo, "research-repo");
        assert.equal(report.stars, 123);
        assert.equal(report.keyPaths.includes("src"), true);
        assert.equal(report.likelyOfficial, true);
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
