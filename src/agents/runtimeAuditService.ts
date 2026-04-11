import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { AgentRuntimeHook } from "./runtimeHooks.js";

export interface AgentRuntimeAuditEntry {
  ts: string;
  event: "llm_call" | "tool_call" | "tool_error" | "tool_blocked" | "reply_emit";
  senderId: string;
  source: string;
  roleId: string;
  skillIds: string[];
  stage?: string | undefined;
  providerId?: string | undefined;
  modelId?: string | undefined;
  wireApi?: string | undefined;
  toolName?: string | undefined;
  toolNames?: string[] | undefined;
  usedTools?: string[] | undefined;
  success?: boolean | undefined;
  functionCallNames?: string[] | undefined;
  error?: string | undefined;
  preview?: string | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clipText(text: string, maxLength = 240): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function previewValue(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    return clipText(value);
  }

  try {
    return clipText(JSON.stringify(value));
  } catch {
    return clipText(String(value));
  }
}

export class AgentRuntimeAuditService {
  private readonly auditPath: string;

  constructor(private readonly workspaceDir: string) {
    this.auditPath = path.join(this.workspaceDir, "channels", "agent-runtime-audit.jsonl");
  }

  getAuditPath(): string {
    return this.auditPath;
  }

  async append(entry: AgentRuntimeAuditEntry): Promise<void> {
    await mkdir(path.dirname(this.auditPath), { recursive: true });
    await appendFile(
      this.auditPath,
      `${JSON.stringify({ ...entry, ts: entry.ts ?? nowIso() })}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 30): Promise<AgentRuntimeAuditEntry[]> {
    try {
      const raw = await readFile(this.auditPath, "utf8");
      const entries = raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as AgentRuntimeAuditEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is AgentRuntimeAuditEntry => Boolean(entry?.event));

      return entries.slice(-Math.max(1, Math.min(limit, 200))).reverse();
    } catch {
      return [];
    }
  }

  createHook(): AgentRuntimeHook {
    return {
      postLlmCall: async ({ context, call, result }) => {
        await this.append({
          ts: nowIso(),
          event: "llm_call",
          senderId: context.input.senderId,
          source: context.input.source ?? "direct",
          roleId: context.session.roleId,
          skillIds: [...context.session.skillIds],
          stage: call.stage,
          providerId: call.providerId,
          modelId: call.modelId,
          wireApi: call.wireApi,
          toolNames: [...call.toolNames],
          success: result.success,
          functionCallNames: [...result.functionCallNames],
          ...(result.error ? { error: result.error } : {}),
          ...(result.responseText ? { preview: result.responseText } : {}),
        });
      },
      postToolCall: async ({ context, tool, output }) => {
        await this.append({
          ts: nowIso(),
          event: "tool_call",
          senderId: context.input.senderId,
          source: context.input.source ?? "direct",
          roleId: context.session.roleId,
          skillIds: [...context.session.skillIds],
          toolName: tool.toolName,
          preview: previewValue(output),
        });
      },
      toolError: async ({ context, tool, error }) => {
        await this.append({
          ts: nowIso(),
          event: "tool_error",
          senderId: context.input.senderId,
          source: context.input.source ?? "direct",
          roleId: context.session.roleId,
          skillIds: [...context.session.skillIds],
          toolName: tool.toolName,
          error,
        });
      },
      toolBlocked: async ({ context, tool, reason }) => {
        await this.append({
          ts: nowIso(),
          event: "tool_blocked",
          senderId: context.input.senderId,
          source: context.input.source ?? "direct",
          roleId: context.session.roleId,
          skillIds: [...context.session.skillIds],
          toolName: tool.toolName,
          error: reason,
        });
      },
      preReplyEmit: async ({ context, reply }) => {
        await this.append({
          ts: nowIso(),
          event: "reply_emit",
          senderId: context.input.senderId,
          source: context.input.source ?? "direct",
          roleId: context.session.roleId,
          skillIds: [...context.session.skillIds],
          usedTools: [...reply.usedTools],
          preview: clipText(reply.reply),
        });
      },
    };
  }
}
