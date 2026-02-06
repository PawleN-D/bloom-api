import {
  NoteCategory,
  SubscriptionStatus,
  TaskCompletionStatus,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { PLAN_CATALOG } from '../../shared/constants/plans';

type DateRange = { start: Date; end: Date };

export class HQAnalyticsService {
  private buildRange(startDate?: string, endDate?: string): DateRange {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date range');
    }

    if (start > end) {
      throw new Error('Invalid date range');
    }

    return { start, end };
  }

  async getOverview(startDate?: string, endDate?: string) {
    const range = this.buildRange(startDate, endDate);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
        },
      },
      include: {
        discount: true,
      },
    });

    const mrrCents = subscriptions.reduce((total, subscription) => {
      const planPrice = subscription.priceCents || PLAN_CATALOG[subscription.plan].priceCents;
      let effectivePrice = planPrice;
      if (subscription.discount && planPrice > 0) {
        effectivePrice =
          subscription.discount.type === 'PERCENT'
            ? Math.round((planPrice * (100 - subscription.discount.value)) / 100)
            : Math.max(planPrice - subscription.discount.value, 0);
      }
      return total + effectivePrice;
    }, 0);

    const arrCents = mrrCents * 12;

    const [newOrganizations, canceledSubscriptions, startingActiveCount] = await Promise.all([
      prisma.organization.count({
        where: {
          createdAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          cancelRequestedAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            lt: range.start,
          },
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
          },
        },
      }),
    ]);

    const churnRate =
      startingActiveCount === 0
        ? 0
        : Math.round((canceledSubscriptions / startingActiveCount) * 100);

    const revenueByPlan = subscriptions.reduce<Record<string, number>>((acc, subscription) => {
      const planPrice = subscription.priceCents || PLAN_CATALOG[subscription.plan].priceCents;
      acc[subscription.plan] = (acc[subscription.plan] || 0) + planPrice;
      return acc;
    }, {});

    const features = await prisma.feature.findMany({
      select: { id: true, key: true },
    });

    const orgCount = await prisma.organization.count();

    const featureAdoption = await Promise.all(
      features.map(async (feature) => {
        const enabledCount = await prisma.organizationFeature.count({
          where: {
            featureId: feature.id,
            enabled: true,
          },
        });

        return {
          featureKey: feature.key,
          enabledCount,
          adoptionRate: orgCount === 0 ? 0 : Math.round((enabledCount / orgCount) * 100),
        };
      })
    );

    return {
      range,
      mrrCents,
      arrCents,
      churnRate,
      newOrganizations,
      canceledSubscriptions,
      revenueByPlan,
      featureAdoption,
    };
  }

  async getHealthScores(windowDays = 7) {
    const end = new Date();
    const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
      },
    });

    const scores = [];

    for (const org of organizations) {
      const [taskLogs, incidentNotes] = await Promise.all([
        prisma.taskCompletion.findMany({
          where: {
            task: { organizationId: org.id },
            completedAt: { gte: start, lte: end },
          },
          select: {
            status: true,
          },
        }),
        prisma.note.count({
          where: {
            organizationId: org.id,
            category: NoteCategory.INCIDENT,
            createdAt: { gte: start, lte: end },
          },
        }),
      ]);

      const totalLogs = taskLogs.length;
      const completedLogs = taskLogs.filter(
        (log) => log.status === TaskCompletionStatus.COMPLETE
      ).length;

      const completionRate = totalLogs === 0 ? 100 : Math.round((completedLogs / totalLogs) * 100);
      const incidentPenalty = Math.min(incidentNotes * 10, 100);
      const incidentScore = 100 - incidentPenalty;
      const healthScore = Math.max(
        0,
        Math.round(completionRate * 0.7 + incidentScore * 0.3)
      );

      scores.push({
        organizationId: org.id,
        organizationName: org.name,
        subscriptionStatus: org.subscriptionStatus,
        completionRate,
        incidentCount: incidentNotes,
        healthScore,
      });
    }

    scores.sort((a, b) => b.healthScore - a.healthScore);

    return {
      window: { start, end },
      scores,
    };
  }
}
