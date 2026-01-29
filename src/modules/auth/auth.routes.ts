import { FastifyInstance } from 'fastify'
import * as authController from './auth.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'

export async function authRoutes(server: FastifyInstance) {
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

  // Get current user (protected route)
  server.get('/me', {
    schema: {
      tags: ['Auth'],
    },
    preHandler: authMiddleware
  }, authController.getMe)
}
