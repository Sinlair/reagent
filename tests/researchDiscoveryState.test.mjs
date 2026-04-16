import assert from "node:assert/strict";

import {
  buildDiscoveryRunState,
  summarizeDiscoveryCandidateReasons,
} from "../web/researchDiscoveryState.js";

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
  await runTest("research discovery state marks empty runs explicitly", async () => {
    assert.deepEqual(
      buildDiscoveryRunState({
        items: [],
        warnings: [],
      }),
      {
        kind: "empty",
        tone: "warn",
      },
    );
  });

  await runTest("research discovery state marks narrow or warned runs as weak", async () => {
    assert.deepEqual(
      buildDiscoveryRunState({
        items: [{ id: "paper-1" }],
        warnings: [],
      }),
      {
        kind: "weak",
        tone: "warn",
      },
    );

    assert.deepEqual(
      buildDiscoveryRunState({
        items: [{ id: "paper-1" }, { id: "paper-2" }, { id: "paper-3" }],
        warnings: ["Only one venue matched."],
      }),
      {
        kind: "weak",
        tone: "warn",
      },
    );
  });

  await runTest("research discovery state summarizes ranking reasons with query fallback", async () => {
    assert.deepEqual(
      summarizeDiscoveryCandidateReasons({
        rankingReasons: ["Target problem match.", "Benchmark match."],
        queryReason: "Preferred venue seed.",
        relevanceReason: "Extra reason that should be trimmed away.",
      }),
      ["Target problem match.", "Benchmark match.", "Preferred venue seed."],
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
