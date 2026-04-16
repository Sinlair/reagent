import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, "..", "web", "app.js");
const appSource = await readFile(appPath, "utf8");

function loadBriefTemplates(source) {
  const match = source.match(/const RESEARCH_BRIEF_TEMPLATES = (\[[\s\S]*?\n\]);\n\nconst GRAPH_VIEW/u);
  assert.ok(match, "Could not locate RESEARCH_BRIEF_TEMPLATES in web/app.js");
  return vm.runInNewContext(match[1], {});
}

async function main() {
  await runTest("Web brief templates expose at least three starter templates with required fields", async () => {
    const templates = loadBriefTemplates(appSource);
    assert.ok(Array.isArray(templates));
    assert.ok(templates.length >= 3);

    const ids = new Set();
    for (const template of templates) {
      assert.equal(typeof template.id, "string");
      assert.equal(typeof template.label, "string");
      assert.equal(typeof template.summary, "string");
      assert.equal(typeof template.targetProblem, "string");
      assert.equal(Array.isArray(template.successCriteria), true);
      assert.equal(Array.isArray(template.knownBaselines), true);
      assert.equal(Array.isArray(template.evaluationPriorities), true);
      assert.equal(template.successCriteria.length > 0, true);
      assert.equal(template.knownBaselines.length > 0, true);
      assert.equal(template.evaluationPriorities.length > 0, true);
      assert.equal(ids.has(template.id), false);
      ids.add(template.id);
    }
  });

  await runTest("Web brief template flow keeps template loading and markdown import-export wiring", async () => {
    assert.equal(appSource.includes('data-brief-template'), true);
    assert.equal(appSource.includes("populateResearchBriefForm({"), true);
    assert.equal(appSource.includes('setResearchBriefStatus(`Template loaded: ${template.label}`, "ok")'), true);
    assert.equal(appSource.includes("/api/research/directions/import-markdown"), true);
    assert.equal(appSource.includes("brief-markdown"), true);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
