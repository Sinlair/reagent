import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MemoryRecallService } from "../dist/services/memoryRecallService.js";
import { MemoryService } from "../dist/services/memoryService.js";
import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-memory-recall-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("MemoryRecallService merges workspace memory with artifact recall hits", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      const recall = new MemoryRecallService(dir);

      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "SQLite decision",
        content: "Use SQLite as the default local store for the OpenClaw workspace.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
        tags: ["storage", "sqlite"],
      });

      await directions.upsertProfile({
        id: "multimodal-rag",
        label: "Multimodal RAG",
        summary: "Track practical multimodal retrieval systems.",
        knownBaselines: ["RAG"],
        evaluationPriorities: ["retrieval recall"],
      });

      const reportStorePath = path.join(dir, "research", "direction-reports.json");
      await mkdir(path.dirname(reportStorePath), { recursive: true });
      await writeFile(
        reportStorePath,
        `${JSON.stringify(
          {
            updatedAt: new Date().toISOString(),
            reports: [
              {
                id: "report-1",
                topic: "Agentic Retrieval",
                overview: "RAG baseline plus tool-routing remains strong.",
                representativePapers: [{ title: "Paper A", reason: "Uses tool-routing." }],
                commonBaselines: ["RAG"],
                commonModules: ["router"],
                openProblems: ["Need better eval"],
                suggestedRoutes: ["Test routing policies"],
                supportingSignals: ["retrieval recall"],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const results = await recall.recall("RAG baseline", { limit: 6 });
      assert.equal(results.hits.length >= 2, true);
      assert.equal(results.hits.some((hit) => hit.layer === "workspace" && hit.title.includes("SQLite decision")), true);
      assert.equal(results.hits.some((hit) => hit.layer === "artifact" && hit.artifactType === "research-brief"), true);
      assert.equal(results.hits.some((hit) => hit.layer === "artifact" && hit.artifactType === "direction-report"), true);

      const indexRaw = await readFile(path.join(dir, "memory-index.json"), "utf8");
      assert.equal(indexRaw.includes("\"sourceType\": \"user-stated\""), true);
      assert.equal(indexRaw.includes("\"confidence\": \"high\""), true);
    });
  });
}

await main();
