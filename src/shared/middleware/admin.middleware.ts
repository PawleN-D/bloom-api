import { FastifyRequest, FastifyReply } from '@/shared/http/compat'

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user

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
