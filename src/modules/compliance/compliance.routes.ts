import { FastifyInstance } from '@/shared/http/compat';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { verifyManager } from '../../shared/middleware/verify-manager';
import { complianceService } from './compliance.service';

export async function complianceRoutes(server: FastifyInstance) {
  server.get(
    '/readiness',
    {
      schema: {
        tags: ['Compliance'],
        summary: 'Get organization readiness score',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        if (!request.organization) {
          return reply.status(400).send({ error: 'Organization context required' });
        }
        const score = await complianceService.getOrganizationReadinessScore(
          request.organization.id
        );
        return reply.send({ data: score });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.get(
    '/gaps',
    {
      schema: {
        tags: ['Compliance'],
        summary: 'List compliance gaps',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        if (!request.organization) {
          return reply.status(400).send({ error: 'Organization context required' });
        }
        const gaps = await complianceService.getComplianceGaps(request.organization.id);
        return reply.send({ data: gaps });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.get(
    '/hiqa-checklist',
    {
      schema: {
        tags: ['Compliance'],
        summary: 'Get HIQA readiness checklist',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        if (!request.organization) {
          return reply.status(400).send({ error: 'Organization context required' });
        }
        const checklist = await complianceService.getHiqaChecklist(request.organization.id);
        return reply.send({ data: checklist });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}

