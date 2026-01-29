/*
  Warnings:

  - You are about to drop the column `customFields` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `users` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `OrganizationSetting` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('WORKER', 'ADMIN', 'MANAGER', 'ORG_OWNER', 'SUPER_ADMIN');

-- DropForeignKey
ALTER TABLE "OrganizationSetting" DROP CONSTRAINT "OrganizationSetting_organizationId_fkey";

-- DropIndex
DROP INDEX "Organization_subdomain_idx";

-- AlterTable
ALTER TABLE "Feature" ALTER COLUMN "availableInPlans" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrganizationFeature" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clients" DROP COLUMN "customFields";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar",
DROP COLUMN "emailVerified",
DROP COLUMN "lastLoginAt",
DROP COLUMN "metadata",
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'WORKER';

-- DropTable
DROP TABLE "OrganizationSetting";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "SettingType";

-- RenameIndex
ALTER INDEX "OrganizationFeature_organizationId_featureId_unique" RENAME TO "OrganizationFeature_organizationId_featureId_key";
