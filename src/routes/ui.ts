import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { readGatewayLogSnapshot } from "../gatewayService.js";
import { resolvePackagePath } from "../packagePaths.js";

const webRoot = resolvePackagePath("web");
const runtimeRoot = process.cwd();

async function serveWebFile(_app: FastifyInstance, replyPath: string) {
  return readFile(path.join(webRoot, replyPath), "utf8");
}

async function readLatestLog(pattern: RegExp, lines: number): Promise<{ path: string | null; content: string }> {
  const entries = await readdir(runtimeRoot, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  const latest = matches[0] ?? null;
  if (!latest) {
    return {
      path: null,
      content: "",
    };
  }

  const fullPath = path.join(runtimeRoot, latest);
  const raw = await readFile(fullPath, "utf8");
  const tail = raw.split(/\r?\n/u).slice(-lines).join("\n").trim();
  return {
    path: latest,
    content: tail,
  };
}

export async function registerUiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, reply) => {
    const html = await serveWebFile(app, "index.html");
    reply.header("Cache-Control", "no-store, max-age=0");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/i18n.js", async (_request, reply) => {
    const javascript = await serveWebFile(app, "i18n.js");
    reply.header("Cache-Control", "no-store, max-age=0");
    return reply.type("application/javascript; charset=utf-8").send(javascript);
  });

  app.get("/app.js", async (_request, reply) => {
    const javascript = await serveWebFile(app, "app.js");
    reply.header("Cache-Control", "no-store, max-age=0");
    return reply.type("application/javascript; charset=utf-8").send(javascript);
  });

  app.get("/styles.css", async (_request, reply) => {
    const css = await serveWebFile(app, "styles.css");
    reply.header("Cache-Control", "no-store, max-age=0");
    return reply.type("text/css; charset=utf-8").send(css);
  });

  app.get("/api/ui/runtime-log", async (request) => {
    const rawLines = Number((request.query as { lines?: string | number } | undefined)?.lines ?? 120);
    const lines = Number.isFinite(rawLines) ? Math.max(20, Math.min(400, Math.trunc(rawLines))) : 120;
    const gatewayLogs = await readGatewayLogSnapshot(lines);
    if (gatewayLogs.source === "gateway-daemon") {
      return {
        lines,
        source: gatewayLogs.source,
        stdout: gatewayLogs.stdout,
        stderr: gatewayLogs.stderr,
        ts: Date.now(),
      };
    }
    const [stdoutLog, stderrLog] = await Promise.all([
      readLatestLog(/^\.reagent-server-.*\.out\.log$/u, lines),
      readLatestLog(/^\.reagent-server-.*\.err\.log$/u, lines),
    ]);

    return {
      lines,
      source: "cwd-runtime",
      stdout: stdoutLog,
      stderr: stderrLog,
      ts: Date.now(),
    };
  });
}
