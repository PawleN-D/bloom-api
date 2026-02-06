import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

type CreateTicketInput = {
  organizationId?: string | null;
  subject: string;
  description: string;
  priority?: SupportTicketPriority;
  assignedToId?: string | null;
};

type UpdateTicketInput = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedToId?: string | null;
};

export class HQSupportService {
  async createTicket(userId: string, input: CreateTicketInput) {
    const now = new Date();
    return prisma.supportTicket.create({
      data: {
        organizationId: input.organizationId ?? null,
        subject: input.subject,
        description: input.description,
        status: SupportTicketStatus.OPEN,
        priority: input.priority ?? SupportTicketPriority.MEDIUM,
        createdById: userId,
        assignedToId: input.assignedToId ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async listTickets(filters: any) {
    const { status, priority, organizationId, assignedToId, search } = filters || {};
    const where: any = {
      status: status || undefined,
      priority: priority || undefined,
      organizationId: organizationId || undefined,
      assignedToId: assignedToId || undefined,
    };

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.supportTicket.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
        assignedTo: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicket(ticketId: string) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
        assignedTo: { select: { id: true, email: true } },
        notes: {
          include: {
            author: { select: { id: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return ticket;
  }

  async updateTicket(ticketId: string, input: UpdateTicketInput) {
    const now = new Date();
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: input.status ?? undefined,
        priority: input.priority ?? undefined,
        assignedToId: input.assignedToId ?? undefined,
        updatedAt: now,
      },
    });
  }

  async addNote(ticketId: string, authorId: string, body: string, internal = true) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return prisma.supportNote.create({
      data: {
        ticketId,
        authorId,
        body,
        internal,
        createdAt: new Date(),
      },
    });
  }
}
