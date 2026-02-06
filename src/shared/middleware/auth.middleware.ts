import { FastifyRequest, FastifyReply } from 'fastify'
import { JWTService } from '../../modules/auth/jwt.service'

const jwtService = new JWTService()

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization
    
    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        error: 'No token provided'
      })
    }

    // Extract token (format: "Bearer TOKEN")
    const token = authHeader.replace('Bearer ', '')
    
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid token format'
      })
    }

    // Verify token
    const decoded = jwtService.verifyToken(token);
    
    if (decoded.type && decoded.type !== 'access') {
      return reply.status(401).send({
        success: false,
        error: 'Invalid token type'
      })
    }

    // Attach user to request
    const normalizedRole =
      decoded.role === 'CARE_WORKER' ? 'WORKER' : decoded.role

    request.user = {
      id: decoded.userId,
      email: decoded.email,
      role: normalizedRole,
      organizationId: decoded.organizationId ?? null,
      globalAdmin: decoded.globalAdmin ?? false,
    }

  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token'
    })
  }
}
