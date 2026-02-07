import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';
import { TaskCompletionStatus } from '@prisma/client';
import { isPrivilegedRole } from '../../shared/constants/privileged-roles';

interface CompleteTaskInput {
  notes?: string;
  status?: TaskCompletionStatus;
  refusalReason?: string;
  signatureSvg?: string;
  initials?: string;
}

interface LogTaskInput {
  taskId: string;
  status?: TaskCompletionStatus;
  notes?: string;
  refusalReason?: string;
  metadata?: Record<string, any>;
  originalLogId?: string;
  editReason?: string;
}

export class TasksService {
  async getTasks(request: FastifyRequest, filters?: any) {
    const { clientId, search, assignedToId, startDate, endDate } = filters || {};
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }

    const conditions: any[] = [];
    if (clientId) {
      conditions.push({ clientId });
    }
    if (assignedToId) {
      conditions.push({ assignedToId });
    }
    if (startDate || endDate) {
      const dueDate: { gte?: Date; lte?: Date } = {};
      if (startDate) dueDate.gte = new Date(startDate);
      if (endDate) dueDate.lte = new Date(endDate);
      conditions.push({ dueDate });
    }

    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (!isPrivilegedRole(user.role)) {
      conditions.push({
        OR: [
          { assignedToId: user.id },
          {
            assignedToId: null,
            client: {
              assignments: {
                some: {
                  userId: user.id,
                  isActive: true,
                },
              },
            },
          },
        ],
      });
    }

    const where = withTenantIsolation(request, conditions.length ? { AND: conditions } : {});

    return prisma.task.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        taskCompletions: {
          take: 5,
          orderBy: {
            completedAt: 'desc',
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  async getTask(request: FastifyRequest, id: string) {
    const task = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        taskCompletions: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  async createTask(request: FastifyRequest, data: any) {
    const org = request.organization;

    if (!org) {
      throw new Error('Organization required');
    }

    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id: data.clientId }),
    });

    if (!client) {
      throw new Error('Client not found in your organization');
    }

