import { FastifyInstance } from '@/shared/http/compat';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { ClientsService } from './clients.service';
import { NotesService } from '../notes/notes.service';
import { TasksService } from '../tasks/tasks.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function clientsRoutes(server: FastifyInstance) {
  const clientsService = new ClientsService();
  const tasksService = new TasksService();
  const notesService = new NotesService();

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  const listQuerySchema = z.object({
    search: z.string().min(1).optional(),
    active: z.enum(['true', 'false']).optional(),
  }).passthrough();

  const dateSchema = z.union([
    z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'Invalid date',
    }),
    z.null(),
  ]);

  const createClientSchema = z.object({
    id: z.string().min(1).optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: dateSchema.optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    conditions: z.string().optional(),
    allergies: z.string().optional(),
    carePlan: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelation: z.string().optional(),
  }).strict();

  const updateClientSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    dateOfBirth: dateSchema.optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    conditions: z.string().optional(),
    allergies: z.string().optional(),
    carePlan: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelation: z.string().optional(),
    isActive: z.boolean().optional(),
  }).strict();
  
  server.get('/', {
    schema: {
      tags: ['Clients'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_CLIENT)
    ]
  }, async (request, reply) => {
    try {
      const query = validateZod(listQuerySchema, request.query, reply);
      if (!query) return;
      const clients = await clientsService.getClients(request, query);
      return reply.send({ data: clients });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  server.get('/:id', {
    schema: {
      tags: ['Clients'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_CLIENT)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const client = await clientsService.getClient(request, params.id);
      return reply.send({ data: client });
    } catch (error: any) {
      const status = error.message === 'Client not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  server.post('/', {
    schema: {
      tags: ['Clients'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_CLIENT)
    ]
  }, async (request, reply) => {
    try {
      const body = validateZod(createClientSchema, request.body, reply);
      if (!body) return;
      const client = await clientsService.createClient(request, body);
      return reply.status(201).send({ data: client });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  server.put('/:id', {
    schema: {
      tags: ['Clients'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_CLIENT)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(updateClientSchema, request.body, reply);
      if (!body) return;
      const client = await clientsService.updateClient(request, params.id, body);
      return reply.send({ data: client });
    } catch (error: any) {
      const status = error.message === 'Client not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  server.delete('/:id', {
    schema: {
      tags: ['Clients'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_CLIENT)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await clientsService.deleteClient(request, params.id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Client not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  server.get('/:id/tasks', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const tasks = await tasksService.getTasks(request, { clientId: params.id });
      return reply.send({ data: tasks });
    } catch (error: any) {
      const status = error.message === 'Task not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  server.get('/:id/notes', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const notes = await notesService.getNotes(request, { clientId: params.id });
      return reply.send({ data: notes });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}
