import bcrypt from 'bcrypt'
import { prisma } from '@/shared/database/prisma'
import { UserRole } from '@prisma/client'

interface RegisterUserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

export class AuthService {
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
   * Login user
   * @param email User email
   * @param password User password
   * @returns User if credentials are valid
   * @throws Error if credentials are invalid
   */
  async login(email: string, password: string) {
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

    // Return user without password
    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }
}