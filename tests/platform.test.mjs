import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-platform-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch(request) {
    return {
      taskId: "task-wechat-1",
      topic: request.topic,
      question: request.question,
      generatedAt: new Date().toISOString(),
      plan: {
        objective: request.question ?? request.topic,
        subquestions: ["What matters?"],
        searchQueries: [request.topic]
      },
      papers: [],
      chunks: [],
      summary: `Summary for ${request.topic}`,
      findings: ["Finding one", "Finding two"],
      gaps: [],
      nextActions: [],
      evidence: [],
      warnings: [],
      critique: {
        verdict: "weak",
        summary: "No evidence yet.",
        issues: [],
        recommendations: [],
        supportedEvidenceCount: 0,
        unsupportedEvidenceCount: 0,
        coveredFindingsCount: 0,
        citationDiversity: 0,
        citationCoverage: 0
      }
    };
  }
}

class StubChatService {
  async reply(input) {
    return `Chat reply: ${input.text}`;
  }
}

class StubNativeProvider {
  constructor() {
    this.connected = false;
    this.messages = [];
    this.started = 0;
    this.closed = 0;
  }

  async start() {
    this.started += 1;
  }

  async close() {
    this.closed += 1;
  }

  async getStatus() {
    return {
      providerMode: "native",
      configured: true,
      linked: this.connected,
      running: this.connected,
      connected: this.connected,
      pairingCode: this.connected ? undefined : "native-qr-payload",
      accountId: this.connected ? "wx_native_1" : undefined,
      accountName: this.connected ? "Native Operator" : undefined,
      updatedAt: new Date().toISOString(),
      notes: []
    };
  }

  async startLogin() {
    this.messages.push({ direction: "system", text: "native start" });
    return {
      message: "Native QR ready",
      pairingCode: "native-qr-payload",
      connected: false,
      providerMode: "native"
    };
  }

  async completeLogin() {
    this.connected = true;
    this.messages.push({ direction: "system", text: "native connected" });
    return {
      providerMode: "native",
      configured: true,
      linked: true,
      running: true,
      connected: true,
      accountId: "wx_native_1",
      accountName: "Native Operator",
      updatedAt: new Date().toISOString(),
      notes: []
    };
  }

  async logout() {
    this.connected = false;
    this.messages.push({ direction: "system", text: "native logout" });
    return {
      providerMode: "native",
      configured: false,
      linked: false,
      running: false,
      connected: false,
      updatedAt: new Date().toISOString(),
      notes: []
    };
  }

  async listMessages() {
    return this.messages.map((message, index) => ({
      id: `native-${index}`,
      direction: message.direction,
      text: message.text,
      createdAt: new Date().toISOString()
    }));
  }

  async receiveManualMessage(input) {
    this.messages.push({ direction: "inbound", text: input.text });
    const reply = input.text.includes("/memory") ? "Memory hits for \"native\":" : "Saved to today's memory file.";
    this.messages.push({ direction: "outbound", text: reply });
    return {
      accepted: true,
      reply
    };
  }
}

class StubOpenClawBridge {
  constructor() {
    this.connected = false;
    this.qrDataUrl = "data:image/png;base64,qr";
    this.started = 0;
    this.closed = 0;
  }

  async start() {
    this.started += 1;
  }

  async close() {
    this.closed += 1;
  }

  async getWeChatStatus() {
    return {
      providerMode: "openclaw",
      configured: true,
      linked: this.connected,
      running: true,
      connected: this.connected,
      qrDataUrl: this.connected ? undefined : this.qrDataUrl,
      accountId: this.connected ? "wx_real_1" : undefined,
      accountName: this.connected ? "Real Operator" : undefined,
      pluginInstalled: true,
      pluginVersion: "2.1.1",
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayReachable: true,
      updatedAt: new Date().toISOString(),
      notes: []
    };
  }

  async startLogin() {
    return {
      message: "QR ready",
      qrDataUrl: this.qrDataUrl,
      connected: false,
      providerMode: "openclaw"
    };
  }

  async waitLogin() {
    this.connected = true;
    return {
      message: "Connected via OpenClaw.",
      connected: true,
      providerMode: "openclaw"
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
      notes: []
    };
  }
}

class StubLifecycleNativeProvider {
  constructor(statusFactory) {
    this.statusFactory = statusFactory;
    this.started = 0;
    this.closed = 0;
  }

  async start() {
    this.started += 1;
  }

  async close() {
    this.closed += 1;
  }

  async getStatus() {
    return this.statusFactory(this);
  }

  async startLogin() {
    return {
      message: "QR ready",
      pairingCode: "native-qr-payload",
      connected: false,
      providerMode: "native"
    };
  }

  async completeLogin() {
    return this.getStatus();
  }

