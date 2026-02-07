import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Bloom HQ admin middleware
 * Requires SUPER_ADMIN or HQ ADMIN (ADMIN with no organization).
 */
export async function isBloomHQAdmin(
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

  const isHqAdmin = user.role === 'ADMIN' && !user.organizationId;

  if (!user.globalAdmin && !isHqAdmin) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Bloom HQ admin access required',
    });
  }
}
