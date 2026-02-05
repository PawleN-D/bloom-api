import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { verifyManager } from '../../shared/middleware/verify-manager';
import { ManagerService } from './manager.service';

export async function managerRoutes(server: FastifyInstance) {
  const managerService = new ManagerService();

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
}
