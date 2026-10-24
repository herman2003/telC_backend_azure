CREATE TABLE "push_endpoints" (
 "id" TEXT PRIMARY KEY, "student_id" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
 "device_id" TEXT NOT NULL, "session_id" TEXT NOT NULL REFERENCES "device_sessions"("id") ON DELETE CASCADE,
 "platform" TEXT NOT NULL, "target_ciphertext" TEXT NOT NULL, "target_hash" TEXT NOT NULL UNIQUE,
 "locale" TEXT NOT NULL DEFAULT 'de', "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
 "app_version" TEXT NOT NULL, "permission" TEXT NOT NULL DEFAULT 'GRANTED', "preferred" BOOLEAN NOT NULL DEFAULT false,
 "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "invalidated_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "push_endpoints_student_id_device_id_platform_key" UNIQUE ("student_id", "device_id", "platform")
);
CREATE INDEX "push_endpoints_student_id_invalidated_at_last_active_at_idx" ON "push_endpoints"("student_id","invalidated_at","last_active_at");
CREATE UNIQUE INDEX "push_endpoints_one_preferred" ON "push_endpoints"("student_id") WHERE preferred AND invalidated_at IS NULL;
CREATE TABLE "notification_preferences" (
 "student_id" TEXT PRIMARY KEY REFERENCES "students"("id") ON DELETE CASCADE,
 "transactional_enabled" BOOLEAN NOT NULL DEFAULT true, "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
 "quiet_start" TEXT NOT NULL DEFAULT '21:00', "quiet_end" TEXT NOT NULL DEFAULT '08:00', "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "push_dispatches" (
 "id" TEXT PRIMARY KEY, "notification_id" TEXT NOT NULL UNIQUE REFERENCES "notifications"("id") ON DELETE CASCADE,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expires_at" TIMESTAMP(3) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
 "lease_until" TIMESTAMP(3), "lease_token" TEXT, "endpoint_id" TEXT, "last_error" TEXT, "sent_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "push_dispatches_status_available_at_lease_until_idx" ON "push_dispatches"("status","available_at","lease_until");
-- Fires for all writers (including createMany), with rollback of the domain transaction.
-- Existing notifications are intentionally not backfilled or sent retroactively.
CREATE FUNCTION enqueue_notification_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO push_dispatches(id,notification_id,expires_at)
 VALUES (NEW.id,NEW.id,NEW.created_at + interval '14 days') ON CONFLICT DO NOTHING;
 RETURN NEW;
END;
$$;
CREATE TRIGGER notification_push_outbox AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION enqueue_notification_push();
-- A revoked session must immediately lose its delivery addresses, even if the client is offline.
CREATE FUNCTION invalidate_session_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revoked_at IS NOT NULL THEN
  UPDATE push_endpoints SET invalidated_at=NEW.revoked_at, preferred=false WHERE session_id=NEW.id AND invalidated_at IS NULL;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER session_push_revocation AFTER UPDATE OF revoked_at ON device_sessions FOR EACH ROW EXECUTE FUNCTION invalidate_session_push();
