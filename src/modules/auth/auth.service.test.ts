import { AuthService } from './auth.service'
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
        email: 'worker@test.com',
        password: 'SecurePass123!',
        firstName: 'Worker',
        lastName: 'One',
        role: UserRole.WORKER
      }

      const adminData = {
        email: 'admin@test.com',
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
})