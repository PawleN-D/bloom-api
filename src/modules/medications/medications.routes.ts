import { FastifyInstance } from '@/shared/http/compat';
import { MedicationRoute, MedicationStatus } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { verifyManager } from '../../shared/middleware/verify-manager';
import { validateZod } from '../../shared/validation/zod';
import { medicationsService } from './medications.service';

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid date',
});

export async function medicationsRoutes(server: FastifyInstance) {
  const listQuerySchema = z
    .object({
      clientId: z.string().min(1).optional(),
      status: z.nativeEnum(MedicationStatus).optional(),
      startDate: dateStringSchema.optional(),
      endDate: dateStringSchema.optional(),
    })
    .passthrough();

  const administerSchema = z
    .object({
      clientId: z.string().min(1),
      medicationName: z.string().min(1),
      dosage: z.string().min(1),
      route: z.nativeEnum(MedicationRoute),
      scheduledTime: dateStringSchema,
      administeredTime: dateStringSchema.optional(),
      status: z.nativeEnum(MedicationStatus).optional(),
      refusalReason: z.string().min(1).optional(),
      omissionReason: z.string().min(1).optional(),
      doubleCheckRequired: z.boolean().optional(),
      doubleCheckedBy: z.string().min(1).optional(),
      notes: z.string().optional(),
    })
    .strict();

  const migrationRunSchema = z
    .object({
      dryRun: z.boolean().optional(),
      limit: z.number().int().positive().max(5000).optional(),
    })
    .strict();

  server.post(
    '/administer',
    {
      schema: {
        tags: ['Medications'],
        summary: 'Record medication administration',
      },
      preHandler: [authMiddleware, tenantContext, authorize(Permission.COMPLETE_TASK)],
    },
    async (request, reply) => {
      try {
        const body = validateZod(administerSchema, request.body, reply);
        if (!body) return;
        const record = await medicationsService.administerMedication(request, body);
        return reply.status(201).send({ data: record });
      } catch (error: any) {
        const status = error.message.includes('not found') ? 404 : 400;
        return reply.status(status).send({ error: error.message });
      }
    }
  );

  server.get(
    '/',
    {
      schema: {
        tags: ['Medications'],
        summary: 'List medication administration records',
      },
      preHandler: [authMiddleware, tenantContext, authorize(Permission.READ_TASK)],
    },
    async (request, reply) => {
      try {
        const query = validateZod(listQuerySchema, request.query, reply);
        if (!query) return;
        const records = await medicationsService.listMedications(request, query);
        return reply.send({ data: records });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.get(
    '/exceptions',
    {
      schema: {
        tags: ['Medications'],
        summary: 'List medication exceptions',
      },
      preHandler: [authMiddleware, tenantContext, authorize(Permission.READ_TASK)],
    },
    async (request, reply) => {
      try {
        const query = validateZod(listQuerySchema, request.query, reply);
        if (!query) return;
        const records = await medicationsService.getMedicationExceptions(request, query);
        return reply.send({ data: records });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.get(
    '/migration/preview',
    {
      schema: {
        tags: ['Medications'],
        summary: 'Preview migration from Task.category=MEDICATION',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        if (!request.organization) {
          return reply.status(400).send({ error: 'Organization context required' });
        }
        const preview = await medicationsService.previewLegacyTaskMigration(
          request.organization.id
        );
        return reply.send({ data: preview });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  server.post(
    '/migration/run',
    {
      schema: {
        tags: ['Medications'],
        summary: 'Run migration from Task.category=MEDICATION',
      },
      preHandler: [authMiddleware, tenantContext, verifyManager],
    },
    async (request, reply) => {
      try {
        const body = validateZod(migrationRunSchema, request.body || {}, reply);
        if (!body) return;
        const result = await medicationsService.migrateLegacyMedicationTasks(request, body);
        return reply.send({ data: result });
      } catch (error: any) {
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
