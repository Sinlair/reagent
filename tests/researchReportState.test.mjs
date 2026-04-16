import assert from "node:assert/strict";

import {
  buildResearchReportWarnings,
  deriveResearchEvidenceSupportKind,
  formatResearchCoveragePercent,
  summarizeResearchSupportKinds,
} from "../web/researchReportState.js";

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
  await runTest("research report state marks paper-backed evidence cards", async () => {
    assert.equal(
      deriveResearchEvidenceSupportKind({
        paperId: "paper-1",
        sourceType: "pdf",
      }),
      "paper",
    );
  });

  await runTest("research report state surfaces weak coverage and inference-heavy warnings", async () => {
    const report = {
      findings: ["finding-1", "finding-2", "finding-3"],
      evidence: [
        {
          paperId: "paper-1",
          chunkId: "chunk-1",
          sourceType: "abstract",
        },
      ],
      critique: {
        supportedEvidenceCount: 1,
        unsupportedEvidenceCount: 2,
        citationCoverage: 0.33,
      },
    };

    assert.deepEqual(summarizeResearchSupportKinds(report), ["paper", "inference"]);
    assert.deepEqual(buildResearchReportWarnings(report), [
      { kind: "low_coverage", tone: "warn", coverage: 0.33 },
      { kind: "unsupported_evidence", tone: "warn", count: 2 },
      { kind: "inference_heavy", tone: "warn", supportedCount: 1, unsupportedCount: 2 },
    ]);
  });

  await runTest("research report state formats coverage as a percent and flags missing evidence", async () => {
    const report = {
      findings: ["finding-1"],
      evidence: [],
      critique: {
        supportedEvidenceCount: 0,
        unsupportedEvidenceCount: 0,
        citationCoverage: 0,
      },
    };

    assert.equal(formatResearchCoveragePercent(0.5), "50%");
    assert.deepEqual(buildResearchReportWarnings(report), [
      { kind: "no_evidence", tone: "danger" },
    ]);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
