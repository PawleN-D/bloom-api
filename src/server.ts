import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config/env";
import { setupSwagger } from "./config/swagger";
import {
  defaultDatabaseRequestContext,
  setDatabaseRequestContext,
} from "./shared/database/request-context";

const server = Fastify({
  logger: {
    level: config.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "headers.authorization",
        "headers.cookie",
        "body.password",
        "body.pin",
      ],
      censor: "[REDACTED]",
    },
    transport:
      config.nodeEnv === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  },
});

async function registerPlugins() {
  server.addHook("onRequest", async () => {
    setDatabaseRequestContext({ ...defaultDatabaseRequestContext });
  });

  await server.register(cors, {
    origin: config.nodeEnv === "development" ? true : config.frontendUrls,
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
  });
}

async function registerRoutes() {
  server.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  const { authRoutes } = await import("./modules/auth/auth.routes");
  await server.register(authRoutes, { prefix: "/api/auth" });

  const { clientsRoutes } = await import("./modules/clients/clients.routes");
  await server.register(clientsRoutes, { prefix: "/api/clients" });

  const { tasksRoutes } = await import("./modules/tasks/tasks.routes");
  await server.register(tasksRoutes, { prefix: "/api/tasks" });

  const { notesRoutes } = await import("./modules/notes/notes.routes");
  await server.register(notesRoutes, { prefix: "/api/notes" });

  const { usersRoutes } = await import("./modules/users/users.routes");
  await server.register(usersRoutes, { prefix: "/api/users" });

  const { organizationsRoutes } = await import(
    "./modules/organizations/organizations.routes"
  );
  await server.register(organizationsRoutes, { prefix: "/api/organization" });

  const { organizationsPublicRoutes } = await import(
    "./modules/organizations/organizations.public.routes"
  );
  await server.register(organizationsPublicRoutes, {
    prefix: "/api/organizations",
  });

  const { adminRoutes } = await import("./modules/admin/admin.routes");
  await server.register(adminRoutes, { prefix: "/api/admin" });

  const { hqRoutes } = await import("./modules/hq/hq.routes");
  await server.register(hqRoutes, { prefix: "/api/hq" });

  const { backofficeOrganizationsRoutes } = await import(
    "./modules/backoffice/organizations/organizations.routes"
  );
  await server.register(backofficeOrganizationsRoutes, {
    prefix: "/api/backoffice",
  });

  const { reportsRoutes } = await import("./modules/reports/reports.routes");
  await server.register(reportsRoutes, { prefix: "/api/reports" });

  const { managerRoutes } = await import("./modules/manager/manager.routes");
  await server.register(managerRoutes, { prefix: "/api/manager" });

  const { notificationsRoutes } = await import(
    "./modules/notifications/notifications.routes"
  );
  await server.register(notificationsRoutes, { prefix: "/api/notifications" });
}

let isShuttingDown = false;

async function gracefulShutdown(signal: string, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  server.log.info({ signal }, "Shutdown initiated");
  try {
    await server.close();
    server.log.info("Server closed");
  } catch (error) {
    server.log.error({ err: error }, "Error while closing server");
  } finally {
    process.exit(exitCode);
  }
}

async function start() {
  try {
    await registerPlugins();
    await setupSwagger(server);
    await registerRoutes();

    await server.listen({
      port: config.port,
      host: "0.0.0.0",
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
  server.log.fatal({ err: reason }, "Unhandled promise rejection");
  await gracefulShutdown("unhandledRejection", 1);
});

process.on("uncaughtException", async (error) => {
  server.log.fatal({ err: error }, "Uncaught exception");
  await gracefulShutdown("uncaughtException", 1);
});

start();
