/*
  Warnings:

  - You are about to drop the column `assignedAt` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the column `assignedBy` on the `assignments` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedAt` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedBy` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `tasks` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `files` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_clientId_fkey";

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_userId_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_clientId_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_clientId_fkey";

-- DropForeignKey
ALTER TABLE "task_completions" DROP CONSTRAINT "task_completions_taskId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_clientId_fkey";

-- DropIndex
DROP INDEX "assignments_isActive_idx";

-- DropIndex
DROP INDEX "clients_isActive_idx";

-- DropIndex
DROP INDEX "clients_lastName_firstName_idx";

-- DropIndex
DROP INDEX "files_uploadedAt_idx";

-- DropIndex
DROP INDEX "notes_category_idx";

-- DropIndex
DROP INDEX "task_completions_completedAt_idx";

-- DropIndex
DROP INDEX "tasks_category_idx";

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "assignedAt",
DROP COLUMN "assignedBy",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "files" DROP COLUMN "uploadedAt",
DROP COLUMN "uploadedBy",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "notes" ALTER COLUMN "category" SET DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "task_completions" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "createdBy";

-- CreateIndex
CREATE INDEX "clients_lastName_idx" ON "clients"("lastName");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
