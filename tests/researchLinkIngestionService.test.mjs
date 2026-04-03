import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchLinkIngestionService } from "../dist/services/researchLinkIngestionService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-link-ingest-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchLinkIngestionService extracts paper and GitHub links from article HTML", async () => {
    await withTempDir(async (dir) => {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        text: async () => `
          <html>
            <head>
              <title>Interesting Paper Review</title>
              <meta property="article:published_time" content="2026-04-03T12:00:00Z" />
            </head>
            <body>
              <a href="https://arxiv.org/abs/2501.12345">paper</a>
              <a href="https://github.com/example/research-repo">code</a>
            </body>
          </html>
        `,
      });

      try {
        const service = new ResearchLinkIngestionService(dir);
        const item = await service.ingest({ url: "https://example.com/post" });

        assert.equal(item.title, "Interesting Paper Review");
        assert.equal(item.paperCandidates.length, 1);
        assert.equal(item.paperCandidates[0]?.arxivId, "2501.12345");
        assert.equal(item.repoCandidates.length, 1);
        assert.equal(item.repoCandidates[0]?.owner, "example");
        assert.equal(item.repoCandidates[0]?.repo, "research-repo");

        const recent = await service.listRecent();
        assert.equal(recent.length, 1);
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
