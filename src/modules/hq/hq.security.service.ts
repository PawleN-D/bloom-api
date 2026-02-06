import { prisma } from '../../shared/database/prisma';

type SecurityLogFilters = {
  organizationId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export class HQSecurityService {
  async listSecurityLogs(filters: SecurityLogFilters) {
    const { organizationId, userId, action, startDate, endDate, limit } = filters;
    const where: any = {
      organizationId: organizationId || undefined,
      userId: userId || undefined,
      action: action ? { contains: action, mode: 'insensitive' } : undefined,
      createdAt: {},
    };

    if (startDate) {
      (where.createdAt as any).gte = new Date(startDate);
    }
    if (endDate) {
      (where.createdAt as any).lte = new Date(endDate);
    }

    if (Object.keys(where.createdAt).length === 0) {
      delete where.createdAt;
    }

    return prisma.securityLog.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 100,
    });
  }
}
