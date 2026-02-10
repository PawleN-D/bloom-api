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



type ActionItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  createdAt?: Date | string | null;
  priority?: string | null;
  status?: string | null;
  actionUrl?: string | null;
};

type ActionsPayload = {
  summary: {
    handover: number;
    incidents: number;
    compliance: number;
    schedule: number;
  };
  handover: ActionItem[];
  incidents: ActionItem[];
  compliance: ActionItem[];
  schedule: ActionItem[];
};

const handoverApprovalStore = new Map<
  string,
  { status: 'APPROVED' | 'REJECTED'; updatedAt: Date }
>();

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

  async getActions(request: FastifyRequest): Promise<ActionsPayload> {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const now = new Date();
    const handoverStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const incidentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const complianceStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const scheduleEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const [handoverNotes, incidentNotes, complianceTasks, scheduleTasks] = await Promise.all([
      prisma.note.findMany({
        where: withTenantIsolation(request, {
          isLatest: true,
          isSignificant: true,
          createdAt: {
            gte: handoverStart,
          },
        }),
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.note.findMany({
        where: withTenantIsolation(request, {
          isLatest: true,
          category: NoteCategory.INCIDENT,
          createdAt: {
            gte: incidentStart,
          },
        }),
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.task.findMany({
        where: withTenantIsolation(request, {
          category: {
            in: [TaskCategory.MEDICATION, TaskCategory.HEALTH_MONITORING],
          },
          dueDate: {
            lte: now,
            gte: complianceStart,
          },
        }),
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          taskCompletions: {
            select: {
              status: true,
            },
          },
        },
        orderBy: { dueDate: 'desc' },
        take: 50,
      }),
      prisma.task.findMany({
        where: withTenantIsolation(request, {
          assignedToId: null,
          dueDate: {
            gte: now,
            lte: scheduleEnd,
          },
        }),
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
    ]);

    const pendingHandover = handoverNotes.filter((note) => !handoverApprovalStore.has(note.id));
    const handover = pendingHandover.map((note) => {
      const clientName = note.client
        ? `${note.client.firstName || ''} ${note.client.lastName || ''}`.trim()
        : 'Client';
      const authorName = note.user
        ? `${note.user.firstName || ''} ${note.user.lastName || ''}`.trim()
        : 'Staff member';
      return {
        id: note.id,
        title: `Handover note: ${clientName || 'Client'}`,
        subtitle: authorName ? `Submitted by ${authorName}` : undefined,
        description: note.content,
        createdAt: note.createdAt,
        priority: note.category === NoteCategory.INCIDENT ? 'URGENT' : 'HIGH',
        status: 'PENDING',
        actionUrl: '/handover',
      };
    });

    const incidents = incidentNotes.map((note) => {
      const clientName = note.client
        ? `${note.client.firstName || ''} ${note.client.lastName || ''}`.trim()
        : 'Client';
      const authorName = note.user
        ? `${note.user.firstName || ''} ${note.user.lastName || ''}`.trim()
        : 'Staff member';
      return {
        id: note.id,
        title: `Incident report: ${clientName || 'Client'}`,
        subtitle: authorName ? `Reported by ${authorName}` : undefined,
        description: note.content,
        createdAt: note.createdAt,
        priority: 'URGENT',
        status: 'OPEN',
        actionUrl: '/notes',
      };
    });

    const isCompleted = (task: { taskCompletions?: Array<{ status: TaskCompletionStatus }> }) =>
      Boolean(
        task.taskCompletions?.some((completion) => completion.status === TaskCompletionStatus.COMPLETE)
      );

    const compliance = complianceTasks
      .filter((task) => !isCompleted(task))
      .map((task) => {
        const clientName = task.client
          ? `${task.client.firstName || ''} ${task.client.lastName || ''}`.trim()
          : 'Client';
        const workerName = task.assignedTo
          ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim()
          : 'Unassigned';
        return {
          id: task.id,
          title: `Compliance task: ${(task.title || 'Task').trim() || 'Task'}`,
          subtitle: `${clientName || 'Client'} - ${workerName || 'Unassigned'}`,
          description: task.description || null,
          createdAt: task.dueDate,
          priority: task.priority,
          status: 'OPEN',
          actionUrl: '/tasks?filter=attention',
        };
      });

    const schedule = scheduleTasks.map((task) => {
      const clientName = task.client
        ? `${task.client.firstName || ''} ${task.client.lastName || ''}`.trim()
        : 'Client';
      return {
        id: task.id,
        title: `Unassigned task: ${(task.title || 'Task').trim() || 'Task'}`,
        subtitle: clientName || 'Client',
        description: task.description || null,
        createdAt: task.dueDate,
        priority: task.priority,
        status: 'OPEN',
        actionUrl: '/tasks',
      };
    });

    return {
      summary: {
        handover: handover.length,
        incidents: incidents.length,
        compliance: compliance.length,
        schedule: schedule.length,
      },
      handover,
      incidents,
      compliance,
      schedule,
    };
  }

  async approveHandover(request: FastifyRequest, id: string) {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const note = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!note) {
      throw new Error('Note not found');
    }

    handoverApprovalStore.set(id, { status: 'APPROVED', updatedAt: new Date() });

    return { id, status: 'APPROVED' };
  }

  async rejectHandover(request: FastifyRequest, id: string) {
    if (!request.organization) {
      throw new Error('Organization context required');
    }

    const note = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!note) {
      throw new Error('Note not found');
    }

    handoverApprovalStore.set(id, { status: 'REJECTED', updatedAt: new Date() });

    return { id, status: 'REJECTED' };
  }

}
