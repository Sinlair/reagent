import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ResearchPresentationService } from "../dist/services/researchPresentationService.js";
import { ResearchLinkIngestionService } from "../dist/services/researchLinkIngestionService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-presentation-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ResearchPresentationService builds markdown and pptx deck with article images", async () => {
    await withTempDir(async (dir) => {
      const linkService = new ResearchLinkIngestionService(dir);
      const originalFetch = global.fetch;
      const pngBytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z0xUAAAAASUVORK5CYII=',
        'base64'
      );

      global.fetch = async (url) => {
        const href = String(url);
        if (href === "https://example.com/post") {
          return {
            ok: true,
            text: async () => `
              <html>
                <head>
                  <title>Article About RAG</title>
                  <meta property="og:image" content="https://example.com/image.png" />
                </head>
                <body>
                  <img src="https://example.com/image.png" />
                  <a href="https://arxiv.org/abs/2501.12345">paper</a>
                </body>
              </html>
            `,
          };
        }
        if (href === "https://example.com/image.png") {
          return {
            ok: true,
            headers: { get: (name) => name === "content-type" ? "image/png" : null },
            arrayBuffer: async () => pngBytes,
          };
        }
        throw new Error(`Unexpected fetch: ${href}`);
      };

      try {
        const sourceItem = await linkService.ingest({ url: "https://example.com/post" });
        await mkdir(path.join(dir, "research"), { recursive: true });
        await writeFile(
          path.join(dir, "research", "deep-paper-reports.json"),
          `${JSON.stringify({
            updatedAt: new Date().toISOString(),
            reports: [
              {
                id: "deep-1",
                sourceItemId: sourceItem.id,
                sourceUrl: sourceItem.url,
                paper: {
                  id: "paper-1",
                  title: "Multimodal RAG",
                  authors: [],
                  url: "https://arxiv.org/abs/2501.12345",
                  source: "arxiv"
                },
                repoCandidates: [],
                problemStatement: "Problem.",
                coreMethod: "Method.",
                innovationPoints: ["Innovation."],
                strengths: ["Strength."],
                weaknesses: ["Weakness."],
                likelyBaselines: ["Baseline."],
                recommendation: "Worth reading now.",
                evidenceSnippets: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ]
          }, null, 2)}\n`,
          "utf8"
        );

        const service = new ResearchPresentationService(dir, {
          async listRecentReports() {
            return [
              {
                taskId: "task-1",
                topic: "Multimodal RAG",
                generatedAt: new Date().toISOString(),
                summary: "A useful summary.",
                critiqueVerdict: "moderate",
                paperCount: 3,
                evidenceCount: 5,
              }
            ];
          },
          async getReport(taskId) {
            if (taskId !== "task-1") {
              return null;
            }
            return {
              taskId: "task-1",
              topic: "Multimodal RAG",
              generatedAt: new Date().toISOString(),
              plan: { objective: "obj", subquestions: [], searchQueries: [] },
              papers: [{ id: "paper-1", title: "Multimodal RAG", authors: [], url: "https://arxiv.org/abs/2501.12345", source: "arxiv" }],
              chunks: [],
              summary: "A useful summary.",
              findings: ["finding one", "finding two"],
              gaps: [],
              nextActions: ["try baseline A"],
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
              }
            };
          }
        });

        const result = await service.generateWeeklyPresentation({ topic: "RAG" });
        assert.equal(result.sourceReportTaskIds[0], "task-1");
        assert.equal(result.slideMarkdown.includes("# Research Meeting Deck"), true);
        assert.equal(result.imagePaths.length, 1);
        assert.equal(result.pptxPath?.endsWith(".pptx"), true);
        await stat(result.pptxPath);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
