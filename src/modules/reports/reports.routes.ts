import { FastifyInstance } from '@/shared/http/compat';
import { z } from 'zod';
import { AuditAccessStatus, UserRole } from '@prisma/client';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { requirePrivilege } from '../../shared/middleware/require-privilege';
import { ReportsService } from './reports.service';

const reportRequestSchema = z.object({
  reportType: z.string().min(1, 'reportType is required'),
  dateRange: z.enum([
    'today',
    'yesterday',
    'last-7-days',
    'last-30-days',
    'this-month',
    'last-month',
    'custom',
  ]),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
  sections: z.array(z.string()).optional(),
  exportFormat: z.enum(['pdf', 'csv', 'docx']).optional(),
  email: z.string().email().optional(),
});

export async function reportsRoutes(server: FastifyInstance) {
  const reportsService = new ReportsService();

  const querySchema = z.object({
    startDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'startDate must be a valid ISO date',
    }),
    endDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'endDate must be a valid ISO date',
    }),
    includeArchived: z.preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean().optional()),
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

  server.post('/preview', {
    schema: {
      tags: ['Reports'],
      summary: 'Preview audit report configuration',
      body: {
        type: 'object',
        properties: {
          reportType: { type: 'string' },
          dateRange: { type: 'string' },
          customStart: { type: 'string' },
          customEnd: { type: 'string' },
          sections: { type: 'array', items: { type: 'string' } },
          exportFormat: { type: 'string' },
        },
        required: ['reportType', 'dateRange'],
      },
    },
    preHandler: [authMiddleware, tenantContext, requirePrivilege],
  }, async (request: any, reply) => {
    const parsed = reportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    try {
      const payload = parsed.data;
      const { start, end, label } = reportsService.resolveDateRange(
        payload.dateRange,
        payload.customStart,
        payload.customEnd
      );
      const stats = await reportsService.getOrganizationQuickStats(request, start, end);
      return reply.send({
        data: {
          reportType: payload.reportType,
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString(),
            label,
          },
          stats,
          sections: payload.sections ?? [],
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Unable to preview report' });
    }
  });

  server.post('/export', {
    schema: {
      tags: ['Reports'],
      summary: 'Export audit report as PDF',
      body: {
        type: 'object',
        properties: {
          reportType: { type: 'string' },
          dateRange: { type: 'string' },
          customStart: { type: 'string' },
          customEnd: { type: 'string' },
          sections: { type: 'array', items: { type: 'string' } },
          exportFormat: { type: 'string' },
        },
        required: ['reportType', 'dateRange'],
      },
    },
    preHandler: [authMiddleware, tenantContext, requirePrivilege],
  }, async (request: any, reply) => {
    const parsed = reportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    if (payload.exportFormat && payload.exportFormat !== 'pdf') {
      return reply.status(400).send({
        error: 'Only PDF export is supported right now',
      });
    }

    try {
      const { start, end, label } = reportsService.resolveDateRange(
        payload.dateRange,
        payload.customStart,
        payload.customEnd
      );
      const stats = await reportsService.getOrganizationQuickStats(request, start, end);
      const snapshot = {
        reportType: payload.reportType,
        dateRange: { start, end, label },
        stats,
        sections: payload.sections ?? [],
        generatedAt: new Date(),
      };
      const managerName = await reportsService.getManagerDisplayName(
        request,
        request.user.id
      );
      const pdfStream = reportsService.generateOrganizationReportPdf(snapshot, managerName);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'attachment; filename="audit-report.pdf"');
      return reply.send(pdfStream);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Unable to export report' });
    }
  });

  server.post('/email', {
    schema: {
      tags: ['Reports'],
      summary: 'Email audit report to manager',
      body: {
        type: 'object',
        properties: {
          reportType: { type: 'string' },
          dateRange: { type: 'string' },
          customStart: { type: 'string' },
          customEnd: { type: 'string' },
          sections: { type: 'array', items: { type: 'string' } },
          exportFormat: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['reportType', 'dateRange'],
      },
    },
    preHandler: [authMiddleware, tenantContext, requirePrivilege],
  }, async (request: any, reply) => {
    const parsed = reportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }

    const recipient = parsed.data.email || request.user?.email;
    if (!recipient) {
      return reply.status(400).send({
        error: 'Recipient email is required',
      });
    }

    return reply.send({
      data: {
        queued: true,
        recipient,
      },
    });
  });

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
          includeArchived: { type: 'boolean' },
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
      const { startDate, endDate, includeArchived } = parsed.data;
      const report = await reportsService.getAuditReportData(
        request,
        residentId,
        startDate,
        endDate,
        includeArchived || false
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
