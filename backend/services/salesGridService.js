const crypto = require('crypto');
const { prisma } = require('../config/database');
const { parseDateOnly } = require('../utils/date');

function clientError(message, statusCode, field = 'sales') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.field = field;
  return error;
}

function assertCurrent(record, expectedUpdatedAt, field) {
  if (!record) throw clientError('Sales record not found.', 404, field);
  if (record.updatedAt.toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
    throw clientError('This sales record changed after you opened it. Reload the ledger and try again.', 409, field);
  }
}

async function validatedProduct(tx, productName, field) {
  const product = await tx.product.findFirst({
    where: {
      name: {
        equals: productName,
        mode: 'insensitive',
      },
    },
  });
  if (!product) throw clientError('Select a product currently configured in SS Bricks.', 400, field);
  return product;
}

async function updateOfflineRow(tx, update, index) {
  const field = `updates.${index}`;
  const existing = await tx.offlineSale.findUnique({ where: { id: update.id } });
  assertCurrent(existing, update.expectedUpdatedAt, field);
  const product = await validatedProduct(tx, update.data.product, `${field}.data.product`);
  await tx.offlineSale.update({
    where: { id: update.id },
    data: {
      customerName: update.data.customerName,
      customerPhone: update.data.customerPhone,
      location: update.data.location,
      product: product.name,
      quantity: update.data.quantity,
      unit: product.unit,
      unitPrice: update.data.unitPrice ?? product.standardPrice,
      invoicedAmount: update.data.invoicedAmount,
      receivedAmount: update.data.receivedAmount,
      saleDate: parseDateOnly(update.data.saleDate),
      receivedDate: update.data.receivedDate ? parseDateOnly(update.data.receivedDate) : null,
      paymentMethod: update.data.paymentMethod,
      notes: update.data.notes,
    },
  });
}

async function updateQuoteRow(tx, update, index, adminId) {
  const field = `updates.${index}`;
  const existing = await tx.quoteRequest.findUnique({
    where: { id: update.id },
    include: {
      customer: true,
      payments: {
        select: {
          status: true,
        },
      },
    },
  });
  assertCurrent(existing, update.expectedUpdatedAt, field);

  const product = await validatedProduct(tx, update.data.product, `${field}.data.product`);
  const nextAmount = Number(update.data.invoicedAmount);
  const amountChanged = existing.finalAmount === null || Number(existing.finalAmount) !== nextAmount;
  if (amountChanged && existing.payments.some((payment) => payment.status === 'SUCCESS')) {
    throw clientError(
      'The invoiced amount cannot be changed after a successful online payment.',
      409,
      `${field}.data.invoicedAmount`,
    );
  }

  const customer = await tx.customer.upsert({
    where: { phone: update.data.customerPhone },
    update: {
      name: update.data.customerName,
      location: update.data.location,
    },
    create: {
      name: update.data.customerName,
      phone: update.data.customerPhone,
      email: existing.customer.email,
      location: update.data.location,
    },
  });

  const detailChanged = existing.customerId !== customer.id
    || existing.customer.name !== update.data.customerName
    || existing.customer.location !== update.data.location
    || existing.product !== product.name
    || existing.quantity !== update.data.quantity
    || amountChanged;

  await tx.quoteRequest.update({
    where: { id: update.id },
    data: {
      customerId: customer.id,
      product: product.name,
      quantity: update.data.quantity,
      finalAmount: nextAmount,
      paymentToken: existing.paymentToken || crypto.randomBytes(24).toString('hex'),
      paymentEnabledAt: existing.paymentEnabledAt || new Date(),
    },
  });

  if (amountChanged) {
    await tx.payment.updateMany({
      where: { quotationId: update.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: 'Quotation amount was updated before payment completion.',
      },
    });
  }

  if (detailChanged) {
    await tx.leadActivity.create({
      data: {
        leadId: update.id,
        type: 'NOTE',
        note: 'Sales ledger details updated.',
        createdBy: adminId,
      },
    });
  }
}

async function updateSalesGrid(payload, adminId) {
  return prisma.$transaction(async (tx) => {
    for (let index = 0; index < payload.updates.length; index += 1) {
      const update = payload.updates[index];
      if (update.type === 'OFFLINE') {
        await updateOfflineRow(tx, update, index);
      } else {
        await updateQuoteRow(tx, update, index, adminId);
      }
    }
    return {
      updated: payload.updates.length,
    };
  });
}

module.exports = {
  _private: {
    assertCurrent,
  },
  updateSalesGrid,
};
