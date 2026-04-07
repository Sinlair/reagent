import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  WeChatChannelStatus,
  WeChatInboundResult,
  WeChatLoginStartResult,
  WeChatMessage,
  WeChatProviderMode
} from "../../types/channels.js";

interface MockWeChatState {
  providerMode: WeChatProviderMode;
  configured: boolean;
  linked: boolean;
  running: boolean;
  connected: boolean;
  pairingCode?: string | undefined;
  accountId?: string | undefined;
  accountName?: string | undefined;
  lastMessage?: string | undefined;
  lastError?: string | undefined;
  updatedAt: string;
  messages: WeChatMessage[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildPairingCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function defaultState(): MockWeChatState {
  return {
    providerMode: "mock",
    configured: true,
    linked: false,
    running: false,
    connected: false,
    updatedAt: nowIso(),
    messages: []
  };
}

export class MockWeChatChannelProvider {
  private readonly statePath: string;

  constructor(workspaceDir: string) {
    this.statePath = path.join(workspaceDir, "channels", "wechat-state.json");
  }

  async start(): Promise<void> {
    await this.readState();
  }

  async close(): Promise<void> {
    // No background resources to release for the mock provider.
  }

  private async readState(): Promise<MockWeChatState> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return { ...defaultState(), ...(JSON.parse(raw) as Partial<MockWeChatState>) };
    } catch {
      const state = defaultState();
      await this.writeState(state);
      return state;
    }
  }

  private async writeState(state: MockWeChatState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private async mutate(mutator: (state: MockWeChatState) => MockWeChatState | Promise<MockWeChatState>) {
    const nextState = await mutator(await this.readState());
    nextState.updatedAt = nowIso();
    await this.writeState(nextState);
    return nextState;
  }

  private trimMessages(messages: WeChatMessage[]): WeChatMessage[] {
    return messages.slice(-50);
  }

  async getStatus(): Promise<WeChatChannelStatus> {
    const state = await this.readState();
    return {
      providerMode: state.providerMode,
      configured: state.configured,
      linked: state.linked,
      running: state.running,
      connected: state.connected,
      pairingCode: state.pairingCode,
      accountId: state.accountId,
      accountName: state.accountName,
      lastMessage: state.lastMessage,
      lastError: state.lastError,
      updatedAt: state.updatedAt
    };
  }

  async startLogin(force: boolean): Promise<WeChatLoginStartResult> {
    const state = await this.mutate((current) => {
      if (current.connected && !force) {
        current.lastMessage = "WeChat is already connected.";
        return current;
      }

      return {
        ...current,
        linked: false,
        running: true,
        connected: false,
        pairingCode: buildPairingCode(),
        lastError: undefined,
        lastMessage:
          "Mock pairing started. In a real Tencent / plugin provider this step would expose a QR login flow.",
        messages: this.trimMessages([
          ...current.messages,
          {
            id: randomUUID(),
            direction: "system",
            text: "Started mock WeChat pairing flow.",
            createdAt: nowIso()
          }
        ])
      };
    });

    return {
      message: state.lastMessage ?? "Mock pairing started.",
      pairingCode: state.pairingCode,
      connected: state.connected,
      providerMode: state.providerMode
    };
  }

  async completeLogin(displayName?: string): Promise<WeChatChannelStatus> {
    const state = await this.mutate((current) => ({
      ...current,
      linked: true,
      running: true,
      connected: true,
      accountId: current.accountId ?? `wx_${randomUUID().slice(0, 8)}`,
      accountName: displayName?.trim() || current.accountName || "WeChat Operator",
      pairingCode: undefined,
      lastError: undefined,
      lastMessage: "Mock WeChat connection established.",
      messages: this.trimMessages([
        ...current.messages,
        {
          id: randomUUID(),
          direction: "system",
          text: `Connected as ${displayName?.trim() || current.accountName || "WeChat Operator"}.`,
          createdAt: nowIso()
        }
      ])
    }));

    return {
      providerMode: state.providerMode,
      configured: state.configured,
      linked: state.linked,
      running: state.running,
      connected: state.connected,
      pairingCode: state.pairingCode,
      accountId: state.accountId,
      accountName: state.accountName,
      lastMessage: state.lastMessage,
      lastError: state.lastError,
      updatedAt: state.updatedAt
    };
  }

  async logout(): Promise<WeChatChannelStatus> {
    const state = await this.mutate((current) => ({
      ...current,
      linked: false,
      running: false,
      connected: false,
      pairingCode: undefined,
      lastMessage: "WeChat disconnected.",
      messages: this.trimMessages([
        ...current.messages,
        {
          id: randomUUID(),
          direction: "system",
          text: "Disconnected WeChat session.",
          createdAt: nowIso()
        }
      ])
    }));

    return {
      providerMode: state.providerMode,
      configured: state.configured,
      linked: state.linked,
      running: state.running,
      connected: state.connected,
      pairingCode: state.pairingCode,
      accountId: state.accountId,
      accountName: state.accountName,
      lastMessage: state.lastMessage,
      lastError: state.lastError,
      updatedAt: state.updatedAt
    };
  }

  async listMessages(): Promise<WeChatMessage[]> {
    const state = await this.readState();
    return [...state.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async appendInbound(senderId: string, text: string, senderName?: string): Promise<WeChatMessage> {
    const message: WeChatMessage = {
      id: randomUUID(),
      direction: "inbound",
      senderId,
      senderName,
      text,
      createdAt: nowIso()
    };

    await this.mutate((current) => {
      if (!current.connected) {
        throw new Error("WeChat is not connected. Complete pairing before sending inbound messages.");
      }

      return {
        ...current,
        lastMessage: `Inbound message received from ${senderName?.trim() || senderId}.`,
        messages: this.trimMessages([...current.messages, message])
      };
    });

    return message;
  }

  async pushOutbound(senderId: string, text: string, senderName?: string): Promise<WeChatInboundResult> {
    const state = await this.readState();
    if (!state.connected) {
      throw new Error("WeChat is not connected. Complete pairing before pushing outbound messages.");
    }

    await this.mutate((current) => ({
      ...current,
      lastMessage: `Outbound push generated for ${senderName?.trim() || senderId}.`,
      messages: this.trimMessages([
        ...current.messages,
        {
          id: randomUUID(),
          direction: "outbound",
          senderId,
          senderName,
          text,
          createdAt: nowIso()
        }
      ])
    }));

    return {
      accepted: true,
      reply: text
    };
  }
  async appendOutbound(text: string): Promise<WeChatInboundResult> {
    await this.mutate((current) => ({
      ...current,
      lastMessage: "Outbound reply generated.",
      messages: this.trimMessages([
        ...current.messages,
        {
          id: randomUUID(),
          direction: "outbound",
          text,
          createdAt: nowIso()
        }
      ])
    }));

    return {
      accepted: true,
      reply: text
    };
  }
}
