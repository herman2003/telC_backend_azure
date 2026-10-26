-- The schema, from nothing.
--
-- WHY A BASELINE. The 73 migrations this replaces could not build a database.
-- `migrate deploy` against an empty one failed at the ninth,
-- 20260502000000_add_auth_columns, which references `oauth_accounts` — a table
-- nothing in the chain creates. It came from the Supabase era, before Prisma
-- owned the schema. That migration opens with its own confession:
--
--   "NOTE: This migration was partially applied in a previous attempt.
--    Only the remaining statements are included here."
--
-- It was hand-edited to match one database's state, and from that day the
-- history was a log of what had been done to a server rather than a recipe for
-- building the schema. Nobody found out for five months, because every database
-- that mattered already existed and nothing ever tried to make a new one.
--
-- Generated with `prisma migrate diff --from-empty --to-schema`, so it is the
-- schema in prisma/schema.prisma and nothing else. Verified: zero drift against
-- the live test branch, and the full integration suite — 335 tests — passes
-- against a database built from this file plus the content beside it.
--
-- The old migrations are deleted, not kept: left in place they would run after
-- this one and fail on tables that already exist. Git has them.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CenterPlan" AS ENUM ('TRIAL', 'PAID');

-- CreateEnum
CREATE TYPE "CenterUserRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "AiOperation" AS ENUM ('SPEAKING_EVALUATION', 'SPEAKING_LIVE_SESSION');

-- CreateEnum
CREATE TYPE "ActivationCodeStatus" AS ENUM ('ACTIVATED', 'CONNECTED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "EntitlementProduct" AS ENUM ('PREP_PASS', 'AI_SPEAKING_CREDIT', 'AI_ASSISTED_LEARNING');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SEATS', 'EXAM_SLOTS', 'EXAM_SLOTS_AI', 'PREP_PASS', 'AI_SPEAKING_CREDIT', 'AI_ASSISTED_LEARNING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('HOEREN', 'LESEN', 'SPRACHBAUSTEINE', 'SCHREIBEN', 'SPRECHEN');

-- CreateEnum
CREATE TYPE "SupportRequestKind" AS ENUM ('CONTACT', 'ACCOUNT_DELETION');

-- CreateEnum
CREATE TYPE "ExamGradingTier" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "ExamBlock" AS ENUM ('LESEN_SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN');

-- CreateEnum
CREATE TYPE "ExamPart" AS ENUM ('WRITTEN', 'ORAL');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('EXAM_PUBLISHED', 'EXAM_RESULT_RELEASED');

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "email_verification_expires" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "phone" TEXT,
    "center_id" TEXT,
    "grandfathered_access" BOOLEAN NOT NULL DEFAULT false,
    "level" "CefrLevel",

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_name" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "country_code" TEXT,
    "region_id" TEXT,
    "city_id" TEXT,
    "city_other" TEXT,
    "district" TEXT,
    "postal_code" TEXT,
    "street" TEXT,
    "house_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exam_slots_remaining" INTEGER NOT NULL DEFAULT 0,
    "exam_ai_slots_remaining" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_subscriptions" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "plan" "CenterPlan" NOT NULL DEFAULT 'TRIAL',
    "trial_started_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "paid_until" TIMESTAMP(3),
    "anchor_day" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "center_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_seats" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_xaf" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "center_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activation_codes" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'ACTIVATED',
    "student_id" TEXT,
    "linked_name" TEXT,
    "linked_email" TEXT,
    "connected_at" TIMESTAMP(3),
    "connected_ip" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_entitlement_pools" (
    "center_id" TEXT NOT NULL,
    "product" "EntitlementProduct" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "center_entitlement_pools_pkey" PRIMARY KEY ("center_id","product")
);

-- CreateTable
CREATE TABLE "code_entitlement_caps" (
    "code_id" TEXT NOT NULL,
    "product" "EntitlementProduct" NOT NULL,
    "cap" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_entitlement_caps_pkey" PRIMARY KEY ("code_id","product")
);

-- CreateTable
CREATE TABLE "code_entitlements" (
    "code_id" TEXT NOT NULL,
    "product" "EntitlementProduct" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_entitlements_pkey" PRIMARY KEY ("code_id","product")
);

