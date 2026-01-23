import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config/env";

// Create Fastify instance
const server = Fastify({
  logger: {
    level: config.logLevel,
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
  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });
}

// Register routes
async function registerRoutes() {
  // Health check
  server.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  const { authRoutes } = await import("./modules/auth/auth.routes");
  await server.register(authRoutes, { prefix: "/api/auth" });

  const { clientsRoutes } = await import("./modules/clients/clients.routes");
  await server.register(clientsRoutes, { prefix: "/api/clients" });

  const { tasksRoutes } = await import("./modules/tasks/tasks.routes");
  await server.register(tasksRoutes, { prefix: "/api/tasks" });
}

// Start server
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    await server.listen({
      port: config.port,
      host: "0.0.0.0", // Important for Railway deployment
    });

    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);

    server.printRoutes();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
const signals = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, closing server...`);
    await server.close();
    process.exit(0);
  });
});

start();
