import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MemoryService } from "../dist/services/memoryService.js";
import { ResearchTaskService } from "../dist/services/researchTaskService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-task-service-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 1500, intervalMs = 25) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for condition.");
}

function buildStubResearchService() {
  return {
    async runResearch(request, options = {}) {
      await options.onProgress?.({ state: "planning", message: "Building plan." });
      await sleep(10);
      await options.onProgress?.({ state: "searching-paper", message: "Searching." });
      await sleep(10);
      await options.onProgress?.({ state: "persisting", message: "Persisting." });
      return {
        taskId: options.taskId,
        topic: request.topic,
        question: request.question,
        generatedAt: new Date().toISOString(),
        plan: {
          objective: request.topic,
          subquestions: [],
          searchQueries: [request.topic]
        },
        papers: [],
        chunks: [],
        summary: `Summary for ${request.topic}`,
        findings: [],
        gaps: [],
        nextActions: [],
        evidence: [],
        warnings: [],
        critique: {
          verdict: "moderate",
          summary: "ok",
          issues: [],
          recommendations: [],
          supportedEvidenceCount: 0,
          unsupportedEvidenceCount: 0,
          coveredFindingsCount: 0,
          citationDiversity: 0,
          citationCoverage: 0
        }
      };
    }
  };
}

async function main() {
  await runTest("ResearchTaskService enqueues tasks and persists progress transitions", async () => {
    await withTempDir(async (dir) => {
      const service = new ResearchTaskService(dir, buildStubResearchService());
      const memory = new MemoryService(dir);
      const task = await service.enqueueTask({ topic: "agentic rag", question: "What changed?" });

      assert.equal(task.state, "queued");
      const completed = await waitFor(async () => {
        const current = await service.getTask(task.taskId);
        return current?.state === "completed" ? current : null;
      });

      assert.equal(completed.reportReady, true);
      assert.equal(completed.report, undefined);
      assert.equal(completed.transitions.some((entry) => entry.state === "planning"), true);
      assert.equal(completed.transitions.some((entry) => entry.state === "persisting"), true);
      assert.equal(completed.reviewStatus, "passed");
      assert.equal(completed.roundPath, `research/rounds/${task.taskId}`);
      assert.equal(completed.handoffPath, `research/rounds/${task.taskId}/handoff.json`);

      const memoryFiles = await memory.listFiles();
      const dailyFile = memoryFiles.find((file) => file.path.startsWith("memory/"));
      assert.ok(dailyFile);
      const dailyContent = await memory.getFile(dailyFile.path);
      assert.equal(dailyContent.content.includes("Research task completed."), true);
      assert.equal(dailyContent.content.includes("Summary for agentic rag"), true);

      const roundDir = path.join(dir, "research", "rounds", task.taskId);
      const briefContent = await readFile(path.join(roundDir, "brief.md"), "utf8");
      const handoff = JSON.parse(await readFile(path.join(roundDir, "handoff.json"), "utf8"));
      const artifactStore = JSON.parse(await readFile(path.join(roundDir, "artifacts.json"), "utf8"));
      const reportContent = JSON.parse(await readFile(path.join(roundDir, "report.json"), "utf8"));
      const reviewContent = await readFile(path.join(roundDir, "review.md"), "utf8");
      const searchWorkstream = await readFile(path.join(roundDir, "workstreams", "search.md"), "utf8");
      const synthesisWorkstream = await readFile(path.join(roundDir, "workstreams", "synthesis.md"), "utf8");
      const taskStore = JSON.parse(await readFile(path.join(dir, "research", "task-runs.json"), "utf8"));

      assert.equal(briefContent.includes("Topic: agentic rag"), true);
      assert.equal(handoff.state, "completed");
      assert.equal(handoff.reviewStatus, "passed");
      assert.equal(Array.isArray(artifactStore.items), true);
      assert.equal(artifactStore.items.some((item) => item.kind === "report"), true);
      assert.equal(artifactStore.items.some((item) => item.kind === "review"), true);
      assert.equal(artifactStore.items.some((item) => item.kind === "workstream" && item.id === "search"), true);
      assert.equal(reportContent.taskId, task.taskId);
      assert.equal(reviewContent.includes("Verdict: moderate"), true);
      assert.equal(searchWorkstream.includes("## Search Context"), true);
      assert.equal(searchWorkstream.includes("Queries: agentic rag"), true);
      assert.equal(synthesisWorkstream.includes("## Synthesis Context"), true);
      assert.equal(synthesisWorkstream.includes("Summary for agentic rag"), true);
      assert.equal("report" in taskStore.tasks[0], false);
    });
  });

  await runTest("ResearchTaskService can retry a finished task as a new attempt", async () => {
    await withTempDir(async (dir) => {
      const service = new ResearchTaskService(dir, buildStubResearchService());
      const first = await service.enqueueTask({ topic: "multimodal rag" });
      await waitFor(async () => {
        const current = await service.getTask(first.taskId);
        return current?.state === "completed" ? current : null;
      });

      const retry = await service.retryTask(first.taskId);
      assert.ok(retry);
      assert.notEqual(retry.taskId, first.taskId);
      assert.equal(retry.sourceTaskId, first.taskId);
      assert.equal(retry.attempt, 2);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
