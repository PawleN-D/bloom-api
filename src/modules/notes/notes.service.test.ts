import { NoteCategory, UserRole } from '@prisma/client';
import { NotesService } from './notes.service';
import { prisma } from '../../../tests/setup';
import { buildRequest, createClient, createOrganization, createUser } from '../../../tests/helpers';

describe('NotesService', () => {
  let notesService: NotesService;
  let org1: any;
  let org2: any;
  let worker1: any;
  let worker2: any;
  let admin1: any;
  let client1: any;
  let client2: any;
  let requestWorker1: any;
  let requestAdmin1: any;

  beforeEach(async () => {
    notesService = new NotesService();

    org1 = await createOrganization({ name: 'Org One' });
    org2 = await createOrganization({ name: 'Org Two' });

    worker1 = await createUser({ organizationId: org1.id, role: UserRole.WORKER });
    worker2 = await createUser({ organizationId: org1.id, role: UserRole.WORKER });
    admin1 = await createUser({ organizationId: org1.id, role: UserRole.ADMIN });

    client1 = await createClient({ organizationId: org1.id, firstName: 'Client', lastName: 'One' });
    client2 = await createClient({ organizationId: org2.id, firstName: 'Client', lastName: 'Two' });

    await prisma.assignment.create({
      data: {
        id: 'assignment-1',
        userId: worker1.id,
        clientId: client1.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    requestWorker1 = buildRequest({ user: worker1, organization: org1 });
    requestAdmin1 = buildRequest({ user: admin1, organization: org1 });
  });

  describe('createNote', () => {
    it('should create a note scoped to organization', async () => {
      const noteData = {
        content: 'Patient doing well today',
        category: NoteCategory.PROGRESS,
        clientId: client1.id,
      };

      const note = await notesService.createNote(requestWorker1, noteData);

      expect(note).toBeDefined();
      expect(note.content).toBe('Patient doing well today');
      expect(note.category).toBe(NoteCategory.PROGRESS);
      expect(note.organizationId).toBe(org1.id);
      expect(note.authorId).toBe(worker1.id);
      expect(note.versionNumber).toBe(1);
      expect(note.isLatest).toBe(true);
    });

    it('should prevent creating notes for another organization', async () => {
      const noteData = {
        content: 'Cross-tenant note',
        category: NoteCategory.GENERAL,
        clientId: client2.id,
      };

      await expect(notesService.createNote(requestWorker1, noteData)).rejects.toThrow(
        'Client not found in your organization'
      );
    });
  });

  describe('getNotes', () => {
    it('should return only notes for current organization', async () => {
      await prisma.note.create({
        data: {
          id: 'note-1',
          content: 'Org1 note',
          category: NoteCategory.GENERAL,
          clientId: client1.id,
          authorId: worker1.id,
          organizationId: org1.id,
          isLatest: true,
          versionNumber: 1,
          originalCreatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await prisma.note.create({
        data: {
          id: 'note-2',
          content: 'Org2 note',
          category: NoteCategory.GENERAL,
          clientId: client2.id,
          authorId: worker1.id,
          organizationId: org2.id,
          isLatest: true,
          versionNumber: 1,
          originalCreatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const notes = await notesService.getNotes(requestAdmin1, {});

      expect(notes).toHaveLength(1);
      expect(notes[0].organizationId).toBe(org1.id);
    });

    it('should default workers to their own notes', async () => {
      await prisma.note.create({
        data: {
          id: 'note-3',
          content: 'Worker1 note',
          category: NoteCategory.GENERAL,
          clientId: client1.id,
          authorId: worker1.id,
          organizationId: org1.id,
          isLatest: true,
          versionNumber: 1,
          originalCreatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await prisma.note.create({
        data: {
          id: 'note-4',
          content: 'Worker2 note',
          category: NoteCategory.GENERAL,
          clientId: client1.id,
          authorId: worker2.id,
          organizationId: org1.id,
          isLatest: true,
          versionNumber: 1,
          originalCreatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const notes = await notesService.getNotes(requestWorker1, {});

      expect(notes).toHaveLength(1);
      expect(notes[0].authorId).toBe(worker1.id);
    });
  });

  describe('updateNote', () => {
    it('should prevent workers from editing other workers notes', async () => {
      const note = await prisma.note.create({
        data: {
          id: 'note-5',
          content: 'Original',
          category: NoteCategory.GENERAL,
          clientId: client1.id,
          authorId: worker2.id,
          organizationId: org1.id,
          isLatest: true,
          versionNumber: 1,
          originalCreatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        notesService.updateNote(requestWorker1, note.id, { content: 'Updated', editReason: 'Fix typo' })
      ).rejects.toThrow('You can only edit your own notes');
    });

    it('should create a new note version instead of mutating existing row', async () => {
      const original = await notesService.createNote(requestWorker1, {
        content: 'Initial note',
        clientId: client1.id,
        category: NoteCategory.OBSERVATION,
      });

      const updated = await notesService.updateNote(requestWorker1, original.id, {
        content: 'Initial note corrected',
        editReason: 'Additional detail included',
      });

      const storedOriginal = await prisma.note.findUnique({ where: { id: original.id } });
      expect(storedOriginal?.isLatest).toBe(false);
      expect(updated.parentId).toBe(original.id);
      expect(updated.versionNumber).toBe(2);
      expect(updated.editReason).toBe('Additional detail included');
      expect(updated.isLatest).toBe(true);
    });
  });
});
