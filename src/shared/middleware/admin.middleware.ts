import { FastifyRequest, FastifyReply } from 'fastify'

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user

  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required'
    })
  }

  if (user.role !== 'ADMIN') {
    return reply.status(403).send({
      success: false,
      error: 'Admin access required'
    })
  }

}