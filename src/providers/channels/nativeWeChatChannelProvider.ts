import { randomUUID } from "node:crypto";

import QRCode from "qrcode";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NativeWeChatAccountStore, type NativeWeChatAccountState } from "./nativeWeChatAccountStore.js";

import type {
  WeChatChannelStatus,
  WeChatInboundResult,
  WeChatLoginStartResult,
  WeChatMessage
} from "../../types/channels.js";

const FIXED_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_ILINK_BOT_TYPE = "3";
const ACTIVE_LOGIN_TTL_MS = 5 * 60_000;
const GET_QRCODE_TIMEOUT_MS = 5_000;
const QR_LONG_POLL_TIMEOUT_MS = 35_000;
const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
const DEFAULT_API_TIMEOUT_MS = 15_000;
const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_QR_REFRESH_COUNT = 3;
const CLIENT_VERSION = "2.1.1";
const ILINK_APP_ID = "bot";
const UNSUPPORTED_MEDIA_REPLY = "\u5f53\u524d\u4ec5\u652f\u6301\u6587\u672c\u547d\u4ee4\u3002\u8bf7\u53d1\u9001 /research\u3001/memory \u6216 /remember\u3002";
const INBOUND_DEDUP_TTL_MS = 15_000;

interface NativeWeChatState {
  providerMode: "native";
  autoLoginEnabled: boolean;
  configured: boolean;
  linked: boolean;
  running: boolean;
  connected: boolean;
  pairingCode?: string | undefined;
  qrDataUrl?: string | undefined;
  activeAccountId?: string | undefined;
  accountId?: string | undefined;
  accountName?: string | undefined;
  botToken?: string | undefined;
  baseUrl: string;
  userId?: string | undefined;
  getUpdatesBuf?: string | undefined;
  sessionPausedUntil?: string | undefined;
  tokenInvalidatedAt?: string | undefined;
  contextTokens: Record<string, string>;
  lastMessage?: string | undefined;
  lastError?: string | undefined;
  updatedAt: string;
  messages: WeChatMessage[];
}

interface ActiveLogin {
  sessionKey: string;
  qrcode: string;
  qrcodeContent: string;
  startedAt: number;
  currentApiBaseUrl: string;
}

interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface StatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired" | "scaned_but_redirect";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
  redirect_host?: string;
}

interface TextItem {
  text?: string;
}

interface VoiceItem {
  text?: string;
}

interface MessageItem {
  type?: number;
  text_item?: TextItem;
  voice_item?: VoiceItem;
}

interface WeixinMessage {
  from_user_id?: string;
  message_type?: number;
  item_list?: MessageItem[];
  context_token?: string;
}

interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

interface SendMessageResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
}

