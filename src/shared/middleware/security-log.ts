import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';

export async function securityLogHook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user;
  if (!user) {
    return;
  }

  const forwardedFor = request.headers['x-forwarded-for'];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor as string | undefined)?.split(',')[0]?.trim() || request.ip || null;

  const action = `${request.method} ${request.routerPath ?? request.url}`.trim();

  try {
    await prisma.securityLog.create({
      data: {
        userId: user.id,
        organizationId: request.organization?.id ?? null,
        action,
        statusCode: reply.statusCode,
        ipAddress,
        userAgent: (request.headers['user-agent'] as string) || null,
        metadata: {
          params: request.params ?? null,
          query: request.query ?? null,
        },
        createdAt: new Date(),
      },
    });
  } catch {
  }
}
