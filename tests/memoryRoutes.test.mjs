import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Fastify from "fastify";

import { registerMemoryRoutes } from "../dist/routes/memory.js";
import { MemoryCompactionSchedulerService } from "../dist/services/memoryCompactionSchedulerService.js";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-memory-routes-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("memory routes expose recall, policy, compact, and compaction history", async () => {
    await withTempDir(async (dir) => {
      const app = Fastify();
      const memory = new MemoryService(dir);
      const recall = new MemoryRecallService(dir);
      const compaction = new MemoryCompactionService(dir);
      const scheduler = new MemoryCompactionSchedulerService(dir, compaction);
      await memory.ensureWorkspace();
      await registerMemoryRoutes(app, memory, recall, compaction, scheduler, async () => scheduler.refresh());

      await memory.remember({
        scope: "daily",
        title: "Note one",
        content: "planner router memory one",
        source: "test",
        tags: ["planner"],
      });
      await memory.remember({
        scope: "daily",
        title: "Note two",
        content: "planner router memory two",
        source: "test",
        tags: ["router"],
      });
      await memory.remember({
        scope: "daily",
        title: "Note three",
        content: "planner router memory three",
        source: "test",
        tags: ["summary"],
      });

      const policyResponse = await app.inject({
        method: "PUT",
        url: "/api/memory/policy",
        payload: {
          autoCompactionOlderThanDays: 7,
          autoCompactionMinEntries: 3,
          autoCompactionMaxEntries: 6,
          maxDailyEntriesBeforeAutoCompact: 3,
        },
      });
      assert.equal(policyResponse.statusCode, 200);
      assert.equal(policyResponse.json().autoCompactionOlderThanDays, 7);

      const recallResponse = await app.inject({
        method: "GET",
        url: "/api/memory/recall?q=planner%20router&limit=5",
      });
      assert.equal(recallResponse.statusCode, 200);
      assert.equal(recallResponse.json().hits.length >= 1, true);

      const indexPath = path.join(dir, "memory-index.json");
      const indexRaw = JSON.parse(await readFile(indexPath, "utf8"));
      const stale = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      indexRaw.entries = indexRaw.entries.map((entry) => ({
        ...entry,
        createdAt: stale,
        updatedAt: stale,
      }));
      await writeFile(indexPath, `${JSON.stringify(indexRaw, null, 2)}\n`, "utf8");

      const compactResponse = await app.inject({
        method: "POST",
        url: "/api/memory/compact",
        payload: {
          olderThanDays: 7,
          minEntries: 3,
          maxEntries: 6,
        },
      });
      assert.equal(compactResponse.statusCode, 200);
      assert.equal(compactResponse.json().compactedEntryCount, 3);

      const historyResponse = await app.inject({
        method: "GET",
        url: "/api/memory/compactions?limit=5",
      });
      assert.equal(historyResponse.statusCode, 200);
      assert.equal(historyResponse.json().items.length >= 1, true);
      assert.equal(historyResponse.json().items[0].status, "compacted");

      const runtimeResponse = await app.inject({
        method: "GET",
        url: "/api/memory/compaction-scheduler/runtime",
      });
      assert.equal(runtimeResponse.statusCode, 200);
      assert.equal(typeof runtimeResponse.json().running, "boolean");

      const runsResponse = await app.inject({
        method: "GET",
        url: "/api/memory/compaction-scheduler/runs?limit=5",
      });
      assert.equal(runsResponse.statusCode, 200);
      assert.equal(Array.isArray(runsResponse.json().items), true);
      assert.equal(runsResponse.json().items.length >= 1, true);

      await app.close();
    });
  });
}

await main();
