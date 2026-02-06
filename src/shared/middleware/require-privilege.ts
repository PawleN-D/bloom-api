import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { isPrivilegedRole } from '../constants/privileged-roles';

async function logSecurityAccess(request: FastifyRequest) {
  const user = request.user;
  if (!user) {
    return;
  }

  const action = `${request.method} ${request.url ?? request.raw.url ?? ''}`.trim();

  try {
    await prisma.securityLog.create({
      data: {
        userId: user.id,
        organizationId: request.organization?.id ?? null,
        action,
        createdAt: new Date(),
      },
    });
  } catch {
    // Best-effort logging for audit trails
  }
}

/**
 * Privileged access middleware
 * Allows ADMIN or MANAGER roles only.
 */
export async function requirePrivilege(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await logSecurityAccess(request);

  const user = request.user;
  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (!isPrivilegedRole(user.role)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access denied: Requires Management permissions.',
    });
  }
}
