import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-direction-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchDirectionService stores profiles and builds discovery plans", async () => {
    await withTempDir(async (dir) => {
      const service = new ResearchDirectionService(dir);

      const profile = await service.upsertProfile({
        label: "Multimodal RAG",
        subDirections: ["long-document understanding", "vision-language retrieval"],
        preferredVenues: ["NeurIPS", "ICLR"],
        preferredDatasets: ["MMMU"],
        preferredBenchmarks: ["LongDocBench"],
        preferredPaperStyles: ["engineering", "reproducibility"],
        currentGoals: ["Find practical retrieval modules"],
        queryHints: ["multimodal rag retrieval augmentation"]
      });

      assert.equal(profile.id, "multimodal-rag");
      assert.equal(profile.priority, "secondary");
      assert.equal(profile.enabled, true);

      const listed = await service.listProfiles();
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.label, "Multimodal RAG");

      const loaded = await service.getProfile("multimodal-rag");
      assert.equal(loaded?.preferredVenues.includes("NeurIPS"), true);
      assert.equal(loaded?.preferredPaperStyles.includes("engineering"), true);

      const plan = await service.buildDiscoveryPlan("multimodal-rag");
      assert.equal(plan.length > 0, true);
      assert.equal(plan.some((candidate) => candidate.query.includes("recent paper")), true);
      assert.equal(plan.some((candidate) => candidate.query.includes("code github")), true);
      assert.equal(plan.some((candidate) => candidate.query.includes("NeurIPS")), true);
    });
  });

  await runTest("ResearchDirectionService updates and deletes profiles", async () => {
    await withTempDir(async (dir) => {
      const service = new ResearchDirectionService(dir);

      await service.upsertProfile({
        label: "Agentic Retrieval"
      });

      const updated = await service.upsertProfile({
        id: "agentic-retrieval",
        label: "Agentic Retrieval",
        summary: "Focus on tool-using retrieval systems.",
        priority: "primary",
        enabled: false,
        currentGoals: ["Track the latest evaluation papers"]
      });

      assert.equal(updated.priority, "primary");
      assert.equal(updated.enabled, false);
      assert.equal(updated.summary, "Focus on tool-using retrieval systems.");
      assert.deepEqual(updated.currentGoals, ["Track the latest evaluation papers"]);

      const emptyPlan = await service.buildDiscoveryPlan("agentic-retrieval");
      assert.deepEqual(emptyPlan, []);

      const deleted = await service.deleteProfile("agentic-retrieval");
      assert.equal(deleted, true);
      assert.equal(await service.getProfile("agentic-retrieval"), null);
      assert.equal((await service.listProfiles()).length, 0);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
