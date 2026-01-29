import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { ClientsService } from './clients.service';

export async function clientsRoutes(server: FastifyInstance) {
  const clientsService = new ClientsService();
  
  // GET /api/clients
  server.get('/api/clients', {
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
  server.get('/api/clients/:id', {
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
  server.post('/api/clients', {
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
  server.put('/api/clients/:id', {
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
  server.delete('/api/clients/:id', {
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
}