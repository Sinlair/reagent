import { randomUUID } from "node:crypto";

const PROTOCOL_VERSION = 3;
const CONNECT_METHOD = "connect";
const CONNECT_CHALLENGE_EVENT = "connect.challenge";
const DEFAULT_TIMEOUT_MS = 15000;

interface GatewayConnectOptions {
  url: string;
  token?: string | undefined;
  password?: string | undefined;
  timeoutMs?: number | undefined;
}

interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

export interface OpenClawGatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

export interface OpenClawGatewaySubscription {
  close(): Promise<void>;
}

type GatewaySocket = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
};

function normalizeGatewayUrl(raw: string): string {
  if (raw.startsWith("http://")) {
    return `ws://${raw.slice("http://".length)}`;
  }
  if (raw.startsWith("https://")) {
    return `wss://${raw.slice("https://".length)}`;
  }
  return raw;
}

function buildConnectFrame(options: GatewayConnectOptions): RequestFrame {
  return {
    type: "req",
    id: randomUUID(),
    method: CONNECT_METHOD,
    params: {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: "openclaw-control-ui",
        displayName: "ReAgent OpenClaw Bridge",
        version: "0.1.0",
        platform: process.platform,
        mode: "ui"
      },
      caps: [],
      role: "operator",
      scopes: ["operator.admin"],
      auth:
        options.token || options.password
          ? {
              token: options.token,
              password: options.password
            }
          : undefined,
      locale: "zh-CN",
      userAgent: "reagent-oc-host-bridge",
      device: undefined,
      commands: undefined,
      permissions: undefined,
      pathEnv: process.env.PATH
    }
  };
}

export class OpenClawGatewayRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "OpenClawGatewayRequestError";
  }
}

