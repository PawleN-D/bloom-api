import { FastifyRequest, FastifyReply } from 'fastify'
import { TasksService } from './tasks.service'
import { TaskCategory, TaskPriority } from '@prisma/client'

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

export async function listTasks(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = (request as any).user
    const tasks = await tasksService.getTasksForWorker(user.userId)

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
  request: FastifyRequest<{ Body: CreateTaskBody }>,
  reply: FastifyReply
) {
  try {
    const data = request.body

    const task = await tasksService.createTask({
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
  request: FastifyRequest<{ 
    Params: { id: string }
    Body: CompleteTaskBody
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params
    const { notes } = request.body
    const user = (request as any).user

    const completion = await tasksService.completeTask(id, user.userId, notes)

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
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params
    const tasks = await tasksService.getTasksForClient(id)

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