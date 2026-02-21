import Fastify from 'fastify';
import { authRoutes } from './auth.routes';
import { createOrganization } from '../../../tests/helpers';

describe('Auth Routes Security', () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])(
    'rejects unauthenticated self-registration for privileged role %s',
    async (role) => {
      const org = await createOrganization({ name: `Org ${role}` });
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `${role.toLowerCase()}-blocked@test.com`,
          password: 'SecurePass123!',
          firstName: 'Blocked',
          lastName: 'Role',
          role,
          organizationId: org.id,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        success: false,
        error: 'This role requires an invitation',
      });
    }
  );
});
