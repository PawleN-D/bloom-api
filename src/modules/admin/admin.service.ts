import { prisma } from '../../shared/database/prisma';

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
    
    const orgId = require('crypto').randomBytes(16).toString('hex');
    
    const organization = await prisma.organization.create({
      data: {
        id: orgId,
        name: data.name,
        slug,
        subdomain: data.subdomain || null,
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
}
