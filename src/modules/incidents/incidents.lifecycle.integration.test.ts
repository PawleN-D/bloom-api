import { IncidentCategory, IncidentSeverity, IncidentStatus, UserRole } from '@prisma/client';
import { prisma } from '../../../tests/setup';
import { buildRequest, createClient, createOrganization, createUser } from '../../../tests/helpers';
import { incidentsService } from './incidents.service';

describe('Incidents lifecycle integration', () => {
  it('creates, acknowledges, and closes an incident', async () => {
    const organization = await createOrganization({ name: 'Incident Org' });
    const reporter = await createUser({
      organizationId: organization.id,
      role: UserRole.WORKER,
      email: 'reporter@incidents.test',
    });
    const manager = await createUser({
      organizationId: organization.id,
      role: UserRole.MANAGER,
      email: 'manager@incidents.test',
    });
    const client = await createClient({
      organizationId: organization.id,
      firstName: 'Resident',
      lastName: 'One',
    });

    const createRequest = buildRequest({ user: reporter, organization });
    const created = await incidentsService.createIncident(createRequest, {
      clientId: client.id,
      category: IncidentCategory.FALL,
      severity: IncidentSeverity.HIGH,
      title: 'Resident slip in hallway',
      description: 'Resident slipped while returning from dining area.',
    });

    expect(created.status).toBe(IncidentStatus.OPEN);
    expect(created.slaDueAt).toBeTruthy();

    const managerRequest = buildRequest({ user: manager, organization });
    const acknowledged = await incidentsService.acknowledgeIncident(
      managerRequest,
      created.id
    );
    expect(acknowledged.status).toBe(IncidentStatus.ACKNOWLEDGED);
    expect(acknowledged.acknowledgedBy).toBe(manager.id);

    const closed = await incidentsService.closeIncident(managerRequest, created.id, {
      resolution: 'Resident assessed and monitored. No injury found.',
      preventiveActions: 'Added anti-slip signage and staff escort reminder.',
    });
    expect(closed.status).toBe(IncidentStatus.CLOSED);
    expect(closed.closedBy).toBe(manager.id);
    expect(closed.resolution).toContain('Resident assessed');

    const dbIncident = await prisma.incident.findUnique({
      where: { id: created.id },
      select: {
        status: true,
        acknowledgedAt: true,
        closedAt: true,
      },
    });

    expect(dbIncident?.status).toBe(IncidentStatus.CLOSED);
    expect(dbIncident?.acknowledgedAt).toBeTruthy();
    expect(dbIncident?.closedAt).toBeTruthy();
  });
});

