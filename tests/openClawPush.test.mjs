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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-push-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    return {
      taskId: "task-openclaw-push",
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
      messageId: `oc-push-${this.sent.length}`,
      channel: "openclaw-weixin",
    };
  }

  async listSessions() {
    return [
      {
        sessionKey: "agent:main:thread:wx-user-6",
        channel: "openclaw-weixin",
        to: "wx-session-user",
        accountId: "wx_real_1",
        threadId: "thread-session-1",
        displayName: "Session User",
        updatedAt: 1775608200000,
      },
    ];
  }

  async sendSessionMessage(input) {
    this.sent.push({ ...input, via: "session" });
    return {
      messageId: `oc-session-${this.sent.length}`,
      channel: "openclaw-weixin",
      to: "wx-session-user",
      accountId: "wx_real_1",
      threadId: "thread-session-1",
    };
  }
}

async function main() {
  await runTest("ChannelService supports proactive push on the OpenClaw bridge path", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      const loginStart = await channels.startWeChatLogin(false);
      assert.equal(loginStart.providerMode, "openclaw");
      assert.ok(loginStart.qrDataUrl);

      const loginStatus = await channels.completeWeChatLogin();
      assert.equal(loginStatus.connected, true);
      assert.equal(loginStatus.accountId, "wx_real_1");

      const pushReply = await channels.pushWeChatMessage({
        senderId: "wx-user-2",
        senderName: "Bob",
        text: "OpenClaw proactive push",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "OpenClaw proactive push");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        to: "wx-user-2",
        text: "OpenClaw proactive push",
        accountId: "wx_real_1",
      });

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.some((message) => message.direction === "outbound"), true);
      assert.equal(messages.some((message) => message.text === "OpenClaw proactive push"), true);
      assert.equal(messages.some((message) => message.id === "oc-push-1"), true);
    });
  });

  await runTest("ChannelService forwards explicit OpenClaw account and thread overrides for proactive push", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const pushReply = await channels.pushWeChatMessage({
        senderId: "wx-user-4",
        senderName: "Dana",
        text: "OpenClaw account override",
        accountId: "wx_override_9",
        threadId: "thread-42",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "OpenClaw account override");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        to: "wx-user-4",
        text: "OpenClaw account override",
        accountId: "wx_override_9",
        threadId: "thread-42",
      });
    });
  });

  await runTest("ChannelService supports OpenClaw media push through the bridge", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const pushReply = await channels.pushWeChatMessage({
        senderId: "wx-user-6",
        senderName: "Frank",
        text: "",
        mediaUrl: "https://example.com/demo.png",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "[media] https://example.com/demo.png");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        to: "wx-user-6",
        text: "",
        mediaUrl: "https://example.com/demo.png",
        accountId: "wx_real_1",
      });
    });
  });

  await runTest("ChannelService supports OpenClaw session-key push through the bridge", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const pushReply = await channels.pushWeChatMessage({
        sessionKey: "agent:main:thread:wx-user-6",
        text: "OpenClaw session send",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "OpenClaw session send");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        sessionKey: "agent:main:thread:wx-user-6",
        text: "OpenClaw session send",
        via: "session",
      });
    });
  });

  await runTest("ChannelService uses cached OpenClaw sender session context for sender-based push", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.start();
      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const pushReply = await channels.pushWeChatMessage({
        senderId: "wx-session-user",
        text: "OpenClaw sender-context send",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "OpenClaw sender-context send");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        sessionKey: "agent:main:thread:wx-user-6",
        text: "OpenClaw sender-context send",
        via: "session",
      });

      await channels.close();
    });
  });

  await runTest("ChannelService preserves explicit overrides over cached OpenClaw sender session context", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.start();
      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const pushReply = await channels.pushWeChatMessage({
        senderId: "wx-session-user",
        text: "OpenClaw explicit sender override",
        accountId: "wx_override_77",
        threadId: "thread-override-77",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "OpenClaw explicit sender override");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        to: "wx-session-user",
        text: "OpenClaw explicit sender override",
        accountId: "wx_override_77",
        threadId: "thread-override-77",
      });

      await channels.close();
    });
  });

  await runTest("ChannelService falls back to the local OpenClaw session registry when session-send is unavailable", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const openClawBridge = new StubOpenClawBridge();
      openClawBridge.sendSessionMessage = undefined;
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge,
      });

      await channels.start();
      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin();

      const pushReply = await channels.pushWeChatMessage({
        sessionKey: "agent:main:thread:wx-user-6",
        text: "OpenClaw registry fallback",
      });

      assert.equal(pushReply.accepted, true);
      assert.equal(pushReply.reply, "OpenClaw registry fallback");
      assert.equal(openClawBridge.sent.length, 1);
      assert.deepEqual(openClawBridge.sent[0], {
        to: "wx-session-user",
        text: "OpenClaw registry fallback",
        accountId: "wx_real_1",
        threadId: "thread-session-1",
      });

      await channels.close();
    });
  });
}

await main();
