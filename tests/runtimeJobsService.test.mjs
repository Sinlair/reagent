import assert from "node:assert/strict";

import { RuntimeJobsService } from "../dist/services/runtimeJobsService.js";

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
  await runTest("RuntimeJobsService aggregates discovery and memory job observability", async () => {
    const service = new RuntimeJobsService({
      researchDiscoverySchedulerService: {
        async getRuntimeSnapshot() {
          return {
            jobName: "research-discovery-scheduler",
            running: true,
            lastState: "completed",
            updatedAt: "2026-04-10T00:00:00.000Z",
          };
        },
        async listRecentRuns() {
          return [
            {
              ts: "2026-04-10T00:00:00.000Z",
              event: "finished",
              jobName: "research-discovery-scheduler",
              trigger: "scheduled",
              startedAt: "2026-04-10T00:00:00.000Z",
              finishedAt: "2026-04-10T00:01:00.000Z",
              state: "completed",
              summary: "Ran discovery for 1 direction.",
            },
          ];
        },
      },
      memoryCompactionSchedulerService: {
        async getRuntimeSnapshot() {
          return {
            jobName: "memory-auto-compaction",
            running: false,
            lastState: "skipped",
            updatedAt: "2026-04-10T00:00:00.000Z",
          };
        },
        async listRecentRuns() {
          return [
            {
              ts: "2026-04-10T00:02:00.000Z",
              event: "finished",
              jobName: "memory-auto-compaction",
              trigger: "scheduled",
              startedAt: "2026-04-10T00:02:00.000Z",
              finishedAt: "2026-04-10T00:02:10.000Z",
              state: "skipped",
              summary: "No memory entries required compaction.",
            },
          ];
        },
      },
    });

    const jobs = await service.listJobs(3);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].id, "research-discovery-scheduler");
    assert.equal(jobs[0].recentRuns[0].summary, "Ran discovery for 1 direction.");
    assert.equal(jobs[1].id, "memory-auto-compaction");
    assert.equal(jobs[1].snapshot.lastState, "skipped");
  });
}

await main();
