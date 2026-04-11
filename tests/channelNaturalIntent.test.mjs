import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ChannelService } from "../dist/services/channelService.js";
import { ChatService } from "../dist/services/chatService.js";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-natural-intent-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

class StubResearchService {
  async runResearch() {
    throw new Error("runResearch should not be called in these tests.");
  }
}

class StubChatService {
  constructor() {
    this.inputs = [];
    this.plainInputs = [];
  }

  async reply(input) {
    this.inputs.push(input);
    return `Agent reply: ${input.text}`;
  }

  async plainReply(input) {
    this.plainInputs.push(input);
    return `Chat reply: ${input.text}`;
  }
}

class StubDirectionService {
  constructor(initialProfiles = []) {
    this.profiles = [...initialProfiles];
    this.upserts = [];
  }

  async listProfiles() {
    return [...this.profiles];
  }

  async upsertProfile(input) {
    const profile = {
      id: input.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "direction-1",
      label: input.label,
      enabled: input.enabled ?? true,
      priority: input.priority ?? "primary",
    };
    this.upserts.push(input);
    const existingIndex = this.profiles.findIndex((item) => item.label === profile.label);
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = { ...this.profiles[existingIndex], ...profile };
    } else {
      this.profiles.push(profile);
    }
    return profile;
  }
}

class StubDiscoveryService {
  constructor(result) {
    this.result = result;
    this.calls = [];
  }

  async runDiscovery(input) {
    this.calls.push(input);
    return this.result;
  }
}

async function connectMockWechat(channels) {
  await channels.startWeChatLogin(false);
  await channels.completeWeChatLogin("Console Tester");
}

