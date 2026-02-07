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

  const listSubscriptionsQuerySchema = z.object({
    search: z.string().min(1).optional(),
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    status: z.enum(['ACTIVE', 'PAST_DUE', 'SUSPENDED']).optional(),
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

  const organizationUsersQuerySchema = z.object({
    search: z.string().min(1).optional(),
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER']).optional(),
    active: z.enum(['true', 'false']).optional(),
  }).passthrough();

  const createOrganizationUserSchema = z.object({
    email: z.string().email(),
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER']).optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  }).strict();

  const updateOrganizationUserSchema = z.object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  }).strict();

  const updateOrganizationUserRoleSchema = z.object({
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER']),
  }).strict();


  const featureOverrideSchema = z.object({
    enabled: z.boolean(),
    config: z.record(z.any()).optional(),
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

  // Middleware to ensure HQ admin (SUPER_ADMIN or HQ ADMIN)
  const requireHQAdmin = async (request: any, reply: any) => {
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isHqAdmin = user.role === 'ADMIN' && !user.organizationId;

    if (!isSuperAdmin && !isHqAdmin) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'HQ admin access required',
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
    preHandler: [authMiddleware, requireHQAdmin]
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
    preHandler: [authMiddleware, requireHQAdmin]
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

  // GET /api/admin/organizations/:id/users - List org users
  server.get('/organizations/:id/users', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const query = validateZod(organizationUsersQuerySchema, request.query, reply);
      if (!query) return;
      const users = await adminService.listOrganizationUsers(params.id, query);
      return reply.send({ data: users });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/admin/organizations/:id/users - Invite user
  server.post('/organizations/:id/users', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(createOrganizationUserSchema, request.body, reply);
      if (!body) return;
      const result = await adminService.createOrganizationUser(params.id, body);
      return reply.status(201).send({ data: result });
    } catch (error: any) {
      const status = error.message === 'Organization not found' || error.message === 'User with this email already exists' ? 409 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  // PUT /api/admin/organizations/:id/users/:userId - Update user
  server.put('/organizations/:id/users/:userId', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(z.object({
        id: z.string().min(1),
        userId: z.string().min(1),
      }), request.params, reply);
      if (!params) return;
      const body = validateZod(updateOrganizationUserSchema, request.body, reply);
      if (!body) return;
      const user = await adminService.updateOrganizationUser(params.id, params.userId, body);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  // PUT /api/admin/organizations/:id/users/:userId/role - Update role
  server.put('/organizations/:id/users/:userId/role', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(z.object({
        id: z.string().min(1),
        userId: z.string().min(1),
      }), request.params, reply);
      if (!params) return;
      const body = validateZod(updateOrganizationUserRoleSchema, request.body, reply);
      if (!body) return;
      const user = await adminService.updateOrganizationUserRole(params.id, params.userId, body.role);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  // DELETE /api/admin/organizations/:id/users/:userId - Deactivate user
  server.delete('/organizations/:id/users/:userId', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(z.object({
        id: z.string().min(1),
        userId: z.string().min(1),
      }), request.params, reply);
      if (!params) return;
      const result = await adminService.deactivateOrganizationUser(params.id, params.userId);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  // POST /api/admin/organizations/:id/users/:userId/reactivate - Reactivate user
  server.post('/organizations/:id/users/:userId/reactivate', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(z.object({
        id: z.string().min(1),
        userId: z.string().min(1),
      }), request.params, reply);
      if (!params) return;
      const user = await adminService.reactivateOrganizationUser(params.id, params.userId);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  
  // GET /api/admin/stats - Platform statistics
  server.get('/stats', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (_request, reply) => {
    try {
      const stats = await adminService.getPlatformStats();
      return reply.send({ data: stats });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/admin/subscriptions - List all subscriptions
  server.get('/subscriptions', {
    preHandler: [authMiddleware, requireHQAdmin]
  }, async (request, reply) => {
    try {
      const query = validateZod(listSubscriptionsQuerySchema, request.query, reply);
      if (!query) return;
      const result = await adminService.listSubscriptions(query);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/admin/features - List all features
  server.get('/features', {
    preHandler: [authMiddleware, requireHQAdmin]
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
    preHandler: [authMiddleware, requireHQAdmin]
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

  // POST /api/admin/organizations/:id/features/:key - Set org feature override
  server.post('/organizations/:id/features/:key', {
    preHandler: [authMiddleware, requireSuperAdmin]
  }, async (request, reply) => {
    try {
      const params = validateZod(z.object({
        id: z.string().min(1),
        key: z.string().min(1),
      }), request.params, reply);
      if (!params) return;
      const body = validateZod(featureOverrideSchema, request.body, reply);
      if (!body) return;
      const result = await adminService.setOrganizationFeature(params.id, params.key, body.enabled, body.config);
      return reply.send({ data: result });
    } catch (error: any) {
      const status = error.message === 'Organization not found' || error.message === 'Feature not found' ? 404 : 500;
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
