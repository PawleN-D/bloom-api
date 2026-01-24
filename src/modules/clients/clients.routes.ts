// src/modules/clients/clients.routes.ts
import { FastifyInstance } from 'fastify'
import * as clientsController from './clients.controller'
import * as tasksController from '../tasks/tasks.controller'
import * as notesController from '../notes/notes.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { adminMiddleware } from '../../shared/middleware/admin.middleware'

export async function clientsRoutes(server: FastifyInstance) {
  // All routes require authentication
  server.addHook('preHandler', authMiddleware)

  // List clients for logged-in worker
  server.get('/', clientsController.listClients)

  // Get single client
  server.get('/:id', clientsController.getClient)

  // Get tasks for client
  server.get('/:id/tasks', tasksController.getClientTasks)

  // Get notes for client
  server.get('/:id/notes', notesController.getClientNotes)

  // Create client (ADMIN ONLY)
  server.post('/', {
    preHandler: [adminMiddleware]
  }, clientsController.createClient)

  // Update client (ADMIN ONLY)
  server.patch('/:id', {
    preHandler: [adminMiddleware]
  }, clientsController.updateClient)

  // Delete client (ADMIN ONLY)
  server.delete('/:id', {
    preHandler: [adminMiddleware]
  }, clientsController.deleteClient)
}