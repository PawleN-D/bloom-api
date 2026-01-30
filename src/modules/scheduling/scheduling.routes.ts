import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';

// Minimal stub for AI scheduling suggestions and commit.
// Real implementation should call an AI service and verify availability.

export async function schedulingRoutes(server: FastifyInstance) {
  // Suggest schedules
  server.post('/suggest', {
    schema: {
      tags: ['Scheduling'],
      summary: 'AI schedule suggestions (stub)',
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
      authorize(Permission.UPDATE_TASK), // managers/admins can schedule tasks
    ],
  }, async (request: any) => {
    // Return a placeholder suggestion; real logic should query org-scoped workers.
    const orgId = request.organization?.id;
    const clientId = request.body.clientId;
    return {
      data: [
        {
          workerId: 'placeholder_worker',
          orgId,
          clientId,
          start: request.body.windowStart,
          end: request.body.windowEnd,
          confidence: 0.5,
          reasons: ['Stub suggestion only'],
          conflicts: [],
        },
      ],
    };
  });

  // Commit schedule (stub)
  server.post('/commit', {
    schema: {
      tags: ['Scheduling'],
      summary: 'Commit schedule (stub)',
      body: {
        type: 'object',
        properties: {
          workerId: { type: 'string' },
          clientId: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['workerId', 'clientId', 'start', 'end'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_TASK),
    ],
  }, async () => {
    // Real implementation should create a task/assignment.
    return { message: 'Stub commit accepted (no record created)' };
  });
}
