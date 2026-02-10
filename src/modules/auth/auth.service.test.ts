import { AuthService } from './auth.service'
import { prisma } from '../../../tests/setup'
import { UserRole } from '@prisma/client'
import { createOrganization } from '../../../tests/helpers'

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
  })

  describe('registerUser', () => {
    it('should create a new user with hashed password', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'worker@test.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.WORKER,
        organizationId: org.id,
      }

      const user = await authService.registerUser(userData)

      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.email).toBe(userData.email)
      expect(user.firstName).toBe(userData.firstName)
      expect(user.lastName).toBe(userData.lastName)
      expect(user.role).toBe(UserRole.WORKER)
      expect(user.passwordHash).not.toBe(userData.password) // Should be hashed
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/) // bcrypt hash pattern
      expect(user.isActive).toBe(true)
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should not allow duplicate emails', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'duplicate@test.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.WORKER,
        organizationId: org.id,
      }

      await authService.registerUser(userData)

      await expect(
        authService.registerUser(userData)
      ).rejects.toThrow('Email already exists')
    })

    it('should create users with different roles', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const workerData = {
        email: 'unique-worker@test.com',
        password: 'SecurePass123!',
        firstName: 'Worker',
        lastName: 'One',
        role: UserRole.WORKER,
        organizationId: org.id,
      }

      const adminData = {
        email: 'unique-admin@test.com',
        password: 'SecurePass123!',
        firstName: 'Admin',
        lastName: 'One',
        role: UserRole.ADMIN,
        organizationId: org.id,
      }

      const worker = await authService.registerUser(workerData)
      const admin = await authService.registerUser(adminData)

      expect(worker.role).toBe(UserRole.WORKER)
      expect(admin.role).toBe(UserRole.ADMIN)
    })

    it('should hash different passwords differently', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const user1Data = {
        email: 'user1@test.com',
        password: 'Password1!',
        firstName: 'User',
        lastName: 'One',
        role: UserRole.WORKER,
        organizationId: org.id,
      }

      const user2Data = {
        email: 'user2@test.com',
        password: 'Password2!',
        firstName: 'User',
        lastName: 'Two',
        role: UserRole.WORKER,
        organizationId: org.id,
      }

      const user1 = await authService.registerUser(user1Data)
      const user2 = await authService.registerUser(user2Data)

      expect(user1.passwordHash).not.toBe(user2.passwordHash)
    })
  })

  describe('login', () => {
    it('should login user with valid credentials and return token', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'login@test.com',
        password: 'SecurePass123!',
        firstName: 'Login',
        lastName: 'User',
        role: UserRole.WORKER,
        organizationId: org.id,
      }
      await authService.registerUser(userData)

      const result = await authService.login(userData.email, userData.password)

      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.user.email).toBe(userData.email)
      expect(result.user).not.toHaveProperty('passwordHash') // Password should be excluded
      expect(typeof result.token).toBe('string')
      expect(result.token.split('.')).toHaveLength(3) // JWT format
    })

    it('should reject invalid password', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'test@test.com',
        password: 'CorrectPassword',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.WORKER,
        organizationId: org.id,
      }
      await authService.registerUser(userData)

      await expect(
        authService.login(userData.email, 'WrongPassword')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      await expect(
        authService.login('nonexistent@test.com', 'password')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should reject inactive user', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'inactive@test.com',
        password: 'Password123!',
        firstName: 'Inactive',
        lastName: 'User',
        role: UserRole.WORKER,
        organizationId: org.id,
      }
      const user = await authService.registerUser(userData)
      
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      })

      await expect(
        authService.login(userData.email, userData.password)
      ).rejects.toThrow('Account is inactive')
    })

    it('should generate valid JWT token on login', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'jwt@test.com',
        password: 'SecurePass123!',
        firstName: 'JWT',
        lastName: 'User',
        role: UserRole.ADMIN,
        organizationId: org.id,
      }
      await authService.registerUser(userData)

      const result = await authService.login(userData.email, userData.password)

      const verified = await authService.verifyToken(result.token)
      expect(verified.email).toBe(userData.email)
      expect(verified.role).toBe(UserRole.ADMIN)
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token and return user info', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'verify@test.com',
        password: 'SecurePass123!',
        firstName: 'Verify',
        lastName: 'User',
        role: UserRole.WORKER,
        organizationId: org.id,
      }
      await authService.registerUser(userData)
      const { token } = await authService.login(userData.email, userData.password)

      const verified = await authService.verifyToken(token)

      expect(verified).toBeDefined()
      expect(verified.email).toBe(userData.email)
      expect(verified.role).toBe(UserRole.WORKER)
      expect(verified.userId).toBeDefined()
    })

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here'

      await expect(
        authService.verifyToken(invalidToken)
      ).rejects.toThrow()
    })

    it('should reject token for inactive user', async () => {
      const org = await createOrganization({ name: 'Auth Org' })
      const userData = {
        email: 'deactivate@test.com',
        password: 'SecurePass123!',
        firstName: 'Deactivate',
        lastName: 'User',
        role: UserRole.WORKER,
        organizationId: org.id,
      }
      const user = await authService.registerUser(userData)
      const { token } = await authService.login(userData.email, userData.password)

      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false }
      })

      await expect(
        authService.verifyToken(token)
      ).rejects.toThrow('User not found or inactive')
    })
  })
})
