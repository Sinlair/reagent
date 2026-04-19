import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AgentDelegationService } from "../services/agentDelegationService.js";
import type { ChannelService } from "../services/channelService.js";
import type { AgentSessionCognition } from "../agents/runtime.js";
import type { AgentDelegationKind, AgentDelegationRationale, AgentDelegationRecord } from "../types/agentDelegation.js";

const AgentSessionsQuerySchema = z.object({
  source: z.enum(["direct", "ui", "wechat", "openclaw"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const AgentSessionHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const AgentSessionHooksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  event: z.enum(["llm_call", "tool_call", "tool_error", "tool_blocked", "reply_emit"]).optional(),
});

const AgentSessionProfilePatchSchema = z.object({
  roleId: z.string().trim().min(1).optional(),
  skillIds: z.array(z.string().trim().min(1)).min(1).optional(),
  providerId: z.string().trim().min(1).optional(),
  modelId: z.string().trim().min(1).optional(),
  clearModel: z.boolean().optional(),
  fallbackRoutes: z.array(
    z.object({
      providerId: z.string().trim().min(1),
      modelId: z.string().trim().min(1),
    }),
  ).optional(),
  reasoningEffort: z.enum(["default", "none", "minimal", "low", "medium", "high", "xhigh"]).optional(),
}).refine(
  (value) => !value.clearModel || (!value.providerId && !value.modelId),
  {
    message: "clearModel cannot be combined with providerId or modelId",
    path: ["clearModel"],
  },
).refine(
  (value) => (!value.providerId && !value.modelId) || (Boolean(value.providerId) && Boolean(value.modelId)),
  {
    message: "providerId and modelId are required together",
    path: ["providerId"],
  },
);

const AgentSessionParamsSchema = z.object({
  sessionId: z.string().trim().regex(/^(direct|ui|wechat|openclaw):.+$/u),
});

const AgentHostHistoryParamsSchema = z.object({
  sessionKey: z.string().trim().min(1),
});

const AgentDelegationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional(),
  sessionId: z.string().trim().min(1).optional(),
});

const AgentDelegationCreateSchema = z.object({
  sessionId: z.string().trim().regex(/^(direct|ui|wechat|openclaw):.+$/u),
  taskId: z.string().trim().min(1),
  kind: z.enum(["search", "reading", "synthesis"]),
  prompt: z.string().trim().min(1).optional(),
});

const AgentDelegationParamsSchema = z.object({
  delegationId: z.string().trim().min(1),
});
const DELEGATION_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

function delegationPromptExplicitlyRequestsKind(
  kind: AgentDelegationKind,
  prompt: string | undefined,
): boolean {
  const normalized = prompt?.trim() ?? "";
  if (!normalized) {
    return false;
  }

  const patterns: Record<AgentDelegationKind, RegExp> = {
    search: /\b(search|find|discover|lookup|搜|检索|发现)\b/iu,
    reading: /\b(read|inspect|analyze|review|阅读|分析|查看)\b/iu,
    synthesis: /\b(summary|report|synthesis|deck|slides|presentation|总结|汇报|组会|报告)\b/iu,
  };
  return patterns[kind].test(normalized);
}

function delegationPromptExplicitlyRequestsRetry(prompt: string | undefined): boolean {
  const normalized = prompt?.trim() ?? "";
  if (!normalized) {
    return false;
  }

  return /\b(retry|rerun|re-run|try again|recover|resume|重试|再试|重新跑|恢复)\b/iu.test(normalized);
}

