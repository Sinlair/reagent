import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-openclaw-cli-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function createWebSocketSetup(tempDir) {
  const setupPath = path.join(tempDir, "openclaw-websocket-setup.mjs");
  await writeFile(
    setupPath,
    `class FakeGatewayWebSocket {
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
    this.listeners.set(type, existing.filter((entry) => entry !== listener));
  }

  send(data) {
    const frame = JSON.parse(data);
    if (frame.method === "connect") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({ type: "res", id: frame.id, ok: true, payload: {} }),
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
                  { accountId: "wx_ops_2", name: "Ops Bot", connected: true, running: true },
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
                { id: "msg-1", role: "user", content: [{ type: "text", text: "hello history" }] },
                { id: "msg-2", role: "assistant", content: [{ type: "text", text: "reply history" }] },
              ],
            },
          }),
        });
      });
      return;
    }

    if (frame.method === "sessions.subscribe") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({ type: "res", id: frame.id, ok: true, payload: { subscribed: true } }),
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
            payload: { sessionKey: "agent:main:thread:wx-user-1", reason: "patch" },
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
              message: { role: "assistant", content: [{ type: "text", text: "event reply" }] },
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

globalThis.WebSocket = FakeGatewayWebSocket;
`,
    "utf8",
  );
  return setupPath;
}

async function runBuiltCliWithSetup(args, cwd, setupPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", pathToFileURL(setupPath).href, path.join(cwd, "dist", "cli.js"), ...args],
      {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        code: code ?? -1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

async function main() {
  const cwd = process.cwd();

  await withTempDir(async (tempDir) => {
    const setupPath = await createWebSocketSetup(tempDir);
    const workspaceDir = path.join(tempDir, "workspace");
    await mkdir(path.join(workspaceDir, "channels"), { recursive: true });
    await mkdir(path.join(workspaceDir, "channels", "openclaw-session-transcripts"), { recursive: true });
    await writeFile(
      path.join(workspaceDir, "channels", "openclaw-sessions.json"),
      `${JSON.stringify(
        {
          updatedAt: "2026-04-09T12:00:00.000Z",
          sessions: [
            {
              sessionKey: "agent:main:thread:cached-session",
              channel: "openclaw-weixin",
              to: "wx-cached",
              accountId: "wx_ops_2",
              threadId: "thread-cached",
              displayName: "Cached Session",
              lastMessagePreview: "cached preview",
              lastSyncedAt: "2026-04-09T12:00:00.000Z",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      path.join(workspaceDir, "channels", "openclaw-session-transcripts", "agent_main_thread_wx-user-1.json"),
      `${JSON.stringify(
        {
          updatedAt: "2026-04-09T12:05:00.000Z",
          messages: [
            {
              id: "cached-msg-1",
              role: "user",
              text: "cached hello",
              createdAt: "2026-04-09T12:04:00.000Z",
            },
            {
              id: "cached-msg-2",
              role: "assistant",
              text: "cached reply",
              createdAt: "2026-04-09T12:05:00.000Z",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await runTest("CLI top-level sessions lists host sessions", async () => {
      const result = await runBuiltCliWithSetup(["sessions", "--json"], cwd, setupPath);
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.sessions.length, 1);
      assert.equal(payload.sessions[0].sessionKey, "agent:main:thread:wx-user-1");
      assert.equal(payload.sessions[0].accountId, "wx_ops_2");
    });

    await runTest("CLI top-level sessions can read the cached OpenClaw session registry", async () => {
      const result = await runBuiltCliWithSetup(
        ["sessions", "--cached", "--workspace", workspaceDir, "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.source, "cached-registry");
      assert.equal(payload.sessions.length, 1);
      assert.equal(payload.sessions[0].sessionKey, "agent:main:thread:cached-session");
      assert.equal(payload.sessions[0].accountId, "wx_ops_2");
    });

    await runTest("CLI top-level sessions prefer the cached OpenClaw session registry when present", async () => {
      const result = await runBuiltCliWithSetup(
        ["sessions", "--workspace", workspaceDir, "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.source, "cached-registry");
      assert.equal(payload.sessions.length, 1);
      assert.equal(payload.sessions[0].sessionKey, "agent:main:thread:cached-session");
    });

    await runTest("CLI top-level history reads host chat history", async () => {
      const result = await runBuiltCliWithSetup(
        ["history", "agent:main:thread:wx-user-1", "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.messages.length, 2);
      assert.equal(payload.messages[0].text, "hello history");
      assert.equal(payload.messages[1].text, "reply history");
    });

    await runTest("CLI top-level history can read cached host session messages", async () => {
      const result = await runBuiltCliWithSetup(
        ["history", "agent:main:thread:wx-user-1", "--cached", "--workspace", workspaceDir, "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.source, "cached-registry");
      assert.equal(payload.messages.length, 2);
      assert.equal(payload.messages[0].text, "cached hello");
      assert.equal(payload.messages[1].text, "cached reply");
    });

    await runTest("CLI top-level history prefers cached host session messages when present", async () => {
      const result = await runBuiltCliWithSetup(
        ["history", "agent:main:thread:wx-user-1", "--workspace", workspaceDir, "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.source, "cached-registry");
      assert.equal(payload.messages.length, 2);
      assert.equal(payload.messages[0].text, "cached hello");
      assert.equal(payload.messages[1].text, "cached reply");
    });

    await runTest("CLI top-level history can bypass cached host session messages with --live", async () => {
      const result = await runBuiltCliWithSetup(
        ["history", "agent:main:thread:wx-user-1", "--live", "--workspace", workspaceDir, "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.source, "live-host");
      assert.equal(payload.messages.length, 2);
      assert.equal(payload.messages[0].text, "hello history");
      assert.equal(payload.messages[1].text, "reply history");
    });

    await runTest("CLI top-level watch aliases to the OpenClaw watch surface", async () => {
      const result = await runBuiltCliWithSetup(
        ["watch", "agent:main:thread:wx-user-1", "--limit", "2", "--json"],
        cwd,
        setupPath,
      );
      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.sessionKey, "agent:main:thread:wx-user-1");
      assert.equal(payload.events.length, 2);
      assert.equal(payload.events[0].event, "sessions.changed");
      assert.equal(payload.events[1].event, "session.message");
    });
  });
}

await main();
