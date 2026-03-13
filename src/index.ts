import { createServer } from "./app";
import { createRequestPrismaClient } from "./shared/database/prisma";
import {
  defaultDatabaseRequestContext,
  runWithRequestContext,
  type WorkerEnv,
} from "./shared/database/request-context";

let appPromise: ReturnType<typeof createServer> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = createServer().then(async (app) => {
      await app.ready();
      return app;
    });
  }

  return appPromise;
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const prisma = createRequestPrismaClient(env);
    ctx.waitUntil(prisma.$disconnect());

    return runWithRequestContext(
      {
        env,
        prisma,
        database: { ...defaultDatabaseRequestContext },
      },
      async () => {
        const app = await getApp();
        const url = new URL(request.url);
        const bodyBuffer = await request.arrayBuffer();
        const headers: Record<string, string> = {};

        request.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const reply = await app.inject({
          method: request.method as any,
          url: `${url.pathname}${url.search}`,
          headers,
          payload: bodyBuffer.byteLength > 0 ? Buffer.from(bodyBuffer) : undefined,
        });

        return new Response(reply.payload, {
          status: reply.statusCode,
          headers: new Headers(reply.headers as HeadersInit),
        });
      }
    );
  },
};
