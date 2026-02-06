import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Bloom HQ admin middleware
 * Requires JWT with globalAdmin=true.
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

  if (!user.globalAdmin) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Bloom HQ admin access required',
    });
  }
}
