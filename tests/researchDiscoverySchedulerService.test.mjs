import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchFeedbackService } from "../dist/services/researchFeedbackService.js";
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

function yesterdayLocalDate() {
  const value = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
      const runtime = await scheduler.getRuntimeSnapshot();
      const runs = await scheduler.listRecentRuns(5);

      assert.equal(first.length, 1);
      assert.deepEqual(second, []);
      assert.equal(pushes.length, 1);
      assert.equal(status.lastRunDateByDirection[profile.id] != null, true);
      assert.equal(runtime.lastState, "skipped");
      assert.equal(runs.some((entry) => entry.event === "finished" && entry.state === "completed"), true);
      assert.equal(runs.some((entry) => entry.event === "finished" && entry.state === "skipped"), true);
    });
  });

  await runTest("ResearchDiscoverySchedulerService reduces push frequency after strong negative feedback", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      const profile = await directionService.upsertProfile({
        id: "agentic-retrieval",
        label: "Agentic Retrieval"
      });

      const feedbackService = new ResearchFeedbackService(dir);
      await feedbackService.record({
        feedback: "less-like-this",
        directionId: profile.id,
        topic: profile.label,
      });
      await feedbackService.record({
        feedback: "not-worth-following",
        directionId: profile.id,
        topic: profile.label,
      });

      const pushes = [];
      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search() {
            return [
              {
                id: "paper-1",
                title: "A recent agentic retrieval paper",
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
      await scheduler.configure({
        enabled: true,
        dailyTimeLocal: "00:00",
        senderId: "wx-owner",
        directionIds: [profile.id],
        topK: 3,
        maxPapersPerQuery: 2
      });

      await mkdir(path.join(dir, "channels"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "research-discovery-scheduler.json"),
        `${JSON.stringify({
          enabled: true,
          dailyTimeLocal: "00:00",
          senderId: "wx-owner",
          directionIds: [profile.id],
          topK: 3,
          maxPapersPerQuery: 2,
          lastRunDateByDirection: {
            [profile.id]: yesterdayLocalDate()
          },
          updatedAt: new Date().toISOString()
        }, null, 2)}\n`,
        "utf8"
      );

      const skipped = await scheduler.tick();

      assert.deepEqual(skipped, []);
      assert.equal(pushes.length, 0);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
