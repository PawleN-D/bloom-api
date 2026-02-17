import {
  ComplianceAlertSeverity,
  ComplianceAlertStatus,
  ComplianceAlertType,
  IncidentStatus,
  TaskCompletionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../database/prisma';
import { mailService } from '@/services/MailService';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

async function getTargetOrganizations(organizationId?: string) {
  if (organizationId) {
    return [organizationId];
  }

  const organizations = await prisma.organization.findMany({
    where: { active: true, suspended: false },
    select: { id: true },
  });

  return organizations.map((org) => org.id);
}

async function upsertOpenComplianceAlert(input: {
  organizationId: string;
  type: ComplianceAlertType;
  severity: ComplianceAlertSeverity;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.complianceAlert.findFirst({
    where: {
      organizationId: input.organizationId,
      type: input.type,
      status: ComplianceAlertStatus.OPEN,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.complianceAlert.update({
      where: { id: existing.id },
      data: {
        severity: input.severity,
        title: input.title,
        description: input.description,
        metadata: input.metadata ?? undefined,
        updatedAt: new Date(),
      },
    });
  }

  return prisma.complianceAlert.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      severity: input.severity,
      status: ComplianceAlertStatus.OPEN,
      title: input.title,
      description: input.description,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function checkOverdueIncidents(organizationId?: string) {
  const now = new Date();
  const organizations = await getTargetOrganizations(organizationId);
  let escalatedCount = 0;

  for (const orgId of organizations) {
    const overdue = await prisma.incident.findMany({
      where: {
        organizationId: orgId,
        status: {
          in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED, IncidentStatus.UNDER_INVESTIGATION],
        },
        slaDueAt: { lt: now },
        escalatedAt: null,
      },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (!overdue.length) continue;

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        role: {
          in: [UserRole.MANAGER, UserRole.ADMIN, UserRole.ORG_OWNER],
        },
      },
      select: { email: true },
    });

    for (const incident of overdue) {
      escalatedCount += 1;
      await prisma.incident.update({
        where: { id: incident.id },
        data: {
          escalatedAt: now,
          slaBreached: true,
        },
      });

      await upsertOpenComplianceAlert({
        organizationId: orgId,
        type: ComplianceAlertType.INCIDENT_SLA_BREACH,
        severity:
          incident.severity === 'CRITICAL'
            ? ComplianceAlertSeverity.CRITICAL
            : ComplianceAlertSeverity.HIGH,
        title: `Incident SLA breached: ${incident.title}`,
        description: `Incident exceeded SLA due time ${incident.slaDueAt?.toISOString() || ''}`,
        entityType: 'Incident',
        entityId: incident.id,
        metadata: {
          incidentId: incident.id,
          severity: incident.severity,
          reportedAt: incident.reportedAt.toISOString(),
        },
      });

      for (const recipient of recipients) {
        mailService
          .sendIncidentEscalationEmail({
            organizationId: incident.organizationId,
            incidentId: incident.id,
            title: incident.title,
            severity: incident.severity,
            recipientEmail: recipient.email,
            organizationName: incident.organization.name,
          })
          .catch((error) => {
            console.error('[ComplianceJobs] incident escalation email', error);
          });
      }
    }
  }

  return { escalatedCount };
}

export async function checkExpiringCertifications(organizationId?: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + THIRTY_DAYS_MS);
  const organizations = await getTargetOrganizations(organizationId);
  let alertCount = 0;

  for (const orgId of organizations) {
    const expiring = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        OR: [
          {
            dbsExpiresAt: {
              gte: now,
              lte: soon,
            },
          },
          {
            trainingExpiresAt: {
              gte: now,
              lte: soon,
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dbsExpiresAt: true,
        trainingExpiresAt: true,
      },
    });

    for (const user of expiring) {
      alertCount += 1;
      await upsertOpenComplianceAlert({
        organizationId: orgId,
        type: ComplianceAlertType.CERTIFICATION_EXPIRING,
        severity: ComplianceAlertSeverity.MEDIUM,
        title: `Certification expiring: ${user.firstName} ${user.lastName}`,
        description: `DBS ${user.dbsExpiresAt?.toISOString() || 'N/A'} / Training ${user.trainingExpiresAt?.toISOString() || 'N/A'}`,
        entityType: 'User',
        entityId: user.id,
      });
    }
  }

  return { alertCount };
}

export async function checkStaleCarePlans(organizationId?: string) {
  const organizations = await getTargetOrganizations(organizationId);
  const staleBefore = new Date(Date.now() - NINETY_DAYS_MS);
  let alertCount = 0;

  for (const orgId of organizations) {
    const stale = await prisma.client.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        carePlan: { not: null },
        updatedAt: { lt: staleBefore },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        updatedAt: true,
      },
    });

    for (const client of stale) {
      alertCount += 1;
      await upsertOpenComplianceAlert({
        organizationId: orgId,
        type: ComplianceAlertType.CARE_PLAN_STALE,
        severity: ComplianceAlertSeverity.MEDIUM,
        title: `Stale care plan: ${client.firstName} ${client.lastName}`,
        description: `Care plan has not been reviewed since ${client.updatedAt.toISOString()}`,
        entityType: 'Client',
        entityId: client.id,
      });
    }
  }

  return { alertCount };
}

export async function checkCriticalTaskCompletions(organizationId?: string) {
  const organizations = await getTargetOrganizations(organizationId);
  const since = new Date(Date.now() - FIFTEEN_MINUTES_MS);
  let alertCount = 0;

  for (const orgId of organizations) {
    const criticalLogs = await prisma.taskCompletion.findMany({
      where: {
        task: {
          organizationId: orgId,
          deletedAt: null,
        },
        completedAt: { gte: since },
        OR: [
          { criticalAlertFlagged: true },
          { status: { in: [TaskCompletionStatus.INCOMPLETE, TaskCompletionStatus.REFUSED] } },
        ],
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
    });

    for (const log of criticalLogs) {
      alertCount += 1;
      await upsertOpenComplianceAlert({
        organizationId: orgId,
        type: ComplianceAlertType.CRITICAL_TASK_EXCEPTION,
        severity: ComplianceAlertSeverity.HIGH,
        title: `Critical task exception: ${log.task.title}`,
        description: `Task ${log.task.id} flagged with status ${log.status}`,
        entityType: 'TaskCompletion',
        entityId: log.id,
        metadata: {
          taskId: log.task.id,
          category: log.task.category,
          completedAt: log.completedAt.toISOString(),
          status: log.status,
        },
      });
    }
  }

  return { alertCount };
}
