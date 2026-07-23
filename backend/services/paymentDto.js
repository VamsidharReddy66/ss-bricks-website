function number(value) {
  return value === null || value === undefined ? null : Number(value);
}

function paymentDto(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    quotationId: payment.quotationId,
    quotationNumber: payment.quotation?.enquiryNumber || null,
    customerName: payment.customerName,
    customerPhone: payment.customerPhone,
    customerEmail: payment.customerEmail,
    orderId: payment.razorpayOrderId,
    paymentId: payment.razorpayPaymentId,
    amount: number(payment.amount),
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    failureReason: payment.failureReason,
    receiptUrl: payment.receiptUrl,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function publicQuotationDto(quotation) {
  const successfulPayment = quotation.payments?.find((payment) => payment.status === 'SUCCESS') || null;
  return {
    quotationNumber: quotation.enquiryNumber,
    product: quotation.product,
    quantity: quotation.quantity,
    finalAmount: number(quotation.finalAmount),
    currency: 'INR',
    customer: {
      name: quotation.customer.name,
      phone: quotation.customer.phone,
      email: quotation.customer.email,
    },
    payment: paymentDto(successfulPayment),
  };
}

module.exports = {
  paymentDto,
  publicQuotationDto,
};
