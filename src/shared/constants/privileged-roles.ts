import { UserRole } from '@prisma/client';

export const PRIVILEGED_ROLES = [UserRole.ADMIN, UserRole.MANAGER] as const;

export const isPrivilegedRole = (role?: UserRole) =>
  role ? PRIVILEGED_ROLES.includes(role) : false;
