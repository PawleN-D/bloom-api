import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'

export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  organizationId?: string | null
}

export class JWTService {
  private secret: string

  constructor() {
    this.secret = process.env.JWT_SECRET || 'default-secret-change-me'
    
    if (this.secret === 'default-secret-change-me' && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production')
    }
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: '15m' })
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret) as JWTPayload
    } catch (error) {
      throw new Error('Invalid token')
    }
  }
}
