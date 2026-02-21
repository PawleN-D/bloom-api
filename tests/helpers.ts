import { randomBytes } from 'crypto'
import { prisma } from './setup'
import { Organization, SubscriptionPlan, UserRole, UserStatus } from '@prisma/client'

export async function createOrganization(overrides: Partial<Organization> = {}) {
  const id = overrides.id || randomBytes(16).toString('hex')
  const name = overrides.name || 'Test Organization'
  const slug = overrides.slug || `org-${id.slice(0, 8)}`

  return prisma.organization.create({
    data: {
      id,
      name,
      slug,
      subdomain: overrides.subdomain || slug,
      logo: overrides.logo || null,
      primaryColor: overrides.primaryColor || '#0F766E',
      plan: overrides.plan || SubscriptionPlan.STARTER,
      billingEmail: overrides.billingEmail || null,
      maxUsers: overrides.maxUsers || 10,
      maxClients: overrides.maxClients || 50,
      active: overrides.active ?? true,
      suspended: overrides.suspended ?? false,
      trialEndsAt: overrides.trialEndsAt || null,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
    },
  })
}

export async function createUser(params: {
  organizationId?: string | null
  role?: UserRole
  email?: string
  firstName?: string
  lastName?: string
  isActive?: boolean
}) {
  const id = randomBytes(16).toString('hex')
  const email = params.email || `${id}@test.com`

  return prisma.user.create({
    data: {
      id,
      email,
      passwordHash: 'hashedpassword',
      pinHash: 'hashedpin',
      status: UserStatus.ACTIVE,
      invitationToken: null,
      tokenExpires: null,
      firstName: params.firstName || 'Test',
      lastName: params.lastName || 'User',
      role: params.role || UserRole.WORKER,
      organizationId: params.organizationId ?? null,
      isActive: params.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

export async function createClient(params: {
  organizationId: string
  firstName?: string
  lastName?: string
  isActive?: boolean
}) {
  const id = randomBytes(16).toString('hex')

  return prisma.client.create({
    data: {
      id,
      organizationId: params.organizationId,
      firstName: params.firstName || 'Test',
      lastName: params.lastName || 'Client',
      isActive: params.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

export function buildRequest(params: { user: any; organization: any }) {
  return {
    user: params.user,
    organization: params.organization,
    headers: {},
    ip: '127.0.0.1',
    id: `req_${randomBytes(8).toString('hex')}`,
  } as any
}
