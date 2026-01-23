import { TasksService } from './tasks.service'
import { prisma } from '../../../tests/setup'
import { UserRole, TaskCategory, TaskPriority } from '@prisma/client'

describe('TasksService', () => {
  let tasksService: TasksService
  let testWorker: any
  let testClient: any

  beforeEach(async () => {
    tasksService = new TasksService()

    // Create test worker
    testWorker = await prisma.user.create({
      data: {
        email: 'worker@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Worker',
        role: UserRole.WORKER
      }
    })

    // Create test client
    testClient = await prisma.client.create({
      data: {
        firstName: 'Test',
        lastName: 'Client'
      }
    })

    // Assign client to worker
    await prisma.assignment.create({
      data: {
        userId: testWorker.id,
        clientId: testClient.id
      }
    })
  })

  describe('createTask', () => {
    it('should create a new task for client', async () => {
      const taskData = {
        title: 'Morning medication',
        description: 'Administer blood pressure medication',
        category: TaskCategory.MEDICATION,
        priority: TaskPriority.HIGH,
        clientId: testClient.id
      }

      const task = await tasksService.createTask(taskData)

      expect(task).toBeDefined()
      expect(task.title).toBe('Morning medication')
      expect(task.category).toBe(TaskCategory.MEDICATION)
      expect(task.clientId).toBe(testClient.id)
    })

    it('should create task with minimal data', async () => {
      const taskData = {
        title: 'Check vitals',
        clientId: testClient.id
      }

      const task = await tasksService.createTask(taskData)

      expect(task.title).toBe('Check vitals')
      expect(task.category).toBe(TaskCategory.GENERAL) // Default
      expect(task.priority).toBe(TaskPriority.NORMAL) // Default
    })
  })

  describe('getTasksForWorker', () => {
    it('should return tasks only for assigned clients', async () => {
      // Create tasks for assigned client
      const task1 = await prisma.task.create({
        data: {
          title: 'Task 1',
          clientId: testClient.id
        }
      })

      // Create another client NOT assigned to worker
      const otherClient = await prisma.client.create({
        data: { firstName: 'Other', lastName: 'Client' }
      })
      await prisma.task.create({
        data: {
          title: 'Task 2',
          clientId: otherClient.id
        }
      })

      const tasks = await tasksService.getTasksForWorker(testWorker.id)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe(task1.id)
    })

    it('should return only incomplete tasks by default', async () => {
      const task1 = await prisma.task.create({
        data: { title: 'Incomplete task', clientId: testClient.id }
      })
      const task2 = await prisma.task.create({
        data: { title: 'Complete task', clientId: testClient.id }
      })

      // Complete task2
      await prisma.taskCompletion.create({
        data: {
          taskId: task2.id,
          completedBy: testWorker.id
        }
      })

      const tasks = await tasksService.getTasksForWorker(testWorker.id)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe(task1.id)
    })
  })

  describe('completeTask', () => {
    it('should mark task as complete', async () => {
      const task = await prisma.task.create({
        data: { title: 'Test task', clientId: testClient.id }
      })

      const completion = await tasksService.completeTask(
        task.id,
        testWorker.id,
        'Completed successfully'
      )

      expect(completion).toBeDefined()
      expect(completion.taskId).toBe(task.id)
      expect(completion.completedBy).toBe(testWorker.id)
      expect(completion.notes).toBe('Completed successfully')
    })

    it('should allow completing same task multiple times (recurring)', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Daily medication',
          clientId: testClient.id,
          isRecurring: true
        }
      })

      // Complete once
      const completion1 = await tasksService.completeTask(task.id, testWorker.id)
      
      // Complete again
      const completion2 = await tasksService.completeTask(task.id, testWorker.id)

      expect(completion1.id).not.toBe(completion2.id)
      
      // Check both completions exist
      const completions = await prisma.taskCompletion.findMany({
        where: { taskId: task.id }
      })
      expect(completions).toHaveLength(2)
    })
  })

  describe('getTasksForClient', () => {
    it('should return all tasks for a client', async () => {
      await prisma.task.create({
        data: { title: 'Task 1', clientId: testClient.id }
      })
      await prisma.task.create({
        data: { title: 'Task 2', clientId: testClient.id }
      })

      const tasks = await tasksService.getTasksForClient(testClient.id)

      expect(tasks).toHaveLength(2)
    })

    it('should include completion status', async () => {
      const task = await prisma.task.create({
        data: { title: 'Test task', clientId: testClient.id }
      })

      await prisma.taskCompletion.create({
        data: {
          taskId: task.id,
          completedBy: testWorker.id
        }
      })

      const tasks = await tasksService.getTasksForClient(testClient.id)

      expect(tasks[0].completions).toHaveLength(1)
    })
  })
})