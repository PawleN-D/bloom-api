import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { NotesService } from './notes.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function notesRoutes(server: FastifyInstance) {
  const notesService = new NotesService();

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  const listQuerySchema = z.object({
    clientId: z.string().min(1).optional(),
    authorId: z.string().min(1).optional(),
    search: z.string().min(1).optional(),
    includeArchived: z.preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean().optional()),
    significantOnly: z.preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean().optional()),
  }).passthrough();

  const handoverQuerySchema = z.object({
    hours: z.coerce.number().int().positive().max(168).optional(),
  }).passthrough();

  const createNoteSchema = z.object({
    content: z.string().min(1),
    category: z.enum(['PROGRESS', 'OBSERVATION', 'INCIDENT', 'COMMUNICATION', 'GENERAL']).optional(),
    clientId: z.string().min(1),
    editReason: z.string().min(1).optional(),
    isSignificant: z.boolean().optional(),
  }).strict();

  const updateNoteSchema = z.object({
    content: z.string().min(1),
    editReason: z.string().min(1),
    category: z.enum(['PROGRESS', 'OBSERVATION', 'INCIDENT', 'COMMUNICATION', 'GENERAL']).optional(),
    isSignificant: z.boolean().optional(),
  }).strict();

  const deleteNoteSchema = z.object({
    reason: z.string().min(1).optional(),
  }).strict();

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
      const query = validateZod(listQuerySchema, request.query, reply);
      if (!query) return;
      const notes = await notesService.getNotes(request, query);
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
      const query = validateZod(handoverQuerySchema, request.query, reply);
      if (!query) return;
      const handover = await notesService.getSignificantHandover(request, query.hours || 12);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const note = await notesService.getNote(request, params.id);
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
      const body = validateZod(createNoteSchema, request.body, reply);
      if (!body) return;
      const note = await notesService.createNote(request, body);
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
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(updateNoteSchema, request.body, reply);
      if (!body) return;
      const note = await notesService.updateNote(request, params.id, body);
      return reply.send({ data: note });
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });

  server.delete('/:id', {
    schema: {
      tags: ['Notes'],
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
        },
      },
    },
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_NOTE)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(deleteNoteSchema, request.body ?? {}, reply);
      if (!body) return;
      const result = await notesService.deleteNote(request, params.id, body.reason);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message === 'Note not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}
