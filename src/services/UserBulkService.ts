import { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID, randomBytes } from 'crypto';
import { prisma } from '@/shared/database/prisma';
import { mailService } from '@/services/MailService';

export interface BulkUserRow {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone?: string;
}

type BulkUserResult = {
  email: string;
  status: 'created' | 'skipped';
};

function mapBulkRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase();

  if (normalized === 'manager') {
    return UserRole.MANAGER;
  }

  if (normalized === 'admin') {
    return UserRole.ADMIN;
  }

  return UserRole.WORKER;
}

export class UserBulkService {
  async createBulk(organizationId: string, users: BulkUserRow[]) {
    const CHUNK_SIZE = 100;
    const results: BulkUserResult[] = [];

    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE).map((row) => ({
        ...row,
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        email: row.email.trim().toLowerCase(),
      }));

      const duplicateEmailsInChunk = new Set<string>();
      const uniqueChunkEmails: string[] = [];
      for (const row of chunk) {
        if (duplicateEmailsInChunk.has(row.email)) {
          continue;
        }
        duplicateEmailsInChunk.add(row.email);
        uniqueChunkEmails.push(row.email);
      }

      const existingInDb = await prisma.user.findMany({
        where: {
          OR: uniqueChunkEmails.map((email) => ({
            email: { equals: email, mode: 'insensitive' },
          })),
        },
        select: { email: true },
      });

      const existingEmails = new Set(existingInDb.map((user) => user.email.toLowerCase()));
      const createdEmails = new Set<string>();

      for (const row of chunk) {
        if (createdEmails.has(row.email) || existingEmails.has(row.email)) {
          results.push({ email: row.email, status: 'skipped' });
          continue;
        }

        const tempPassword = randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        await prisma.user.create({
          data: {
            id: randomUUID(),
            email: row.email,
            passwordHash,
            pinHash: null,
            invitationToken: null,
            tokenExpires: null,
            status: UserStatus.ACTIVE,
            mustResetPw: true,
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone?.trim() || null,
            role: mapBulkRole(row.role),
            organizationId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        createdEmails.add(row.email);

        mailService
          .sendUserInviteEmail({
            organizationId,
            user_name: `${row.first_name} ${row.last_name}`.trim(),
            user_email: row.email,
            temp_password: tempPassword,
          })
          .catch((error) => console.error('[UserBulkService] invite email', error));

        results.push({ email: row.email, status: 'created' });
      }
    }

    return {
      total: users.length,
      created: results.filter((row) => row.status === 'created').length,
      skipped: results.filter((row) => row.status === 'skipped').length,
      detail: results,
    };
  }
}

export const userBulkService = new UserBulkService();
