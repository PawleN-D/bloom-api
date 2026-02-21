import bcrypt from 'bcrypt'

import { UserRole, UserStatus } from '@prisma/client'
import { JWTService } from './jwt.service'
import { prisma } from '../../shared/database/prisma'

interface RegisterUserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  organizationId?: string | null
}

const ALLOWED_SELF_REGISTRATION_ROLES: UserRole[] = [UserRole.WORKER]

interface LoginResponse {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    organizationId?: string | null
    isActive: boolean
    status: UserStatus
    createdAt: Date
    updatedAt: Date
  }
  token: string
}

export class AuthService {
  private jwtService: JWTService

  constructor() {
    this.jwtService = new JWTService()
  }

  async registerUser(data: RegisterUserInput) {
    if (!ALLOWED_SELF_REGISTRATION_ROLES.includes(data.role)) {
      throw new Error('This role requires an invitation')
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      throw new Error('Email already exists')
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    if (!data.organizationId) {
      throw new Error('Organization required')
    }

    if (data.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: data.organizationId },
      })
      if (!org || !org.active || org.suspended) {
        throw new Error('Organization not found or inactive')
      }
    }

    const userId = require('crypto').randomBytes(16).toString('hex')

    const user = await prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        passwordHash: hashedPassword,
        pinHash: null,
        invitationToken: null,
        tokenExpires: null,
        status: UserStatus.ACTIVE,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        organizationId: data.organizationId || null,
        isActive: true,
      }
    })

    return user
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword)
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      throw new Error('Invalid credentials')
    }

    if (!user.isActive) {
      throw new Error('Account is inactive')
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Account setup required')
    }

    if (!user.passwordHash) {
      throw new Error('Account setup required')
    }

    const isPasswordValid = await this.verifyPassword(password, user.passwordHash)

    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    const token = this.jwtService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      globalAdmin: user.role === UserRole.SUPER_ADMIN,
    })

    const { passwordHash: _, pinHash: __, invitationToken: ___, tokenExpires: ____, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      token
    }
  }

  async verifyToken(token: string) {
    const decoded = this.jwtService.verifyToken(token)
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive')
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('User not found or inactive')
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: user.organizationId,
      globalAdmin: decoded.globalAdmin ?? user.role === UserRole.SUPER_ADMIN,
    }
  }

  async setupAccount(token: string, password: string, pin: string) {
    const now = new Date()
    const user = await prisma.user.findFirst({
      where: {
        invitationToken: token,
      },
    })

    if (!user || !user.tokenExpires || user.tokenExpires < now) {
      throw new Error('Invalid or expired invitation token')
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new Error('Account already active')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const pinHash = await bcrypt.hash(pin, 10)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        pinHash,
        invitationToken: null,
        tokenExpires: null,
        status: UserStatus.ACTIVE,
        isActive: true,
        updatedAt: now,
      },
    })

    const accessToken = this.jwtService.generateToken({
      userId: updated.id,
      email: updated.email,
      role: updated.role,
      organizationId: updated.organizationId,
      globalAdmin: updated.role === UserRole.SUPER_ADMIN,
    })

    const { passwordHash: _, pinHash: __, invitationToken: ___, tokenExpires: ____, ...userWithoutSecrets } =
      updated

    return {
      user: userWithoutSecrets,
      token: accessToken,
    }
  }

  async verifyPin(userId: string, pin: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.isActive || user.status !== UserStatus.ACTIVE) {
      throw new Error('User not found or inactive')
    }

    if (!user.pinHash) {
      throw new Error('PIN not set')
    }

    const isValid = await bcrypt.compare(pin, user.pinHash)
    if (!isValid) {
      throw new Error('Invalid PIN')
    }

    const token = this.jwtService.generateSessionUnlockToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      globalAdmin: user.role === UserRole.SUPER_ADMIN,
    })

    return { token }
  }
}
