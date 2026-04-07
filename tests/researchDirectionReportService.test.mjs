import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDirectionReportService } from "../dist/services/researchDirectionReportService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-direction-report-"));
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
  await runTest("ResearchDirectionReportService generates a reusable direction report from stored signals", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        id: "multimodal-rag",
        label: "Multimodal RAG",
        summary: "Focus on practical long-document multimodal retrieval.",
        tlDr: "Prioritize reusable retrieval improvements with measurable gains.",
        targetProblem: "Improve long-document multimodal retrieval.",
        openQuestions: ["How should retrieval modules be adapted for long documents?"],
        currentGoals: ["Find reusable retrieval modules"],
        knownBaselines: ["Hybrid retrieval"],
        evaluationPriorities: ["retrieval recall"],
        successCriteria: ["Beat the current retrieval baseline on LongDocBench"],
        shortTermValidationTargets: ["LongDocBench"],
        blockedDirections: ["image classification"],
      });

      const now = new Date().toISOString();
      await writeJson(path.join(dir, "channels", "research-discovery-runs.json"), {
        updatedAt: now,
        runs: [
          {
            runId: "run-1",
            generatedAt: now,
            directionIds: ["multimodal-rag"],
            directionLabels: ["Multimodal RAG"],
            request: {
              directionId: "multimodal-rag",
              maxPapersPerQuery: 2,
              topK: 2,
              pushToWechat: false,
            },
            items: [
              {
                id: "paper-1",
                title: "A Strong Multimodal RAG Paper",
                authors: ["A. Researcher"],
                url: "https://example.com/paper-1",
                source: "crossref",
                directionId: "multimodal-rag",
                directionLabel: "Multimodal RAG",
                query: "multimodal rag",
                queryReason: "core direction",
                venuePreferenceMatched: true,
                datasetOrBenchmarkMatched: true,
              }
            ],
            digest: "Daily discovery for Multimodal RAG",
            pushed: false,
            warnings: []
          }
        ]
      });

      await writeJson(path.join(dir, "research", "deep-paper-reports.json"), {
        updatedAt: now,
        reports: [
          {
            id: "paper-report-1",
            paper: {
              id: "paper-1",
              title: "A Strong Multimodal RAG Paper",
              authors: ["A. Researcher"],
              url: "https://example.com/paper-1",
              venue: "NeurIPS",
              source: "crossref",
            },
            problemStatement: "Improve long-document multimodal retrieval.",
            coreMethod: "Adds a reusable retrieval module.",
            innovationPoints: ["Introduces a practical retrieval module."],
            strengths: ["PDF evidence was available."],
            weaknesses: ["Needs broader evaluation."],
            likelyBaselines: ["Standard RAG baseline"],
            recommendation: "Worth reading now.",
            evidenceSnippets: [
              {
                sourceType: "pdf",
                text: "We introduce a retrieval module for multimodal long documents."
              }
            ],
            conclusions: [
              {
                id: "conclusion-1",
                kind: "innovation",
                statement: "Introduces a practical retrieval module.",
                supportKind: "paper",
                confidence: "high",
                evidenceRefs: [],
                missingEvidence: "Needs more evidence across domains."
              }
            ],
            evidenceProfile: {
              paperSupportedCount: 1,
              codeSupportedCount: 0,
              inferenceCount: 0,
              speculationCount: 0,
              missingEvidenceCount: 1
            },
            createdAt: now,
            updatedAt: now
          }
        ]
      });

      await writeJson(path.join(dir, "research", "repo-reports.json"), {
        updatedAt: now,
        reports: [
          {
            id: "repo-report-1",
            url: "https://github.com/example/multimodal-rag",
            owner: "example",
            repo: "multimodal-rag",
            description: "Reusable multimodal rag module",
            likelyOfficial: true,
            keyPaths: ["src/retrieval", "src/fusion"],
            notes: ["Repository looks reusable."],
            stars: 120,
            createdAt: now,
            updatedAt: now
          }
        ]
      });

      const service = new ResearchDirectionReportService(dir);
      const report = await service.generate({ directionId: "multimodal-rag", days: 14 });

      assert.equal(report.directionId, "multimodal-rag");
      assert.equal(report.representativePapers.length > 0, true);
      assert.equal(report.commonBaselines.includes("Standard RAG baseline"), true);
      assert.equal(report.commonBaselines.includes("Hybrid retrieval"), true);
      assert.equal(report.commonModules.includes("src/retrieval"), true);
      assert.equal(report.openProblems.some((item) => item.includes("long documents")), true);
      assert.equal(report.suggestedRoutes.length > 0, true);
      assert.equal(report.overview.includes("Target problem: Improve long-document multimodal retrieval."), true);
      assert.equal(report.overview.includes("Success criteria: Beat the current retrieval baseline on LongDocBench"), true);
      assert.equal(report.suggestedRoutes.some((item) => item.includes("Optimize for: retrieval recall")), true);
      assert.equal(report.supportingSignals.some((item) => item.includes("Metric: retrieval recall")), true);

      const recent = await service.listRecent();
      assert.equal(recent.length, 1);
      assert.equal(recent[0]?.id, report.id);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
