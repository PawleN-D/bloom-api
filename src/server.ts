import { createServer } from "node:http";
import app from "./app";
import { config } from "./config/env";

const server = createServer(async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? `localhost:${config.port}`;
  const url = `${protocol}://${host}${req.url ?? "/"}`;
  const body = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: body.length > 0 ? new Uint8Array(body) : undefined,
  });

  const response = await app.fetch(request, process.env, undefined as any);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const responseBuffer = Buffer.from(await response.arrayBuffer());
  res.end(responseBuffer);
});

server.listen(config.port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.info(`Bloom API listening on ${config.port}`);
});
