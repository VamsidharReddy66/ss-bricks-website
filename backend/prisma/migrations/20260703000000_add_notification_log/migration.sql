CREATE TYPE "NotificationType" AS ENUM ('EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "NotificationLog" (
    "id" SERIAL NOT NULL,
    "quoteRequestId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'EMAIL',
    "recipient" VARCHAR(255) NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "errorMessage" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationLog_quoteRequestId_idx" ON "NotificationLog"("quoteRequestId");
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

ALTER TABLE "NotificationLog"
ADD CONSTRAINT "NotificationLog_quoteRequestId_fkey"
FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
