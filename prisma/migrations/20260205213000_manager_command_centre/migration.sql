-- Add DBS/Training expiry tracking fields
ALTER TABLE "users" ADD COLUMN "dbsExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "trainingExpiresAt" TIMESTAMP(3);

-- Add performance indexes for manager dashboard queries
CREATE INDEX "users_dbsExpiresAt_idx" ON "users"("dbsExpiresAt");
CREATE INDEX "users_trainingExpiresAt_idx" ON "users"("trainingExpiresAt");

CREATE INDEX "task_completions_completedAt_idx" ON "task_completions"("completedAt");
CREATE INDEX "task_completions_completedBy_completedAt_idx" ON "task_completions"("completedBy", "completedAt");

CREATE INDEX "notes_authorId_createdAt_idx" ON "notes"("authorId", "createdAt");
CREATE INDEX "notes_clientId_createdAt_idx" ON "notes"("clientId", "createdAt");
