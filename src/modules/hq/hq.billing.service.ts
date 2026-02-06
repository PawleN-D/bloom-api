import { randomUUID } from 'crypto';
import {
  DiscountType,
  InvoiceStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { DEFAULT_BILLING_CYCLE_DAYS, PLAN_CATALOG } from '../../shared/constants/plans';

type PlanChangeResult = {
  subscriptionId: string;
  organizationId: string;
  oldPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
  prorationCents: number;
  invoiceId: string | null;
};

type CreateDiscountInput = {
  code: string;
  type: DiscountType;
  value: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  maxRedemptions?: number | null;
};

export class HQBillingService {
  private calculateProration(
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    oldPrice: number,
    newPrice: number
  ) {
    const now = new Date();
    const totalMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    if (totalMs <= 0) {
      return 0;
    }
    const remainingMs = Math.max(currentPeriodEnd.getTime() - now.getTime(), 0);
    const ratio = remainingMs / totalMs;
    return Math.round((newPrice - oldPrice) * ratio);
  }

  async getSubscriptionForOrg(organizationId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        discount: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found for organization');
    }

    return subscription;
  }

  async changePlan(organizationId: string, newPlan: SubscriptionPlan): Promise<PlanChangeResult> {
    const subscription = await this.getSubscriptionForOrg(organizationId);
    const now = new Date();
    const plan = PLAN_CATALOG[newPlan];

    const prorationCents = this.calculateProration(
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.priceCents,
      plan.priceCents
    );

    const invoiceId = await this.createProrationInvoice(
      subscription.id,
      organizationId,
      prorationCents,
      plan.currency
    );

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: newPlan,
        maxUsers: plan.maxUsers,
        maxClients: plan.maxClients,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        updatedAt: now,
      },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: newPlan,
        priceCents: plan.priceCents,
        currency: plan.currency,
        status: SubscriptionStatus.ACTIVE,
        updatedAt: now,
      },
    });

    await this.syncOrganizationFeatures(organizationId, newPlan);

    return {
      subscriptionId: subscription.id,
      organizationId,
      oldPlan: subscription.plan,
      newPlan,
      prorationCents,
      invoiceId,
    };
  }

  async pauseSubscription(organizationId: string) {
    const now = new Date();
    const subscription = await this.getSubscriptionForOrg(organizationId);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.SUSPENDED,
        pausedAt: now,
        updatedAt: now,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        updatedAt: now,
      },
    });
  }

  async resumeSubscription(organizationId: string) {
    const now = new Date();
    const subscription = await this.getSubscriptionForOrg(organizationId);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        resumedAt: now,
        updatedAt: now,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        updatedAt: now,
      },
    });
  }

  async cancelWithGracePeriod(organizationId: string, graceDays = 30) {
    const now = new Date();
    const subscription = await this.getSubscriptionForOrg(organizationId);
    const gracePeriodEndsAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        cancelAtPeriodEnd: true,
        cancelRequestedAt: now,
        gracePeriodEndsAt,
        updatedAt: now,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        updatedAt: now,
      },
    });

    return { gracePeriodEndsAt };
  }

  async createDiscount(input: CreateDiscountInput) {
    const now = new Date();
    const discount = await prisma.discount.create({
      data: {
        id: `disc_${randomUUID().slice(0, 10)}`,
        code: input.code.toUpperCase(),
        type: input.type,
        value: input.value,
        active: true,
        maxRedemptions: input.maxRedemptions ?? null,
        redeemedCount: 0,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return discount;
  }

  async applyDiscount(organizationId: string, code: string) {
    const subscription = await this.getSubscriptionForOrg(organizationId);
    const discount = await prisma.discount.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount || !discount.active) {
      throw new Error('Discount code is invalid or inactive');
    }

    const now = new Date();
    if (discount.validFrom && discount.validFrom > now) {
      throw new Error('Discount is not active yet');
    }

    if (discount.validTo && discount.validTo < now) {
      throw new Error('Discount has expired');
    }

    if (discount.maxRedemptions !== null && discount.redeemedCount >= discount.maxRedemptions) {
      throw new Error('Discount redemption limit reached');
    }

    await prisma.discountRedemption.create({
      data: {
        id: `red_${randomUUID().slice(0, 10)}`,
        discountId: discount.id,
        subscriptionId: subscription.id,
        organizationId,
        redeemedAt: now,
      },
    });

    await prisma.discount.update({
      where: { id: discount.id },
      data: {
        redeemedCount: discount.redeemedCount + 1,
        updatedAt: now,
      },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        discountId: discount.id,
        updatedAt: now,
      },
    });

    return discount;
  }

  async generateInvoiceForOrg(organizationId: string) {
    const subscription = await this.getSubscriptionForOrg(organizationId);
    const now = new Date();
    const plan = PLAN_CATALOG[subscription.plan];

    const lineItem = {
      description: `Subscription (${subscription.plan})`,
      amountCents: plan.priceCents,
      quantity: 1,
    };

    return this.createInvoice(
      subscription.id,
      organizationId,
      [lineItem],
      plan.currency,
      now
    );
  }

  async listInvoices(organizationId: string) {
    return prisma.invoice.findMany({
      where: { organizationId },
      include: {
        lineItems: true,
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getSubscriptionSummary(organizationId: string) {
    const [subscription, organization, latestInvoice] = await Promise.all([
      prisma.subscription.findUnique({
        where: { organizationId },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          trialEndsAt: true,
        },
      }),
      prisma.invoice.findFirst({
        where: { organizationId },
        orderBy: { issuedAt: 'desc' },
      }),
    ]);

    if (!subscription) {
      throw new Error('Subscription not found for organization');
    }

    return {
      plan: subscription.plan,
      billingCycle: 'MONTHLY',
      status: subscription.status,
      mrr: subscription.priceCents / 100,
      nextBillingDate: subscription.currentPeriodEnd,
      paymentStatus: latestInvoice?.status ?? '—',
      trialEndsAt: organization?.trialEndsAt ?? null,
    };
  }

  async runBillingCycle() {
    const now = new Date();
    const dueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          lte: now,
        },
      },
    });

    const results = [];
    for (const subscription of dueSubscriptions) {
      const plan = PLAN_CATALOG[subscription.plan];
      const nextPeriodStart = now;
      const nextPeriodEnd = new Date(
        now.getTime() + DEFAULT_BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000
      );

      const invoice = await this.createInvoice(
        subscription.id,
        subscription.organizationId,
        [
          {
            description: `Subscription (${subscription.plan})`,
            amountCents: plan.priceCents,
            quantity: 1,
          },
        ],
        plan.currency,
        now
      );

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd,
          updatedAt: now,
        },
      });

      results.push({
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
    }

    return results;
  }

  private async createProrationInvoice(
    subscriptionId: string,
    organizationId: string,
    prorationCents: number,
    currency: string
  ): Promise<string | null> {
    if (prorationCents === 0) {
      return null;
    }

    const invoice = await this.createInvoice(
      subscriptionId,
      organizationId,
      [
        {
          description: 'Plan change proration adjustment',
          amountCents: prorationCents,
          quantity: 1,
        },
      ],
      currency,
      new Date()
    );
    return invoice.id;
  }

  private async createInvoice(
    subscriptionId: string,
    organizationId: string,
    lineItems: Array<{ description: string; amountCents: number; quantity: number }>,
    currency: string,
    issuedAt: Date
  ) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { discount: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const subtotalCents = lineItems.reduce(
      (total, item) => total + item.amountCents * item.quantity,
      0
    );

    let discountCents = 0;
    if (subscription.discount && subtotalCents > 0) {
      discountCents =
        subscription.discount.type === DiscountType.PERCENT
          ? Math.round((subtotalCents * subscription.discount.value) / 100)
          : Math.min(subscription.discount.value, subtotalCents);
    }

    const totalCents = subtotalCents - discountCents;
    const dueAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        id: `inv_${randomUUID().slice(0, 10)}`,
        organizationId,
        subscriptionId,
        status: subtotalCents < 0 ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
        subtotalCents,
        discountCents,
        totalCents,
        currency,
        issuedAt,
        dueAt,
        createdAt: issuedAt,
        updatedAt: issuedAt,
        lineItems: {
          create: lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            amountCents: item.amountCents,
            createdAt: issuedAt,
          })),
        },
      },
      include: { lineItems: true },
    });

    return invoice;
  }

  private async syncOrganizationFeatures(organizationId: string, plan: SubscriptionPlan) {
    const features = await prisma.feature.findMany({
      select: { id: true, key: true, defaultEnabled: true, availableInPlans: true },
    });

    const availableFeatureIds = features
      .filter((feature) => feature.availableInPlans.includes(plan))
      .map((feature) => feature.id);

    const updatePromises = features.map((feature) => {
      const enabled = feature.availableInPlans.includes(plan) ? feature.defaultEnabled : false;
      return prisma.organizationFeature.upsert({
        where: {
          organizationId_featureId: {
            organizationId,
            featureId: feature.id,
          },
        },
        update: {
          enabled,
          updatedAt: new Date(),
        },
        create: {
          id: `org_feature_${randomUUID().slice(0, 10)}`,
          organizationId,
          featureId: feature.id,
          enabled,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    await Promise.all(updatePromises);

    await prisma.organizationFeature.updateMany({
      where: {
        organizationId,
        featureId: { notIn: availableFeatureIds },
      },
      data: {
        enabled: false,
        updatedAt: new Date(),
      },
    });
  }
}
