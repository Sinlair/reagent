import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-runtime-digest-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ChatService runtime injects structured session digest into later prompts", async () => {
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
                id: `resp-digest-${requests.length}`,
                output_text: `Digest reply ${requests.length}`,
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      const prompts = [
        "Remember alpha context for this workspace.",
        "Now compare beta against gamma.",
        "Track delta as another angle.",
        "Summarize epsilon for me.",
        "Keep zeta in view too.",
        "What context are you carrying forward now?"
      ];

      for (const prompt of prompts) {
        await chat.plainReply({
          senderId: "digest-user-1",
          text: prompt
        });
      }

      assert.equal(requests.length, 6);
      const finalInput = String(requests[5].input);
      assert.ok(finalInput.includes("Structured session digest:"));
      assert.ok(finalInput.includes("Neuron state / perception:"));
      assert.ok(finalInput.includes("Neuron state / reasoning:"));
      assert.ok(finalInput.includes("User asked: Remember alpha context for this workspace."));
      assert.equal(finalInput.includes("User: Remember alpha context for this workspace."), false);
    });
  });

  await runTest("ChatService runtime persists tool and pending-action digest state", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              if ("previous_response_id" in params) {
                return {
                  id: "resp-digest-tool-2",
                  output_text: "Session details captured.",
                  output: []
                };
              }

              return {
                id: "resp-digest-tool-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "agent_describe",
                    arguments: "{}",
                    call_id: "call-digest-tool-1"
                  }
                ]
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.reply({
        senderId: "digest-user-2",
        text: "Describe the current session and keep context."
      });

      const raw = await readFile(path.join(dir, "channels", "agent-runtime.json"), "utf8");
      const parsed = JSON.parse(raw);
      const session = parsed.sessions["wechat:digest-user-2"];

      assert.ok(Array.isArray(session.digest.recentUserIntents));
      assert.ok(session.digest.recentUserIntents.some((item) => item.includes("Describe the current session")));
      assert.ok(Array.isArray(session.digest.recentToolOutcomes));
      assert.ok(session.digest.recentToolOutcomes.some((item) => item.includes("agent_describe")));
      assert.ok(Array.isArray(session.digest.pendingActions));
      assert.equal(session.digest.pendingActions.length > 0, true);
      assert.ok(Array.isArray(session.digest.neurons.perception));
      assert.ok(Array.isArray(session.digest.neurons.memory));
      assert.ok(Array.isArray(session.digest.neurons.reasoning));
      assert.ok(Array.isArray(session.digest.neurons.action));
      assert.equal(session.digest.neurons.reasoning.length > 0, true);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
