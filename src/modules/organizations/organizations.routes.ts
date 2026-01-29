import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { OrganizationsService } from './organizations.service';

export async function organizationsRoutes(server: FastifyInstance) {
  const organizationsService = new OrganizationsService();
  
  // GET /api/organization - Get current organization
  server.get('/api/organization', {
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
  server.put('/api/organization', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_ORG)
    ]
  }, async (request, reply) => {
    try {
      const organization = await organizationsService.updateOrganization(request, request.body);
      return reply.send({ data: organization });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/organization/stats - Get organization statistics
  server.get('/api/organization/stats', {
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
  server.get('/api/organization/features', {
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
  server.post('/api/organization/features/:key', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.MANAGE_FEATURES)
    ]
  }, async (request, reply) => {
    try {
      const { key } = request.params as any;
      const { config } = request.body as any;
      const result = await organizationsService.enableFeature(request, key, config);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('not available') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // DELETE /api/organization/features/:key - Disable feature
  server.delete('/api/organization/features/:key', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.MANAGE_FEATURES)
    ]
  }, async (request, reply) => {
    try {
      const { key } = request.params as any;
      const result = await organizationsService.disableFeature(request, key);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}