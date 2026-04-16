import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appSource = await readFile(path.resolve(__dirname, "..", "web", "app.js"), "utf8");
  const indexSource = await readFile(path.resolve(__dirname, "..", "web", "index.html"), "utf8");

  await runTest("recent artifacts surface includes a dedicated rail card", async () => {
    assert.equal(indexSource.includes('id="recent-artifact-list"'), true);
    assert.equal(indexSource.includes("Recent Artifacts"), true);
  });

  await runTest("recent artifacts flow can reopen report, presentation, module asset, and workstream memo", async () => {
    assert.equal(appSource.includes("function renderRecentArtifacts()"), true);
    assert.equal(appSource.includes("hydrateReport(artifactId)"), true);
    assert.equal(appSource.includes("hydratePresentation(artifactId)"), true);
    assert.equal(appSource.includes("hydrateModuleAsset(artifactId)"), true);
    assert.equal(appSource.includes("hydrateWorkstreamMemo(artifactId, workstreamId)"), true);
    assert.equal(appSource.includes("/api/research/tasks/${encodeURIComponent(taskId)}/workstreams/${encodeURIComponent(workstreamId)}"), true);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
