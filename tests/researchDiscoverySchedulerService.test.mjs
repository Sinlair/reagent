import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDiscoverySchedulerService } from "../dist/services/researchDiscoverySchedulerService.js";
import { ResearchDiscoveryService } from "../dist/services/researchDiscoveryService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-discovery-scheduler-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchDiscoverySchedulerService runs only once per direction per day", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      const profile = await directionService.upsertProfile({
        label: "Multimodal RAG"
      });

      const pushes = [];
      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search() {
            return [
              {
                id: "paper-1",
                title: "A fresh multimodal rag paper",
                abstract: "recent work",
                authors: ["A. Researcher"],
                url: "https://example.com/paper-1",
                year: 2026,
                venue: "NeurIPS",
                source: "crossref"
              }
            ];
          }
        },
        pushDigest: async (input) => {
          pushes.push(input);
        }
      });

      const scheduler = new ResearchDiscoverySchedulerService(dir, discoveryService);
      const statusBefore = await scheduler.configure({
        enabled: true,
        dailyTimeLocal: "00:00",
        senderId: "wx-owner",
        directionIds: [profile.id],
        topK: 3,
        maxPapersPerQuery: 2
      });

      assert.equal(statusBefore.enabled, true);
      const first = await scheduler.tick();
      const second = await scheduler.tick();
      const status = await scheduler.getStatus();

      assert.equal(first.length, 1);
      assert.deepEqual(second, []);
      assert.equal(pushes.length, 1);
      assert.equal(status.lastRunDateByDirection[profile.id] != null, true);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
