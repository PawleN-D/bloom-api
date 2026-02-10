import { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma';

export class OrganizationsService {
  
  async getCurrentOrganization(request: FastifyRequest) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    const organization = await prisma.organization.findUnique({
      where: { id: org.id },
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        logo: true,
        primaryColor: true,
        plan: true,
        billingEmail: true,
        maxUsers: true,
        maxClients: true,
        active: true,
        suspended: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return organization;
  }
  
  async updateOrganization(request: FastifyRequest, data: any) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.billingEmail !== undefined) updateData.billingEmail = data.billingEmail;
    
    
    const organization = await prisma.organization.update({
      where: { id: org.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        logo: true,
        primaryColor: true,
        plan: true,
        billingEmail: true,
        maxUsers: true,
        maxClients: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return organization;
  }
  
  async getOrganizationStats(request: FastifyRequest) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    const [
      totalUsers,
      activeUsers,
      totalClients,
      activeClients,
      totalTasks,
      completedTasks,
      totalNotes,
    ] = await Promise.all([
      prisma.user.count({
        where: { organizationId: org.id },
      }),
      prisma.user.count({
        where: { organizationId: org.id, isActive: true },
      }),
      prisma.client.count({
        where: { organizationId: org.id },
      }),
      prisma.client.count({
        where: { organizationId: org.id, isActive: true },
      }),
      prisma.task.count({
        where: { organizationId: org.id },
      }),
      prisma.taskCompletion.count({
        where: {
          task: {
            organizationId: org.id,
          },
        },
      }),
      prisma.note.count({
        where: { organizationId: org.id },
      }),
    ]);
    
    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        limit: org.maxUsers,
        percentUsed: Math.round((activeUsers / org.maxUsers) * 100),
      },
      clients: {
        total: totalClients,
        active: activeClients,
        inactive: totalClients - activeClients,
        limit: org.maxClients,
        percentUsed: Math.round((activeClients / org.maxClients) * 100),
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: totalTasks - completedTasks,
      },
      notes: {
        total: totalNotes,
      },
      subscription: {
        plan: org.plan,
        trialEndsAt: org.trialEndsAt,
      },
    };
  }
  
  async getOrganizationFeatures(request: FastifyRequest) {
    const org = request.organization;

    if (!org) {
      throw new Error('Organization not found');
    }

    const orgFeatures = await prisma.organizationFeature.findMany({
      where: { organizationId: org.id },
      include: {
        feature: true,
      },
    });

    const overrideFeatureIds = orgFeatures
      .filter((item) => item.enabled)
      .map((item) => item.featureId);

    const allFeatures = await prisma.feature.findMany({
      where: {
        OR: [
          { availableInPlans: { has: org.plan } },
          { defaultEnabled: true },
          { id: { in: overrideFeatureIds } },
        ],
      },
      orderBy: { category: 'asc' },
    });

    const features = allFeatures.map((feature) => {
      const orgFeature = orgFeatures.find((of) => of.featureId === feature.id);

      return {
        id: feature.id,
        key: feature.key,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        availableInPlans: feature.availableInPlans,
        betaFeature: feature.betaFeature,
        comingSoon: feature.comingSoon,
        enabled: orgFeature ? orgFeature.enabled : feature.defaultEnabled,
        config: orgFeature?.config || null,
      };
    });

    return features;
  }
  
  async enableFeature(request: FastifyRequest, featureKey: string, config?: any) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
    });
    
    if (!feature) {
      throw new Error('Feature not found');
    }
    
    if (!feature.availableInPlans.includes(org.plan) && !feature.defaultEnabled) {
      throw new Error(`Feature '${feature.name}' is not available in ${org.plan} plan. Upgrade to access this feature.`);
    }
    
    await prisma.organizationFeature.upsert({
      where: {
        organizationId_featureId: {
          organizationId: org.id,
          featureId: feature.id,
        },
      },
      update: {
        enabled: true,
        config: config || null,
        updatedAt: new Date(),
      },
      create: {
        id: require('crypto').randomBytes(16).toString('hex'),
        organizationId: org.id,
        featureId: feature.id,
        enabled: true,
        config: config || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    return {
      message: `Feature '${feature.name}' enabled successfully`,
      feature: {
        key: feature.key,
        name: feature.name,
        enabled: true,
      },
    };
  }
  
  async disableFeature(request: FastifyRequest, featureKey: string) {
    const org = request.organization;
    
    if (!org) {
      throw new Error('Organization not found');
    }
    
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
    });
    
    if (!feature) {
      throw new Error('Feature not found');
    }
    
    await prisma.organizationFeature.upsert({
      where: {
        organizationId_featureId: {
          organizationId: org.id,
          featureId: feature.id,
        },
      },
      update: {
        enabled: false,
        updatedAt: new Date(),
      },
      create: {
        id: require('crypto').randomBytes(16).toString('hex'),
        organizationId: org.id,
        featureId: feature.id,
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    return {
      message: `Feature '${feature.name}' disabled successfully`,
      feature: {
        key: feature.key,
        name: feature.name,
        enabled: false,
      },
    };
  }
}
