import assert from "node:assert/strict";
import Fastify from "fastify";

import { registerHealthRoutes } from "../dist/routes/health.js";

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
  await runTest("health routes expose aggregated runtime jobs", async () => {
    const app = Fastify();

    await registerHealthRoutes(
      app,
      "workspace",
      {
        async listJobs(limit = 5) {
          return [
            {
              id: "research-discovery-scheduler",
              label: "Research Discovery Scheduler",
              snapshot: {
                jobName: "research-discovery-scheduler",
                running: true,
                lastState: "completed",
                updatedAt: "2026-04-10T00:00:00.000Z",
              },
              recentRuns: [
                {
                  ts: "2026-04-10T00:00:00.000Z",
                  event: "finished",
                  jobName: "research-discovery-scheduler",
                  trigger: "scheduled",
                  startedAt: "2026-04-10T00:00:00.000Z",
                  finishedAt: "2026-04-10T00:01:00.000Z",
                  state: "completed",
                  summary: `limit=${limit}`,
                },
              ],
            },
          ];
        },
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/runtime/jobs?limit=7",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(Array.isArray(payload.items), true);
    assert.equal(payload.items[0].id, "research-discovery-scheduler");
    assert.equal(payload.items[0].recentRuns[0].summary, "limit=7");

    await app.close();
  });
}

await main();
