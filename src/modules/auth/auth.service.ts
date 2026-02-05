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

  /**
   * Register a new user
   * @param data User registration data
   * @returns Created user (without password)
   * @throws Error if email already exists
   */
  async registerUser(data: RegisterUserInput) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      throw new Error('Email already exists')
    }

    // Hash password with bcrypt (10 rounds = ~100ms)
    const hashedPassword = await bcrypt.hash(data.password, 10)

    if (data.role !== 'SUPER_ADMIN' && !data.organizationId) {
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

    // Create user
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

  /**
   * Verify user password
   * @param plainPassword Plain text password
   * @param hashedPassword Hashed password from database
   * @returns True if password matches
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword)
  }

  /**
   * Login user and generate JWT token
   * @param email User email
   * @param password User password
   * @returns User object and JWT token
   * @throws Error if credentials are invalid or user is inactive
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is inactive')
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Account setup required')
    }

    if (!user.passwordHash) {
      throw new Error('Account setup required')
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash)

    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    // Generate JWT token
    const token = this.jwtService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      globalAdmin: user.role === UserRole.SUPER_ADMIN,
    })

    // Return user without password
    const { passwordHash: _, pinHash: __, invitationToken: ___, tokenExpires: ____, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      token
    }
  }

  /**
   * Verify JWT token and get user
   * @param token JWT token string
   * @returns User information from token
   * @throws Error if token is invalid
   */
  async verifyToken(token: string) {
    const decoded = this.jwtService.verifyToken(token)
    
    // Optionally: Verify user still exists and is active
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

  /**
   * Complete invitation setup with password + PIN
   */
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

  /**
   * Verify PIN and issue session-unlock token
   */
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
