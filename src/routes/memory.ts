import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { MemoryCompactionService } from "../services/memoryCompactionService.js";
import type { MemoryRecallService } from "../services/memoryRecallService.js";
import type { MemoryService } from "../services/memoryService.js";

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional()
});
const RecallQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  includeWorkspace: z.coerce.boolean().optional(),
  includeArtifacts: z.coerce.boolean().optional()
});
const CompactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const FileQuerySchema = z.object({
  path: z.string().trim().min(1)
});

const RememberSchema = z.object({
  scope: z.enum(["long-term", "daily"]),
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1),
  source: z.string().trim().min(1).optional()
});

const CompactBodySchema = z.object({
  olderThanDays: z.coerce.number().int().min(1).max(365).optional(),
  minEntries: z.coerce.number().int().min(2).max(50).optional(),
  maxEntries: z.coerce.number().int().min(2).max(50).optional(),
  dryRun: z.coerce.boolean().optional()
});

const PolicyPatchSchema = z.object({
  autoCompactionEnabled: z.coerce.boolean().optional(),
  autoCompactionIntervalMinutes: z.coerce.number().int().min(5).max(24 * 60).optional(),
  autoCompactionOlderThanDays: z.coerce.number().int().min(1).max(365).optional(),
  autoCompactionMinEntries: z.coerce.number().int().min(2).max(50).optional(),
  autoCompactionMaxEntries: z.coerce.number().int().min(2).max(100).optional(),
  maxDailyEntriesBeforeAutoCompact: z.coerce.number().int().min(3).max(500).optional(),
  neverCompactTags: z.array(z.string().trim().min(1)).optional(),
  highConfidenceLongTermOnly: z.coerce.boolean().optional()
});

export async function registerMemoryRoutes(
  app: FastifyInstance,
  memoryService: MemoryService,
  memoryRecallService: MemoryRecallService,
  memoryCompactionService: MemoryCompactionService,
  onPolicyUpdated?: (() => Promise<void>) | undefined
): Promise<void> {
  app.get("/api/memory/status", async () => memoryService.getStatus());
  app.get("/api/memory/policy", async () => memoryCompactionService.getPolicy());

  app.get("/api/memory/files", async () => ({
    files: await memoryService.listFiles()
  }));

  app.get("/api/memory/file", async (request, reply) => {
    const parsed = FileQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory file path",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await memoryService.getFile(parsed.data.path));
  });

  app.get("/api/memory/search", async (request, reply) => {
    const parsed = SearchQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory search query",
        issues: parsed.error.flatten()
      });
    }

    return reply.send({
      query: parsed.data.q,
      results: await memoryService.search(parsed.data.q, parsed.data.limit)
    });
  });

  app.get("/api/memory/recall", async (request, reply) => {
    const parsed = RecallQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory recall query",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await memoryRecallService.recall(parsed.data.q, {
      limit: parsed.data.limit,
      includeWorkspace: parsed.data.includeWorkspace,
      includeArtifacts: parsed.data.includeArtifacts
    }));
  });

  app.get("/api/memory/compactions", async (request, reply) => {
    const parsed = CompactionsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory compaction query",
        issues: parsed.error.flatten()
      });
    }

    return reply.send({
      items: await memoryCompactionService.listRecent(parsed.data.limit ?? 20)
    });
  });

  app.post("/api/memory/remember", async (request, reply) => {
    const parsed = RememberSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory write request",
        issues: parsed.error.flatten()
      });
    }

    return reply.code(201).send(await memoryService.remember(parsed.data));
  });

  app.post("/api/memory/compact", async (request, reply) => {
    const parsed = CompactBodySchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory compaction request",
        issues: parsed.error.flatten()
      });
    }

    return reply.send(await memoryCompactionService.compact({
      source: "manual",
      ...parsed.data
    }));
  });

  app.put("/api/memory/policy", async (request, reply) => {
    const parsed = PolicyPatchSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid memory policy update",
        issues: parsed.error.flatten()
      });
    }

    const policy = await memoryCompactionService.updatePolicy(parsed.data);
    if (onPolicyUpdated) {
      await onPolicyUpdated();
    }
    return reply.send(policy);
  });
}
