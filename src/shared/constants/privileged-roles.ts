import { UserRole } from '@prisma/client';

export const PRIVILEGED_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ORG_OWNER,
  UserRole.SUPER_ADMIN,
] as const;

export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

const PRIVILEGED_ROLE_SET = new Set<UserRole>(PRIVILEGED_ROLES);

export const isPrivilegedRole = (role?: UserRole): role is PrivilegedRole =>
  !!role && PRIVILEGED_ROLE_SET.has(role);
