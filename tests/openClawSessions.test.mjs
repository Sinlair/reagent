import assert from "node:assert/strict";

import {
  OpenClawBridgeService,
} from "../dist/services/openClawBridgeService.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

class FakeGatewayWebSocket {
  constructor(_url) {
    this.readyState = 1;
    this.listeners = new Map();
    queueMicrotask(() => {
      this.emit("message", {
        data: JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: { nonce: "nonce-1" },
        }),
      });
    });
  }

  addEventListener(type, listener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  removeEventListener(type, listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      existing.filter((entry) => entry !== listener),
    );
  }

  send(data) {
    const frame = JSON.parse(data);
    if (frame.method === "connect") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {},
          }),
        });
      });
      return;
    }

    if (frame.method === "channels.status") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              channels: {
                "openclaw-weixin": {
                  connected: true,
                  configured: true,
                  linked: true,
                  running: true,
                },
              },
              channelAccounts: {
                "openclaw-weixin": [
                  {
                    accountId: "wx_ops_2",
                    name: "Ops Bot",
                    connected: true,
                    running: true,
                  },
                ],
              },
            },
          }),
        });
      });
      return;
    }

    if (frame.method === "sessions.list") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              sessions: [
                {
                  key: "agent:main:thread:wx-user-1",
                  channel: "openclaw-weixin",
                  lastTo: "wx-user-1",
                  lastAccountId: "wx_ops_2",
                  lastThreadId: "thread-1",
                  displayName: "Ops Thread",
                  lastMessagePreview: "Latest preview",
                  updatedAt: 1775608200000,
                },
              ],
            },
          }),
        });
      });
      return;
    }

    if (frame.method === "chat.history") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              messages: [
                {
                  id: "msg-1",
                  role: "user",
                  content: [{ type: "text", text: "hello history" }],
                },
                {
                  id: "msg-2",
                  role: "assistant",
                  content: [{ type: "text", text: "reply history" }],
                },
              ],
            },
          }),
        });
      });
      return;
    }
  }

  close() {
    this.readyState = 3;
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

async function main() {
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = FakeGatewayWebSocket;

  try {
    await runTest("OpenClawBridgeService lists sessions from the host gateway", async () => {
      const bridge = new OpenClawBridgeService(
        "openclaw",
        "ws://127.0.0.1:18789",
        "openclaw-weixin",
      );

      const sessions = await bridge.listSessions({
        channel: "openclaw-weixin",
        limit: 20,
        includeDerivedTitles: true,
        includeLastMessage: true,
      });

      assert.equal(sessions.length, 1);
      assert.deepEqual(sessions[0], {
        sessionKey: "agent:main:thread:wx-user-1",
        channel: "openclaw-weixin",
        to: "wx-user-1",
        accountId: "wx_ops_2",
        threadId: "thread-1",
        displayName: "Ops Thread",
        lastMessagePreview: "Latest preview",
        updatedAt: 1775608200000,
      });
    });

    await runTest("OpenClawBridgeService reads chat history from the host gateway", async () => {
      const bridge = new OpenClawBridgeService(
        "openclaw",
        "ws://127.0.0.1:18789",
        "openclaw-weixin",
      );

      const messages = await bridge.readHistory("agent:main:thread:wx-user-1", 10);

      assert.equal(messages.length, 2);
      assert.deepEqual(messages[0], {
        id: "msg-1",
        role: "user",
        text: "hello history",
        raw: {
          id: "msg-1",
          role: "user",
          content: [{ type: "text", text: "hello history" }],
        },
      });
      assert.deepEqual(messages[1], {
        id: "msg-2",
        role: "assistant",
        text: "reply history",
        raw: {
          id: "msg-2",
          role: "assistant",
          content: [{ type: "text", text: "reply history" }],
        },
      });
    });
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
}

await main();
