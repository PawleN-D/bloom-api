import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { TasksService } from './tasks.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function tasksRoutes(server: FastifyInstance) {
  const tasksService = new TasksService();

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid date',
  });

  const listQuerySchema = z.object({
    clientId: z.string().min(1).optional(),
    assignedToId: z.string().min(1).optional(),
    search: z.string().min(1).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
  }).passthrough();

  const dateSchema = z.union([dateStringSchema, z.null()]);

  const createTaskSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.enum([
      'PERSONAL_CARE',
      'MEDICATION',
      'MEAL_PREP',
      'MOBILITY',
      'HOUSEKEEPING',
      'COMPANIONSHIP',
      'HEALTH_MONITORING',
      'GENERAL',
    ]).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    clientId: z.string().min(1),
    assignedToId: z.string().min(1).nullable().optional(),
    dueDate: dateSchema.optional(),
    isRecurring: z.boolean().optional(),
  }).strict();

  const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.enum([
      'PERSONAL_CARE',
      'MEDICATION',
      'MEAL_PREP',
      'MOBILITY',
      'HOUSEKEEPING',
      'COMPANIONSHIP',
      'HEALTH_MONITORING',
      'GENERAL',
    ]).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    assignedToId: z.string().min(1).nullable().optional(),
    dueDate: dateSchema.optional(),
    isRecurring: z.boolean().optional(),
  }).strict();

  const completionStatusSchema = z.enum(['COMPLETE', 'COMPLETED', 'INCOMPLETE', 'REFUSED']);

  const completeTaskSchema = z.object({
    notes: z.string().optional(),
    status: completionStatusSchema.optional(),
    refusalReason: z.string().optional(),
    signatureSvg: z.string().optional(),
    initials: z.string().optional(),
    device_info: z.string().optional(),
  }).strict().refine((data) => {
    if (data.status === 'INCOMPLETE' || data.status === 'REFUSED') {
      return Boolean(data.refusalReason);
    }
    return true;
  }, {
    path: ['refusalReason'],
    message: 'refusalReason is required for incomplete or refused statuses',
  });

  const auditExportQuerySchema = z.object({
    clientId: z.string().min(1),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  }).strict();
  const logSchema = z.object({
    taskId: z.string().min(1),
    status: completionStatusSchema.optional(),
    notes: z.string().optional(),
    refusalReason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    device_info: z.string().optional(),
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
  }, async (request, reply) => {
    const query = validateZod(listQuerySchema, request.query, reply);
    if (!query) return;
    const tasks = await tasksService.getTasks(request, query);
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
  }, async (request: any, reply) => {
    const query = validateZod(auditExportQuerySchema, request.query, reply);
    if (!query) return;
    const { clientId, startDate, endDate } = query;
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
  }, async (request: any, reply) => {
    const params = validateZod(idParamSchema, request.params, reply);
    if (!params) return;
    return {
      data: await tasksService.getTask(request, params.id),
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
    const body = validateZod(createTaskSchema, request.body, reply);
    if (!body) return;
    const task = await tasksService.createTask(request, body);
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
    const params = validateZod(idParamSchema, request.params, reply);
    if (!params) return;
    const body = validateZod(updateTaskSchema, request.body, reply);
    if (!body) return;
    const task = await tasksService.updateTask(
      request,
      params.id,
      body
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
    const params = validateZod(idParamSchema, request.params, reply);
    if (!params) return;
    const result = await tasksService.deleteTask(request, params.id);
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
            enum: ['COMPLETE', 'COMPLETED', 'INCOMPLETE', 'REFUSED'],
          },
          refusalReason: { type: 'string' },
          signatureSvg: { type: 'string' },
          initials: { type: 'string' },
          device_info: { type: 'string' },
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
    const params = validateZod(idParamSchema, request.params, reply);
    if (!params) return;
    const body = validateZod(completeTaskSchema, request.body || {}, reply);
    if (!body) return;
    const result = await tasksService.completeTask(request, params.id, body);
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
          status: { type: 'string', enum: ['COMPLETE', 'COMPLETED', 'INCOMPLETE', 'REFUSED'] },
          notes: { type: 'string' },
          refusalReason: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
          device_info: { type: 'string' },
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
