-- Add missing updated timestamps for integrity and auditability.
ALTER TABLE "audit_access_logs"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "security_logs"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "discount_redemptions"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "invoice_line_items"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "support_notes"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Helpers used by RLS policies.
CREATE OR REPLACE FUNCTION bloom_rls_bypass() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), 'off') = 'on';
$$;

CREATE OR REPLACE FUNCTION bloom_current_tenant() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '');
$$;

-- Organization-scoped RLS policies.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_organization" ON "Organization";
CREATE POLICY "tenant_isolation_organization" ON "Organization"
  USING (bloom_rls_bypass() OR "id" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "id" = bloom_current_tenant());

ALTER TABLE "OrganizationFeature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationFeature" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_organization_feature" ON "OrganizationFeature";
CREATE POLICY "tenant_isolation_organization_feature" ON "OrganizationFeature"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_users" ON "users";
CREATE POLICY "tenant_isolation_users" ON "users"
  USING (
    bloom_rls_bypass()
    OR ("organizationId" IS NOT NULL AND "organizationId" = bloom_current_tenant())
  )
  WITH CHECK (
    bloom_rls_bypass()
    OR ("organizationId" IS NOT NULL AND "organizationId" = bloom_current_tenant())
  );

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_clients" ON "clients";
CREATE POLICY "tenant_isolation_clients" ON "clients"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_assignments" ON "assignments";
CREATE POLICY "tenant_isolation_assignments" ON "assignments"
  USING (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "clients" c
      WHERE c."id" = "assignments"."clientId"
        AND c."organizationId" = bloom_current_tenant()
    )
  )
  WITH CHECK (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "clients" c
      WHERE c."id" = "assignments"."clientId"
        AND c."organizationId" = bloom_current_tenant()
    )
  );

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_tasks" ON "tasks";
CREATE POLICY "tenant_isolation_tasks" ON "tasks"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "task_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_completions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_task_completions" ON "task_completions";
CREATE POLICY "tenant_isolation_task_completions" ON "task_completions"
  USING (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "tasks" t
      WHERE t."id" = "task_completions"."taskId"
        AND t."organizationId" = bloom_current_tenant()
    )
  )
  WITH CHECK (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "tasks" t
      WHERE t."id" = "task_completions"."taskId"
        AND t."organizationId" = bloom_current_tenant()
    )
  );

ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_notes" ON "notes";
CREATE POLICY "tenant_isolation_notes" ON "notes"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_files" ON "files";
CREATE POLICY "tenant_isolation_files" ON "files"
  USING (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "clients" c
      WHERE c."id" = "files"."clientId"
        AND c."organizationId" = bloom_current_tenant()
    )
  )
  WITH CHECK (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "clients" c
      WHERE c."id" = "files"."clientId"
        AND c."organizationId" = bloom_current_tenant()
    )
  );

ALTER TABLE "audit_access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_access_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_audit_access_logs" ON "audit_access_logs";
CREATE POLICY "tenant_isolation_audit_access_logs" ON "audit_access_logs"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "security_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_security_logs" ON "security_logs";
CREATE POLICY "tenant_isolation_security_logs" ON "security_logs"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_subscriptions" ON "subscriptions";
CREATE POLICY "tenant_isolation_subscriptions" ON "subscriptions"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "discount_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_redemptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_discount_redemptions" ON "discount_redemptions";
CREATE POLICY "tenant_isolation_discount_redemptions" ON "discount_redemptions"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_invoices" ON "invoices";
CREATE POLICY "tenant_isolation_invoices" ON "invoices"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_invoice_line_items" ON "invoice_line_items";
CREATE POLICY "tenant_isolation_invoice_line_items" ON "invoice_line_items"
  USING (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "invoices" i
      WHERE i."id" = "invoice_line_items"."invoiceId"
        AND i."organizationId" = bloom_current_tenant()
    )
  )
  WITH CHECK (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "invoices" i
      WHERE i."id" = "invoice_line_items"."invoiceId"
        AND i."organizationId" = bloom_current_tenant()
    )
  );

ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_support_tickets" ON "support_tickets";
CREATE POLICY "tenant_isolation_support_tickets" ON "support_tickets"
  USING (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant())
  WITH CHECK (bloom_rls_bypass() OR "organizationId" = bloom_current_tenant());

ALTER TABLE "support_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_notes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_support_notes" ON "support_notes";
CREATE POLICY "tenant_isolation_support_notes" ON "support_notes"
  USING (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "support_tickets" st
      WHERE st."id" = "support_notes"."ticketId"
        AND st."organizationId" = bloom_current_tenant()
    )
  )
  WITH CHECK (
    bloom_rls_bypass()
    OR EXISTS (
      SELECT 1
      FROM "support_tickets" st
      WHERE st."id" = "support_notes"."ticketId"
        AND st."organizationId" = bloom_current_tenant()
    )
  );
