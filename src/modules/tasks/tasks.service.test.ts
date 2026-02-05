import { TaskCompletionStatus, TaskCategory, TaskPriority, UserRole } from '@prisma/client';
import { TasksService } from './tasks.service';
import { prisma } from '../../../tests/setup';
import { buildRequest, createClient, createOrganization, createUser } from '../../../tests/helpers';

describe('TasksService', () => {
  let tasksService: TasksService;
  let org1: any;
  let org2: any;
  let worker1: any;
  let request1: any;
  let client1: any;
  let client2: any;

  beforeEach(async () => {
    tasksService = new TasksService();

    org1 = await createOrganization({ name: 'Org One' });
    org2 = await createOrganization({ name: 'Org Two' });

    worker1 = await createUser({ organizationId: org1.id, role: UserRole.WORKER });
    request1 = buildRequest({ user: worker1, organization: org1 });
    request1.headers = { 'user-agent': 'jest-agent' };
    request1.ip = '127.0.0.1';

    client1 = await createClient({ organizationId: org1.id, firstName: 'Client', lastName: 'One' });
    client2 = await createClient({ organizationId: org2.id, firstName: 'Client', lastName: 'Two' });
  });

  describe('createTask', () => {
    it('should create a new task for a client in the same organization', async () => {
      const taskData = {
        title: 'Morning medication',
        description: 'Administer blood pressure medication',
        category: TaskCategory.MEDICATION,
        priority: TaskPriority.HIGH,
        clientId: client1.id,
      };

      const task = await tasksService.createTask(request1, taskData);

      expect(task).toBeDefined();
      expect(task.title).toBe('Morning medication');
      expect(task.category).toBe(TaskCategory.MEDICATION);
      expect(task.clientId).toBe(client1.id);
      expect(task.organizationId).toBe(org1.id);
    });

    it('should prevent creating a task for another organization', async () => {
      const taskData = {
        title: 'Cross-tenant task',
        clientId: client2.id,
      };

      await expect(tasksService.createTask(request1, taskData)).rejects.toThrow(
        'Client not found in your organization'
      );
    });
  });

  describe('getTasks', () => {
    it('should return only tasks for current organization', async () => {
      await prisma.task.create({
        data: {
          id: 'task-1',
          title: 'Org1 task',
          clientId: client1.id,
          organizationId: org1.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await prisma.task.create({
        data: {
          id: 'task-2',
          title: 'Org2 task',
          clientId: client2.id,
          organizationId: org2.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const tasks = await tasksService.getTasks(request1, {});

      expect(tasks).toHaveLength(1);
      expect(tasks[0].organizationId).toBe(org1.id);
    });
  });

  describe('getTask', () => {
    it('should not return tasks from another organization', async () => {
      const otherOrgTask = await prisma.task.create({
        data: {
          id: 'task-3',
          title: 'Other org task',
          clientId: client2.id,
          organizationId: org2.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(tasksService.getTask(request1, otherOrgTask.id)).rejects.toThrow('Task not found');
    });
  });

  describe('completeTask', () => {
    it('should prevent completing tasks from another organization', async () => {
      const otherOrgTask = await prisma.task.create({
        data: {
          id: 'task-4',
          title: 'Other org task',
          clientId: client2.id,
          organizationId: org2.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(tasksService.completeTask(request1, otherOrgTask.id)).rejects.toThrow(
        'Task not found'
      );
    });

    it('requires refusal reason for refused status and stores metadata', async () => {
      const medicationTask = await prisma.task.create({
        data: {
          id: 'task-med-refusal',
          title: 'Medication round',
          category: TaskCategory.MEDICATION,
          clientId: client1.id,
          organizationId: org1.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(
        tasksService.completeTask(request1, medicationTask.id, {
          status: TaskCompletionStatus.REFUSED,
        })
      ).rejects.toThrow('Reason for refusal is required for incomplete or refused tasks');

      const result = await tasksService.completeTask(request1, medicationTask.id, {
        status: TaskCompletionStatus.REFUSED,
        refusalReason: 'Resident Refused',
        initials: 'AB',
      });

      expect(result.completion.status).toBe(TaskCompletionStatus.REFUSED);
      expect(result.completion.refusalReason).toBe('Resident Refused');
      expect(result.completion.initials).toBe('AB');
      expect(result.completion.deviceInfo).toBe('jest-agent');
      expect(result.completion.ipAddress).toBe('127.0.0.1');
      expect(result.completion.criticalAlertFlagged).toBe(true);
      expect(result.criticalAlert).toContain('Critical alert');
    });
  });
});
