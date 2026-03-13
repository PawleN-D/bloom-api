import { createServer } from "./app";
import { config } from "./config/env";
import { startComplianceJobs, stopComplianceJobs } from "./shared/jobs";

const serverPromise = createServer();
let isShuttingDown = false;

async function gracefulShutdown(signal: string, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const server = await serverPromise;
  server.log.info({ signal }, "Shutdown initiated");
  try {
    await server.close();
    await stopComplianceJobs();
    server.log.info("Server closed");
  } catch (error) {
    server.log.error({ err: error }, "Error while closing server");
  } finally {
    process.exit(exitCode);
  }
}

async function start() {
  const server = await serverPromise;
  try {
    await server.listen({
      port: config.port,
      host: "0.0.0.0",
    });

    await startComplianceJobs(server.log).catch((error) => {
      server.log.error({ err: error }, "Failed to start compliance jobs");
    });

    server.log.info(
      { port: config.port, env: config.nodeEnv },
      "Server started"
    );
    server.log.debug({ routes: server.printRoutes() }, "Registered routes");
  } catch (err) {
    server.log.fatal({ err }, "Failed to start server");
    await gracefulShutdown("startup-failure", 1);
  }
}

const signals = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    await gracefulShutdown(signal, 0);
  });
});

process.on("unhandledRejection", async (reason) => {
  const server = await serverPromise;
  server.log.fatal({ err: reason }, "Unhandled promise rejection");
  await gracefulShutdown("unhandledRejection", 1);
});

process.on("uncaughtException", async (error) => {
  const server = await serverPromise;
  server.log.fatal({ err: error }, "Uncaught exception");
  await gracefulShutdown("uncaughtException", 1);
});

start();
