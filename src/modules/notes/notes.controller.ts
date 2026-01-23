// src/modules/notes/notes.controller.ts
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
    const user = (request as any).user
    const notes = await notesService.getNotesForWorker(user.userId)

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
  request: FastifyRequest<{ Body: CreateNoteBody }>,
  reply: FastifyReply
) {
  try {
    const user = (request as any).user
    const { content, category, clientId } = request.body

    const note = await notesService.createNote({
      content,
      category,
      clientId,
      authorId: user.userId
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
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params
    const notes = await notesService.getNotesForClient(id)

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