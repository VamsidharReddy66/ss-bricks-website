const env = require('../config/env');

class WhatsAppService {
  constructor({ config = env.whatsapp, phone = env.whatsappPhone, fetchImpl = globalThis.fetch } = {}) {
    this.config = config;
    this.phone = phone;
    this.fetch = fetchImpl;
  }

  async sendQuoteDocument(data, pdf) {
    const caption = [
      'New quotation request received.',
      `Enquiry ID: ${data.quote.enquiryNumber}`,
      `Customer: ${data.customer.name}`,
      `Product: ${data.quote.product}`,
      `Quantity: ${data.quote.quantity}`,
    ].join('\n');

    if (!this.config.providerUrl || !this.config.accessToken) {
      return {
        status: 'FALLBACK',
        caption,
        message: 'WhatsApp document provider is not configured. Existing website text fallback remains active.',
      };
    }

    const response = await this.fetch(this.config.providerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: this.phone,
        type: 'document',
        caption,
        fileName: pdf.fileName,
        contentType: pdf.contentType,
        documentBase64: pdf.content.toString('base64'),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || result.error || 'WhatsApp document send failed.');
    }

    return {
      status: 'SUCCESS',
      caption,
      providerResponse: result,
    };
  }
}

module.exports = {
  WhatsAppService,
};
