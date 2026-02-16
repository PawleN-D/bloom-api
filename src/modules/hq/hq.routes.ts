import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { isBloomHQAdmin } from '../../shared/middleware/is-bloom-hq-admin';
import { securityLogHook } from '../../shared/middleware/security-log';
import { validateZod } from '../../shared/validation/zod';
import { prisma } from '../../shared/database/prisma';
import { HQAnalyticsService } from './hq.analytics.service';
import { HQBillingService } from './hq.billing.service';
import { HQSecurityService } from './hq.security.service';
import { HQSupportService } from './hq.support.service';
import { HQService } from './hq.service';
import { AdminService } from '../admin/admin.service';
import { userBulkService } from '@/services/UserBulkService';

export async function hqRoutes(server: FastifyInstance) {
  const hqService = new HQService();
  const billingService = new HQBillingService();
  const analyticsService = new HQAnalyticsService();
  const supportService = new HQSupportService();
  const securityService = new HQSecurityService();
  const adminService = new AdminService();

  server.addHook('onResponse', securityLogHook);

  const onboardSchema = z.object({
    orgName: z.string().min(1),
    adminEmail: z.string().email(),
    subscriptionPlan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
    subdomain: z.string().min(1).optional(),
  });

  const dateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid date',
  });

  const createOrganizationSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).optional(),
    subdomain: z.string().min(1).optional(),
    manager_name: z.string().min(1).optional(),
    manager_email: z.string().email().optional(),
    logo: z.string().min(1).optional(),
    primaryColor: z.string().min(1).optional(),
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    billingEmail: z.string().email().optional(),
    maxUsers: z.number().int().positive().optional(),
    maxClients: z.number().int().positive().optional(),
    trialEndsAt: z.union([dateSchema, z.null()]).optional(),
  }).strict();

  const bulkUsersParamsSchema = z.object({
    id: z.string().min(1),
  });

  const bulkUsersBodySchema = z.object({
    users: z.array(
      z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(['care_worker', 'manager', 'admin']),
        phone: z.string().min(1).optional(),
      }).strict()
    ),
  }).strict();

  const planSchema = z.object({
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  });

  const orgIdParamsSchema = z.object({
    orgId: z.string().min(1),
  });

  const securityLogsQuerySchema = z.object({
    organizationId: z.string().optional(),
    userId: z.string().optional(),
    action: z.string().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    format: z.enum(['json', 'csv']).optional(),
  }).passthrough();

  const analyticsOverviewQuerySchema = z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).passthrough();

  const healthScoresQuerySchema = z.object({
    windowDays: z.coerce.number().int().positive().max(365).optional(),
  }).passthrough();

  const listTicketsQuerySchema = z.object({
    organizationId: z.string().optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedToId: z.string().optional(),
    search: z.string().optional(),
  }).passthrough();

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
          subdomain: { type: 'string' },
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

  server.post('/organizations', {
    schema: {
      tags: ['HQ'],
      summary: 'Create organization',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          subdomain: { type: 'string' },
          manager_name: { type: 'string' },
          manager_email: { type: 'string', format: 'email' },
          logo: { type: 'string' },
          primaryColor: { type: 'string' },
          plan: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
          billingEmail: { type: 'string', format: 'email' },
          maxUsers: { type: 'number' },
          maxClients: { type: 'number' },
          trialEndsAt: { type: ['string', 'null'] },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request, reply) => {
    try {
      const body = validateZod(createOrganizationSchema, request.body, reply);
      if (!body) return;
      const organization = await adminService.createOrganization(body);
      return reply.status(201).send({ data: organization });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/organizations/:id/users/bulk', {
    schema: {
      tags: ['HQ'],
      summary: 'Bulk create organization users',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['users'],
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              required: ['first_name', 'last_name', 'email', 'role'],
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string', enum: ['care_worker', 'manager', 'admin'] },
                phone: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request, reply) => {
    const params = validateZod(bulkUsersParamsSchema, request.params, reply);
    if (!params) return;

    const body = validateZod(bulkUsersBodySchema, request.body, reply);
    if (!body) return;

    if (!body.users.length) {
      return reply.status(400).send({ message: 'No users provided' });
    }

    if (body.users.length > 500) {
      return reply.status(400).send({ message: 'Max 500 users per import' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!organization) {
      return reply.status(404).send({ message: 'Organization not found' });
    }

    try {
      const result = await userBulkService.createBulk(params.id, body.users);
      return reply.status(201).send(result);
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

  server.get('/security-logs', {
    schema: {
      tags: ['HQ'],
      summary: 'Searchable security log stream (supports CSV export)',
      querystring: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          userId: { type: 'string' },
          action: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: { type: 'number' },
          format: { type: 'string', enum: ['json', 'csv'] },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const query = validateZod(securityLogsQuerySchema, request.query, reply);
      if (!query) return;
      const logs = await securityService.listSecurityLogs(query);
      if (query.format === 'csv') {
        const rows = logs.map((log) => ({
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          userEmail: log.user?.email || '',
          userRole: log.user?.role || '',
          organization: log.organization?.name || '',
          action: log.action,
          statusCode: log.statusCode ?? '',
          ipAddress: log.ipAddress ?? '',
        }));

        const header = Object.keys(rows[0] || {}).join(',');
        const body = rows
          .map((row) =>
            Object.values(row)
              .map((value) => `"${String(value).replace(/"/g, '""')}"`)
              .join(',')
          )
          .join('\n');

        const csv = [header, body].filter(Boolean).join('\n');
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="security-logs.csv"');
        return reply.send(csv);
      }

      return reply.send({ data: logs });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/upgrade', {
    schema: {
      tags: ['HQ'],
      summary: 'Upgrade subscription plan with proration',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const { orgId } = request.params;
      const parsed = planSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
      }
      const result = await billingService.changePlan(orgId, parsed.data.plan);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/downgrade', {
    schema: {
      tags: ['HQ'],
      summary: 'Downgrade subscription plan with proration',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const { orgId } = request.params;
      const parsed = planSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
      }
      const result = await billingService.changePlan(orgId, parsed.data.plan);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/pause', {
    schema: {
      tags: ['HQ'],
      summary: 'Pause billing for organization',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      await billingService.pauseSubscription(request.params.orgId);
      return reply.send({ message: 'Subscription paused' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/resume', {
    schema: {
      tags: ['HQ'],
      summary: 'Resume billing for organization',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      await billingService.resumeSubscription(request.params.orgId);
      return reply.send({ message: 'Subscription resumed' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/cancel', {
    schema: {
      tags: ['HQ'],
      summary: 'Cancel subscription with 30-day grace period',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const result = await billingService.cancelWithGracePeriod(request.params.orgId, 30);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/discounts', {
    schema: {
      tags: ['HQ'],
      summary: 'Create discount/coupon',
      body: {
        type: 'object',
        required: ['code', 'type', 'value'],
        properties: {
          code: { type: 'string' },
          type: { type: 'string', enum: ['PERCENT', 'AMOUNT'] },
          value: { type: 'number' },
          validFrom: { type: 'string' },
          validTo: { type: 'string' },
          maxRedemptions: { type: 'number' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    const parsed = z.object({
      code: z.string().min(1),
      type: z.enum(['PERCENT', 'AMOUNT']),
      value: z.number().positive(),
      validFrom: z.string().optional(),
      validTo: z.string().optional(),
      maxRedemptions: z.number().int().positive().optional(),
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    try {
      const validFrom = parsed.data.validFrom ? new Date(parsed.data.validFrom) : null;
      const validTo = parsed.data.validTo ? new Date(parsed.data.validTo) : null;

      if (validFrom && Number.isNaN(validFrom.getTime())) {
        return reply.status(400).send({ error: 'Validation error', details: { validFrom: ['Invalid date'] } });
      }
      if (validTo && Number.isNaN(validTo.getTime())) {
        return reply.status(400).send({ error: 'Validation error', details: { validTo: ['Invalid date'] } });
      }

      const discount = await billingService.createDiscount({
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
        validFrom,
        validTo,
        maxRedemptions: parsed.data.maxRedemptions ?? null,
      });
      return reply.status(201).send({ data: discount });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/discounts/:code', {
    schema: {
      tags: ['HQ'],
      summary: 'Apply discount code to a subscription',
      params: {
        type: 'object',
        properties: {
          orgId: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['orgId', 'code'],
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const discount = await billingService.applyDiscount(request.params.orgId, request.params.code);
      return reply.send({ data: discount });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/subscriptions/:orgId/invoices', {
    schema: {
      tags: ['HQ'],
      summary: 'List invoices for organization',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const invoices = await billingService.listInvoices(request.params.orgId);
      return reply.send({ data: invoices });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/subscriptions/:orgId', {
    schema: {
      tags: ['HQ'],
      summary: 'Get subscription summary for organization',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const params = validateZod(orgIdParamsSchema, request.params, reply);
      if (!params) return;
      const summary = await billingService.getSubscriptionSummary(params.orgId);
      return reply.send({ data: summary });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/subscriptions/:orgId/invoices/generate', {
    schema: {
      tags: ['HQ'],
      summary: 'Generate invoice for organization subscription',
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const invoice = await billingService.generateInvoiceForOrg(request.params.orgId);
      return reply.status(201).send({ data: invoice });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/billing/run', {
    schema: {
      tags: ['HQ'],
      summary: 'Run billing cycle to generate due invoices',
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (_request, reply) => {
    try {
      const results = await billingService.runBillingCycle();
      return reply.send({ data: results });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/analytics/overview', {
    schema: {
      tags: ['HQ'],
      summary: 'Platform analytics overview',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const query = validateZod(analyticsOverviewQuerySchema, request.query, reply);
      if (!query) return;
      const data = await analyticsService.getOverview(
        query.startDate,
        query.endDate
      );
      return reply.send({ data });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  server.get('/analytics/health-scores', {
    schema: {
      tags: ['HQ'],
      summary: 'Health scores per organization',
      querystring: {
        type: 'object',
        properties: {
          windowDays: { type: 'number' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const query = validateZod(healthScoresQuerySchema, request.query, reply);
      if (!query) return;
      const data = await analyticsService.getHealthScores(query.windowDays || 7);
      return reply.send({ data });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/support/tickets', {
    schema: {
      tags: ['HQ'],
      summary: 'Create support ticket',
      body: {
        type: 'object',
        required: ['subject', 'description'],
        properties: {
          organizationId: { type: 'string' },
          subject: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          assignedToId: { type: 'string' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    const parsed = z.object({
      organizationId: z.string().optional(),
      subject: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      assignedToId: z.string().optional(),
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const ticket = await supportService.createTicket(request.user.id, parsed.data);
      return reply.status(201).send({ data: ticket });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/support/tickets', {
    schema: {
      tags: ['HQ'],
      summary: 'List support tickets',
      querystring: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          assignedToId: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const query = validateZod(listTicketsQuerySchema, request.query, reply);
      if (!query) return;
      const tickets = await supportService.listTickets(query);
      return reply.send({ data: tickets });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/support/tickets/:id', {
    schema: {
      tags: ['HQ'],
      summary: 'Get support ticket details',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const ticket = await supportService.getTicket(request.params.id);
      return reply.send({ data: ticket });
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  server.patch('/support/tickets/:id', {
    schema: {
      tags: ['HQ'],
      summary: 'Update support ticket',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          assignedToId: { type: 'string' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    try {
      const parsed = z.object({
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assignedToId: z.string().optional(),
      }).safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
      }

      const ticket = await supportService.updateTicket(request.params.id, parsed.data);
      return reply.send({ data: ticket });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.post('/support/tickets/:id/notes', {
    schema: {
      tags: ['HQ'],
      summary: 'Add internal note to ticket',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string' },
          internal: { type: 'boolean' },
        },
      },
    },
    preHandler: [authMiddleware, isBloomHQAdmin],
  }, async (request: any, reply) => {
    const parsed = z.object({
      body: z.string().min(1),
      internal: z.boolean().optional(),
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const note = await supportService.addNote(
        request.params.id,
        request.user.id,
        parsed.data.body,
        parsed.data.internal ?? true
      );
      return reply.status(201).send({ data: note });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
