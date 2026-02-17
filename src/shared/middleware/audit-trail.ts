import { AuditOperation } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { prisma } from '../database/prisma';

type DiffValue = {
  before: unknown;
  after: unknown;
};

export type FieldDiff = Record<string, DiffValue>;

const normalizeForDiff = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForDiff(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, item]) => {
        acc[key] = normalizeForDiff(item);
        return acc;
      },
      {}
    );
  }

  return value;
};

const valuesEqual = (before: unknown, after: unknown) =>
  JSON.stringify(normalizeForDiff(before)) === JSON.stringify(normalizeForDiff(after));

export const computeFieldDiff = (
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options?: { onlyKeys?: string[]; excludeKeys?: string[] }
): FieldDiff => {
  const beforeSafe = before || {};
  const afterSafe = after || {};
  const onlyKeys = options?.onlyKeys ? new Set(options.onlyKeys) : null;
  const excludeKeys = new Set(options?.excludeKeys || []);

  const allKeys = new Set([...Object.keys(beforeSafe), ...Object.keys(afterSafe)]);
  const diff: FieldDiff = {};

  for (const key of allKeys) {
    if (onlyKeys && !onlyKeys.has(key)) continue;
    if (excludeKeys.has(key)) continue;

    const beforeValue = beforeSafe[key];
    const afterValue = afterSafe[key];
    if (valuesEqual(beforeValue, afterValue)) continue;

    diff[key] = {
      before: normalizeForDiff(beforeValue),
      after: normalizeForDiff(afterValue),
    };
  }

  return diff;
};

export async function logAuditEvent(
  request: FastifyRequest,
  params: {
    operation: AuditOperation;
    entityType: string;
    entityId: string;
    fieldChanges?: FieldDiff;
    reason?: string;
    organizationId?: string | null;
    userId?: string | null;
  }
) {
  const userId = params.userId ?? request.user?.id ?? null;
  const organizationId =
    params.organizationId ??
    request.organization?.id ??
    request.user?.organizationId ??
    null;

  if (!userId || !organizationId) {
    return;
  }

  const forwardedFor = request.headers?.['x-forwarded-for'];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor as string | undefined)?.split(',')[0]?.trim() || request.ip || null;
  const userAgent = (request.headers?.['user-agent'] as string) || null;
  const fieldChanges =
    params.fieldChanges && Object.keys(params.fieldChanges).length > 0
      ? params.fieldChanges
      : undefined;

  await prisma.auditEvent.create({
    data: {
      organizationId,
      userId,
      entityType: params.entityType,
      entityId: params.entityId,
      operation: params.operation,
      fieldChanges,
      reason: params.reason || null,
      ipAddress,
      userAgent,
      requestId: request.id || null,
      createdAt: new Date(),
    },
  });
}
