import {
  AuditOperation,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  NoteCategory,
} from '@prisma/client';
import { FastifyRequest } from '@/shared/http/compat';
import { prisma } from '../../shared/database/prisma';
import { computeFieldDiff, logAuditEvent } from '../../shared/middleware/audit-trail';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

type CreateIncidentInput = {
  clientId?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  reportedAt?: string | Date;
};

type UpdateIncidentInput = {
  clientId?: string | null;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  title?: string;
  description?: string;
  status?: IncidentStatus;
  resolution?: string | null;
  preventiveActions?: string | null;
};

type CloseIncidentInput = {
  resolution: string;
  preventiveActions?: string;
};

const severityToHours: Record<IncidentSeverity, number> = {
  CRITICAL: 2,
  HIGH: 12,
  MEDIUM: 48,
  LOW: 168,
};

export class IncidentsService {
  private calculateSLA(severity: IncidentSeverity, reportedAt: Date): Date {
    const hours = severityToHours[severity];
    return new Date(reportedAt.getTime() + hours * 60 * 60 * 1000);
  }

  private inferSeverity(content: string): IncidentSeverity {
    const normalized = content.toLowerCase();
    if (/critical|collapse|seizure|unresponsive|999/.test(normalized)) {
      return IncidentSeverity.CRITICAL;
    }
    if (/fall|injury|bleed|assault|error/.test(normalized)) {
      return IncidentSeverity.HIGH;
    }
    return IncidentSeverity.MEDIUM;
  }

  private mapNoteCategory(category: NoteCategory): IncidentCategory {
    if (category === NoteCategory.INCIDENT) {
      return IncidentCategory.OTHER;
    }
    return IncidentCategory.OTHER;
  }

  async createIncident(request: FastifyRequest, data: CreateIncidentInput) {
    const user = request.user;
    const org = request.organization;

    if (!user) throw new Error('User required');
    if (!org) throw new Error('Organization required');

    if (data.clientId) {
      const client = await prisma.client.findUnique({
        where: withTenantIsolation(request, { id: data.clientId }),
        select: { id: true },
      });
      if (!client) {
        throw new Error('Client not found in your organization');
      }
    }

    const reportedAt = data.reportedAt ? new Date(data.reportedAt) : new Date();
    if (Number.isNaN(reportedAt.getTime())) {
      throw new Error('Invalid reportedAt');
    }

    const incident = await prisma.incident.create({
      data: {
        organizationId: org.id,
        clientId: data.clientId || null,
        reportedById: user.id,
        category: data.category,
        severity: data.severity,
        title: data.title.trim(),
        description: data.description.trim(),
        status: IncidentStatus.OPEN,
        reportedAt,
        slaDueAt: this.calculateSLA(data.severity, reportedAt),
      },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        reportedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.CREATE,
      entityType: 'Incident',
      entityId: incident.id,
      fieldChanges: computeFieldDiff(null, {
        status: incident.status,
        severity: incident.severity,
        category: incident.category,
        clientId: incident.clientId,
      }),
    });

    return incident;
  }

  async listIncidents(request: FastifyRequest, filters?: any) {
    const { status, severity, clientId } = filters || {};

    return prisma.incident.findMany({
      where: withTenantIsolation(request, {
        status: status || undefined,
        severity: severity || undefined,
        clientId: clientId || undefined,
      }),
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        reportedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        acknowledgedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        closedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: [{ slaDueAt: 'asc' }, { reportedAt: 'desc' }],
    });
  }

  async getIncident(request: FastifyRequest, id: string) {
    const incident = await prisma.incident.findUnique({
      where: withTenantIsolation(request, { id }),
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        reportedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        acknowledgedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        closedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    if (!incident) {
      throw new Error('Incident not found');
    }

    return incident;
  }

  async updateIncident(request: FastifyRequest, id: string, data: UpdateIncidentInput) {
    const existing = await prisma.incident.findUnique({
      where: withTenantIsolation(request, { id }),
    });

    if (!existing) {
      throw new Error('Incident not found');
    }

    if (data.clientId) {
      const client = await prisma.client.findUnique({
        where: withTenantIsolation(request, { id: data.clientId }),
        select: { id: true },
      });
      if (!client) {
        throw new Error('Client not found in your organization');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.severity !== undefined) {
      updateData.severity = data.severity;
      updateData.slaDueAt = this.calculateSLA(data.severity, existing.reportedAt);
    }
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.status !== undefined) updateData.status = data.status;
    if (data.resolution !== undefined) updateData.resolution = data.resolution;
    if (data.preventiveActions !== undefined) {
      updateData.preventiveActions = data.preventiveActions;
    }

    const updated = await prisma.incident.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        reportedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.UPDATE,
      entityType: 'Incident',
      entityId: updated.id,
      fieldChanges: computeFieldDiff(existing as any, updated as any, {
        excludeKeys: ['updatedAt', 'client', 'reportedBy'],
      }),
    });

    return updated;
  }

