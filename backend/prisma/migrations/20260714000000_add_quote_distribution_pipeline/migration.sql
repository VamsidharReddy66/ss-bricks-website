-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PDF';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GOOGLE_SHEET';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WHATSAPP';

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "pdfUrl" VARCHAR(255);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteDocument" (
    "id" SERIAL NOT NULL,
    "quoteRequestId" INTEGER NOT NULL,
    "fileName" VARCHAR(80) NOT NULL,
    "contentType" VARCHAR(80) NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteDocument_quoteRequestId_key" ON "QuoteDocument"("quoteRequestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteDocument_quoteRequestId_idx" ON "QuoteDocument"("quoteRequestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteDocument_createdAt_idx" ON "QuoteDocument"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuoteDocument_quoteRequestId_fkey'
  ) THEN
    ALTER TABLE "QuoteDocument" ADD CONSTRAINT "QuoteDocument_quoteRequestId_fkey"
    FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
