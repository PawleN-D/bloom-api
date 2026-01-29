import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { UsersService } from './users.service';

export async function usersRoutes(server: FastifyInstance) {
  const usersService = new UsersService();
  
  // GET /api/users - List all users in organization
  server.get('/api/users', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_USER)
    ]
  }, async (request, reply) => {
    try {
      const users = await usersService.getUsers(request, request.query);
      return reply.send({ data: users });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // GET /api/users/:id - Get single user
  server.get('/api/users/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_USER)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await usersService.getUser(request, id);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message === 'User not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/users - Create new user (invite)
  server.post('/api/users', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_USER)
    ]
  }, async (request, reply) => {
    try {
      const user = await usersService.createUser(request, request.body);
      return reply.status(201).send({ data: user });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  // PUT /api/users/:id - Update user
  server.put('/api/users/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_USER)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await usersService.updateUser(request, id, request.body);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('permission') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // PUT /api/users/:id/role - Change user role (ORG_OWNER only)
  server.put('/api/users/:id/role', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.MANAGE_ROLES)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { role } = request.body as any;
      const user = await usersService.changeUserRole(request, id, role);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('permission') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // DELETE /api/users/:id - Deactivate user (soft delete)
  server.delete('/api/users/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_USER)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await usersService.deactivateUser(request, id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('cannot') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  // POST /api/users/:id/reactivate - Reactivate user
  server.post('/api/users/:id/reactivate', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_USER)
    ]
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await usersService.reactivateUser(request, id);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message === 'User not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}