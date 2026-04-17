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
  const i18nSource = await readFile(path.resolve(__dirname, "..", "web", "i18n.js"), "utf8");

  await runTest("daily digest preset exposes a scheduler preset button", async () => {
    assert.equal(indexSource.includes('id="discovery-scheduler-preset"'), true);
    assert.equal(i18nSource.includes('schedulerPreset: "Use daily digest preset"'), true);
  });

  await runTest("daily digest preset wiring populates scheduler defaults and hint states", async () => {
    assert.equal(appSource.includes("function applyDailyDigestPreset()"), true);
    assert.equal(appSource.includes('els.discoverySchedulerEnabled.checked = true'), true);
    assert.equal(appSource.includes('els.discoverySchedulerTime.value = "09:00"'), true);
    assert.equal(appSource.includes('els.discoverySchedulerTopK.value = "5"'), true);
    assert.equal(appSource.includes('els.discoverySchedulerMaxPapers.value = "4"'), true);
    assert.equal(appSource.includes("els.discoverySchedulerPreset?.addEventListener"), true);
    assert.equal(appSource.includes("scheduler will use all enabled templates"), true);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
