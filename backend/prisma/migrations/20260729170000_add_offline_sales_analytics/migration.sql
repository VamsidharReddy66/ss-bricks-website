CREATE TABLE "offline_sales" (
    "id" SERIAL NOT NULL,
    "sale_number" VARCHAR(32) NOT NULL,
    "customer_name" VARCHAR(100) NOT NULL,
    "customer_phone" VARCHAR(10),
    "location" VARCHAR(100),
    "product" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "unit_price" DECIMAL(10,2),
    "invoiced_amount" DECIMAL(12,2) NOT NULL,
    "received_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "received_date" TIMESTAMP(3),
    "payment_method" VARCHAR(50),
    "notes" VARCHAR(1000),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offline_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offline_sales_sale_number_key" ON "offline_sales"("sale_number");
CREATE INDEX "offline_sales_sale_date_idx" ON "offline_sales"("sale_date");
CREATE INDEX "offline_sales_product_idx" ON "offline_sales"("product");
CREATE INDEX "offline_sales_customer_name_idx" ON "offline_sales"("customer_name");
CREATE INDEX "offline_sales_created_by_idx" ON "offline_sales"("created_by");

ALTER TABLE "offline_sales"
ADD CONSTRAINT "offline_sales_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "Admin"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
