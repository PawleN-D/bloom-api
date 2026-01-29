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
    
    // Attach user to request
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId ?? null,
    }

  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: 'Invalid or expired token'
    })
  }
}
