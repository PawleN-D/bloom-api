import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { NotificationsService } from './notifications.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function notificationsRoutes(server: FastifyInstance) {
  const notificationsService = new NotificationsService();

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  server.get('/', {
    schema: {
      tags: ['Notifications'],
      summary: 'List notifications for current user',
    },
    preHandler: [authMiddleware, tenantContext],
  }, async (request, reply) => {
    try {
      const notifications = await notificationsService.list(request);
      return reply.send({ data: notifications });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/:id/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark notification as read',
    },
    preHandler: [authMiddleware, tenantContext],
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = notificationsService.markRead(request, params.id);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/read-all', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
    },
    preHandler: [authMiddleware, tenantContext],
  }, async (request, reply) => {
    try {
      const result = notificationsService.markAllRead(request);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
