import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";

export interface NativeWeChatAccountState {
  accountId: string;
  accountName?: string | undefined;
  botToken?: string | undefined;
  baseUrl?: string | undefined;
  userId?: string | undefined;
  getUpdatesBuf?: string | undefined;
  contextTokens?: Record<string, string> | undefined;
}

interface NativeWeChatAccountIndex {
  updatedAt: string;
  activeAccountId?: string | undefined;
  accountIds: string[];
}

interface NativeWeChatAccountRecord {
  accountId: string;
  accountName?: string | undefined;
  botToken?: string | undefined;
  baseUrl: string;
  userId?: string | undefined;
  savedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeAccountKey(accountId: string): string {
  const trimmed = accountId.trim();
  if (!trimmed) {
    throw new Error("Native WeChat accountId is required.");
  }

  return trimmed.replace(/[\\/:*?"<>|]/g, "_");
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

export class NativeWeChatAccountStore {
  private readonly rootDir: string;
  private readonly accountsDir: string;
  private readonly indexPath: string;

  constructor(workspaceDir: string) {
    this.rootDir = path.join(workspaceDir, "channels", "wechat-native");
    this.accountsDir = path.join(this.rootDir, "accounts");
    this.indexPath = path.join(this.rootDir, "accounts.json");
  }

  private accountRecordPath(accountId: string): string {
    return path.join(this.accountsDir, `${safeAccountKey(accountId)}.json`);
  }

  private syncBufPath(accountId: string): string {
    return path.join(this.accountsDir, `${safeAccountKey(accountId)}.sync.json`);
  }

  private contextTokensPath(accountId: string): string {
    return path.join(this.accountsDir, `${safeAccountKey(accountId)}.context-tokens.json`);
  }

  private async readIndex(): Promise<NativeWeChatAccountIndex> {
    try {
      const raw = await readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<NativeWeChatAccountIndex>;
      return {
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
        activeAccountId:
          typeof parsed.activeAccountId === "string" && parsed.activeAccountId.trim().length > 0
            ? parsed.activeAccountId.trim()
            : undefined,
        accountIds: Array.isArray(parsed.accountIds)
          ? parsed.accountIds.filter((accountId): accountId is string => typeof accountId === "string" && accountId.trim().length > 0)
          : [],
      };
    } catch {
      return {
        updatedAt: nowIso(),
        accountIds: [],
      };
    }
  }

  private async writeIndex(index: NativeWeChatAccountIndex): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(
      this.indexPath,
      `${JSON.stringify({ ...index, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8"
    );
  }

  async getActiveAccountId(): Promise<string | undefined> {
    const index = await this.readIndex();
    return index.activeAccountId;
  }

  async setActiveAccountId(accountId?: string | undefined): Promise<void> {
    const index = await this.readIndex();
    const normalizedAccountId = accountId?.trim() || undefined;
    const nextIds = normalizedAccountId
      ? [...new Set([...index.accountIds, normalizedAccountId])]
      : [...index.accountIds];
    await this.writeIndex({
      ...index,
      activeAccountId: normalizedAccountId,
      accountIds: nextIds,
    });
  }

  async listAccountIds(): Promise<string[]> {
    const index = await this.readIndex();
    return [...index.accountIds];
  }

  async readAccount(accountId: string): Promise<NativeWeChatAccountState | null> {
    const normalizedAccountId = accountId.trim();
    if (!normalizedAccountId) {
      return null;
    }

    try {
      const rawRecord = await readFile(this.accountRecordPath(normalizedAccountId), "utf8");
      const record = JSON.parse(rawRecord) as Partial<NativeWeChatAccountRecord>;
      const syncRaw = await readFile(this.syncBufPath(normalizedAccountId), "utf8").catch(() => "{}");
      const syncPayload = JSON.parse(syncRaw) as { get_updates_buf?: unknown };
      const contextRaw = await readFile(this.contextTokensPath(normalizedAccountId), "utf8").catch(() => "{}");
      const contextPayload = JSON.parse(contextRaw) as Record<string, unknown>;

      return {
        accountId: typeof record.accountId === "string" && record.accountId.trim() ? record.accountId.trim() : normalizedAccountId,
        accountName:
          typeof record.accountName === "string" && record.accountName.trim().length > 0
            ? record.accountName.trim()
            : undefined,
        botToken:
          typeof record.botToken === "string" && record.botToken.trim().length > 0
            ? record.botToken.trim()
            : undefined,
        baseUrl:
          typeof record.baseUrl === "string" && record.baseUrl.trim().length > 0
            ? record.baseUrl.trim()
            : DEFAULT_BASE_URL,
        userId:
          typeof record.userId === "string" && record.userId.trim().length > 0 ? record.userId.trim() : undefined,
        getUpdatesBuf:
          typeof syncPayload.get_updates_buf === "string" && syncPayload.get_updates_buf.trim().length > 0
            ? syncPayload.get_updates_buf.trim()
            : undefined,
        contextTokens: normalizeContextTokens(contextPayload),
      };
    } catch {
      return null;
    }
  }

  async readActiveAccount(activeAccountId?: string | undefined): Promise<NativeWeChatAccountState | null> {
    const selectedAccountId = activeAccountId?.trim() || (await this.getActiveAccountId()) || "";
    if (!selectedAccountId) {
      return null;
    }
    return this.readAccount(selectedAccountId);
  }

  async writeAccount(state: NativeWeChatAccountState, options: { setActive?: boolean } = {}): Promise<void> {
    const accountId = state.accountId.trim();
    if (!accountId) {
      throw new Error("Native WeChat accountId is required.");
    }

    const previous = (await this.readAccount(accountId)) ?? {
      accountId,
      baseUrl: DEFAULT_BASE_URL,
      contextTokens: {},
    };

    const record: NativeWeChatAccountRecord = {
      accountId,
      ...(state.accountName?.trim() ? { accountName: state.accountName.trim() } : previous.accountName ? { accountName: previous.accountName } : {}),
      ...(state.botToken?.trim() ? { botToken: state.botToken.trim() } : previous.botToken ? { botToken: previous.botToken } : {}),
      baseUrl: state.baseUrl?.trim() || previous.baseUrl || DEFAULT_BASE_URL,
      ...(state.userId?.trim() ? { userId: state.userId.trim() } : previous.userId ? { userId: previous.userId } : {}),
      savedAt: nowIso(),
    };

    const nextGetUpdatesBuf = state.getUpdatesBuf?.trim() || previous.getUpdatesBuf;
    const nextContextTokens = {
      ...previous.contextTokens,
      ...normalizeContextTokens(state.contextTokens),
    };

    await mkdir(this.accountsDir, { recursive: true });
    await writeFile(this.accountRecordPath(accountId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await writeFile(
      this.syncBufPath(accountId),
      `${JSON.stringify(nextGetUpdatesBuf ? { get_updates_buf: nextGetUpdatesBuf } : {}, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      this.contextTokensPath(accountId),
      `${JSON.stringify(nextContextTokens, null, 2)}\n`,
      "utf8"
    );

    const index = await this.readIndex();
    const nextIds = [...new Set([...index.accountIds, accountId])];
    await this.writeIndex({
      ...index,
      accountIds: nextIds,
      activeAccountId: options.setActive === false ? index.activeAccountId : accountId,
    });
  }

  async clearAccount(accountId: string, options: { clearActive?: boolean } = {}): Promise<void> {
    const normalizedAccountId = accountId.trim();
    if (!normalizedAccountId) {
      return;
    }

    await Promise.all([
      unlink(this.accountRecordPath(normalizedAccountId)).catch(() => undefined),
      unlink(this.syncBufPath(normalizedAccountId)).catch(() => undefined),
      unlink(this.contextTokensPath(normalizedAccountId)).catch(() => undefined),
    ]);

    const index = await this.readIndex();
    const nextIds = index.accountIds.filter((entry) => entry !== normalizedAccountId);
    const shouldClearActive = options.clearActive !== false && index.activeAccountId === normalizedAccountId;
    await this.writeIndex({
      ...index,
      accountIds: nextIds,
      activeAccountId: shouldClearActive ? undefined : index.activeAccountId,
    });
  }
}
