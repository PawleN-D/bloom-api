import { FastifyRequest } from '@/shared/http/compat';
import { AuditOperation } from '@prisma/client';
import { prisma, runInTenantTransaction } from '../../shared/database/prisma';
import { computeFieldDiff, logAuditEvent } from '../../shared/middleware/audit-trail';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

export class NotesService {
  async getNotes(request: FastifyRequest, filters?: any) {
    const user = request.user;
    const { clientId, authorId, search, significantOnly, includeArchived } = filters || {};

    const where = withTenantIsolation(request, {
      clientId: clientId || undefined,
      authorId: authorId || (user?.role === 'WORKER' ? user.id : undefined),
      isLatest: true,
      isSignificant: significantOnly ? true : undefined,
      deletedAt: includeArchived ? undefined : null,
    });

    if (search) {
      (where as any).content = {
        contains: search,
        mode: 'insensitive',
      };
    }

    return prisma.note.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getSignificantHandover(request: FastifyRequest, hours = 12) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const where = withTenantIsolation(request, {
      isLatest: true,
      isSignificant: true,
      deletedAt: null,
      createdAt: {
        gte: windowStart,
      },
    });

    return prisma.note.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNote(request: FastifyRequest, id: string) {
    const note = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        parent: {
          select: {
            id: true,
            createdAt: true,
            content: true,
            version: true,
          },
        },
      },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    if (note.deletedAt) {
      throw new Error('Note not found');
    }

    return note;
  }

  async createNote(request: FastifyRequest, data: any) {
    const user = request.user;
    const org = request.organization;

    if (!user) throw new Error('User required');
    if (!org) throw new Error('Organization required');
    if (!data.content || !data.clientId) {
      throw new Error('Content and client ID are required');
    }

    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id: data.clientId }),
    });

    if (!client) {
      throw new Error('Client not found in your organization');
    }

    if (user?.role === 'WORKER') {
      const assignment = await prisma.assignment.findUnique({
        where: {
          userId_clientId: {
            clientId: data.clientId,
            userId: user.id,
          },
        },
      });

      if (!assignment) {
        throw new Error('You can only create notes for assigned clients');
      }
    }

    const noteId = require('crypto').randomBytes(16).toString('hex');
    const now = new Date();

    const note = await prisma.note.create({
      data: {
        id: noteId,
        content: data.content,
        category: data.category || 'GENERAL',
        clientId: data.clientId,
        authorId: user.id,
        organizationId: org.id,
        version: 1,
        isLatest: true,
        parentLogId: null,
        editReason: data.editReason || null,
        isSignificant: Boolean(data.isSignificant),
        originalCreatedAt: now,
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
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.CREATE,
      entityType: 'Note',
      entityId: note.id,
      fieldChanges: computeFieldDiff(null, {
        category: note.category,
        clientId: note.clientId,
        authorId: note.authorId,
        isSignificant: note.isSignificant,
      }),
    });

    return note;
  }

  async updateNote(request: FastifyRequest, id: string, data: any) {
    const user = request.user;

    const existing = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!existing) {
      throw new Error('Note not found');
    }

    if (existing.deletedAt) {
      throw new Error('Cannot update archived note');
    }

    if (user?.role === 'WORKER' && existing.authorId !== user.id) {
      throw new Error('You can only edit your own notes');
    }

    if (!existing.isLatest) {
      throw new Error('Only latest version can be edited');
    }

    if (!data.content) {
      throw new Error('Updated content is required');
    }

    if (!data.editReason) {
      throw new Error('Edit reason is required for immutable audit trail');
    }

    const nextVersionNumber = existing.version + 1;
    const rootId = existing.parentLogId || existing.id;
    const newNoteId = require('crypto').randomBytes(16).toString('hex');
    const now = new Date();

    const versionNote = await runInTenantTransaction(async (tx) => {
      await tx.note.update({
        where: { id: existing.id },
        data: {
          isLatest: false,
          updatedAt: now,
        },
      });

      return tx.note.create({
        data: {
          id: newNoteId,
          content: data.content,
          category: data.category || existing.category,
          clientId: existing.clientId,
          authorId: user?.id || existing.authorId,
          organizationId: existing.organizationId,
          parentLogId: rootId,
          version: nextVersionNumber,
          isLatest: true,
          editReason: data.editReason,
          isSignificant:
            data.isSignificant !== undefined
              ? Boolean(data.isSignificant)
              : existing.isSignificant,
          originalCreatedAt: existing.originalCreatedAt,
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
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    await logAuditEvent(request, {
      operation: AuditOperation.UPDATE,
      entityType: 'Note',
      entityId: rootId,
      fieldChanges: computeFieldDiff(existing as any, versionNote as any, {
        onlyKeys: [
          'content',
          'category',
          'editReason',
          'isSignificant',
          'clientId',
          'authorId',
        ],
      }),
      reason: data.editReason,
    });

    return versionNote;
  }

  async deleteNote(request: FastifyRequest, id: string, reason?: string) {
    const user = request.user;

    const existing = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!existing) {
      throw new Error('Note not found');
    }

    if (existing.deletedAt) {
      return { message: 'Note already archived' };
    }

    if (user?.role === 'WORKER' && existing.authorId !== user.id) {
      throw new Error('You can only delete your own notes');
    }

    const archived = await prisma.note.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user?.id || null,
        deletedReason: reason?.trim() || 'User requested deletion',
        updatedAt: new Date(),
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.ARCHIVE,
      entityType: 'Note',
      entityId: archived.id,
      fieldChanges: computeFieldDiff(existing as any, archived as any, {
        onlyKeys: ['deletedAt', 'deletedBy', 'deletedReason'],
      }),
      reason: archived.deletedReason || undefined,
    });

    return { message: 'Note archived successfully' };
  }
}
