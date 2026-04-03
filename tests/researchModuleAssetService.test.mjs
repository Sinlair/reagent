import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchModuleAssetService } from "../dist/services/researchModuleAssetService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-module-asset-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchModuleAssetService downloads repo archive and stores selected paths", async () => {
    await withTempDir(async (dir) => {
      const originalFetch = global.fetch;
      global.fetch = async (url) => {
        const href = String(url);
        if (href === "https://github.com/example/research-repo") {
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
                  <a href="/example/research-repo/tree/main/models">models</a>
                </body>
              </html>
            `,
          };
        }
        if (href.includes("archive/refs/heads/main.zip")) {
          return {
            ok: true,
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
          };
        }
        throw new Error(`Unexpected fetch: ${href}`);
      };

      try {
        const service = new ResearchModuleAssetService(dir);
        const asset = await service.extract({ url: "https://github.com/example/research-repo" });
        assert.equal(asset.owner, "example");
        assert.equal(asset.repo, "research-repo");
        assert.equal(asset.selectedPaths.includes("src"), true);
        assert.equal(asset.archivePath?.endsWith("example-research-repo-main.zip"), true);
        await stat(asset.archivePath);
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