export class OpenClawGatewayClient {
  private readonly url: string;
  private readonly token: string | undefined;
  private readonly password: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: GatewayConnectOptions) {
    this.url = normalizeGatewayUrl(options.url);
    this.token = options.token;
    this.password = options.password;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async subscribe(options: {
    subscriptions: Array<{ method: string; params?: unknown }>;
    onEvent: (event: OpenClawGatewayEventFrame) => void | Promise<void>;
    onClose?: ((details: { code?: number; reason?: unknown }) => void | Promise<void>) | undefined;
    onError?: ((error: Error) => void | Promise<void>) | undefined;
  }): Promise<OpenClawGatewaySubscription> {
    const WebSocketCtor = (globalThis as typeof globalThis & {
      WebSocket?: new (url: string) => GatewaySocket;
    }).WebSocket;

    if (!WebSocketCtor) {
      throw new Error("WebSocket is not available in this Node runtime");
    }

    const socket = new WebSocketCtor(this.url) as GatewaySocket;
    let connectRequestId = "";
    let currentSubscriptionId = "";
    let subscriptionIndex = 0;
    let ready = false;
    let settled = false;
    let closing = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    return new Promise<OpenClawGatewaySubscription>((resolve, reject) => {
      const normalizeError = (error: unknown): Error =>
        error instanceof Error ? error : new Error(String(error));

      const clearReadyTimeout = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      };

      const cleanup = () => {
        clearReadyTimeout();
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };

      const closeSocket = () => {
        cleanup();
        try {
          if (socket.readyState === 0 || socket.readyState === 1) {
            socket.close(1000, "done");
          }
        } catch {
          // ignore close failures
        }
      };

      const failBeforeReady = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        closeSocket();
        reject(normalizeError(error));
      };

      const emitError = (error: unknown) => {
        if (!ready) {
          failBeforeReady(error);
          return;
        }
        if (options.onError) {
          void Promise.resolve(options.onError(normalizeError(error))).catch(() => undefined);
        }
      };

      const send = (frame: RequestFrame) => {
        socket.send(JSON.stringify(frame));
      };

      const sendConnect = () => {
        const frame = buildConnectFrame({
          url: this.url,
          token: this.token,
          password: this.password,
          timeoutMs: this.timeoutMs,
        });
        connectRequestId = frame.id;
        send(frame);
      };

      const sendNextSubscription = () => {
        if (subscriptionIndex >= options.subscriptions.length) {
          ready = true;
          settled = true;
          clearReadyTimeout();
          resolve({
            close: async () => {
              if (closing) {
                return;
              }
              closing = true;
              closeSocket();
            },
          });
          return;
        }

        const next = options.subscriptions[subscriptionIndex]!;
        const frame: RequestFrame = {
          type: "req",
          id: randomUUID(),
          method: next.method,
          ...(next.params === undefined ? {} : { params: next.params }),
        };
        currentSubscriptionId = frame.id;
        send(frame);
      };

      timeoutHandle = setTimeout(() => {
        failBeforeReady(new Error(`OpenClaw gateway timeout while subscribing to ${options.subscriptions.map((entry) => entry.method).join(", ")}`));
      }, this.timeoutMs);

      const onMessage = (event: { data?: unknown }) => {
        try {
          const raw = typeof event.data === "string" ? event.data : String(event.data ?? "");
          const frame = JSON.parse(raw) as EventFrame | ResponseFrame;

          if (frame.type === "event" && frame.event === CONNECT_CHALLENGE_EVENT) {
            const nonce =
              frame.payload && typeof frame.payload === "object" && "nonce" in frame.payload
                ? String((frame.payload as { nonce?: unknown }).nonce ?? "")
                : "";
            if (!nonce) {
              failBeforeReady(new Error("OpenClaw gateway did not provide a connect nonce"));
              return;
            }
            sendConnect();
            return;
          }

          if (frame.type === "event") {
            if (!ready) {
              return;
            }
            void Promise.resolve(
              options.onEvent({
                type: "event",
                event: frame.event,
                payload: frame.payload,
              }),
            ).catch((error) => {
              emitError(error);
            });
            return;
          }

          if (frame.type !== "res") {
            return;
          }

          if (frame.id === connectRequestId) {
            if (!frame.ok) {
              failBeforeReady(
                new OpenClawGatewayRequestError(
                  frame.error?.message ?? "OpenClaw connect failed",
                  frame.error?.code,
                  frame.error?.details,
                ),
              );
              return;
            }
            sendNextSubscription();
            return;
          }

          if (frame.id === currentSubscriptionId) {
            if (!frame.ok) {
              failBeforeReady(
                new OpenClawGatewayRequestError(
                  frame.error?.message ?? `OpenClaw subscription failed for ${options.subscriptions[subscriptionIndex]?.method ?? "unknown"}`,
                  frame.error?.code,
                  frame.error?.details,
                ),
              );
              return;
            }
            subscriptionIndex += 1;
            sendNextSubscription();
          }
        } catch (error) {
          emitError(error);
        }
      };

      const onError = (event: unknown) => {
        const details = event as { error?: unknown; message?: string };
        emitError(details.error ?? new Error(details.message ?? "OpenClaw gateway subscription failed"));
      };

      const onClose = (event: unknown) => {
        const details = event as { code?: number; reason?: unknown };
        cleanup();
        if (!ready) {
          failBeforeReady(
            new Error(
              `OpenClaw gateway socket closed (${details.code ?? 0}): ${String(details.reason ?? "") || "unknown"}`,
            ),
          );
          return;
        }
        if (closing) {
          return;
        }
        if (options.onClose) {
          void Promise.resolve(options.onClose(details)).catch(() => undefined);
        }
      };

      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    const WebSocketCtor = (globalThis as typeof globalThis & {
      WebSocket?: new (url: string) => GatewaySocket;
    }).WebSocket;

    if (!WebSocketCtor) {
      throw new Error("WebSocket is not available in this Node runtime");
    }

    const socket = new WebSocketCtor(this.url) as GatewaySocket;
    const requestId = randomUUID();
    let connectRequestId = "";
    let settled = false;
    let connected = false;

    return new Promise<T>((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
        try {
          if (socket.readyState === 0 || socket.readyState === 1) {
            socket.close(1000, "done");
          }
        } catch {
          // ignore close failures
        }
      };

      const finish = (error: unknown, value?: T) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (error) {
          reject(error);
          return;
        }
        resolve(value as T);
      };

      timeoutHandle = setTimeout(() => {
        finish(new Error(`OpenClaw gateway timeout while calling ${method}`));
      }, this.timeoutMs);

      const send = (frame: RequestFrame) => {
        socket.send(JSON.stringify(frame));
      };

      const sendConnect = () => {
        const frame = buildConnectFrame({
          url: this.url,
          token: this.token,
          password: this.password,
          timeoutMs: this.timeoutMs
        });
        connectRequestId = frame.id;
        send(frame);
      };

      const sendRequest = () => {
        send({
          type: "req",
          id: requestId,
          method,
          params
        });
      };

      const onMessage = (event: { data?: unknown }) => {
        try {
          const raw = typeof event.data === "string" ? event.data : String(event.data ?? "");
          const frame = JSON.parse(raw) as EventFrame | ResponseFrame;

          if (frame.type === "event" && frame.event === CONNECT_CHALLENGE_EVENT) {
            const nonce =
              frame.payload && typeof frame.payload === "object" && "nonce" in frame.payload
                ? String((frame.payload as { nonce?: unknown }).nonce ?? "")
                : "";
            if (!nonce) {
              finish(new Error("OpenClaw gateway did not provide a connect nonce"));
              return;
            }
            sendConnect();
            return;
          }

          if (frame.type !== "res") {
            return;
          }

          if (frame.id === connectRequestId) {
            if (!frame.ok) {
              finish(
                new OpenClawGatewayRequestError(
                  frame.error?.message ?? "OpenClaw connect failed",
                  frame.error?.code,
                  frame.error?.details
                )
              );
              return;
            }
            connected = true;
            sendRequest();
            return;
          }

          if (frame.id !== requestId) {
            return;
          }

          if (!connected) {
            finish(new Error(`OpenClaw gateway responded to ${method} before connect completed`));
            return;
          }

          if (!frame.ok) {
            finish(
              new OpenClawGatewayRequestError(
                frame.error?.message ?? `OpenClaw request failed for ${method}`,
                frame.error?.code,
                frame.error?.details
              )
            );
            return;
          }

          finish(undefined, frame.payload as T);
        } catch (error) {
          finish(error);
        }
      };

      const onError = (event: unknown) => {
        const details = event as { error?: unknown; message?: string };
        finish(details.error ?? new Error(details.message ?? `OpenClaw gateway request failed for ${method}`));
      };

      const onClose = (event: unknown) => {
        if (!settled) {
          const details = event as { code?: number; reason?: unknown };
          finish(
            new Error(
              `OpenClaw gateway socket closed (${details.code ?? 0}): ${String(details.reason ?? "") || "unknown"}`
            )
          );
        }
      };

      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });
  }
}
