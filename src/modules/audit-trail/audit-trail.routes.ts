import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext, withTenantIsolation } from '../../shared/middleware/tenant-context';
import { verifyManager } from '../../shared/middleware/verify-manager';
import { validateZod } from '../../shared/validation/zod';
import { prisma } from '../../shared/database/prisma';

export async function auditTrailRoutes(server: FastifyInstance) {
  const paramsSchema = z.object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
  });

  const querySchema = z
    .object({
      limit: z.coerce.number().int().positive().max(1000).optional(),
    })
    .passthrough();

  server.get(
    '/:entityType/:entityId',
    {
      schema: {
        tags: ['AuditTrail'],
        summary: 'Get full audit trail for an entity',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        const params = validateZod(paramsSchema, request.params, reply);
        if (!params) return;
        const query = validateZod(querySchema, request.query, reply);
        if (!query) return;

        const events = await prisma.auditEvent.findMany({
          where: withTenantIsolation(request, {
            entityType: params.entityType,
            entityId: params.entityId,
          }),
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: query.limit || 200,
        });

        return reply.send({ data: events });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}

