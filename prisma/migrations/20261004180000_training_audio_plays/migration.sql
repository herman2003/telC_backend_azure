-- CreateTable
CREATE TABLE "training_audio_plays" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "audio_id" UUID NOT NULL,
    "plays_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_audio_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_audio_plays_student_id_audio_id_key" ON "training_audio_plays"("student_id", "audio_id");

-- AddForeignKey
ALTER TABLE "training_audio_plays" ADD CONSTRAINT "training_audio_plays_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_audio_plays" ADD CONSTRAINT "training_audio_plays_audio_id_fkey" FOREIGN KEY ("audio_id") REFERENCES "listening_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