-- CreateTable
CREATE TABLE "activation_code_events" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "center_user_id" TEXT,
    "from_status" "ActivationCodeStatus" NOT NULL,
    "to_status" "ActivationCodeStatus" NOT NULL,
    "student_id" TEXT,
    "previous_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_code_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'SEATS',
    "quantity" INTEGER NOT NULL,
    "unit_price_xaf" INTEGER NOT NULL,
    "amount_xaf" INTEGER NOT NULL,
    "amount_net_xaf" INTEGER,
    "vat_amount_xaf" INTEGER,
    "renews_period" BOOLEAN NOT NULL DEFAULT true,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reference" TEXT,
    "checkout_url" TEXT,
    "provider" TEXT,
    "succeeded_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_users" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "role" "CenterUserRole" NOT NULL DEFAULT 'OWNER',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country_code" TEXT,
    "region_id" TEXT,
    "city_id" TEXT,
    "city_other" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password_hash" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "email_verification_expires" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),

    CONSTRAINT "center_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_device_sessions" (
    "id" TEXT NOT NULL,
    "center_user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_name" TEXT,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "center_device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_attempts" (
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "modelltest_id" UUID,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "score" INTEGER,
    "feedback" TEXT,
    "corrected_text" TEXT,
    "corrections" JSONB,
    "diff" JSONB,
    "points_addressed" INTEGER,
    "duration_seconds" INTEGER,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "exam_attempt_id" TEXT,
    "erasure_id" TEXT,

    CONSTRAINT "writing_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "listening_attempts" (
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "score" INTEGER,
    "feedback" TEXT,
    "duration_seconds" INTEGER,
    "content_revision" TEXT,
    "timed" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "answers" JSONB,
    "modelltest_id" UUID,
    "listening_exercise_id" UUID,
    "exam_attempt_id" TEXT,
    "erasure_id" TEXT,

    CONSTRAINT "listening_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_attempts" (
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "teil_id" TEXT NOT NULL,
    "modelltest_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "score" INTEGER,
    "feedback" TEXT,
    "answers" JSONB,
    "content_revision" TEXT,
    "duration_seconds" INTEGER,
    "answers_prefetched" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "exam_attempt_id" TEXT,
    "erasure_id" TEXT,

    CONSTRAINT "sprachbausteine_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "lesen_passages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cefr_level" TEXT NOT NULL DEFAULT 'B1',
    "topic" TEXT,
    "word_count" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesen_passages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_questions" (
    "id" TEXT NOT NULL,
    "passage_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesen_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil2_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contentRevision" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "cautionNote" TEXT NOT NULL,
    "topSender" TEXT NOT NULL,
    "topReceiver" TEXT NOT NULL,
    "topBody" TEXT NOT NULL,
    "quotedThread" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelltest_id" UUID NOT NULL,

    CONSTRAINT "lesen_teil2_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil2_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "lesen_teil2_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil2_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "questionId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "lesen_teil2_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teil_number" INTEGER NOT NULL,
    "content_revision" TEXT NOT NULL,
    "label" TEXT,
    "instruction" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelltest_id" UUID NOT NULL,

    CONSTRAINT "sprachbausteine_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_gaps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "gap_key" TEXT NOT NULL,
    "gap_number" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "sprachbausteine_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_gap_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gap_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "sprachbausteine_gap_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_teil2_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contentRevision" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelltest_id" UUID NOT NULL,

    CONSTRAINT "sprachbausteine_teil2_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_teil2_words" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "letter" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "sprachbausteine_teil2_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprachbausteine_teil2_gaps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "gapKey" TEXT NOT NULL,
    "gapNumber" INTEGER NOT NULL,
    "correctWordId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "sprachbausteine_teil2_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil1_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contentRevision" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelltest_id" UUID NOT NULL,

    CONSTRAINT "lesen_teil1_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil1_texts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "textNumber" INTEGER NOT NULL,
    "von" TEXT,
    "an" TEXT,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "correctTitleId" UUID NOT NULL,

    CONSTRAINT "lesen_teil1_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil1_titles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "lesen_teil1_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil3_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contentRevision" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelltest_id" UUID NOT NULL,

    CONSTRAINT "lesen_teil3_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil3_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "lesen_teil3_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_teil3_situations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "situationNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "noMatch" BOOLEAN NOT NULL DEFAULT false,
    "correctAnnouncementId" UUID,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "lesen_teil3_situations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelltests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exam_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "modelltests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelltest_id" UUID NOT NULL,
    "part" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "instruction" TEXT NOT NULL,
    "content_revision" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "audio_url" TEXT NOT NULL DEFAULT '',
    "bundled_audio_asset" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT NOT NULL,
    "transcript" TEXT,
    "exam_plays_allowed" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listening_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "question_number" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "listening_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelltest_id" UUID NOT NULL,
    "part" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "topic_title" TEXT NOT NULL,
    "topic_description" TEXT NOT NULL,
    "topic_points" JSONB NOT NULL,
    "instructions" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "prep_duration_seconds" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "exam_image_url" TEXT,
    "content_revision" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_revision" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "task_type" TEXT NOT NULL,
    "intro" TEXT,
    "stimulus" JSONB,
    "task_instructions" TEXT NOT NULL,
    "bullet_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "closing_reminder" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelltest_id" UUID NOT NULL,

    CONSTRAINT "writing_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "operation" "AiOperation" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_activities" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "teil" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "duration_seconds" INTEGER,
    "modelltest_id" UUID,
    "attempt_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erasure_id" TEXT,

    CONSTRAINT "student_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesen_attempts" (
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "teil_id" TEXT NOT NULL,
    "modelltest_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exam_attempt_id" TEXT,
    "erasure_id" TEXT,

    CONSTRAINT "lesen_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "speaking_attempts" (
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "teil_number" INTEGER NOT NULL,
    "modelltest_id" UUID,
    "transcript" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "evaluation" JSONB NOT NULL,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erasure_id" TEXT,
    "exam_attempt_id" TEXT,

    CONSTRAINT "speaking_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "data_erasures" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "center_user_id" TEXT,
    "since" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erase_after" TIMESTAMP(3) NOT NULL,
    "erased_at" TIMESTAMP(3),
    "restored_at" TIMESTAMP(3),

    CONSTRAINT "data_erasures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "kind" "SupportRequestKind" NOT NULL,
    "center_id" TEXT NOT NULL,
    "center_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailed_at" TIMESTAMP(3),

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_block_durations" (
    "id" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "block" "ExamBlock" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "exam_block_durations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "modelltest_id" UUID NOT NULL,
    "grading_tier" "ExamGradingTier" NOT NULL DEFAULT 'MANUAL',
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "force_closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_session_participants" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "released_result" JSONB,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempt_blocks" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "block" "ExamBlock" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "answers" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "exam_attempt_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_audio_plays" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "audio_id" UUID NOT NULL,
    "plays_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exam_audio_plays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_section_weights" (
    "id" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "skill" "Skill" NOT NULL,
    "teil" INTEGER NOT NULL,
    "max_points" INTEGER NOT NULL,
    "part" "ExamPart" NOT NULL,

    CONSTRAINT "exam_section_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_section_results" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "teil" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "graded_by" TEXT NOT NULL,
    "graded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "exam_section_results_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE INDEX "students_center_id_idx" ON "students"("center_id");

-- CreateIndex
CREATE INDEX "students_email_idx" ON "students"("email");

-- CreateIndex
CREATE INDEX "device_sessions_student_id_idx" ON "device_sessions"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_student_id_device_id_key" ON "device_sessions"("student_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "center_subscriptions_center_id_key" ON "center_subscriptions"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "center_seats_center_id_key" ON "center_seats"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "activation_codes_code_key" ON "activation_codes"("code");

-- CreateIndex
CREATE INDEX "activation_codes_center_id_status_idx" ON "activation_codes"("center_id", "status");

-- CreateIndex
CREATE INDEX "activation_codes_student_id_idx" ON "activation_codes"("student_id");

-- CreateIndex
CREATE INDEX "code_entitlements_product_expires_at_idx" ON "code_entitlements"("product", "expires_at");

-- CreateIndex
CREATE INDEX "activation_code_events_code_id_created_at_idx" ON "activation_code_events"("code_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments"("provider_reference");

-- CreateIndex
CREATE INDEX "payments_center_id_created_at_idx" ON "payments"("center_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_center_id_idempotency_key_key" ON "payments"("center_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "center_users_email_key" ON "center_users"("email");

-- CreateIndex
CREATE INDEX "center_users_center_id_idx" ON "center_users"("center_id");

-- CreateIndex
CREATE INDEX "center_users_email_verification_token_idx" ON "center_users"("email_verification_token");

-- CreateIndex
CREATE INDEX "center_users_password_reset_token_idx" ON "center_users"("password_reset_token");

-- CreateIndex
CREATE INDEX "center_device_sessions_center_user_id_idx" ON "center_device_sessions"("center_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "center_device_sessions_center_user_id_device_id_key" ON "center_device_sessions"("center_user_id", "device_id");

-- CreateIndex
CREATE INDEX "writing_attempts_erasure_id_idx" ON "writing_attempts"("erasure_id");

-- CreateIndex
CREATE INDEX "listening_attempts_listening_exercise_id_idx" ON "listening_attempts"("listening_exercise_id");

-- CreateIndex
CREATE INDEX "listening_attempts_erasure_id_idx" ON "listening_attempts"("erasure_id");

-- CreateIndex
CREATE INDEX "sprachbausteine_attempts_student_id_teil_id_idx" ON "sprachbausteine_attempts"("student_id", "teil_id");

-- CreateIndex
CREATE INDEX "sprachbausteine_attempts_erasure_id_idx" ON "sprachbausteine_attempts"("erasure_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesen_teil2_exercises_modelltest_id_key" ON "lesen_teil2_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "sprachbausteine_exercises_modelltest_id_key" ON "sprachbausteine_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "sprachbausteine_gaps_exercise_id_gap_key_key" ON "sprachbausteine_gaps"("exercise_id", "gap_key");

-- CreateIndex
CREATE UNIQUE INDEX "sprachbausteine_teil2_exercises_modelltest_id_key" ON "sprachbausteine_teil2_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "sprachbausteine_teil2_gaps_exerciseId_gapKey_key" ON "sprachbausteine_teil2_gaps"("exerciseId", "gapKey");

-- CreateIndex
CREATE UNIQUE INDEX "lesen_teil1_exercises_modelltest_id_key" ON "lesen_teil1_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesen_teil3_exercises_modelltest_id_key" ON "lesen_teil3_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "modelltests_number_key" ON "modelltests"("number");

-- CreateIndex
CREATE UNIQUE INDEX "listening_exercises_content_revision_key" ON "listening_exercises"("content_revision");

-- CreateIndex
CREATE INDEX "listening_exercises_modelltest_id_idx" ON "listening_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "listening_exercises_modelltest_id_part_key" ON "listening_exercises"("modelltest_id", "part");

-- CreateIndex
CREATE INDEX "listening_questions_exercise_id_idx" ON "listening_questions"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "listening_questions_exercise_id_question_number_key" ON "listening_questions"("exercise_id", "question_number");

-- CreateIndex
CREATE UNIQUE INDEX "listening_questions_exercise_id_sort_order_key" ON "listening_questions"("exercise_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_exercises_content_revision_key" ON "speaking_exercises"("content_revision");

-- CreateIndex
CREATE INDEX "speaking_exercises_modelltest_id_idx" ON "speaking_exercises"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_exercises_modelltest_id_part_key" ON "speaking_exercises"("modelltest_id", "part");

-- CreateIndex
CREATE UNIQUE INDEX "writing_exercises_modelltest_id_key" ON "writing_exercises"("modelltest_id");

-- CreateIndex
CREATE INDEX "ai_usage_student_id_operation_created_at_idx" ON "ai_usage"("student_id", "operation", "created_at");

-- CreateIndex
CREATE INDEX "student_activities_student_id_created_at_idx" ON "student_activities"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "student_activities_student_id_skill_created_at_idx" ON "student_activities"("student_id", "skill", "created_at");

-- CreateIndex
CREATE INDEX "student_activities_erasure_id_idx" ON "student_activities"("erasure_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_activities_skill_attempt_id_key" ON "student_activities"("skill", "attempt_id");

-- CreateIndex
CREATE INDEX "lesen_attempts_student_id_teil_id_idx" ON "lesen_attempts"("student_id", "teil_id");

-- CreateIndex
CREATE INDEX "lesen_attempts_erasure_id_idx" ON "lesen_attempts"("erasure_id");

-- CreateIndex
CREATE INDEX "speaking_attempts_student_id_teil_number_idx" ON "speaking_attempts"("student_id", "teil_number");

-- CreateIndex
CREATE INDEX "speaking_attempts_erasure_id_idx" ON "speaking_attempts"("erasure_id");

-- CreateIndex
CREATE INDEX "data_erasures_erase_after_idx" ON "data_erasures"("erase_after");

-- CreateIndex
CREATE INDEX "data_erasures_student_id_idx" ON "data_erasures"("student_id");

-- CreateIndex
CREATE INDEX "support_requests_center_id_kind_created_at_idx" ON "support_requests"("center_id", "kind", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "exam_block_durations_level_block_key" ON "exam_block_durations"("level", "block");

-- CreateIndex
CREATE INDEX "exam_sessions_center_id_opens_at_idx" ON "exam_sessions"("center_id", "opens_at");

-- CreateIndex
CREATE INDEX "exam_session_participants_student_id_idx" ON "exam_session_participants"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_session_participants_session_id_student_id_key" ON "exam_session_participants"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "exam_attempts_student_id_idx" ON "exam_attempts"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_session_id_student_id_key" ON "exam_attempts"("session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempt_blocks_attempt_id_block_key" ON "exam_attempt_blocks"("attempt_id", "block");

-- CreateIndex
CREATE UNIQUE INDEX "exam_audio_plays_attempt_id_audio_id_key" ON "exam_audio_plays"("attempt_id", "audio_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_section_weights_level_skill_teil_key" ON "exam_section_weights"("level", "skill", "teil");

-- CreateIndex
CREATE INDEX "exam_section_results_attempt_id_idx" ON "exam_section_results"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_section_results_attempt_id_skill_teil_key" ON "exam_section_results"("attempt_id", "skill", "teil");

-- CreateIndex
CREATE INDEX "notifications_student_id_read_at_created_at_idx" ON "notifications"("student_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_subscriptions" ADD CONSTRAINT "center_subscriptions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_seats" ADD CONSTRAINT "center_seats_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_entitlement_pools" ADD CONSTRAINT "center_entitlement_pools_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_entitlement_caps" ADD CONSTRAINT "code_entitlement_caps_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "activation_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_entitlements" ADD CONSTRAINT "code_entitlements_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "activation_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activation_code_events" ADD CONSTRAINT "activation_code_events_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "activation_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_users" ADD CONSTRAINT "center_users_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "center_device_sessions" ADD CONSTRAINT "center_device_sessions_center_user_id_fkey" FOREIGN KEY ("center_user_id") REFERENCES "center_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_attempts" ADD CONSTRAINT "listening_attempts_listening_exercise_id_fkey" FOREIGN KEY ("listening_exercise_id") REFERENCES "listening_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_questions" ADD CONSTRAINT "lesen_questions_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "lesen_passages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil2_exercises" ADD CONSTRAINT "lesen_teil2_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil2_questions" ADD CONSTRAINT "lesen_teil2_questions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "lesen_teil2_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil2_options" ADD CONSTRAINT "lesen_teil2_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "lesen_teil2_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_exercises" ADD CONSTRAINT "sprachbausteine_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_gaps" ADD CONSTRAINT "sprachbausteine_gaps_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "sprachbausteine_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_gap_options" ADD CONSTRAINT "sprachbausteine_gap_options_gap_id_fkey" FOREIGN KEY ("gap_id") REFERENCES "sprachbausteine_gaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_teil2_exercises" ADD CONSTRAINT "sprachbausteine_teil2_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_teil2_words" ADD CONSTRAINT "sprachbausteine_teil2_words_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "sprachbausteine_teil2_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_teil2_gaps" ADD CONSTRAINT "sprachbausteine_teil2_gaps_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "sprachbausteine_teil2_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprachbausteine_teil2_gaps" ADD CONSTRAINT "sprachbausteine_teil2_gaps_correctWordId_fkey" FOREIGN KEY ("correctWordId") REFERENCES "sprachbausteine_teil2_words"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil1_exercises" ADD CONSTRAINT "lesen_teil1_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil1_texts" ADD CONSTRAINT "lesen_teil1_texts_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "lesen_teil1_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil1_texts" ADD CONSTRAINT "lesen_teil1_texts_correctTitleId_fkey" FOREIGN KEY ("correctTitleId") REFERENCES "lesen_teil1_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil1_titles" ADD CONSTRAINT "lesen_teil1_titles_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "lesen_teil1_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil3_exercises" ADD CONSTRAINT "lesen_teil3_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil3_announcements" ADD CONSTRAINT "lesen_teil3_announcements_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "lesen_teil3_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil3_situations" ADD CONSTRAINT "lesen_teil3_situations_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "lesen_teil3_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesen_teil3_situations" ADD CONSTRAINT "lesen_teil3_situations_correctAnnouncementId_fkey" FOREIGN KEY ("correctAnnouncementId") REFERENCES "lesen_teil3_announcements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_exercises" ADD CONSTRAINT "listening_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_questions" ADD CONSTRAINT "listening_questions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "listening_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_exercises" ADD CONSTRAINT "speaking_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_exercises" ADD CONSTRAINT "writing_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_activities" ADD CONSTRAINT "student_activities_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_session_participants" ADD CONSTRAINT "exam_session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_session_participants" ADD CONSTRAINT "exam_session_participants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_blocks" ADD CONSTRAINT "exam_attempt_blocks_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_audio_plays" ADD CONSTRAINT "exam_audio_plays_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_section_results" ADD CONSTRAINT "exam_section_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- WHAT PRISMA CANNOT SEE.
--
-- Everything above this line was generated from schema.prisma. Two kinds of
-- object are invisible to that generator, so both were silently absent from
-- the first version of this baseline and had to be carried over by hand from
-- the 73 migrations this file replaces:
--
--   * CHECK constraints. Prisma has no schema syntax for them, so a generated
--     baseline drops every one. The integration suite noticed: tests asserting
--     the database refuses a negative price or a zero seat count got a
--     resolved promise instead of a rejection.
--
--   * Partial indexes. Prisma can express a unique index but not its WHERE
--     clause, so the predicate is dropped and the index silently widens.
--     `activation_codes_one_connected_per_student` is the load-bearing one:
--     without its predicate it forbids a student from ever holding two codes,
--     rather than two *connected* codes.
--
-- Of the 33 named CHECK constraints in the old chain, 25 are live. The other
-- eight were not dropped by name — they died with the table or column they
-- sat on, which is why grepping for DROP CONSTRAINT does not find them:
--
--   payment_lines_{seats,unit_price_xaf,amount_xaf}_positive and
--   payment_lines_amount_matches_seats  -- table dropped, 20260923120000
--   centers_{unit_price_xaf,min_seats}_positive  -- columns dropped, 20260915140000
--   payments_seats_positive              -- dropped, 20260914160000
--   payments_unit_price_xaf_positive     -- dropped with its column,
--                                           20260914160000; the column came
--                                           back at 20260923120000 without it
--
-- One constraint reads differently here than where it was written:
-- payments_total_seats_positive was declared on "seats", which became
-- "total_seats" and then "quantity". Postgres rewrites a CHECK expression
-- through a column rename, so the live constraint guards "quantity" under its
-- original name. Both are reproduced as the live database has them.

-- Money and counts have floors, enforced here so no future code path can
-- write a payment for zero seats or a negative amount.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_xaf_positive" CHECK ("amount_xaf" > 0),
  ADD CONSTRAINT "payments_total_seats_positive" CHECK ("quantity" > 0);

-- A seat row is a real purchase, but the price may be zero, because that is
-- how a free trial seat is held: "not negative" rather than "positive".
ALTER TABLE "center_seats"
  ADD CONSTRAINT "center_seats_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "center_seats_unit_price_xaf_not_negative" CHECK ("unit_price_xaf" >= 0);

-- A slot balance below zero means a sitting was published out of nothing.
-- The service holds this in a transaction; these are the backstop for the
-- case the transaction is wrong.
ALTER TABLE "centers"
  ADD CONSTRAINT "centers_exam_slots_non_negative" CHECK ("exam_slots_remaining" >= 0),
  ADD CONSTRAINT "centers_exam_ai_slots_non_negative" CHECK ("exam_ai_slots_remaining" >= 0);

-- A window that closes before it opens is a sitting nobody can ever sit.
ALTER TABLE "exam_sessions"
  ADD CONSTRAINT "exam_sessions_window_ordered" CHECK ("closes_at" > "opens_at");

-- A block of zero minutes is not a block.
ALTER TABLE "exam_block_durations"
  ADD CONSTRAINT "exam_block_durations_minutes_positive" CHECK ("minutes" > 0);

-- A block that closes before it opens is a block nobody can sit.
ALTER TABLE "exam_attempt_blocks"
  ADD CONSTRAINT "exam_attempt_blocks_deadline_after_start" CHECK ("deadline_at" > "started_at");

-- A negative play count would mean a recording was un-played.
ALTER TABLE "exam_audio_plays"
  ADD CONSTRAINT "exam_audio_plays_not_negative" CHECK ("plays_used" >= 0);

-- Marks are never negative, and a section worth zero points cannot be marked.
ALTER TABLE "exam_section_results"
  ADD CONSTRAINT "exam_section_results_points_not_negative" CHECK ("points" >= 0);

ALTER TABLE "exam_section_weights"
  ADD CONSTRAINT "exam_section_weights_points_positive" CHECK ("max_points" > 0);

-- A pool that can go below zero is a pool that grants what nobody bought.
ALTER TABLE "center_entitlement_pools"
  ADD CONSTRAINT "center_entitlement_pools_balance_non_negative" CHECK ("balance" >= 0);

ALTER TABLE "code_entitlement_caps"
  ADD CONSTRAINT "code_entitlement_caps_cap_non_negative" CHECK ("cap" >= 0),
  ADD CONSTRAINT "code_entitlement_caps_used_non_negative" CHECK ("used" >= 0);

-- A billing anchor is a day of the month, or absent.
ALTER TABLE "center_subscriptions"
  ADD CONSTRAINT "center_subscriptions_anchor_day_range"
  CHECK ("anchor_day" IS NULL OR ("anchor_day" >= 1 AND "anchor_day" <= 31));

-- A recording that may play zero times is a Teil nobody can answer.
ALTER TABLE "listening_exercises"
  ADD CONSTRAINT "listening_exercises_exam_plays_positive" CHECK ("exam_plays_allowed" >= 1),
  ADD CONSTRAINT "listening_exercises_part_check" CHECK ("part" BETWEEN 1 AND 3),
  ADD CONSTRAINT "listening_exercises_duration_check" CHECK ("duration_minutes" > 0);

-- telc Hören answers are + or -, and nothing else.
ALTER TABLE "listening_questions"
  ADD CONSTRAINT "listening_questions_correct_answer_check" CHECK ("correct_answer" IN ('+', '-'));

ALTER TABLE "speaking_exercises"
  ADD CONSTRAINT "speaking_exercises_part_check" CHECK ("part" BETWEEN 1 AND 3),
  ADD CONSTRAINT "speaking_exercises_duration_check" CHECK ("duration_minutes" > 0),
  ADD CONSTRAINT "speaking_exercises_prep_duration_check" CHECK ("prep_duration_seconds" >= 0),
  ADD CONSTRAINT "speaking_exercises_topic_points_check" CHECK (jsonb_typeof("topic_points") = 'array');

-- Enforce valid noMatch/correctAnnouncementId combinations.
ALTER TABLE "lesen_teil3_situations"
  ADD CONSTRAINT "lesen_teil3_situations_no_match_check"
  CHECK (
    ("noMatch" = true  AND "correctAnnouncementId" IS NULL) OR
    ("noMatch" = false AND "correctAnnouncementId" IS NOT NULL)
  );

-- A student may hold many codes over time, but only one CONNECTED at once.
-- The predicate is the whole point: without it this forbids the second code
-- outright.
CREATE UNIQUE INDEX "activation_codes_one_connected_per_student"
  ON "activation_codes" ("student_id") WHERE "status" = 'CONNECTED';

-- Every training read filters on `exam_attempt_id IS NULL`, and a student's
-- history is read far more often than an exam is sat. Partial indexes, so the
-- exam rows cost nothing to skip.
CREATE INDEX "lesen_attempts_training_idx" ON "lesen_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "listening_attempts_training_idx" ON "listening_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "sprachbausteine_attempts_training_idx" ON "sprachbausteine_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "writing_attempts_training_idx" ON "writing_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "speaking_attempts_training_idx" ON "speaking_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
