// src/modules/auth/auth.service.test.ts
import { AuthService } from './auth.service'
import { prisma } from '../../../tests/setup'
import { UserRole } from '@prisma/client'

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
  })

  describe('registerUser', () => {
    it('should create a new user with hashed password', async () => {
      // Arrange
      const userData = {
        email: 'worker@test.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.WORKER
      }

      // Act
      const user = await authService.registerUser(userData)

      // Assert
      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.email).toBe(userData.email)
      expect(user.firstName).toBe(userData.firstName)
      expect(user.lastName).toBe(userData.lastName)
      expect(user.role).toBe(UserRole.WORKER)
      expect(user.password).not.toBe(userData.password) // Should be hashed
      expect(user.password).toMatch(/^\$2[aby]\$/) // bcrypt hash pattern
      expect(user.isActive).toBe(true)
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should not allow duplicate emails', async () => {
      // Arrange
      const userData = {
        email: 'duplicate@test.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.WORKER
      }

      // Create first user
      await authService.registerUser(userData)

      // Act & Assert
      await expect(
        authService.registerUser(userData)
      ).rejects.toThrow('Email already exists')
    })

    it('should create users with different roles', async () => {
      // Arrange
      const workerData = {
        email: 'unique-worker@test.com',
        password: 'SecurePass123!',
        firstName: 'Worker',
        lastName: 'One',
        role: UserRole.WORKER
      }

      const adminData = {
        email: 'unique-admin@test.com',
        password: 'SecurePass123!',
        firstName: 'Admin',
        lastName: 'One',
        role: UserRole.ADMIN
      }

      // Act
      const worker = await authService.registerUser(workerData)
      const admin = await authService.registerUser(adminData)

      // Assert
      expect(worker.role).toBe(UserRole.WORKER)
      expect(admin.role).toBe(UserRole.ADMIN)
    })

    it('should hash different passwords differently', async () => {
      // Arrange
      const user1Data = {
        email: 'user1@test.com',
        password: 'Password1!',
        firstName: 'User',
        lastName: 'One',
        role: UserRole.WORKER
      }

      const user2Data = {
        email: 'user2@test.com',
        password: 'Password2!',
        firstName: 'User',
        lastName: 'Two',
        role: UserRole.WORKER
      }

      // Act
      const user1 = await authService.registerUser(user1Data)
      const user2 = await authService.registerUser(user2Data)

      // Assert
      expect(user1.password).not.toBe(user2.password)
    })
  })

  describe('login', () => {
    it('should login user with valid credentials and return token', async () => {
      // Arrange - Create a user first
      const userData = {
        email: 'login@test.com',
        password: 'SecurePass123!',
        firstName: 'Login',
        lastName: 'User',
        role: UserRole.WORKER
      }
      await authService.registerUser(userData)

      // Act - Try to login
      const result = await authService.login(userData.email, userData.password)

      // Assert
      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.user.email).toBe(userData.email)
      expect(result.user).not.toHaveProperty('password') // Password should be excluded
      expect(typeof result.token).toBe('string')
      expect(result.token.split('.')).toHaveLength(3) // JWT format
    })

    it('should reject invalid password', async () => {
      // Arrange
      const userData = {
        email: 'test@test.com',
        password: 'CorrectPassword',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.WORKER
      }
      await authService.registerUser(userData)

      // Act & Assert
      await expect(
        authService.login(userData.email, 'WrongPassword')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      // Act & Assert
      await expect(
        authService.login('nonexistent@test.com', 'password')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should reject inactive user', async () => {
      // Arrange - Create user then deactivate
      const userData = {
        email: 'inactive@test.com',
        password: 'Password123!',
        firstName: 'Inactive',
        lastName: 'User',
        role: UserRole.WORKER
      }
      const user = await authService.registerUser(userData)
      
      // Deactivate user
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      })

      // Act & Assert
      await expect(
        authService.login(userData.email, userData.password)
      ).rejects.toThrow('Account is inactive')
    })

    it('should generate valid JWT token on login', async () => {
      // Arrange
      const userData = {
        email: 'jwt@test.com',
        password: 'SecurePass123!',
        firstName: 'JWT',
        lastName: 'User',
        role: UserRole.ADMIN
      }
      await authService.registerUser(userData)

      // Act
      const result = await authService.login(userData.email, userData.password)

      // Assert - Token should be verifiable
      const verified = await authService.verifyToken(result.token)
      expect(verified.email).toBe(userData.email)
      expect(verified.role).toBe(UserRole.ADMIN)
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token and return user info', async () => {
      // Arrange - Create user and login
      const userData = {
        email: 'verify@test.com',
        password: 'SecurePass123!',
        firstName: 'Verify',
        lastName: 'User',
        role: UserRole.WORKER
      }
      await authService.registerUser(userData)
      const { token } = await authService.login(userData.email, userData.password)

      // Act
      const verified = await authService.verifyToken(token)

      // Assert
      expect(verified).toBeDefined()
      expect(verified.email).toBe(userData.email)
      expect(verified.role).toBe(UserRole.WORKER)
      expect(verified.userId).toBeDefined()
    })

    it('should reject invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid.token.here'

      // Act & Assert
      await expect(
        authService.verifyToken(invalidToken)
      ).rejects.toThrow()
    })

    it('should reject token for inactive user', async () => {
      // Arrange - Create user, login, then deactivate
      const userData = {
        email: 'deactivate@test.com',
        password: 'SecurePass123!',
        firstName: 'Deactivate',
        lastName: 'User',
        role: UserRole.WORKER
      }
      const user = await authService.registerUser(userData)
      const { token } = await authService.login(userData.email, userData.password)

      // Deactivate user
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      })

      // Act & Assert
      await expect(
        authService.verifyToken(token)
      ).rejects.toThrow('User not found or inactive')
    })
  })
})