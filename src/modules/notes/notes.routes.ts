import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { NotesService } from './notes.service';

export async function notesRoutes(server: FastifyInstance) {
  const notesService = new NotesService();

  server.get('/', {
    schema: {
      tags: ['Notes'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const notes = await notesService.getNotes(request, request.query);
      return reply.send({ data: notes });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/handover/significant', {
    schema: {
      tags: ['Notes'],
      querystring: {
        type: 'object',
        properties: {
          hours: { type: 'number', default: 12 },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_NOTE)
    ]
  }, async (request: any, reply) => {
    try {
      const handover = await notesService.getSignificantHandover(request, request.query?.hours || 12);
      return reply.send({ data: handover });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.get('/:id', {
    schema: {
      tags: ['Notes'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const note = await notesService.getNote(request, id);
      return reply.send({ data: note });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  server.post('/', {
    schema: {
      tags: ['Notes'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const note = await notesService.createNote(request, request.body);
      return reply.status(201).send({ data: note });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  server.put('/:id', {
    schema: {
      tags: ['Notes'],
      body: {
        type: 'object',
        required: ['content', 'editReason'],
        properties: {
          content: { type: 'string' },
          editReason: { type: 'string' },
          category: { type: 'string' },
          isSignificant: { type: 'boolean' },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const note = await notesService.updateNote(request, id, request.body);
      return reply.send({ data: note });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  server.delete('/:id', {
    schema: {
      tags: ['Notes'],
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await notesService.deleteNote(request, id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}
