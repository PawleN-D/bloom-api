import { FastifyRequest, FastifyReply } from 'fastify';
import { Organization, UserRole } from '@prisma/client';
import { prisma } from '../database/prisma';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: UserRole;
      organizationId?: string | null;
    };
    organization?: Organization;
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
  const user = request.user;
  
  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Skip for super admin
  if (user?.role === 'SUPER_ADMIN') {
    const orgId = request.headers['x-organization-id'];
    if (!orgId || Array.isArray(orgId)) {
      return reply.status(400).send({
        error: 'Organization Required',
        message: 'Provide x-organization-id header for tenant-scoped endpoints',
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org || !org.active || org.suspended) {
      return reply.status(403).send({
        error: 'Organization Inactive',
        message: 'Organization is inactive or suspended',
      });
    }

    request.organization = org;
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
  
  request.organization = org;
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
