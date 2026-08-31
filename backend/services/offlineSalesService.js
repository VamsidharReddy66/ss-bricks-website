const { prisma } = require('../config/database');
const { localDateKey, parseDateOnly } = require('../utils/date');

function notFoundError() {
  const error = new Error('Offline sale not found.');
  error.statusCode = 404;
  return error;
}

function saleStatus(invoicedAmount, receivedAmount, cancelled = false) {
  if (cancelled) return 'CANCELLED';
  const invoiced = Number(invoicedAmount || 0);
  const received = Number(receivedAmount || 0);
  if (invoiced > 0 && received >= invoiced) return 'PAID';
  if (received > 0) return 'PARTIAL';
  return 'OUTSTANDING';
}

function serializeOfflineSale(sale) {
  const invoicedAmount = Number(sale.invoicedAmount);
  const receivedAmount = Number(sale.receivedAmount);
  return {
    id: `offline:${sale.id}`,
    recordId: sale.id,
    type: 'OFFLINE',
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    location: sale.location,
    product: sale.product,
    quantity: sale.quantity,
    unit: sale.unit,
    unitPrice: sale.unitPrice === null ? null : Number(sale.unitPrice),
    invoicedAmount,
    receivedAmount,
    outstandingAmount: Math.max(invoicedAmount - receivedAmount, 0),
    status: saleStatus(invoicedAmount, receivedAmount),
    receivedDate: sale.receivedDate,
    paymentMethod: sale.paymentMethod,
    notes: sale.notes,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    createdBy: sale.admin?.name || null,
  };
}

async function nextSaleNumber(tx) {
  const dateKey = localDateKey();
  const prefix = `SSB-SALE-${dateKey}-`;
  const latest = await tx.offlineSale.findFirst({
    where: {
      saleNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      saleNumber: 'desc',
    },
    select: {
      saleNumber: true,
    },
  });
  const sequence = latest ? Number(latest.saleNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function validatedProduct(tx, productName) {
  const product = await tx.product.findFirst({
    where: {
      name: {
        equals: productName,
        mode: 'insensitive',
      },
    },
  });
  if (!product) {
    const error = new Error('Select a product currently configured in SS Bricks.');
    error.statusCode = 400;
    error.field = 'product';
    throw error;
  }
  return product;
}

function saleData(payload, product) {
  return {
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    location: payload.location,
    product: product.name,
    quantity: payload.quantity,
    unit: product.unit,
    unitPrice: payload.unitPrice ?? product.standardPrice,
    invoicedAmount: payload.invoicedAmount,
    receivedAmount: payload.receivedAmount,
    saleDate: parseDateOnly(payload.saleDate),
    receivedDate: payload.receivedDate ? parseDateOnly(payload.receivedDate) : null,
    paymentMethod: payload.paymentMethod,
    notes: payload.notes,
  };
}

async function createOfflineSale(payload, adminId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const product = await validatedProduct(tx, payload.product);
        const sale = await tx.offlineSale.create({
          data: {
            ...(saleData(payload, product)),
            saleNumber: await nextSaleNumber(tx),
            createdBy: adminId,
          },
          include: {
            admin: {
              select: {
                name: true,
              },
            },
          },
        });
        return serializeOfflineSale(sale);
      });
    } catch (error) {
      if (error.code === 'P2002' && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Could not allocate a sale number.');
}

async function updateOfflineSale(saleId, payload) {
  const id = Number(saleId);
  if (!Number.isInteger(id) || id <= 0) throw notFoundError();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.offlineSale.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw notFoundError();

    const product = await validatedProduct(tx, payload.product);
    const sale = await tx.offlineSale.update({
      where: { id },
      data: saleData(payload, product),
      include: {
        admin: {
          select: {
            name: true,
          },
        },
      },
    });
    return serializeOfflineSale(sale);
  });
}

async function deleteOfflineSale(saleId) {
  const id = Number(saleId);
  if (!Number.isInteger(id) || id <= 0) throw notFoundError();
  try {
    await prisma.offlineSale.delete({
      where: { id },
    });
  } catch (error) {
    if (error.code === 'P2025') throw notFoundError();
    throw error;
  }
}

module.exports = {
  createOfflineSale,
  deleteOfflineSale,
  saleStatus,
  serializeOfflineSale,
  updateOfflineSale,
};
