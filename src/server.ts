import { env } from "./config/env.js";
import { createApp } from "./app.js";

const app = await createApp();

const FORCE_SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

async function shutdown(reason: string, exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ reason }, "Shutting down ReAgent.");

  const forceTimer = setTimeout(() => {
    app.log.error({ reason }, "Graceful shutdown timed out. Exiting forcefully.");
    process.exit(1);
  }, FORCE_SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    await app.close();
    process.exit(exitCode);
  } catch (error) {
    app.log.error({ err: error, reason }, "Failed to close ReAgent cleanly.");
    process.exit(1);
  } finally {
    clearTimeout(forceTimer);
  }
}

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT", 0);
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM", 0);
  });

  process.on("uncaughtException", (error) => {
    app.log.error({ err: error }, "Uncaught exception.");
    void shutdown("uncaughtException", 1);
  });

  process.on("unhandledRejection", (reason) => {
    app.log.error({ err: reason }, "Unhandled promise rejection.");
    void shutdown("unhandledRejection", 1);
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
