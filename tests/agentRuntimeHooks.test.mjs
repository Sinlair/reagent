import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ChatService } from "../dist/services/chatService.js";
import { MemoryService } from "../dist/services/memoryService.js";
import { ResearchDirectionService } from "../dist/services/researchDirectionService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-runtime-hooks-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ChatService runtime emits llm, tool, and reply hooks for tool turns", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const events = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              if ("previous_response_id" in params) {
                return {
                  id: "resp-hook-2",
                  output_text: "Session details captured.",
                  output: []
                };
              }

              return {
                id: "resp-hook-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "agent_describe",
                    arguments: "{}",
                    call_id: "call-hook-1"
                  }
                ]
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses",
        hooks: [
          {
            preLlmCall({ call }) {
              events.push({ type: "pre-llm", stage: call.stage });
            },
            postLlmCall({ call, result }) {
              events.push({
                type: "post-llm",
                stage: call.stage,
                success: result.success,
                functionCallNames: result.functionCallNames
              });
            },
            preToolCall({ tool }) {
              events.push({ type: "pre-tool", name: tool.toolName });
            },
            postToolCall({ tool, output }) {
              events.push({
                type: "post-tool",
                name: tool.toolName,
                roleId: output.roleId
              });
            },
            preReplyEmit({ reply }) {
              events.push({ type: "reply", usedTools: reply.usedTools });
            }
          }
        ]
      });

      const reply = await chat.reply({
        senderId: "hook-user-1",
        text: "Tell me how you are configured."
      });

      assert.ok(reply.includes("Session details captured."));
      assert.equal(events.length, 7);
      assert.deepEqual(events[0], { type: "pre-llm", stage: "tool-start" });
      assert.deepEqual(events[1], {
        type: "post-llm",
        stage: "tool-start",
        success: true,
        functionCallNames: ["agent_describe"]
      });
      assert.deepEqual(events[2], { type: "pre-tool", name: "agent_describe" });
      assert.deepEqual(events[3], { type: "post-tool", name: "agent_describe", roleId: "operator" });
      assert.deepEqual(events[4], { type: "pre-llm", stage: "tool-continue" });
      assert.deepEqual(events[5], {
        type: "post-llm",
        stage: "tool-continue",
        success: true,
        functionCallNames: []
      });
      assert.deepEqual(events[6], { type: "reply", usedTools: ["agent_describe"] });
    });
  });

  await runTest("ChatService runtime emits toolError hooks for unknown tools", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const errors = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              if ("previous_response_id" in params) {
                return {
                  id: "resp-hook-error-2",
                  output_text: "I could not run that tool, but I handled the failure.",
                  output: []
                };
              }

              return {
                id: "resp-hook-error-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "missing_tool",
                    arguments: "{}",
                    call_id: "call-hook-error-1"
                  }
                ]
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses",
        hooks: [
          {
            toolError({ tool, error }) {
              errors.push({ name: tool.toolName, error });
            }
          }
        ]
      });

      const reply = await chat.reply({
        senderId: "hook-user-2",
        text: "Run the missing tool."
      });

      assert.ok(reply.includes("I could not run that tool, but I handled the failure."));
      assert.deepEqual(errors, [
        {
          name: "missing_tool",
          error: "Unknown tool: missing_tool"
        }
      ]);
    });
  });

  await runTest("ChatService runtime can deny a tool call before execution through policy hooks", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const events = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              if ("previous_response_id" in params) {
                return {
                  id: "resp-block-2",
                  output_text: "That tool was blocked by policy.",
                  output: []
                };
              }

              return {
                id: "resp-block-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "agent_describe",
                    arguments: "{}",
                    call_id: "call-block-1"
                  }
                ]
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses",
        hooks: [
          {
            checkToolCall({ tool }) {
              events.push({ type: "check", name: tool.toolName });
              return {
                allow: false,
                reason: "Policy denied agent_describe for this sender."
              };
            },
            preToolCall({ tool }) {
              events.push({ type: "pre-tool", name: tool.toolName });
            },
            toolBlocked({ tool, reason }) {
              events.push({ type: "blocked", name: tool.toolName, reason });
            }
          }
        ]
      });

      const reply = await chat.reply({
        senderId: "hook-user-3",
        text: "Describe yourself."
      });

      assert.ok(reply.includes("That tool was blocked by policy."));
      assert.deepEqual(events, [
        { type: "check", name: "agent_describe" },
        {
          type: "blocked",
          name: "agent_describe",
          reason: "Policy denied agent_describe for this sender."
        }
      ]);
    });
  });

  await runTest("ChatService runtime blocks premature delivery tools when cognition still prefers evidence-gathering", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Delivery posture anchor",
        content: "Workspace memory keeps the current delivery posture unresolved.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });
      await directions.upsertProfile({
        id: "delivery-posture-brief",
        label: "Delivery Posture Brief",
        summary: "Artifact evidence keeps the current delivery posture conflicted.",
        knownBaselines: ["delivery posture"],
        evaluationPriorities: ["uncertainty reduction"],
      });

      const events = [];
      let callCount = 0;
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              callCount += 1;
              if ("previous_response_id" in params) {
                return {
                  id: `resp-cognition-block-${callCount}`,
                  output_text: "Blocked by cognition policy.",
                  output: []
                };
              }

              if (callCount === 1) {
                return {
                  id: "resp-cognition-seed",
                  output_text: "Seeded uncertainty.",
                  output: []
                };
              }

              return {
                id: "resp-cognition-block",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "presentation_generate",
                    arguments: "{}",
                    call_id: "call-cognition-block-1"
                  }
                ]
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses",
        hooks: [
          {
            toolBlocked({ tool, reason }) {
              events.push({ name: tool.toolName, reason });
            }
          }
        ]
      });

      await chat.reply({
        senderId: "hook-user-4",
        text: "Compare the delivery posture anchor against the brief."
      });

      const reply = await chat.reply({
        senderId: "hook-user-4",
        text: "Keep going from the same context."
      });

      assert.ok(reply.includes("Blocked by cognition policy."));
      assert.equal(events.length, 1);
      assert.equal(events[0].name, "presentation_generate");
      assert.ok(events[0].reason.startsWith("Cognition policy prefers evidence-gathering before presentation_generate because "));
    });
  });

  await runTest("ChatService runtime writes built-in audit trail entries for tool turns", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              if ("previous_response_id" in params) {
                return {
                  id: "resp-audit-2",
                  output_text: "Audit trail reply.",
                  output: []
                };
              }

              return {
                id: "resp-audit-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "agent_describe",
                    arguments: "{}",
                    call_id: "call-audit-1"
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
        senderId: "audit-user-1",
        text: "Describe the current session."
      });

      const raw = await readFile(path.join(dir, "channels", "agent-runtime-audit.jsonl"), "utf8");
      const entries = raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));

      assert.equal(entries.some((entry) => entry.event === "llm_call" && entry.stage === "tool-start"), true);
      assert.equal(entries.some((entry) => entry.event === "llm_call" && entry.stage === "tool-continue"), true);
      assert.equal(entries.some((entry) => entry.event === "tool_call" && entry.toolName === "agent_describe"), true);
      assert.equal(entries.some((entry) => entry.event === "reply_emit" && entry.senderId === "audit-user-1"), true);
    });
  });

  await runTest("ChatService runtime audits blocked tool calls separately", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              if ("previous_response_id" in params) {
                return {
                  id: "resp-audit-block-2",
                  output_text: "Blocked by policy.",
                  output: []
                };
              }

              return {
                id: "resp-audit-block-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "agent_describe",
                    arguments: "{}",
                    call_id: "call-audit-block-1"
                  }
                ]
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses",
        hooks: [
          {
            checkToolCall() {
              return {
                allow: false,
                reason: "Blocked in audit test."
              };
            }
          }
        ]
      });

      await chat.reply({
        senderId: "audit-user-2",
        text: "Describe the current session."
      });

      const raw = await readFile(path.join(dir, "channels", "agent-runtime-audit.jsonl"), "utf8");
      const entries = raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));

      assert.equal(
        entries.some(
          (entry) =>
            entry.event === "tool_blocked" &&
            entry.toolName === "agent_describe" &&
            entry.error === "Blocked in audit test."
        ),
        true
      );
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
