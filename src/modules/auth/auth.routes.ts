import { FastifyInstance } from 'fastify'
import * as authController from './auth.controller'

export async function authRoutes(server: FastifyInstance) {
  // Register user
  server.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          role: { type: 'string', enum: ['WORKER', 'ADMIN'] }
        }
      }
    }
  }, authController.register)

  // Login
  server.post('/login', {
    schema: {
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

  // Get current user (we'll add auth middleware later)
  server.get('/me', authController.getMe)
}