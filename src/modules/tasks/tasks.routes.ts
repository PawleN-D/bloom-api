import { FastifyInstance } from 'fastify'
import * as tasksController from './tasks.controller'
import { authMiddleware } from '../../shared/middleware/auth.middleware'

export async function tasksRoutes(server: FastifyInstance) {
  server.addHook('preHandler', authMiddleware)

  server.get('/', tasksController.listTasks)

  server.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['title', 'clientId'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          category: { 
            type: 'string', 
            enum: ['PERSONAL_CARE', 'MEDICATION', 'MEAL_PREP', 'MOBILITY', 
                   'HOUSEKEEPING', 'COMPANIONSHIP', 'HEALTH_MONITORING', 'GENERAL']
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT']
          },
          clientId: { type: 'string' },
          isRecurring: { type: 'boolean' },
          dueDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, tasksController.createTask)

  server.post('/:id/complete', {
    schema: {
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string' }
        }
      }
    }
  }, tasksController.completeTask)
}