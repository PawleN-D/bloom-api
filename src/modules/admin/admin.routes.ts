import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { securityLogHook } from '../../shared/middleware/security-log';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

/**
 * Super Admin Routes
 * Only accessible by SUPER_ADMIN role
 */
export async function adminRoutes(server: FastifyInstance) {
  const adminService = new AdminService();
  const usersService = new UsersService();

  server.addHook('onResponse', securityLogHook);

  const inviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN']),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  });

  const dateSchema = z.union([
    z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'Invalid date',
    }),
    z.null(),
  ]);

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  const listOrgsQuerySchema = z.object({
    search: z.string().min(1).optional(),
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    active: z.enum(['true', 'false']).optional(),
    suspended: z.enum(['true', 'false']).optional(),
  }).passthrough();

  const createOrgSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).optional(),
    subdomain: z.string().min(1).optional(),
    logo: z.string().min(1).optional(),
    primaryColor: z.string().min(1).optional(),
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    billingEmail: z.string().email().optional(),
    maxUsers: z.number().int().positive().optional(),
    maxClients: z.number().int().positive().optional(),
    trialEndsAt: dateSchema.optional(),
  }).strict();

  const updateOrgSchema = z.object({
    name: z.string().min(1).optional(),
    logo: z.string().min(1).optional(),
    primaryColor: z.string().min(1).optional(),
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    billingEmail: z.string().email().optional(),
    maxUsers: z.number().int().positive().optional(),
    maxClients: z.number().int().positive().optional(),
    active: z.boolean().optional(),
    suspended: z.boolean().optional(),
    trialEndsAt: dateSchema.optional(),
  }).strict();

  const createFeatureSchema = z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.enum(['CORE', 'COMPLIANCE', 'AI', 'ADVANCED', 'INTEGRATIONS', 'ENTERPRISE']),
    availableInPlans: z.array(z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'])).optional(),
    betaFeature: z.boolean().optional(),
    comingSoon: z.boolean().optional(),
    defaultEnabled: z.boolean().optional(),
  }).strict();
  
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
      const query = validateZod(listOrgsQuerySchema, request.query, reply);
      if (!query) return;
      const organizations = await adminService.listOrganizations(query);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const organization = await adminService.getOrganization(params.id);
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
      const body = validateZod(createOrgSchema, request.body, reply);
      if (!body) return;
      const organization = await adminService.createOrganization(body);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(updateOrgSchema, request.body, reply);
      if (!body) return;
      const organization = await adminService.updateOrganization(params.id, body);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await adminService.suspendOrganization(params.id);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await adminService.unsuspendOrganization(params.id);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await adminService.getOrganizationFeatures(params.id);
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
      const body = validateZod(createFeatureSchema, request.body, reply);
      if (!body) return;
      const feature = await adminService.createFeature(body);
      return reply.status(201).send({ data: feature });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
