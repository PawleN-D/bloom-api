import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { isBloomHQAdmin } from '../../../shared/middleware/is-bloom-hq-admin';
import { prisma } from '../../../shared/database/prisma';
import { config } from '../../../config/env';
import {
  getOrganizationUrl,
  isSubdomainAvailable,
  isValidSubdomain,
} from '../../../shared/utils/subdomain';
import { validateZod } from '../../../shared/validation/zod';

export async function backofficeOrganizationsRoutes(server: FastifyInstance) {
  const paramsSchema = z.object({
    subdomain: z.string().min(1),
  });

  // GET /api/backoffice/organizations/check-subdomain/:subdomain
  server.get('/organizations/check-subdomain/:subdomain', {
    schema: {
      tags: ['Backoffice'],
      summary: 'Check subdomain availability',
      params: {
        type: 'object',
        required: ['subdomain'],
        properties: {
          subdomain: { type: 'string' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    const params = validateZod(paramsSchema, request.params, reply);
    if (!params) return;

    const { subdomain } = params;

    if (!isValidSubdomain(subdomain)) {
      return reply.send({
        available: false,
        reason: 'Invalid subdomain format',
      });
    }

    const available = await isSubdomainAvailable(prisma, subdomain);

    if (available) {
      return reply.send({
        available: true,
        subdomain,
        url: getOrganizationUrl(subdomain, config.baseDomain),
      });
    }

    return reply.send({
      available: false,
      subdomain,
      reason: 'Subdomain is already taken',
      suggestions: [`${subdomain}-1`, `${subdomain}-2`],
    });
  });
}