function deriveDelegationRationale(
  cognition: AgentSessionCognition,
  session: {
    entrySource: "direct" | "ui" | "wechat" | "openclaw";
    roleId: string;
    roleLabel?: string | undefined;
  },
  kind: AgentDelegationKind,
  taskId: string,
  existingDelegations: AgentDelegationRecord[],
  prompt?: string | undefined,
): {
  allow: boolean;
  reason?: string | undefined;
  rationale: AgentDelegationRationale;
} {
  const actionNodes = cognition.neurons.action ?? [];
  const hypothesisNodes = cognition.neurons.hypothesis ?? [];
  const constrainedEntry = session.entrySource === "wechat" || session.entrySource === "openclaw";
  const conflictedHypotheses = hypothesisNodes.filter((node) => node.status === "conflicted").length;
  const provisionalHypotheses = hypothesisNodes.filter((node) => node.status === "provisional").length;
  const supportedHypotheses = hypothesisNodes.filter((node) => node.status === "supported").length;
  const matchedAction = actionNodes[0]?.content;
  const matchedHypothesis =
    hypothesisNodes.find((node) => node.status === "conflicted")?.content ??
    hypothesisNodes.find((node) => node.status === "provisional")?.content ??
    hypothesisNodes[0]?.content;
  const mode =
    conflictedHypotheses > 0 || provisionalHypotheses > 1
      ? "evidence-gathering"
      : supportedHypotheses > 0
        ? "delivery-ready"
        : "balanced";
  const recommendedKinds: AgentDelegationKind[] =
    mode === "evidence-gathering"
      ? ["search", "reading"]
      : mode === "delivery-ready"
        ? ["synthesis"]
        : /\b(read|inspect|analyze|review)\b/iu.test(matchedAction ?? "")
          ? ["reading", "search", "synthesis"]
          : /\b(summary|report|presentation|deck)\b/iu.test(matchedAction ?? "")
            ? ["synthesis", "reading", "search"]
            : ["search", "reading", "synthesis"];
  if (constrainedEntry && mode !== "delivery-ready") {
    recommendedKinds.splice(0, recommendedKinds.length, "search", "reading");
  }
  if (session.roleId === "assistant" && mode !== "delivery-ready") {
    recommendedKinds.splice(0, recommendedKinds.length, "search", "reading");
  }
  if (
    (session.entrySource === "direct" || session.entrySource === "ui") &&
    session.roleId === "operator" &&
    mode === "delivery-ready"
  ) {
    recommendedKinds.splice(0, recommendedKinds.length, "synthesis", "reading", "search");
  }
  const deferredKinds = (["search", "reading", "synthesis"] as AgentDelegationKind[]).filter(
    (entry) => !recommendedKinds.includes(entry),
  );
  const reasons = [
    ...(conflictedHypotheses > 0 ? [`${conflictedHypotheses} conflicted hypothesis node(s) remain active.`] : []),
    ...(provisionalHypotheses > 0 ? [`${provisionalHypotheses} provisional hypothesis node(s) still need evidence.`] : []),
    ...(matchedAction ? [`Current action focus: ${matchedAction}`] : []),
    ...(constrainedEntry
      ? [`Current entry is ${session.entrySource}, so prefer compact evidence delegations before synthesis.`]
      : []),
    ...(session.roleId === "assistant"
      ? ["Current role is assistant, so avoid long-form synthesis until delivery is explicitly requested."]
      : session.roleId === "researcher"
        ? ["Current role is researcher, so favor evidence gathering and reading before delivery."]
        : session.roleId === "operator"
          ? ["Current role is operator, so synthesis becomes appropriate once cognition is delivery-ready."]
          : []),
  ];
  const activeTaskDelegations = existingDelegations.filter(
    (item) => item.taskId === taskId && (item.status === "queued" || item.status === "running"),
  );
  const activeSameKind = activeTaskDelegations.filter((item) => item.kind === kind);
  const activeEvidenceKinds = activeTaskDelegations.filter(
    (item) => item.kind === "search" || item.kind === "reading",
  );
  const latestFailedOrCancelled = existingDelegations
    .filter(
      (item) =>
        item.taskId === taskId &&
        item.kind === kind &&
        (item.status === "failed" || item.status === "cancelled"),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const retryRequested = delegationPromptExplicitlyRequestsRetry(prompt);
  const latestFailedOrCancelledAgeMs = latestFailedOrCancelled
    ? Math.max(0, Date.now() - Date.parse(latestFailedOrCancelled.updatedAt))
    : Number.POSITIVE_INFINITY;
  if (activeSameKind.length > 0) {
    reasons.push(`An active ${kind} delegation already exists for this task.`);
  }
  if (kind === "synthesis" && activeEvidenceKinds.length > 0) {
    reasons.push(`Evidence delegations are still active for this task: ${activeEvidenceKinds.map((item) => item.kind).join(", ")}.`);
  }
  if (latestFailedOrCancelled) {
    reasons.push(
      `A recent ${latestFailedOrCancelled.status} ${kind} delegation exists for this task${retryRequested ? ", but the prompt explicitly asked to retry." : "."}`,
    );
  }
  const rationale: AgentDelegationRationale = {
    source: "cognition-state",
    summary:
      mode === "evidence-gathering"
        ? `Current cognition prefers evidence-gathering delegations before ${kind}.`
        : mode === "delivery-ready"
          ? `Current cognition is stable enough to support a ${kind} delegation.`
          : `Current cognition is mixed; ${kind} is being evaluated against the active action and hypothesis state.`,
    ...(matchedAction ? { matchedAction } : {}),
    ...(matchedHypothesis ? { matchedHypothesis } : {}),
    posture: {
      mode,
      reasons: reasons.length > 0 ? reasons : ["No strong cognition signal was available."],
      recommendedKinds,
      deferredKinds,
      conflictedHypotheses,
      provisionalHypotheses,
      supportedHypotheses,
    },
  };

  if (
    mode === "evidence-gathering" &&
    kind === "synthesis" &&
    !delegationPromptExplicitlyRequestsKind(kind, prompt)
  ) {
    return {
      allow: false,
      reason: `Cognition prefers search or reading delegations before synthesis because ${rationale.posture.reasons[0] ?? "uncertainty is still high"}`,
      rationale,
    };
  }

  if (
    latestFailedOrCancelled &&
    latestFailedOrCancelledAgeMs < DELEGATION_RETRY_COOLDOWN_MS &&
    !retryRequested
  ) {
    return {
      allow: false,
      reason: `Recent ${latestFailedOrCancelled.status} ${kind} delegation for task ${taskId} is cooling down. Review blockers or ask explicitly to retry.`,
      rationale,
    };
  }

  if (activeSameKind.length > 0) {
    return {
      allow: false,
      reason: `An active ${kind} delegation already exists for task ${taskId}. Cancel or finish it before creating another one.`,
      rationale,
    };
  }

  if (kind === "synthesis" && activeEvidenceKinds.length > 0) {
    return {
      allow: false,
      reason: `Evidence delegations are still active for task ${taskId}. Finish search/reading before starting synthesis.`,
      rationale,
    };
  }

  if (
    constrainedEntry &&
    kind === "synthesis" &&
    mode !== "delivery-ready" &&
    !delegationPromptExplicitlyRequestsKind(kind, prompt)
  ) {
    return {
      allow: false,
      reason: `Active entry ${session.entrySource} should stay in compact evidence mode before synthesis for task ${taskId}.`,
      rationale,
    };
  }

  if (
    session.roleId === "assistant" &&
    kind === "synthesis" &&
    mode !== "delivery-ready" &&
    !delegationPromptExplicitlyRequestsKind(kind, prompt)
  ) {
    return {
      allow: false,
      reason: `Assistant role should avoid synthesis delegations before the cognition state is delivery-ready for task ${taskId}.`,
      rationale,
    };
  }

  return {
    allow: true,
    rationale,
  };
}

export async function registerAgentRoutes(
  app: FastifyInstance,
  channelService: Pick<
    ChannelService,
    | "getAgentRuntimeOverview"
    | "listAgentSessions"
    | "findAgentSession"
    | "getAgentSessionCognition"
    | "syncAgentDelegationCognition"
    | "updateAgentSessionProfile"
    | "getAgentSessionHistory"
    | "getAgentSessionHooks"
    | "listAgentHostSessions"
    | "getAgentHostSessionHistory"
  >,
  options?: {
    workspaceDir?: string;
    delegationService?: Pick<
      AgentDelegationService,
      "listRecent" | "createDelegation" | "getDelegation" | "cancelDelegation"
    >;
  },
): Promise<void> {
  const delegationService =
    options?.delegationService ?? new AgentDelegationService(options?.workspaceDir ?? process.cwd());

  app.get("/api/agent/runtime", async () => channelService.getAgentRuntimeOverview());

  app.get("/api/agent/sessions", async (request, reply) => {
    const parsed = AgentSessionsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent sessions query",
        issues: parsed.error.flatten(),
      });
    }

    const sessions = await channelService.listAgentSessions();
    const filtered = parsed.data.source
      ? sessions.filter((session) => session.entrySource === parsed.data.source)
      : sessions;

    return reply.send({
      sessions: filtered.slice(0, parsed.data.limit),
    });
  });

  app.get("/api/agent/sessions/:sessionId", async (request, reply) => {
    const parsed = AgentSessionParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent session id",
        issues: parsed.error.flatten(),
      });
    }

    const session = await channelService.findAgentSession(parsed.data.sessionId);
    if (!session) {
      return reply.code(404).send({
        message: "Agent session not found",
      });
    }

    return reply.send(session);
  });

  app.get("/api/agent/sessions/:sessionId/profile", async (request, reply) => {
    const parsed = AgentSessionParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent session id",
        issues: parsed.error.flatten(),
      });
    }

    const session = await channelService.findAgentSession(parsed.data.sessionId);
    if (!session) {
      return reply.code(404).send({
        message: "Agent session not found",
      });
    }

    return reply.send(session);
  });

  app.get("/api/agent/sessions/:sessionId/cognition", async (request, reply) => {
    const parsed = AgentSessionParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent session id",
        issues: parsed.error.flatten(),
      });
    }

    const cognition = await channelService.getAgentSessionCognition(parsed.data.sessionId);
    if (!cognition) {
      return reply.code(404).send({
        message: "Agent session not found",
      });
    }

    return reply.send(cognition);
  });

  app.patch("/api/agent/sessions/:sessionId/profile", async (request, reply) => {
    const parsedParams = AgentSessionParamsSchema.safeParse(request.params);
    const parsedBody = AgentSessionProfilePatchSchema.safeParse(request.body ?? {});
    if (!parsedParams.success || !parsedBody.success) {
      return reply.code(400).send({
        message: "Invalid agent session profile patch",
        issues: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    try {
      const updated = await channelService.updateAgentSessionProfile({
        sessionId: parsedParams.data.sessionId,
        ...parsedBody.data,
      });
      if (!updated) {
        return reply.code(404).send({
          message: "Agent session not found",
        });
      }

      return reply.send(updated);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Failed to update agent session profile",
      });
    }
  });

  app.get("/api/agent/sessions/:sessionId/history", async (request, reply) => {
    const parsedParams = AgentSessionParamsSchema.safeParse(request.params);
    const parsedQuery = AgentSessionHistoryQuerySchema.safeParse(request.query ?? {});
    if (!parsedParams.success || !parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid agent session history request",
        issues: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          query: parsedQuery.success ? undefined : parsedQuery.error.flatten(),
        },
      });
    }

    const history = await channelService.getAgentSessionHistory(parsedParams.data.sessionId, parsedQuery.data.limit);
    if (!history) {
      return reply.code(404).send({
        message: "Agent session not found",
      });
    }

    return reply.send(history);
  });

  app.get("/api/agent/sessions/:sessionId/hooks", async (request, reply) => {
    const parsedParams = AgentSessionParamsSchema.safeParse(request.params);
    const parsedQuery = AgentSessionHooksQuerySchema.safeParse(request.query ?? {});
    if (!parsedParams.success || !parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid agent session hooks request",
        issues: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          query: parsedQuery.success ? undefined : parsedQuery.error.flatten(),
        },
      });
    }

    const hooks = await channelService.getAgentSessionHooks(
      parsedParams.data.sessionId,
      parsedQuery.data.limit,
      parsedQuery.data.event,
    );
    if (!hooks) {
      return reply.code(404).send({
        message: "Agent session not found",
      });
    }

    return reply.send(hooks);
  });

  app.get("/api/agent/host/sessions", async (request, reply) => {
    const parsed = AgentSessionsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent host sessions query",
        issues: parsed.error.flatten(),
      });
    }

    return reply.send({
      sessions: await channelService.listAgentHostSessions(parsed.data.limit),
    });
  });

  app.get("/api/agent/host/sessions/:sessionKey/history", async (request, reply) => {
    const parsedParams = AgentHostHistoryParamsSchema.safeParse(request.params);
    const parsedQuery = AgentSessionHistoryQuerySchema.safeParse(request.query ?? {});
    if (!parsedParams.success || !parsedQuery.success) {
      return reply.code(400).send({
        message: "Invalid agent host history request",
        issues: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          query: parsedQuery.success ? undefined : parsedQuery.error.flatten(),
        },
      });
    }

    const history = await channelService.getAgentHostSessionHistory(
      parsedParams.data.sessionKey,
      parsedQuery.data.limit,
    );
    if (!history) {
      return reply.code(404).send({
        message: "Agent host session not found",
      });
    }

    return reply.send(history);
  });

  app.get("/api/agent/delegations", async (request, reply) => {
    const parsed = AgentDelegationListQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent delegations query",
        issues: parsed.error.flatten(),
      });
    }

    const items = await delegationService.listRecent(
      parsed.data.limit,
      parsed.data.status,
      parsed.data.sessionId,
    );
    await Promise.all(
      items.map((item) =>
        channelService.syncAgentDelegationCognition({
          sessionId: item.sessionId,
          delegationId: item.delegationId,
          taskId: item.taskId,
          kind: item.kind,
          status: item.status,
          ...(item.artifact?.path ? { artifactPath: item.artifact.path } : {}),
          ...(item.error != null ? { error: item.error } : {}),
        }).catch(() => null),
      ),
    );

    return reply.send({ items });
  });

  app.post("/api/agent/delegations", async (request, reply) => {
    const parsed = AgentDelegationCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent delegation payload",
        issues: parsed.error.flatten(),
      });
    }

    const session = await channelService.findAgentSession(parsed.data.sessionId);
    if (!session) {
      return reply.code(404).send({
        message: "Agent session not found",
      });
    }

    const cognition = await channelService.getAgentSessionCognition(parsed.data.sessionId);
    if (!cognition) {
      return reply.code(404).send({
        message: "Agent cognition not found for this session",
      });
    }
    const existingDelegations = await delegationService.listRecent(200, undefined, parsed.data.sessionId);

    const decision = deriveDelegationRationale(
      cognition,
      {
        entrySource: session.entrySource ?? session.activeEntrySource ?? "direct",
        roleId: session.roleId,
        ...(session.roleLabel ? { roleLabel: session.roleLabel } : {}),
      },
      parsed.data.kind,
      parsed.data.taskId,
      existingDelegations,
      parsed.data.prompt,
    );
    if (!decision.allow) {
      return reply.code(400).send({
        message: decision.reason,
        rationale: decision.rationale,
      });
    }

    try {
      const record = await delegationService.createDelegation({
        ...parsed.data,
        rationale: decision.rationale,
      });
      await channelService.syncAgentDelegationCognition({
        sessionId: record.sessionId,
        delegationId: record.delegationId,
        taskId: record.taskId,
        kind: record.kind,
        status: record.status,
        ...(record.artifact?.path ? { artifactPath: record.artifact.path } : {}),
        ...(record.error != null ? { error: record.error } : {}),
      }).catch(() => null);
      return reply.code(201).send(record);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Failed to create delegation",
      });
    }
  });

  app.get("/api/agent/delegations/:delegationId", async (request, reply) => {
    const parsed = AgentDelegationParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid delegation id",
        issues: parsed.error.flatten(),
      });
    }

    const record = await delegationService.getDelegation(parsed.data.delegationId);
    if (!record) {
      return reply.code(404).send({
        message: "Agent delegation not found",
      });
    }

    await channelService.syncAgentDelegationCognition({
      sessionId: record.sessionId,
      delegationId: record.delegationId,
      taskId: record.taskId,
      kind: record.kind,
      status: record.status,
      ...(record.artifact?.path ? { artifactPath: record.artifact.path } : {}),
      ...(record.error != null ? { error: record.error } : {}),
    }).catch(() => null);

    return reply.send(record);
  });

  app.post("/api/agent/delegations/:delegationId/cancel", async (request, reply) => {
    const parsed = AgentDelegationParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid delegation id",
        issues: parsed.error.flatten(),
      });
    }

    const record = await delegationService.cancelDelegation(parsed.data.delegationId);
    if (!record) {
      return reply.code(404).send({
        message: "Agent delegation not found",
      });
    }

    await channelService.syncAgentDelegationCognition({
      sessionId: record.sessionId,
      delegationId: record.delegationId,
      taskId: record.taskId,
      kind: record.kind,
      status: record.status,
      ...(record.artifact?.path ? { artifactPath: record.artifact.path } : {}),
      ...(record.error != null ? { error: record.error } : {}),
    }).catch(() => null);

    return reply.send(record);
  });
}
