import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type RemoteAuthorizedCommandTier = "workspace-mutation" | "session-control";
export type RemoteCommandPolicyMode = "allow" | "allowlist";

export interface RemoteCommandTierPolicy {
  mode: RemoteCommandPolicyMode;
  senderIds: string[];
}

export interface InboundCommandPolicy {
  remote: Record<RemoteAuthorizedCommandTier, RemoteCommandTierPolicy>;
}

function normalizeSenderIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultPolicy(): InboundCommandPolicy {
  return {
    remote: {
      "workspace-mutation": {
        mode: "allow",
        senderIds: [],
      },
      "session-control": {
        mode: "allow",
        senderIds: [],
      },
    },
  };
}

function sanitizeTierPolicy(value: unknown, fallback: RemoteCommandTierPolicy): RemoteCommandTierPolicy {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const candidate = value as Partial<RemoteCommandTierPolicy>;
  return {
    mode: candidate.mode === "allowlist" ? "allowlist" : "allow",
    senderIds: normalizeSenderIds(candidate.senderIds),
  };
}

function sanitizePolicy(value: unknown): InboundCommandPolicy {
  const defaults = defaultPolicy();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const candidate = value as Partial<{ remote: Record<string, unknown> }>;
  const remote = candidate.remote && typeof candidate.remote === "object" ? candidate.remote : {};

  return {
    remote: {
      "workspace-mutation": sanitizeTierPolicy(remote["workspace-mutation"], defaults.remote["workspace-mutation"]),
      "session-control": sanitizeTierPolicy(remote["session-control"], defaults.remote["session-control"]),
    },
  };
}

function isSenderAllowed(senderId: string, allowlist: string[]): boolean {
  const normalizedSenderId = senderId.trim();
  if (!normalizedSenderId) {
    return false;
  }
  return allowlist.includes("*") || allowlist.includes(normalizedSenderId);
}

export class InboundCommandPolicyService {
  private readonly policyPath: string;

  constructor(private readonly workspaceDir: string) {
    this.policyPath = path.join(this.workspaceDir, "channels", "inbound-command-policy.json");
  }

  getPolicyPath(): string {
    return this.policyPath;
  }

  async ensurePolicyFile(): Promise<void> {
    await mkdir(path.dirname(this.policyPath), { recursive: true });
    try {
      await readFile(this.policyPath, "utf8");
    } catch {
      await writeFile(this.policyPath, `${JSON.stringify(defaultPolicy(), null, 2)}\n`, "utf8");
    }
  }

  async getPolicy(): Promise<InboundCommandPolicy> {
    await this.ensurePolicyFile();
    try {
      const raw = await readFile(this.policyPath, "utf8");
      return sanitizePolicy(JSON.parse(raw));
    } catch {
      return defaultPolicy();
    }
  }

  async authorizeRemoteTier(
    tier: RemoteAuthorizedCommandTier,
    senderId: string,
  ): Promise<
    | {
        allowed: true;
        policy: RemoteCommandTierPolicy;
      }
    | {
        allowed: false;
        policy: RemoteCommandTierPolicy;
      }
  > {
    const policy = (await this.getPolicy()).remote[tier];
    if (policy.mode === "allow") {
      return {
        allowed: true,
        policy,
      };
    }

    return {
      allowed: isSenderAllowed(senderId, policy.senderIds),
      policy,
    };
  }
}