  async logout() {
    return this.getStatus();
  }

  async listMessages() {
    return [];
  }

  async receiveManualMessage() {
    return {
      accepted: true,
      reply: "ok"
    };
  }
}

async function main() {
  await runTest("MemoryService writes long-term and daily notes and returns searchable chunks", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "long-term",
        title: "User Preference",
        content: "The user prefers TypeScript for backend services.",
        source: "test"
      });
      await memory.remember({
        scope: "daily",
        title: "Session Note",
        content: "Discussed chunk-level evidence extraction and WeChat integration.",
        source: "test"
      });

      const status = await memory.getStatus();
      const files = await memory.listFiles();
      const results = await memory.search("TypeScript backend", 5);

      assert.equal(status.searchMode, "keyword");
      assert.equal(files.length >= 2, true);
      assert.equal(results.length >= 1, true);
      assert.equal(results[0].path, "MEMORY.md");
      assert.ok(results[0].snippet.includes("TypeScript"));
    });
  });

  await runTest("ChannelService handles mock pairing, remember, memory search, and research commands", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory);

      const loginStart = await channels.startWeChatLogin(false);
      assert.equal(loginStart.connected, false);
      assert.ok(loginStart.pairingCode);

      const loginStatus = await channels.completeWeChatLogin("Console Tester");
      assert.equal(loginStatus.connected, true);
      assert.equal(loginStatus.accountName, "Console Tester");

      const rememberReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-1",
        senderName: "Alice",
        text: "/remember Alice prefers structured evidence"
      });
      assert.equal(rememberReply.reply, "Saved to today's memory file.");

      const memoryReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-1",
        senderName: "Alice",
        text: "/memory structured evidence"
      });
      assert.ok(memoryReply.reply.includes("Memory hits"));

      const researchReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-1",
        senderName: "Alice",
        text: "/research agentic retrieval"
      });
      assert.equal(researchReply.researchTaskId, "task-wechat-1");
      assert.ok(researchReply.reply.includes("Research task created"));

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.length >= 6, true);
      assert.equal(messages.at(-1)?.direction, "outbound");
    });
  });

  await runTest("ChannelService routes plain text to chat while preserving slash commands", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        chatService: new StubChatService()
      });

      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin("Console Tester");

      const chatReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-chat-1",
        senderName: "Dana",
        text: "你好，帮我看看这个工作台能做什么"
      });
      assert.equal(chatReply.reply, "Chat reply: 你好，帮我看看这个工作台能做什么");

      const rememberReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-chat-1",
        senderName: "Dana",
        text: "/remember Dana wants both chat and control"
      });
      assert.equal(rememberReply.reply, "Saved to today's memory file.");

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.some((message) => message.text === "Chat reply: 你好，帮我看看这个工作台能做什么"), true);
      assert.equal(messages.at(-1)?.direction, "outbound");
    });
  });

  await runTest("ChannelService exposes agent role and skill commands", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory);

      await channels.startWeChatLogin(false);
      await channels.completeWeChatLogin("Console Tester");

      const currentRole = await channels.receiveWeChatMessage({
        senderId: "wx-user-role-1",
        senderName: "Eve",
        text: "/role"
      });
      assert.ok(currentRole.reply.includes("Current role:"));
      assert.ok(currentRole.reply.includes("operator"));

      const switchedRole = await channels.receiveWeChatMessage({
        senderId: "wx-user-role-1",
        senderName: "Eve",
        text: "/role researcher"
      });
      assert.ok(switchedRole.reply.includes("researcher"));

      const skillsReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-role-1",
        senderName: "Eve",
        text: "/skills"
      });
      assert.ok(skillsReply.reply.includes("Active skills:"));
      assert.ok(skillsReply.reply.includes("Research Ops"));
    });
  });

  await runTest("ChannelService can update agent skills directly", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory);

      const sessionBefore = await channels.getAgentSession("wx-user-role-2");
      assert.equal(sessionBefore.skillIds.includes("research-ops"), true);

      const sessionAfter = await channels.setAgentSkills("wx-user-role-2", [
        "workspace-control",
        "memory-ops"
      ]);
      assert.deepEqual(sessionAfter.skillIds, ["workspace-control", "memory-ops"]);
    });
  });

  await runTest("ChannelService keeps local UI chat available even when native transport is offline", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: new StubNativeProvider(),
        chatService: new StubChatService()
      });

      const status = await channels.getStatusSnapshot();
      assert.equal(status.channels.wechat.connected, false);

      const chatReply = await channels.receiveUiChatMessage({
        senderId: "ui-wechat-user",
        senderName: "Console User",
        text: "你好，测试一下本地聊天"
      });
      assert.equal(chatReply.reply, "Chat reply: 你好，测试一下本地聊天");

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.length, 2);
      assert.equal(messages[0]?.direction, "inbound");
      assert.equal(messages[1]?.direction, "outbound");
      assert.equal(messages[1]?.text, "Chat reply: 你好，测试一下本地聊天");
    });
  });

  await runTest("ChannelService exposes lifecycle hooks for always-on providers", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const nativeProvider = new StubNativeProvider();
      const nativeChannels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider
      });

      await nativeChannels.start();
      await nativeChannels.close();

      assert.equal(nativeProvider.started, 1);
      assert.equal(nativeProvider.closed, 1);

      const openClawBridge = new StubOpenClawBridge();
      const openClawChannels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge
      });

      await openClawChannels.start();
      await openClawChannels.close();

      assert.equal(openClawBridge.started, 1);
      assert.equal(openClawBridge.closed, 1);
    });
  });

  await runTest("ChannelService can switch to native mode and delegate message flow", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: new StubNativeProvider()
      });

      const initial = await channels.getStatusSnapshot();
      assert.equal(initial.channels.wechat.providerMode, "native");
      assert.equal(initial.channels.wechat.connected, false);

      const loginStart = await channels.startWeChatLogin(false);
      assert.equal(loginStart.providerMode, "native");
      assert.equal(loginStart.pairingCode, "native-qr-payload");

      const loginStatus = await channels.completeWeChatLogin();
      assert.equal(loginStatus.connected, true);
      assert.equal(loginStatus.providerMode, "native");

      const rememberReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-3",
        senderName: "Carol",
        text: "/remember native provider"
      });
      assert.equal(rememberReply.reply, "Saved to today's memory file.");

      const memoryReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-3",
        senderName: "Carol",
        text: "/memory native"
      });
      assert.ok(memoryReply.reply.includes("Memory hits"));

      const messages = await channels.listWeChatMessages();
      assert.equal(messages.some((message) => message.direction === "inbound"), true);
      assert.equal(messages.at(-1)?.direction, "outbound");
    });
  });

  await runTest("ChannelService can switch to openclaw mode and preserve transcript flow", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "openclaw",
        openClawBridge: new StubOpenClawBridge()
      });

      const initial = await channels.getStatusSnapshot();
      assert.equal(initial.channels.wechat.providerMode, "openclaw");
      assert.equal(initial.channels.wechat.connected, false);

      const loginStart = await channels.startWeChatLogin(false);
      assert.equal(loginStart.providerMode, "openclaw");
      assert.ok(loginStart.qrDataUrl);

      let messages = await channels.listWeChatMessages();
      assert.equal(messages.length, 1);
      assert.equal(messages[0].direction, "system");

      const loginStatus = await channels.completeWeChatLogin();
      assert.equal(loginStatus.connected, true);
      assert.equal(loginStatus.providerMode, "openclaw");

      const rememberReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-2",
        senderName: "Bob",
        text: "/remember Bob wants QR login"
      });
      assert.equal(rememberReply.reply, "Saved to today's memory file.");

      const memoryReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-2",
        senderName: "Bob",
        text: "/memory QR login"
      });
      assert.ok(memoryReply.reply.includes("Memory hits"));

      messages = await channels.listWeChatMessages();
      assert.equal(messages.some((message) => message.direction === "inbound"), true);
      assert.equal(messages.at(-1)?.direction, "outbound");

      const logoutStatus = await channels.logoutWeChat();
      assert.equal(logoutStatus.connected, false);
    });
  });

  await runTest("ChannelService classifies QR-required providers as waiting-human-action", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const provider = new StubLifecycleNativeProvider(() => ({
        providerMode: "native",
        configured: true,
        linked: false,
        running: true,
        connected: false,
        qrDataUrl: "data:image/png;base64,qr",
        updatedAt: new Date().toISOString(),
        notes: ["Scan the QR code."]
      }));

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: provider,
        healthMonitor: {
          intervalMs: 50,
          unhealthyThreshold: 1,
          restartCooldownMs: 100
        }
      });

      await channels.start();
      const status = await channels.getStatusSnapshot();

      assert.equal(status.channels.wechat.lifecycleState, "waiting-human-action");
      assert.equal(status.channels.wechat.requiresHumanAction, true);
      assert.equal(provider.started, 1);

      await channels.close();
    });
  });

  await runTest("ChannelService auto restarts unhealthy native providers and records lifecycle metadata", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const provider = new StubLifecycleNativeProvider((instance) => {
        if (instance.started >= 2) {
          return {
            providerMode: "native",
            configured: true,
            linked: true,
            running: true,
            connected: true,
            updatedAt: new Date().toISOString(),
            notes: []
          };
        }

        return {
          providerMode: "native",
          configured: true,
          linked: true,
          running: false,
          connected: false,
          lastError: "transport stopped unexpectedly",
          updatedAt: new Date().toISOString(),
          notes: []
        };
      });

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: provider,
        healthMonitor: {
          intervalMs: 50,
          unhealthyThreshold: 1,
          restartCooldownMs: 10_000,
          maxRestartsPerHour: 2
        }
      });

      await channels.start();
      await new Promise((resolve) => setTimeout(resolve, 260));
      const status = await channels.getStatusSnapshot();

      assert.equal(provider.started >= 2, true);
      assert.equal(status.channels.wechat.lifecycleState, "running");
      assert.equal((status.channels.wechat.restartCount ?? 0) >= 1, true);
      assert.equal(Boolean(status.channels.wechat.lastRestartAt), true);

      await channels.close();
    });
  });

  await runTest("ChannelService does not auto restart when auth requires manual pairing", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const provider = new StubLifecycleNativeProvider(() => ({
        providerMode: "native",
        configured: true,
        linked: true,
        running: false,
        connected: false,
        lastError: "pairing required",
        updatedAt: new Date().toISOString(),
        notes: ["pairing required"]
      }));

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: provider,
        healthMonitor: {
          intervalMs: 50,
          unhealthyThreshold: 1,
          restartCooldownMs: 100
        }
      });

      await channels.start();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const status = await channels.getStatusSnapshot();

      assert.equal(provider.started, 1);
      assert.equal(status.channels.wechat.lifecycleState, "waiting-human-action");
      assert.equal(status.channels.wechat.requiresHumanAction, true);

      await channels.close();
    });
  });

  await runTest("ChannelService treats expired native sessions that require QR login as waiting-human-action", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const provider = new StubLifecycleNativeProvider(() => ({
        providerMode: "native",
        configured: true,
        linked: false,
        running: false,
        connected: false,
        lastError: "WeChat session expired. Start QR login again.",
        updatedAt: new Date().toISOString(),
        notes: []
      }));

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: provider,
        healthMonitor: {
          intervalMs: 50,
          unhealthyThreshold: 1,
          restartCooldownMs: 100
        }
      });

      await channels.start();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const status = await channels.getStatusSnapshot();

      assert.equal(provider.started, 1);
      assert.equal(status.channels.wechat.lifecycleState, "waiting-human-action");
      assert.equal(status.channels.wechat.lifecycleReason, "manual-auth-required");
      assert.equal(status.channels.wechat.requiresHumanAction, true);

      await channels.close();
    });
  });

  await runTest("ChannelService marks persistently unhealthy running providers as stuck without restart permission", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const provider = new StubLifecycleNativeProvider(() => ({
        providerMode: "native",
        configured: true,
        linked: true,
        running: true,
        connected: false,
        lastError: "upstream polling hung",
        updatedAt: new Date().toISOString(),
        notes: []
      }));

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: provider,
        healthMonitor: {
          unhealthyThreshold: 1
        }
      });

      const first = await channels.getStatusSnapshot();
      const second = await channels.getStatusSnapshot();

      assert.equal(first.channels.wechat.lifecycleState, "reconnecting");
      assert.equal(second.channels.wechat.lifecycleState, "stuck");
      assert.equal(second.channels.wechat.lifecycleReason, "stuck");
    });
  });

  await runTest("ChannelService writes lifecycle audit logs for transitions and automatic restarts", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const provider = new StubLifecycleNativeProvider((instance) => {
        if (instance.started >= 2) {
          return {
            providerMode: "native",
            configured: true,
            linked: true,
            running: true,
            connected: true,
            updatedAt: new Date().toISOString(),
            notes: []
          };
        }
        return {
          providerMode: "native",
          configured: true,
          linked: true,
          running: false,
          connected: false,
          lastError: "transport stopped unexpectedly",
          updatedAt: new Date().toISOString(),
          notes: []
        };
      });

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        wechatProvider: "native",
        nativeProvider: provider,
        healthMonitor: {
          intervalMs: 50,
          unhealthyThreshold: 1,
          restartCooldownMs: 10_000,
          maxRestartsPerHour: 2
        }
      });

      await channels.start();
      await new Promise((resolve) => setTimeout(resolve, 260));
      await channels.close();

      const rawAudit = await readFile(path.join(dir, "channels", "wechat-lifecycle-audit.jsonl"), "utf8");
      assert.equal(rawAudit.includes("\"event\":\"service-started\""), true);
      assert.equal(rawAudit.includes("\"event\":\"lifecycle-transition\""), true);
      assert.equal(rawAudit.includes("\"event\":\"auto-restart-scheduled\""), true);
      assert.equal(rawAudit.includes("\"event\":\"auto-restart-completed\""), true);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

