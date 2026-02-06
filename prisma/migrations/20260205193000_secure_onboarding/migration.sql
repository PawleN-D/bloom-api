-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE');

-- Users: rename password -> passwordHash and add invitation fields
ALTER TABLE "users" RENAME COLUMN "password" TO "passwordHash";
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "users" ADD COLUMN "invitationToken" TEXT;
ALTER TABLE "users" ADD COLUMN "tokenExpires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "users" SET "status" = 'ACTIVE' WHERE "status" <> 'ACTIVE';

CREATE UNIQUE INDEX "users_invitationToken_key" ON "users"("invitationToken");

-- Task completions: immutable audit trail
ALTER TABLE "task_completions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "task_completions" ADD COLUMN "parentLogId" TEXT;
ALTER TABLE "task_completions" ADD COLUMN "editReason" TEXT;
ALTER TABLE "task_completions" ADD COLUMN "metadata" JSONB;
ALTER TABLE "task_completions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "task_completions" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

CREATE INDEX "task_completions_parentLogId_idx" ON "task_completions"("parentLogId");
ALTER TABLE "task_completions"
  ADD CONSTRAINT "task_completions_parentLogId_fkey"
  FOREIGN KEY ("parentLogId") REFERENCES "task_completions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Notes: rename versioning columns
ALTER TABLE "notes" RENAME COLUMN "parentId" TO "parentLogId";
ALTER TABLE "notes" RENAME COLUMN "versionNumber" TO "version";
ALTER INDEX "notes_parentId_idx" RENAME TO "notes_parentLogId_idx";
ALTER TABLE "notes" RENAME CONSTRAINT "notes_parentId_fkey" TO "notes_parentLogId_fkey";
