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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-audit-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    return {
      taskId: "task-openclaw-audit",
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

  async watchSessionEvents(input) {
    queueMicrotask(() => {
      void input.onEvent({
        event: "sessions.changed",
        payload: {
          sessionKey: "agent:main:thread:wx-user-audit",
          reason: "patch",
        },
      });
    });
    queueMicrotask(() => {
      void input.onEvent({
        event: "session.message",
        payload: {
          sessionKey: "agent:main:thread:wx-user-audit",
          messageId: "evt-audit-1",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "audit reply" }],
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
  await runTest("ChannelService persists OpenClaw host events to the event audit log", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge: new StubOpenClawBridge(),
      });

      await channels.start();

      for (let index = 0; index < 20; index += 1) {
        const items = await channels.listOpenClawEventAudit(10);
        if (items.length >= 2) {
          assert.equal(items.some((item) => item.event === "sessions.changed"), true);
          assert.equal(items.some((item) => item.event === "session.message" && item.messageId === "evt-audit-1"), true);
          assert.equal(items.some((item) => item.text === "audit reply"), true);
          await channels.close();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await channels.close();
      assert.fail("Timed out waiting for OpenClaw host events to persist to the audit log.");
    });
  });
}

await main();
