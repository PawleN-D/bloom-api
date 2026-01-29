// src/modules/tasks/tasks.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { TasksService } from './tasks.service'
import { TaskCategory, TaskPriority } from '@prisma/client'

// Dependency Inversion - controller depends on service abstraction
const tasksService = new TasksService()

interface CreateTaskBody {
  title: string
  description?: string
  category?: TaskCategory
  priority?: TaskPriority
  clientId: string
  isRecurring?: boolean
  dueDate?: string
}

interface CompleteTaskBody {
  notes?: string
}

/**
 * Single Responsibility: Handle HTTP requests/responses only
 * Business logic is in TasksService
 */

export async function listTasks(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const tasks = await tasksService.getTasks(request, request.query)

    return reply.status(200).send({
      success: true,
      data: tasks
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function createTask(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = request.body as CreateTaskBody

    const task = await tasksService.createTask(request, {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    })

    return reply.status(201).send({
      success: true,
      data: task
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function completeTask(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string }
    const { notes } = request.body as CompleteTaskBody
    const completion = await tasksService.completeTask(request, id, notes)

    return reply.status(201).send({
      success: true,
      data: completion,
      message: 'Task completed successfully'
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function getClientTasks(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string }
    const tasks = await tasksService.getTasks(request, { clientId: id })

    return reply.status(200).send({
      success: true,
      data: tasks
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}
