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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? 'Not provided' : String(value);
}

function displayDate(value) {
  if (!value) return 'Not provided';
  return DATE_FORMAT.format(new Date(value));
}

function quoteFields({ quote, customer }) {
  return [
    ['Enquiry Number', quote.enquiryNumber],
    ['Customer Name', customer.name],
    ['Phone Number', customer.phone],
    ['Location', customer.location],
    ['Product', quote.product],
    ['Quantity', quote.quantity],
    ['Requested Delivery Date', displayDate(quote.deliveryDate)],
    ['Message', displayValue(quote.message)],
    ['Status', quote.status],
    ['Submitted Date', DATE_FORMAT.format(new Date(quote.createdAt))],
    ['Submitted Time', TIME_FORMAT.format(new Date(quote.createdAt))],
  ];
}

function createQuoteEmailTemplate(data) {
  const fields = quoteFields(data);
  const subject = `New Quote Request | ${data.quote.enquiryNumber}`;
  const text = [
    'A new quotation request has been received from the website.',
    '',
    ...fields.flatMap(([label, value]) => [label, displayValue(value), '']),
  ].join('\n');

  const rows = fields
    .map(
      ([label, value]) => `
        <tr>
          <th style="padding:10px 12px;text-align:left;border:1px solid #d9dee5;background:#f5f7f9;width:38%">${escapeHtml(label)}</th>
          <td style="padding:10px 12px;border:1px solid #d9dee5">${escapeHtml(displayValue(value))}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:24px;background:#f2f4f7;color:#20252b;font-family:Arial,sans-serif">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d9dee5">
          <div style="padding:20px 24px;background:#b42318;color:#ffffff">
            <h1 style="margin:0;font-size:22px">New Quote Request</h1>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 18px">A new quotation request has been received from the website.</p>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
              ${rows}
            </table>
          </div>
        </div>
      </body>
    </html>`;

  return {
    subject,
    text,
    html,
  };
}

module.exports = {
  createQuoteEmailTemplate,
};
