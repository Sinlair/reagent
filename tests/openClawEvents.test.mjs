import assert from "node:assert/strict";

import { OpenClawBridgeService } from "../dist/services/openClawBridgeService.js";

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

    if (frame.method === "sessions.subscribe") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { subscribed: true },
          }),
        });
      });
      return;
    }

    if (frame.method === "sessions.messages.subscribe") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { subscribed: true, key: frame.params?.key },
          }),
        });
      });
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "event",
            event: "sessions.changed",
            payload: {
              sessionKey: "agent:main:thread:wx-user-1",
              reason: "patch",
            },
          }),
        });
      });
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "event",
            event: "session.message",
            payload: {
              sessionKey: "agent:main:thread:wx-user-1",
              messageId: "msg-1",
              messageSeq: 1,
              message: {
                role: "assistant",
                content: [{ type: "text", text: "event reply" }],
              },
            },
          }),
        });
      });
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            type: "event",
            event: "session.message",
            payload: {
              sessionKey: "agent:main:thread:other",
              messageId: "msg-2",
              messageSeq: 1,
              message: {
                role: "assistant",
                content: [{ type: "text", text: "ignored reply" }],
              },
            },
          }),
        });
      });
      return;
    }
  }

  close() {
    this.readyState = 3;
    this.emit("close", { code: 1000, reason: "done" });
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
    await runTest("OpenClawBridgeService subscribes to filtered session events from the host gateway", async () => {
      const bridge = new OpenClawBridgeService(
        "openclaw",
        "ws://127.0.0.1:18789",
        "openclaw-weixin",
      );

      const events = [];
      const subscription = await bridge.watchSessionEvents({
        sessionKey: "agent:main:thread:wx-user-1",
        onEvent: async (event) => {
          events.push(event);
        },
      });

      for (let index = 0; index < 20 && events.length < 2; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await subscription.close();

      assert.equal(events.length, 2);
      assert.deepEqual(events[0], {
        event: "sessions.changed",
        payload: {
          sessionKey: "agent:main:thread:wx-user-1",
          reason: "patch",
        },
      });
      assert.deepEqual(events[1], {
        event: "session.message",
        payload: {
          sessionKey: "agent:main:thread:wx-user-1",
          messageId: "msg-1",
          messageSeq: 1,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "event reply" }],
          },
        },
      });
    });
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
}

await main();
