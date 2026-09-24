const { Prisma } = require('@prisma/client');

const TAX_POLICY = Object.freeze({ cgstRate: 0, sgstRate: 0, igstRate: 0 });

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underThousand(value) {
  const words = [];
  let remaining = value;
  if (remaining >= 100) {
    words.push(`${ONES[Math.floor(remaining / 100)]} Hundred`);
    remaining %= 100;
  }
  if (remaining >= 20) {
    words.push(TENS[Math.floor(remaining / 10)]);
    remaining %= 10;
  }
  if (remaining > 0) words.push(ONES[remaining]);
  return words.join(' ');
}

function integerToIndianWords(value) {
  if (value === 0) return 'Zero';
  const groups = [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
  ];
  const words = [];
  let remaining = value;
  groups.forEach(([divisor, label]) => {
    if (remaining >= divisor) {
      const count = Math.floor(remaining / divisor);
      words.push(`${underThousand(count)} ${label}`);
      remaining %= divisor;
    }
  });
  if (remaining > 0) words.push(underThousand(remaining));
  return words.join(' ');
}

function amountToWords(value) {
  const amount = new Prisma.Decimal(value).toDecimalPlaces(2);
  const rupees = Math.floor(amount.toNumber());
  const paise = amount.minus(rupees).mul(100).round().toNumber();
  return `${integerToIndianWords(rupees)} Rupees${paise ? ` and ${integerToIndianWords(paise)} Paise` : ''} Only`;
}

function calculateQuotation(product, quantity, options = {}) {
  const requestedQuantity = Number(quantity);
  const useBulkPrice = options.forceStandardPrice !== true
    && requestedQuantity >= Number(product.bulkQuantity);
  const unitPrice = new Prisma.Decimal(useBulkPrice ? product.bulkPrice : product.standardPrice).toDecimalPlaces(2);
  const lineAmount = unitPrice.mul(requestedQuantity).toDecimalPlaces(2);
  const subtotal = lineAmount;
  const cgstRate = new Prisma.Decimal(TAX_POLICY.cgstRate);
  const sgstRate = new Prisma.Decimal(TAX_POLICY.sgstRate);
  const igstRate = new Prisma.Decimal(TAX_POLICY.igstRate);
  const cgstAmount = subtotal.mul(cgstRate).div(100).toDecimalPlaces(2);
  const sgstAmount = subtotal.mul(sgstRate).div(100).toDecimalPlaces(2);
  const igstAmount = subtotal.mul(igstRate).div(100).toDecimalPlaces(2);
  const grandTotal = subtotal.plus(cgstAmount).plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2);

  return {
    productId: product.id,
    productName: product.name,
    unit: product.unit,
    unitPrice,
    lineAmount,
    subtotal,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    grandTotal,
    amountInWords: amountToWords(grandTotal),
    priceType: useBulkPrice ? 'BULK' : 'STANDARD',
  };
}

module.exports = {
  TAX_POLICY,
  amountToWords,
  calculateQuotation,
  integerToIndianWords,
};
