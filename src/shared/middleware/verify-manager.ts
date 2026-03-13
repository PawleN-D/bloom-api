import { FastifyRequest, FastifyReply } from '@/shared/http/compat';
import { isPrivilegedRole } from '../constants/privileged-roles';

export async function verifyManager(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user;

  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (!isPrivilegedRole(user.role)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Manager or Admin role required',
    });
  }
}
