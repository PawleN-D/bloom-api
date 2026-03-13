import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createRequestPrismaClient } from "./shared/database/prisma";
import {
  defaultDatabaseRequestContext,
  runWithRequestContext,
  setDatabaseRequestContext,
} from "./shared/database/request-context";
import { securityLogHook } from "./shared/middleware/security-log";

type HookName = "onRequest" | "onResponse";
type RouteOptions = {
  preHandler?: Array<(request: any, reply: any) => Promise<unknown> | unknown>;
  schema?: unknown;
};

type FastifyStyleHandler = (request: any, reply: any) => Promise<unknown> | unknown;

function createBridge(app: Hono, prefix = "", hooks?: {
  onRequest: FastifyStyleHandler[];
  onResponse: FastifyStyleHandler[];
}) {
  const sharedHooks = hooks ?? { onRequest: [], onResponse: [] };

  const addRoute = (method: "get" | "post" | "put" | "patch" | "delete") => {
    return (path: string, optionsOrHandler: RouteOptions | FastifyStyleHandler, maybeHandler?: FastifyStyleHandler) => {
      const options: RouteOptions = typeof optionsOrHandler === "function" ? {} : optionsOrHandler;
      const handler: FastifyStyleHandler =
        typeof optionsOrHandler === "function" ? optionsOrHandler : (maybeHandler as FastifyStyleHandler);
      const fullPath = `${prefix}${path === "/" ? "" : path}` || "/";

      app[method](fullPath, async (c) => {
        let response: Response | null = null;
        const bodyText = ["GET", "HEAD"].includes(c.req.method) ? "" : await c.req.text();

        const request: any = {
          method: c.req.method,
          url: c.req.url,
          routerPath: fullPath,
          headers: Object.fromEntries(c.req.raw.headers.entries()),
          query: c.req.query(),
          params: c.req.param(),
          ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          body: undefined,
          user: undefined,
          organization: undefined,
          log: {
            info: (...args: unknown[]) => console.info(...args),
            warn: (...args: unknown[]) => console.warn(...args),
            error: (...args: unknown[]) => console.error(...args),
            debug: (...args: unknown[]) => console.debug(...args),
          },
        };

        if (bodyText) {
          try {
            request.body = JSON.parse(bodyText);
          } catch {
            request.body = bodyText;
          }
        }

        const reply: any = {
          statusCode: 200,
          headers: new Headers(),
          sent: false,
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          code(code: number) {
            return this.status(code);
          },
          header(name: string, value: string) {
            this.headers.set(name, value);
            return this;
          },
          send(payload: unknown) {
            this.sent = true;
            if (payload instanceof Response) {
              response = payload;
              return response;
            }

            if (typeof payload === "string") {
              response = new Response(payload, { status: this.statusCode, headers: this.headers });
              return response;
            }

            response = c.json(payload as any, this.statusCode, this.headers);
            return response;
          },
        };

        const runHandlers = async (handlers: FastifyStyleHandler[]) => {
          for (const h of handlers) {
            await h(request, reply);
            if (reply.sent) break;
          }
        };

        await runHandlers(sharedHooks.onRequest);
        if (!reply.sent) {
          await runHandlers(options.preHandler ?? []);
        }

        if (!reply.sent) {
          const result = await handler(request, reply);
          if (!reply.sent && result !== undefined) {
            reply.send(result);
          }
        }

        await runHandlers(sharedHooks.onResponse);

        return response ?? new Response(null, { status: reply.statusCode, headers: reply.headers });
      });
    };
  };

  return {
    addHook(name: HookName, hook: FastifyStyleHandler) {
      sharedHooks[name].push(hook);
    },
    async register(plugin: (instance: any) => Promise<void> | void, opts?: { prefix?: string }) {
      const child = createBridge(app, `${prefix}${opts?.prefix ?? ""}`, sharedHooks);
      await plugin(child);
    },
    get: addRoute("get"),
    post: addRoute("post"),
    put: addRoute("put"),
    patch: addRoute("patch"),
    delete: addRoute("delete"),
  };
}

const app = new Hono();

app.use("*", cors({
  origin: "*",
  credentials: true,
}));

app.use("*", secureHeaders());

app.use("*", async (c, next) => {
  const prisma = createRequestPrismaClient(c.env as { HYPERDRIVE?: { connectionString: string } });
  return runWithRequestContext(
    {
      env: c.env,
      prisma,
      database: { ...defaultDatabaseRequestContext },
    },
    async () => {
      setDatabaseRequestContext({ ...defaultDatabaseRequestContext });
      await next();
      c.executionCtx?.waitUntil(prisma.$disconnect());
    }
  );
});

const server = createBridge(app);
server.addHook("onResponse", securityLogHook);

server.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

const registerRoutes = async () => {
  const { authRoutes } = await import("./modules/auth/auth.routes");
  await server.register(authRoutes as any, { prefix: "/api/auth" });

  const { clientsRoutes } = await import("./modules/clients/clients.routes");
  await server.register(clientsRoutes as any, { prefix: "/api/clients" });

  const { tasksRoutes } = await import("./modules/tasks/tasks.routes");
  await server.register(tasksRoutes as any, { prefix: "/api/tasks" });

  const { notesRoutes } = await import("./modules/notes/notes.routes");
  await server.register(notesRoutes as any, { prefix: "/api/notes" });

  const { usersRoutes } = await import("./modules/users/users.routes");
  await server.register(usersRoutes as any, { prefix: "/api/users" });

  const { organizationsRoutes } = await import("./modules/organizations/organizations.routes");
  await server.register(organizationsRoutes as any, { prefix: "/api/organization" });

  const { organizationsPublicRoutes } = await import("./modules/organizations/organizations.public.routes");
  await server.register(organizationsPublicRoutes as any, { prefix: "/api/organizations" });

  const { adminRoutes } = await import("./modules/admin/admin.routes");
  await server.register(adminRoutes as any, { prefix: "/api/admin" });

  const { hqRoutes } = await import("./modules/hq/hq.routes");
  await server.register(hqRoutes as any, { prefix: "/api/hq" });

  const { backofficeOrganizationsRoutes } = await import("./modules/backoffice/organizations/organizations.routes");
  await server.register(backofficeOrganizationsRoutes as any, { prefix: "/api/backoffice" });

  const { reportsRoutes } = await import("./modules/reports/reports.routes");
  await server.register(reportsRoutes as any, { prefix: "/api/reports" });

  const { managerRoutes } = await import("./modules/manager/manager.routes");
  await server.register(managerRoutes as any, { prefix: "/api/manager" });

  const { notificationsRoutes } = await import("./modules/notifications/notifications.routes");
  await server.register(notificationsRoutes as any, { prefix: "/api/notifications" });

  const { incidentsRoutes } = await import("./modules/incidents/incidents.routes");
  await server.register(incidentsRoutes as any, { prefix: "/api/incidents" });

  const { complianceRoutes } = await import("./modules/compliance/compliance.routes");
  await server.register(complianceRoutes as any, { prefix: "/api/compliance" });

  const { medicationsRoutes } = await import("./modules/medications/medications.routes");
  await server.register(medicationsRoutes as any, { prefix: "/api/medications" });

  const { auditTrailRoutes } = await import("./modules/audit-trail/audit-trail.routes");
  await server.register(auditTrailRoutes as any, { prefix: "/api/audit-trail" });
};

void registerRoutes();

export default app;
