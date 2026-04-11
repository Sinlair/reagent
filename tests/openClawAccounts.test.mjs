import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ChannelService } from "../dist/services/channelService.js";
import { MemoryService } from "../dist/services/memoryService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-accounts-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    return {
      taskId: "task-openclaw-accounts",
      summary: "stub",
      findings: [],
    };
  }
}

class StubOpenClawBridge {
  async start() {}

  async close() {}

  async getWeChatStatus() {
    return {
      providerMode: "openclaw",
      configured: true,
      linked: true,
      running: true,
      connected: true,
      accountId: "wx_ops_2",
      accountName: "Ops Bot",
      accounts: [
        {
          accountId: "wx_main_1",
          accountName: "Main Bot",
          connected: false,
          running: true,
        },
        {
          accountId: "wx_ops_2",
          accountName: "Ops Bot",
          connected: true,
          running: true,
        },
      ],
      pluginInstalled: true,
      pluginVersion: "2.1.1",
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayReachable: true,
      updatedAt: new Date().toISOString(),
      notes: [],
    };
  }
}

async function main() {
  await runTest("ChannelService exposes OpenClaw account lists in status snapshots", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge: new StubOpenClawBridge(),
      });

      const snapshot = await channels.getStatusSnapshot();
      assert.equal(snapshot.channels.wechat.providerMode, "openclaw");
      assert.equal(snapshot.channels.wechat.accountId, "wx_ops_2");
      assert.equal(snapshot.channels.wechat.accountName, "Ops Bot");
      assert.equal(Array.isArray(snapshot.channels.wechat.accounts), true);
      assert.equal(snapshot.channels.wechat.accounts.length, 2);
      assert.deepEqual(snapshot.channels.wechat.accounts.map((account) => account.accountId), [
        "wx_main_1",
        "wx_ops_2",
      ]);
    });
  });
}

await main();
