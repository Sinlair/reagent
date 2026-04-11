import assert from "node:assert/strict";

import { JobRuntimeService } from "../dist/services/jobRuntimeService.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function main() {
  await runTest("JobRuntimeService returns the busy value instead of overlapping direct runs", async () => {
    const deferred = createDeferred();
    let runCount = 0;
    const runtime = new JobRuntimeService({
      jobName: "test-job",
      async onRun() {
        runCount += 1;
        await deferred.promise;
        return "done";
      },
      onBusyReturn: () => "busy",
      onScheduledErrorReturn: () => "scheduled-error",
    });

    const first = runtime.runDirect();
    const second = await runtime.runDirect();
    assert.equal(second, "busy");
    deferred.resolve();
    assert.equal(await first, "done");
    assert.equal(runCount, 1);
  });

  await runTest("JobRuntimeService swallows scheduled errors and logs them", async () => {
    const logged = [];
    const runtime = new JobRuntimeService({
      jobName: "failing-job",
      logger: {
        error(payload, message) {
          logged.push({ payload, message });
        }
      },
      async onRun() {
        throw new Error("boom");
      },
      onBusyReturn: () => "busy",
      onScheduledErrorReturn: () => "scheduled-error",
      scheduledErrorMessage: "Failing job tick failed.",
    });

    await runtime.start({ intervalMs: 1000, immediate: true });
    assert.equal(runtime.isStarted(), true);
    await runtime.stop();

    assert.equal(logged.length, 1);
    assert.equal(logged[0].message, "Failing job tick failed.");
    assert.equal(logged[0].payload.jobName, "failing-job");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
