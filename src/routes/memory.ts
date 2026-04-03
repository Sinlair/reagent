import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { MemoryService } from "../services/memoryService.js";

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional()
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

export async function registerMemoryRoutes(
  app: FastifyInstance,
  memoryService: MemoryService
): Promise<void> {
  app.get("/api/memory/status", async () => memoryService.getStatus());

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
}
