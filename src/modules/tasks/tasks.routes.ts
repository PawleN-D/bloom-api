// src/modules/tasks/tasks.routes.ts
import { FastifyInstance } from 'fastify'
import * as tasksController from './tasks.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'
import { adminMiddleware } from '../../shared/middleware/admin.middleware'

export async function tasksRoutes(server: FastifyInstance) {
  // All routes require authentication
  server.addHook('preHandler', authMiddleware)

  // List tasks for logged-in worker
  server.get('/', tasksController.listTasks)

  // Create task (ADMIN ONLY)
  server.post('/', {
    preHandler: [adminMiddleware]
  }, tasksController.createTask)

  // Complete task (WORKERS can do this)
  server.post('/:id/complete', tasksController.completeTask)
}