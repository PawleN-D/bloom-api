import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { isBloomHQAdmin } from '../../shared/middleware/is-bloom-hq-admin';
import { HQService } from './hq.service';

export async function hqRoutes(server: FastifyInstance) {
  const hqService = new HQService();

  const onboardSchema = z.object({
    orgName: z.string().min(1),
    adminEmail: z.string().email(),
    subscriptionPlan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  });

  server.post('/onboard-org', {
    schema: {
      tags: ['HQ'],
      summary: 'Onboard a new organization',
      body: {
        type: 'object',
        required: ['orgName', 'adminEmail', 'subscriptionPlan'],
        properties: {
          orgName: { type: 'string' },
          adminEmail: { type: 'string' },
          subscriptionPlan: {
            type: 'string',
            enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
          },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request, reply) => {
    const parsed = onboardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await hqService.onboardOrganization(parsed.data);
      return reply.status(201).send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/audit-logs', {
    schema: {
      tags: ['HQ'],
      summary: 'Global audit log stream across organizations',
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (_request, reply) => {
    try {
      const logs = await hqService.getAuditLogs();
      return reply.send({ data: logs });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
