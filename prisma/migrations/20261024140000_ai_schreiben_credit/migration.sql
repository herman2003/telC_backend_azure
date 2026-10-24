-- AI Schreiben credits (ADR 0006): prepaid training corrections after Start's
-- free 2/UTC day. Same assign-from-stock tables as AI_SPEAKING_CREDIT; new
-- enum values only.
--
-- ADD VALUE cannot run in the same transaction as its first use; this
-- migration only adds the values.

ALTER TYPE "EntitlementProduct" ADD VALUE 'AI_SCHREIBEN_CREDIT';
ALTER TYPE "PaymentKind" ADD VALUE 'AI_SCHREIBEN_CREDIT';
