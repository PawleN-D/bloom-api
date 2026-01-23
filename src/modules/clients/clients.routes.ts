// src/modules/clients/clients.routes.ts
import { FastifyInstance } from 'fastify'
import * as clientsController from './clients.controller'
import * as tasksController from '../tasks/tasks.controller'
import * as notesController from '../notes/notes.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'

export async function clientsRoutes(server: FastifyInstance) {
  server.addHook('preHandler', authMiddleware)

  // List clients for logged-in worker
  server.get('/', clientsController.listClients)

  // Get single client
  server.get('/:id', clientsController.getClient)

  // Get tasks for client
  server.get('/:id/tasks', tasksController.getClientTasks)

   server.get('/:id/notes', notesController.getClientNotes)

  // Create client (admin only - we'll add role check later)
  server.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['firstName', 'lastName'],
        properties: {
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          dateOfBirth: { type: 'string', format: 'date' },
          address: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
          conditions: { type: 'array', items: { type: 'string' } },
          allergies: { type: 'array', items: { type: 'string' } },
          carePlan: { type: 'string' },
          emergencyContactName: { type: 'string' },
          emergencyContactPhone: { type: 'string' },
          emergencyContactRelation: { type: 'string' }
        }
      }
    }
  }, clientsController.createClient)

  // Update client (admin only - we'll add role check later)
  server.patch('/:id', clientsController.updateClient)

  // Delete client (admin only - we'll add role check later)
  server.delete('/:id', clientsController.deleteClient)
}