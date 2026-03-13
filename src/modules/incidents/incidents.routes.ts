import { FastifyInstance } from '@/shared/http/compat';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { verifyManager } from '../../shared/middleware/verify-manager';
import { incidentsService } from './incidents.service';
import { validateZod } from '../../shared/validation/zod';

const dateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid date',
});

export async function incidentsRoutes(server: FastifyInstance) {
  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  const listQuerySchema = z
    .object({
      status: z.nativeEnum(IncidentStatus).optional(),
      severity: z.nativeEnum(IncidentSeverity).optional(),
      clientId: z.string().min(1).optional(),
    })
    .passthrough();

  const createIncidentSchema = z
    .object({
      clientId: z.string().min(1).optional(),
      category: z.nativeEnum(IncidentCategory),
      severity: z.nativeEnum(IncidentSeverity),
      title: z.string().min(1),
      description: z.string().min(1),
      reportedAt: dateSchema.optional(),
    })
    .strict();

  const updateIncidentSchema = z
    .object({
      clientId: z.string().min(1).nullable().optional(),
      category: z.nativeEnum(IncidentCategory).optional(),
      severity: z.nativeEnum(IncidentSeverity).optional(),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      status: z.nativeEnum(IncidentStatus).optional(),
      resolution: z.string().min(1).nullable().optional(),
      preventiveActions: z.string().min(1).nullable().optional(),
    })
    .strict();

  const closeSchema = z
    .object({
      resolution: z.string().min(1),
      preventiveActions: z.string().min(1).optional(),
    })
    .strict();

  server.post(
    '/',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'Create incident',
      },
      preHandler: [authMiddleware, tenantContext, authorize(Permission.CREATE_NOTE)],
    },
    async (request, reply) => {
      try {
        const body = validateZod(createIncidentSchema, request.body, reply);
        if (!body) return;
        const incident = await incidentsService.createIncident(request, body);
        return reply.status(201).send({ data: incident });
      } catch (error: any) {
        const status = error.message.includes('not found') ? 404 : 400;
        return reply.status(status).send({ error: error.message });
      }
    }
  );

  server.get(
    '/overdue',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'List overdue incidents by SLA',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        const incidents = await incidentsService.getOverdueIncidents(request);
        return reply.send({ data: incidents });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.get(
    '/',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'List incidents',
      },
      preHandler: [authMiddleware, tenantContext, authorize(Permission.READ_NOTE)],
    },
    async (request, reply) => {
      try {
        const query = validateZod(listQuerySchema, request.query, reply);
        if (!query) return;
        const incidents = await incidentsService.listIncidents(request, query);
        return reply.send({ data: incidents });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.get(
    '/:id',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'Get incident detail',
      },
      preHandler: [authMiddleware, tenantContext, authorize(Permission.READ_NOTE)],
    },
    async (request, reply) => {
      try {
        const params = validateZod(idParamSchema, request.params, reply);
        if (!params) return;
        const incident = await incidentsService.getIncident(request, params.id);
        return reply.send({ data: incident });
      } catch (error: any) {
        const status = error.message === 'Incident not found' ? 404 : 500;
        return reply.status(status).send({ error: error.message });
      }
    }
  );

  server.put(
    '/:id',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'Update incident details',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        const params = validateZod(idParamSchema, request.params, reply);
        if (!params) return;
        const body = validateZod(updateIncidentSchema, request.body, reply);
        if (!body) return;
        const incident = await incidentsService.updateIncident(request, params.id, body);
        return reply.send({ data: incident });
      } catch (error: any) {
        const status = error.message.includes('not found') ? 404 : 400;
        return reply.status(status).send({ error: error.message });
      }
    }
  );

  server.post(
    '/:id/acknowledge',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'Acknowledge incident',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        const params = validateZod(idParamSchema, request.params, reply);
        if (!params) return;
        const incident = await incidentsService.acknowledgeIncident(request, params.id);
        return reply.send({ data: incident });
      } catch (error: any) {
        const status =
          error.message === 'Incident not found'
            ? 404
            : error.message === 'Incident already acknowledged'
              ? 400
              : 500;
        return reply.status(status).send({ error: error.message });
      }
    }
  );

  server.post(
    '/:id/close',
    {
      schema: {
        tags: ['Incidents'],
        summary: 'Close incident',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        const params = validateZod(idParamSchema, request.params, reply);
        if (!params) return;
        const body = validateZod(closeSchema, request.body, reply);
        if (!body) return;
        const incident = await incidentsService.closeIncident(request, params.id, body);
        return reply.send({ data: incident });
      } catch (error: any) {
        const status =
          error.message === 'Incident not found'
            ? 404
            : error.message === 'Incident already closed'
              ? 400
              : 500;
        return reply.status(status).send({ error: error.message });
      }
    }
  );
}

