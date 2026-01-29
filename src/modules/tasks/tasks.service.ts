import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';

export class TasksService {
  
  /**
   * Get all tasks for current organization
   */
  async getTasks(request: FastifyRequest, filters?: any) {
    const { clientId, search } = filters || {};
    
    // Build where clause with tenant isolation
    const where = withTenantIsolation(request, {
      clientId: clientId || undefined,
    });
    
    // Add search filter
    if (search) {
      (where as any).OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        taskCompletions: {
          take: 5,
          orderBy: {
            completedAt: 'desc',
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });
    
    return tasks;
  }
  
  /**
   * Get single task
   */
  async getTask(request: FastifyRequest, id: string) {
    const task = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        taskCompletions: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
        },
      },
    });
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    return task;
  }
  
  /**
   * Create task
   */
  async createTask(request: FastifyRequest, data: any) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization required');
    }
    
    // Verify client belongs to organization
    const client = await prisma.client.findUnique({
      where: withTenantIsolation(request, { id: data.clientId }),
    });
    
    if (!client) {
      throw new Error('Client not found in your organization');
    }
    
    // Generate ID
    const taskId = require('crypto').randomBytes(16).toString('hex');
    
    const task = await prisma.task.create({
      data: {
        id: taskId,
        title: data.title,
        description: data.description || null,
        category: data.category || 'GENERAL',
        priority: data.priority || 'NORMAL',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isRecurring: data.isRecurring || false,
        clientId: data.clientId,
        organizationId: org.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    return task;
  }
  
  /**
   * Update task
   */
  async updateTask(request: FastifyRequest, id: string, data: any) {
    // Verify task belongs to organization
    const existing = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Task not found');
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    return task;
  }
  
  /**
   * Delete task
   */
  async deleteTask(request: FastifyRequest, id: string) {
    // Verify task belongs to organization
    const existing = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('Task not found');
    }
    
    await prisma.task.delete({
      where: { id },
    });
    
    return { message: 'Task deleted successfully' };
  }
  
  /**
   * Complete task
   */
  async completeTask(request: FastifyRequest, id: string, notes?: string) {
    const user = request.user;
    if (!user) {
      throw new Error('User required');
    }

    const task = await prisma.task.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    // Generate completion ID
    const completionId = require('crypto').randomBytes(16).toString('hex');
    
    // Create completion record
    const completion = await prisma.taskCompletion.create({
      data: {
        id: completionId,
        taskId: id,
        completedBy: user.id,
        completedAt: new Date(),
        notes: notes || null,
        createdAt: new Date(),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    return { 
      message: 'Task completed successfully',
      completion,
    };
  }
}
