import type { MemoryService } from "./memoryService.js";
import type { MemoryRecallHit } from "../types/memory.js";
import type { ResearchFeedbackService } from "./researchFeedbackService.js";
import type { ResearchService } from "./researchService.js";
import type { InboundSlashCommandId } from "./inboundCommandRegistry.js";

export type InboundCommandExecutionResult = {
  reply: string;
  researchTaskId?: string | undefined;
};

type SafeOrMaintenanceCommandId = "help" | "status" | "memory" | "memory-compact";
type WorkspaceMutationCommandId = "research" | "remember" | "feedback";
type SessionControlCommandId = "role" | "skills" | "model" | "fallbacks" | "reasoning";

export type SessionControlSummary = {
  sessionId?: string | undefined;
  senderId?: string | undefined;
  entrySource?: "direct" | "ui" | "wechat" | "openclaw" | undefined;
  activeEntrySource?: "direct" | "ui" | "wechat" | "openclaw" | undefined;
  activeEntryLabel?: string | undefined;
  enabledToolsets?: string[] | undefined;
  availableToolsets?: string[] | undefined;
  roleId: string;
  roleLabel: string;
  skillIds: string[];
  skillLabels: string[];
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  llmStatus: "ready" | "needs-setup" | "disabled";
  llmSource: "registry" | "env" | "injected";
  wireApi?: string | undefined;
  fallbackRoutes: Array<{
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: string | undefined;
  }>;
  reasoningEffort: string;
  defaultRoute: {
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    llmStatus: "ready" | "needs-setup" | "disabled";
    llmSource: "registry" | "env";
    wireApi?: string | undefined;
  };
  availableRoles: Array<{ id: string; label: string }>;
  availableSkills: Array<{ id: string; label: string }>;
  availableLlmProviders: Array<{ id: string; label: string; models?: Array<{ id: string; label: string }> }>;
  availableReasoningEfforts: string[];
  hostSessionKey?: string | undefined;
  accountId?: string | undefined;
  threadId?: string | number | undefined;
  lastHostSyncAt?: string | undefined;
};

type InboundHandler<Input> = (argsText: string) => Promise<InboundCommandExecutionResult>;

function buildResearchReply(report: Awaited<ReturnType<ResearchService["runResearch"]>>): string {
  const findings = report.findings.slice(0, 2).join("\n- ");
  return [
    `Research task created: ${report.taskId}`,
    report.summary,
    findings ? `Top findings:\n- ${findings}` : "No findings yet.",
  ].join("\n\n");
}

export function createSafeAndMaintenanceHandlers(deps: {
  buildHelpReply: () => string;
  buildStatusReply: () => Promise<string>;
  recallMemory: (query: string) => Promise<MemoryRecallHit[]>;
  formatMemoryReply: (query: string, hits: MemoryRecallHit[]) => string;
  compactMemory: (olderThanDays?: number) => Promise<{
    compactedEntryCount: number;
    summaryTitle?: string | undefined;
    summaryPath?: string | undefined;
  }>;
}): Record<SafeOrMaintenanceCommandId, InboundHandler<{}>> {
  return {
    help: async () => ({
      reply: deps.buildHelpReply(),
    }),
    status: async () => ({
      reply: await deps.buildStatusReply(),
    }),
    memory: async (argsText) => {
      const query = argsText;
      if (!query) {
        return { reply: "Usage: /memory <query>" };
      }
      const hits = await deps.recallMemory(query);
      return {
        reply: deps.formatMemoryReply(query, hits),
      };
    },
    "memory-compact": async (argsText) => {
      const parsedDays = argsText ? Number.parseInt(argsText, 10) : undefined;
      const result = await deps.compactMemory(
        Number.isFinite(parsedDays) && (parsedDays ?? 0) > 0 ? parsedDays : undefined,
      );
      return {
        reply:
          result.compactedEntryCount > 0
            ? [
                `Compacted ${result.compactedEntryCount} memory entries.`,
                `Summary: ${result.summaryTitle}`,
                `Path: ${result.summaryPath}`,
              ].join("\n")
            : "No eligible workspace memory entries were old enough to compact.",
      };
    },
  };
}

