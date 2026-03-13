import Fastify from '@/shared/http/compat';
import { NoteCategory, UserRole } from '@prisma/client';
import { JWTService } from '../auth/jwt.service';
import { notesRoutes } from './notes.routes';
import { tasksRoutes } from '../tasks/tasks.routes';
import { prisma } from '../../../tests/setup';
import { createClient, createOrganization, createUser } from '../../../tests/helpers';

describe('Notes archival integration', () => {
  const app = Fastify();
  const jwtService = new JWTService();

  beforeAll(async () => {
    await app.register(notesRoutes, { prefix: '/api/notes' });
    await app.register(tasksRoutes, { prefix: '/api/tasks' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('archives notes and only returns them in compliance export with includeArchived=true', async () => {
    const org = await createOrganization({ name: 'Archive Test Org' });
    const user = await createUser({
      organizationId: org.id,
      role: UserRole.ADMIN,
      email: 'archive-admin@test.com',
    });
    const client = await createClient({
      organizationId: org.id,
      firstName: 'Arch',
      lastName: 'Ived',
    });

    const note = await prisma.note.create({
      data: {
        id: 'note_archive_visibility_test',
        organizationId: org.id,
        content: 'Resident fall incident for archival visibility test',
        category: NoteCategory.INCIDENT,
        clientId: client.id,
        authorId: user.id,
        version: 1,
        isLatest: true,
        parentLogId: null,
        editReason: null,
        isSignificant: true,
        originalCreatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const token = jwtService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: org.id,
      globalAdmin: false,
    });

    const authHeaders = {
      authorization: `Bearer ${token}`,
    };

    const archiveResponse = await app.inject({
      method: 'DELETE',
      url: `/api/notes/${note.id}`,
      headers: authHeaders,
      payload: { reason: 'Archived for compliance check' },
    });
    expect(archiveResponse.statusCode).toBe(200);

    const notesResponse = await app.inject({
      method: 'GET',
      url: '/api/notes/',
      headers: authHeaders,
    });
    expect(notesResponse.statusCode).toBe(200);
    expect(
      notesResponse
        .json()
        .data.some((row: any) => row.id === note.id)
    ).toBe(false);

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const exportWithoutArchived = await app.inject({
      method: 'GET',
      url: `/api/tasks/audit-export?clientId=${client.id}&startDate=${encodeURIComponent(
        start
      )}&endDate=${encodeURIComponent(end)}`,
      headers: authHeaders,
    });
    expect(exportWithoutArchived.statusCode).toBe(200);
    expect(
      exportWithoutArchived
        .json()
        .data.incidentsOrRefusals.some((entry: any) => entry.noteId === note.id)
    ).toBe(false);

    const exportWithArchived = await app.inject({
      method: 'GET',
      url: `/api/tasks/audit-export?clientId=${client.id}&startDate=${encodeURIComponent(
        start
      )}&endDate=${encodeURIComponent(end)}&includeArchived=true`,
      headers: authHeaders,
    });
    expect(exportWithArchived.statusCode).toBe(200);
    expect(
      exportWithArchived
        .json()
        .data.incidentsOrRefusals.some((entry: any) => entry.noteId === note.id)
    ).toBe(true);
  });
});
