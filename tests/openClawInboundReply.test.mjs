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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-inbound-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    return {
      taskId: "task-openclaw-inbound",
      summary: "stub",
      findings: [],
    };
  }
}

class StubOpenClawBridge {
  constructor() {
    this.connected = false;
    this.sent = [];
  }

  async start() {}

  async close() {}

  async getWeChatStatus() {
    return {
      providerMode: "openclaw",
      configured: true,
      linked: this.connected,
      running: true,
      connected: this.connected,
      accountId: this.connected ? "wx_real_1" : undefined,
      accountName: this.connected ? "Real Operator" : undefined,
      pluginInstalled: true,
      pluginVersion: "2.1.1",
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayReachable: true,
      updatedAt: new Date().toISOString(),
      notes: [],
    };
  }

  async startLogin() {
    return {
      message: "QR ready",
      qrDataUrl: "data:image/png;base64,qr",
      connected: false,
      providerMode: "openclaw",
    };
  }

  async waitLogin() {
    this.connected = true;
    return {
      message: "Connected via OpenClaw.",
      connected: true,
      providerMode: "openclaw",
    };
  }

  async logout() {
    this.connected = false;
    return {
      providerMode: "openclaw",
      configured: true,
      linked: false,
      running: true,
      connected: false,
      lastMessage: "Logged out.",
      pluginInstalled: true,
      pluginVersion: "2.1.1",
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayReachable: true,
      updatedAt: new Date().toISOString(),
      notes: [],
    };
  }

  async sendMessage(input) {
    if (!this.connected) {
      throw new Error("WeChat is not connected. Complete QR login before pushing messages.");
    }
    this.sent.push({ ...input });
    return {
      messageId: `oc-reply-${this.sent.length}`,
      channel: "openclaw-weixin",
    };
  }

  async listSessions() {
    return [
      {
        sessionKey: "agent:main:thread:wx-user-3",
        channel: "openclaw-weixin",
        to: "wx-user-3",
        accountId: "wx_session_3",
        threadId: "thread-session-3",
        displayName: "Carol",
        updatedAt: 1775608300000,
      },
    ];
  }

  async sendSessionMessage(input) {
    this.sent.push({ ...input, via: "session" });
    return {
      messageId: `oc-session-reply-${this.sent.length}`,
      channel: "openclaw-weixin",
      to: "wx-user-3",
      accountId: "wx_session_3",
      threadId: "thread-session-3",
    };
  }
}

async function main() {
  await runTest("ChannelService delivers inbound OpenClaw replies through the bridge", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.startWeChatLogin(false);
      const loginStatus = await channels.completeWeChatLogin();
      assert.equal(loginStatus.connected, true);

      const reply = await channels.receiveWeChatMessage({
        senderId: "wx-user-3",
        senderName: "Carol",
        text: "/remember Carol prefers OpenClaw parity",
      });

      assert.equal(reply.accepted, true);
      assert.equal(reply.reply, "Saved to today's memory file.");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        sessionKey: "agent:main:thread:wx-user-3",
        text: "Saved to today's memory file.",
        via: "session",
      });

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.some((message) => message.direction === "inbound"), true);
      assert.equal(messages.some((message) => message.text === "Saved to today's memory file."), true);
      assert.equal(messages.some((message) => message.id === "oc-session-reply-1"), true);
    });
  });

  await runTest("ChannelService falls back to sender-matched OpenClaw account and thread context for inbound replies", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      openClawBridge.sendSessionMessage = undefined;
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const reply = await channels.receiveWeChatMessage({
        senderId: "wx-user-3",
        senderName: "Carol",
        text: "/remember Carol wants sender session fallback",
      });

      assert.equal(reply.accepted, true);
      assert.equal(reply.reply, "Saved to today's memory file.");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        to: "wx-user-3",
        text: "Saved to today's memory file.",
        accountId: "wx_session_3",
        threadId: "thread-session-3",
      });
    });
  });
}

await main();
