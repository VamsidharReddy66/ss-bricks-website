const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

function pdfHex(value) {
  const utf16le = Buffer.from(String(value ?? ''), 'utf16le');
  const bytes = [0xfe, 0xff];
  for (let index = 0; index < utf16le.length; index += 2) {
    bytes.push(utf16le[index + 1], utf16le[index]);
  }
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

function textLine(x, y, size, text, font = 'F1') {
  return `BT /${font} ${size} Tf ${x} ${y} Td <${pdfHex(text)}> Tj ET`;
}

function assemblePdf(lines) {
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
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function createPaymentReceipt({ payment, quotation }) {
  const amount = Number(payment.amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const rows = [
    ['Quotation Number', quotation.enquiryNumber],
    ['Customer', payment.customerName],
    ['Phone', payment.customerPhone],
    ['Amount Paid', `${payment.currency} ${amount}`],
    ['Payment Method', payment.paymentMethod || 'Not provided'],
    ['Payment ID', payment.razorpayPaymentId],
    ['Order ID', payment.razorpayOrderId],
    ['Payment Status', payment.status],
    ['Payment Date', DATE_TIME_FORMAT.format(new Date(payment.updatedAt || new Date()))],
  ];
  const lines = [
    '0.49 0.08 0.06 rg 54 760 70 48 re f',
    textLine(72, 775, 22, 'SS', 'F2'),
    '0.13 0.14 0.16 rg',
    textLine(140, 785, 24, 'SS Bricks', 'F2'),
    textLine(140, 766, 10, 'Test Mode Payment Receipt', 'F1'),
    '0.49 0.08 0.06 RG 54 742 488 1 re S',
    textLine(54, 710, 18, 'Payment Receipt', 'F2'),
    textLine(54, 690, 10, 'Razorpay Test Mode - no real money was processed.', 'F1'),
  ];

  let y = 645;
  rows.forEach(([label, value]) => {
    lines.push('0.95 0.93 0.89 rg 54 ' + (y - 8) + ' 150 24 re f');
    lines.push('0.82 0.80 0.75 RG 54 ' + (y - 8) + ' 488 24 re S');
    lines.push('0.13 0.14 0.16 rg');
    lines.push(textLine(66, y, 10, label, 'F2'));
    lines.push(textLine(220, y, 10, value || 'Not provided', 'F1'));
    y -= 34;
  });

  lines.push('0.49 0.08 0.06 RG 54 74 488 1 re S');
  lines.push(textLine(54, 54, 9, 'This receipt confirms a simulated Razorpay Test Mode transaction.', 'F1'));
  lines.push(textLine(54, 40, 9, 'Generated automatically by SS Bricks ERP.', 'F1'));

  return assemblePdf(lines);
}

module.exports = {
  createPaymentReceipt,
};
