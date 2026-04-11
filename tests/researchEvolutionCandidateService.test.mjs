import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import {
  ResearchEvolutionCandidateError,
  ResearchEvolutionCandidateService,
} from "../dist/services/researchEvolutionCandidateService.js";
import { SkillRegistryService } from "../dist/services/skillRegistryService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-evolution-candidate-"));
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

async function main() {
  await runTest("ResearchEvolutionCandidateService generates, reviews, dry-runs, and applies direction preset candidates", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        id: "multimodal-rag",
        label: "Multimodal RAG",
        summary: "Existing workspace summary should be preserved.",
        currentGoals: ["Track reusable retrieval modules"],
        queryHints: ["multimodal rag retrieval"],
        knownBaselines: ["Hybrid retrieval"],
        evaluationPriorities: ["retrieval recall"],
        shortTermValidationTargets: ["LongDocBench"],
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
              "Short-term validation: LongDocBench reproduction",
            ],
            supportingSignals: [
              "Metric: retrieval recall",
              "A Strong Multimodal RAG Paper",
            ],
            createdAt: "2026-04-10T09:00:00.000Z",
            updatedAt: "2026-04-10T09:00:00.000Z",
          },
        ],
      });

      const service = new ResearchEvolutionCandidateService(dir);
      const candidate = await service.generateDirectionPresetCandidateFromReport("direction-report-1");

      assert.equal(candidate.status, "draft");
      assert.equal(candidate.sourceId, "direction-report-1");
      assert.equal(candidate.payload.label, "Multimodal RAG");
      assert.equal(candidate.payload.knownBaselines.includes("Hybrid retrieval"), true);
      assert.equal(candidate.payload.knownBaselines.includes("Standard RAG baseline"), true);
      assert.equal(candidate.payload.evaluationPriorities.includes("retrieval recall"), true);
      assert.equal(candidate.evidence.some((item) => item.kind === "paper"), true);

      const preview = await service.applyCandidate(candidate.id, { dryRun: true, reviewer: "ops" });
      assert.equal(preview.result.dryRun, true);
      assert.equal(preview.result.targetId, "multimodal-rag");
      assert.equal(preview.result.changedFields.includes("knownBaselines"), true);
      assert.equal(preview.result.after.summary, "Existing workspace summary should be preserved.");

      const storedAfterPreview = await service.getCandidate(candidate.id);
      assert.equal(storedAfterPreview?.applyHistory.length, 0);

      await assert.rejects(
        () => service.applyCandidate(candidate.id),
        (error) => error instanceof ResearchEvolutionCandidateError && error.message.includes("Only approved"),
      );

      const approved = await service.reviewCandidate(candidate.id, {
        decision: "approved",
        reviewer: "ops",
        notes: "Looks safe to merge into the direction preset.",
      });
      assert.equal(approved.status, "approved");
      assert.equal(approved.reviews[0]?.decision, "approved");

      const applied = await service.applyCandidate(candidate.id, {
        reviewer: "ops",
        notes: "Applying the approved preset.",
      });
      assert.equal(applied.candidate.status, "applied");
      assert.equal(applied.result.dryRun, false);
      assert.equal(applied.result.changedFields.includes("currentGoals"), true);

      const updatedDirection = await directionService.getProfile("multimodal-rag");
      assert.equal(updatedDirection?.summary, "Existing workspace summary should be preserved.");
      assert.equal(updatedDirection?.knownBaselines.includes("Standard RAG baseline"), true);
      assert.equal(updatedDirection?.currentGoals.some((goal) => goal.includes("Optimize for: retrieval recall")), true);
      assert.equal(
        updatedDirection?.shortTermValidationTargets.includes("Beat the baseline on LongDocBench"),
        true,
      );

      const appliedCandidates = await service.listRecent(10, "applied");
      assert.equal(appliedCandidates.length, 1);
      assert.equal(appliedCandidates[0]?.id, candidate.id);

      const rolledBack = await service.rollbackCandidate(candidate.id, {
        reviewer: "ops",
        notes: "Reverting the candidate application.",
      });
      assert.equal(rolledBack.candidate.status, "approved");
      assert.equal(rolledBack.result.targetType, "research-direction");
      assert.equal(rolledBack.result.after?.knownBaselines.includes("Hybrid retrieval"), true);

      const restoredDirection = await directionService.getProfile("multimodal-rag");
      assert.equal(restoredDirection?.knownBaselines.includes("Standard RAG baseline"), false);
      assert.equal(restoredDirection?.currentGoals.includes("Track reusable retrieval modules"), true);

      await assert.rejects(
        () => service.rollbackCandidate(candidate.id),
        (error) => error instanceof ResearchEvolutionCandidateError && error.message.includes("Only applied"),
      );
    });
  });

  await runTest("ResearchEvolutionCandidateService materializes approved workspace skill candidates from module assets", async () => {
    await withTempDir(async (dir) => {
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

      const service = new ResearchEvolutionCandidateService(dir);
      const candidate = await service.generateWorkspaceSkillCandidateFromAsset("module-asset-1");

      assert.equal(candidate.candidateType, "workspace-skill");
      assert.equal(candidate.payload.skillKey, "workspace:browser-agent-kit");
      assert.equal(candidate.payload.enabled, false);
      assert.equal(candidate.payload.referenceFiles.includes("SOURCE.md"), true);

      const preview = await service.applyCandidate(candidate.id, { dryRun: true });
      assert.equal(preview.result.targetType, "workspace-skill");
      assert.equal(preview.result.targetId, "workspace:browser-agent-kit");
      assert.equal(preview.result.after.skillFilePath.endsWith(path.join("browser-agent-kit", "SKILL.md")), true);
      assert.equal(preview.result.after.enabled, false);

      await assert.rejects(
        () => service.applyCandidate(candidate.id),
        (error) => error instanceof ResearchEvolutionCandidateError && error.message.includes("Only approved"),
      );

      await service.reviewCandidate(candidate.id, {
        decision: "approved",
        reviewer: "ops",
      });
      const applied = await service.applyCandidate(candidate.id, {
        reviewer: "ops",
        notes: "Materializing the reviewed workspace skill.",
      });

      assert.equal(applied.candidate.status, "applied");
      assert.equal(applied.result.targetType, "workspace-skill");

      const skillFilePath = path.join(dir, "skills", "browser-agent-kit", "SKILL.md");
      const sourceFilePath = path.join(dir, "skills", "browser-agent-kit", "SOURCE.md");
      const configPath = path.join(dir, "channels", "skills-config.json");

      const skillContent = await readFile(skillFilePath, "utf8");
      const sourceContent = await readFile(sourceFilePath, "utf8");
      const config = JSON.parse(await readFile(configPath, "utf8"));

      assert.equal(skillContent.includes("name: Browser Agent Kit"), true);
      assert.equal(skillContent.includes("enabled: false"), true);
      assert.equal(skillContent.includes("references: SOURCE.md"), true);
      assert.equal(sourceContent.includes("module-asset-1"), true);
      assert.equal(sourceContent.includes("src/controller.ts"), true);
      assert.equal(config.entries["workspace:browser-agent-kit"].enabled, false);

      const registry = new SkillRegistryService(dir);
      const generatedSkill = await registry.getSkill("workspace:browser-agent-kit");
      assert.equal(generatedSkill?.label, "Browser Agent Kit");
      assert.equal(generatedSkill?.status, "disabled");

      const rolledBack = await service.rollbackCandidate(candidate.id, {
        reviewer: "ops",
        notes: "Removing the generated workspace skill.",
      });
      assert.equal(rolledBack.candidate.status, "approved");
      assert.equal(rolledBack.result.targetType, "workspace-skill");
      await assert.rejects(() => readFile(skillFilePath, "utf8"));
      await assert.rejects(() => readFile(sourceFilePath, "utf8"));
      const configAfterRollback = JSON.parse(await readFile(configPath, "utf8"));
      assert.equal("workspace:browser-agent-kit" in configAfterRollback.entries, false);
      const removedSkill = await registry.getSkill("workspace:browser-agent-kit");
      assert.equal(removedSkill, null);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
