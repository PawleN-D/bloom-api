import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { prisma } from '../../shared/database/prisma';
import crypto from 'crypto';
import { TaskPriority, TaskCategory } from '@prisma/client';

export async function schedulingRoutes(server: FastifyInstance) {
  // Suggest schedules based on assigned workers; org-scoped.
  server.post('/suggest', {
    schema: {
      tags: ['Scheduling'],
      summary: 'AI schedule suggestions (org-scoped)',
      body: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
          windowStart: { type: 'string' },
          windowEnd: { type: 'string' },
          durationMinutes: { type: 'number' },
          requiredSkills: { type: 'array', items: { type: 'string' } },
        },
        required: ['clientId', 'windowStart', 'windowEnd', 'durationMinutes'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK),
    ],
  }, async (request: any) => {
    const orgId = request.organization?.id;
    const { clientId, windowStart, windowEnd } = request.body;

    // Get workers assigned to this client within the org
    const assignments = await prisma.assignment.findMany({
      where: {
        clientId,
        user: { organizationId: orgId, isActive: true },
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    const suggestions = assignments.map((a) => ({
      workerId: a.userId,
      workerName: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
      clientId,
      orgId,
      start: windowStart,
      end: windowEnd,
      confidence: 0.6,
      reasons: ['Assigned to client', 'Within requested window'],
      conflicts: [],
    }));

    return { data: suggestions };
  });

  // Commit schedule: create a Task for the client, scoped to org.
  server.post('/commit', {
    schema: {
      tags: ['Scheduling'],
      summary: 'Commit schedule (creates a task)',
      body: {
        type: 'object',
        properties: {
          workerId: { type: 'string' },
          clientId: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          notes: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
        },
        required: ['workerId', 'clientId', 'start', 'end'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK),
    ],
  }, async (request: any) => {
    const orgId = request.organization?.id;
    const { workerId, clientId, start, end, notes, title, priority } = request.body;

    // Verify worker belongs to org
    const worker = await prisma.user.findFirst({
      where: { id: workerId, organizationId: orgId, isActive: true },
    });
    if (!worker) {
      return request.reply.code(400).send({ error: 'Worker not in organization' });
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: orgId, isActive: true },
    });
    if (!client) {
      return request.reply.code(400).send({ error: 'Client not in organization' });
    }

    const taskId = crypto.randomBytes(16).toString('hex');
    const startDate = new Date(start);

    const task = await prisma.task.create({
      data: {
        id: taskId,
        organizationId: orgId,
        clientId,
        title: title || 'Scheduled visit',
        description: notes || undefined,
        category: TaskCategory.GENERAL,
        priority: (priority?.toUpperCase() as TaskPriority) || TaskPriority.NORMAL,
        dueDate: startDate,
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
    });

    return { data: task };
  });
}
