import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchRoundService } from "../dist/services/researchRoundService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-handoff-workstreams-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchRoundService handoff exposes structured workstreams across round stages", async () => {
    await withTempDir(async (dir) => {
      const roundService = new ResearchRoundService(dir);
      const taskId = "11111111-1111-1111-1111-111111111111";

      await roundService.createRound({
        taskId,
        topic: "agentic retrieval",
        question: "What changed recently?",
        request: {
          topic: "agentic retrieval",
          question: "What changed recently?",
          maxPapers: 5,
        },
        attempt: 1,
        createdAt: new Date().toISOString(),
        progress: 5,
        message: "Task queued.",
      });

      const queued = await roundService.getHandoff(taskId);
      assert.equal(queued?.activeWorkstreamId, "search");
      assert.equal(queued?.workstreams.length, 3);
      assert.equal(typeof queued?.workstreamPaths.search, "string");
      assert.equal(queued?.workstreams.find((item) => item.id === "search")?.status, "in_progress");
      assert.equal(queued?.workstreams.find((item) => item.id === "reading")?.status, "pending");
      assert.equal(queued?.workstreams.find((item) => item.id === "synthesis")?.status, "pending");

      const artifactStore = JSON.parse(
        await readFile(path.join(dir, "research", "rounds", taskId, "artifacts.json"), "utf8"),
      );
      assert.equal(artifactStore.items.some((item) => item.kind === "workstream" && item.id === "search"), true);

      const searchMemo = await readFile(path.join(dir, "research", "rounds", taskId, "workstreams", "search.md"), "utf8");
      assert.equal(searchMemo.includes("# Search Workstream"), true);
      assert.equal(searchMemo.includes("Discovery, retrieval quality"), true);
      assert.equal(searchMemo.includes("`queued` (5%) Task queued."), true);

      await roundService.recordTaskProgress({
        taskId,
        state: "generating-summary",
        progress: 84,
        message: "Generating final synthesis.",
        reviewStatus: "pending",
      });

      const synthesis = await roundService.getHandoff(taskId);
      assert.equal(synthesis?.activeWorkstreamId, "synthesis");
      assert.equal(synthesis?.workstreams.find((item) => item.id === "search")?.status, "completed");
      assert.equal(synthesis?.workstreams.find((item) => item.id === "reading")?.status, "completed");
      assert.equal(synthesis?.workstreams.find((item) => item.id === "synthesis")?.status, "in_progress");

      await roundService.recordTaskProgress({
        taskId,
        state: "completed",
        progress: 100,
        message: "Round completed.",
        reviewStatus: "passed",
      });

      const completed = await roundService.getHandoff(taskId);
      assert.equal(completed?.activeWorkstreamId, undefined);
      assert.equal(completed?.workstreams.every((item) => item.status === "completed"), true);

      const synthesisMemo = await readFile(
        path.join(dir, "research", "rounds", taskId, "workstreams", "synthesis.md"),
        "utf8",
      );
      assert.equal(synthesisMemo.includes("# Synthesis Workstream"), true);
      assert.equal(synthesisMemo.includes("The final synthesis and deliverables are complete"), true);
      assert.equal(synthesisMemo.includes("`generating-summary` (84%) Generating final synthesis."), true);
      assert.equal(synthesisMemo.includes("`completed` (100%) Round completed."), true);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
