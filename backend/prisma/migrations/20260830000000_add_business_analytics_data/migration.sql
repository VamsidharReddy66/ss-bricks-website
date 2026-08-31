CREATE TYPE "ImportBatchStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('IMPORTED', 'REVIEW', 'SKIPPED', 'DUPLICATE');
CREATE TYPE "BusinessOrigin" AS ENUM ('XLSX_IMPORT', 'MANUAL', 'SYSTEM');
CREATE TYPE "DataConfidence" AS ENUM ('CONFIRMED', 'STATED', 'INFERRED', 'REVIEW');
CREATE TYPE "BusinessRecordState" AS ENUM ('ACTIVE', 'VOIDED');
CREATE TYPE "ProductionRecordType" AS ENUM ('PRODUCTION', 'NO_PRODUCTION', 'SUNDAY', 'UNKNOWN');
CREATE TYPE "BusinessEventType" AS ENUM ('CUSTOMER_ISSUE', 'MACHINE_PROBLEM', 'STOCK_ISSUE', 'VENDOR_ISSUE', 'RECEIVABLE_FOLLOW_UP', 'LARGE_ORDER', 'CORRECTION', 'OPERATIONAL_OBSERVATION', 'BUSINESS_NOTE');
CREATE TYPE "BusinessImpact" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');
CREATE TYPE "BusinessEventStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "BusinessAuditAction" AS ENUM ('IMPORT', 'CREATE', 'UPDATE', 'VOID', 'RESTORE');