export function createWorkspaceMutationHandlers(input: {
  senderId: string;
  senderName?: string | undefined;
}, deps: {
  researchService: Pick<ResearchService, "runResearch">;
  memoryService: Pick<MemoryService, "remember">;
  feedbackService: Pick<ResearchFeedbackService, "record">;
}): Record<WorkspaceMutationCommandId, InboundHandler<typeof input>> {
  return {
    research: async (argsText) => {
      const topic = argsText;
      if (!topic) {
        return { reply: "Usage: /research <topic>" };
      }
      const report = await deps.researchService.runResearch({
        topic,
        question: `WeChat request from ${input.senderName?.trim() || input.senderId}: ${topic}`,
        maxPapers: 10,
      });
      return {
        reply: buildResearchReply(report),
        researchTaskId: report.taskId,
      };
    },
    remember: async (argsText) => {
      const content = argsText;
      if (!content) {
        return { reply: "Usage: /remember <fact>" };
      }
      await deps.memoryService.remember({
        scope: "daily",
        title: `WeChat note from ${input.senderName?.trim() || input.senderId}`,
        content,
        source: "wechat",
        sourceType: "user-stated",
        confidence: "medium",
        tags: ["wechat-memory", input.senderId],
      });
      return {
        reply: "Saved to today's memory file.",
      };
    },
    feedback: async (argsText) => {
      const content = argsText;
      if (!content) {
        return {
          reply:
            "Usage: /feedback <useful|not-useful|more-like-this|less-like-this|too-theoretical|too-engineering-heavy|worth-following|not-worth-following> [notes]",
        };
      }
      const [rawSignal, ...rest] = content.split(/\s+/u);
      const signal = rawSignal?.trim().toLowerCase();
      const feedbackSignals = new Set([
        "useful",
        "not-useful",
        "more-like-this",
        "less-like-this",
        "too-theoretical",
        "too-engineering-heavy",
        "worth-following",
        "not-worth-following",
      ]);

      if (!signal || !feedbackSignals.has(signal)) {
        return {
          reply:
            "Unsupported feedback signal. Use one of: useful, not-useful, more-like-this, less-like-this, too-theoretical, too-engineering-heavy, worth-following, not-worth-following",
        };
      }

      const notes = rest.join(" ").trim();
      const record = await deps.feedbackService.record({
        feedback: signal as
          | "useful"
          | "not-useful"
          | "more-like-this"
          | "less-like-this"
          | "too-theoretical"
          | "too-engineering-heavy"
          | "worth-following"
          | "not-worth-following",
        senderId: input.senderId,
        senderName: input.senderName,
        ...(notes ? { notes } : {}),
      });
      return {
        reply: `Recorded feedback: ${record.feedback}.${record.notes ? ` Notes: ${record.notes}` : ""}`,
      };
    },
  };
}

