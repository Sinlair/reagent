import assert from "node:assert/strict";

import Fastify from "fastify";

import { registerAgentRoutes } from "../dist/routes/agent.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await runTest("agent routes expose runtime overview", async () => {
    const app = Fastify();

    await registerAgentRoutes(app, {
      async getAgentRuntimeOverview() {
        return {
          sessionCount: 3,
          sessionCountsByEntrySource: {
            direct: 0,
            ui: 1,
            wechat: 1,
            openclaw: 1,
          },
          defaultRoute: {
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            wireApi: "responses",
          },
          availableReasoningEfforts: ["default", "low", "medium", "high"],
          audit: {
            path: "workspace/channels/agent-runtime-audit.jsonl",
            exists: true,
            status: "ready",
          },
        };
      },
      async listAgentSessions() {
        return [
          {
            sessionId: "ui:agent-user-1",
            channel: "ui",
            senderId: "agent-user-1",
            entrySource: "ui",
            activeEntrySource: "ui",
            roleId: "operator",
            roleLabel: "Operator",
            skillIds: ["workspace-control"],
            skillLabels: ["Workspace Control"],
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            turnCount: 2,
            updatedAt: "2026-04-14T00:00:00.000Z",
          },
          {
            sessionId: "wechat:agent-user-2",
            channel: "wechat",
            senderId: "agent-user-2",
            entrySource: "wechat",
            activeEntrySource: "wechat",
            roleId: "researcher",
            roleLabel: "Researcher",
            skillIds: ["research-ops"],
            skillLabels: ["Research Ops"],
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            turnCount: 4,
            updatedAt: "2026-04-14T00:01:00.000Z",
          },
        ];
      },
      async findAgentSession(sessionId) {
        if (sessionId === "ui:agent-user-1") {
          return {
            sessionId: "ui:agent-user-1",
            senderId: "agent-user-1",
            entrySource: "ui",
            activeEntrySource: "ui",
            activeEntryLabel: "UI",
            enabledToolsets: ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
            availableToolsets: ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
            roleId: "operator",
            roleLabel: "Operator",
            skillIds: ["workspace-control"],
            skillLabels: ["Workspace Control"],
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            fallbackRoutes: [],
            reasoningEffort: "default",
            availableRoles: [{ id: "operator", label: "Operator", instruction: "runtime operator" }],
            availableSkills: [{ id: "workspace-control", label: "Workspace Control", instruction: "use tools" }],
            availableLlmProviders: [{ id: "proxy-a", label: "Proxy A", type: "openai", enabled: true, status: "ready", models: [] }],
            availableReasoningEfforts: ["default", "low", "medium", "high"],
            defaultRoute: {
              providerId: "proxy-a",
              providerLabel: "Proxy A",
              modelId: "gpt-5.4",
              modelLabel: "gpt-5.4",
              llmStatus: "ready",
              llmSource: "registry",
            },
          };
        }

        return null;
      },
      async getAgentSessionHistory(sessionId) {
        if (sessionId === "ui:agent-user-1") {
          return {
            sessionId: "ui:agent-user-1",
            senderId: "agent-user-1",
            entrySource: "ui",
            items: [
              {
                role: "user",
                content: "hello",
                createdAt: "2026-04-14T00:00:00.000Z",
              },
              {
                role: "assistant",
                content: "hi",
                createdAt: "2026-04-14T00:00:01.000Z",
              },
            ],
          };
        }

        return null;
      },
      async getAgentSessionHooks(sessionId, limit, event) {
        if (sessionId === "ui:agent-user-1") {
          return {
            sessionId: "ui:agent-user-1",
            senderId: "agent-user-1",
            entrySource: "ui",
            items: [
              {
                ts: "2026-04-14T00:00:00.000Z",
                event: "llm_call",
                senderId: "agent-user-1",
                source: "ui",
                roleId: "operator",
                skillIds: ["workspace-control"],
              },
              {
                ts: "2026-04-14T00:00:01.000Z",
                event: "reply_emit",
                senderId: "agent-user-1",
                source: "ui",
                roleId: "operator",
                skillIds: ["workspace-control"],
              },
            ].filter((item) => (event ? item.event === event : true)).slice(0, limit),
          };
        }

        return null;
      },
      async listAgentHostSessions() {
        return [];
      },
      async getAgentHostSessionHistory() {
        return null;
      },
    }, {
      delegationService: {
        async listRecent() {
          return [];
        },
        async createDelegation() {
          return null;
        },
        async getDelegation() {
          return null;
        },
        async cancelDelegation() {
          return null;
        },
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/agent/runtime",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.sessionCount, 3);
    assert.equal(payload.sessionCountsByEntrySource.ui, 1);
    assert.equal(payload.defaultRoute.modelId, "gpt-5.4");
    assert.equal(payload.audit.status, "ready");

    await app.close();
  });

  await runTest("agent routes expose canonical session list and detail", async () => {
    const app = Fastify();
    const cognition = {
      sessionId: "wechat:agent-user-2",
      senderId: "agent-user-2",
      entrySource: "wechat",
      updatedAt: "2026-04-14T00:00:00.000Z",
      digestUpdatedAt: "2026-04-14T00:00:00.000Z",
      sessionUpdatedAt: "2026-04-14T00:00:00.000Z",
      recentUserIntents: ["User asked: latest question limit=2"],
      recentToolOutcomes: ["agent_describe: completed"],
      pendingActions: ["Inspect the active cognition state."],
      neurons: {
        updatedAt: "2026-04-14T00:00:00.000Z",
        perception: [],
        memory: [],
        hypothesis: [
          {
            id: "hypothesis:1",
            kind: "hypothesis",
            content: "Workspace memory likely contains relevant operating context for the current turn.",
            salience: 0.8,
            confidence: 0.64,
            source: "runtime-inference",
            updatedAt: "2026-04-14T00:00:00.000Z",
            status: "conflicted",
            supportingEvidence: ["memory/2026-04-14.md"],
            conflictingEvidence: ["research-brief"],
          },
        ],
        reasoning: [],
        action: [],
        reflection: [],
      },
    };

    await registerAgentRoutes(app, {
      async getAgentRuntimeOverview() {
        return {
          sessionCount: 0,
          sessionCountsByEntrySource: { direct: 0, ui: 0, wechat: 0, openclaw: 0 },
          defaultRoute: {
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
          },
          availableReasoningEfforts: ["default"],
          audit: {
            path: "workspace/channels/agent-runtime-audit.jsonl",
            exists: false,
            status: "not-found",
          },
        };
      },
      async listAgentSessions() {
        return [
          {
            sessionId: "ui:agent-user-1",
            channel: "ui",
            senderId: "agent-user-1",
            entrySource: "ui",
            activeEntrySource: "ui",
            roleId: "operator",
            roleLabel: "Operator",
            skillIds: ["workspace-control"],
            skillLabels: ["Workspace Control"],
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            turnCount: 2,
            updatedAt: "2026-04-14T00:00:00.000Z",
          },
          {
            sessionId: "wechat:agent-user-2",
            channel: "wechat",
            senderId: "agent-user-2",
            entrySource: "wechat",
            activeEntrySource: "wechat",
            roleId: "researcher",
            roleLabel: "Researcher",
            skillIds: ["research-ops"],
            skillLabels: ["Research Ops"],
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            turnCount: 4,
            updatedAt: "2026-04-14T00:01:00.000Z",
          },
        ];
      },
      async findAgentSession(sessionId) {
        if (sessionId === "wechat:agent-user-2") {
          return {
            sessionId: "wechat:agent-user-2",
            senderId: "agent-user-2",
            entrySource: "wechat",
            activeEntrySource: "wechat",
            activeEntryLabel: "WeChat",
            enabledToolsets: ["workspace", "memory", "research-core"],
            availableToolsets: ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
            roleId: "researcher",
            roleLabel: "Researcher",
            skillIds: ["research-ops"],
            skillLabels: ["Research Ops"],
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
            fallbackRoutes: [],
            reasoningEffort: "high",
            availableRoles: [{ id: "researcher", label: "Researcher", instruction: "research mode" }],
            availableSkills: [{ id: "research-ops", label: "Research Ops", instruction: "run research tools" }],
            availableLlmProviders: [{ id: "proxy-a", label: "Proxy A", type: "openai", enabled: true, status: "ready", models: [] }],
            availableReasoningEfforts: ["default", "high"],
            defaultRoute: {
              providerId: "proxy-a",
              providerLabel: "Proxy A",
              modelId: "gpt-5.4",
              modelLabel: "gpt-5.4",
              llmStatus: "ready",
              llmSource: "registry",
            },
            hostSessionKey: "agent:main:thread:agent-user-2",
            accountId: "wx_ops_2",
            threadId: "thread-2",
            lastHostSyncAt: "2026-04-14T00:02:00.000Z",
          };
        }

        return null;
      },
      async getAgentSessionCognition(sessionId) {
        return sessionId === cognition.sessionId ? cognition : null;
      },
      async getAgentSessionHistory(sessionId, limit) {
        if (sessionId === "wechat:agent-user-2") {
          return {
            sessionId: "wechat:agent-user-2",
            senderId: "agent-user-2",
            entrySource: "wechat",
            items: [
              {
                role: "user",
                content: "first question",
                createdAt: "2026-04-14T00:00:00.000Z",
              },
              {
                role: "assistant",
                content: "first reply",
                createdAt: "2026-04-14T00:00:01.000Z",
              },
              {
                role: "user",
                content: `latest question limit=${limit}`,
                createdAt: "2026-04-14T00:00:02.000Z",
              },
            ].slice(-limit),
          };
        }

        return null;
      },
      async getAgentSessionHooks(sessionId, limit, event) {
        if (sessionId === "wechat:agent-user-2") {
          return {
            sessionId: "wechat:agent-user-2",
            senderId: "agent-user-2",
            entrySource: "wechat",
            items: [
              {
                ts: "2026-04-14T00:00:00.000Z",
                event: "llm_call",
                senderId: "agent-user-2",
                source: "wechat",
                roleId: "researcher",
                skillIds: ["research-ops"],
                stage: "tool-start",
              },
              {
                ts: "2026-04-14T00:00:01.000Z",
                event: "tool_blocked",
                senderId: "agent-user-2",
                source: "wechat",
                roleId: "researcher",
                skillIds: ["research-ops"],
                toolName: "workspace_write",
                error: "blocked by policy",
              },
              {
                ts: "2026-04-14T00:00:02.000Z",
                event: "reply_emit",
                senderId: "agent-user-2",
                source: "wechat",
                roleId: "researcher",
                skillIds: ["research-ops"],
              },
            ].filter((item) => (event ? item.event === event : true)).slice(0, limit),
          };
        }

        return null;
      },
      async listAgentHostSessions(limit) {
        return [
          {
            sessionKey: "agent:main:thread:agent-user-2",
            channel: "openclaw-weixin",
            to: "agent-user-2",
            accountId: "wx_ops_2",
            threadId: "thread-2",
            updatedAt: 123,
            lastSyncedAt: "2026-04-14T00:02:00.000Z",
          },
        ].slice(0, limit);
      },
      async getAgentHostSessionHistory(sessionKey, limit) {
        if (sessionKey === "agent:main:thread:agent-user-2") {
          return {
            sessionKey,
            items: [
              {
                id: "msg-1",
                role: "user",
                text: "hello history",
                createdAt: "2026-04-14T00:00:00.000Z",
              },
              {
                id: "msg-2",
                role: "assistant",
                text: `reply history limit=${limit}`,
                createdAt: "2026-04-14T00:00:01.000Z",
              },
            ].slice(-limit),
          };
        }

        return null;
      },
    }, {
      delegationService: {
        async listRecent() {
          return [];
        },
        async createDelegation() {
          return null;
        },
        async getDelegation() {
          return null;
        },
        async cancelDelegation() {
          return null;
        },
      },
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions?source=wechat&limit=1",
    });
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().sessions.length, 1);
    assert.equal(listResponse.json().sessions[0].sessionId, "wechat:agent-user-2");
    assert.equal(listResponse.json().sessions[0].entrySource, "wechat");

    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/wechat%3Aagent-user-2",
    });
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().sessionId, "wechat:agent-user-2");
    assert.equal(detailResponse.json().senderId, "agent-user-2");
    assert.deepEqual(detailResponse.json().enabledToolsets, ["workspace", "memory", "research-core"]);
    assert.equal(detailResponse.json().hostSessionKey, "agent:main:thread:agent-user-2");
    assert.equal(detailResponse.json().accountId, "wx_ops_2");
    assert.equal(detailResponse.json().threadId, "thread-2");

    const invalidResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/not-a-session-id",
    });
    assert.equal(invalidResponse.statusCode, 400);

    const missingResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/ui%3Amissing-user",
    });
    assert.equal(missingResponse.statusCode, 404);

    const historyResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/wechat%3Aagent-user-2/history?limit=2",
    });
    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.json().sessionId, "wechat:agent-user-2");
    assert.equal(historyResponse.json().items.length, 2);
    assert.equal(historyResponse.json().items[1].content, "latest question limit=2");

    const missingHistoryResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/openclaw%3Amissing-user/history",
    });
    assert.equal(missingHistoryResponse.statusCode, 404);

    const cognitionResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/wechat%3Aagent-user-2/cognition",
    });
    assert.equal(cognitionResponse.statusCode, 200);
    assert.equal(cognitionResponse.json().sessionId, "wechat:agent-user-2");
    assert.equal(cognitionResponse.json().neurons.hypothesis[0].status, "conflicted");

    const missingCognitionResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/openclaw%3Amissing-user/cognition",
    });
    assert.equal(missingCognitionResponse.statusCode, 404);

    const hooksResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/wechat%3Aagent-user-2/hooks?event=tool_blocked&limit=1",
    });
    assert.equal(hooksResponse.statusCode, 200);
    assert.equal(hooksResponse.json().sessionId, "wechat:agent-user-2");
    assert.equal(hooksResponse.json().items.length, 1);
    assert.equal(hooksResponse.json().items[0].event, "tool_blocked");
    assert.equal(hooksResponse.json().items[0].toolName, "workspace_write");

    const missingHooksResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/openclaw%3Amissing-user/hooks",
    });
    assert.equal(missingHooksResponse.statusCode, 404);

    const hostSessionsResponse = await app.inject({
      method: "GET",
      url: "/api/agent/host/sessions?limit=1",
    });
    assert.equal(hostSessionsResponse.statusCode, 200);
    assert.equal(hostSessionsResponse.json().sessions.length, 1);
    assert.equal(hostSessionsResponse.json().sessions[0].sessionKey, "agent:main:thread:agent-user-2");

    const hostHistoryResponse = await app.inject({
      method: "GET",
      url: "/api/agent/host/sessions/agent%3Amain%3Athread%3Aagent-user-2/history?limit=1",
    });
    assert.equal(hostHistoryResponse.statusCode, 200);
    assert.equal(hostHistoryResponse.json().sessionKey, "agent:main:thread:agent-user-2");
    assert.equal(hostHistoryResponse.json().items.length, 1);
    assert.equal(hostHistoryResponse.json().items[0].text, "reply history limit=1");

    const missingHostHistoryResponse = await app.inject({
      method: "GET",
      url: "/api/agent/host/sessions/agent%3Amain%3Athread%3Amissing/history",
    });
    assert.equal(missingHostHistoryResponse.statusCode, 404);

    await app.close();
  });

  await runTest("agent routes expose canonical session profile read and patch", async () => {
    const app = Fastify();
    let profile = {
      sessionId: "ui:agent-user-3",
      senderId: "agent-user-3",
      entrySource: "ui",
      activeEntrySource: "ui",
      activeEntryLabel: "UI",
      enabledToolsets: ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
      availableToolsets: ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
      roleId: "operator",
      roleLabel: "Operator",
      skillIds: ["workspace-control"],
      skillLabels: ["Workspace Control"],
      providerId: "proxy-a",
      providerLabel: "Proxy A",
      modelId: "gpt-5.4",
      modelLabel: "gpt-5.4",
      llmStatus: "ready",
      llmSource: "registry",
      fallbackRoutes: [],
      reasoningEffort: "default",
      availableRoles: [{ id: "operator", label: "Operator", instruction: "runtime operator" }],
      availableSkills: [{ id: "workspace-control", label: "Workspace Control", instruction: "use tools" }],
      availableLlmProviders: [{ id: "proxy-a", label: "Proxy A", type: "openai", enabled: true, status: "ready", models: [] }],
      availableReasoningEfforts: ["default", "high"],
      defaultRoute: {
        providerId: "proxy-a",
        providerLabel: "Proxy A",
        modelId: "gpt-5.4",
        modelLabel: "gpt-5.4",
        llmStatus: "ready",
        llmSource: "registry",
      },
    };

    await registerAgentRoutes(app, {
      async getAgentRuntimeOverview() {
        return {
          sessionCount: 1,
          sessionCountsByEntrySource: { direct: 0, ui: 1, wechat: 0, openclaw: 0 },
          defaultRoute: profile.defaultRoute,
          availableReasoningEfforts: ["default", "high"],
          audit: {
            path: "workspace/channels/agent-runtime-audit.jsonl",
            exists: true,
            status: "ready",
          },
        };
      },
      async listAgentSessions() {
        return [];
      },
      async findAgentSession(sessionId) {
        return sessionId === profile.sessionId ? profile : null;
      },
      async getAgentSessionCognition() {
        return null;
      },
      async updateAgentSessionProfile(input) {
        if (input.sessionId !== profile.sessionId) {
          return null;
        }

        profile = {
          ...profile,
          ...(input.roleId ? { roleId: input.roleId, roleLabel: "Researcher" } : {}),
          ...(input.skillIds ? { skillIds: input.skillIds, skillLabels: ["Research Ops"] } : {}),
          ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
        };
        return profile;
      },
      async getAgentSessionHistory() {
        return null;
      },
      async getAgentSessionHooks() {
        return null;
      },
      async listAgentHostSessions() {
        return [];
      },
      async getAgentHostSessionHistory() {
        return null;
      },
    }, {
      delegationService: {
        async listRecent() {
          return [];
        },
        async createDelegation() {
          return null;
        },
        async getDelegation() {
          return null;
        },
        async cancelDelegation() {
          return null;
        },
      },
    });

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/ui%3Aagent-user-3/profile",
    });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.json().sessionId, "ui:agent-user-3");
    assert.equal(getResponse.json().roleId, "operator");

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/agent/sessions/ui%3Aagent-user-3/profile",
      payload: {
        roleId: "researcher",
        skillIds: ["research-ops"],
        reasoningEffort: "high",
      },
    });
    assert.equal(patchResponse.statusCode, 200);
    assert.equal(patchResponse.json().roleId, "researcher");
    assert.deepEqual(patchResponse.json().skillIds, ["research-ops"]);
    assert.equal(patchResponse.json().reasoningEffort, "high");

    const invalidPatchResponse = await app.inject({
      method: "PATCH",
      url: "/api/agent/sessions/ui%3Aagent-user-3/profile",
      payload: {
        providerId: "proxy-a",
      },
    });
    assert.equal(invalidPatchResponse.statusCode, 400);

    const missingPatchResponse = await app.inject({
      method: "PATCH",
      url: "/api/agent/sessions/ui%3Amissing-user/profile",
      payload: {
        roleId: "researcher",
      },
    });
    assert.equal(missingPatchResponse.statusCode, 404);

    await app.close();
  });

  await runTest("agent routes expose delegation list, create, detail, and cancel", async () => {
    const app = Fastify();
    const synced = [];
    let delegation = {
      delegationId: "dlg_01",
      sessionId: "wechat:agent-user-2",
      taskId: "task_123",
      kind: "search",
      status: "running",
      input: {
        prompt: "Find strong browser-agent baselines",
        scope: "research-only",
        allowRecursiveDelegation: false,
      },
      rationale: {
        source: "cognition-state",
        summary: "Current cognition prefers evidence-gathering delegations before search.",
        matchedAction: "Inspect the strongest evidence before delivery.",
        matchedHypothesis: "There may be multiple valid alternatives worth keeping in play.",
        posture: {
          mode: "evidence-gathering",
          reasons: ["1 conflicted hypothesis node(s) remain active."],
          recommendedKinds: ["search", "reading"],
          deferredKinds: ["synthesis"],
          conflictedHypotheses: 1,
          provisionalHypotheses: 1,
          supportedHypotheses: 0,
        },
      },
      artifact: {
        path: "research/rounds/task_123/workstreams/search.md",
        type: "workstream-memo",
      },
      createdAt: "2026-04-14T00:00:00.000Z",
      updatedAt: "2026-04-14T00:01:00.000Z",
      error: null,
    };

    await registerAgentRoutes(app, {
      async getAgentRuntimeOverview() {
        return {
          sessionCount: 1,
          sessionCountsByEntrySource: { direct: 0, ui: 0, wechat: 1, openclaw: 0 },
          defaultRoute: {
            providerId: "proxy-a",
            providerLabel: "Proxy A",
            modelId: "gpt-5.4",
            modelLabel: "gpt-5.4",
            llmStatus: "ready",
            llmSource: "registry",
          },
          availableReasoningEfforts: ["default"],
          audit: {
            path: "workspace/channels/agent-runtime-audit.jsonl",
            exists: true,
            status: "ready",
          },
        };
      },
      async listAgentSessions() {
        return [];
      },
      async findAgentSession(sessionId) {
        return sessionId === "wechat:agent-user-2"
          ? {
              sessionId,
              senderId: "agent-user-2",
              entrySource: "wechat",
              activeEntrySource: "wechat",
              activeEntryLabel: "WeChat",
              enabledToolsets: ["workspace", "memory", "research-core"],
              availableToolsets: ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
              roleId: "researcher",
              roleLabel: "Researcher",
              skillIds: ["research-ops"],
              skillLabels: ["Research Ops"],
              providerId: "proxy-a",
              providerLabel: "Proxy A",
              modelId: "gpt-5.4",
              modelLabel: "gpt-5.4",
              llmStatus: "ready",
              llmSource: "registry",
              fallbackRoutes: [],
              reasoningEffort: "default",
              availableRoles: [],
              availableSkills: [],
              availableLlmProviders: [],
              availableReasoningEfforts: ["default"],
              defaultRoute: {
                providerId: "proxy-a",
                providerLabel: "Proxy A",
                modelId: "gpt-5.4",
                modelLabel: "gpt-5.4",
                llmStatus: "ready",
                llmSource: "registry",
              },
            }
          : null;
      },
      async getAgentSessionCognition() {
        return {
          sessionId: "wechat:agent-user-2",
          senderId: "agent-user-2",
          entrySource: "wechat",
          updatedAt: "2026-04-14T00:00:00.000Z",
          digestUpdatedAt: "2026-04-14T00:00:00.000Z",
          sessionUpdatedAt: "2026-04-14T00:00:00.000Z",
          recentUserIntents: ["User asked: compare browser-agent baselines"],
          recentToolOutcomes: [],
          pendingActions: ["Inspect the strongest evidence before delivery."],
          neurons: {
            updatedAt: "2026-04-14T00:00:00.000Z",
            perception: [],
            memory: [],
            hypothesis: [
              {
                id: "hypothesis:1",
                kind: "hypothesis",
                content: "There may be multiple valid alternatives worth keeping in play.",
                salience: 0.8,
                confidence: 0.58,
                source: "runtime-inference",
                updatedAt: "2026-04-14T00:00:00.000Z",
                status: "conflicted",
                supportingEvidence: ["browser-agent-baseline.md"],
                conflictingEvidence: ["research-brief"],
              },
            ],
            reasoning: [],
            action: [
              {
                id: "action:1",
                kind: "action",
                content: "Inspect the strongest evidence before delivery.",
                salience: 0.88,
                confidence: 0.78,
                source: "assistant-reply",
                updatedAt: "2026-04-14T00:00:00.000Z",
              },
            ],
            reflection: [],
          },
        };
      },
      async syncAgentDelegationCognition(input) {
        synced.push(input);
        return null;
      },
      async updateAgentSessionProfile() {
        return null;
      },
      async getAgentSessionHistory() {
        return null;
      },
      async getAgentSessionHooks() {
        return null;
      },
      async listAgentHostSessions() {
        return [];
      },
      async getAgentHostSessionHistory() {
        return null;
      },
    }, {
      delegationService: {
        async listRecent(limit, status, sessionId) {
          return [delegation].filter((item) => (!status || item.status === status) && (!sessionId || item.sessionId === sessionId)).slice(0, limit);
        },
        async createDelegation(input) {
          delegation = {
            ...delegation,
            sessionId: input.sessionId,
            taskId: input.taskId,
            kind: input.kind,
            status: "completed",
            input: {
              ...(input.prompt ? { prompt: input.prompt } : {}),
              scope: "research-only",
              allowRecursiveDelegation: false,
            },
            ...(input.rationale ? { rationale: input.rationale } : {}),
            updatedAt: "2026-04-14T00:02:00.000Z",
          };
          return delegation;
        },
        async getDelegation(id) {
          return id === delegation.delegationId ? delegation : null;
        },
        async cancelDelegation(id) {
          if (id !== delegation.delegationId) {
            return null;
          }
          delegation = {
            ...delegation,
            status: "cancelled",
            updatedAt: "2026-04-14T00:03:00.000Z",
          };
          return delegation;
        },
      },
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/agent/delegations?status=running&sessionId=wechat%3Aagent-user-2&limit=5",
    });
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().items.length, 1);
    assert.equal(listResponse.json().items[0].delegationId, "dlg_01");
    assert.equal(synced.length, 1);

    const blockedCreateResponse = await app.inject({
      method: "POST",
      url: "/api/agent/delegations",
      payload: {
        sessionId: "wechat:agent-user-2",
        taskId: "task_123",
        kind: "synthesis",
      },
    });
    assert.equal(blockedCreateResponse.statusCode, 400);
    assert.equal(
      blockedCreateResponse.json().message.startsWith("Cognition prefers search or reading delegations before synthesis"),
      true,
    );

    const duplicateCreateResponse = await app.inject({
      method: "POST",
      url: "/api/agent/delegations",
      payload: {
        sessionId: "wechat:agent-user-2",
        taskId: "task_123",
        kind: "search",
      },
    });
    assert.equal(duplicateCreateResponse.statusCode, 400);
    assert.equal(
      duplicateCreateResponse.json().message.startsWith("An active search delegation already exists for task task_123."),
      true,
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/agent/delegations",
      payload: {
        sessionId: "wechat:agent-user-2",
        taskId: "task_456",
        kind: "search",
        prompt: "Find strong browser-agent baselines",
      },
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.json().status, "completed");
    assert.equal(createResponse.json().artifact.path, "research/rounds/task_123/workstreams/search.md");
    assert.equal(createResponse.json().rationale.posture.mode, "evidence-gathering");
    assert.deepEqual(createResponse.json().rationale.posture.recommendedKinds, ["search", "reading"]);
    assert.equal(
      createResponse.json().rationale.posture.reasons.some((item) => item.includes("Current entry is wechat")),
      true,
    );
    assert.equal(
      createResponse.json().rationale.posture.reasons.some((item) => item.includes("Current role is researcher")),
      true,
    );

    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/agent/delegations/dlg_01",
    });
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().delegationId, "dlg_01");

    const cancelResponse = await app.inject({
      method: "POST",
      url: "/api/agent/delegations/dlg_01/cancel",
    });
    assert.equal(cancelResponse.statusCode, 200);
    assert.equal(cancelResponse.json().status, "cancelled");

    const missingDetailResponse = await app.inject({
      method: "GET",
      url: "/api/agent/delegations/missing",
    });
    assert.equal(missingDetailResponse.statusCode, 404);
    assert.equal(synced.length >= 4, true);

    await app.close();
  });
}

await main();
