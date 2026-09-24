const path = require('path');

module.exports = Object.freeze({
  templatePath: path.resolve(__dirname, '../../docs/quotation-template.pdf'),
  page: { width: 419.528, height: 595.276 },
  fields: {
    quotationNumber: { x: 277, y: 462, width: 112, size: 6.5, align: 'right' },
    quotationDate: { x: 277, y: 452, width: 112, size: 6.5, align: 'right' },
    customerName: { x: 73, y: 438, width: 315, size: 8 },
    customerPhone: { x: 79, y: 423.5, width: 309, size: 8 },
    deliveryAddress: { x: 102, y: 409, width: 286, size: 8, maxLines: 2, lineHeight: 11 },
    serialNumber: { x: 31, y: 342, width: 23, size: 8, align: 'center' },
    particulars: { x: 61, y: 342, width: 154, size: 8 },
    quantity: { x: 220, y: 342, width: 46, size: 8, align: 'center' },
    unitPrice: { x: 270, y: 342, width: 34, size: 8, align: 'right' },
    lineAmount: { x: 309, y: 342, width: 78, size: 8, align: 'right' },
    subtotal: { x: 309, y: 221, width: 78, size: 8, align: 'right' },
    cgstRate: { x: 269, y: 202, width: 34, size: 7, align: 'center' },
    cgstAmount: { x: 309, y: 202, width: 78, size: 8, align: 'right' },
    sgstRate: { x: 269, y: 184, width: 34, size: 7, align: 'center' },
    sgstAmount: { x: 309, y: 184, width: 78, size: 8, align: 'right' },
    igstRate: { x: 269, y: 167, width: 34, size: 7, align: 'center' },
    igstAmount: { x: 309, y: 167, width: 78, size: 8, align: 'right' },
    grandTotal: { x: 309, y: 150, width: 78, size: 8.5, align: 'right' },
    amountInWords: { x: 33, y: 153, width: 181, size: 7, maxLines: 2, lineHeight: 9 },
  },
});
