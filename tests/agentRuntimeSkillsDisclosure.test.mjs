import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-skill-disclosure-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await runTest("ChatService keeps unrelated workspace skill bodies out of current turn instructions", async () => {
    await withTempDir(async (dir) => {
      const researchSkillDir = path.join(dir, "skills", "research-brief");
      const travelSkillDir = path.join(dir, "skills", "travel-concierge");
      await mkdir(researchSkillDir, { recursive: true });
      await mkdir(travelSkillDir, { recursive: true });
      await writeFile(
        path.join(researchSkillDir, "SKILL.md"),
        `---
name: Research Brief
description: Better evidence-led summaries
tools: research_run
references: notes.md
---
# Research Brief

When the user asks for analysis, produce evidence-led summaries and separate facts from inference.
`,
        "utf8"
      );
      await writeFile(
        path.join(researchSkillDir, "notes.md"),
        "Reference note: keep factual findings separate from speculation.",
        "utf8"
      );
      await writeFile(
        path.join(travelSkillDir, "SKILL.md"),
        `---
name: Travel Concierge
description: Travel planning guidance
tools: memory_search
---
# Travel Concierge

When the user asks for travel planning, focus on itineraries, transit routes, and trip logistics.
`,
        "utf8"
      );

      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const requests = [];
      const chat = new ChatService(dir, memory, {
        client: {
          responses: {
            async create(params) {
              requests.push(params);
              return {
                id: "resp-skill-disclosure-1",
                output_text: "Selective-skill reply.",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.setSkills("agent-user-disclosure-1", [
        "workspace-control",
        "memory-ops",
        "research-ops",
        "workspace:research-brief",
        "workspace:travel-concierge"
      ]);

      const reply = await chat.reply({
        senderId: "agent-user-disclosure-1",
        text: "Use the research brief style to compare two approaches."
      });

      assert.equal(reply, "Selective-skill reply.");
      assert.equal(requests.length, 1);
      const instructions = String(requests[0].instructions);
      assert.ok(instructions.includes("Enabled workspace skills:"));
      assert.ok(instructions.includes("Research Brief"));
      assert.ok(instructions.includes("Travel Concierge"));
      assert.ok(instructions.includes("Disclosed workspace skill instructions for this turn:"));
      const disclosedSection = instructions.split("Disclosed workspace skill instructions for this turn:")[1] ?? "";
      assert.ok(disclosedSection.includes("separate facts from inference"));
      assert.equal(disclosedSection.includes("trip logistics"), false);
      assert.ok(instructions.includes("Referenced workspace skill files for this turn:"));
      assert.ok(instructions.includes("Reference note: keep factual findings separate from speculation."));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
