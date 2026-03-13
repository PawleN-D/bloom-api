import { FastifyInstance } from "@/shared/http/compat";

export async function setupSwagger(_server: FastifyInstance) {
  // Swagger registration was tied to Fastify plugins and is intentionally disabled
  // during the Hono migration. Reintroduce docs using Hono OpenAPI tooling.
}
