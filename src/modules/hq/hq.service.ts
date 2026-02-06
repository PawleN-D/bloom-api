import { randomUUID } from 'crypto';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { config } from '../../config/env';
import { DEFAULT_BILLING_CYCLE_DAYS, PLAN_CATALOG } from '../../shared/constants/plans';

type OnboardOrgInput = {
  orgName: string;
  adminEmail: string;
  subscriptionPlan: SubscriptionPlan;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export class HQService {
  async onboardOrganization(input: OnboardOrgInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.adminEmail },
    });

    if (existingUser) {
      throw new Error('Admin email already exists');
    }

    let slug = slugify(input.orgName);
    if (!slug) {
      slug = `org-${randomUUID().slice(0, 6)}`;
    }

    const slugExists = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (slugExists) {
      slug = `${slug}-${randomUUID().slice(0, 4)}`;
    }

    const plan = PLAN_CATALOG[input.subscriptionPlan];
    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + DEFAULT_BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000
    );

    const organization = await prisma.organization.create({
      data: {
        id: `org_${randomUUID().slice(0, 8)}`,
        name: input.orgName,
        slug,
        subdomain: null,
        plan: input.subscriptionPlan,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        billingEmail: input.adminEmail,
        maxUsers: plan.maxUsers,
        maxClients: plan.maxClients,
        active: true,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        id: `sub_${randomUUID().slice(0, 10)}`,
        organizationId: organization.id,
        plan: input.subscriptionPlan,
        status: SubscriptionStatus.ACTIVE,
        priceCents: plan.priceCents,
        currency: plan.currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    const features = await prisma.feature.findMany({
      where: {
        availableInPlans: {
          has: input.subscriptionPlan,
        },
        defaultEnabled: true,
      },
      select: { id: true, key: true },
    });

    if (features.length) {
      await prisma.organizationFeature.createMany({
        data: features.map((feature) => ({
          id: `org_feature_${randomUUID().slice(0, 10)}`,
          organizationId: organization.id,
          featureId: feature.id,
          enabled: true,
          config: null,
          createdAt: now,
          updatedAt: now,
        })),
        skipDuplicates: true,
      });
    }

    const invitationToken = randomUUID();
    const tokenExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const adminUser = await prisma.user.create({
      data: {
        id: `user_${randomUUID().slice(0, 10)}`,
        email: input.adminEmail,
        passwordHash: null,
        pinHash: null,
        invitationToken,
        tokenExpires,
        status: UserStatus.PENDING,
        firstName: 'Org',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        organizationId: organization.id,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.sendOnboardingInvite(adminUser.email, invitationToken, organization.name);

    return {
      organization,
      subscription,
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status,
        organizationId: adminUser.organizationId,
        createdAt: adminUser.createdAt,
      },
      featuresEnabled: features.map((feature) => feature.key),
      ...(config.nodeEnv === 'production' ? {} : { invitationToken }),
    };
  }

  async getAuditLogs() {
    const logs = await prisma.securityLog.findMany({
      where: {
        organization: {
          subscriptionStatus: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
          },
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionStatus: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      organization: log.organization,
      user: log.user,
    }));
  }

  private async sendOnboardingInvite(email: string, token: string, orgName: string) {
    if (config.nodeEnv !== 'production') {
      console.log(`[HQ Invite] ${email} invited to ${orgName}. Token: ${token}`);
    } else {
      console.log(`[HQ Invite] ${email} invited to ${orgName}.`);
    }
  }
}
