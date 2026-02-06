import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';

/**
 * Manager-only authorization middleware
 * Allows MANAGER or ADMIN roles only.
 */
export async function verifyManager(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user;

  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const allowedRoles = [UserRole.MANAGER, UserRole.ADMIN];
  if (!allowedRoles.includes(user.role)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Manager or Admin role required',
    });
  }
}
