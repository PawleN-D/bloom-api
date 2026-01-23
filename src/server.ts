import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";

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
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
      },
    },
  });
}

async function registerRoutes() {
     server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // API routes
  await server.register(authRoutes, { prefix: '/api/auth' }) 
}

async function start() {
  try {
    await registerPlugins()
    await registerRoutes()

    await server.listen({
      port: config.port,
      host: '0.0.0.0' // Important for Railway deployment
    })

    console.log(`🚀 Server running on http://localhost:${config.port}`)
    console.log(`📝 Environment: ${config.nodeEnv}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, closing server...`)
    await server.close()
    process.exit(0)
  })
})

start()
