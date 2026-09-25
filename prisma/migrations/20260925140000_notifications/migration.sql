-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('EXAM_PUBLISHED', 'EXAM_RESULT_RELEASED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_student_id_read_at_created_at_idx" ON "notifications"("student_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

