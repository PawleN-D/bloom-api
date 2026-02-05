import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { TasksService } from './tasks.service';
import { z } from 'zod';

export async function tasksRoutes(server: FastifyInstance) {
  const tasksService = new TasksService();
  const logSchema = z.object({
    taskId: z.string().min(1),
    status: z.enum(['COMPLETE', 'INCOMPLETE', 'REFUSED']).optional(),
    notes: z.string().optional(),
    refusalReason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    originalLogId: z.string().optional(),
    editReason: z.string().optional(),
  }).refine((data) => {
    if (data.status === 'INCOMPLETE' || data.status === 'REFUSED') {
      return Boolean(data.refusalReason);
    }
    return true;
  }, {
    path: ['refusalReason'],
    message: 'refusalReason is required for incomplete or refused statuses',
  }).refine((data) => {
    if (data.originalLogId) {
      return Boolean(data.editReason);
    }
    return true;
  }, {
    path: ['editReason'],
    message: 'editReason is required when originalLogId is provided',
  });

  const medicationRefusalHook = async (request: any) => {
    if (request.routerPath !== '/:id/complete') {
      return;
    }

    const status = request.body?.status;
    if (status !== 'REFUSED') {
      return;
    }

    const task = await tasksService.getTask(request, request.params.id);
    if (task.category === 'MEDICATION') {
      request.log.warn(
        {
          taskId: task.id,
          clientId: task.clientId,
          category: task.category,
          status,
        },
        'Critical alert hook triggered: medication task refused'
      );
    }
  };

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

  server.get('/audit-export', {
    schema: {
      tags: ['Tasks'],
      summary: 'Generate narrative care audit export payload',
      querystring: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
        },
        required: ['clientId', 'startDate', 'endDate'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK),
    ],
  }, async (request: any) => {
    const { clientId, startDate, endDate } = request.query;
    const report = await tasksService.getNarrativeAuditReport(request, clientId, startDate, endDate);
    return { data: report };
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
          status: {
            type: 'string',
            enum: ['COMPLETE', 'INCOMPLETE', 'REFUSED'],
          },
          refusalReason: { type: 'string' },
          signatureSvg: { type: 'string' },
          initials: { type: 'string' },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK),
      medicationRefusalHook,
    ],
  }, async (request: any, reply) => {
    const result = await tasksService.completeTask(request, request.params.id, request.body || {});
    return reply.send(result);
  });

  // POST /api/tasks/log - Immutable task log (handshake)
  server.post('/log', {
    schema: {
      tags: ['Tasks'],
      summary: 'Log task completion (immutable audit)',
      body: {
        type: 'object',
        required: ['taskId'],
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string', enum: ['COMPLETE', 'INCOMPLETE', 'REFUSED'] },
          notes: { type: 'string' },
          refusalReason: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
          originalLogId: { type: 'string' },
          editReason: { type: 'string' },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.COMPLETE_TASK),
    ],
  }, async (request: any, reply) => {
    const parsed = logSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    const result = await tasksService.logTask(request, parsed.data);
    return reply.status(201).send({ data: result });
  });
}
