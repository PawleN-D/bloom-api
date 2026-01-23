// src/modules/notes/notes.service.test.ts
import { NotesService } from './notes.service'
import { prisma } from '../../../tests/setup'
import { UserRole, NoteCategory } from '@prisma/client'

describe('NotesService', () => {
  let notesService: NotesService
  let testWorker: any
  let testClient: any

  beforeEach(async () => {
    notesService = new NotesService()

    testWorker = await prisma.user.create({
      data: {
        email: 'worker@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Worker',
        role: UserRole.WORKER
      }
    })

    testClient = await prisma.client.create({
      data: {
        firstName: 'Test',
        lastName: 'Client'
      }
    })

    await prisma.assignment.create({
      data: {
        userId: testWorker.id,
        clientId: testClient.id
      }
    })
  })

  describe('createNote', () => {
    it('should create a note', async () => {
      const noteData = {
        content: 'Patient doing well today',
        category: NoteCategory.PROGRESS,
        clientId: testClient.id,
        authorId: testWorker.id
      }

      const note = await notesService.createNote(noteData)

      expect(note).toBeDefined()
      expect(note.content).toBe('Patient doing well today')
      expect(note.category).toBe(NoteCategory.PROGRESS)
    })
  })

  describe('getNotesForClient', () => {
    it('should return notes for client', async () => {
      await prisma.note.create({
        data: {
          content: 'Note 1',
          clientId: testClient.id,
          authorId: testWorker.id
        }
      })
      await prisma.note.create({
        data: {
          content: 'Note 2',
          clientId: testClient.id,
          authorId: testWorker.id
        }
      })

      const notes = await notesService.getNotesForClient(testClient.id)

      expect(notes).toHaveLength(2)
    })
  })

  describe('getNotesForWorker', () => {
    it('should return notes only for assigned clients', async () => {
      await prisma.note.create({
        data: {
          content: 'My client note',
          clientId: testClient.id,
          authorId: testWorker.id
        }
      })

      // Other client not assigned
      const otherClient = await prisma.client.create({
        data: { firstName: 'Other', lastName: 'Client' }
      })
      await prisma.note.create({
        data: {
          content: 'Other note',
          clientId: otherClient.id,
          authorId: testWorker.id
        }
      })

      const notes = await notesService.getNotesForWorker(testWorker.id)

      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('My client note')
    })
  })
})