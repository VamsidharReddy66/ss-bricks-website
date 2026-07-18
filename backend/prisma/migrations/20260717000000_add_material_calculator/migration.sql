-- CreateEnum
CREATE TYPE "CalculatorMeasurementUnit" AS ENUM ('MM', 'CM', 'INCH');

-- CreateTable
CREATE TABLE "brick_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "length" DECIMAL(10,3) NOT NULL,
    "width" DECIMAL(10,3) NOT NULL,
    "height" DECIMAL(10,3) NOT NULL,
    "dimension_unit" "CalculatorMeasurementUnit" NOT NULL,
    "price_per_piece" DECIMAL(10,2) NOT NULL,
    "default_waste_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brick_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wall_thickness" (
    "id" SERIAL NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "thickness_value" DECIMAL(10,3) NOT NULL,
    "unit" "CalculatorMeasurementUnit" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wall_thickness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brick_types_name_key" ON "brick_types"("name");
CREATE INDEX "brick_types_is_active_idx" ON "brick_types"("is_active");
CREATE INDEX "brick_types_name_idx" ON "brick_types"("name");
CREATE UNIQUE INDEX "wall_thickness_display_name_key" ON "wall_thickness"("display_name");
CREATE INDEX "wall_thickness_is_active_idx" ON "wall_thickness"("is_active");

-- Seed only configuration values explicitly established for the calculator.
INSERT INTO "brick_types" (
    "name", "length", "width", "height", "dimension_unit",
    "price_per_piece", "default_waste_percent", "updated_at"
) VALUES (
    'Fly Ash Bricks', 230, 110, 75, 'MM', 8.50, 5, CURRENT_TIMESTAMP
) ON CONFLICT ("name") DO NOTHING;

INSERT INTO "wall_thickness" (
    "display_name", "thickness_value", "unit", "updated_at"
) VALUES
    ('4.5 inch', 4.5, 'INCH', CURRENT_TIMESTAMP),
    ('9 inch', 9, 'INCH', CURRENT_TIMESTAMP),
    ('13.5 inch', 13.5, 'INCH', CURRENT_TIMESTAMP)
ON CONFLICT ("display_name") DO NOTHING;
