import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../shared/database/prisma';
import { validateZod } from '../../shared/validation/zod';
import { isValidSubdomain } from '../../shared/utils/subdomain';

export async function organizationsPublicRoutes(server: FastifyInstance) {
  const paramsSchema = z.object({
    subdomain: z.string().min(1),
  });

  server.get('/by-subdomain/:subdomain', {
    schema: {
      tags: ['Organizations'],
      summary: 'Get organization by subdomain',
      params: {
        type: 'object',
        required: ['subdomain'],
        properties: {
          subdomain: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const params = validateZod(paramsSchema, request.params, reply);
    if (!params) return;

    const { subdomain } = params;
    if (!isValidSubdomain(subdomain)) {
      return reply.status(400).send({ error: 'Invalid subdomain format' });
    }

    const organization = await prisma.organization.findUnique({
      where: { subdomain },
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        logo: true,
        primaryColor: true,
        plan: true,
        maxUsers: true,
        maxClients: true,
        active: true,
        suspended: true,
      },
    });

    if (!organization) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    if (!organization.active || organization.suspended) {
      return reply.status(403).send({ error: 'Organization is not active' });
    }

    return reply.send({ data: organization });
  });
}
