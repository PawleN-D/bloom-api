DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureCategory" AS ENUM ('CORE', 'COMPLIANCE', 'AI', 'ADVANCED', 'INTEGRATIONS', 'ENTERPRISE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN

  CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_OWNER', 'ADMIN', 'MANAGER', 'WORKER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


ALTER TABLE "users" 
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING (
    CASE 
      WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"Role"
      WHEN "role"::text = 'WORKER' THEN 'WORKER'::"Role"
      ELSE 'WORKER'::"Role"
    END
  ),
  ALTER COLUMN "role" SET DEFAULT 'WORKER'::"Role";


DROP TYPE IF EXISTS "UserRole";

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "subdomain" TEXT UNIQUE,
    "logo" TEXT,
    "primaryColor" TEXT DEFAULT '#0F766E',
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER',
    "billingEmail" TEXT,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxClients" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Feature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "FeatureCategory" NOT NULL,
    "availableInPlans" "SubscriptionPlan"[] DEFAULT ARRAY[]::"SubscriptionPlan"[],
    "betaFeature" BOOLEAN NOT NULL DEFAULT false,
    "comingSoon" BOOLEAN NOT NULL DEFAULT false,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OrganizationFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationFeature_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationFeature_featureId_fkey" 
        FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationFeature_organizationId_featureId_unique" 
        UNIQUE ("organizationId", "featureId")
);

CREATE TABLE IF NOT EXISTS "OrganizationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "SettingType" NOT NULL,
    CONSTRAINT "OrganizationSetting_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationSetting_organizationId_key_unique" 
        UNIQUE ("organizationId", "key")
);


INSERT INTO "Organization" (id, name, slug, plan, active)
VALUES ('org_default', 'Default Organization', 'default', 'STARTER', true)
ON CONFLICT (id) DO NOTHING;


ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" TEXT;


UPDATE "users" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "customFields" JSONB;


UPDATE "clients" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;


ALTER TABLE "clients" ALTER COLUMN "organizationId" SET NOT NULL;


DO $$ BEGIN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;


UPDATE "tasks" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;


ALTER TABLE "tasks" ALTER COLUMN "organizationId" SET NOT NULL;


DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;


UPDATE "notes" SET "organizationId" = 'org_default' WHERE "organizationId" IS NULL;


ALTER TABLE "notes" ALTER COLUMN "organizationId" SET NOT NULL;


DO $$ BEGIN
  ALTER TABLE "notes" ADD CONSTRAINT "notes_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 16: Create indexes
CREATE INDEX IF NOT EXISTS "Organization_slug_idx" ON "Organization"("slug");
CREATE INDEX IF NOT EXISTS "Organization_subdomain_idx" ON "Organization"("subdomain");
CREATE INDEX IF NOT EXISTS "Organization_active_idx" ON "Organization"("active");

CREATE INDEX IF NOT EXISTS "Feature_key_idx" ON "Feature"("key");
CREATE INDEX IF NOT EXISTS "Feature_category_idx" ON "Feature"("category");

CREATE INDEX IF NOT EXISTS "OrganizationFeature_organizationId_idx" ON "OrganizationFeature"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationFeature_featureId_idx" ON "OrganizationFeature"("featureId");

CREATE INDEX IF NOT EXISTS "OrganizationSetting_organizationId_idx" ON "OrganizationSetting"("organizationId");

CREATE INDEX IF NOT EXISTS "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX IF NOT EXISTS "clients_organizationId_idx" ON "clients"("organizationId");
CREATE INDEX IF NOT EXISTS "tasks_organizationId_idx" ON "tasks"("organizationId");
CREATE INDEX IF NOT EXISTS "notes_organizationId_idx" ON "notes"("organizationId");