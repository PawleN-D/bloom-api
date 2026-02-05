import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { z } from 'zod';

/**
 * Super Admin Routes
 * Only accessible by SUPER_ADMIN role
 */
export async function adminRoutes(server: FastifyInstance) {
  const adminService = new AdminService();
  const usersService = new UsersService();

  const inviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN']),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  });
  
  // Middleware to ensure SUPER_ADMIN only
  const requireSuperAdmin = async (request: any, reply: any) => {
    if (!request.user || request.user.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Super admin access required',
      });
    }
  };

  // POST /api/admin/invite - Invite staff (manager+)
  server.post('/invite', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_USER),
    ]
  }, async (request, reply) => {
    try {
      const parsed = inviteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: parsed.error.flatten(),
        });
      }

      const invited = await usersService.inviteUser(request, parsed.data);
      return reply.status(201).send({ data: invited });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/admin/organizations - List all organizations
  server.get('/organizations', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const organizations = await adminService.listOrganizations(request.query);
      return reply.send({ data: organizations });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/admin/organizations/:id - Get organization details
  server.get('/organizations/:id', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const organization = await adminService.getOrganization(id);
      return reply.send({ data: organization });
    } catch (error: any) {
      const status = error.message === 'Organization not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/admin/organizations - Create new organization
  server.post('/organizations', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const organization = await adminService.createOrganization(request.body);
      return reply.status(201).send({ data: organization });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // PUT /api/admin/organizations/:id - Update organization
  server.put('/organizations/:id', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const organization = await adminService.updateOrganization(id, request.body);
      return reply.send({ data: organization });
    } catch (error: any) {
      const status = error.message === 'Organization not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/admin/organizations/:id/suspend - Suspend organization
  server.post('/organizations/:id/suspend', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await adminService.suspendOrganization(id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Organization not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/admin/organizations/:id/unsuspend - Unsuspend organization
  server.post('/organizations/:id/unsuspend', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await adminService.unsuspendOrganization(id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Organization not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // GET /api/admin/stats - Platform statistics
  server.get('/stats', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (_request, reply) => {
    try {
      const stats = await adminService.getPlatformStats();
      return reply.send({ data: stats });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/admin/features - List all features
  server.get('/features', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (_request, reply) => {
    try {
      const features = await adminService.listFeatures();
      return reply.send({ data: features });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/admin/organizations/:id/features - Org features
  server.get('/organizations/:id/features', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await adminService.getOrganizationFeatures(id);
      return reply.send({ data: result });
    } catch (error: any) {
      const status = error.message === 'Organization not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/admin/features - Create new feature
  server.post('/features', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const feature = await adminService.createFeature(request.body);
      return reply.status(201).send({ data: feature });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
