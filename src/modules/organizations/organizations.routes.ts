import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { OrganizationsService } from './organizations.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function organizationsRoutes(server: FastifyInstance) {
  const organizationsService = new OrganizationsService();

  const updateOrgSchema = z.object({
    name: z.string().min(1).optional(),
    logo: z.string().min(1).optional(),
    primaryColor: z.string().min(1).optional(),
    billingEmail: z.string().email().optional(),
  }).strict();

  const featureKeyParamSchema = z.object({
    key: z.string().min(1),
  });

  const featureConfigSchema = z.object({
    config: z.record(z.any()).optional(),
  }).strict();
  
  // GET /api/organization - Get current organization
  server.get('/', {
    preHandler: [
      authMiddleware,
      tenantContext,
    ]
  }, async (request, reply) => {
    try {
      const organization = await organizationsService.getCurrentOrganization(request);
      return reply.send({ data: organization });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // PUT /api/organization - Update organization settings
  server.put('/', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_ORG)
    ]
  }, async (request, reply) => {
    try {
      const body = validateZod(updateOrgSchema, request.body, reply);
      if (!body) return;
      const organization = await organizationsService.updateOrganization(request, body);
      return reply.send({ data: organization });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/organization/stats - Get organization statistics
  server.get('/stats', {
    preHandler: [
      authMiddleware,
      tenantContext,
    ]
  }, async (request, reply) => {
    try {
      const stats = await organizationsService.getOrganizationStats(request);
      return reply.send({ data: stats });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/organization/features - Get enabled features
  server.get('/features', {
    preHandler: [
      authMiddleware,
      tenantContext,
    ]
  }, async (request, reply) => {
    try {
      const features = await organizationsService.getOrganizationFeatures(request);
      return reply.send({ data: features });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // POST /api/organization/features/:key - Enable feature
  server.post('/features/:key', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.MANAGE_FEATURES)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(featureKeyParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(featureConfigSchema, request.body, reply);
      if (!body) return;
      const result = await organizationsService.enableFeature(request, params.key, body.config);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('not available') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // DELETE /api/organization/features/:key - Disable feature
  server.delete('/features/:key', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.MANAGE_FEATURES)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(featureKeyParamSchema, request.params, reply);
      if (!params) return;
      const result = await organizationsService.disableFeature(request, params.key);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
