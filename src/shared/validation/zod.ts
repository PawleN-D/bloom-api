import { FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';

export function validateZod<T>(
  schema: ZodSchema<T>,
  data: unknown,
  reply: FastifyReply
): T | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    reply.status(400).send({
      error: 'Validation error',
      details: parsed.error.flatten(),
    });
    return null;
  }

  return parsed.data;
}
