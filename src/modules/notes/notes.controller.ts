import { FastifyRequest, FastifyReply } from 'fastify'
import { NotesService } from './notes.service'
import { NoteCategory } from '@prisma/client'

const notesService = new NotesService()

interface CreateNoteBody {
  content: string
  category?: NoteCategory
  clientId: string
}

export async function listNotes(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const notes = await notesService.getNotes(request, request.query)

    return reply.status(200).send({
      success: true,
      data: notes
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function createNote(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { content, category, clientId } = request.body as CreateNoteBody

    const note = await notesService.createNote(request, {
      content,
      category,
      clientId
    })

    return reply.status(201).send({
      success: true,
      data: note
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function getClientNotes(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string }
    const notes = await notesService.getNotes(request, { clientId: id })

    return reply.status(200).send({
      success: true,
      data: notes
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}
