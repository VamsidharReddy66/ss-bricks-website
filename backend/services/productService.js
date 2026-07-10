const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');

const defaultProducts = [
  {
    name: 'Fly Ash Bricks',
    slug: 'fly-ash-bricks',
    description: 'Premium fly ash bricks manufactured under high hydraulic pressure using industrial fly ash, cement, sand, and water. Stronger, lighter, and more eco-friendly than traditional red clay bricks. Ideal for all types of construction in Tirupati and Andhra Pradesh.',
    standardPrice: '8.50',
    bulkPrice: '8.10',
    bulkQuantity: 10000,
    unit: 'brick',
    image: 'images/fly-ash-bricks.png',
  },
  {
    name: 'Solid Cement Blocks',
    slug: 'solid-cement-blocks',
    description: 'Heavy-duty solid cement blocks designed for demanding structural applications. Manufactured with a superior cement-aggregate ratio, these blocks deliver exceptional load-bearing performance, perfect for large commercial and industrial projects.',
    standardPrice: '42.00',
    bulkPrice: '39.00',
    bulkQuantity: 2000,
    unit: 'block',
    image: 'images/solid-cement-blocks.png',
  },
  {
    name: 'Paver Blocks',
    slug: 'paver-blocks',
    description: 'Elegant interlocking paver blocks that combine aesthetic appeal with functional strength. Available in multiple shapes and colour options to complement residential driveways, commercial parking areas, pathways, and landscaped gardens.',
    standardPrice: '55.00',
    bulkPrice: '50.00',
    bulkQuantity: 5000,
    unit: 'sq.ft',
    image: 'images/paver-blocks.png',
  },
  {
    name: 'Mud Bricks',
    slug: 'mud-bricks',
    description: 'Handcrafted using natural earth materials, our eco-friendly mud bricks bring the warmth of traditional construction with modern quality control. A sustainable choice for builders who want comfort, aesthetics, and a lower carbon footprint.',
    standardPrice: '12.00',
    bulkPrice: '11.20',
    bulkQuantity: 8000,
    unit: 'brick',
    image: 'images/mud-bricks.png',
  },
];

function toMoney(value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    standardPrice: Number(product.standardPrice),
    bulkPrice: Number(product.bulkPrice),
    bulkQuantity: product.bulkQuantity,
    unit: product.unit,
    image: product.image,
    availability: product.availability,
    updatedAt: product.updatedAt,
  };
}

async function ensureDefaultProducts() {
  for (const product of defaultProducts) {
    await prisma.product.upsert({
      where: {
        slug: product.slug,
      },
      update: {},
      create: {
        ...product,
        standardPrice: toMoney(product.standardPrice),
        bulkPrice: toMoney(product.bulkPrice),
      },
    });
  }
}

async function listProducts() {
  const products = await prisma.product.findMany({
    orderBy: {
      id: 'asc',
    },
  });

  return products.map(serializeProduct);
}

async function getProductBySlug(slug) {
  const product = await prisma.product.findUnique({
    where: {
      slug,
    },
  });

  return product ? serializeProduct(product) : null;
}

async function ensureQuoteProductExists(productName) {
  const product = await prisma.product.findFirst({
    where: {
      name: productName,
      availability: 'IN_STOCK',
    },
    select: {
      id: true,
    },
  });

  return Boolean(product);
}

async function updateProduct(productId, payload, adminId) {
  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      throw error;
    }

    const nextStandardPrice = toMoney(payload.standardPrice);
    const nextBulkPrice = toMoney(payload.bulkPrice);
    const historyRows = [];

    if (!existing.standardPrice.equals(nextStandardPrice)) {
      historyRows.push({
        productId: id,
        oldPrice: existing.standardPrice,
        newPrice: nextStandardPrice,
        priceType: 'STANDARD',
        updatedBy: adminId,
      });
    }

    if (!existing.bulkPrice.equals(nextBulkPrice)) {
      historyRows.push({
        productId: id,
        oldPrice: existing.bulkPrice,
        newPrice: nextBulkPrice,
        priceType: 'BULK',
        updatedBy: adminId,
      });
    }

    const updated = await tx.product.update({
      where: {
        id,
      },
      data: {
        standardPrice: nextStandardPrice,
        bulkPrice: nextBulkPrice,
        bulkQuantity: payload.bulkQuantity,
        availability: payload.availability,
        description: payload.description,
      },
    });

    if (historyRows.length) {
      await tx.priceHistory.createMany({
        data: historyRows,
      });
    }

    return serializeProduct(updated);
  });
}

async function listPriceHistory(limit = 50) {
  const history = await prisma.priceHistory.findMany({
    take: limit,
    orderBy: {
      updatedAt: 'desc',
    },
    include: {
      product: {
        select: {
          name: true,
          unit: true,
        },
      },
      admin: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return history.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    unit: item.product.unit,
    oldPrice: Number(item.oldPrice),
    newPrice: Number(item.newPrice),
    priceType: item.priceType,
    updatedBy: item.admin.name || item.admin.email,
    updatedAt: item.updatedAt,
  }));
}

async function getProductStats() {
  const [productCount, latestPriceUpdate] = await Promise.all([
    prisma.product.count(),
    prisma.priceHistory.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        updatedAt: true,
      },
    }),
  ]);

  return {
    productCount,
    lastPriceUpdate: latestPriceUpdate?.updatedAt || null,
  };
}

module.exports = {
  ensureDefaultProducts,
  ensureQuoteProductExists,
  getProductBySlug,
  getProductStats,
  listPriceHistory,
  listProducts,
  updateProduct,
};
