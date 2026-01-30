import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { ClientsService } from './clients.service';
import { NotesService } from '../notes/notes.service';
import { TasksService } from '../tasks/tasks.service';

export async function clientsRoutes(server: FastifyInstance) {
  const clientsService = new ClientsService();
  const tasksService = new TasksService();
  const notesService = new NotesService();
  
  // GET /api/clients
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
      const clients = await clientsService.getClients(request, request.query);
      return reply.send({ data: clients });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/clients/:id
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
      const { id } = request.params as any;
      const client = await clientsService.getClient(request, id);
      return reply.send({ data: client });
    } catch (error: any) {
      const status = error.message === 'Client not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/clients
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
      const client = await clientsService.createClient(request, request.body);
      return reply.status(201).send({ data: client });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // PUT /api/clients/:id
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
      const { id } = request.params as any;
      const client = await clientsService.updateClient(request, id, request.body);
      return reply.send({ data: client });
    } catch (error: any) {
      const status = error.message === 'Client not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // DELETE /api/clients/:id
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
      const { id } = request.params as any;
      const result = await clientsService.deleteClient(request, id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Client not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  // GET /api/clients/:id/tasks
  server.get('/:id/tasks', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_TASK)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const tasks = await tasksService.getTasks(request, { clientId: id });
      return reply.send({ data: tasks });
    } catch (error: any) {
      const status = error.message === 'Task not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  // GET /api/clients/:id/notes
  server.get('/:id/notes', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const notes = await notesService.getNotes(request, { clientId: id });
      return reply.send({ data: notes });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}
