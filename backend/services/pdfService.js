const { prisma } = require('../config/database');

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

function display(value) {
  return value === null || value === undefined || value === '' ? 'Not provided' : String(value);
}

function displayDate(value) {
  if (!value) return 'Not provided';
  return DATE_FORMAT.format(new Date(value));
}

function pdfHex(value) {
  const input = display(value);
  const utf16le = Buffer.from(input, 'utf16le');
  const bytes = [0xfe, 0xff];
  for (let index = 0; index < utf16le.length; index += 2) {
    bytes.push(utf16le[index + 1], utf16le[index]);
  }
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

function wrapText(value, maxLength = 72) {
  const words = display(value).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : ['Not provided'];
}

function quoteRows(data) {
  const { customer, quote } = data;
  return [
    ['Enquiry Number', quote.enquiryNumber],
    ['Submitted Date', DATE_FORMAT.format(new Date(quote.createdAt))],
    ['Submitted Time', TIME_FORMAT.format(new Date(quote.createdAt))],
    ['Customer Name', customer.name],
    ['Phone Number', customer.phone],
    ['Location', customer.location],
    ['Product', quote.product],
    ['Quantity', Number(quote.quantity).toLocaleString('en-IN')],
    ['Requested Delivery Date', displayDate(quote.deliveryDate)],
    ['Message', display(quote.message)],
    ['Status', quote.status],
    ['Source', quote.source || 'WEBSITE'],
  ];
}

function textLine(x, y, size, text, font = 'F1') {
  return `BT /${font} ${size} Tf ${x} ${y} Td <${pdfHex(text)}> Tj ET`;
}

function createQuotePdfBuffer(data) {
  const rows = quoteRows(data);
  const lines = [
    '0.90 0.12 0.09 rg 54 760 70 48 re f',
    textLine(72, 775, 22, 'SS', 'F2'),
    '0.13 0.14 0.16 rg',
    textLine(140, 785, 24, 'SS Bricks', 'F2'),
    textLine(140, 766, 10, 'Professional Quotation Request', 'F1'),
    '0.70 0.15 0.11 RG 54 742 488 1 re S',
    textLine(54, 710, 18, `Quotation - ${data.quote.enquiryNumber}`, 'F2'),
    textLine(54, 690, 10, 'Generated automatically from the SS Bricks ERP quote pipeline.', 'F1'),
  ];

  let y = 650;
  for (const [label, value] of rows) {
    lines.push('0.95 0.93 0.89 rg 54 ' + (y - 8) + ' 150 24 re f');
    lines.push('0.82 0.80 0.75 RG 54 ' + (y - 8) + ' 488 24 re S');
    lines.push('0.13 0.14 0.16 rg');
    lines.push(textLine(66, y, 10, label, 'F2'));

    const wrapped = wrapText(value, 54);
    lines.push(textLine(220, y, 10, wrapped[0], 'F1'));
    y -= 30;
    for (const extra of wrapped.slice(1, 3)) {
      lines.push(textLine(220, y, 10, extra, 'F1'));
      y -= 14;
    }
  }

  lines.push('0.70 0.15 0.11 RG 54 74 488 1 re S');
  lines.push(textLine(54, 54, 9, 'Generated automatically by SS Bricks ERP.', 'F1'));
  lines.push(textLine(54, 40, 9, 'This document is system generated for internal quotation follow-up.', 'F1'));

  const content = lines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, 'latin1');
}

async function generateAndStoreQuotePdf(data, prismaClient = prisma) {
  const fileName = `${data.quote.enquiryNumber}.pdf`;
  const pdfUrl = `/api/quotes/${encodeURIComponent(data.quote.enquiryNumber)}/pdf`;
  const content = createQuotePdfBuffer(data);

  await prismaClient.quoteDocument.upsert({
    where: {
      quoteRequestId: data.quote.id,
    },
    update: {
      fileName,
      contentType: 'application/pdf',
      content,
    },
    create: {
      quoteRequestId: data.quote.id,
      fileName,
      contentType: 'application/pdf',
      content,
    },
  });

  await prismaClient.quoteRequest.update({
    where: {
      id: data.quote.id,
    },
    data: {
      pdfUrl,
    },
  });

  return {
    fileName,
    content,
    contentType: 'application/pdf',
    pdfUrl,
  };
}

module.exports = {
  createQuotePdfBuffer,
  generateAndStoreQuotePdf,
  quoteRows,
};
