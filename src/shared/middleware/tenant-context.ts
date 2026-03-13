import { FastifyRequest, FastifyReply } from '@/shared/http/compat';
import { prisma } from '../database/prisma';
import { setDatabaseRequestContext } from '../database/request-context';



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

  if (user?.role === 'SUPER_ADMIN') {
    const orgId = request.headers['x-organization-id'];
    if (!orgId || Array.isArray(orgId)) {
      setDatabaseRequestContext({
        tenantId: null,
        userId: user.id,
        bypassRls: true,
      });
      return;
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

    if (org.subscriptionStatus === 'SUSPENDED') {
      return reply.status(402).send({
        error: 'Payment Required',
        message: 'Organization subscription is suspended',
      });
    }

    request.organization = org;
    setDatabaseRequestContext({
      tenantId: org.id,
      userId: user.id,
      bypassRls: false,
    });
    return;
  }
  
  if (!user?.organizationId) {
    return reply.status(403).send({
      error: 'No Organization',
      message: 'User does not belong to an organization',
    });
  }
  
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  
  if (!org || !org.active || org.suspended) {
    return reply.status(403).send({
      error: 'Organization Inactive',
      message: 'Organization is inactive or suspended',
    });
  }

  if (org.subscriptionStatus === 'SUSPENDED') {
    return reply.status(402).send({
      error: 'Payment Required',
      message: 'Organization subscription is suspended',
    });
  }
  
  request.organization = org;
  setDatabaseRequestContext({
    tenantId: org.id,
    userId: user.id,
    bypassRls: false,
  });
}

export function withTenantIsolation<T extends Record<string, any>>(
  request: FastifyRequest,
  where: T = {} as T
): T {
  if (!request.organization) {
    if (request.user?.role === 'SUPER_ADMIN') {
      return {
        ...where,
      } as T;
    }
    throw new Error('Organization context required');
  }
  
  return {
    ...where,
    organizationId: request.organization.id,
  } as T;
}
