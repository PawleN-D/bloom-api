import {
  ComplianceAlertStatus,
  IncidentSeverity,
  IncidentStatus,
  NoteCategory,
  TaskCategory,
  TaskCompletionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

type ComplianceBreakdown = {
  incidents: number;
  certifications: number;
  carePlans: number;
  taskCompletion: number;
};

export type ComplianceScore = {
  overall: number;
  breakdown: ComplianceBreakdown;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  lastCalculated: Date;
};

export class ComplianceService {
  private getGrade(score: number): ComplianceScore['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async calculateIncidentScore(organizationId: string): Promise<number> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const incidents = await prisma.incident.findMany({
      where: {
        organizationId,
        reportedAt: { gte: last30Days },
      },
      select: {
        acknowledgedAt: true,
        slaBreached: true,
        severity: true,
      },
    });

    let score = 100;
    incidents.forEach((incident) => {
      if (!incident.acknowledgedAt) score -= 10;
      if (incident.slaBreached) score -= 15;
      if (incident.severity === IncidentSeverity.CRITICAL) score -= 20;
    });

    return Math.max(0, score);
  }

  private async calculateCertificationScore(organizationId: string): Promise<number> {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const activeStaff = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: [UserRole.WORKER, UserRole.MANAGER, UserRole.ADMIN, UserRole.ORG_OWNER] },
      },
      select: {
        dbsExpiresAt: true,
        trainingExpiresAt: true,
      },
    });

    if (!activeStaff.length) {
      return 100;
    }

    let score = 100;
    for (const staff of activeStaff) {
      if (staff.dbsExpiresAt && staff.dbsExpiresAt < now) score -= 20;
      else if (staff.dbsExpiresAt && staff.dbsExpiresAt <= soon) score -= 10;

      if (staff.trainingExpiresAt && staff.trainingExpiresAt < now) score -= 20;
      else if (staff.trainingExpiresAt && staff.trainingExpiresAt <= soon) score -= 10;
    }

    return Math.max(0, score);
  }

  private async calculateCarePlanScore(organizationId: string): Promise<number> {
    const staleThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [totalClients, withCarePlan, staleCarePlans] = await Promise.all([
      prisma.client.count({
        where: { organizationId, isActive: true },
      }),
      prisma.client.count({
        where: {
          organizationId,
          isActive: true,
          carePlan: { not: null },
        },
      }),
      prisma.client.count({
        where: {
          organizationId,
          isActive: true,
          carePlan: { not: null },
          updatedAt: { lt: staleThreshold },
        },
      }),
    ]);

    if (!totalClients) {
      return 100;
    }

    const coverageScore = Math.round((withCarePlan / totalClients) * 100);
    const stalePenalty = totalClients ? Math.round((staleCarePlans / totalClients) * 40) : 0;
    return Math.max(0, coverageScore - stalePenalty);
  }

  private async calculateTaskCompletionScore(organizationId: string): Promise<number> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalScheduled, totalCompleted] = await Promise.all([
      prisma.task.count({
        where: {
          organizationId,
          deletedAt: null,
          dueDate: { gte: last30Days },
        },
      }),
      prisma.taskCompletion.count({
        where: {
          task: {
            organizationId,
            deletedAt: null,
          },
          status: TaskCompletionStatus.COMPLETE,
          completedAt: { gte: last30Days },
        },
      }),
    ]);

    if (!totalScheduled) {
      return 100;
    }

    return Math.max(0, Math.min(100, Math.round((totalCompleted / totalScheduled) * 100)));
  }

  async getOrganizationReadinessScore(organizationId: string): Promise<ComplianceScore> {
    const [incidentScore, certificationScore, carePlanScore, taskCompletionScore] =
      await Promise.all([
        this.calculateIncidentScore(organizationId),
        this.calculateCertificationScore(organizationId),
        this.calculateCarePlanScore(organizationId),
        this.calculateTaskCompletionScore(organizationId),
      ]);

    const overall =
      (incidentScore + certificationScore + carePlanScore + taskCompletionScore) / 4;

    return {
      overall: Math.round(overall),
      breakdown: {
        incidents: incidentScore,
        certifications: certificationScore,
        carePlans: carePlanScore,
        taskCompletion: taskCompletionScore,
      },
      grade: this.getGrade(overall),
      lastCalculated: new Date(),
    };
  }

  async getIncidentCount(organizationId: string, start: Date, end: Date) {
    const [legacyIncidentNotes, firstClassIncidents] = await Promise.all([
      prisma.note.count({
        where: {
          organizationId,
          category: NoteCategory.INCIDENT,
          deletedAt: null,
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.incident.count({
        where: {
          organizationId,
          reportedAt: { gte: start, lte: end },
        },
      }),
    ]);

    return legacyIncidentNotes + firstClassIncidents;
  }

  async getExpiringCertifications(organizationId: string, days = 30) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const expiringStaff = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          {
            dbsExpiresAt: {
              gte: now,
              lte: windowEnd,
            },
          },
          {
            trainingExpiresAt: {
              gte: now,
              lte: windowEnd,
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        dbsExpiresAt: true,
        trainingExpiresAt: true,
      },
      orderBy: [{ dbsExpiresAt: 'asc' }, { trainingExpiresAt: 'asc' }],
    });

    return expiringStaff.map((staff) => {
      const daysUntil = (date: Date | null) =>
        date ? Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

      return {
        staffId: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        role: staff.role,
        dbsExpiresAt: staff.dbsExpiresAt,
        trainingExpiresAt: staff.trainingExpiresAt,
        daysUntilDbsExpiry: daysUntil(staff.dbsExpiresAt),
        daysUntilTrainingExpiry: daysUntil(staff.trainingExpiresAt),
      };
    });
  }

  async getComplianceGaps(organizationId: string) {
    const alerts = await prisma.complianceAlert.findMany({
      where: {
        organizationId,
        status: ComplianceAlertStatus.OPEN,
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    if (alerts.length) {
      return alerts;
    }

    const now = new Date();
    const [overdueIncidents, staleCarePlans, criticalTaskExceptions] = await Promise.all([
      prisma.incident.findMany({
        where: {
          organizationId,
          status: {
            in: [
              IncidentStatus.OPEN,
              IncidentStatus.ACKNOWLEDGED,
              IncidentStatus.UNDER_INVESTIGATION,
            ],
          },
          slaDueAt: { lt: now },
        },
        select: { id: true, title: true, severity: true, slaDueAt: true },
      }),
      prisma.client.findMany({
        where: {
          organizationId,
          isActive: true,
          carePlan: { not: null },
          updatedAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, firstName: true, lastName: true, updatedAt: true },
      }),
      prisma.taskCompletion.findMany({
        where: {
          task: {
            organizationId,
            deletedAt: null,
            category: TaskCategory.MEDICATION,
          },
          OR: [
            { criticalAlertFlagged: true },
            { status: { in: [TaskCompletionStatus.INCOMPLETE, TaskCompletionStatus.REFUSED] } },
          ],
        },
        orderBy: { completedAt: 'desc' },
        take: 25,
        include: {
          task: { select: { id: true, title: true } },
        },
      }),
    ]);

    return [
      ...overdueIncidents.map((incident) => ({
        id: `overdue-${incident.id}`,
        type: 'INCIDENT_SLA_BREACH',
        severity: incident.severity === IncidentSeverity.CRITICAL ? 'CRITICAL' : 'HIGH',
        title: incident.title,
        description: `Incident SLA is overdue since ${incident.slaDueAt?.toISOString() || 'N/A'}`,
        entityType: 'Incident',
        entityId: incident.id,
      })),
      ...staleCarePlans.map((client) => ({
        id: `care-plan-${client.id}`,
        type: 'CARE_PLAN_STALE',
        severity: 'MEDIUM',
        title: `Stale care plan: ${client.firstName} ${client.lastName}`,
        description: `Care plan not reviewed since ${client.updatedAt.toISOString()}`,
        entityType: 'Client',
        entityId: client.id,
      })),
      ...criticalTaskExceptions.map((log) => ({
        id: `critical-task-${log.id}`,
        type: 'CRITICAL_TASK_EXCEPTION',
        severity: 'HIGH',
        title: `Critical task exception: ${log.task.title}`,
        description: `Status ${log.status} at ${log.completedAt.toISOString()}`,
        entityType: 'TaskCompletion',
        entityId: log.id,
      })),
    ];
  }

  async getHiqaChecklist(organizationId: string) {
    const readiness = await this.getOrganizationReadinessScore(organizationId);
    const gaps = await this.getComplianceGaps(organizationId);

    const failCount = gaps.length;

    return {
      generatedAt: new Date(),
      organizationId,
      overallGrade: readiness.grade,
      checklist: [
        {
          domain: 'Safe',
          score: readiness.breakdown.incidents,
          status: readiness.breakdown.incidents >= 80 ? 'PASS' : 'AT_RISK',
          findings: gaps.filter((gap: any) => String(gap.type).includes('INCIDENT')).length,
        },
        {
          domain: 'Effective',
          score: readiness.breakdown.taskCompletion,
          status: readiness.breakdown.taskCompletion >= 80 ? 'PASS' : 'AT_RISK',
          findings: gaps.filter((gap: any) => String(gap.type).includes('TASK')).length,
        },
        {
          domain: 'Caring',
          score: readiness.breakdown.carePlans,
          status: readiness.breakdown.carePlans >= 80 ? 'PASS' : 'AT_RISK',
          findings: gaps.filter((gap: any) => String(gap.type).includes('CARE_PLAN')).length,
        },
        {
          domain: 'Well-led',
          score: readiness.breakdown.certifications,
          status: readiness.breakdown.certifications >= 80 ? 'PASS' : 'AT_RISK',
          findings: gaps.filter((gap: any) =>
            String(gap.type).includes('CERTIFICATION')
          ).length,
        },
      ],
      summary: {
        totalOpenFindings: failCount,
      },
    };
  }
}

export const complianceService = new ComplianceService();

