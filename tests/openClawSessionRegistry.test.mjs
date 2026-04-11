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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-registry-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    return {
      taskId: "task-openclaw-registry",
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
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayReachable: true,
      pluginInstalled: true,
      pluginVersion: "2.1.1",
      updatedAt: new Date().toISOString(),
      notes: [],
    };
  }

  async listSessions() {
    return [
      {
        sessionKey: "agent:main:thread:wx-user-registry",
        channel: "openclaw-weixin",
        to: "wx-user-registry",
        accountId: "wx_ops_2",
        threadId: "thread-1",
        displayName: "Registry Session",
        lastMessagePreview: "seed preview",
        updatedAt: 1775608200000,
      },
    ];
  }

  async watchSessionEvents(input) {
    queueMicrotask(() => {
      void input.onEvent({
        event: "session.message",
        payload: {
          sessionKey: "agent:main:thread:wx-user-registry",
          lastChannel: "openclaw-weixin",
          lastTo: "wx-user-registry",
          lastAccountId: "wx_ops_2",
          lastThreadId: "thread-1",
          messageId: "evt-registry-1",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "registry reply" }],
          },
        },
      });
    });
    return {
      close: async () => {
        await input.onClose?.();
      },
    };
  }
}

async function main() {
  await runTest("ChannelService builds and updates an internal OpenClaw session registry", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge: new StubOpenClawBridge(),
      });

      await channels.start();

      for (let index = 0; index < 20; index += 1) {
        const items = await channels.listOpenClawSessionRegistry(10);
        const session = items.find((entry) => entry.sessionKey === "agent:main:thread:wx-user-registry");
        if (session && session.lastMessageId === "evt-registry-1") {
          const snapshot = await channels.getStatusSnapshot();
          assert.equal(snapshot.channels.wechat.hostSessionRegistryCount, 1);
          assert.equal(Boolean(snapshot.channels.wechat.hostSessionRegistryUpdatedAt), true);
          assert.equal(session.channel, "openclaw-weixin");
          assert.equal(session.to, "wx-user-registry");
          assert.equal(session.accountId, "wx_ops_2");
          assert.equal(session.threadId, "thread-1");
          assert.equal(session.displayName, "Registry Session");
          assert.equal(session.lastMessagePreview, "registry reply");
          assert.equal(session.lastMessageRole, "assistant");
          await channels.close();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await channels.close();
      assert.fail("Timed out waiting for OpenClaw session registry to update.");
    });
  });
}

await main();
