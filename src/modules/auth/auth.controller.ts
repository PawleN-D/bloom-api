import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { UserRole } from '@prisma/client'

const authService = new AuthService()

interface RegisterBody {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  organizationId?: string
}

interface LoginBody {
  email: string
  password: string
}

export async function register(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply
) {
  try {
    const { email, password, firstName, lastName, role, organizationId } = request.body

    const user = await authService.registerUser({
      email,
      password,
      firstName,
      lastName,
      role,
      organizationId,
    })

    // Don't return password
    const { password: _, ...userWithoutPassword } = user

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
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
) {
  try {
    const { email, password } = request.body

    const result = await authService.login(email, password)

    return reply.status(200).send({
      success: true,
      data: result
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials' || error.message === 'Account is inactive') {
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
