import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env.NODE_ENV = "test";
process.env.LLM_PROVIDER = "fallback";
process.env.WECHAT_PROVIDER = "mock";
process.env.OPENCLAW_CLI_PATH = "openclaw";
process.env.OPENCLAW_GATEWAY_URL = "ws://127.0.0.1:18789";
process.env.OPENCLAW_WECHAT_CHANNEL_ID = "openclaw-weixin";
process.env.RESEARCH_AGENT_NAME = "ReAgent";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-gateway-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const { default: Fastify } = await import("fastify");
  const { getGatewayServiceStatus } = await import("../dist/gatewayService.js");
  const { registerHealthRoutes } = await import("../dist/routes/health.js");
  const { registerUiRoutes } = await import("../dist/routes/ui.js");

  await runTest("Gateway service status exposes control-plane commands without probing", async () => {
    const snapshot = await getGatewayServiceStatus(DEFAULT_GATEWAY_PORT, {
      probe: false,
      runtimeOverride: {
        healthReachable: true,
        healthStatus: "ok",
        runtimeWorkspaceDir: "/tmp/reagent-workspace",
        runtimeAgent: "ReAgent",
        runtimeLlmProvider: "fallback",
        runtimeWechatProvider: "mock",
        runtimeOpenClawCli: "openclaw",
        listenerPid: 4321,
      },
    });

    assert.equal(snapshot.healthReachable, true);
    assert.equal(snapshot.healthStatus, "ok");
    assert.equal(snapshot.installCommand, `reagent service install --port ${DEFAULT_GATEWAY_PORT}`);
    assert.equal(snapshot.statusCommand, "reagent service status");
    assert.equal(snapshot.deepStatusCommand, "reagent service status --deep");
    assert.equal(snapshot.logsCommand, "reagent service logs");
    assert.equal(snapshot.doctorCommand, "reagent runtime doctor");
    assert.equal(snapshot.deepDoctorCommand, "reagent runtime doctor --deep");
  });

  await runTest("Runtime meta exposes gateway supervisor state and commands", async () => {
    await withTempDir(async (dir) => {
      const workspaceDir = path.join(dir, "workspace");
      await mkdir(workspaceDir, { recursive: true });

      const app = Fastify();
      try {
        await registerHealthRoutes(app, workspaceDir);
        const response = await app.inject({
          method: "GET",
          url: "/api/runtime/meta",
        });

        assert.equal(response.statusCode, 200);
        const payload = response.json();
        assert.equal(payload.deployment.gateway.defaultPort, DEFAULT_GATEWAY_PORT);
        assert.equal(typeof payload.deployment.gateway.runtime.currentProcessPid, "number");
        assert.equal(payload.deployment.gateway.supervisor.healthReachable, true);
        assert.ok(payload.deployment.gateway.commands.install.includes("reagent service install"));
        assert.ok(payload.deployment.alwaysOn.modes[0].deepStatusCommand.includes("--deep"));
      } finally {
        await app.close();
      }
    });
  });

  await runTest("Runtime log route prefers gateway daemon logs when present", async () => {
    await withTempDir(async (dir) => {
      process.env.REAGENT_STATE_DIR = path.join(dir, "state");
      const daemonDir = path.join(process.env.REAGENT_STATE_DIR, "daemon");
      await mkdir(daemonDir, { recursive: true });
      await writeFile(path.join(daemonDir, "gateway.out.log"), "line-one\nline-two\n", "utf8");
      await writeFile(path.join(daemonDir, "gateway.err.log"), "err-one\n", "utf8");

      const app = Fastify();
      try {
        await registerUiRoutes(app);
        const response = await app.inject({
          method: "GET",
          url: "/api/ui/runtime-log?lines=20",
        });

        assert.equal(response.statusCode, 200);
        const payload = response.json();
        assert.equal(payload.source, "gateway-daemon");
        assert.ok(payload.stdout.path.endsWith("gateway.out.log"));
        assert.ok(payload.stdout.content.includes("line-two"));
        assert.ok(payload.stderr.path.endsWith("gateway.err.log"));
      } finally {
        delete process.env.REAGENT_STATE_DIR;
        await app.close();
      }
    });
  });
}

const DEFAULT_GATEWAY_PORT = 18789;

await main();
