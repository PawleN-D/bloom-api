import { JWTService } from './jwt.service'
import { UserRole } from '@prisma/client'

describe('JWTService', () => {
  let jwtService: JWTService
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.JWT_SECRET = 'test-secret-key'
    process.env.NODE_ENV = 'test'
    jwtService = new JWTService()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@test.com',
        role: UserRole.WORKER
      }

      const token = jwtService.generateToken(payload)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should generate different tokens for different users', () => {
      const payload1 = {
        userId: 'user-1',
        email: 'user1@test.com',
        role: UserRole.WORKER
      }
      const payload2 = {
        userId: 'user-2',
        email: 'user2@test.com',
        role: UserRole.ADMIN
      }

      const token1 = jwtService.generateToken(payload1)
      const token2 = jwtService.generateToken(payload2)

      expect(token1).not.toBe(token2)
    })
  })

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@test.com',
        role: UserRole.WORKER
      }
      const token = jwtService.generateToken(payload)

      const decoded = jwtService.verifyToken(token)

      expect(decoded.userId).toBe(payload.userId)
      expect(decoded.email).toBe(payload.email)
      expect(decoded.role).toBe(payload.role)
    })

    it('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here'

      expect(() => {
        jwtService.verifyToken(invalidToken)
      }).toThrow('Invalid token')
    })

    it('should reject token signed with different secret', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@test.com',
        role: UserRole.WORKER
      }
      const token = jwtService.generateToken(payload)

      process.env.JWT_SECRET = 'different-secret'
      const newJwtService = new JWTService()

      expect(() => {
        newJwtService.verifyToken(token)
      }).toThrow('Invalid token')
    })
  })

  describe('security', () => {
    it('should throw error if JWT_SECRET not set in production', () => {
      delete process.env.JWT_SECRET
      process.env.NODE_ENV = 'production'

      expect(() => {
        new JWTService()
      }).toThrow('JWT_SECRET must be set in production')
    })

    it('should allow default secret in development', () => {
      delete process.env.JWT_SECRET
      process.env.NODE_ENV = 'development'

      expect(() => {
        new JWTService()
      }).not.toThrow()
    })
  })
})
