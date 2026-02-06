import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

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
