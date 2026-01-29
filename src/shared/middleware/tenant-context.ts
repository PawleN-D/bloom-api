import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';

declare module 'fastify' {
  interface FastifyRequest {
    organization?: {
      id: string;
      name: string;
      slug: string;
      plan: string;
      features: Record<string, boolean>;
      settings: Record<string, any>;
    };
  }
}

/**
 * Tenant Context Middleware
 * Loads organization from authenticated user
 */
export async function tenantContext(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user;
  
  // Skip for super admin
  if (user?.role === 'SUPER_ADMIN') {
    return;
  }
  
  if (!user?.organizationId) {
    return reply.status(403).send({
      error: 'No Organization',
      message: 'User does not belong to an organization',
    });
  }
  
  // Load organization
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  
  if (!org || !org.active || org.suspended) {
    return reply.status(403).send({
      error: 'Organization Inactive',
      message: 'Organization is inactive or suspended',
    });
  }
  
  request.organization = org as any;
}

/**
 * Data isolation helper
 */
export function withTenantIsolation<T extends Record<string, any>>(
  request: FastifyRequest,
  where: T = {} as T
): T {
  if (!request.organization) {
    throw new Error('Organization context required');
  }
  
  return {
    ...where,
    organizationId: request.organization.id,
  } as T;
}