CREATE TABLE "business_import_batches" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PROCESSING',
    "reporting_year" INTEGER,
    "summary" JSONB,
    "reconciliation" JSONB,
    "imported_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "business_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_import_rows" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "sheet_name" VARCHAR(120) NOT NULL,
    "row_number" INTEGER NOT NULL,
    "row_hash" VARCHAR(64) NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "entity_type" VARCHAR(50),
    "raw_data" JSONB NOT NULL,
    "issues" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_customers" (
    "id" SERIAL NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20),
    "location" VARCHAR(200),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ledger_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_vendors" (
    "id" SERIAL NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20),
    "address" VARCHAR(255),
    "product_service" VARCHAR(160),
    "pricing_note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_sales" (
    "id" SERIAL NOT NULL,
    "sale_date" TIMESTAMP(3),
    "reporting_month" TIMESTAMP(3) NOT NULL,
    "customer_id" INTEGER,
    "customer_name" VARCHAR(160) NOT NULL,
    "customer_phone" VARCHAR(20),
    "location" VARCHAR(200),
    "product_name" VARCHAR(160),
    "quantity" DECIMAL(14,3),
    "quantity_unit" VARCHAR(30) NOT NULL DEFAULT 'load',
    "unit_price" DECIMAL(12,2),
    "driver_batta" DECIMAL(12,2),
    "invoiced_amount" DECIMAL(14,2),
    "source_received_amount" DECIMAL(14,2),
    "source_outstanding_amount" DECIMAL(14,2),
    "payment_method" VARCHAR(80),
    "received_to" VARCHAR(160),
    "notes" VARCHAR(2000),
    "origin" "BusinessOrigin" NOT NULL DEFAULT 'MANUAL',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'CONFIRMED',
    "record_state" "BusinessRecordState" NOT NULL DEFAULT 'ACTIVE',
    "source_row_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    CONSTRAINT "ledger_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_receipts" (
    "id" SERIAL NOT NULL,
    "receipt_date" TIMESTAMP(3),
    "reporting_month" TIMESTAMP(3) NOT NULL,
    "customer_id" INTEGER,
    "sale_id" INTEGER,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method" VARCHAR(80),
    "received_to" VARCHAR(160),
    "reference" VARCHAR(255),
    "notes" VARCHAR(2000),
    "origin" "BusinessOrigin" NOT NULL DEFAULT 'MANUAL',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'CONFIRMED',
    "record_state" "BusinessRecordState" NOT NULL DEFAULT 'ACTIVE',
    "source_row_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    CONSTRAINT "ledger_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_entries" (
    "id" SERIAL NOT NULL,
    "expense_date" TIMESTAMP(3),
    "reporting_month" TIMESTAMP(3) NOT NULL,
    "category" VARCHAR(80) NOT NULL DEFAULT 'UNCATEGORIZED',
    "description" VARCHAR(500),
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method" VARCHAR(80),
    "paid_by" VARCHAR(160),
    "notes" VARCHAR(2000),
    "origin" "BusinessOrigin" NOT NULL DEFAULT 'MANUAL',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'CONFIRMED',
    "record_state" "BusinessRecordState" NOT NULL DEFAULT 'ACTIVE',
    "source_row_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    CONSTRAINT "expense_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_purchases" (
    "id" SERIAL NOT NULL,
    "purchase_date" TIMESTAMP(3),
    "reporting_month" TIMESTAMP(3) NOT NULL,
    "material_name" VARCHAR(120) NOT NULL,
    "unit_price" DECIMAL(12,2),
    "quantity" DECIMAL(14,3),
    "purchase_amount" DECIMAL(14,2) NOT NULL,
    "driver_batta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vendor_id" INTEGER,
    "vendor_name" VARCHAR(160),
    "paid_date" TIMESTAMP(3),
    "payment_status" VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
    "payment_method" VARCHAR(80),
    "paid_by" VARCHAR(160),
    "notes" VARCHAR(2000),
    "origin" "BusinessOrigin" NOT NULL DEFAULT 'MANUAL',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'CONFIRMED',
    "record_state" "BusinessRecordState" NOT NULL DEFAULT 'ACTIVE',
    "source_row_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    CONSTRAINT "material_purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_records" (
    "id" SERIAL NOT NULL,
    "record_date" TIMESTAMP(3),
    "reporting_month" TIMESTAMP(3) NOT NULL,
    "record_type" "ProductionRecordType" NOT NULL,
    "product_name" VARCHAR(160),
    "quantity" DECIMAL(14,3),
    "reason" VARCHAR(500),
    "quality_note" VARCHAR(1000),
    "origin" "BusinessOrigin" NOT NULL DEFAULT 'MANUAL',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'CONFIRMED',
    "record_state" "BusinessRecordState" NOT NULL DEFAULT 'ACTIVE',
    "source_row_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "labour_payments" (
    "id" SERIAL NOT NULL,
    "payment_date" TIMESTAMP(3),
    "reporting_month" TIMESTAMP(3) NOT NULL,
    "work_description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(14,3),
    "raw_quantity" VARCHAR(255),
    "brick_making_amount" DECIMAL(14,2),
    "other_payment_note" VARCHAR(1000),
    "total_amount" DECIMAL(14,2) NOT NULL,
    "pending_amount" DECIMAL(14,2),
    "payment_method" VARCHAR(80),
    "paid_by" VARCHAR(160),
    "notes" VARCHAR(2000),
    "origin" "BusinessOrigin" NOT NULL DEFAULT 'MANUAL',
    "confidence" "DataConfidence" NOT NULL DEFAULT 'CONFIRMED',
    "record_state" "BusinessRecordState" NOT NULL DEFAULT 'ACTIVE',
    "source_row_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    CONSTRAINT "labour_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_events" (
    "id" SERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "type" "BusinessEventType" NOT NULL,
    "category" VARCHAR(100),
    "description" VARCHAR(2000) NOT NULL,
    "related_entity_type" VARCHAR(50),
    "related_entity_id" VARCHAR(80),
    "amount" DECIMAL(14,2),
    "impact" "BusinessImpact" NOT NULL DEFAULT 'NEUTRAL',
    "status" "BusinessEventStatus" NOT NULL DEFAULT 'OPEN',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_audit_logs" (
    "id" SERIAL NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(80) NOT NULL,
    "action" "BusinessAuditAction" NOT NULL,
    "reason" VARCHAR(500),
    "before_data" JSONB,
    "after_data" JSONB,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_import_batches_file_hash_key" ON "business_import_batches"("file_hash");
CREATE INDEX "business_import_batches_status_idx" ON "business_import_batches"("status");
CREATE INDEX "business_import_batches_created_at_idx" ON "business_import_batches"("created_at");
CREATE UNIQUE INDEX "business_import_rows_batch_id_sheet_name_row_number_key" ON "business_import_rows"("batch_id", "sheet_name", "row_number");
CREATE INDEX "business_import_rows_row_hash_idx" ON "business_import_rows"("row_hash");
CREATE INDEX "business_import_rows_status_idx" ON "business_import_rows"("status");
CREATE INDEX "ledger_customers_normalized_name_idx" ON "ledger_customers"("normalized_name");
CREATE INDEX "ledger_customers_phone_idx" ON "ledger_customers"("phone");
CREATE INDEX "business_vendors_normalized_name_idx" ON "business_vendors"("normalized_name");
CREATE INDEX "business_vendors_phone_idx" ON "business_vendors"("phone");
CREATE INDEX "ledger_sales_reporting_month_idx" ON "ledger_sales"("reporting_month");
CREATE INDEX "ledger_sales_sale_date_idx" ON "ledger_sales"("sale_date");
CREATE INDEX "ledger_sales_customer_id_idx" ON "ledger_sales"("customer_id");
CREATE INDEX "ledger_sales_product_name_idx" ON "ledger_sales"("product_name");
CREATE INDEX "ledger_sales_record_state_idx" ON "ledger_sales"("record_state");
CREATE INDEX "ledger_sales_source_row_id_idx" ON "ledger_sales"("source_row_id");
CREATE INDEX "ledger_receipts_reporting_month_idx" ON "ledger_receipts"("reporting_month");
CREATE INDEX "ledger_receipts_receipt_date_idx" ON "ledger_receipts"("receipt_date");
CREATE INDEX "ledger_receipts_customer_id_idx" ON "ledger_receipts"("customer_id");
CREATE INDEX "ledger_receipts_sale_id_idx" ON "ledger_receipts"("sale_id");
CREATE INDEX "ledger_receipts_record_state_idx" ON "ledger_receipts"("record_state");
CREATE INDEX "expense_entries_reporting_month_idx" ON "expense_entries"("reporting_month");
CREATE INDEX "expense_entries_expense_date_idx" ON "expense_entries"("expense_date");
CREATE INDEX "expense_entries_category_idx" ON "expense_entries"("category");
CREATE INDEX "expense_entries_record_state_idx" ON "expense_entries"("record_state");
CREATE INDEX "material_purchases_reporting_month_idx" ON "material_purchases"("reporting_month");
CREATE INDEX "material_purchases_purchase_date_idx" ON "material_purchases"("purchase_date");
CREATE INDEX "material_purchases_material_name_idx" ON "material_purchases"("material_name");
CREATE INDEX "material_purchases_vendor_id_idx" ON "material_purchases"("vendor_id");
CREATE INDEX "material_purchases_record_state_idx" ON "material_purchases"("record_state");
CREATE INDEX "production_records_reporting_month_idx" ON "production_records"("reporting_month");
CREATE INDEX "production_records_record_date_idx" ON "production_records"("record_date");
CREATE INDEX "production_records_record_type_idx" ON "production_records"("record_type");
CREATE INDEX "production_records_product_name_idx" ON "production_records"("product_name");
CREATE INDEX "production_records_record_state_idx" ON "production_records"("record_state");
CREATE INDEX "labour_payments_reporting_month_idx" ON "labour_payments"("reporting_month");
CREATE INDEX "labour_payments_payment_date_idx" ON "labour_payments"("payment_date");
CREATE INDEX "labour_payments_record_state_idx" ON "labour_payments"("record_state");
CREATE INDEX "business_events_occurred_at_idx" ON "business_events"("occurred_at");
CREATE INDEX "business_events_type_idx" ON "business_events"("type");
CREATE INDEX "business_events_status_idx" ON "business_events"("status");
CREATE INDEX "business_audit_logs_entity_type_entity_id_idx" ON "business_audit_logs"("entity_type", "entity_id");
CREATE INDEX "business_audit_logs_created_at_idx" ON "business_audit_logs"("created_at");

ALTER TABLE "business_import_batches" ADD CONSTRAINT "business_import_batches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_import_rows" ADD CONSTRAINT "business_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "business_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_sales" ADD CONSTRAINT "ledger_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "ledger_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_sales" ADD CONSTRAINT "ledger_sales_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "business_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_sales" ADD CONSTRAINT "ledger_sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_receipts" ADD CONSTRAINT "ledger_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "ledger_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_receipts" ADD CONSTRAINT "ledger_receipts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "ledger_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_receipts" ADD CONSTRAINT "ledger_receipts_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "business_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_receipts" ADD CONSTRAINT "ledger_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "business_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "business_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "business_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "business_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "labour_payments" ADD CONSTRAINT "labour_payments_source_row_id_fkey" FOREIGN KEY ("source_row_id") REFERENCES "business_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "labour_payments" ADD CONSTRAINT "labour_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_audit_logs" ADD CONSTRAINT "business_audit_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
