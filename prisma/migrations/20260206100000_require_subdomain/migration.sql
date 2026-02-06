-- Backfill subdomain using slug for existing rows
UPDATE "Organization" SET "subdomain" = "slug" WHERE "subdomain" IS NULL;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "subdomain" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Organization_subdomain_idx" ON "Organization"("subdomain");
