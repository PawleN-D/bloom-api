import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuditAccessStatus, UserRole } from '@prisma/client';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { requirePrivilege } from '../../shared/middleware/require-privilege';
import { ReportsService } from './reports.service';

export async function reportsRoutes(server: FastifyInstance) {
  const reportsService = new ReportsService();

  const querySchema = z.object({
    startDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'startDate must be a valid ISO date',
    }),
    endDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'endDate must be a valid ISO date',
    }),
  });

  const logAuditAccess = async (
    request: any,
    residentId: string,
    status: AuditAccessStatus
  ) => {
    if (!residentId || !request?.user?.id) {
      return;
    }

    try {
      await reportsService.recordAuditAccess(
        request,
        residentId,
        request.user.id,
        status
      );
    } catch {
      // Best-effort logging to avoid blocking report delivery
    }
  };

  const auditAccessGuard = async (request: any) => {
    const user = request.user;
    if (!user) {
      return;
    }

    const allowedRoles = [UserRole.MANAGER, UserRole.ADMIN];
    if (!allowedRoles.includes(user.role)) {
      await logAuditAccess(
        request,
        request.params?.residentId,
        AuditAccessStatus.FAILED
      );
    }
  };

  server.get('/audit/:residentId', {
    schema: {
      tags: ['Reports'],
      summary: 'Generate audit report PDF for resident',
      params: {
        type: 'object',
        properties: {
          residentId: { type: 'string' },
        },
        required: ['residentId'],
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
        required: ['startDate', 'endDate'],
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      auditAccessGuard,
      requirePrivilege,
    ],
  }, async (request: any, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      await logAuditAccess(
        request,
        request.params?.residentId,
        AuditAccessStatus.FAILED
      );
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    try {
      const { residentId } = request.params;
      const { startDate, endDate } = parsed.data;
      const report = await reportsService.getAuditReportData(
        request,
        residentId,
        startDate,
        endDate
      );

      const managerName = await reportsService.getManagerDisplayName(
        request,
        request.user.id
      );
      const pdfStream = reportsService.generateAuditReportPdf(report, managerName);
      await logAuditAccess(request, residentId, AuditAccessStatus.SUCCESS);
      reply.header('Content-Type', 'application/pdf');
      reply.header(
        'Content-Disposition',
        `inline; filename="audit-report-${residentId}.pdf"`
      );
      return reply.send(pdfStream);
    } catch (error: any) {
      await logAuditAccess(
        request,
        request.params?.residentId,
        AuditAccessStatus.FAILED
      );
      const status =
        error.message === 'Resident not found' || error.message === 'Invalid date range'
          ? 400
          : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}
