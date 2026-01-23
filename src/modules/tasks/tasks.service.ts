import { prisma } from '../../shared/database/prisma'
import { TaskCategory, TaskPriority } from '@prisma/client'

interface CreateTaskInput {
  title: string
  description?: string
  category?: TaskCategory
  priority?: TaskPriority
  clientId: string
  isRecurring?: boolean
  dueDate?: Date
}


export class TasksService {
  async createTask(data: CreateTaskInput) {
    return await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category || TaskCategory.GENERAL,
        priority: data.priority || TaskPriority.NORMAL,
        clientId: data.clientId,
        isRecurring: data.isRecurring || false,
        dueDate: data.dueDate
      }
    })
  }

  async getTasksForWorker(workerId: string) {
    return await prisma.task.findMany({
      where: {
        client: {
          isActive: true,
          assignments: {
            some: {
              userId: workerId,
              isActive: true
            }
          }
        },
        // Only show tasks that haven't been completed (for non-recurring)
        // OR recurring tasks (always show)
        OR: [
          { isRecurring: true },
          {
            isRecurring: false,
            completions: {
              none: {}
            }
          }
        ]
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        completions: {
          orderBy: {
            completedAt: 'desc'
          },
          take: 1 
        }
      },
      orderBy: [
        { priority: 'desc' }, 
        { dueDate: 'asc' }   
      ]
    })
  }

  async completeTask(taskId: string, userId: string, notes?: string) {
    return await prisma.taskCompletion.create({
      data: {
        taskId,
        completedBy: userId,
        notes
      }
    })
  }

  async getTasksForClient(clientId: string) {
    return await prisma.task.findMany({
      where: {
        clientId
      },
      include: {
        completions: {
          orderBy: {
            completedAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }


  async getTaskById(taskId: string) {
    return await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        client: true,
        completions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            completedAt: 'desc'
          }
        }
      }
    })
  }
}