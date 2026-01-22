import { AuthService } from './auth.service'
import { prisma } from '../../../tests/setup'

describe('AuthService', () => {
  describe('registerUser', () => {
    it('should create a new user with hashed password', async () => {
      // Arrange
      const authService = new AuthService()
      const userData = {
        email: 'worker@test.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'WORKER' as const
      }

      // Act
      const user = await authService.registerUser(userData)

      // Assert
      expect(user).toBeDefined()
      expect(user.email).toBe(userData.email)
      expect(user.password).not.toBe(userData.password) // Should be hashed
      expect(user.password).toMatch(/^\$2[aby]\$/) // bcrypt hash pattern
      expect(user.role).toBe('WORKER')
    })

    it('should not allow duplicate emails', async () => {
      // Arrange
      const authService = new AuthService()
      const userData = {
        email: 'duplicate@test.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'WORKER' as const
      }

      // Create first user
      await authService.registerUser(userData)

      // Act & Assert
      await expect(
        authService.registerUser(userData)
      ).rejects.toThrow('Email already exists')
    })
  })
})