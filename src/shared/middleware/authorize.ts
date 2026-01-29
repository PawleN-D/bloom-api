import { FastifyRequest, FastifyReply } from 'fastify';

export enum Permission {
  // User management
  CREATE_USER = 'create:user',
  READ_USER = 'read:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',
  MANAGE_ROLES = 'manage:roles',
  
  // Organization management
  UPDATE_ORG = 'update:organization',
  MANAGE_BILLING = 'manage:billing',
  MANAGE_FEATURES = 'manage:features',
  
  // Client management
  CREATE_CLIENT = 'create:client',
  READ_CLIENT = 'read:client',
  UPDATE_CLIENT = 'update:client',
  DELETE_CLIENT = 'delete:client',
  
  // Task management
  CREATE_TASK = 'create:task',
  READ_TASK = 'read:task',
  UPDATE_TASK = 'update:task',
  DELETE_TASK = 'delete:task',
  ASSIGN_TASK = 'assign:task',
  COMPLETE_TASK = 'complete:task',
  
  // Note management
  CREATE_NOTE = 'create:note',
  READ_NOTE = 'read:note',
  UPDATE_NOTE = 'update:note',
  DELETE_NOTE = 'delete:note',
}

type Role = 'SUPER_ADMIN' | 'ORG_OWNER' | 'ADMIN' | 'MANAGER' | 'WORKER';

const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission), // All permissions
  
  ORG_OWNER: [
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.MANAGE_ROLES,
    Permission.UPDATE_ORG,
    Permission.MANAGE_BILLING,
    Permission.MANAGE_FEATURES,
    Permission.CREATE_CLIENT,
    Permission.READ_CLIENT,
    Permission.UPDATE_CLIENT,
    Permission.DELETE_CLIENT,
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
    Permission.ASSIGN_TASK,
    Permission.COMPLETE_TASK,
    Permission.CREATE_NOTE,
    Permission.READ_NOTE,
    Permission.UPDATE_NOTE,
    Permission.DELETE_NOTE,
  ],
  
  ADMIN: [
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.CREATE_CLIENT,
    Permission.READ_CLIENT,
    Permission.UPDATE_CLIENT,
    Permission.DELETE_CLIENT,
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
    Permission.ASSIGN_TASK,
    Permission.COMPLETE_TASK,
    Permission.CREATE_NOTE,
    Permission.READ_NOTE,
    Permission.UPDATE_NOTE,
    Permission.DELETE_NOTE,
  ],
  
  MANAGER: [
    Permission.READ_USER,
    Permission.CREATE_CLIENT,
    Permission.READ_CLIENT,
    Permission.UPDATE_CLIENT,
    Permission.DELETE_CLIENT,
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
    Permission.ASSIGN_TASK,
    Permission.COMPLETE_TASK,
    Permission.CREATE_NOTE,
    Permission.READ_NOTE,
    Permission.UPDATE_NOTE,
    Permission.DELETE_NOTE,
  ],
  
  WORKER: [
    Permission.READ_USER,
    Permission.READ_CLIENT,
    Permission.READ_TASK,
    Permission.COMPLETE_TASK,
    Permission.CREATE_NOTE,
    Permission.READ_NOTE,
    Permission.UPDATE_NOTE,
  ],
};

/**
 * Authorization middleware
 * Checks if user has required permissions
 */
export function authorize(...permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
    
    const userPermissions = rolePermissions[user.role as Role];
    
    if (!userPermissions) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid role',
      });
    }
    
    const hasPermission = permissions.some(p => userPermissions.includes(p));
    
    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }
  };
}

/**
 * Helper: Check if actor can manage target user
 */
export function canManageUser(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'ORG_OWNER' && targetRole !== 'SUPER_ADMIN') return true;
  if (actorRole === 'ADMIN' && ['MANAGER', 'WORKER'].includes(targetRole)) return true;
  return false;
}