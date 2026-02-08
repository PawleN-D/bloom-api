import { randomUUID } from 'crypto';
import { config } from '../../config/env';
import { prisma } from '../../shared/database/prisma';
import { UserRole, UserStatus } from '@prisma/client';
import {
  generateUniqueSubdomain,
  isSubdomainAvailable,
  isValidSubdomain,
} from '../../shared/utils/subdomain';

export class AdminService {
  
  /**
   * List all organizations with pagination
   */
  async listOrganizations(filters?: any) {
    const { search, plan, active, suspended } = filters || {};
    
    const where: any = {};
    
    if (plan) where.plan = plan;
    if (active !== undefined) where.active = active === 'true';
    if (suspended !== undefined) where.suspended = suspended === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              clients: true,
              tasks: true,
              notes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.organization.count({ where }),
    ]);
    
    return {
      organizations,
      total,
    };
  }
  
  /**
   * Get single organization with full details
   */
  async getOrganization(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            tasks: true,
            notes: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
          take: 10,
        },
      },
    });
    
    if (!organization) {
      throw new Error('Organization not found');
    }
    
    return organization;
  }
  
  /**
   * Create new organization
   */
  async createOrganization(data: any) {
    // Generate slug from name if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check if slug is already taken
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });
    
    if (existing) {
      throw new Error('Organization slug already exists');
    }

    let subdomain = data.subdomain?.trim();
    if (subdomain) {
      if (!isValidSubdomain(subdomain)) {
        throw new Error('Invalid subdomain format');
      }
      const available = await isSubdomainAvailable(prisma, subdomain);
      if (!available) {
        throw new Error(`Subdomain '${subdomain}' is already taken`);
      }
    } else {
      subdomain = await generateUniqueSubdomain(prisma, data.name);
    }
    
    const orgId = require('crypto').randomBytes(16).toString('hex');
    
    const organization = await prisma.organization.create({
      data: {
        id: orgId,
        name: data.name,
        slug,
        subdomain,
        logo: data.logo || null,
        primaryColor: data.primaryColor || '#0F766E',
        plan: data.plan || 'STARTER',
        billingEmail: data.billingEmail || null,
        maxUsers: data.maxUsers || 10,
        maxClients: data.maxClients || 50,
        active: true,
        suspended: false,
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    return organization;
  }
  
  /**
   * Update organization (super admin can change plan, limits, etc.)
   */
  async updateOrganization(id: string, data: any) {
    const existing = await prisma.organization.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Organization not found');
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    // Super admin can update everything
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.plan !== undefined) updateData.plan = data.plan;
    if (data.billingEmail !== undefined) updateData.billingEmail = data.billingEmail;
    if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
    if (data.maxClients !== undefined) updateData.maxClients = data.maxClients;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.suspended !== undefined) updateData.suspended = data.suspended;
    if (data.trialEndsAt !== undefined) {
      updateData.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
    }
    
    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });
    
    return organization;
  }
  
  /**
   * Suspend organization
   */
  async suspendOrganization(id: string) {
    const existing = await prisma.organization.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Organization not found');
    }
    
    await prisma.organization.update({
      where: { id },
      data: {
        suspended: true,
        active: false,
        updatedAt: new Date(),
      },
    });
    
    return {
      message: `Organization '${existing.name}' suspended successfully`,
    };
  }
  
  /**
   * Unsuspend organization
   */
  async unsuspendOrganization(id: string) {
    const existing = await prisma.organization.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Organization not found');
    }
    
    await prisma.organization.update({
      where: { id },
      data: {
        suspended: false,
        active: true,
        updatedAt: new Date(),
      },
    });
    
    return {
      message: `Organization '${existing.name}' unsuspended successfully`,
    };
  }
  
  /**
   * Get platform-wide statistics
   */
  async getPlatformStats() {
    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalUsers,
      totalClients,
      totalTasks,
      totalNotes,
      orgsByPlan,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { active: true, suspended: false } }),
      prisma.organization.count({ where: { suspended: true } }),
      prisma.user.count(),
      prisma.client.count(),
      prisma.task.count(),
      prisma.note.count(),
      prisma.organization.groupBy({
        by: ['plan'],
        _count: true,
      }),
    ]);
    
    return {
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        suspended: suspendedOrganizations,
        byPlan: orgsByPlan.reduce((acc, item) => {
          acc[item.plan] = item._count;
          return acc;
        }, {} as Record<string, number>),
      },
      users: {
        total: totalUsers,
      },
      clients: {
        total: totalClients,
      },
      tasks: {
        total: totalTasks,
      },
      notes: {
        total: totalNotes,
      },
    };
  }


  /**
   * List subscriptions with organization context
   */
  async listSubscriptions(filters?: any) {
    const { search, plan, status } = filters || {};
    const where: any = {};

    if (plan) where.plan = plan;
    if (status) where.status = status;
    if (search) {
      where.organization = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              trialEndsAt: true,
            },
          },
          invoices: {
            orderBy: { issuedAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
        orderBy: { currentPeriodEnd: 'desc' },
        take: 100,
      }),
      prisma.subscription.count({ where }),
    ]);

    return {
      subscriptions,
      total,
    };
  }


  /**
   * List users for an organization
   */
  async listOrganizationUsers(orgId: string, filters?: any) {
    const { search, role, active } = filters || {};
    const where: any = { organizationId: orgId };

    if (role) where.role = role;
    if (active !== undefined) where.isActive = active === 'true';

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create (invite) user for an organization
   */
  async createOrganizationUser(orgId: string, data: any) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, maxUsers: true },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error('User with this email already exists');
    }

    const role = data.role || 'WORKER';
    if (role === 'SUPER_ADMIN') {
      throw new Error('SUPER_ADMIN role cannot be assigned to organization users');
    }

    const activeCount = await prisma.user.count({
      where: { organizationId: orgId, isActive: true },
    });

    if (activeCount >= organization.maxUsers) {
      throw new Error(`Organization has reached maximum users (${organization.maxUsers}).`);
    }

    const now = new Date();
    const invitationToken = randomUUID();
    const tokenExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const firstName = data.firstName || 'Pending';
    const lastName = data.lastName || 'User';

    const user = await prisma.user.create({
      data: {
        id: require('crypto').randomBytes(16).toString('hex'),
        email: data.email,
        passwordHash: null,
        pinHash: null,
        invitationToken,
        tokenExpires,
        status: UserStatus.PENDING,
        firstName,
        lastName,
        role,
        organizationId: orgId,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (config.nodeEnv !== 'production') {
      console.log(`[Invite Email] ${user.email} invited to ${organization.name}. Token: ${invitationToken}`);
    } else {
      console.log(`[Invite Email] ${user.email} invited to ${organization.name}.`);
    }

    return {
      user,
      ...(config.nodeEnv === 'production' ? {} : { invitationToken }),
    };
  }

  /**
   * Update user profile
   */
  async updateOrganizationUser(orgId: string, userId: string, data: any) {
    const existing = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    const updateData: any = { updatedAt: new Date() };
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: data.email, id: { not: userId } },
      });
      if (emailTaken) {
        throw new Error('Email already in use');
      }
      updateData.email = data.email;
    }

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user role
   */
  async updateOrganizationUserRole(orgId: string, userId: string, role: UserRole) {
    if (role === 'SUPER_ADMIN') {
      throw new Error('SUPER_ADMIN role cannot be assigned to organization users');
    }

    const allowedRoles = new Set<UserRole>([
      UserRole.WORKER,
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ORG_OWNER,
    ]);
    if (!allowedRoles.has(role)) {
      throw new Error('Invalid role');
    }

    const existing = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role, updatedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Deactivate user
   */
  async deactivateOrganizationUser(orgId: string, userId: string) {
    const existing = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, updatedAt: new Date() },
    });

    return { message: 'User deactivated successfully' };
  }

  /**
   * Reactivate user
   */
  async reactivateOrganizationUser(orgId: string, userId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, maxUsers: true },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const existing = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    const activeCount = await prisma.user.count({
      where: { organizationId: orgId, isActive: true },
    });

    if (activeCount >= organization.maxUsers) {
      throw new Error(`Organization has reached maximum users (${organization.maxUsers}).`);
    }

    return prisma.user.update({
      where: { id: userId },
      data: { isActive: true, updatedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  
  /**
   * List all features
   */
  async listFeatures() {
    const features = await prisma.feature.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });
    
    return features;
  }
  
  /**
   * Create new feature
   */
  async createFeature(data: any) {
    const featureId = require('crypto').randomBytes(16).toString('hex');
    
    const feature = await prisma.feature.create({
      data: {
        id: featureId,
        key: data.key,
        name: data.name,
        description: data.description || null,
        category: data.category,
        availableInPlans: data.availableInPlans || [],
        betaFeature: data.betaFeature || false,
        comingSoon: data.comingSoon || false,
        defaultEnabled: data.defaultEnabled || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    return feature;
  }

  /**
   * Get organization with enabled features
   */
  async getOrganizationFeatures(orgId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const features = await prisma.organizationFeature.findMany({
      where: { organizationId: orgId },
      include: {
        feature: true,
      },
    });

    return {
      organization,
      features,
    };
  }

  /**
   * Set organization feature override (HQ)
   */
  async setOrganizationFeature(orgId: string, featureKey: string, enabled: boolean, config?: any) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
    });

    if (!feature) {
      throw new Error('Feature not found');
    }

    const now = new Date();
    const record = await prisma.organizationFeature.upsert({
      where: {
        organizationId_featureId: {
          organizationId: orgId,
          featureId: feature.id,
        },
      },
      update: {
        enabled,
        config: config ?? null,
        updatedAt: now,
      },
      create: {
        id: require('crypto').randomBytes(16).toString('hex'),
        organizationId: orgId,
        featureId: feature.id,
        enabled,
        config: config ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      organizationId: orgId,
      featureKey: feature.key,
      enabled: record.enabled,
    };
  }
}
