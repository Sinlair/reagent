import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-sync-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    return {
      taskId: "task-openclaw-sync",
      summary: "stub",
      findings: [],
    };
  }
}

class StubOpenClawBridge {
  constructor() {
    this.connected = true;
    this.subscription = null;
  }

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
    this.subscription = input;
    queueMicrotask(() => {
      void input.onEvent({
        event: "session.message",
        payload: {
          sessionKey: "agent:main:thread:wx-user-sync",
          lastChannel: "openclaw-weixin",
          lastTo: "wx-user-sync",
          messageId: "evt-user-1",
          message: {
            role: "user",
            content: [{ type: "text", text: "hello from host event" }],
          },
        },
      });
    });
    queueMicrotask(() => {
      void input.onEvent({
        event: "session.message",
        payload: {
          sessionKey: "agent:main:thread:wx-user-sync",
          lastChannel: "openclaw-weixin",
          lastTo: "wx-user-sync",
          messageId: "evt-assistant-1",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "reply from host event" }],
          },
        },
      });
    });
    return {
      close: async () => {
        this.subscription = null;
        await input.onClose?.();
      },
    };
  }
}

async function main() {
  await runTest("ChannelService syncs OpenClaw host session messages into the transcript", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge: new StubOpenClawBridge(),
      });

      await channels.start();

      for (let index = 0; index < 100; index += 1) {
        const messages = await channels.listWeChatMessages();
        if (
          messages.some((message) => message.id === "evt-user-1") &&
          messages.some((message) => message.id === "evt-assistant-1")
        ) {
          assert.equal(messages.some((message) => message.direction === "inbound" && message.text === "hello from host event"), true);
          assert.equal(messages.some((message) => message.direction === "outbound" && message.text === "reply from host event"), true);
          await channels.close();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await channels.close();
      assert.fail("Timed out waiting for OpenClaw host events to sync into the transcript.");
    });
  });

  await runTest("ChannelService surfaces cached OpenClaw session transcripts in message lists", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      await mkdir(path.join(dir, "channels", "openclaw-session-transcripts"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "openclaw-sessions.json"),
        `${JSON.stringify(
          {
            updatedAt: "2026-04-09T12:00:00.000Z",
            sessions: [
              {
                sessionKey: "agent:main:thread:wx-user-cache",
                channel: "openclaw-weixin",
                to: "wx-user-cache",
                accountId: "wx_ops_2",
                displayName: "Cached User",
                lastSyncedAt: "2026-04-09T12:00:00.000Z",
              },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await writeFile(
        path.join(dir, "channels", "openclaw-session-transcripts", "agent_main_thread_wx-user-cache.json"),
        `${JSON.stringify(
          {
            updatedAt: "2026-04-09T12:05:00.000Z",
            messages: [
              {
                id: "cached-user-1",
                role: "user",
                text: "cached host hello",
                createdAt: "2026-04-09T12:04:00.000Z",
              },
              {
                id: "cached-assistant-1",
                role: "assistant",
                text: "cached host reply",
                createdAt: "2026-04-09T12:05:00.000Z",
              },
            ],
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge: new StubOpenClawBridge(),
      });

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.some((message) => message.id === "cached-user-1"), true);
      assert.equal(messages.some((message) => message.id === "cached-assistant-1"), true);
      assert.equal(messages.some((message) => message.direction === "inbound" && message.text === "cached host hello"), true);
      assert.equal(messages.some((message) => message.direction === "outbound" && message.text === "cached host reply"), true);
      assert.equal(messages.some((message) => message.senderId === "wx-user-cache"), true);

      const uiMessages = await channels.listUiChatMessages();
      assert.equal(uiMessages.some((message) => message.id === "cached-user-1"), true);
      assert.equal(uiMessages.some((message) => message.id === "cached-assistant-1"), true);
    });
  });
}

await main();
