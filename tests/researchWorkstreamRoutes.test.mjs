import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Fastify from "fastify";

import { registerResearchRoutes } from "../dist/routes/research.js";
import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDiscoverySchedulerService } from "../dist/services/researchDiscoverySchedulerService.js";
import { ResearchDiscoveryService } from "../dist/services/researchDiscoveryService.js";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-workstream-routes-"));
  try {
    await fn(dir);
  } finally {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(dir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 4) {
          throw error;
        }
        await sleep(40);
      }
    }
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
      await options.onProgress?.({ state: "searching-paper", message: "Searching." });
      await options.onProgress?.({ state: "generating-summary", message: "Synthesizing." });
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
    },
    async listRecentReports() {
      return [];
    },
    async getReport() {
      return null;
    }
  };
}

async function main() {
  await runTest("research routes expose workstream memo files for a completed task", async () => {
    await withTempDir(async (dir) => {
      const app = Fastify();
      const researchService = buildStubResearchService();
      const taskService = new ResearchTaskService(dir, researchService);
      const directionService = new ResearchDirectionService(dir);
      const discoveryService = new ResearchDiscoveryService(dir);
      const discoveryScheduler = new ResearchDiscoverySchedulerService(dir, discoveryService);

      await registerResearchRoutes(
        app,
        dir,
        researchService,
        taskService,
        directionService,
        discoveryService,
        discoveryScheduler,
      );

      const task = await taskService.enqueueTask({
        topic: "agentic retrieval",
        question: "What changed recently?",
      });
      const completed = await waitFor(async () => {
        const current = await taskService.getTask(task.taskId);
        return current?.state === "completed" ? current : null;
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/research/tasks/${completed.taskId}/workstreams/search`,
      });

      assert.equal(response.statusCode, 200);
      const payload = response.json();
      assert.equal(payload.workstreamId, "search");
      assert.ok(payload.path.endsWith("/workstreams/search.md"));
      assert.ok(payload.content.includes("# Search Workstream"));
      assert.ok(payload.content.includes("Round"));

      await app.close();
    });
  });
}

await main();
