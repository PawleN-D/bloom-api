import { FastifyRequest } from 'fastify';
import { TaskCompletionStatus, UserRole } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  createdAt?: Date | string | null;
  read?: boolean;
  actionUrl?: string | null;
};

type ReadState = {
  readIds: Set<string>;
  readAllAt?: Date;
};

const readStore = new Map<string, ReadState>();

const getReadState = (userId: string): ReadState => {
  const existing = readStore.get(userId);
  if (existing) return existing;
  const next = { readIds: new Set<string>() };
  readStore.set(userId, next);
  return next;
};

const formatName = (first?: string | null, last?: string | null) =>
  `${first || ''} ${last || ''}`.trim();

export class NotificationsService {
  async list(request: FastifyRequest): Promise<NotificationItem[]> {
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }

    if (!request.organization) {
      return [];
    }

    const now = new Date();
    const recentWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const items: NotificationItem[] = [];

    if (user.role === UserRole.WORKER) {
      const dueSoonEnd = new Date(now.getTime() + 15 * 60 * 1000);

      const dueSoonTasks = await prisma.task.findMany({
        where: withTenantIsolation(request, {
          assignedToId: user.id,
          deletedAt: null,
          dueDate: { gte: now, lte: dueSoonEnd },
        }),
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      });

      dueSoonTasks.forEach((task) => {
        const clientName = task.client
          ? formatName(task.client.firstName, task.client.lastName)
          : 'Client';
        items.push({
          id: `due-${task.id}`,
          title: 'Task starting soon',
          body: `${task.title} - ${clientName || 'Client'}`,
          type: 'TASK_DUE',
          createdAt: task.dueDate ?? now,
          actionUrl: '/tasks',
        });
      });

      const skippedCompletions = await prisma.taskCompletion.findMany({
        where: {
          completedBy: user.id,
          status: { in: [TaskCompletionStatus.INCOMPLETE, TaskCompletionStatus.REFUSED] },
          completedAt: { gte: recentWindow },
          task: { organizationId: request.organization.id },
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              dueDate: true,
              client: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });

      skippedCompletions.forEach((completion) => {
        const clientName = completion.task?.client
          ? formatName(completion.task.client.firstName, completion.task.client.lastName)
          : 'Client';
        const statusLabel =
          completion.status === TaskCompletionStatus.REFUSED ? 'refused' : 'skipped';
        items.push({
          id: `skip-${completion.id}`,
          title: `Task ${statusLabel}`,
          body: `${completion.task?.title || 'Task'} - ${clientName || 'Client'}`,
          type: 'TASK_SKIPPED',
          createdAt: completion.completedAt,
          actionUrl: '/tasks',
        });
      });

      const updatedTasks = await prisma.task.findMany({
        where: withTenantIsolation(request, {
          assignedToId: user.id,
          deletedAt: null,
          updatedAt: { gte: recentWindow },
        }),
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });

      updatedTasks
        .filter((task) => task.updatedAt > task.createdAt)
        .forEach((task) => {
          const clientName = task.client
            ? formatName(task.client.firstName, task.client.lastName)
            : 'Client';
          items.push({
            id: `updated-${task.id}`,
            title: 'Task updated',
            body: `${task.title} - ${clientName || 'Client'}`,
            type: 'TASK_UPDATED',
            createdAt: task.updatedAt,
            actionUrl: '/tasks',
          });
        });
    } else {
      const handoverStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const handoverNotes = await prisma.note.findMany({
        where: withTenantIsolation(request, {
          isLatest: true,
          isSignificant: true,
          deletedAt: null,
          createdAt: { gte: handoverStart },
        }),
        include: {
          user: { select: { firstName: true, lastName: true } },
          client: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      handoverNotes.forEach((note) => {
        const clientName = note.client
          ? formatName(note.client.firstName, note.client.lastName)
          : 'Client';
        const authorName = note.user
          ? formatName(note.user.firstName, note.user.lastName)
          : 'Staff member';
        items.push({
          id: `handover-${note.id}`,
          title: 'New handover note',
          body: `${clientName || 'Client'} - ${authorName || 'Staff member'}`,
          type: 'HANDOVER',
          createdAt: note.createdAt,
          actionUrl: '/actions',
        });
      });

      const missedTasks = await prisma.task.findMany({
        where: withTenantIsolation(request, {
          deletedAt: null,
          assignedToId: { not: null },
          dueDate: { lt: now, gte: recentWindow },
        }),
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
          taskCompletions: { select: { status: true } },
        },
        orderBy: { dueDate: 'desc' },
        take: 10,
      });

      missedTasks
        .filter((task) =>
          !task.taskCompletions?.some((completion) => completion.status === TaskCompletionStatus.COMPLETE)
        )
        .forEach((task) => {
          const clientName = task.client
            ? formatName(task.client.firstName, task.client.lastName)
            : 'Client';
          const workerName = task.assignedTo
            ? formatName(task.assignedTo.firstName, task.assignedTo.lastName)
            : 'Worker';
          items.push({
            id: `missed-${task.id}`,
            title: 'Task missed',
            body: `${task.title} - ${workerName || 'Worker'} - ${clientName || 'Client'}`,
            type: 'TASK_MISSED',
            createdAt: task.dueDate ?? now,
            actionUrl: '/tasks?filter=attention',
          });
        });

      const summaryKey = now.toISOString().slice(0, 10);
      items.push({
        id: `summary-${summaryKey}`,
        title: 'Daily summary ready',
        body: 'Your daily summary report is ready to review.',
        type: 'SUMMARY',
        createdAt: now,
        actionUrl: '/reports',
      });
    }

    const deduped = new Map<string, NotificationItem>();
    items.forEach((item) => {
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item);
      }
    });

    const state = getReadState(user.id);
    const readAllAt = state.readAllAt;
    const readIds = state.readIds;

    return Array.from(deduped.values())
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .map((item) => {
        const createdAt = item.createdAt ? new Date(item.createdAt) : null;
        const read =
          readIds.has(item.id) ||
          (readAllAt && createdAt ? createdAt <= readAllAt : false);
        return { ...item, read };
      });
  }

  markRead(request: FastifyRequest, id: string) {
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }
    const state = getReadState(user.id);
    state.readIds.add(id);
    return { id, read: true };
  }

  markAllRead(request: FastifyRequest) {
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }
    const state = getReadState(user.id);
    state.readAllAt = new Date();
    state.readIds.clear();
    return { readAt: state.readAllAt };
  }
}
