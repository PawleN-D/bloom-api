import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { NotesService } from './notes.service';

export async function notesRoutes(server: FastifyInstance) {
  const notesService = new NotesService();
  
  // GET /api/notes
  server.get('/api/notes', {
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
  
  // GET /api/notes/:id
  server.get('/api/notes/:id', {
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
  
  // POST /api/notes
  server.post('/api/notes', {
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
  
  // PUT /api/notes/:id
  server.put('/api/notes/:id', {
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
  
  // DELETE /api/notes/:id
  server.delete('/api/notes/:id', {
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