    let assignedToId: string | null = data.assignedToId ?? null;
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
      });

      if (!assignee || assignee.organizationId !== org.id) {
        throw new Error('Assigned user not found in your organization');
      }

      if (assignee.role !== 'WORKER') {
        throw new Error('Assigned user must have WORKER role');
      }

      if (assignee.isActive === false) {
        throw new Error('Assigned user is inactive');
      }
    }

    const taskId = require('crypto').randomBytes(16).toString('hex');

    return prisma.task.create({
      data: {
        id: taskId,
        title: data.title,
        description: data.description || null,
        category: data.category || 'GENERAL',
        priority: data.priority || 'NORMAL',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isRecurring: data.isRecurring || false,
        clientId: data.clientId,
        assignedToId,
        organizationId: org.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async updateTask(request: FastifyRequest, id: string, data: any) {
    const existing = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!existing) {
      throw new Error('Task not found');
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedToId !== undefined) {
      if (data.assignedToId === null) {
        updateData.assignedToId = null;
      } else {
        const assignee = await prisma.user.findUnique({
          where: { id: data.assignedToId },
        });

        if (!assignee || assignee.organizationId !== existing.organizationId) {
          throw new Error('Assigned user not found in your organization');
        }

        if (assignee.role !== 'WORKER') {
          throw new Error('Assigned user must have WORKER role');
        }

        if (assignee.isActive === false) {
          throw new Error('Assigned user is inactive');
        }

        updateData.assignedToId = data.assignedToId;
      }
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;

    return prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async deleteTask(request: FastifyRequest, id: string) {
    const existing = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!existing) {
      throw new Error('Task not found');
    }

    await prisma.task.delete({ where: { id } });

    return { message: 'Task deleted successfully' };
  }

  async completeTask(request: FastifyRequest, id: string, input: CompleteTaskInput = {}) {
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }

    const task = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const status = input.status || TaskCompletionStatus.COMPLETE;

    if (status === TaskCompletionStatus.INCOMPLETE || status === TaskCompletionStatus.REFUSED) {
      if (!input.refusalReason) {
        throw new Error('Reason for refusal is required for incomplete or refused tasks');
      }
    }

    const completionId = require('crypto').randomBytes(16).toString('hex');
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : (forwardedFor as string | undefined)?.split(',')[0]?.trim() || request.ip || null;

    const criticalAlertFlagged =
      task.category === 'MEDICATION' && status === TaskCompletionStatus.REFUSED;

    const completion = await prisma.taskCompletion.create({
      data: {
        id: completionId,
        taskId: id,
        completedBy: user.id,
        completedAt: new Date(),
        status,
        refusalReason: input.refusalReason || null,
        notes: input.notes || null,
        version: 1,
        parentLogId: null,
        editReason: null,
        signatureSvg: input.signatureSvg || null,
        initials: input.initials || null,
        deviceInfo: (request.headers['user-agent'] as string) || null,
        ipAddress,
        criticalAlertFlagged,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            title: true,
            category: true,
          },
        },
      },
    });

    return {
      message: 'Task completed successfully',
      completion,
      criticalAlert: criticalAlertFlagged
        ? 'Critical alert: medication task marked as refused'
        : null,
    };
  }

  /**
   * Log a task completion with immutable audit trail
   */
  async logTask(request: FastifyRequest, input: LogTaskInput) {
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }

    const task = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id: input.taskId }),
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const status = input.status || TaskCompletionStatus.COMPLETE;

    if (status === TaskCompletionStatus.INCOMPLETE || status === TaskCompletionStatus.REFUSED) {
      if (!input.refusalReason) {
        throw new Error('Reason for refusal is required for incomplete or refused tasks');
      }
    }

    let version = 1;
    let parentLogId: string | null = null;

    if (input.originalLogId) {
      const original = await prisma.taskCompletion.findUnique({
        where: { id: input.originalLogId },
        include: {
          task: true,
        },
      });

      if (!original || original.task.organizationId !== task.organizationId) {
        throw new Error('Original log not found');
      }

      if (!input.editReason) {
        throw new Error('Edit reason is required for immutable audit trail');
      }

      parentLogId = original.id;
      version = original.version + 1;
    }

    const completionId = require('crypto').randomBytes(16).toString('hex');
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : (forwardedFor as string | undefined)?.split(',')[0]?.trim() || request.ip || null;

    const criticalAlertFlagged =
      task.category === 'MEDICATION' && status === TaskCompletionStatus.REFUSED;

    const now = new Date();

    const completion = await prisma.taskCompletion.create({
      data: {
        id: completionId,
        taskId: task.id,
        completedBy: user.id,
        completedAt: now,
        status,
        refusalReason: input.refusalReason || null,
        notes: input.notes || null,
        version,
        parentLogId,
        editReason: input.editReason || null,
        metadata: input.metadata ?? undefined,
        signatureSvg: null,
        initials: null,
        deviceInfo: (request.headers['user-agent'] as string) || null,
        ipAddress,
        criticalAlertFlagged,
        createdAt: now,
        updatedAt: now,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            title: true,
            category: true,
          },
        },
      },
    });

    return {
      message: 'Task log created successfully',
      completion,
      criticalAlert: criticalAlertFlagged
        ? 'Critical alert: medication task marked as refused'
        : null,
    };
  }

  async getNarrativeAuditReport(
    request: FastifyRequest,
    clientId: string,
    startDate: string,
    endDate: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const tasks = await prisma.task.findMany({
      where: withTenantIsolation(request, {
        clientId,
      }),
      include: {
        taskCompletions: {
          where: {
            completedAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            completedAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const notes = await prisma.note.findMany({
      where: withTenantIsolation(request, {
        clientId,
        createdAt: {
          gte: start,
          lte: end,
        },
      }),
      orderBy: {
        createdAt: 'asc',
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) =>
      task.taskCompletions.some((completion) => completion.status === TaskCompletionStatus.COMPLETE)
    ).length;

    const completionPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const chronologicalLog = tasks.flatMap((task) =>
      task.taskCompletions.map((completion) => ({
        type: 'TASK_COMPLETION',
        taskId: task.id,
        taskTitle: task.title,
        taskCategory: task.category,
        status: completion.status,
        refusalReason: completion.refusalReason,
        completionNotes: completion.notes,
        completedAt: completion.completedAt,
        createdAt: completion.createdAt,
        updatedAt: completion.updatedAt,
        originalEntryTimestamp: completion.createdAt,
        editedTimestamp: completion.completedAt,
        completedBy: `${completion.user.firstName} ${completion.user.lastName}`,
      }))
    ).sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

    const incidentsOrRefusals = [
      ...notes
        .filter((note) => note.category === 'INCIDENT')
        .map((note) => ({
          source: 'NOTE',
          noteId: note.id,
          category: note.category,
          content: note.content,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          originalCreatedAt: note.originalCreatedAt,
        })),
      ...chronologicalLog
        .filter((entry) => entry.status === TaskCompletionStatus.REFUSED)
        .map((entry) => ({
          source: 'TASK',
          taskId: entry.taskId,
          taskTitle: entry.taskTitle,
          refusalReason: entry.refusalReason,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
    ];

    return {
      clientId,
      dateRange: {
        start,
        end,
      },
      completionPercentage,
      chronologicalLog,
      incidentsOrRefusals,
    };
  }
}
