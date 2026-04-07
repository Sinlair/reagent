import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { ChannelService } from "../services/channelService.js";

const LoginStartSchema = z.object({
  force: z.boolean().optional().default(false),
  displayName: z.string().trim().min(1).optional()
});

const LoginCompleteSchema = z.object({
  displayName: z.string().trim().min(1).optional()
});

const InboundSchema = z.object({
  senderId: z.string().trim().min(1),
  senderName: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1)
});

const AgentQuerySchema = z.object({
  senderId: z.string().trim().min(1)
});

const AgentRoleSchema = z.object({
  senderId: z.string().trim().min(1),
  roleId: z.string().trim().min(1)
});

const AgentSkillsSchema = z.object({
  senderId: z.string().trim().min(1),
  skillIds: z.array(z.string().trim().min(1)).min(1)
});

const AgentModelSchema = z.object({
  senderId: z.string().trim().min(1),
  providerId: z.string().trim().optional(),
  modelId: z.string().trim().optional()
});

const AgentFallbacksSchema = z.object({
  senderId: z.string().trim().min(1),
  routes: z
    .array(
      z.object({
        providerId: z.string().trim().min(1),
        modelId: z.string().trim().min(1)
      })
    )
    .optional()
    .default([])
});

const AgentReasoningSchema = z.object({
  senderId: z.string().trim().min(1),
  reasoningEffort: z.string().trim().optional().default("default")
});

const LifecycleAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export async function registerChannelRoutes(
  app: FastifyInstance,
  channelService: ChannelService
): Promise<void> {
  app.get("/api/channels/status", async () => channelService.getStatusSnapshot());

  app.get("/api/channels/wechat/chat/messages", async () => ({
    messages: await channelService.listUiChatMessages()
  }));

  app.get("/api/channels/wechat/messages", async () => ({
    messages: await channelService.listWeChatMessages()
  }));

  app.get("/api/channels/wechat/lifecycle-audit", async (request, reply) => {
    const parsed = LifecycleAuditQuerySchema.safeParse(request.query ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid lifecycle audit query",
        issues: parsed.error.flatten()
      });
    }

    return reply.send({
      items: await channelService.listWeChatLifecycleAudit(parsed.data.limit)
    });
  });

  app.get("/api/channels/wechat/agent", async (request, reply) => {
    const parsed = AgentQuerySchema.safeParse(request.query ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent session query",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.getAgentSession(parsed.data.senderId));
  });

  app.get("/api/channels/wechat/agent/sessions", async () => ({
    sessions: await channelService.listAgentSessions()
  }));

  app.post("/api/channels/wechat/agent/role", async (request, reply) => {
    const parsed = AgentRoleSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent role request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.setAgentRole(parsed.data.senderId, parsed.data.roleId));
  });

  app.post("/api/channels/wechat/agent/skills", async (request, reply) => {
    const parsed = AgentSkillsSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent skills request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.setAgentSkills(parsed.data.senderId, parsed.data.skillIds));
  });

  app.post("/api/channels/wechat/agent/model", async (request, reply) => {
    const parsed = AgentModelSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent model request",
        issues: parsed.error.flatten()
      });
    }

    const providerId = parsed.data.providerId?.trim();
    const modelId = parsed.data.modelId?.trim();
    if (!providerId && !modelId) {
      return reply.send(await channelService.clearAgentModel(parsed.data.senderId));
    }
    if (!providerId || !modelId) {
      return reply.code(400).send({
        message: "Both providerId and modelId are required unless resetting to default."
      });
    }

    return reply.send(await channelService.setAgentModel(parsed.data.senderId, providerId, modelId));
  });

  app.post("/api/channels/wechat/agent/fallbacks", async (request, reply) => {
    const parsed = AgentFallbacksSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent fallback request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.setAgentFallbacks(parsed.data.senderId, parsed.data.routes));
  });

  app.post("/api/channels/wechat/agent/reasoning", async (request, reply) => {
    const parsed = AgentReasoningSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid agent reasoning request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.setAgentReasoning(parsed.data.senderId, parsed.data.reasoningEffort));
  });

  app.post("/api/channels/wechat/login/start", async (request, reply) => {
    const parsed = LoginStartSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid login request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.startWeChatLogin(parsed.data.force, parsed.data.displayName));
  });

  app.post("/api/channels/wechat/login/complete", async (request, reply) => {
    const parsed = LoginCompleteSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid login completion request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.completeWeChatLogin(parsed.data.displayName));
  });

  app.post("/api/channels/wechat/logout", async () => channelService.logoutWeChat());

  app.post("/api/channels/wechat/chat", async (request, reply) => {
    const parsed = InboundSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid local chat payload",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.receiveUiChatMessage(parsed.data));
  });

  app.post("/api/channels/wechat/inbound", async (request, reply) => {
    const parsed = InboundSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid WeChat inbound payload",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await channelService.receiveWeChatMessage(parsed.data));
  });
}
