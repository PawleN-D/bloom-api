import { FastifyInstance } from '@/shared/http/compat';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { verifyManager } from '../../shared/middleware/verify-manager';
import { ManagerService } from './manager.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function managerRoutes(server: FastifyInstance) {
  const managerService = new ManagerService();

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  server.get('/risk-summary', {
    schema: {
      tags: ['Manager'],
      summary: 'Manager dashboard risk intelligence summary (last 24h)',
    },
    preHandler: [authMiddleware, tenantContext, verifyManager],
  }, async (request, reply) => {
    try {
      const result = await managerService.getRiskSummary(request);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/staff-stats', {
    schema: {
      tags: ['Manager'],
      summary: 'Staff performance metrics (last 24h)',
    },
    preHandler: [authMiddleware, tenantContext, verifyManager],
  }, async (request, reply) => {
    try {
      const result = await managerService.getStaffStats(request);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/compliance-alerts', {
    schema: {
      tags: ['Manager'],
      summary: 'Compliance and HR alerts (30-day lookahead)',
    },
    preHandler: [authMiddleware, tenantContext, verifyManager],
  }, async (request, reply) => {
    try {
      const result = await managerService.getComplianceAlerts(request);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/actions', {
    schema: {
      tags: ['Manager'],
      summary: 'Manager action items dashboard',
    },
    preHandler: [authMiddleware, tenantContext, verifyManager],
  }, async (request, reply) => {
    try {
      const result = await managerService.getActions(request);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/actions/handover/:id/approve', {
    schema: {
      tags: ['Manager'],
      summary: 'Approve handover note',
    },
    preHandler: [authMiddleware, tenantContext, verifyManager],
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await managerService.approveHandover(request, params.id);
      return reply.send({ data: result });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  server.post('/actions/handover/:id/reject', {
    schema: {
      tags: ['Manager'],
      summary: 'Reject handover note',
    },
    preHandler: [authMiddleware, tenantContext, verifyManager],
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await managerService.rejectHandover(request, params.id);
      return reply.send({ data: result });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

}
