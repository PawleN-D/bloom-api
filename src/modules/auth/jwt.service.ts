import jwt, { SignOptions, Secret } from 'jsonwebtoken'
import { UserRole } from '@prisma/client'

export interface JWTPayload {
  userId: string
  email: string
  role: UserRole | 'CARE_WORKER'
  organizationId?: string | null
  globalAdmin?: boolean
  type?: 'access' | 'session-unlock'
}

export class JWTService {
  private secret: Secret

  constructor() {
    this.secret = process.env.JWT_SECRET || 'default-secret-change-me'
    
    if (this.secret === 'default-secret-change-me' && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production')
    }
  }

  generateToken(payload: JWTPayload, expiresIn?: string): string {
    const tokenPayload: JWTPayload = {
      ...payload,
      type: payload.type || 'access',
    }
    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: this.resolveExpiresIn(expiresIn),
    })
  }

  generateSessionUnlockToken(payload: JWTPayload): string {
    return this.generateToken(
      { ...payload, type: 'session-unlock' },
      process.env.SESSION_UNLOCK_EXPIRES_IN || '5m'
    )
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret) as JWTPayload
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  private resolveExpiresIn(value?: string): SignOptions['expiresIn'] {
    const resolved = value || process.env.JWT_EXPIRES_IN || '15m'
    return resolved as SignOptions['expiresIn']
  }
}
