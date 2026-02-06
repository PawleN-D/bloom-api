import { FastifyRequest } from 'fastify';
import {
  NoteCategory,
  TaskCategory,
  TaskCompletionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

type RiskSummary = {
  window: { start: Date; end: Date };
  hydrationNutritionRisk: {
    residentCount: number;
    residents: Array<{
      residentId: string;
      residentName: string | null;
      completionRate: number;
      totalLogs: number;
      completedLogs: number;
    }>;
  };
  medicationExceptions: { count: number };
  incidentCount: { count: number };
};

type StaffStats = {
  window: { start: Date; end: Date };
  staff: Array<{
    staffId: string;
    name: string;
    role: UserRole;
    tasksScheduled: number;
    tasksCompleted: number;
    efficiencyScore: number;
    lateCompletions: number;
  }>;
};

type ComplianceAlerts = {
  window: { start: Date; end: Date };
  expiringCredentials: Array<{
    staffId: string;
    name: string;
    role: UserRole;
    dbsExpiresAt: Date | null;
    trainingExpiresAt: Date | null;
    daysUntilDbsExpiry: number | null;
    daysUntilTrainingExpiry: number | null;
  }>;
  criticalExceptions: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    taskCategory: TaskCategory;
    residentId: string;
    residentName: string;
    staffId: string;
    staffName: string;
    staffRole: UserRole;
    status: TaskCompletionStatus;
    refusalReason: string | null;
    completedAt: Date;
  }>;
};

export class ManagerService {
  private getWindow(hours: number) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    return { start, end };
  }

  async getRiskSummary(request: FastifyRequest): Promise<RiskSummary> {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const window = this.getWindow(24);

    const nutritionLogs = await prisma.taskCompletion.findMany({
      where: {
        completedAt: {
          gte: window.start,
          lte: window.end,
        },
        task: {
          organizationId: request.organization.id,
          category: {
            in: [TaskCategory.MEAL_PREP, TaskCategory.HEALTH_MONITORING],
          },
        },
      },
      select: {
        status: true,
        task: {
          select: {
            clientId: true,
          },
        },
      },
    });

    const residentTotals = new Map<
      string,
      { total: number; completed: number }
    >();

    for (const log of nutritionLogs) {
      const residentId = log.task.clientId;
      const current = residentTotals.get(residentId) || {
        total: 0,
        completed: 0,
      };
      current.total += 1;
      if (log.status === TaskCompletionStatus.COMPLETE) {
        current.completed += 1;
      }
      residentTotals.set(residentId, current);
    }

    const atRiskResidentIds = Array.from(residentTotals.entries())
      .filter(([, stats]) => stats.total > 0 && stats.completed / stats.total < 0.5)
      .map(([residentId]) => residentId);

    const residentNames = atRiskResidentIds.length
      ? await prisma.client.findMany({
          where: withTenantIsolation(request, {
            id: { in: atRiskResidentIds },
          }),
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        })
      : [];

    const residentNameMap = new Map(
      residentNames.map((resident) => [
        resident.id,
        `${resident.firstName} ${resident.lastName}`,
      ])
    );

    const atRiskResidents = atRiskResidentIds.map((residentId) => {
      const stats = residentTotals.get(residentId)!;
      const completionRate =
        stats.total === 0
          ? 0
          : Math.round((stats.completed / stats.total) * 100);
      return {
        residentId,
        residentName: residentNameMap.get(residentId) || null,
        completionRate,
        totalLogs: stats.total,
        completedLogs: stats.completed,
      };
    });

    const medicationExceptions = await prisma.taskCompletion.count({
      where: {
        completedAt: {
          gte: window.start,
          lte: window.end,
        },
        status: {
          in: [
            TaskCompletionStatus.INCOMPLETE,
            TaskCompletionStatus.REFUSED,
          ],
        },
        task: {
          organizationId: request.organization.id,
          category: TaskCategory.MEDICATION,
        },
      },
    });

    const incidentCount = await prisma.note.count({
      where: withTenantIsolation(request, {
        category: NoteCategory.INCIDENT,
        createdAt: {
          gte: window.start,
          lte: window.end,
        },
      }),
    });

    return {
      window,
      hydrationNutritionRisk: {
        residentCount: atRiskResidents.length,
        residents: atRiskResidents,
      },
      medicationExceptions: { count: medicationExceptions },
      incidentCount: { count: incidentCount },
    };
  }

  async getStaffStats(request: FastifyRequest): Promise<StaffStats> {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const window = this.getWindow(24);
    const logs = await prisma.taskCompletion.findMany({
      where: {
        completedAt: {
          gte: window.start,
          lte: window.end,
        },
        task: {
          organizationId: request.organization.id,
        },
      },
      select: {
        completedBy: true,
        completedAt: true,
        status: true,
        task: {
          select: {
            dueDate: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    const staffMap = new Map<
      string,
      {
        name: string;
        role: UserRole;
        tasksScheduled: number;
        tasksCompleted: number;
        lateCompletions: number;
      }
    >();

    for (const log of logs) {
      const staffId = log.completedBy;
      const entry = staffMap.get(staffId) || {
        name: `${log.user.firstName} ${log.user.lastName}`,
        role: log.user.role,
        tasksScheduled: 0,
        tasksCompleted: 0,
        lateCompletions: 0,
      };

      entry.tasksScheduled += 1;
      if (log.status === TaskCompletionStatus.COMPLETE) {
        entry.tasksCompleted += 1;
      }

      if (log.task.dueDate) {
        const lateThreshold = new Date(log.task.dueDate.getTime() + 60 * 60 * 1000);
        if (log.completedAt > lateThreshold) {
          entry.lateCompletions += 1;
        }
      }

      staffMap.set(staffId, entry);
    }

    const staff = Array.from(staffMap.entries()).map(([staffId, entry]) => ({
      staffId,
      name: entry.name,
      role: entry.role,
      tasksScheduled: entry.tasksScheduled,
      tasksCompleted: entry.tasksCompleted,
      efficiencyScore:
        entry.tasksScheduled === 0
          ? 0
          : Math.round((entry.tasksCompleted / entry.tasksScheduled) * 100),
      lateCompletions: entry.lateCompletions,
    }));

    staff.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

    return {
      window,
      staff,
    };
  }

  async getComplianceAlerts(request: FastifyRequest): Promise<ComplianceAlerts> {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringStaff = await prisma.user.findMany({
      where: withTenantIsolation(request, {
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
      }),
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

    const expiringCredentials = expiringStaff.map((staff) => {
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

    const criticalExceptions = await prisma.taskCompletion.findMany({
      where: {
        task: {
          organizationId: request.organization.id,
        },
        OR: [
          { criticalAlertFlagged: true },
          {
            status: {
              in: [
                TaskCompletionStatus.INCOMPLETE,
                TaskCompletionStatus.REFUSED,
              ],
            },
          },
        ],
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            category: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 10,
    });

    return {
      window: { start: now, end: windowEnd },
      expiringCredentials,
      criticalExceptions: criticalExceptions.map((log) => ({
        id: log.id,
        taskId: log.task.id,
        taskTitle: log.task.title,
        taskCategory: log.task.category,
        residentId: log.task.client.id,
        residentName: `${log.task.client.firstName} ${log.task.client.lastName}`,
        staffId: log.user.id,
        staffName: `${log.user.firstName} ${log.user.lastName}`,
        staffRole: log.user.role,
        status: log.status,
        refusalReason: log.refusalReason || null,
        completedAt: log.completedAt,
      })),
    };
  }
}
