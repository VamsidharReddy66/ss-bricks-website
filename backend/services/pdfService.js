const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { prisma } = require('../config/database');
const template = require('../config/quotationTemplate');

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
});

function decimal(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return `Rs. ${decimal(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrapText(text, font, size, width) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function fitText(text, font, field) {
  let size = field.size;
  const minSize = Math.min(5.5, size);
  while (size > minSize && font.widthOfTextAtSize(String(text), size) > field.width) size -= 0.25;
  return size;
}

function drawField(page, font, boldFont, value, field, options = {}) {
  const text = String(value ?? '');
  const selectedFont = options.bold ? boldFont : font;
  const maxLines = field.maxLines || 1;
  let size = maxLines > 1 ? field.size : fitText(text, selectedFont, field);
  let lines = maxLines > 1 ? wrapText(text, selectedFont, size, field.width) : [text];
  while (lines.length > maxLines && size > 5.5) {
    size -= 0.25;
    lines = wrapText(text, selectedFont, size, field.width);
  }
  lines = lines.slice(0, maxLines);
  lines.forEach((line, index) => {
    const textWidth = selectedFont.widthOfTextAtSize(line, size);
    let x = field.x;
    if (field.align === 'right') x = field.x + field.width - textWidth;
    if (field.align === 'center') x = field.x + ((field.width - textWidth) / 2);
    page.drawText(line, {
      x,
      y: field.y - (index * (field.lineHeight || size + 2)),
      size,
      font: selectedFont,
      color: rgb(0.08, 0.08, 0.08),
    });
  });
}

function quotationValues(data) {
  const { customer, quote } = data;
  return {
    quotationNumber: `No: ${quote.enquiryNumber}`,
    quotationDate: `Date: ${DATE_FORMAT.format(new Date(quote.createdAt))}`,
    customerName: customer.name,
    customerPhone: customer.phone,
    deliveryAddress: customer.location,
    serialNumber: '1',
    particulars: quote.product,
    quantity: Number(quote.quantity || 0).toLocaleString('en-IN'),
    unitPrice: money(quote.quotedUnitPrice),
    lineAmount: money(quote.lineAmount),
    subtotal: money(quote.subtotal),
    cgstRate: decimal(quote.cgstRate),
    cgstAmount: money(quote.cgstAmount),
    sgstRate: decimal(quote.sgstRate),
    sgstAmount: money(quote.sgstAmount),
    igstRate: decimal(quote.igstRate),
    igstAmount: money(quote.igstAmount),
    grandTotal: money(quote.grandTotal),
    amountInWords: quote.amountInWords,
  };
}

async function createQuotePdfBuffer(data) {
  const templateBytes = fs.readFileSync(template.templatePath);
  const document = await PDFDocument.create();
  const [templatePage] = await document.embedPdf(templateBytes, [0]);
  const page = document.addPage([template.page.width, template.page.height]);
  page.drawPage(templatePage, {
    x: 0,
    y: 0,
    width: template.page.width,
    height: template.page.height,
  });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const values = quotationValues(data);

  Object.entries(template.fields).forEach(([name, field]) => {
    drawField(page, font, boldFont, values[name], field, {
      bold: ['quotationNumber', 'grandTotal'].includes(name),
    });
  });

  document.setTitle(`Quotation ${data.quote.enquiryNumber}`);
  document.setSubject('SS Bricks quotation');
  document.setCreator('SS Bricks');
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

async function generateAndStoreQuotePdf(data, prismaClient = prisma) {
  const fileName = `quotation-${data.quote.enquiryNumber}.pdf`;
  const pdfUrl = `/api/quotes/${encodeURIComponent(data.quote.enquiryNumber)}/pdf`;
  const content = await createQuotePdfBuffer(data);

  await prismaClient.quoteDocument.upsert({
    where: { quoteRequestId: data.quote.id },
    update: { fileName, contentType: 'application/pdf', content },
    create: { quoteRequestId: data.quote.id, fileName, contentType: 'application/pdf', content },
  });
  await prismaClient.quoteRequest.update({ where: { id: data.quote.id }, data: { pdfUrl } });
  return { fileName, content, contentType: 'application/pdf', pdfUrl };
}

module.exports = { createQuotePdfBuffer, generateAndStoreQuotePdf, quotationValues, wrapText };
