import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { TasksService } from './tasks.service';

export async function tasksRoutes(server: FastifyInstance) {
  const tasksService = new TasksService();

  server.get('/', {
    schema: {
      tags: ['Tasks'],
      summary: 'List tasks',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK),
    ],
  }, async (request) => {
    const tasks = await tasksService.getTasks(request, request.query);
    return { data: tasks };
  });

  server.get('/:id', {
    schema: {
      tags: ['Tasks'],
      summary: 'Get task by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK),
    ],
  }, async (request: any) => {
    return {
      data: await tasksService.getTask(request, request.params.id),
    };
  });

  server.post('/', {
    schema: {
      tags: ['Tasks'],
      summary: 'Create task',
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_TASK),
    ],
  }, async (request: any, reply) => {
    const task = await tasksService.createTask(request, request.body);
    return reply.code(201).send({ data: task });
  });

  server.put('/:id', {
    schema: {
      tags: ['Tasks'],
      summary: 'Update task',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK),
    ],
  }, async (request: any, reply) => {
    const task = await tasksService.updateTask(
      request,
      request.params.id,
      request.body
    );
    return reply.send({ data: task });
  });

  server.delete('/:id', {
    schema: {
      tags: ['Tasks'],
      summary: 'Delete task',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_TASK),
    ],
  }, async (request: any, reply) => {
    const result = await tasksService.deleteTask(request, request.params.id);
    return reply.send(result);
  });

  server.post('/:id/complete', {
    schema: {
      tags: ['Tasks'],
      summary: 'Complete task',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string' },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK),
    ],
  }, async (request: any, reply) => {
    const result = await tasksService.completeTask(
      request,
      request.params.id,
      request.body?.notes
    );
    return reply.send(result);
  });
}
