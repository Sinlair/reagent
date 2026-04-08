import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NativeWeChatChannelProvider } from "../dist/providers/channels/nativeWeChatChannelProvider.js";
import { OpenAiCompatClient } from "../dist/providers/llm/openAiCompatClient.js";
import { OpenAiLlmClient } from "../dist/providers/llm/openaiLlmClient.js";
import { ChatService } from "../dist/services/chatService.js";
import { LlmRegistryService } from "../dist/services/llmRegistryService.js";
import { SkillRegistryService } from "../dist/services/skillRegistryService.js";
import { MemoryService } from "../dist/services/memoryService.js";
import { McpRegistryService } from "../dist/services/mcpRegistryService.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-provider-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const UNSUPPORTED_MEDIA_REPLY = "\u5f53\u524d\u4ec5\u652f\u6301\u6587\u672c\u547d\u4ee4\u3002\u8bf7\u53d1\u9001 /research\u3001/memory \u6216 /remember\u3002";

async function main() {
  await runTest("OpenAiLlmClient retries until a valid structured plan is returned", async () => {
    const requests = [];
    const responses = [
      {
        output_text: '```json\n{"objective":"Map the field","subquestions":"bad","searchQueries":[]}\n```'
      },
      {
        output_text:
          'Here is the corrected JSON:\n```json\n{"objective":"Map the field","subquestions":["What methods are used?"],"searchQueries":["agentic systems survey"]}\n```'
      }
    ];

    const llm = new OpenAiLlmClient("test-key", "gpt-test", undefined, {
      responses: {
        async create(params) {
          requests.push(params);
          const next = responses.shift();
          if (!next) {
            throw new Error("No more mocked responses.");
          }
          return next;
        }
      }
    });

    const plan = await llm.planResearch({ topic: "agentic systems" });

    assert.equal(plan.objective, "Map the field");
    assert.deepEqual(plan.subquestions, ["What methods are used?"]);
    assert.deepEqual(plan.searchQueries, ["agentic systems survey"]);
    assert.equal(requests.length, 2);
    assert.ok(requests[1].input.includes("The previous response was invalid."));
    assert.ok(requests[1].input.includes("subquestions"));
  });

  await runTest("OpenAiCompatClient forwards reasoning effort to chat completions", async () => {
    const requests = [];
    const client = new OpenAiCompatClient("test-key", "gpt-test", "chat-completions", undefined, {
      chat: {
        completions: {
          async create(params) {
            requests.push(params);
            return {
              choices: [
                {
                  message: {
                    content: "ok"
                  }
                }
              ]
            };
          }
        }
      }
    });

    const result = await client.createText({
      systemPrompt: "You are concise.",
      userPayload: "Reply with OK.",
      reasoningEffort: "high"
    });

    assert.equal(result, "ok");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].reasoning_effort, "high");
  });

  await runTest("ChatService fallback returns readable ASCII guidance", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();
      const chat = new ChatService(dir, memory, {
        client: {}
      });

      const reply = await chat.reply({
        senderId: "ui-wechat-user",
        text: "What can you do?"
      });

      assert.ok(reply.includes("direct chat"));
      assert.ok(reply.includes("/research <topic>"));
      assert.equal(/[^\x00-\x7F]/.test(reply), false);
    });
  });

  await runTest("NativeWeChatChannelProvider returns a readable unsupported-media reply", async () => {
    await withTempDir(async (dir) => {
      const sentBodies = [];
      let commandCalls = 0;
      let provider;
      const originalFetch = global.fetch;
      global.fetch = async (_url, options = {}) => {
        sentBodies.push(String(options.body ?? ""));
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      };

      try {
        provider = new NativeWeChatChannelProvider(dir, async () => {
          commandCalls += 1;
          return {
            accepted: true,
            reply: "should not be used"
          };
        });

        await provider.resumeMonitorIfNeeded();
        await provider.writeState({
          providerMode: "native",
          configured: true,
          linked: true,
          running: true,
          connected: true,
          activeAccountId: "wx-bot-unsupported",
          accountId: "wx-bot-unsupported",
          accountName: "Native Bot",
          botToken: "bot-token",
          baseUrl: "https://example.com",
          contextTokens: {},
          updatedAt: new Date().toISOString(),
          messages: []
        });

        await provider.handleInboundFromWeixinMessage({
          from_user_id: "wx-user-1",
          context_token: "ctx-1",
          item_list: [{ type: 2 }]
        });

        const messages = await provider.listMessages();
        assert.equal(commandCalls, 0);
        assert.equal(messages[0]?.text, "[media]");
        assert.equal(messages.at(-1)?.direction, "outbound");
        assert.equal(messages.at(-1)?.text, UNSUPPORTED_MEDIA_REPLY);
        assert.equal(sentBodies.length, 1);
        assert.ok(sentBodies[0].includes(UNSUPPORTED_MEDIA_REPLY));
      } finally {
        await provider?.close();
        global.fetch = originalFetch;
      }
    });
  });

  await runTest("NativeWeChatChannelProvider suppresses duplicated inbound deliveries", async () => {
    await withTempDir(async (dir) => {
      const sentBodies = [];
      let commandCalls = 0;
      let provider;
      const originalFetch = global.fetch;
      global.fetch = async (_url, options = {}) => {
        sentBodies.push(String(options.body ?? ""));
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      };

      try {
        provider = new NativeWeChatChannelProvider(dir, async () => {
          commandCalls += 1;
          return {
            accepted: true,
            reply: "你好！请问我能给你提供什么帮助吗？"
          };
        });

        await provider.resumeMonitorIfNeeded();
        await provider.writeState({
          providerMode: "native",
          configured: true,
          linked: true,
          running: true,
          connected: true,
          activeAccountId: "wx-bot-dedup",
          accountId: "wx-bot-dedup",
          accountName: "Native Bot",
          botToken: "bot-token",
          baseUrl: "https://example.com",
          contextTokens: {},
          updatedAt: new Date().toISOString(),
          messages: []
        });

        const inbound = {
          from_user_id: "wx-user-dup",
          message_type: 1,
          context_token: "ctx-dup-1",
          item_list: [{ type: 1, text_item: { text: "你好" } }]
        };

        await provider.handleInboundFromWeixinMessage(inbound);
        await provider.handleInboundFromWeixinMessage(inbound);

        const messages = await provider.listMessages();
        assert.equal(commandCalls, 1);
        assert.equal(sentBodies.length, 1);
        assert.equal(messages.filter((message) => message.direction === "inbound").length, 1);
        assert.equal(messages.filter((message) => message.direction === "outbound").length, 1);
      } finally {
        await provider?.close();
        global.fetch = originalFetch;
      }
    });
  });

  await runTest("ChatService OpenAI runtime can execute local tools with role-aware instructions", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const requests = [];
      const client = {
        responses: {
          async create(params) {
            requests.push(params);
            if (requests.length === 1) {
              return {
                id: "resp-1",
                output_text: "",
                output: [
                  {
                    type: "function_call",
                    name: "research_run",
                    arguments: JSON.stringify({ topic: "agentic systems" }),
                    call_id: "call-1"
                  }
                ]
              };
            }

            return {
              id: "resp-2",
              output_text: "Research launched for agentic systems.",
              output: []
            };
          }
        }
      };

      const researchService = {
        async runResearch(request) {
          return {
            taskId: "task-agent-runtime-1",
            topic: request.topic,
            question: request.question,
            generatedAt: new Date().toISOString(),
            plan: {
              objective: request.question ?? request.topic,
              subquestions: ["What methods are used?"],
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
        },
        async listRecentReports() {
          return [];
        }
      };

      const chat = new ChatService(dir, memory, {
        client,
        model: "gpt-test",
        researchService,
        wireApi: "responses"
      });

      await chat.setRole("agent-user-1", "researcher");
      const reply = await chat.reply({
        senderId: "agent-user-1",
        text: "Please research agentic systems for me."
      });

      assert.ok(reply.includes("What I understood"));
      assert.ok(reply.includes("What I did"));
      assert.ok(reply.includes("What you should do next"));
      assert.ok(reply.includes("Research launched for agentic systems."));
      assert.equal(requests.length, 2);
      assert.ok(String(requests[0].instructions).includes("Active role: Researcher (researcher)"));
      assert.ok(String(requests[0].instructions).includes("What I understood / What I did / What you should do next"));
      assert.ok(requests[0].tools.some((tool) => tool.name === "research_run"));
      assert.equal(requests[1].previous_response_id, "resp-1");
      assert.equal(requests[1].input[0].type, "function_call_output");
      assert.ok(String(requests[1].input[0].output).includes("task-agent-runtime-1"));
    });
  });

  await runTest("ChatService runtime removes disabled-skill tools from the model tool list", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const requests = [];
      const client = {
        responses: {
          async create(params) {
            requests.push(params);
            return {
              id: "resp-no-tools",
              output_text: "Acknowledged.",
              output: []
            };
          }
        }
      };

      const chat = new ChatService(dir, memory, {
        client,
        model: "gpt-test",
        wireApi: "responses"
      });

      await chat.setSkills("agent-user-2", ["workspace-control", "memory-ops"]);
      const session = await chat.describeSession("agent-user-2");
      assert.deepEqual(session.skillIds, ["workspace-control", "memory-ops"]);

      await chat.reply({
        senderId: "agent-user-2",
        text: "Can you help with recent research?"
      });

      assert.equal(requests.length, 1);
      assert.equal(requests[0].tools.some((tool) => tool.name === "research_run"), false);
      assert.equal(requests[0].tools.some((tool) => tool.name === "memory_search"), true);
    });
  });

  await runTest("ChatService runtime filters toolsets by entry source", async () => {
    await withTempDir(async (dir) => {
      const memory = new MemoryService(dir);
      await memory.ensureWorkspace();

      const requests = [];
      const client = {
        responses: {
          async create(params) {
            requests.push(params);
            return {
              id: `resp-${requests.length}`,
              output_text: "Acknowledged.",
              output: []
            };
          }
        }
      };

      const researchService = {
        async runResearch(request) {
          return {
            taskId: "task-toolset-1",
            topic: request.topic,
            question: request.question,
            generatedAt: new Date().toISOString(),
            plan: {
              objective: request.question ?? request.topic,
              subquestions: [],
              searchQueries: [request.topic]
            },
            papers: [],
            chunks: [],
            summary: "summary",
            findings: [],
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
        },
        async listRecentReports() {
          return [];
        },
        async getReport() {
          return null;
        }
      };

      const chat = new ChatService(dir, memory, {
        client,
        model: "gpt-test",
        researchService,
        wireApi: "responses"
      });

      await chat.reply({
        senderId: "toolset-user",
        text: "Help with my research setup.",
        source: "wechat"
      });

      await chat.reply({
        senderId: "toolset-user",
        text: "Help with my research setup.",
        source: "ui"
      });

      assert.equal(requests.length, 2);
      assert.ok(String(requests[0].instructions).includes("Active entry: WeChat (wechat)"));
      assert.equal(requests[0].tools.some((tool) => tool.name === "direction_upsert"), false);
      assert.equal(requests[0].tools.some((tool) => tool.name === "presentation_generate"), false);
      assert.equal(requests[0].tools.some((tool) => tool.name === "research_run"), true);

      assert.ok(String(requests[1].instructions).includes("Active entry: UI (ui)"));
      assert.equal(requests[1].tools.some((tool) => tool.name === "direction_upsert"), true);
      assert.equal(requests[1].tools.some((tool) => tool.name === "presentation_generate"), true);

      const summary = await chat.describeSession("toolset-user");
      assert.equal(summary.activeEntrySource, "ui");
      assert.equal(summary.enabledToolsets.includes("research-admin"), true);
      assert.equal(summary.enabledToolsets.includes("research-heavy"), true);
    });
  });

  await runTest("LlmRegistryService resolves provider/model routes with per-model wire APIs", async () => {
    await withTempDir(async (dir) => {
      await mkdir(path.join(dir, "channels"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "llm-providers.json"),
        `${JSON.stringify(
          {
            defaults: {
              agent: { providerId: "proxy-a", modelId: "gpt-4o" },
              research: { providerId: "proxy-a", modelId: "gpt-5.4" }
            },
            providers: [
              {
                id: "proxy-a",
                label: "Proxy A",
                type: "openai",
                enabled: true,
                baseUrl: "https://proxy.example.com/v1",
                apiKeyEnv: "TEST_PROXY_OPENAI_KEY",
                wireApi: "responses",
                models: [
                  { id: "gpt-5.4", wireApi: "responses" },
                  { id: "gpt-4o", wireApi: "chat-completions" }
                ]
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      process.env.TEST_PROXY_OPENAI_KEY = "test-proxy-key";
      try {
        const registry = new LlmRegistryService(dir);
        const agentRoute = await registry.resolvePurpose("agent");
        const researchRoute = await registry.resolvePurpose("research");

        assert.equal(agentRoute.source, "registry");
        assert.equal(agentRoute.providerId, "proxy-a");
        assert.equal(agentRoute.modelId, "gpt-4o");
        assert.equal(agentRoute.wireApi, "chat-completions");
        assert.equal(agentRoute.status, "ready");

        assert.equal(researchRoute.source, "registry");
        assert.equal(researchRoute.providerId, "proxy-a");
        assert.equal(researchRoute.modelId, "gpt-5.4");
        assert.equal(researchRoute.wireApi, "responses");
        assert.equal(researchRoute.status, "ready");
      } finally {
        delete process.env.TEST_PROXY_OPENAI_KEY;
      }
    });
  });

  await runTest("McpRegistryService resolves env placeholders inside remote server URLs", async () => {
    await withTempDir(async (dir) => {
      await mkdir(path.join(dir, "channels"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "mcp-servers.json"),
        `${JSON.stringify(
          {
            servers: [
              {
                serverLabel: "amap-maps",
                serverUrl: "https://mcp.amap.com/sse?key=${AMAP_MAPS_API_KEY}",
                requireApproval: "never",
                enabled: true
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      process.env.AMAP_MAPS_API_KEY = "amap-test-key";
      try {
        const registry = new McpRegistryService(dir);
        const servers = await registry.listServers();
        const tools = await registry.buildOpenAiTools();

        assert.equal(servers.length, 1);
        assert.equal(servers[0]?.status, "ready");
        assert.equal(servers[0]?.serverUrl, "https://mcp.amap.com/sse?key=amap-test-key");
        assert.equal(tools.length, 1);
        assert.equal(tools[0]?.server_url, "https://mcp.amap.com/sse?key=amap-test-key");
      } finally {
        delete process.env.AMAP_MAPS_API_KEY;
      }
    });
  });

  await runTest("SkillRegistryService loads workspace SKILL.md entries and reports env requirements", async () => {
    await withTempDir(async (dir) => {
      const skillDir = path.join(dir, "skills", "travel-concierge");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Travel Concierge
description: Travel planning skill
env: AMAP_MAPS_API_KEY
tools: amap-maps, research_run
---
# Travel Concierge

Use this skill for route and itinerary planning.
`,
        "utf8"
      );

      const registry = new SkillRegistryService(dir);
      const skills = await registry.listSkills();

      assert.equal(skills.length, 1);
      assert.equal(skills[0]?.id, "workspace:travel-concierge");
      assert.equal(skills[0]?.label, "Travel Concierge");
      assert.equal(skills[0]?.status, "needs-setup");
      assert.ok(skills[0]?.notes.some((note) => note.includes("AMAP_MAPS_API_KEY")));
      assert.deepEqual(skills[0]?.relatedTools, ["amap-maps", "research_run"]);
    });
  });

  await runTest("ChatService persists agent model route selection from the registry", async () => {
    await withTempDir(async (dir) => {
      await mkdir(path.join(dir, "channels"), { recursive: true });
      await writeFile(
        path.join(dir, "channels", "llm-providers.json"),
        `${JSON.stringify(
          {
            defaults: {
              agent: { providerId: "proxy-a", modelId: "gpt-5.4" }
            },
            providers: [
              {
                id: "proxy-a",
                label: "Proxy A",
                type: "openai",
                enabled: true,
                baseUrl: "https://proxy.example.com/v1",
                apiKeyEnv: "TEST_PROXY_OPENAI_KEY",
                wireApi: "responses",
                models: [
                  { id: "gpt-5.4", wireApi: "responses" },
                  { id: "gpt-4o", wireApi: "chat-completions" }
                ]
              }
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      process.env.TEST_PROXY_OPENAI_KEY = "test-proxy-key";
      try {
        const memory = new MemoryService(dir);
        await memory.ensureWorkspace();
        const chat = new ChatService(dir, memory);

        const initial = await chat.describeSession("agent-user-3");
        assert.equal(initial.providerId, "proxy-a");
        assert.equal(initial.modelId, "gpt-5.4");
        assert.equal(initial.wireApi, "responses");

        const updated = await chat.setModel("agent-user-3", "proxy-a", "gpt-4o");
        assert.equal(updated.providerId, "proxy-a");
        assert.equal(updated.modelId, "gpt-4o");
        assert.equal(updated.wireApi, "chat-completions");

        const withFallbacks = await chat.setFallbacks("agent-user-3", [
          { providerId: "proxy-a", modelId: "gpt-5.4" }
        ]);
        assert.equal(withFallbacks.fallbackRoutes.length, 1);
        assert.equal(withFallbacks.fallbackRoutes[0]?.modelId, "gpt-5.4");

        const withReasoning = await chat.setReasoning("agent-user-3", "high");
        assert.equal(withReasoning.reasoningEffort, "high");

        const reset = await chat.clearModel("agent-user-3");
        assert.equal(reset.providerId, "proxy-a");
        assert.equal(reset.modelId, "gpt-5.4");
        assert.equal(reset.wireApi, "responses");
        assert.equal(reset.fallbackRoutes.length, 1);
        assert.equal(reset.reasoningEffort, "high");

        const sessions = await chat.listSessions();
        assert.equal(sessions[0]?.providerId, "proxy-a");
        assert.equal(sessions[0]?.modelId, "gpt-5.4");
        assert.equal(sessions[0]?.wireApi, "responses");
      } finally {
        delete process.env.TEST_PROXY_OPENAI_KEY;
      }
    });
  });

  await runTest("ChatService injects enabled workspace skill prompts into runtime instructions", async () => {
    await withTempDir(async (dir) => {
      const skillDir = path.join(dir, "skills", "research-brief");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Research Brief
description: Better evidence-led summaries
tools: research_run
---
# Research Brief

When the user asks for analysis, produce evidence-led summaries and separate facts from inference.
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
                id: "resp-skill-1",
                output_text: "Skill-aware reply.",
                output: []
              };
            }
          }
        },
        model: "gpt-test",
        wireApi: "responses"
      });

      const initial = await chat.describeSession("agent-user-4");
      assert.ok(initial.availableSkills.some((skill) => skill.id === "workspace:research-brief"));

      await chat.setSkills("agent-user-4", [
        "workspace-control",
        "memory-ops",
        "research-ops",
        "workspace:research-brief"
      ]);

      const reply = await chat.reply({
        senderId: "agent-user-4",
        text: "Compare two approaches."
      });

      assert.equal(reply, "Skill-aware reply.");
      assert.equal(requests.length, 1);
      assert.ok(String(requests[0].instructions).includes("Enabled workspace skills:"));
      assert.ok(String(requests[0].instructions).includes("Research Brief"));
      assert.ok(String(requests[0].instructions).includes("separate facts from inference"));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