async function main() {
  await runTest("ChannelService saves research directions directly from natural language", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chatService = new StubChatService();
      const directionService = new StubDirectionService();
      const discoveryService = new StubDiscoveryService({
        runId: "run-unused",
        generatedAt: new Date().toISOString(),
        directionIds: [],
        directionLabels: [],
        request: {
          maxPapersPerQuery: 4,
          topK: 5,
          pushToWechat: false,
        },
        items: [],
        digest: "",
        pushed: false,
        warnings: [],
      });

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        chatService,
        directionService,
        discoveryService,
      });

      await connectMockWechat(channels);

      const result = await channels.receiveWeChatMessage({
        senderId: "wx-user-direction-1",
        senderName: "Alice",
        text: "把半监督图像学习设为研究方向",
      });

      assert.ok(result.reply.includes("半监督图像学习"));
      assert.equal(directionService.upserts.length, 1);
      assert.equal(directionService.upserts[0].label, "半监督图像学习");
      assert.equal(chatService.inputs.length, 0);
      assert.equal(chatService.plainInputs.length, 0);
    });
  });

  await runTest("ChannelService handles today's papers requests without agent-runtime filler", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chatService = new StubChatService();
      const directionService = new StubDirectionService([
        {
          id: "ssl-vision",
          label: "半监督图像学习",
          enabled: true,
          priority: "primary",
        },
      ]);
      const discoveryService = new StubDiscoveryService({
        runId: "run-1",
        generatedAt: new Date().toISOString(),
        directionIds: ["ssl-vision"],
        directionLabels: ["半监督图像学习"],
        request: {
          directionId: "ssl-vision",
          maxPapersPerQuery: 4,
          topK: 5,
          pushToWechat: false,
          senderId: "wx-user-papers-1",
        },
        items: [
          {
            rank: 1,
            title: "FixMatch Revisited",
            year: 2024,
            venue: "NeurIPS",
            directionId: "ssl-vision",
            directionLabel: "半监督图像学习",
            url: "https://example.com/fixmatch",
            relevanceReason: "Strong benchmark fit.",
            rankingReasons: ["Baseline / evaluation priority match."],
          },
          {
            rank: 2,
            title: "Semi-Supervised Vision at Scale",
            year: 2025,
            venue: "ICLR",
            directionId: "ssl-vision",
            directionLabel: "半监督图像学习",
            url: "https://example.com/ssl-scale",
            relevanceReason: "Recent strong candidate.",
            rankingReasons: ["Target problem / validation match."],
          },
        ],
        digest: "unused",
        pushed: false,
        warnings: [],
      });

      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        chatService,
        directionService,
        discoveryService,
      });

      await connectMockWechat(channels);

      const result = await channels.receiveWeChatMessage({
        senderId: "wx-user-papers-1",
        senderName: "Alice",
        text: "推送今天的论文",
      });

      assert.ok(result.reply.includes("今天先给你筛了"));
      assert.ok(result.reply.includes("FixMatch Revisited"));
      assert.equal(discoveryService.calls.length, 1);
      assert.equal(discoveryService.calls[0].directionId, "ssl-vision");
      assert.equal(chatService.inputs.length, 0);
      assert.equal(chatService.plainInputs.length, 0);
      assert.equal(result.reply.includes("Received. I will handle this in the agent runtime."), false);
    });
  });

  await runTest("ChatService plain fallback keeps Chinese greetings natural", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chat = new ChatService(dir, memory, {
        client: {},
      });

      const reply = await chat.plainReply({
        senderId: "plain-fallback-user",
        text: "你好",
        source: "wechat",
      });

      assert.ok(reply.includes("你好"));
      assert.equal(reply.includes("agent runtime"), false);
      assert.equal(reply.includes("/role"), false);
    });
  });

  await runTest("ChannelService exposes explicit help, status, and unknown-command replies", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chatService = new StubChatService();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        chatService,
      });

      await connectMockWechat(channels);

      const helpReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-help-1",
        senderName: "Helper",
        text: "/help",
      });
      assert.ok(helpReply.reply.includes("Supported commands:"));
      assert.ok(helpReply.reply.includes("/status"));
      assert.ok(helpReply.reply.includes("/research <topic> [workspace-mutation]"));
      assert.ok(helpReply.reply.includes("/role <assistant|operator|researcher> [session-control]"));
      assert.ok(helpReply.reply.includes("/memory-compact [days] [maintenance/ui]"));

      const commandsReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-help-1",
        senderName: "Helper",
        text: "/commands",
      });
      assert.ok(commandsReply.reply.includes("Supported commands:"));

      const aliasReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-help-1",
        senderName: "Helper",
        text: "/?",
      });
      assert.ok(aliasReply.reply.includes("Supported commands:"));

      const statusReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-help-1",
        senderName: "Helper",
        text: "/status",
      });
      assert.ok(statusReply.reply.includes("Provider mode:"));
      assert.ok(statusReply.reply.includes("Connected:"));
      assert.ok(statusReply.reply.includes("Agent session controls: unavailable"));

      const unknownReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-help-1",
        senderName: "Helper",
        text: "/does-not-exist",
      });
      assert.ok(unknownReply.reply.includes("Unknown command: /does-not-exist"));
      assert.ok(unknownReply.reply.includes("Supported commands:"));

      assert.equal(chatService.inputs.length, 0);
      assert.equal(chatService.plainInputs.length, 0);
    });
  });

  await runTest("ChannelService enforces source-aware policy for local-only maintenance commands", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chatService = new StubChatService();
      const channels = new ChannelService(dir, new StubResearchService(), memory, {
        chatService,
      });

      await connectMockWechat(channels);

      const remoteReply = await channels.receiveWeChatMessage({
        senderId: "wx-user-maint-1",
        senderName: "Maintainer",
        text: "/memory-compact",
      });
      assert.ok(remoteReply.reply.includes("only available from the local UI/runtime control surface"));

      const uiReply = await channels.receiveUiChatMessage({
        senderId: "ui-user-maint-1",
        senderName: "Maintainer",
        text: "/memory-compact",
      });
      assert.equal(uiReply.accepted, true);
      assert.equal(uiReply.reply.includes("only available from the local UI/runtime control surface"), false);
      assert.equal(
        uiReply.reply.includes("No eligible workspace memory entries were old enough to compact.") ||
          uiReply.reply.includes("Compacted "),
        true,
      );

      assert.equal(chatService.inputs.length, 0);
      assert.equal(chatService.plainInputs.length, 0);
    });
  });

  await runTest("ChannelService enforces remote allowlist policy for workspace-mutation commands", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      await mkdir(path.join(dir, "channels"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "inbound-command-policy.json"),
        `${JSON.stringify({
          remote: {
            "workspace-mutation": {
              mode: "allowlist",
              senderIds: ["wx-allowed-1"],
            },
            "session-control": {
              mode: "allow",
              senderIds: [],
            },
          },
        }, null, 2)}\n`,
        "utf8",
      );

      const channels = new ChannelService(dir, new StubResearchService(), memory);
      await connectMockWechat(channels);

      const blockedReply = await channels.receiveWeChatMessage({
        senderId: "wx-blocked-1",
        senderName: "Blocked",
        text: "/remember blocked sender",
      });
      assert.ok(blockedReply.reply.includes("not authorized"));
      assert.ok(blockedReply.reply.includes("wx-blocked-1"));
      assert.ok(blockedReply.reply.includes("wx-allowed-1"));

      const allowedReply = await channels.receiveWeChatMessage({
        senderId: "wx-allowed-1",
        senderName: "Allowed",
        text: "/remember allowed sender",
      });
      assert.equal(allowedReply.reply, "Saved to today's memory file.");
    });
  });

  await runTest("ChannelService enforces remote allowlist policy for session-control commands", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      await mkdir(path.join(dir, "channels"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "inbound-command-policy.json"),
        `${JSON.stringify({
          remote: {
            "workspace-mutation": {
              mode: "allow",
              senderIds: [],
            },
            "session-control": {
              mode: "allowlist",
              senderIds: ["wx-operator-1"],
            },
          },
        }, null, 2)}\n`,
        "utf8",
      );

      const channels = new ChannelService(dir, new StubResearchService(), memory);
      await connectMockWechat(channels);

      const blockedReply = await channels.receiveWeChatMessage({
        senderId: "wx-blocked-2",
        senderName: "Blocked",
        text: "/role researcher",
      });
      assert.ok(blockedReply.reply.includes("not authorized"));
      assert.ok(blockedReply.reply.includes("/role"));

      const allowedReply = await channels.receiveWeChatMessage({
        senderId: "wx-operator-1",
        senderName: "Operator",
        text: "/role researcher",
      });
      assert.ok(allowedReply.reply.includes("researcher"));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
