import bcrypt from 'bcrypt'

import { UserRole } from '@prisma/client'
import { JWTService } from './jwt.service'
import { prisma } from '../../shared/database/prisma'

interface RegisterUserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

interface LoginResponse {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    isActive: boolean
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

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
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

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password)

    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    // Generate JWT token
    const token = this.jwtService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Return user without password
    const { password: _, ...userWithoutPassword } = user

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

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    }
  }
}