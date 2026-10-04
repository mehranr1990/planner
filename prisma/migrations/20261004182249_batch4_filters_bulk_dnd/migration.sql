-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_STATUS_CHANGED_BULK';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_DUE_DATE_CHANGED_BULK';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_ASSIGNED_BULK';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_UNBLOCKED_BULK';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "tasks_owner_id_scope_sort_order_idx" ON "tasks"("owner_id", "scope", "sort_order");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_sort_order_idx" ON "tasks"("workspace_id", "sort_order");
