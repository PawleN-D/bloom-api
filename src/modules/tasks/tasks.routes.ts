import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { TasksService } from './tasks.service';

export async function tasksRoutes(server: FastifyInstance) {
  const tasksService = new TasksService();
  
  // GET /api/tasks
  server.get('/api/tasks', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK)
    ]
  }, async (request, reply) => {
    try {
      const tasks = await tasksService.getTasks(request, request.query);
      return reply.send({ data: tasks });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/tasks/:id
  server.get('/api/tasks/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const task = await tasksService.getTask(request, id);
      return reply.send({ data: task });
    } catch (error: any) {
      const status = error.message === 'Task not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/tasks
  server.post('/api/tasks', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_TASK)
    ]
  }, async (request, reply) => {
    try {
      const task = await tasksService.createTask(request, request.body);
      return reply.status(201).send({ data: task });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // PUT /api/tasks/:id
  server.put('/api/tasks/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const task = await tasksService.updateTask(request, id, request.body);
      return reply.send({ data: task });
    } catch (error: any) {
      const status = error.message === 'Task not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // DELETE /api/tasks/:id
  server.delete('/api/tasks/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_TASK)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await tasksService.deleteTask(request, id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Task not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/tasks/:id/complete
  server.post('/api/tasks/:id/complete', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.COMPLETE_TASK)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { notes } = request.body as any;
      const result = await tasksService.completeTask(request, id, notes);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Task not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/tasks/:id/assign
  server.post('/api/tasks/:id/assign', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.ASSIGN_TASK)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { userId } = request.body as any;
      const result = await tasksService.assignTask(request, id, userId);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}