import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "..");
  const indexHtml = await readFile(path.join(repoRoot, "web", "index.html"), "utf8");
  const appJs = await readFile(path.join(repoRoot, "web", "app.js"), "utf8");

  const checks = [
    { id: "landing-panel", ok: indexHtml.includes('data-panel="landing"') },
    { id: "sessions-panel", ok: indexHtml.includes('data-panel="sessions"') },
    { id: "agents-panel", ok: indexHtml.includes('data-panel="agents"') },
    { id: "product-alerts", ok: indexHtml.includes('id="product-alerts"') },
    { id: "landing-checklist", ok: indexHtml.includes('id="launch-checklist"') },
    { id: "agent-session-summary", ok: indexHtml.includes('id="agent-session-summary"') },
    { id: "agent-sessions-list", ok: indexHtml.includes('id="agent-sessions-list"') },
    { id: "agent-runtime-notes", ok: indexHtml.includes('id="agent-runtime-notes"') },
    { id: "agent-cognition-panel", ok: appJs.includes('["cognition", t("agents.panelCognition", "Cognition")]') },
    { id: "agent-history-panel", ok: appJs.includes('["history", t("agents.panelHistory", "History")]') },
    { id: "agent-hooks-panel", ok: appJs.includes('["hooks", t("agents.panelHooks", "Hooks")]') },
    { id: "agent-delegations-panel", ok: appJs.includes('["delegations", t("agents.panelDelegations", "Delegations")]') },
    { id: "agent-delegation-rationale", ok: appJs.includes("item.rationale.summary") && appJs.includes("matchedHypothesis") },
    { id: "agent-delegation-retry", ok: appJs.includes("item.retryHint") && appJs.includes("item.retryState") },
    { id: "session-switching", ok: appJs.includes("data-agent-session-id") && appJs.includes("loadAgentSession(sessionId)") },
    { id: "discovery-run-detail", ok: indexHtml.includes('id="discovery-run-detail"') && appJs.includes("function renderDiscoveryRunDetail(run)") },
    { id: "discovery-run-selection", ok: appJs.includes('data-discovery-run-id') && appJs.includes("hydrateDiscoveryRun(runId)") },
    { id: "scheduler-preset-button", ok: indexHtml.includes('id="discovery-scheduler-preset"') && appJs.includes("function applyDailyDigestPreset()") },
  ];

  const failed = checks.filter((check) => !check.ok);
  const artifactDir = path.join(os.tmpdir(), "reagent-browser-smoke");
  await mkdir(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, "browser-smoke-result.json");
  const payload = {
    format: "reagent-browser-smoke",
    createdAt: new Date().toISOString(),
    checks,
    passed: failed.length === 0,
  };
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  assert.equal(failed.length, 0, `Browser smoke checks failed. See ${artifactPath}`);
  console.log(`PASS browser smoke surfaces verified (${artifactPath})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
