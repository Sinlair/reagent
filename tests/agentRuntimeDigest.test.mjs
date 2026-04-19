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
      await memory.remember({
        scope: "daily",
        title: "Session detail note",
        content: "Describe the current session and keep context with a saved workspace note.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });

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
      assert.ok(finalInput.includes("Neuron state / hypothesis:"));
      assert.ok(finalInput.includes("Neuron state / reasoning:"));
      assert.ok(finalInput.includes("source="));
      assert.ok(finalInput.includes("status="));
      assert.ok(finalInput.includes("support="));
      assert.ok(finalInput.includes("User asked: Remember alpha context for this workspace."));
      assert.equal(finalInput.includes("User: Remember alpha context for this workspace."), false);
    });
  });

  await runTest("ChatService runtime persists tool and pending-action digest state", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Session context baseline",
        content: "Keep the current session context baseline anchored in workspace memory.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });
      await directions.upsertProfile({
        id: "session-context-brief",
        label: "Session Context Brief",
        summary: "A research brief about preserving the current session context baseline.",
        knownBaselines: ["session context baseline"],
        evaluationPriorities: ["context retention"],
      });

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
        text: "Compare the current session context baseline against the research brief and keep it provisional."
      });

      const raw = await readFile(path.join(dir, "channels", "agent-runtime.json"), "utf8");
      const parsed = JSON.parse(raw);
      const session = parsed.sessions["wechat:digest-user-2"];

      assert.ok(Array.isArray(session.digest.recentUserIntents));
      assert.ok(
        session.digest.recentUserIntents.some((item) =>
          item.includes("Compare the current session context baseline against the research brief"),
        ),
      );
      assert.ok(Array.isArray(session.digest.recentToolOutcomes));
      assert.ok(session.digest.recentToolOutcomes.some((item) => item.includes("agent_describe")));
      assert.ok(Array.isArray(session.digest.pendingActions));
      assert.equal(session.digest.pendingActions.length > 0, true);
      assert.ok(Array.isArray(session.digest.neurons.perception));
      assert.ok(Array.isArray(session.digest.neurons.memory));
      assert.ok(Array.isArray(session.digest.neurons.hypothesis));
      assert.ok(Array.isArray(session.digest.neurons.reasoning));
      assert.ok(Array.isArray(session.digest.neurons.action));
      assert.ok(Array.isArray(session.digest.neurons.reflection));
      assert.equal(session.digest.neurons.hypothesis.length > 1, true);
      assert.equal(session.digest.neurons.reasoning.length > 0, true);
      assert.equal(session.digest.neurons.reflection.length > 1, true);
      assert.equal(
        session.digest.neurons.reflection.some((item) => item.content.startsWith("Still uncertain:")),
        true,
      );
      assert.equal(
        session.digest.neurons.reflection.some((item) => item.content.startsWith("Recommended next action:")),
        true,
      );
      assert.equal(session.digest.neurons.hypothesis[0].kind, "hypothesis");
      assert.equal(typeof session.digest.neurons.hypothesis[0].content, "string");
      assert.equal(typeof session.digest.neurons.hypothesis[0].confidence, "number");
      assert.equal(typeof session.digest.neurons.hypothesis[0].status, "string");
      assert.ok(Array.isArray(session.digest.neurons.hypothesis[0].supportingEvidence));
      assert.ok(Array.isArray(session.digest.neurons.hypothesis[0].conflictingEvidence));
      assert.equal(session.digest.neurons.hypothesis.some((item) => item.status === "provisional"), true);
      assert.equal(session.digest.neurons.hypothesis.some((item) => item.status === "conflicted"), true);
      assert.equal(
        session.digest.neurons.hypothesis.some((item) => (item.supportingEvidence?.length ?? 0) > 0),
        true,
      );
      assert.equal(session.digest.neurons.reasoning[0].kind, "reasoning");
      assert.equal(typeof session.digest.neurons.reasoning[0].content, "string");
      assert.equal(typeof session.digest.neurons.reasoning[0].salience, "number");
      assert.equal(typeof session.digest.neurons.reasoning[0].confidence, "number");
      assert.equal(typeof session.digest.neurons.reasoning[0].source, "string");
      assert.equal(session.digest.neurons.memory.some((item) => item.source === "workspace-memory"), true);
      assert.equal(session.digest.neurons.memory.some((item) => item.source === "artifact-memory"), true);
    });
  });

  await runTest("ChatService runtime activates repeated hypotheses and decays stale ones", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Activation baseline",
        content: "Workspace memory argues for the activation baseline remaining in play.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });
      await directions.upsertProfile({
        id: "activation-baseline-brief",
        label: "Activation Baseline Brief",
        summary: "Artifact evidence keeps the activation baseline under comparison.",
        knownBaselines: ["activation baseline"],
        evaluationPriorities: ["evidence ranking"],
      });

      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create() {
              return {
                id: "resp-digest-activation",
                output_text: "Activation reply",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      const repeatedPrompt = "Compare the activation baseline against the artifact brief.";
      const targetHypothesis = "Workspace memory likely contains relevant operating context for the current turn.";

      await chat.plainReply({
        senderId: "digest-user-3",
        text: repeatedPrompt
      });

      let raw = await readFile(path.join(dir, "channels", "agent-runtime.json"), "utf8");
      let parsed = JSON.parse(raw);
      let session = parsed.sessions["wechat:digest-user-3"];
      const firstHypothesis = session.digest.neurons.hypothesis.find((item) => item.content === targetHypothesis);
      assert.ok(firstHypothesis);

      await chat.plainReply({
        senderId: "digest-user-3",
        text: repeatedPrompt
      });

      raw = await readFile(path.join(dir, "channels", "agent-runtime.json"), "utf8");
      parsed = JSON.parse(raw);
      session = parsed.sessions["wechat:digest-user-3"];
      const activatedHypothesis = session.digest.neurons.hypothesis.find((item) => item.content === targetHypothesis);
      assert.ok(activatedHypothesis);
      assert.equal(activatedHypothesis.salience >= firstHypothesis.salience, true);
      assert.equal(activatedHypothesis.confidence >= firstHypothesis.confidence, true);

      await chat.plainReply({
        senderId: "digest-user-3",
        text: "Nebula marigold handshake only."
      });

      raw = await readFile(path.join(dir, "channels", "agent-runtime.json"), "utf8");
      parsed = JSON.parse(raw);
      session = parsed.sessions["wechat:digest-user-3"];
      const decayedHypothesis = session.digest.neurons.hypothesis.find((item) => item.content === targetHypothesis);
      assert.ok(decayedHypothesis);
      assert.equal(decayedHypothesis.salience < activatedHypothesis.salience, true);
      assert.equal(decayedHypothesis.status === "provisional" || decayedHypothesis.status === "conflicted", true);
    });
  });

  await runTest("ChatService runtime exposes structured session cognition without raw chain-of-thought", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Cognition anchor",
        content: "Keep the cognition anchor in workspace memory.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });
      await directions.upsertProfile({
        id: "cognition-anchor-brief",
        label: "Cognition Anchor Brief",
        summary: "Artifact evidence for the cognition anchor.",
        knownBaselines: ["cognition anchor"],
        evaluationPriorities: ["anchor stability"],
      });

      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create() {
              return {
                id: "resp-cognition",
                output_text: "Cognition reply",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.plainReply({
        senderId: "digest-user-4",
        text: "Compare the cognition anchor against the brief."
      });

      const cognition = await chat.findSessionCognition("digest-user-4");
      assert.ok(cognition);
      assert.equal(cognition.sessionId, "wechat:digest-user-4");
      assert.equal(cognition.entrySource, "wechat");
      assert.ok(Array.isArray(cognition.neurons.hypothesis));
      assert.equal(cognition.neurons.hypothesis.length > 0, true);
      assert.equal(cognition.neurons.hypothesis.some((item) => item.status === "conflicted"), true);
      assert.equal(
        cognition.neurons.hypothesis.some((item) => (item.supportingEvidence?.length ?? 0) > 0),
        true,
      );
      assert.equal(cognition.neurons.reflection.length > 1, true);
      assert.equal(
        cognition.neurons.reflection.some((item) => item.content.startsWith("Still uncertain:")),
        true,
      );
      assert.equal(
        cognition.neurons.reflection.some((item) => item.content.startsWith("Recommended next action:")),
        true,
      );
      assert.equal(typeof cognition.recentUserIntents[0], "string");
      assert.equal("rawChainOfThought" in cognition, false);
    });
  });

  await runTest("ChatService runtime injects cognition-driven tool guidance into tool-turn instructions", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Tool posture anchor",
        content: "Workspace memory keeps the current tool posture anchor unresolved.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });
      await directions.upsertProfile({
        id: "tool-posture-anchor",
        label: "Tool Posture Anchor",
        summary: "Artifact evidence keeps the current tool posture unresolved.",
        knownBaselines: ["tool posture anchor"],
        evaluationPriorities: ["evidence quality"],
      });

      const requests = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              requests.push(params);
              return {
                id: `resp-guidance-${requests.length}`,
                output_text: `Guidance reply ${requests.length}`,
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.reply({
        senderId: "digest-user-5",
        text: "Compare the tool posture anchor against the research brief."
      });

      await chat.reply({
        senderId: "digest-user-5",
        source: "wechat",
        text: "Research the next step from the same context."
      });

      assert.equal(requests.length, 2);
      const instructions = String(requests[1].instructions);
      assert.ok(instructions.includes("Cognition-driven tool guidance:"));
      assert.ok(instructions.includes("Current tool posture: evidence-gathering."));
      assert.ok(instructions.includes("Read the hypothesis, reasoning, and action neuron layers before calling tools."));
      assert.ok(instructions.includes("Defer these tools unless the user explicitly asks for the deliverable:"));
      assert.ok(instructions.includes("Role-and-entry policy guidance:"));
      assert.ok(instructions.includes("WeChat/OpenClaw entries should prefer compact evidence-gathering tools before long-form synthesis or delivery."));
    });
  });

  await runTest("ChatService runtime can sync delegation outcomes back into session cognition", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      const directions = new ResearchDirectionService(dir);
      await memory.ensureWorkspace();
      await memory.remember({
        scope: "daily",
        title: "Delegation anchor",
        content: "Workspace memory anchors the delegation flow.",
        source: "test",
        sourceType: "user-stated",
        confidence: "high",
      });
      await directions.upsertProfile({
        id: "delegation-anchor-brief",
        label: "Delegation Anchor Brief",
        summary: "Artifact evidence keeps the delegation context active.",
        knownBaselines: ["delegation anchor"],
        evaluationPriorities: ["follow-up quality"],
      });

      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create() {
              return {
                id: "resp-delegation-sync",
                output_text: "Delegation sync reply",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.plainReply({
        senderId: "digest-user-6",
        text: "Compare the delegation anchor before continuing."
      });

      const synced = await chat.syncDelegationCognition("digest-user-6", {
        delegationId: "dlg_sync_1",
        taskId: "task_sync_1",
        kind: "search",
        status: "completed",
        artifactPath: "research/rounds/task_sync_1/workstreams/search.md",
      });

      assert.ok(synced);
      assert.equal(
        synced.recentToolOutcomes.some((item) => item.includes("Delegation dlg_sync_1: search completed for task task_sync_1")),
        true,
      );
      assert.equal(
        synced.pendingActions.some((item) => item.includes("Review the completed search delegation for task task_sync_1")),
        true,
      );
      assert.equal(
        synced.neurons.memory.some((item) => item.content.includes("Delegation dlg_sync_1: search completed for task task_sync_1")),
        true,
      );
      assert.equal(
        synced.neurons.action.some((item) => item.content.includes("Review the completed search delegation for task task_sync_1")),
        true,
      );
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
