import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-evolution-routes-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildStubResearchService() {
  return {
    async runResearch(request, options = {}) {
      return {
        taskId: options.taskId,
        topic: request.topic,
        question: request.question,
        generatedAt: new Date().toISOString(),
        plan: {
          objective: request.topic,
          subquestions: [],
          searchQueries: [request.topic],
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
          citationCoverage: 0,
        },
      };
    },
    async listRecentReports() {
      return [];
    },
    async getReport() {
      return null;
    },
  };
}

async function main() {
  await runTest("research candidate routes support generate, review, dry-run, and apply", async () => {
    await withTempDir(async (dir) => {
      const app = Fastify();
      const researchService = buildStubResearchService();
      const taskService = new ResearchTaskService(dir, researchService);
      const directionService = new ResearchDirectionService(dir);
      const discoveryService = new ResearchDiscoveryService(dir);
      const discoveryScheduler = new ResearchDiscoverySchedulerService(dir, discoveryService);

      await directionService.upsertProfile({
        id: "multimodal-rag",
        label: "Multimodal RAG",
        summary: "Workspace direction summary.",
        knownBaselines: ["Hybrid retrieval"],
        currentGoals: ["Track reusable modules"],
      });

      await writeJson(path.join(dir, "research", "direction-reports.json"), {
        updatedAt: "2026-04-10T09:00:00.000Z",
        reports: [
          {
            id: "direction-report-1",
            directionId: "multimodal-rag",
            topic: "Multimodal RAG",
            overview: "Multimodal RAG needs stronger retrieval baselines and tighter validation loops.",
            representativePapers: [
              {
                title: "A Strong Multimodal RAG Paper",
                reason: "Introduces a reusable retrieval module.",
                sourceUrl: "https://example.com/paper-1",
              },
            ],
            commonBaselines: ["Standard RAG baseline"],
            commonModules: ["retrieval module"],
            openProblems: ["Need evidence for: Beat the baseline on LongDocBench"],
            suggestedRoutes: [
              "Validate against: Beat the baseline on LongDocBench",
              "Optimize for: retrieval recall",
            ],
            supportingSignals: ["Metric: retrieval recall"],
            createdAt: "2026-04-10T09:00:00.000Z",
            updatedAt: "2026-04-10T09:00:00.000Z",
          },
        ],
      });

      await writeJson(path.join(dir, "research", "module-assets.json"), {
        updatedAt: "2026-04-10T10:00:00.000Z",
        assets: [
          {
            id: "module-asset-1",
            repoUrl: "https://github.com/example/browser-agent-kit",
            owner: "example",
            repo: "browser-agent-kit",
            defaultBranch: "main",
            archivePath: path.join(dir, "research", "repo-archives", "browser-agent-kit.zip"),
            selectedPaths: ["src/controller.ts", "configs/eval.yaml"],
            notes: ["Useful for browser automation baseline extraction."],
            createdAt: "2026-04-10T10:00:00.000Z",
            updatedAt: "2026-04-10T10:00:00.000Z",
          },
        ],
      });

      await registerResearchRoutes(
        app,
        dir,
        researchService,
        taskService,
        directionService,
        discoveryService,
        discoveryScheduler,
      );

      const generatedResponse = await app.inject({
        method: "POST",
        url: "/api/research/candidates/direction-preset",
        payload: {
          reportId: "direction-report-1",
        },
      });
      assert.equal(generatedResponse.statusCode, 201);
      const generatedCandidate = generatedResponse.json();
      assert.equal(generatedCandidate.status, "draft");

      const approveResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedCandidate.id}/review`,
        payload: {
          decision: "approved",
          reviewer: "ops",
        },
      });
      assert.equal(approveResponse.statusCode, 200);
      assert.equal(approveResponse.json().status, "approved");

      const dryRunResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedCandidate.id}/apply`,
        payload: {
          dryRun: true,
        },
      });
      assert.equal(dryRunResponse.statusCode, 200);
      assert.equal(dryRunResponse.json().result.dryRun, true);

      const applyResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedCandidate.id}/apply`,
        payload: {
          reviewer: "ops",
        },
      });
      assert.equal(applyResponse.statusCode, 200);
      assert.equal(applyResponse.json().candidate.status, "applied");

      const fetchResponse = await app.inject({
        method: "GET",
        url: `/api/research/candidates/${generatedCandidate.id}`,
      });
      assert.equal(fetchResponse.statusCode, 200);
      assert.equal(fetchResponse.json().status, "applied");

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/research/candidates?status=applied&limit=5",
      });
      assert.equal(listResponse.statusCode, 200);
      assert.equal(listResponse.json().candidates.length, 1);

      const rollbackResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedCandidate.id}/rollback`,
        payload: {
          reviewer: "ops",
        },
      });
      assert.equal(rollbackResponse.statusCode, 200);
      assert.equal(rollbackResponse.json().candidate.status, "approved");

      const generatedSkillResponse = await app.inject({
        method: "POST",
        url: "/api/research/candidates/workspace-skill",
        payload: {
          assetId: "module-asset-1",
        },
      });
      assert.equal(generatedSkillResponse.statusCode, 201);
      const generatedSkillCandidate = generatedSkillResponse.json();
      assert.equal(generatedSkillCandidate.candidateType, "workspace-skill");

      const skillApproveResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedSkillCandidate.id}/review`,
        payload: {
          decision: "approved",
        },
      });
      assert.equal(skillApproveResponse.statusCode, 200);
      assert.equal(skillApproveResponse.json().status, "approved");

      const skillDryRunResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedSkillCandidate.id}/apply`,
        payload: {
          dryRun: true,
        },
      });
      assert.equal(skillDryRunResponse.statusCode, 200);
      assert.equal(skillDryRunResponse.json().result.targetType, "workspace-skill");

      const skillApplyResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedSkillCandidate.id}/apply`,
        payload: {
          reviewer: "ops",
        },
      });
      assert.equal(skillApplyResponse.statusCode, 200);
      assert.equal(skillApplyResponse.json().candidate.status, "applied");

      const skillListResponse = await app.inject({
        method: "GET",
        url: "/api/research/candidates?type=workspace-skill&status=applied&limit=5",
      });
      assert.equal(skillListResponse.statusCode, 200);
      assert.equal(skillListResponse.json().candidates.length, 1);

      const generatedSkillFile = await readFile(path.join(dir, "skills", "browser-agent-kit", "SKILL.md"), "utf8");
      assert.equal(generatedSkillFile.includes("Browser Agent Kit"), true);

      const skillRollbackResponse = await app.inject({
        method: "POST",
        url: `/api/research/candidates/${generatedSkillCandidate.id}/rollback`,
        payload: {
          reviewer: "ops",
        },
      });
      assert.equal(skillRollbackResponse.statusCode, 200);
      assert.equal(skillRollbackResponse.json().candidate.status, "approved");
      const skillsConfig = JSON.parse(await readFile(path.join(dir, "channels", "skills-config.json"), "utf8"));
      assert.equal("workspace:browser-agent-kit" in skillsConfig.entries, false);
      await assert.rejects(() => readFile(path.join(dir, "skills", "browser-agent-kit", "SKILL.md"), "utf8"));

      const updatedDirection = await directionService.getProfile("multimodal-rag");
      assert.equal(updatedDirection?.knownBaselines.includes("Standard RAG baseline"), false);
      assert.equal(updatedDirection?.currentGoals.some((goal) => goal.includes("Optimize for: retrieval recall")), false);

      await app.close();
    });
  });
}

await main();
