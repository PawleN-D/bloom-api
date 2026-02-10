import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { tenantContext } from '../../shared/middleware/tenant-context';
import { authorize, Permission } from '../../shared/middleware/authorize';
import { UsersService } from './users.service';
import { z } from 'zod';
import { validateZod } from '../../shared/validation/zod';

export async function usersRoutes(server: FastifyInstance) {
  const usersService = new UsersService();

  const idParamSchema = z.object({
    id: z.string().min(1),
  });

  const listQuerySchema = z.object({
    search: z.string().min(1).optional(),
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN']).optional(),
    active: z.enum(['true', 'false']).optional(),
  }).passthrough();

  const createUserSchema = z.object({
    email: z.string().email(),
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN']).optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  }).strict();

  const updateUserSchema = z.object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  }).strict();

  const updateRoleSchema = z.object({
    role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN']),
  }).strict();
  
  server.get('/', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_USER)
    ]
  }, async (request, reply) => {
    try {
      const query = validateZod(listQuerySchema, request.query, reply);
      if (!query) return;
      const users = await usersService.getUsers(request, query);
      return reply.send({ data: users });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  server.get('/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.READ_USER)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const user = await usersService.getUser(request, params.id);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message === 'User not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  server.post('/', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.CREATE_USER)
    ]
  }, async (request, reply) => {
    try {
      const body = validateZod(createUserSchema, request.body, reply);
      if (!body) return;
      const user = await usersService.createUser(request, body);
      return reply.status(201).send({ data: user });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
  
  server.put('/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_USER)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(updateUserSchema, request.body, reply);
      if (!body) return;
      const user = await usersService.updateUser(request, params.id, body);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('permission') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  server.put('/:id/role', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.MANAGE_ROLES)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const body = validateZod(updateRoleSchema, request.body, reply);
      if (!body) return;
      const user = await usersService.changeUserRole(request, params.id, body.role);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('permission') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  server.delete('/:id', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.DELETE_USER)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const result = await usersService.deactivateUser(request, params.id);
      return reply.send(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 
                     error.message.includes('cannot') ? 403 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
  
  server.post('/:id/reactivate', {
    preHandler: [
      authMiddleware,
      tenantContext,
      authorize(Permission.UPDATE_USER)
    ]
  }, async (request, reply) => {
    try {
      const params = validateZod(idParamSchema, request.params, reply);
      if (!params) return;
      const user = await usersService.reactivateUser(request, params.id);
      return reply.send({ data: user });
    } catch (error: any) {
      const status = error.message === 'User not found' ? 404 : 500;
      return reply.status(status).send({ error: error.message });
    }
  });
}
