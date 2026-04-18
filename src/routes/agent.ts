import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AgentDelegationService } from "../services/agentDelegationService.js";
import type { ChannelService } from "../services/channelService.js";

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

export async function registerAgentRoutes(
  app: FastifyInstance,
  channelService: Pick<
    ChannelService,
    | "getAgentRuntimeOverview"
    | "listAgentSessions"
    | "findAgentSession"
    | "getAgentSessionCognition"
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

    return reply.send({
      items: await delegationService.listRecent(
        parsed.data.limit,
        parsed.data.status,
        parsed.data.sessionId,
      ),
    });
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

    try {
      const record = await delegationService.createDelegation(parsed.data);
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

    return reply.send(record);
  });
}
