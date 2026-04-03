import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NativeWeChatChannelProvider } from "../dist/providers/channels/nativeWeChatChannelProvider.js";

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
  const dir = await mkdtemp(path.join(os.tmpdir(), "reagent-native-provider-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 1500, intervalMs = 25) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) {
      return result;
    }
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for condition.");
}

function safeAccountKey(accountId) {
  return String(accountId).trim().replace(/[\\/:*?"<>|]/g, "_");
}

async function writeNativeState(workspaceDir, partial) {
  const channelsDir = path.join(workspaceDir, "channels");
  await mkdir(channelsDir, { recursive: true });
  const statePath = path.join(channelsDir, "wechat-native-state.json");
  const baseState = {
    providerMode: "native",
    configured: false,
    linked: false,
    running: false,
    connected: false,
    baseUrl: "https://unit.test",
    contextTokens: {},
    updatedAt: new Date().toISOString(),
    messages: []
  };
  await writeFile(statePath, `${JSON.stringify({ ...baseState, ...partial }, null, 2)}\n`, "utf8");
  return statePath;
}

async function readNativeProviderState(workspaceDir) {
  const statePath = path.join(workspaceDir, "channels", "wechat-native-state.json");
  return JSON.parse(await readFile(statePath, "utf8"));
}

async function readNativeAccountBundle(workspaceDir, accountId) {
  const accountKey = safeAccountKey(accountId);
  const root = path.join(workspaceDir, "channels", "wechat-native");
  const record = JSON.parse(await readFile(path.join(root, "accounts", `${accountKey}.json`), "utf8"));
  const sync = JSON.parse(await readFile(path.join(root, "accounts", `${accountKey}.sync.json`), "utf8"));
  const context = JSON.parse(await readFile(path.join(root, "accounts", `${accountKey}.context-tokens.json`), "utf8"));
  const index = JSON.parse(await readFile(path.join(root, "accounts.json"), "utf8"));
  return { record, sync, context, index };
}

async function withFetchStub(handler, fn) {
  const originalFetch = global.fetch;
  global.fetch = handler;
  try {
    await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

async function main() {
  await runTest("Native provider resumes from saved token after cooldown", async () => {
    await withTempDir(async (dir) => {
      await writeNativeState(dir, {
        configured: true,
        linked: true,
        running: false,
        connected: false,
        accountId: "wx_bot_1",
        accountName: "Native Bot",
        botToken: "saved-bot-token",
        getUpdatesBuf: "legacy-sync-buf",
        contextTokens: {
          "wx-user-1": "ctx-1"
        },
        sessionPausedUntil: new Date(Date.now() + 30).toISOString()
      });

      const fetchCalls = [];
      await withFetchStub(async (url) => {
        fetchCalls.push(String(url));
        await sleep(10);
        return {
          ok: true,
          headers: { get: () => null },
          text: async () => JSON.stringify({ ret: 0, msgs: [], get_updates_buf: "sync-buf-1" })
        };
      }, async () => {
        const provider = new NativeWeChatChannelProvider(dir, async () => ({ accepted: true, reply: "ok" }));
        await provider.start();
        await sleep(150);
        const state = await provider.readState();
        const providerState = await readNativeProviderState(dir);
        const accountBundle = await readNativeAccountBundle(dir, "wx_bot_1");
        await provider.close();

        assert.equal(fetchCalls.length >= 1, true);
        assert.equal(state.botToken, "saved-bot-token");
        assert.equal(state.connected, true);
        assert.equal(state.sessionPausedUntil, undefined);
        assert.equal(state.getUpdatesBuf, "sync-buf-1");
        assert.equal(providerState.activeAccountId, "wx_bot_1");
        assert.equal(accountBundle.record.botToken, "saved-bot-token");
        assert.equal(accountBundle.sync.get_updates_buf, "sync-buf-1");
        assert.equal(accountBundle.context["wx-user-1"], "ctx-1");
      });
    });
  });

  await runTest("Native provider starts fresh QR reauth when upstream session expires", async () => {
    await withTempDir(async (dir) => {
      const provider = new NativeWeChatChannelProvider(dir, async () => ({ accepted: true, reply: "ok" }));
      await sleep(20);
      await provider.writeState({
        providerMode: "native",
        configured: true,
        linked: true,
        running: true,
        connected: true,
        activeAccountId: "wx_bot_2",
        accountId: "wx_bot_2",
        accountName: "Native Bot",
        botToken: "saved-bot-token",
        baseUrl: "https://unit.test",
        contextTokens: {},
        updatedAt: new Date().toISOString(),
        messages: []
      });

      await withFetchStub(async (url) => {
        const href = String(url);
        if (href.includes("getupdates")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({ ret: -14, errcode: -14, msgs: [] })
          };
        }
        if (href.includes("get_bot_qrcode")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({
              qrcode: "reauth-qrcode-1",
              qrcode_img_content: "reauth-qr-content-1"
            })
          };
        }
        if (href.includes("get_qrcode_status")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({ status: "wait" })
          };
        }
        throw new Error(`Unexpected fetch URL: ${href}`);
      }, async () => {
        await provider.start();
        const state = await waitFor(async () => {
          const current = await provider.readState();
          return current.qrDataUrl ? current : null;
        });
        const accountBundle = await readNativeAccountBundle(dir, "wx_bot_2");
        await provider.close();

        assert.equal(state.botToken, undefined);
        assert.equal(state.connected, false);
        assert.equal(state.linked, false);
        assert.equal(state.running, true);
        assert.equal(state.sessionPausedUntil, undefined);
        assert.equal(typeof state.qrDataUrl, "string");
        assert.equal(typeof state.pairingCode, "string");
        assert.equal(accountBundle.record.botToken, "saved-bot-token");
        assert.equal(accountBundle.index.activeAccountId, "wx_bot_2");
      });
    });
  });

  await runTest("Native provider starts fresh QR reauth when sendmessage returns session-expired", async () => {
    await withTempDir(async (dir) => {
      const provider = new NativeWeChatChannelProvider(dir, async () => ({ accepted: true, reply: "ok" }));
      await sleep(20);
      await provider.writeState({
        providerMode: "native",
        configured: true,
        linked: true,
        running: true,
        connected: true,
        activeAccountId: "wx_bot_4",
        accountId: "wx_bot_4",
        accountName: "Native Bot",
        botToken: "saved-bot-token",
        baseUrl: "https://unit.test",
        contextTokens: {
          "wx-user-1": "ctx-1"
        },
        updatedAt: new Date().toISOString(),
        messages: []
      });

      await withFetchStub(async (url) => {
        const href = String(url);
        if (href.includes("sendmessage")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({ errcode: -14, errmsg: "session expired" })
          };
        }
        if (href.includes("get_bot_qrcode")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({
              qrcode: "reauth-send-qrcode-1",
              qrcode_img_content: "reauth-send-qr-content-1"
            })
          };
        }
        if (href.includes("get_qrcode_status")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({ status: "wait" })
          };
        }
        throw new Error(`Unexpected fetch URL: ${href}`);
      }, async () => {
        await assert.rejects(
          () => provider.receiveManualMessage({ senderId: "wx-user-1", text: "ping" }),
          /fresh QR code/i
        );
        const state = await waitFor(async () => {
          const current = await provider.readState();
          return current.qrDataUrl ? current : null;
        });
        const accountBundle = await readNativeAccountBundle(dir, "wx_bot_4");
        await provider.close();

        assert.equal(state.botToken, undefined);
        assert.equal(state.connected, false);
        assert.equal(state.linked, false);
        assert.equal(state.sessionPausedUntil, undefined);
        assert.equal(typeof state.qrDataUrl, "string");
        assert.equal(accountBundle.record.botToken, "saved-bot-token");
        assert.equal(accountBundle.context["wx-user-1"], "ctx-1");
      });
    });
  });

  await runTest("Native provider refreshes QR codes during login wait", async () => {
    await withTempDir(async (dir) => {
      const fetchLog = [];
      await withFetchStub(async (url) => {
        const href = String(url);
        fetchLog.push(href);

        if (href.includes("get_bot_qrcode")) {
          const nextIndex = fetchLog.filter((entry) => entry.includes("get_bot_qrcode")).length;
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({
              qrcode: `qrcode-${nextIndex}`,
              qrcode_img_content: `qr-content-${nextIndex}`
            })
          };
        }

        if (href.includes("get_qrcode_status") && href.includes("qrcode-1")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({ status: "expired" })
          };
        }

        if (href.includes("get_qrcode_status") && href.includes("qrcode-2")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({
              status: "confirmed",
              bot_token: "fresh-bot-token",
              ilink_bot_id: "wx_bot_5",
              baseurl: "https://unit.test",
              ilink_user_id: "wx-user-5"
            })
          };
        }

        throw new Error(`Unexpected fetch URL: ${href}`);
      }, async () => {
        const provider = new NativeWeChatChannelProvider(dir, async () => ({ accepted: true, reply: "ok" }));
        const loginStart = await provider.startLogin(false);
        assert.equal(loginStart.connected, false);
        const status = await provider.completeLogin("Native Bot");
        const state = await provider.readState();
        const providerState = await readNativeProviderState(dir);
        const accountBundle = await readNativeAccountBundle(dir, "wx_bot_5");
        await provider.close();

        assert.equal(status.connected, true);
        assert.equal(state.botToken, "fresh-bot-token");
        assert.equal(state.accountId, "wx_bot_5");
        assert.equal(providerState.activeAccountId, "wx_bot_5");
        assert.equal(accountBundle.record.botToken, "fresh-bot-token");
        assert.equal(accountBundle.record.userId, "wx-user-5");
        assert.equal(fetchLog.filter((entry) => entry.includes("get_bot_qrcode")).length, 2);
        assert.equal(state.messages.some((message) => message.text.includes("Refreshed native WeChat QR code")), true);
      });
    });
  });

  await runTest("Native provider starts login control loop on startup and connects in background", async () => {
    await withTempDir(async (dir) => {
      const fetchLog = [];
      await withFetchStub(async (url) => {
        const href = String(url);
        fetchLog.push(href);

        if (href.includes("get_bot_qrcode")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({
              qrcode: "startup-qrcode-1",
              qrcode_img_content: "startup-qr-content-1"
            })
          };
        }

        if (href.includes("get_qrcode_status") && href.includes("startup-qrcode-1")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({
              status: "confirmed",
              bot_token: "startup-bot-token",
              ilink_bot_id: "wx_bot_startup",
              baseurl: "https://unit.test",
              ilink_user_id: "wx-user-startup"
            })
          };
        }

        if (href.includes("getupdates")) {
          return {
            ok: true,
            headers: { get: () => null },
            text: async () => JSON.stringify({ ret: 0, msgs: [], get_updates_buf: "startup-sync-buf" })
          };
        }

        throw new Error(`Unexpected fetch URL: ${href}`);
      }, async () => {
        const provider = new NativeWeChatChannelProvider(dir, async () => ({ accepted: true, reply: "ok" }));
        await provider.start();
        const state = await waitFor(async () => {
          const current = await provider.readState();
          return current.connected ? current : null;
        });
        const accountBundle = await waitFor(async () => {
          try {
            return await readNativeAccountBundle(dir, "wx_bot_startup");
          } catch {
            return null;
          }
        });
        await provider.close();

        assert.equal(fetchLog.some((entry) => entry.includes("get_bot_qrcode")), true);
        assert.equal(fetchLog.some((entry) => entry.includes("get_qrcode_status")), true);
        assert.equal(state.connected, true);
        assert.equal(state.botToken, "startup-bot-token");
        assert.equal(state.accountId, "wx_bot_startup");
        assert.equal(state.pairingCode, undefined);
        assert.equal(accountBundle.record.botToken, "startup-bot-token");
      });
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
