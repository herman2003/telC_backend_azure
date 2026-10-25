-- AlterTable
ALTER TABLE "students" ADD COLUMN "pending_email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "students_pending_email_key" ON "students"("pending_email");
