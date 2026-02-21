import { AuditOperation, UserRole } from '@prisma/client';
import { prisma } from '../../../tests/setup';
import { buildRequest, createClient, createOrganization, createUser } from '../../../tests/helpers';
import { ClientsService } from '../clients/clients.service';

describe('Audit trail integration', () => {
  it('logs field-level diff when a client is updated', async () => {
    const organization = await createOrganization({ name: 'Audit Org' });
    const manager = await createUser({
      organizationId: organization.id,
      role: UserRole.MANAGER,
      email: 'manager@audit.test',
    });
    const client = await createClient({
      organizationId: organization.id,
      firstName: 'Before',
      lastName: 'Client',
    });

    const service = new ClientsService();
    const request = buildRequest({ user: manager, organization });
    const updated = await service.updateClient(request, client.id, {
      firstName: 'After',
      address: '123 Test Lane',
    });

    expect(updated.firstName).toBe('After');

    const events = await prisma.auditEvent.findMany({
      where: {
        organizationId: organization.id,
        entityType: 'Client',
        entityId: client.id,
        operation: AuditOperation.UPDATE,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    expect(events).toHaveLength(1);
    const fieldChanges = events[0].fieldChanges as any;
    expect(fieldChanges.firstName.before).toBe('Before');
    expect(fieldChanges.firstName.after).toBe('After');
    expect(fieldChanges.address.before).toBeNull();
    expect(fieldChanges.address.after).toBe('123 Test Lane');
  });
});

