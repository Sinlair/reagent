import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-runtime-session-identity-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ChatService stores explicit entry sources as separate canonical sessions", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      let requestCount = 0;
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create() {
              requestCount += 1;
              return {
                id: `resp-session-${requestCount}`,
                output_text: "Acknowledged.",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.reply({
        senderId: "multi-source-user",
        text: "hello from wechat",
        source: "wechat"
      });
      await chat.reply({
        senderId: "multi-source-user",
        text: "hello from ui",
        source: "ui"
      });

      const sessions = (await chat.listSessions())
        .filter((session) => session.senderId === "multi-source-user")
        .map((session) => session.sessionId)
        .sort();

      assert.deepEqual(sessions, ["ui:multi-source-user", "wechat:multi-source-user"]);

      const latest = await chat.describeSession("multi-source-user");
      assert.equal(latest.sessionId, "ui:multi-source-user");
      assert.equal(latest.senderId, "multi-source-user");
      assert.equal(latest.entrySource, "ui");
      assert.equal(latest.activeEntrySource, "ui");

      const explicitWechat = await chat.describeSession("wechat:multi-source-user");
      assert.equal(explicitWechat.sessionId, "wechat:multi-source-user");
      assert.equal(explicitWechat.senderId, "multi-source-user");
      assert.equal(explicitWechat.entrySource, "wechat");
      assert.equal(explicitWechat.activeEntrySource, "wechat");
    });
  });

  await runTest("ChatService seeds a new source session from the latest sender cognition and config", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const requests = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              requests.push(params);
              return {
                id: `resp-seed-${requests.length}`,
                output_text: `seed reply ${requests.length}`,
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.reply({
        senderId: "carryover-user",
        text: "first turn from wechat",
        source: "wechat"
      });
      await chat.setRole("wechat:carryover-user", "researcher");
      await chat.setSkills("wechat:carryover-user", ["workspace-control", "research-ops"]);

      await chat.reply({
        senderId: "carryover-user",
        text: "second turn from ui",
        source: "ui"
      });

      assert.equal(requests.length, 2);
      assert.ok(String(requests[1].input).includes("User asked: first turn from wechat"));

      const uiSession = await chat.describeSession("ui:carryover-user");
      assert.equal(uiSession.entrySource, "ui");
      assert.equal(uiSession.activeEntrySource, "ui");
      assert.equal(uiSession.roleId, "researcher");
      assert.deepEqual(uiSession.skillIds, ["workspace-control", "research-ops"]);
      assert.equal(uiSession.seededFromSessionId, "wechat:carryover-user");
      assert.equal(typeof uiSession.seededAt, "string");

      const uiCognition = await chat.findSessionCognition("ui:carryover-user");
      assert.ok(uiCognition);
      assert.equal(uiCognition.seededFromSessionId, "wechat:carryover-user");
      assert.equal(typeof uiCognition.seededAt, "string");
      assert.equal(
        uiCognition.recentUserIntents.some((item) => item.includes("first turn from wechat")),
        true,
      );
      assert.equal(uiCognition.neurons.memory.length > 0, true);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
