// src/modules/notes/notes.routes.ts
import { FastifyInstance } from 'fastify'
import * as notesController from './notes.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'

export async function notesRoutes(server: FastifyInstance) {
  server.addHook('preHandler', authMiddleware)

  // List notes for worker
  server.get('/', notesController.listNotes)

  // Create note
  server.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['content', 'clientId'],
        properties: {
          content: { type: 'string', minLength: 1 },
          category: { 
            type: 'string',
            enum: ['PROGRESS', 'OBSERVATION', 'INCIDENT', 'COMMUNICATION', 'GENERAL']
          },
          clientId: { type: 'string' }
        }
      }
    }
  }, notesController.createNote)
}