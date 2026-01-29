import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

export class NotesService {
  
  /**
   * Get all notes for current organization
   */
  async getNotes(request: FastifyRequest, filters?: any) {
    const user = (request as any).user;
    const { clientId, authorId, search } = filters || {};
    
    // Build where clause with tenant isolation
    const where = withTenantIsolation(request, {
      clientId: clientId || undefined,
      authorId: authorId || (user.role === 'WORKER' ? user.id : undefined),
    });
    
    // Add search filter
    if (search) {
      (where as any).content = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    const notes = await prisma.note.findMany({
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
    
    return notes;
  }
  
  /**
   * Get single note
   */
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
      },
    });
    
    if (!note) {
      throw new Error('Note not found');
    }
    
    return note;
  }
  
  /**
   * Create note
   */
  async createNote(request: FastifyRequest, data: any) {
    const user = (request as any).user;
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization required');
    }
    
    if (!data.content || !data.clientId) {
      throw new Error('Content and client ID are required');
    }
    
    // Verify client belongs to organization
    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id: data.clientId }),
    });
    
    if (!client) {
      throw new Error('Client not found in your organization');
    }
    
    // Workers can only create notes for assigned clients
    if (user.role === 'WORKER') {
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
    
    // Generate ID
    const noteId = require('crypto').randomBytes(16).toString('hex');
    
    const note = await prisma.note.create({
      data: {
        id: noteId,
        content: data.content,
        category: data.category || 'GENERAL',
        clientId: data.clientId,
        authorId: user.id,
        organizationId: org.id,
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
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    return note;
  }
  
  /**
   * Update note
   */
  async updateNote(request: FastifyRequest, id: string, data: any) {
    const user = (request as any).user;
    
    const existing = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Note not found');
    }
    
    // Workers can only edit their own notes
    if (user.role === 'WORKER' && existing.authorId !== user.id) {
      throw new Error('You can only edit your own notes');
    }
    
    const note = await prisma.note.update({
      where: { id },
      data: {
        content: data.content,
        category: data.category,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    return note;
  }
  
  /**
   * Delete note
   */
  async deleteNote(request: FastifyRequest, id: string) {
    const user = (request as any).user;
    
    const existing = await prisma.note.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Note not found');
    }
    
    // Workers can only delete their own notes
    if (user.role === 'WORKER' && existing.authorId !== user.id) {
      throw new Error('You can only delete your own notes');
    }
    
    await prisma.note.delete({ where: { id } });
    
    return { message: 'Note deleted successfully' };
  }
}