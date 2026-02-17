-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('MEDICATION_ERROR', 'FALL', 'INJURY', 'SAFEGUARDING', 'MISSED_CARE', 'EQUIPMENT_FAILURE', 'COMMUNICATION_BREAKDOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ComplianceAlertType" AS ENUM ('INCIDENT_SLA_BREACH', 'CERTIFICATION_EXPIRING', 'CARE_PLAN_STALE', 'CRITICAL_TASK_EXCEPTION');

-- CreateEnum
CREATE TYPE "ComplianceAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplianceAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MedicationRoute" AS ENUM ('ORAL', 'SUBLINGUAL', 'TOPICAL', 'INJECTION', 'INHALED', 'RECTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('SCHEDULED', 'ADMINISTERED', 'REFUSED', 'OMITTED', 'DELAYED');

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "deletedReason" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "deletedReason" TEXT;

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "reportedById" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "preventiveActions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" "AuditOperation" NOT NULL,
    "fieldChanges" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ComplianceAlertType" NOT NULL,
    "severity" "ComplianceAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ComplianceAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "compliance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_administrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "administeredById" TEXT,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" "MedicationRoute" NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "administeredTime" TIMESTAMP(3),
    "status" "MedicationStatus" NOT NULL,
    "refusalReason" TEXT,
    "omissionReason" TEXT,
    "lateAdministration" BOOLEAN NOT NULL DEFAULT false,
    "doubleCheckRequired" BOOLEAN NOT NULL DEFAULT false,
    "doubleCheckedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_organizationId_status_reportedAt_idx" ON "incidents"("organizationId", "status", "reportedAt");

-- CreateIndex
CREATE INDEX "incidents_organizationId_severity_status_idx" ON "incidents"("organizationId", "severity", "status");

-- CreateIndex
CREATE INDEX "incidents_slaDueAt_idx" ON "incidents"("slaDueAt");

-- CreateIndex
CREATE INDEX "audit_events_organizationId_entityType_entityId_idx" ON "audit_events"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_organizationId_userId_createdAt_idx" ON "audit_events"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "compliance_alerts_organizationId_status_createdAt_idx" ON "compliance_alerts"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "compliance_alerts_organizationId_type_createdAt_idx" ON "compliance_alerts"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "compliance_alerts_entityType_entityId_idx" ON "compliance_alerts"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "medication_administrations_organizationId_clientId_schedule_idx" ON "medication_administrations"("organizationId", "clientId", "scheduledTime");

-- CreateIndex
CREATE INDEX "medication_administrations_organizationId_status_idx" ON "medication_administrations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "notes_organizationId_deletedAt_idx" ON "notes"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "tasks_organizationId_deletedAt_idx" ON "tasks"("organizationId", "deletedAt");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_doubleCheckedBy_fkey" FOREIGN KEY ("doubleCheckedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
