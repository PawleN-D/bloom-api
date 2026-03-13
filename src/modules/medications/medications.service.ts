import {
  AuditOperation,
  MedicationRoute,
  MedicationStatus,
  TaskCategory,
} from '@prisma/client';
import { FastifyRequest } from '@/shared/http/compat';
import { prisma } from '../../shared/database/prisma';
import { computeFieldDiff, logAuditEvent } from '../../shared/middleware/audit-trail';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

type AdministerMedicationInput = {
  clientId: string;
  medicationName: string;
  dosage: string;
  route: any;
  scheduledTime: string;
  administeredTime?: string;
  status?: MedicationStatus;
  refusalReason?: string;
  omissionReason?: string;
  doubleCheckRequired?: boolean;
  doubleCheckedBy?: string;
  notes?: string;
};

export class MedicationsService {
  async administerMedication(request: FastifyRequest, payload: AdministerMedicationInput) {
    const org = request.organization;
    const user = request.user;
    if (!org) throw new Error('Organization required');
    if (!user) throw new Error('User required');

    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id: payload.clientId }),
      select: { id: true },
    });

    if (!client) {
      throw new Error('Client not found in your organization');
    }

    const scheduledTime = new Date(payload.scheduledTime);
    if (Number.isNaN(scheduledTime.getTime())) {
      throw new Error('Invalid scheduledTime');
    }

    const status = payload.status || MedicationStatus.ADMINISTERED;
    const administeredTime =
      payload.administeredTime !== undefined
        ? new Date(payload.administeredTime)
        : status === MedicationStatus.ADMINISTERED || status === MedicationStatus.DELAYED
          ? new Date()
          : null;

    if (administeredTime && Number.isNaN(administeredTime.getTime())) {
      throw new Error('Invalid administeredTime');
    }

    if (status === MedicationStatus.REFUSED && !payload.refusalReason) {
      throw new Error('refusalReason is required for refused medications');
    }

    if (status === MedicationStatus.OMITTED && !payload.omissionReason) {
      throw new Error('omissionReason is required for omitted medications');
    }

    let doubleCheckedBy: string | null = payload.doubleCheckedBy || null;
    if (doubleCheckedBy) {
      const checker = await prisma.user.findUnique({
        where: { id: doubleCheckedBy },
        select: { id: true, organizationId: true },
      });
      if (!checker || checker.organizationId !== org.id) {
        throw new Error('Double checker not found in your organization');
      }
    }

    const lateAdministration = Boolean(
      administeredTime &&
        administeredTime.getTime() - scheduledTime.getTime() > 30 * 60 * 1000
    );

    const record = await prisma.medicationAdministration.create({
      data: {
        organizationId: org.id,
        clientId: payload.clientId,
        administeredById:
          status === MedicationStatus.REFUSED || status === MedicationStatus.OMITTED
            ? null
            : user.id,
        medicationName: payload.medicationName,
        dosage: payload.dosage,
        route: payload.route,
        scheduledTime,
        administeredTime,
        status,
        refusalReason: payload.refusalReason || null,
        omissionReason: payload.omissionReason || null,
        lateAdministration,
        doubleCheckRequired: Boolean(payload.doubleCheckRequired),
        doubleCheckedBy,
        notes: payload.notes || null,
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        administeredBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        doubleChecker: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.CREATE,
      entityType: 'MedicationAdministration',
      entityId: record.id,
      fieldChanges: computeFieldDiff(null, {
        clientId: record.clientId,
        medicationName: record.medicationName,
        status: record.status,
        lateAdministration: record.lateAdministration,
        doubleCheckRequired: record.doubleCheckRequired,
      }),
    });

    return record;
  }

  async listMedications(request: FastifyRequest, filters?: any) {
    const { clientId, status, startDate, endDate } = filters || {};

    const where: any = withTenantIsolation(request, {
      clientId: clientId || undefined,
      status: status || undefined,
    });

    if (startDate || endDate) {
      where.scheduledTime = {};
      if (startDate) where.scheduledTime.gte = new Date(startDate);
      if (endDate) where.scheduledTime.lte = new Date(endDate);
    }

    return prisma.medicationAdministration.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        administeredBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        doubleChecker: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { scheduledTime: 'desc' },
      take: 500,
    });
  }

  async getMedicationExceptions(request: FastifyRequest, filters?: any) {
    const { clientId, startDate, endDate } = filters || {};

    const where: any = withTenantIsolation(request, {
      clientId: clientId || undefined,
      OR: [
        { status: { in: ['REFUSED', 'OMITTED', 'DELAYED'] } },
        { lateAdministration: true },
        {
          AND: [{ doubleCheckRequired: true }, { doubleCheckedBy: null }],
        },
      ],
    });

    if (startDate || endDate) {
      where.scheduledTime = {};
      if (startDate) where.scheduledTime.gte = new Date(startDate);
      if (endDate) where.scheduledTime.lte = new Date(endDate);
    }

    return prisma.medicationAdministration.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        administeredBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        doubleChecker: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { scheduledTime: 'desc' },
      take: 500,
    });
  }

  async previewLegacyTaskMigration(organizationId: string) {
    const [legacyMedicationTasks, alreadyStructured] = await Promise.all([
      prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
          category: 'MEDICATION',
        },
      }),
      prisma.medicationAdministration.count({
        where: { organizationId },
      }),
    ]);

    return {
      legacyMedicationTasks,
      alreadyStructured,
      requiresMigration: legacyMedicationTasks > 0,
    };
  }

  async migrateLegacyMedicationTasks(
    request: FastifyRequest,
    options?: { dryRun?: boolean; limit?: number }
  ) {
    if (!request.organization) {
      throw new Error('Organization required');
    }

    const limit = Math.min(Math.max(options?.limit || 500, 1), 5000);
    const tasks = await prisma.task.findMany({
      where: withTenantIsolation(request, {
        deletedAt: null,
        category: TaskCategory.MEDICATION,
      }),
      select: {
        id: true,
        clientId: true,
        title: true,
        description: true,
        dueDate: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let created = 0;
    let skipped = 0;
    const detail: Array<{ taskId: string; status: 'created' | 'skipped'; reason?: string }> =
      [];

    for (const task of tasks) {
      if (!task.dueDate) {
        skipped += 1;
        detail.push({ taskId: task.id, status: 'skipped', reason: 'Missing dueDate' });
        continue;
      }

      const existing = await prisma.medicationAdministration.findFirst({
        where: {
          organizationId: request.organization.id,
          clientId: task.clientId,
          medicationName: task.title,
          scheduledTime: task.dueDate,
        },
        select: { id: true },
      });

      if (existing) {
        skipped += 1;
        detail.push({ taskId: task.id, status: 'skipped', reason: 'Already migrated' });
        continue;
      }

      if (!options?.dryRun) {
        await prisma.medicationAdministration.create({
          data: {
            organizationId: request.organization.id,
            clientId: task.clientId,
            administeredById: null,
            medicationName: task.title,
            dosage: 'UNSPECIFIED',
            route: MedicationRoute.ORAL,
            scheduledTime: task.dueDate,
            administeredTime: null,
            status: MedicationStatus.SCHEDULED,
            notes: task.description
              ? `${task.description}\n[Migrated from legacy task ${task.id}]`
              : `[Migrated from legacy task ${task.id}]`,
          },
        });
      }

      created += 1;
      detail.push({ taskId: task.id, status: 'created' });
    }

    return {
      dryRun: Boolean(options?.dryRun),
      scanned: tasks.length,
      created,
      skipped,
      detail,
    };
  }
}

export const medicationsService = new MedicationsService();