export function createSessionControlHandlers(input: {
  senderId: string;
}, deps: {
  describeSession: (senderId: string) => Promise<SessionControlSummary>;
  setRole: (senderId: string, roleId: string) => Promise<SessionControlSummary>;
  setModel: (senderId: string, providerId: string, modelId: string) => Promise<SessionControlSummary>;
  clearModel: (senderId: string) => Promise<SessionControlSummary>;
  setFallbacks: (
    senderId: string,
    selections: Array<{ providerId: string; modelId: string }>,
  ) => Promise<SessionControlSummary>;
  setReasoning: (senderId: string, reasoningEffort: string) => Promise<SessionControlSummary>;
}): Record<SessionControlCommandId, InboundHandler<typeof input>> {
  return {
    role: async (argsText) => {
      if (!argsText) {
        const summary = await deps.describeSession(input.senderId);
        return {
          reply: [
            `Current role: ${summary.roleLabel} (${summary.roleId})`,
            `Available roles: ${summary.availableRoles.map((role) => `${role.id}`).join(", ")}`,
          ].join("\n"),
        };
      }
      const summary = await deps.setRole(input.senderId, argsText);
      return {
        reply: `Agent role set to ${summary.roleLabel} (${summary.roleId}).`,
      };
    },
    skills: async () => {
      const summary = await deps.describeSession(input.senderId);
      return {
        reply: [
          `Current role: ${summary.roleLabel} (${summary.roleId})`,
          `Active skills: ${summary.skillLabels.join(", ")}`,
          `Model route: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
        ].join("\n"),
      };
    },
    model: async (argsText) => {
      if (!argsText) {
        const summary = await deps.describeSession(input.senderId);
        const available = summary.availableLlmProviders
          .map((provider) => {
            const models =
              "models" in provider && Array.isArray((provider as { models?: Array<{ id: string }> }).models)
                ? (provider as { models: Array<{ id: string }> }).models.map((model) => model.id).join(", ")
                : "";
            return models ? `${provider.id}: ${models}` : provider.id;
          })
          .join(" | ");
        return {
          reply: [
            `Current model route: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
            `Status: ${summary.llmStatus} (${summary.llmSource})`,
            `Available providers: ${available || "none"}`,
          ].join("\n"),
        };
      }
      if (argsText.toLowerCase() === "default" || argsText.toLowerCase() === "inherit") {
        const summary = await deps.clearModel(input.senderId);
        return {
          reply: `Agent model route reset to default: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}.`,
        };
      }
      const [providerId, modelId] = argsText.split(/\s+/u);
      if (!providerId || !modelId) {
        return { reply: "Usage: /model <providerId> <modelId> or /model default" };
      }
      const summary = await deps.setModel(input.senderId, providerId, modelId);
      return {
        reply: `Agent model route set to ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}.`,
      };
    },
    fallbacks: async (argsText) => {
      if (!argsText) {
        const summary = await deps.describeSession(input.senderId);
        return {
          reply: [
            `Current model route: ${summary.providerLabel}/${summary.modelLabel}${summary.wireApi ? ` via ${summary.wireApi}` : ""}`,
            `Fallbacks: ${
              summary.fallbackRoutes.length
                ? summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")
                : "none"
            }`,
          ].join("\n"),
        };
      }
      if (argsText.toLowerCase() === "clear" || argsText.toLowerCase() === "none") {
        const summary = await deps.setFallbacks(input.senderId, []);
        return {
          reply: `Agent model fallbacks cleared. Primary route remains ${summary.providerLabel}/${summary.modelLabel}.`,
        };
      }
      const selections = argsText
        .split(/[,\n]/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [providerId, modelId] = entry.split(/[/:]/u);
          return {
            providerId: providerId?.trim() || "",
            modelId: modelId?.trim() || "",
          };
        })
        .filter((entry) => entry.providerId && entry.modelId);
      if (selections.length === 0) {
        return { reply: "Usage: /fallbacks <providerId/modelId, providerId/modelId> or /fallbacks clear" };
      }
      const summary = await deps.setFallbacks(input.senderId, selections);
      return {
        reply: `Agent model fallbacks set to ${summary.fallbackRoutes.map((route) => `${route.providerId}/${route.modelId}`).join(", ")}.`,
      };
    },
    reasoning: async (argsText) => {
      if (!argsText) {
        const summary = await deps.describeSession(input.senderId);
        return {
          reply: [
            `Current reasoning effort: ${summary.reasoningEffort}`,
            `Options: ${summary.availableReasoningEfforts.join(", ")}`,
          ].join("\n"),
        };
      }
      const summary = await deps.setReasoning(input.senderId, argsText.toLowerCase());
      return {
        reply: `Agent reasoning effort set to ${summary.reasoningEffort}.`,
      };
    },
  };
}

export type InboundExtractedHandlerMap = Pick<
  Record<InboundSlashCommandId, InboundHandler<{ senderId: string; senderName?: string | undefined }>>,
  WorkspaceMutationCommandId | SessionControlCommandId
>;