  async acknowledgeIncident(request: FastifyRequest, incidentId: string) {
    const user = request.user;
    if (!user) throw new Error('User required');

    const incident = await prisma.incident.findUnique({
      where: withTenantIsolation(request, { id: incidentId }),
    });

    if (!incident) throw new Error('Incident not found');
    if (incident.status !== IncidentStatus.OPEN) {
      throw new Error('Incident already acknowledged');
    }

    const now = new Date();
    const slaBreached = incident.slaDueAt ? now > incident.slaDueAt : false;

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: now,
        acknowledgedBy: user.id,
        slaBreached,
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.UPDATE,
      entityType: 'Incident',
      entityId: updated.id,
      fieldChanges: computeFieldDiff(incident as any, updated as any, {
        onlyKeys: ['status', 'acknowledgedAt', 'acknowledgedBy', 'slaBreached'],
      }),
      reason: 'Incident acknowledged',
    });

    return updated;
  }

  async closeIncident(
    request: FastifyRequest,
    incidentId: string,
    payload: CloseIncidentInput
  ) {
    const user = request.user;
    if (!user) throw new Error('User required');

    const incident = await prisma.incident.findUnique({
      where: withTenantIsolation(request, { id: incidentId }),
    });

    if (!incident) throw new Error('Incident not found');
    if (incident.status === IncidentStatus.CLOSED) {
      throw new Error('Incident already closed');
    }

    const now = new Date();
    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: {
        status: IncidentStatus.CLOSED,
        closedAt: now,
        closedBy: user.id,
        resolution: payload.resolution,
        preventiveActions: payload.preventiveActions ?? null,
        slaBreached: incident.slaDueAt ? now > incident.slaDueAt : incident.slaBreached,
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.UPDATE,
      entityType: 'Incident',
      entityId: updated.id,
      fieldChanges: computeFieldDiff(incident as any, updated as any, {
        onlyKeys: [
          'status',
          'closedAt',
          'closedBy',
          'resolution',
          'preventiveActions',
          'slaBreached',
        ],
      }),
      reason: 'Incident closed',
    });

    return updated;
  }

  async getOverdueIncidents(request: FastifyRequest) {
    const now = new Date();
    return prisma.incident.findMany({
      where: withTenantIsolation(request, {
        status: {
          in: [
            IncidentStatus.OPEN,
            IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.UNDER_INVESTIGATION,
          ],
        },
        slaDueAt: { lt: now },
      }),
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        reportedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { slaDueAt: 'asc' },
    });
  }

  async promoteFromNote(request: FastifyRequest, noteId: string) {
    const promotedByUserId = request.user?.id;
    if (!promotedByUserId) {
      throw new Error('User required');
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    const severity = this.inferSeverity(note.content);
    const reportedAt = note.originalCreatedAt || note.createdAt;
    const title = note.content.trim().slice(0, 120) || `Incident from note ${note.id}`;

    const incident = await prisma.incident.create({
      data: {
        organizationId: note.organizationId,
        clientId: note.clientId,
        reportedById: note.authorId,
        category: this.mapNoteCategory(note.category),
        severity,
        title,
        description: `${note.content}\n\n[Promoted from note ${note.id}]`,
        status: IncidentStatus.OPEN,
        reportedAt,
        slaDueAt: this.calculateSLA(severity, reportedAt),
      },
    });

    await logAuditEvent(request, {
      operation: AuditOperation.CREATE,
      entityType: 'Incident',
      entityId: incident.id,
      organizationId: incident.organizationId,
      userId: promotedByUserId,
      reason: `Promoted from note ${note.id}`,
      fieldChanges: computeFieldDiff(null, {
        status: incident.status,
        severity: incident.severity,
        category: incident.category,
        clientId: incident.clientId,
      }),
    });

    return incident;
  }
}

export const incidentsService = new IncidentsService();
