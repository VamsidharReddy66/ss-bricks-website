ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'SUCCESS';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'RETRYING' BEFORE 'SUCCESS';

ALTER TABLE "NotificationLog"
ADD COLUMN IF NOT EXISTS "deduplication_key" VARCHAR(100);

ALTER TABLE "NotificationLog"
ADD COLUMN IF NOT EXISTS "recovery_attempt_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "QuoteRequest"
ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "request_fingerprint" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_deduplication_key_key"
ON "NotificationLog"("deduplication_key");

CREATE UNIQUE INDEX IF NOT EXISTS "QuoteRequest_idempotency_key_key"
ON "QuoteRequest"("idempotency_key");

CREATE TABLE IF NOT EXISTS "whatsapp_recovery_audits" (
  "id" SERIAL PRIMARY KEY,
  "quote_request_id" INTEGER NOT NULL REFERENCES "QuoteRequest"("id") ON DELETE CASCADE,
  "notification_log_id" INTEGER NOT NULL REFERENCES "NotificationLog"("id") ON DELETE CASCADE,
  "admin_id" INTEGER NOT NULL REFERENCES "Admin"("id") ON DELETE RESTRICT,
  "previous_status" "NotificationStatus" NOT NULL,
  "new_status" "NotificationStatus" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "provider_status" VARCHAR(100),
  "outcome" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "whatsapp_recovery_audits_quote_request_id_idx"
ON "whatsapp_recovery_audits"("quote_request_id");

CREATE INDEX IF NOT EXISTS "whatsapp_recovery_audits_notification_log_id_idx"
ON "whatsapp_recovery_audits"("notification_log_id");
