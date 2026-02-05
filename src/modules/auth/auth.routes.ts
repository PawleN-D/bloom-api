import { FastifyInstance, FastifyRequest } from 'fastify'
import * as authController from './auth.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'

export async function authRoutes(server: FastifyInstance) {
  const logAuthMeRequest = async (request: FastifyRequest) => {
    if (process.env.NODE_ENV === 'development') {
      request.log.info(
        {
          origin: request.headers.origin,
          host: request.headers.host,
          hasAuthHeader: Boolean(request.headers.authorization),
        },
        'auth/me request'
      )
    }
  }

  // Register user
  server.post('/register', {
    schema: {
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          role: { type: 'string', enum: ['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN'] },
          organizationId: { type: 'string' }
        }
      }
    }
  }, authController.register)

  // Login
  server.post('/login', {
    schema: {
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, authController.login)

  // Invitation setup
  server.post('/setup', {
    schema: {
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['token', 'password', 'pin'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          pin: { type: 'string', minLength: 4, maxLength: 4 },
        }
      }
    }
  }, authController.setupAccount)

  // Verify PIN and unlock session (protected)
  server.post('/verify-pin', {
    schema: {
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['pin'],
        properties: {
          pin: { type: 'string', minLength: 4, maxLength: 4 },
        }
      }
    },
    preHandler: [authMiddleware],
  }, authController.verifyPin)

  // Get current user (protected route)
  server.get('/me', {
    schema: {
      tags: ['Auth'],
    },
    preHandler: [logAuthMeRequest, authMiddleware]
  }, authController.getMe)
}
