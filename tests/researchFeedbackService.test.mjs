import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";
import { ResearchDiscoveryService } from "../dist/services/researchDiscoveryService.js";
import { ResearchFeedbackService } from "../dist/services/researchFeedbackService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-feedback-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchFeedbackService stores feedback and summarizes recent signals", async () => {
    await withTempDir(async (dir) => {
      const service = new ResearchFeedbackService(dir);

      await service.record({
        feedback: "more-like-this",
        directionId: "multimodal-rag",
        topic: "multimodal rag",
        paperTitle: "A Strong Multimodal RAG Paper",
        venue: "NeurIPS",
        notes: "Prefer practical retrieval modules.",
      });

      await service.record({
        feedback: "too-theoretical",
        topic: "formal theorem-heavy work",
      });

      const recent = await service.listRecent();
      const summary = await service.getSummary();

      assert.equal(recent.length, 2);
      assert.equal(summary.total, 2);
      assert.equal(summary.counts["more-like-this"], 1);
      assert.equal(summary.counts["too-theoretical"], 1);
    });
  });

  await runTest("ResearchDiscoveryService uses recorded feedback to boost matching candidates", async () => {
    await withTempDir(async (dir) => {
      const directionService = new ResearchDirectionService(dir);
      await directionService.upsertProfile({
        id: "multimodal-rag",
        label: "Multimodal RAG",
        queryHints: ["multimodal rag"],
      });

      const feedbackService = new ResearchFeedbackService(dir);
      await feedbackService.record({
        feedback: "more-like-this",
        directionId: "multimodal-rag",
        paperTitle: "strong multimodal rag",
        venue: "NeurIPS",
        notes: "Prefer practical retrieval modules.",
      });

      const discoveryService = new ResearchDiscoveryService(dir, {
        searchProvider: {
          async search() {
            return [
              {
                id: "paper-strong",
                title: "A Strong Multimodal RAG Paper",
                abstract: "A practical retrieval module for MMMU with reproducible engineering details.",
                authors: ["A. Researcher"],
                url: "https://example.com/paper-strong",
                year: 2026,
                venue: "NeurIPS",
                source: "crossref",
              },
              {
                id: "paper-weak",
                title: "Formal Retrieval Bounds",
                abstract: "A theorem-heavy formal analysis with limited implementation detail.",
                authors: ["B. Researcher"],
                url: "https://example.com/paper-weak",
                year: 2026,
                venue: "Theory Workshop",
                source: "crossref",
              }
            ];
          }
        },
        feedbackService,
      });

      const result = await discoveryService.runDiscovery({ directionId: "multimodal-rag", topK: 2, maxPapersPerQuery: 2 });

      assert.equal(result.items[0]?.title, "A Strong Multimodal RAG Paper");
      assert.equal(
        result.items[0]?.rankingReasons?.some((reason) => reason.includes("Feedback adjustment")),
        true
      );
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
