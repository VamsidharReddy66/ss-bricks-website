-- Customer contact and admin-confirmed quotation payment terms.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);

ALTER TABLE "QuoteRequest"
  ADD COLUMN IF NOT EXISTS "final_amount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "payment_token" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "payment_enabled_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "QuoteRequest_payment_token_key"
ON "QuoteRequest"("payment_token");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" SERIAL NOT NULL,
  "quotation_id" INTEGER NOT NULL,
  "customer_name" VARCHAR(100) NOT NULL,
  "customer_phone" VARCHAR(10) NOT NULL,
  "customer_email" VARCHAR(255),
  "razorpay_order_id" VARCHAR(100) NOT NULL,
  "razorpay_payment_id" VARCHAR(100),
  "razorpay_signature" VARCHAR(255),
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "payment_method" VARCHAR(50),
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "failure_reason" VARCHAR(500),
  "receipt_path" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" SERIAL NOT NULL,
  "payment_id" INTEGER NOT NULL,
  "file_name" VARCHAR(100) NOT NULL,
  "content_type" VARCHAR(80) NOT NULL,
  "content" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_order_id_key" ON "payments"("razorpay_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_payment_id_key" ON "payments"("razorpay_payment_id");
CREATE INDEX IF NOT EXISTS "payments_quotation_id_idx" ON "payments"("quotation_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments"("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_payment_id_key" ON "payment_receipts"("payment_id");
CREATE INDEX IF NOT EXISTS "payment_receipts_created_at_idx" ON "payment_receipts"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_quotation_id_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_quotation_id_fkey"
    FOREIGN KEY ("quotation_id") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_receipts_payment_id_fkey') THEN
    ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
