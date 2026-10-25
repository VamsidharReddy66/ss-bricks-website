CREATE TABLE "material_items" (
    "id" SERIAL NOT NULL,
    "item_code" VARCHAR(64) NOT NULL,
    "item_name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "sub_category" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "conversion" VARCHAR(120),
    "grade_spec" VARCHAR(160),
    "preferred_supplier" VARCHAR(160),
    "alternate_supplier" VARCHAR(160),
    "critical_item" BOOLEAN NOT NULL DEFAULT false,
    "storage_location" VARCHAR(160),
    "standard_rate" DECIMAL(14,2),
    "standard_use_product" VARCHAR(160),
    "standard_use_per_1000" DECIMAL(14,3),
    "reorder_level" DECIMAL(14,3),
    "reorder_quantity" DECIMAL(14,3),
    "lead_time_days" INTEGER,
    "shelf_life_days" INTEGER,
    "opening_stock" DECIMAL(14,3),
    "opening_stock_as_on" DATE,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "material_items_item_code_key" ON "material_items"("item_code");
CREATE INDEX "material_items_category_idx" ON "material_items"("category");
CREATE INDEX "material_items_item_name_idx" ON "material_items"("item_name");

ALTER TABLE "material_items" ADD CONSTRAINT "material_items_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
