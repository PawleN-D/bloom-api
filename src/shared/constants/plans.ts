import { SubscriptionPlan } from '@prisma/client';

export type PlanDefinition = {
  priceCents: number;
  maxUsers: number;
  maxClients: number;
  currency: string;
};

export const PLAN_CATALOG: Record<SubscriptionPlan, PlanDefinition> = {
  FREE: { priceCents: 0, maxUsers: 5, maxClients: 25, currency: 'USD' },
  STARTER: { priceCents: 9900, maxUsers: 10, maxClients: 50, currency: 'USD' },
  PROFESSIONAL: { priceCents: 29900, maxUsers: 25, maxClients: 150, currency: 'USD' },
  ENTERPRISE: { priceCents: 79900, maxUsers: 100, maxClients: 500, currency: 'USD' },
};

export const DEFAULT_BILLING_CYCLE_DAYS = 30;
