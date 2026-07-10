ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'CONTACTED';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'QUOTATION_SENT';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'NEGOTIATION';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'WON';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

CREATE TYPE "LeadSource" AS ENUM (
    'WEBSITE',
    'PHONE',
    'WALK_IN',
    'WHATSAPP',
    'INDIAMART',
    'FACEBOOK',
    'INSTAGRAM',
    'REFERENCE',
    'MANUAL',
    'CSV_IMPORT'
);

CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'IMPORTED', 'NOTE', 'STATUS_CHANGE');

ALTER TABLE "QuoteRequest" ADD COLUMN "company" VARCHAR(120);
ALTER TABLE "QuoteRequest" ADD COLUMN "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE';
ALTER TABLE "QuoteRequest" ADD COLUMN "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "QuoteRequest" ADD COLUMN "assignedTo" VARCHAR(100);
ALTER TABLE "QuoteRequest" ADD COLUMN "nextFollowUpDate" TIMESTAMP(3);
ALTER TABLE "QuoteRequest" ADD COLUMN "crmNotes" VARCHAR(1000);
ALTER TABLE "QuoteRequest" ALTER COLUMN "deliveryDate" DROP NOT NULL;

CREATE TABLE "LeadActivity" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "type" "ActivityType" NOT NULL DEFAULT 'NOTE',
    "note" VARCHAR(1000) NOT NULL,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteRequest_source_idx" ON "QuoteRequest"("source");
CREATE INDEX "QuoteRequest_priority_idx" ON "QuoteRequest"("priority");
CREATE INDEX "QuoteRequest_nextFollowUpDate_idx" ON "QuoteRequest"("nextFollowUpDate");

CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_createdBy_idx" ON "LeadActivity"("createdBy");
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LeadActivity" ("leadId", "type", "note", "createdAt")
SELECT "id", 'CREATED', 'Lead created from website quote request.', "createdAt"
FROM "QuoteRequest"
WHERE NOT EXISTS (
    SELECT 1 FROM "LeadActivity" WHERE "LeadActivity"."leadId" = "QuoteRequest"."id"
);
