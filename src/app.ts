import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config/env";
import { setupSwagger } from "./config/swagger";
import {
  defaultDatabaseRequestContext,
  setDatabaseRequestContext,
} from "./shared/database/request-context";
import { securityLogHook } from "./shared/middleware/security-log";

export async function createServer(): Promise<FastifyInstance> {
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

  server.addHook("onRequest", async () => {
    setDatabaseRequestContext({ ...defaultDatabaseRequestContext });
  });
  server.addHook("onResponse", securityLogHook);

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

  await setupSwagger(server);
  await registerRoutes(server);

  return server;
}

async function registerRoutes(server: FastifyInstance) {
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

  const { incidentsRoutes } = await import("./modules/incidents/incidents.routes");
  await server.register(incidentsRoutes, { prefix: "/api/incidents" });

  const { complianceRoutes } = await import("./modules/compliance/compliance.routes");
  await server.register(complianceRoutes, { prefix: "/api/compliance" });

  const { medicationsRoutes } = await import("./modules/medications/medications.routes");
  await server.register(medicationsRoutes, { prefix: "/api/medications" });

  const { auditTrailRoutes } = await import("./modules/audit-trail/audit-trail.routes");
  await server.register(auditTrailRoutes, { prefix: "/api/audit-trail" });
}
