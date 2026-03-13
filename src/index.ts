import { createServer } from "./app";
import {
  runWithWorkerEnv,
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
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return runWithWorkerEnv(env, async () => {
      const app = await getApp();
      const url = new URL(request.url);
      const bodyBuffer = await request.arrayBuffer();
      const headers: Record<string, string> = {};
      (request.headers as any).forEach((value: string, key: string) => {
        headers[key] = value;
      });

      const reply = await (app.inject as any)({
        method: request.method,
        url: `${url.pathname}${url.search}`,
        headers,
        payload: bodyBuffer.byteLength > 0 ? Buffer.from(bodyBuffer) : undefined,
      });

      return new Response(reply.payload, {
        status: reply.statusCode,
        headers: new Headers(reply.headers),
      });
    });
  },
};
