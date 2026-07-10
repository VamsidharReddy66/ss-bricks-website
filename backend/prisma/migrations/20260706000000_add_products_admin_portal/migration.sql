-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('STANDARD', 'BULK');

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "standardPrice" DECIMAL(10,2) NOT NULL,
    "bulkPrice" DECIMAL(10,2) NOT NULL,
    "bulkQuantity" INTEGER NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "image" VARCHAR(255) NOT NULL,
    "availability" "ProductAvailability" NOT NULL DEFAULT 'IN_STOCK',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "oldPrice" DECIMAL(10,2) NOT NULL,
    "newPrice" DECIMAL(10,2) NOT NULL,
    "priceType" "PriceType" NOT NULL DEFAULT 'STANDARD',
    "updatedBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_availability_idx" ON "Product"("availability");

-- CreateIndex
CREATE INDEX "Product_updatedAt_idx" ON "Product"("updatedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_idx" ON "PriceHistory"("productId");

-- CreateIndex
CREATE INDEX "PriceHistory_updatedBy_idx" ON "PriceHistory"("updatedBy");

-- CreateIndex
CREATE INDEX "PriceHistory_updatedAt_idx" ON "PriceHistory"("updatedAt");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
