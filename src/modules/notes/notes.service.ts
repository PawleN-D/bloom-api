import { prisma } from '../../shared/database/prisma'
import { NoteCategory } from '@prisma/client'

interface CreateNoteInput {
  content: string
  category?: NoteCategory
  clientId: string
  authorId: string
}

export class NotesService {
  async createNote(data: CreateNoteInput) {
    return await prisma.note.create({
      data: {
        content: data.content,
        category: data.category || NoteCategory.GENERAL,
        clientId: data.clientId,
        authorId: data.authorId
      }
    })
  }

  async getNotesForClient(clientId: string) {
    return await prisma.note.findMany({
      where: { clientId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async getNotesForWorker(workerId: string) {
    return await prisma.note.findMany({
      where: {
        client: {
          assignments: {
            some: {
              userId: workerId,
              isActive: true
            }
          }
        }
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }
}