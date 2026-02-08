import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../shared/database/prisma'

const authService = new AuthService()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN']),
  organizationId: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const setupSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
  pin: z.string().regex(/^\d{4}$/),
})

const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
})

const normalizeTenantHeader = (value: string | string[] | undefined) => {
  if (!value) return null
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw || '').trim().toLowerCase()
  return normalized || null
}

export async function register(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { email, password, firstName, lastName, role, organizationId } = parsed.data

    const user = await authService.registerUser({
      email,
      password,
      firstName,
      lastName,
      role: role as UserRole,
      organizationId,
    })

    // Don't return password
    const { passwordHash: _, pinHash: __, invitationToken: ___, tokenExpires: ____, ...userWithoutPassword } = user

    return reply.status(201).send({
      success: true,
      data: userWithoutPassword
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Email already exists') {
      return reply.status(409).send({
        success: false,
        error: 'Email already exists'
      })
    }

    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function login(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { email, password } = parsed.data

    const result = await authService.login(email, password)
    const tenantHeader = normalizeTenantHeader(request.headers['x-tenant'])
    const requiresTenant =
      Boolean(result.user.organizationId) && result.user.role !== 'SUPER_ADMIN'

    if (requiresTenant && !tenantHeader) {
      return reply.status(400).send({
        success: false,
        error: 'Tenant header required',
      })
    }

    if (tenantHeader && result.user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { subdomain: tenantHeader },
        select: { id: true },
      })

      if (!org || org.id !== result.user.organizationId) {
        return reply.status(403).send({
          success: false,
          error: 'Tenant mismatch',
        })
      }
    }

    return reply.status(200).send({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Invalid credentials' ||
        error.message === 'Account is inactive' ||
        error.message === 'Account setup required'
      ) {
        return reply.status(401).send({
          success: false,
          error: error.message
        })
      }
    }

    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function getMe(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // We'll get user from request.user (set by auth middleware)
    const user = request.user

    return reply.status(200).send({
      success: true,
      data: user
    })
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function setupAccount(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const parsed = setupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const { token, password, pin } = parsed.data
    const tenantHeader = normalizeTenantHeader(request.headers['x-tenant'])
    const invited = await prisma.user.findFirst({
      where: { invitationToken: token },
      select: { organizationId: true },
    })

    if (invited?.organizationId && !tenantHeader) {
      return reply.status(400).send({
        success: false,
        error: 'Tenant header required',
      })
    }

    if (tenantHeader && invited?.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { subdomain: tenantHeader },
        select: { id: true },
      })

      if (!org || org.id !== invited.organizationId) {
        return reply.status(403).send({
          success: false,
          error: 'Tenant mismatch',
        })
      }
    }
    const result = await authService.setupAccount(token, password, pin)

    return reply.status(200).send({
      success: true,
      data: result,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Invalid or expired invitation token' ||
        error.message === 'Account already active'
      ) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        })
      }
    }

    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}

export async function verifyPin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const parsed = verifyPinSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten(),
      })
    }

    const user = request.user
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      })
    }

    const { pin } = parsed.data
    const result = await authService.verifyPin(user.id, pin)

    return reply.status(200).send({
      success: true,
      data: result,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Invalid PIN' ||
        error.message === 'PIN not set' ||
        error.message === 'User not found or inactive'
      ) {
        return reply.status(401).send({
          success: false,
          error: error.message,
        })
      }
    }

    request.log.error(error)
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    })
  }
}
