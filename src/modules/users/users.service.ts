import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';
import { withTenantIsolation } from '../../shared/middleware/tenant-context';
import { canManageUser } from '../../shared/middleware/authorize';
import { UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { config } from '../../config/env';

export class UsersService {
  
  /**
   * Get all users in organization
   */
  async getUsers(request: FastifyRequest, filters?: any) {
    const { search, role, active } = filters || {};
    
    const where = withTenantIsolation(request, {
      role: role || undefined,
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
    });
    
    if (search) {
      (where as any).OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // Don't return password!
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return users;
  }
  
  /**
   * Get single user
   */
  async getUser(request: FastifyRequest, id: string) {
    const user = await prisma.user.findUnique({
      where: withTenantIsolation(request, { id }),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        status: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }
  
  /**
   * Create new user (invite to organization)
   */
  async createUser(request: FastifyRequest, data: any) {
    return this.inviteUser(request, data);
  }

  /**
   * Invite user with secure onboarding token
   */
  async inviteUser(request: FastifyRequest, data: any) {
    const currentUser = request.user;
    const org = request.organization;

    if (!org) {
      throw new Error('Organization required');
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Validate role assignment
    const requestedRole = data.role || 'WORKER';
    if (!currentUser || !canManageUser(currentUser.role, requestedRole)) {
      throw new Error(`You cannot create users with role: ${requestedRole}`);
    }

    // Check organization user limit
    const userCount = await prisma.user.count({
      where: { organizationId: org.id, isActive: true },
    });

    if (userCount >= org.maxUsers) {
      throw new Error(`Organization has reached maximum users (${org.maxUsers}). Upgrade plan to add more.`);
    }

    const now = new Date();
    const invitationToken = randomUUID();
    const tokenExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const firstName = data.firstName || 'Pending';
    const lastName = data.lastName || 'User';

    const userId = require('crypto').randomBytes(16).toString('hex');

    const user = await prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        passwordHash: null,
        pinHash: null,
        invitationToken,
        tokenExpires,
        status: UserStatus.PENDING,
        firstName,
        lastName,
        role: requestedRole,
        organizationId: org.id,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.sendInviteEmail(user.email, invitationToken, org.name);

    const response = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
      ...(config.nodeEnv === 'production' ? {} : { invitationToken }),
    };

    return response;
  }

  private async sendInviteEmail(email: string, token: string, orgName: string) {
    // Mock: replace with Resend/SendGrid integration.
    // Intentionally logs token only for non-production environments.
    if (config.nodeEnv !== 'production') {
      console.log(`[Invite Email] ${email} invited to ${orgName}. Token: ${token}`);
    } else {
      console.log(`[Invite Email] ${email} invited to ${orgName}.`);
    }
  }
  
  /**
   * Update user
   */
  async updateUser(request: FastifyRequest, id: string, data: any) {
    const currentUser = request.user;
    
    // Verify user belongs to organization
    const existing = await prisma.user.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('User not found');
    }
    
    // Check permissions
    if (!currentUser || !canManageUser(currentUser.role, existing.role)) {
      throw new Error('You do not have permission to update this user');
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) {
      // Check if new email is already taken
      const emailTaken = await prisma.user.findFirst({
        where: { 
          email: data.email,
          id: { not: id },
        },
      });
      if (emailTaken) {
        throw new Error('Email already in use');
      }
      updateData.email = data.email;
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
    
    return user;
  }
  
  /**
   * Change user role (ORG_OWNER or higher only)
   */
  async changeUserRole(request: FastifyRequest, id: string, newRole: string) {
    const currentUser = request.user;
    
    // Verify user belongs to organization
    const existing = await prisma.user.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('User not found');
    }
    
    // Check if current user can manage both old and new roles
    if (!currentUser || !canManageUser(currentUser.role, existing.role)) {
      throw new Error('You cannot manage this user');
    }
    
    // if (!canManageUser(currentUser.role, newRole)) {
    //   throw new Error(`You cannot assign role: ${newRole}`);
    // }
    
    // Prevent user from changing their own role
    if (currentUser && existing.id === currentUser.id) {
      throw new Error('You cannot change your own role');
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: { 
        role: newRole as any,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
    
    return user;
  }
  
  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(request: FastifyRequest, id: string) {
    const currentUser = request.user;
    
    // Verify user belongs to organization
    const existing = await prisma.user.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('User not found');
    }
    
    // Check permissions
    if (!currentUser || !canManageUser(currentUser.role, existing.role)) {
      throw new Error('You do not have permission to deactivate this user');
    }
    
    // Prevent user from deactivating themselves
    if (currentUser && existing.id === currentUser.id) {
      throw new Error('You cannot deactivate yourself');
    }
    
    await prisma.user.update({
      where: { id },
      data: { 
        isActive: false,
        updatedAt: new Date(),
      },
    });
    
    return { message: 'User deactivated successfully' };
  }
  
  /**
   * Reactivate user
   */
  async reactivateUser(request: FastifyRequest, id: string) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization required');
    }
    
    // Verify user belongs to organization
    const existing = await prisma.user.findUnique({
      where: withTenantIsolation(request, { id }),
    });
    
    if (!existing) {
      throw new Error('User not found');
    }
    
    // Check organization user limit
    const activeUserCount = await prisma.user.count({
      where: { organizationId: org.id, isActive: true },
    });
    
    if (activeUserCount >= org.maxUsers) {
      throw new Error(`Organization has reached maximum users (${org.maxUsers})`);
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: { 
        isActive: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
    
    return user;
  }
}
