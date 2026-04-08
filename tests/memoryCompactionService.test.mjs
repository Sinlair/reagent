import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MemoryCompactionService } from "../dist/services/memoryCompactionService.js";
import { MemoryRecallService } from "../dist/services/memoryRecallService.js";
import { MemoryService } from "../dist/services/memoryService.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-memory-compact-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("MemoryCompactionService folds older daily notes into one summary entry", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const compaction = new MemoryCompactionService(dir);
      const recall = new MemoryRecallService(dir);

      const updatedPolicy = await compaction.updatePolicy({
        autoCompactionOlderThanDays: 7,
        autoCompactionMinEntries: 3,
        autoCompactionMaxEntries: 6,
        maxDailyEntriesBeforeAutoCompact: 3,
        neverCompactTags: ["pinned", "never-compact", "memory-summary"],
      });
      assert.equal(updatedPolicy.autoCompactionOlderThanDays, 7);
      assert.equal(updatedPolicy.autoCompactionMinEntries, 3);
      assert.equal(updatedPolicy.maxDailyEntriesBeforeAutoCompact, 3);

      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Planner note 1",
        content: "Router policy should prioritize planner-driven RAG decisions.",
        source: "test",
        sourceType: "user-stated",
        confidence: "medium",
        tags: ["planner", "rag"],
      });
      await memory.remember({
        scope: "daily",
        title: "Planner note 2",
        content: "Planner experiments need tighter router metrics and benchmark notes.",
        source: "test",
        sourceType: "user-stated",
        confidence: "medium",
        tags: ["planner", "router"],
      });
      await memory.remember({
        scope: "daily",
        title: "Planner note 3",
        content: "Router fallback should stay aligned with planner summaries.",
        source: "test",
        sourceType: "user-stated",
        confidence: "medium",
        tags: ["planner", "summary"],
      });

      const indexPath = path.join(dir, "memory-index.json");
      const rawIndex = JSON.parse(await readFile(indexPath, "utf8"));
      const staleTimestamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      rawIndex.entries = rawIndex.entries.map((entry) => ({
        ...entry,
        createdAt: staleTimestamp,
        updatedAt: staleTimestamp,
      }));
      rawIndex.updatedAt = staleTimestamp;
      await writeFile(indexPath, `${JSON.stringify(rawIndex, null, 2)}\n`, "utf8");

      const result = await compaction.compact({
        source: "manual",
        olderThanDays: 7,
        minEntries: 3,
        maxEntries: 6,
      });

      assert.equal(result.compactedEntryCount, 3);
      assert.equal(result.summaryPath, "MEMORY.md");
      assert.ok(result.summaryTitle?.includes("Memory Summary"));

      const memoryFile = await memory.getFile("MEMORY.md");
      assert.equal(memoryFile.content.includes("Memory compaction summary."), true);
      assert.equal(memoryFile.content.includes("Planner note 1"), true);

      const compactedIndex = JSON.parse(await readFile(indexPath, "utf8"));
      const compactedEntries = compactedIndex.entries.filter((entry) => Boolean(entry.compactedAt));
      const summaryEntry = compactedIndex.entries.find((entry) => Array.isArray(entry.compactionSourceIds));
      assert.equal(compactedEntries.length, 3);
      assert.ok(summaryEntry);
      assert.equal(summaryEntry.compactionSourceIds.length, 3);

      const recentCompactions = await compaction.listRecent(5);
      assert.equal(recentCompactions.length >= 1, true);
      assert.equal(recentCompactions[0].status, "compacted");
      assert.equal(recentCompactions[0].compactedEntryCount, 3);

      const recallResult = await recall.recall("planner router", { limit: 6 });
      assert.equal(
        recallResult.hits.some((hit) => hit.layer === "workspace" && String(hit.title).includes("Memory Summary")),
        true,
      );
      assert.equal(
        recallResult.hits.some((hit) => hit.title === "Planner note 1"),
        false,
      );
    });
  });
}

await main();
