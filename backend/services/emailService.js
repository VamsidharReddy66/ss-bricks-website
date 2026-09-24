const nodemailer = require('nodemailer');
const env = require('../config/env');
const { validateSmtpConfig, smtpTransportOptions } = require('../config/smtp');
const { createQuoteEmailTemplate } = require('./emailTemplate');

class EmailService {
  constructor({ config = env.smtp, createTransport = nodemailer.createTransport } = {}) {
    this.config = config;
    this.createTransport = createTransport;
  }

  getRecipient(data) {
    return data?.customer?.email || this.config.recipient || 'UNCONFIGURED';
  }

  async sendQuoteNotification(data) {
    const validation = validateSmtpConfig(this.config);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.code = 'SMTP_CONFIG_INVALID';
      throw error;
    }

    const transporter = this.createTransport(smtpTransportOptions(this.config));
    const template = createQuoteEmailTemplate(data);

    const recipient = this.getRecipient(data);
    const adminCopy = this.config.recipient && this.config.recipient !== recipient
      ? this.config.recipient
      : undefined;

    return transporter.sendMail({
      from: `"SS Bricks Website" <${this.config.user}>`,
      to: recipient,
      ...(adminCopy ? { bcc: adminCopy } : {}),
      subject: template.subject,
      text: template.text,
      html: template.html,
      attachments: data.pdf ? [
        {
          filename: data.pdf.fileName,
          content: data.pdf.content,
          contentType: data.pdf.contentType,
        },
      ] : [],
    });
  }
}

module.exports = {
  EmailService,
};
