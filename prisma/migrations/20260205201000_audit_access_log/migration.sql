-- CreateEnum
CREATE TYPE "AuditAccessStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "audit_access_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "status" "AuditAccessStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_access_logs_organizationId_idx" ON "audit_access_logs"("organizationId");
CREATE INDEX "audit_access_logs_residentId_idx" ON "audit_access_logs"("residentId");
CREATE INDEX "audit_access_logs_managerId_idx" ON "audit_access_logs"("managerId");
CREATE INDEX "audit_access_logs_createdAt_idx" ON "audit_access_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "audit_access_logs" ADD CONSTRAINT "audit_access_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_access_logs" ADD CONSTRAINT "audit_access_logs_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_access_logs" ADD CONSTRAINT "audit_access_logs_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