export interface NativeWeChatCommandHandler {
  (input: { senderId: string; senderName?: string | undefined; text: string }): Promise<WeChatInboundResult>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildClientVersion(version: string): number {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

function buildBaseInfo() {
  return {
    channel_version: CLIENT_VERSION,
  };
}

function buildCommonHeaders(): Record<string, string> {
  return {
    "iLink-App-Id": ILINK_APP_ID,
    "iLink-App-ClientVersion": String(buildClientVersion(CLIENT_VERSION)),
  };
}

function buildHeaders(body: string, token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf8")),
    "X-WECHAT-UIN": Buffer.from(String(randomUUID().length), "utf8").toString("base64"),
    ...buildCommonHeaders(),
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function trimMessages(messages: WeChatMessage[]): WeChatMessage[] {
  return messages.slice(-80);
}

function normalizeContextTokens(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}
function hasSavedBotToken(state: Pick<NativeWeChatState, "botToken">): boolean {
  return Boolean(state.botToken?.trim());
}

function getSessionPauseRemainingMs(
  state: Pick<NativeWeChatState, "sessionPausedUntil"> | { sessionPausedUntil?: string | undefined }
): number {
  const value = state.sessionPausedUntil?.trim();
  if (!value) {
    return 0;
  }

  const until = Date.parse(value);
  if (!Number.isFinite(until)) {
    return 0;
  }

  return Math.max(0, until - Date.now());
}

function buildSessionCooldownErrorMessage(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `WeChat session is cooling down. ReAgent will retry automatically in about ${minutes} minute(s).`;
}

function isSessionExpiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(String(SESSION_EXPIRED_ERRCODE)) || /session expired/iu.test(message);
}

function defaultState(): NativeWeChatState {
  return {
    providerMode: "native",
    autoLoginEnabled: true,
    configured: false,
    linked: false,
    running: false,
    connected: false,
    baseUrl: FIXED_BASE_URL,
    contextTokens: {},
    updatedAt: nowIso(),
    messages: [],
  };
}

function normalizeState(parsed: Partial<NativeWeChatState>): NativeWeChatState {
  const botToken =
    typeof parsed.botToken === "string" && parsed.botToken.trim().length > 0
      ? parsed.botToken.trim()
      : undefined;
  const tokenInvalidatedAt =
    typeof parsed.tokenInvalidatedAt === "string" && parsed.tokenInvalidatedAt.trim().length > 0
      ? parsed.tokenInvalidatedAt.trim()
      : undefined;
  const sessionPausedUntil =
    typeof parsed.sessionPausedUntil === "string" && parsed.sessionPausedUntil.trim().length > 0
      ? parsed.sessionPausedUntil.trim()
      : undefined;
  const pauseRemainingMs = getSessionPauseRemainingMs({ sessionPausedUntil });
  const effectiveBotToken = tokenInvalidatedAt ? undefined : botToken;

  return {
    ...defaultState(),
    ...parsed,
    botToken: effectiveBotToken,
    autoLoginEnabled: typeof parsed.autoLoginEnabled === "boolean" ? parsed.autoLoginEnabled : true,
    configured: Boolean(parsed.configured || parsed.pairingCode || parsed.qrDataUrl || effectiveBotToken),
    linked: Boolean(effectiveBotToken),
    running: Boolean(parsed.running && (effectiveBotToken || parsed.pairingCode || parsed.qrDataUrl)),
    connected: Boolean(parsed.connected && effectiveBotToken && pauseRemainingMs === 0),
    ...(sessionPausedUntil ? { sessionPausedUntil } : {}),
    ...(tokenInvalidatedAt ? { tokenInvalidatedAt } : {}),
    contextTokens:
      parsed.contextTokens && typeof parsed.contextTokens === "object" ? parsed.contextTokens : {},
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
  };
}

function isFreshLogin(activeLogin: ActiveLogin | null): boolean {
  return Boolean(activeLogin && Date.now() - activeLogin.startedAt < ACTIVE_LOGIN_TTL_MS);
}

function appendMessage(state: NativeWeChatState, message: WeChatMessage): NativeWeChatState {
  return {
    ...state,
    messages: trimMessages([...state.messages, message]),
  };
}

async function resolveQrDataUrl(qrContent: string): Promise<string | undefined> {
  const trimmed = qrContent.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("data:image")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(trimmed, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.startsWith("image/")) {
        const bytes = Buffer.from(await response.arrayBuffer());
        return `data:${contentType};base64,${bytes.toString("base64")}`;
      }
    } catch {
      // Fall through and encode the URL itself as QR content.
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  try {
    return await QRCode.toDataURL(trimmed, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 280,
    });
  } catch {
    return undefined;
  }
}

function extractBody(itemList?: MessageItem[]): string {
  if (!itemList?.length) {
    return "";
  }

  for (const item of itemList) {
    if (item.type === 1 && item.text_item?.text) {
      return item.text_item.text;
    }
    if (item.type === 3 && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }

  return "";
}

function hasMedia(itemList?: MessageItem[]): boolean {
  return Boolean(itemList?.some((item) => item.type && item.type !== 1));
}

function buildInboundDedupFingerprint(params: {
  senderId: string;
  effectiveText: string;
  contextToken?: string | undefined;
  messageType?: number | undefined;
  itemList?: MessageItem[] | undefined;
}): string {
  const itemSignature = JSON.stringify(
    (params.itemList ?? []).map((item) => ({
      type: item.type ?? null,
      text: item.text_item?.text ?? "",
      voice: item.voice_item?.text ?? "",
    })),
  );
  return [
    params.senderId.trim(),
    params.contextToken?.trim() ?? "",
    String(params.messageType ?? ""),
    params.effectiveText,
    itemSignature,
  ].join("\u241f");
}

async function apiGetFetch(params: {
  baseUrl: string;
  endpoint: string;
  timeoutMs: number;
  label: string;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await fetch(new URL(params.endpoint, ensureTrailingSlash(params.baseUrl)).toString(), {
      method: "GET",
      headers: buildCommonHeaders(),
      signal: controller.signal,
    });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`${params.label} ${response.status}: ${rawText}`);
    }
    return rawText;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function apiPostFetch(params: {
  baseUrl: string;
  endpoint: string;
  body: string;
  token?: string;
  timeoutMs: number;
  label: string;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await fetch(new URL(params.endpoint, ensureTrailingSlash(params.baseUrl)).toString(), {
      method: "POST",
      headers: buildHeaders(params.body, params.token),
      body: params.body,
      signal: controller.signal,
    });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`${params.label} ${response.status}: ${rawText}`);
    }
    return rawText;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function fetchQRCode(baseUrl: string): Promise<QRCodeResponse> {
  const rawText = await apiGetFetch({
    baseUrl,
    endpoint: `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(DEFAULT_ILINK_BOT_TYPE)}`,
    timeoutMs: GET_QRCODE_TIMEOUT_MS,
    label: "fetchQRCode",
  });
  return JSON.parse(rawText) as QRCodeResponse;
}

async function pollQRStatus(baseUrl: string, qrcode: string): Promise<StatusResponse> {
  try {
    const rawText = await apiGetFetch({
      baseUrl,
      endpoint: `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
      timeoutMs: QR_LONG_POLL_TIMEOUT_MS,
      label: "pollQRStatus",
    });
    return JSON.parse(rawText) as StatusResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "wait" };
    }
    return { status: "wait" };
  }
}

async function getUpdates(params: {
  baseUrl: string;
  token: string;
  getUpdatesBuf?: string;
  timeoutMs?: number;
}): Promise<GetUpdatesResp> {
  try {
    const rawText = await apiPostFetch({
      baseUrl: params.baseUrl,
      endpoint: "ilink/bot/getupdates",
      body: JSON.stringify({
        get_updates_buf: params.getUpdatesBuf ?? "",
        base_info: buildBaseInfo(),
      }),
      token: params.token,
      timeoutMs: params.timeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS,
      label: "getUpdates",
    });
    return JSON.parse(rawText) as GetUpdatesResp;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ret: 0, msgs: [], ...(params.getUpdatesBuf ? { get_updates_buf: params.getUpdatesBuf } : {}) };
    }
    throw error;
  }
}

function assertSuccessfulApiResponse(
  label: string,
  payload: { ret?: number; errcode?: number; errmsg?: string }
): void {
  const code = payload.errcode ?? payload.ret ?? 0;
  if (code && code !== 0) {
    throw new Error(`${label} errcode ${code}: ${payload.errmsg?.trim() || "upstream request failed"}`);
  }
}

async function sendTextMessage(params: {
  baseUrl: string;
  token: string;
  toUserId: string;
  text: string;
  contextToken?: string;
}): Promise<string> {
  const clientId = `reagent-wechat-${randomUUID()}`;
  const rawText = await apiPostFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify({
      msg: {
        from_user_id: "",
        to_user_id: params.toUserId,
        client_id: clientId,
        message_type: 2,
        message_state: 2,
        ...(params.contextToken ? { context_token: params.contextToken } : {}),
        item_list: [
          {
            type: 1,
            text_item: { text: params.text },
          },
        ],
      },
      base_info: buildBaseInfo(),
    }),
    token: params.token,
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
    label: "sendMessage",
  });

  if (!rawText.trim()) {
    return clientId;
  }

  const response = JSON.parse(rawText) as SendMessageResp;
  assertSuccessfulApiResponse("sendMessage", response);
  return clientId;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutHandle);
        reject(new Error("aborted"));
      },
      { once: true }
    );
  });
}

export class NativeWeChatChannelProvider {
  private readonly statePath: string;
  private readonly accountStore: NativeWeChatAccountStore;
  private readonly recentInboundFingerprints = new Map<string, number>();
  private closed = false;
  private activeLogin: ActiveLogin | null = null;
  private monitorAbortController: AbortController | null = null;
  private monitorStopPromise: Promise<void> | null = null;
  private loginAbortController: AbortController | null = null;
  private loginStopPromise: Promise<void> | null = null;
  private pendingLoginDisplayName: string | undefined;

  constructor(
    workspaceDir: string,
    private readonly onCommand: NativeWeChatCommandHandler
  ) {
    this.statePath = path.join(workspaceDir, "channels", "wechat-native-state.json");
    this.accountStore = new NativeWeChatAccountStore(workspaceDir);
    void this.resumeMonitorIfNeeded();
  }

  async start(): Promise<void> {
    this.closed = false;
    await this.resumeMonitorIfNeeded();
    await this.resumeLoginIfNeeded();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.activeLogin = null;
    this.stopMonitor();
    this.stopLoginMonitor();
    await this.monitorStopPromise?.catch(() => undefined);
    await this.loginStopPromise?.catch(() => undefined);
  }

  private async readPersistedStateFile(): Promise<Partial<NativeWeChatState>> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return JSON.parse(raw) as Partial<NativeWeChatState>;
    } catch {
      return {};
    }
  }

  private async migrateLegacyAccountState(parsed: Partial<NativeWeChatState>): Promise<void> {
    const accountId = parsed.activeAccountId?.trim() || parsed.accountId?.trim();
    if (!accountId) {
      return;
    }

    const legacyContextTokens = normalizeContextTokens(parsed.contextTokens);
    const hasLegacyPayload = Boolean(
      parsed.botToken?.trim() ||
      parsed.accountName?.trim() ||
      parsed.userId?.trim() ||
      parsed.getUpdatesBuf?.trim() ||
      Object.keys(legacyContextTokens).length > 0 ||
      (parsed.baseUrl?.trim() && parsed.baseUrl.trim() !== FIXED_BASE_URL)
    );

    if (!hasLegacyPayload) {
      await this.accountStore.setActiveAccountId(accountId);
      return;
    }

    await this.accountStore.writeAccount(
      {
        accountId,
        ...(parsed.accountName?.trim() ? { accountName: parsed.accountName.trim() } : {}),
        ...(parsed.botToken?.trim() ? { botToken: parsed.botToken.trim() } : {}),
        ...(parsed.baseUrl?.trim() ? { baseUrl: parsed.baseUrl.trim() } : {}),
        ...(parsed.userId?.trim() ? { userId: parsed.userId.trim() } : {}),
        ...(parsed.getUpdatesBuf?.trim() ? { getUpdatesBuf: parsed.getUpdatesBuf.trim() } : {}),
        contextTokens: legacyContextTokens,
      },
      { setActive: true }
    );
  }

  private buildPersistedStateFile(state: NativeWeChatState): Partial<NativeWeChatState> {
    const activeAccountId = state.activeAccountId?.trim() || state.accountId?.trim() || undefined;
    return {
      providerMode: state.providerMode,
      autoLoginEnabled: state.autoLoginEnabled,
      configured: state.configured,
      linked: state.linked,
      running: state.running,
      connected: state.connected,
      pairingCode: state.pairingCode,
      qrDataUrl: state.qrDataUrl,
      activeAccountId,
      accountId: activeAccountId,
      accountName: state.accountName,
      sessionPausedUntil: state.sessionPausedUntil,
      tokenInvalidatedAt: state.tokenInvalidatedAt,
      lastMessage: state.lastMessage,
      lastError: state.lastError,
      updatedAt: nowIso(),
      messages: state.messages,
    };
  }

  private async readState(): Promise<NativeWeChatState> {
    const parsed = await this.readPersistedStateFile();
    await this.migrateLegacyAccountState(parsed);

    const activeAccountId = parsed.activeAccountId?.trim() || parsed.accountId?.trim() || (await this.accountStore.getActiveAccountId());
    const activeAccount = activeAccountId ? await this.accountStore.readActiveAccount(activeAccountId) : null;

    return normalizeState({
      ...parsed,
      activeAccountId: activeAccount?.accountId ?? activeAccountId,
      accountId: activeAccount?.accountId ?? activeAccountId,
      accountName: activeAccount?.accountName ?? parsed.accountName,
      botToken: activeAccount?.botToken ?? parsed.botToken,
      baseUrl: activeAccount?.baseUrl ?? parsed.baseUrl ?? FIXED_BASE_URL,
      userId: activeAccount?.userId ?? parsed.userId,
      getUpdatesBuf: activeAccount?.getUpdatesBuf ?? parsed.getUpdatesBuf,
      contextTokens: activeAccount?.contextTokens ?? normalizeContextTokens(parsed.contextTokens),
    });
  }

  private async writeState(state: NativeWeChatState): Promise<void> {
    const previousPersistedState = await this.readPersistedStateFile();
    const previousActiveAccountId =
      previousPersistedState.activeAccountId?.trim() ||
      previousPersistedState.accountId?.trim() ||
      (await this.accountStore.getActiveAccountId());
    const nextActiveAccountId = state.activeAccountId?.trim() || state.accountId?.trim() || undefined;

    if (nextActiveAccountId) {
      const accountState: NativeWeChatAccountState = {
        accountId: nextActiveAccountId,
        ...(state.accountName?.trim() ? { accountName: state.accountName.trim() } : {}),
        ...(state.botToken?.trim() ? { botToken: state.botToken.trim() } : {}),
        ...(state.baseUrl?.trim() ? { baseUrl: state.baseUrl.trim() } : {}),
        ...(state.userId?.trim() ? { userId: state.userId.trim() } : {}),
        ...(state.getUpdatesBuf?.trim() ? { getUpdatesBuf: state.getUpdatesBuf.trim() } : {}),
        contextTokens: state.contextTokens,
      };
      await this.accountStore.writeAccount(accountState, { setActive: true });
    } else if (previousActiveAccountId) {
      await this.accountStore.clearAccount(previousActiveAccountId);
    }

    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(
      this.statePath,
      `${JSON.stringify(this.buildPersistedStateFile({ ...state, ...(nextActiveAccountId ? { activeAccountId: nextActiveAccountId } : {}) }), null, 2)}\n`,
      "utf8"
    );
  }

  private async mutate(
    mutator: (state: NativeWeChatState) => NativeWeChatState | Promise<NativeWeChatState>
  ): Promise<NativeWeChatState> {
    if (this.closed) {
      return this.readState().catch(() => defaultState());
    }
    const next = await mutator(await this.readState());
    if (this.closed) {
      return next;
    }
    await this.writeState(next);
    return this.readState();
  }

  private async resumeMonitorIfNeeded(): Promise<void> {
    if (this.closed) {
      return;
    }
    const state = await this.readState();
    if (hasSavedBotToken(state)) {
      this.startMonitor();
    }
  }

  private async resumeLoginIfNeeded(): Promise<void> {
    if (this.closed) {
      return;
    }
    const state = await this.readState();
    if (hasSavedBotToken(state) || state.autoLoginEnabled === false) {
      return;
    }

    await this.ensureLoginSession({
      force: false,
      emitSystemMessage: false,
    });
    this.startLoginMonitor();
  }

  private startMonitor(): void {
    if (this.closed || this.monitorAbortController) {
      return;
    }

    this.monitorAbortController = new AbortController();
    this.monitorStopPromise = this.monitorLoop(this.monitorAbortController.signal).finally(() => {
      this.monitorAbortController = null;
      this.monitorStopPromise = null;
    });
  }

  private stopMonitor(): void {
    this.monitorAbortController?.abort();
    this.monitorAbortController = null;
  }

  private startLoginMonitor(): void {
    if (this.closed || this.loginAbortController) {
      return;
    }

    this.loginAbortController = new AbortController();
    this.loginStopPromise = this.loginMonitorLoop(this.loginAbortController.signal).finally(() => {
      this.loginAbortController = null;
      this.loginStopPromise = null;
    });
  }

  private stopLoginMonitor(): void {
    this.loginAbortController?.abort();
    this.loginAbortController = null;
  }

  private markInboundFingerprint(fingerprint: string): void {
    const now = Date.now();
    for (const [key, seenAt] of this.recentInboundFingerprints) {
      if (now - seenAt > INBOUND_DEDUP_TTL_MS) {
        this.recentInboundFingerprints.delete(key);
      }
    }
    this.recentInboundFingerprints.set(fingerprint, now);
  }

  private isDuplicateInboundFingerprint(fingerprint: string): boolean {
    const seenAt = this.recentInboundFingerprints.get(fingerprint);
    if (!seenAt) {
      return false;
    }
    return Date.now() - seenAt <= INBOUND_DEDUP_TTL_MS;
  }

  private async ensureLoginSession(options: {
    force: boolean;
    emitSystemMessage: boolean;
    displayName?: string | undefined;
  }): Promise<WeChatLoginStartResult> {
    const displayName = options.displayName?.trim();
    if (displayName) {
      this.pendingLoginDisplayName = displayName;
    }

    if (!options.force && isFreshLogin(this.activeLogin)) {
      const state = await this.mutate((current) => ({
        ...current,
        autoLoginEnabled: true,
        configured: true,
        running: true,
      }));
      return {
        message: state.lastMessage ?? "QR login is already waiting for scan.",
        pairingCode: state.pairingCode,
        qrDataUrl: state.qrDataUrl,
        connected: false,
        providerMode: "native",
      };
    }

    const qrResponse = await fetchQRCode(FIXED_BASE_URL);
    this.activeLogin = {
      sessionKey: randomUUID(),
      qrcode: qrResponse.qrcode,
      qrcodeContent: qrResponse.qrcode_img_content,
      startedAt: Date.now(),
      currentApiBaseUrl: FIXED_BASE_URL,
    };

    const maybeQrDataUrl = qrResponse.qrcode_img_content.startsWith("data:image")
      ? qrResponse.qrcode_img_content
      : await resolveQrDataUrl(qrResponse.qrcode_img_content);

    await this.mutate((current) => {
      const nextState = {
        ...current,
        autoLoginEnabled: true,
        configured: true,
        linked: false,
        running: true,
        connected: false,
        pairingCode: qrResponse.qrcode_img_content,
        qrDataUrl: maybeQrDataUrl,
        sessionPausedUntil: undefined,
        lastError: undefined,
        lastMessage: "WeChat QR login started. Scan the code and then wait for confirmation.",
      } satisfies NativeWeChatState;

      if (!options.emitSystemMessage) {
        return nextState;
      }

      return appendMessage(nextState, {
        id: randomUUID(),
        direction: "system",
        text: "Started native WeChat QR login.",
        createdAt: nowIso(),
      });
    });

    return {
      message: "WeChat QR login started. Scan the code and then wait for confirmation.",
      pairingCode: qrResponse.qrcode_img_content,
      qrDataUrl: maybeQrDataUrl,
      connected: false,
      providerMode: "native",
    };
  }

  private async waitForActiveLoginCompletion(options: {
    displayName?: string | undefined;
    deadlineAt: number;
    signal?: AbortSignal | undefined;
    allowContinuousRefresh: boolean;
  }): Promise<WeChatChannelStatus | null> {
    const requestedDisplayName = options.displayName?.trim();
    if (requestedDisplayName) {
      this.pendingLoginDisplayName = requestedDisplayName;
    }

    let qrRefreshCount = 0;

    while (!options.signal?.aborted && Date.now() < options.deadlineAt) {
      if (!isFreshLogin(this.activeLogin)) {
        await this.ensureLoginSession({
          force: true,
          emitSystemMessage: false,
          ...(requestedDisplayName ? { displayName: requestedDisplayName } : {}),
        });
        qrRefreshCount = 0;
      }

      const login = this.activeLogin;
      if (!login) {
        await sleep(1000, options.signal).catch(() => undefined);
        continue;
      }

      const status = await pollQRStatus(login.currentApiBaseUrl, login.qrcode);
      if (status.status === "scaned_but_redirect" && status.redirect_host) {
        this.activeLogin = {
          ...login,
          currentApiBaseUrl: `https://${status.redirect_host}`,
        };
        continue;
      }

      if (status.status === "expired") {
        qrRefreshCount += 1;
        if (!options.allowContinuousRefresh && qrRefreshCount > MAX_QR_REFRESH_COUNT) {
          this.activeLogin = null;
          await this.mutate((current) => ({
            ...current,
            autoLoginEnabled: true,
            running: false,
            connected: false,
            linked: false,
            pairingCode: undefined,
            qrDataUrl: undefined,
            lastError: "WeChat QR code expired too many times. Start pairing again.",
            lastMessage: "WeChat QR code expired too many times.",
          }));
          throw new Error("WeChat QR code expired too many times. Start pairing again.");
        }

        await this.ensureLoginSession({
          force: true,
          emitSystemMessage: false,
          ...(requestedDisplayName ? { displayName: requestedDisplayName } : {}),
        });
        if (options.allowContinuousRefresh && qrRefreshCount > MAX_QR_REFRESH_COUNT) {
          qrRefreshCount = 1;
        }
        await this.appendSystemMessage(`Refreshed native WeChat QR code (${qrRefreshCount}/${MAX_QR_REFRESH_COUNT}).`);
        continue;
      }

      if (status.status === "confirmed" && status.bot_token && status.ilink_bot_id) {
        const resolvedDisplayName = this.pendingLoginDisplayName?.trim() || requestedDisplayName;
        const connectedName = (resolvedDisplayName || status.ilink_bot_id || "native-wechat").trim();
        this.activeLogin = null;
        this.pendingLoginDisplayName = undefined;
        await this.mutate((current) =>
          appendMessage(
            {
              ...current,
              autoLoginEnabled: true,
              configured: true,
              linked: true,
              running: true,
              connected: true,
              pairingCode: undefined,
              qrDataUrl: undefined,
              botToken: status.bot_token,
              activeAccountId: status.ilink_bot_id,
              accountId: status.ilink_bot_id,
              accountName: connectedName || current.accountName || status.ilink_bot_id,
              baseUrl: status.baseurl?.trim() || FIXED_BASE_URL,
              userId: status.ilink_user_id?.trim() || current.userId,
              getUpdatesBuf: undefined,
              sessionPausedUntil: undefined,
              tokenInvalidatedAt: undefined,
              lastError: undefined,
              lastMessage: "Native WeChat connection established.",
            },
            {
              id: randomUUID(),
              direction: "system",
              text: `Connected native WeChat as ${connectedName}.`,
              createdAt: nowIso(),
            }
          )
        );
        this.startMonitor();
        return this.getStatus();
      }

      await sleep(1000, options.signal).catch(() => undefined);
    }

    if (options.signal?.aborted) {
      return null;
    }

    throw new Error("Timed out waiting for WeChat QR confirmation.");
  }

  private async loginMonitorLoop(signal: AbortSignal): Promise<void> {
    const deadlineAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    await this.waitForActiveLoginCompletion({
      deadlineAt,
      signal,
      allowContinuousRefresh: true,
      ...(this.pendingLoginDisplayName ? { displayName: this.pendingLoginDisplayName } : {}),
    }).catch((error) => {
      if (!signal.aborted) {
        void this.appendSystemMessage(
          `Native WeChat login monitor stopped: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return null;
    });
  }

  private async enterSessionCooldown(reason: string, appendSystemNote: boolean): Promise<void> {
    const pausedUntil = new Date(Date.now() + SESSION_COOLDOWN_MS).toISOString();
    const cooldownError = buildSessionCooldownErrorMessage(SESSION_COOLDOWN_MS);

    await this.mutate((current) => {
      const nextState = {
        ...current,
        configured: true,
        linked: hasSavedBotToken(current),
        running: true,
        connected: false,
        sessionPausedUntil: pausedUntil,
        lastError: cooldownError,
        lastMessage: reason,
      } satisfies NativeWeChatState;

      if (!appendSystemNote) {
        return nextState;
      }

      return appendMessage(nextState, {
        id: randomUUID(),
        direction: "system",
        text: `${reason} ReAgent will retry automatically after the cooldown window.`,
        createdAt: nowIso(),
      });
    });
  }

  private async enterSessionReauth(reason: string, appendSystemNote: boolean): Promise<void> {
    await this.mutate((current) => {
      const nextState = {
        ...current,
        autoLoginEnabled: true,
        configured: true,
        linked: false,
        running: true,
        connected: false,
        pairingCode: undefined,
        qrDataUrl: undefined,
        sessionPausedUntil: undefined,
        tokenInvalidatedAt: nowIso(),
        lastError: "WeChat session expired. Scan the new QR code to reconnect.",
        lastMessage: reason,
      } satisfies NativeWeChatState;

      if (!appendSystemNote) {
        return nextState;
      }

      return appendMessage(nextState, {
        id: randomUUID(),
        direction: "system",
        text: `${reason} ReAgent started a fresh QR login flow.`,
        createdAt: nowIso(),
      });
    });

    await this.ensureLoginSession({
      force: true,
      emitSystemMessage: false,
    });
    await this.mutate((current) => ({
      ...current,
      tokenInvalidatedAt: current.tokenInvalidatedAt ?? nowIso(),
    }));
    this.startLoginMonitor();
  }

  private async monitorLoop(signal: AbortSignal): Promise<void> {
    let nextTimeoutMs = DEFAULT_LONG_POLL_TIMEOUT_MS;

    while (!signal.aborted) {
      const state = await this.readState();
      if (!hasSavedBotToken(state)) {
        return;
      }

      const pauseRemainingMs = getSessionPauseRemainingMs(state);
      if (pauseRemainingMs > 0) {
        const cooldownError = buildSessionCooldownErrorMessage(pauseRemainingMs);
        if (state.connected || !state.running || state.lastError !== cooldownError) {
          await this.mutate((current) => ({
            ...current,
            configured: true,
            linked: hasSavedBotToken(current),
            running: true,
            connected: false,
            lastError: buildSessionCooldownErrorMessage(getSessionPauseRemainingMs(current)),
            lastMessage: "WeChat session expired. ReAgent will retry automatically.",
          }));
        }
        await sleep(Math.min(pauseRemainingMs, DEFAULT_LONG_POLL_TIMEOUT_MS), signal).catch(() => undefined);
        continue;
      }

      try {
        const response = await getUpdates({
          baseUrl: state.baseUrl,
          token: state.botToken!,
          ...(state.getUpdatesBuf ? { getUpdatesBuf: state.getUpdatesBuf } : {}),
          timeoutMs: nextTimeoutMs,
        });

        if ((response.errcode ?? response.ret) === SESSION_EXPIRED_ERRCODE) {
          await this.enterSessionReauth("WeChat session expired.", true);
          return;
        }

        if (response.longpolling_timeout_ms && response.longpolling_timeout_ms > 0) {
          nextTimeoutMs = response.longpolling_timeout_ms;
        }

        if (response.get_updates_buf || state.sessionPausedUntil || !state.connected || !state.running || state.lastError) {
          await this.mutate((current) => ({
            ...current,
            configured: true,
            linked: hasSavedBotToken(current),
            getUpdatesBuf: response.get_updates_buf,
            running: true,
            connected: true,
            sessionPausedUntil: undefined,
            lastError: undefined,
            lastMessage:
              current.sessionPausedUntil || !current.connected
                ? "Native WeChat transport connected."
                : current.lastMessage,
          }));
        }

        for (const message of response.msgs ?? []) {
          if (message.message_type === 2) {
            continue;
          }
          await this.handleInboundFromWeixinMessage(message);
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        if (isSessionExpiredError(error)) {
          await this.enterSessionReauth("WeChat session expired.", true);
          return;
        }
        await this.mutate((current) => ({
          ...current,
          configured: Boolean(current.configured || hasSavedBotToken(current)),
          linked: hasSavedBotToken(current),
          running: true,
          lastError: error instanceof Error ? error.message : String(error),
          lastMessage: "WeChat polling failed. Retrying.",
        }));
        await sleep(2000, signal).catch(() => undefined);
      }
    }
  }

  private async appendSystemMessage(text: string): Promise<void> {
    await this.mutate((current) =>
      appendMessage(current, {
        id: randomUUID(),
        direction: "system",
        text,
        createdAt: nowIso(),
      })
    );
  }

  private async handleInboundFromWeixinMessage(message: WeixinMessage): Promise<void> {
    const senderId = message.from_user_id?.trim();
    if (!senderId) {
      return;
    }

    const text = extractBody(message.item_list);
    const effectiveText = text || (hasMedia(message.item_list) ? "/unsupported-media" : "");
    if (!effectiveText) {
      return;
    }

    const fingerprint = buildInboundDedupFingerprint({
      senderId,
      effectiveText,
      contextToken: message.context_token,
      messageType: message.message_type,
      itemList: message.item_list,
    });
    if (this.isDuplicateInboundFingerprint(fingerprint)) {
      return;
    }
    this.markInboundFingerprint(fingerprint);

    const stateAfterInbound = await this.mutate((current) => {
      const nextTokens = { ...current.contextTokens };
      if (message.context_token?.trim()) {
        nextTokens[senderId] = message.context_token.trim();
      }
      return appendMessage(
        {
          ...current,
          contextTokens: nextTokens,
          lastMessage: `Inbound message received from ${senderId}.`,
          lastError: undefined,
          running: true,
        },
        {
          id: randomUUID(),
          direction: "inbound",
          senderId,
          text: effectiveText === "/unsupported-media" ? "[media]" : effectiveText,
          createdAt: nowIso(),
        }
      );
    });

    const result =
      effectiveText === "/unsupported-media"
        ? {
            accepted: true,
            reply: UNSUPPORTED_MEDIA_REPLY,
          }
        : await this.onCommand({ senderId, text: effectiveText });

    const contextToken = stateAfterInbound.contextTokens[senderId] ?? message.context_token;
    if (stateAfterInbound.botToken && contextToken) {
      try {
        const outboundId = await sendTextMessage({
          baseUrl: stateAfterInbound.baseUrl,
          token: stateAfterInbound.botToken,
          toUserId: senderId,
          text: result.reply,
          contextToken,
        });
        await this.mutate((current) =>
          appendMessage(
            {
              ...current,
              lastMessage: "Outbound reply sent to WeChat.",
              lastError: undefined,
              running: true,
            },
            {
              id: outboundId,
              direction: "outbound",
              senderId,
              text: result.reply,
              createdAt: nowIso(),
            }
          )
        );
      } catch (error) {
        if (isSessionExpiredError(error)) {
          await this.enterSessionReauth("WeChat session expired.", true);
        } else {
          await this.appendSystemMessage(`Failed to send outbound WeChat reply: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      await this.appendSystemMessage(`Skipped outbound reply for ${senderId}: missing context token.`);
    }
  }

  async getStatus(): Promise<WeChatChannelStatus> {
    let state = await this.readState();
    if (hasSavedBotToken(state)) {
      this.startMonitor();
    } else if (state.autoLoginEnabled) {
      await this.resumeLoginIfNeeded();
      state = await this.readState();
    }
    const pauseRemainingMs = getSessionPauseRemainingMs(state);
    const running = Boolean(state.running || (this.monitorAbortController && hasSavedBotToken(state)));
    const connected = Boolean(state.connected && pauseRemainingMs === 0 && hasSavedBotToken(state));
    return {
      providerMode: state.providerMode,
      configured: state.configured,
      linked: state.linked,
      running,
      connected,
      pairingCode: state.pairingCode,
      qrDataUrl: state.qrDataUrl,
      accountId: state.accountId,
      accountName: state.accountName,
      lastMessage: state.lastMessage,
      lastError: state.lastError,
      updatedAt: state.updatedAt,
      notes:
        pauseRemainingMs > 0
          ? [buildSessionCooldownErrorMessage(pauseRemainingMs)]
          : connected
            ? ["Native ReAgent WeChat transport is running."]
            : hasSavedBotToken(state)
              ? ["Native ReAgent WeChat has saved login state and will keep trying to reconnect."]
              : ["Native ReAgent WeChat transport is enabled."]
    };
  }

  async startLogin(force: boolean, displayName?: string): Promise<WeChatLoginStartResult> {
    const login = await this.ensureLoginSession({
      force,
      emitSystemMessage: true,
      ...(displayName?.trim() ? { displayName } : {}),
    });
    this.startLoginMonitor();
    return login;
  }

  async completeLogin(displayName?: string): Promise<WeChatChannelStatus> {
    await this.ensureLoginSession({
      force: false,
      emitSystemMessage: false,
      ...(displayName?.trim() ? { displayName } : {}),
    });
    if (this.loginAbortController) {
      const deadlineAt = Date.now() + 480_000;
      while (Date.now() < deadlineAt) {
        const state = await this.readState();
        if (state.connected && hasSavedBotToken(state)) {
          if (displayName?.trim() && state.accountName !== displayName.trim()) {
            await this.mutate((current) => ({
              ...current,
              accountName: displayName.trim(),
            }));
          }
          return this.getStatus();
        }
        await sleep(1000);
      }
      throw new Error("Timed out waiting for WeChat QR confirmation.");
    }

    const status = await this.waitForActiveLoginCompletion({
      deadlineAt: Date.now() + 480_000,
      allowContinuousRefresh: false,
      ...(displayName?.trim() ? { displayName } : {}),
    });
    if (!status) {
      throw new Error("Timed out waiting for WeChat QR confirmation.");
    }
    return status;
  }

  async logout(): Promise<WeChatChannelStatus> {
    this.activeLogin = null;
    this.stopMonitor();
    this.stopLoginMonitor();
    await this.mutate((current) =>
      appendMessage(
        {
          ...current,
          autoLoginEnabled: false,
          configured: false,
          linked: false,
          running: false,
          connected: false,
          pairingCode: undefined,
          qrDataUrl: undefined,
          botToken: undefined,
          activeAccountId: undefined,
          accountId: undefined,
          accountName: undefined,
          userId: undefined,
          getUpdatesBuf: undefined,
          sessionPausedUntil: undefined,
          tokenInvalidatedAt: undefined,
          contextTokens: {},
          lastError: undefined,
          lastMessage: "Native WeChat disconnected.",
        },
        {
          id: randomUUID(),
          direction: "system",
          text: "Disconnected native WeChat session.",
          createdAt: nowIso(),
        }
      )
    );
    return this.getStatus();
  }

  async listMessages(): Promise<WeChatMessage[]> {
    const state = await this.readState();
    return [...state.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async pushMessage(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    const state = await this.readState();
    const pauseRemainingMs = getSessionPauseRemainingMs(state);
    if (pauseRemainingMs > 0) {
      throw new Error(buildSessionCooldownErrorMessage(pauseRemainingMs));
    }
    if (!state.connected) {
      throw new Error("WeChat is not connected. Complete QR login before pushing messages.");
    }

    const contextToken = state.contextTokens[input.senderId];
    if (!state.botToken || !contextToken) {
      throw new Error(`Cannot push to ${input.senderId}: missing saved context token.`);
    }

    try {
      const outboundId = await sendTextMessage({
        baseUrl: state.baseUrl,
        token: state.botToken,
        toUserId: input.senderId,
        text: message,
        contextToken,
      });
      await this.mutate((current) =>
        appendMessage(
          {
            ...current,
            lastMessage: "Outbound push sent to WeChat.",
            lastError: undefined,
          },
          {
            id: outboundId,
            direction: "outbound",
            senderId: input.senderId,
            senderName: input.senderName,
            text: message,
            createdAt: nowIso(),
          }
        )
      );
    } catch (error) {
      if (isSessionExpiredError(error)) {
        await this.enterSessionReauth("WeChat session expired.", true);
        throw new Error("WeChat session expired. Scan the fresh QR code to reconnect.");
      }
      throw error;
    }

    return {
      accepted: true,
      reply: message,
    };
  }
  async receiveManualMessage(input: {
    senderId: string;
    senderName?: string | undefined;
    text: string;
  }): Promise<WeChatInboundResult> {
    const message = input.text.trim();
    const state = await this.readState();
    const pauseRemainingMs = getSessionPauseRemainingMs(state);
    if (pauseRemainingMs > 0) {
      throw new Error(buildSessionCooldownErrorMessage(pauseRemainingMs));
    }
    if (!state.connected) {
      throw new Error("WeChat is not connected. Complete QR login before sending messages.");
    }

    await this.mutate((current) =>
      appendMessage(
        {
          ...current,
          lastError: undefined,
          lastMessage: `Manual inbound message received from ${input.senderName?.trim() || input.senderId}.`,
        },
        {
          id: randomUUID(),
          direction: "inbound",
          senderId: input.senderId,
          senderName: input.senderName,
          text: message,
          createdAt: nowIso(),
        }
      )
    );

    const result = await this.onCommand(input);
    const latest = await this.readState();
    const contextToken = latest.contextTokens[input.senderId];

    if (latest.botToken && contextToken) {
      try {
        const outboundId = await sendTextMessage({
          baseUrl: latest.baseUrl,
          token: latest.botToken,
          toUserId: input.senderId,
          text: result.reply,
          contextToken,
        });
        await this.mutate((current) =>
          appendMessage(
            {
              ...current,
              lastMessage: "Outbound reply sent to WeChat.",
              lastError: undefined,
            },
            {
              id: outboundId,
              direction: "outbound",
              senderId: input.senderId,
              senderName: input.senderName,
              text: result.reply,
              createdAt: nowIso(),
            }
          )
        );
      } catch (error) {
        if (isSessionExpiredError(error)) {
          await this.enterSessionReauth("WeChat session expired.", true);
          throw new Error("WeChat session expired. Scan the fresh QR code to reconnect.");
        }
        throw error;
      }
    } else {
      await this.appendSystemMessage(`Manual reply not sent to ${input.senderId}: missing context token.`);
    }

    return result;
  }
}




