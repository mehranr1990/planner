-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('OPEN', 'COMPLETED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "milestone_id" TEXT;

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_on" DATE,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ(3),
    "sort_order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_project_id_sort_order_idx" ON "milestones"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "milestones_project_id_due_on_idx" ON "milestones"("project_id", "due_on");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
