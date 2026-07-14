const { prisma } = require('../config/database');
const { EmailService } = require('./emailService');
const { GoogleSheetsService } = require('./googleSheetsService');
const { generateAndStoreQuotePdf } = require('./pdfService');
const { WhatsAppService } = require('./whatsappService');

function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

class NotificationService {
  constructor({
    prismaClient = prisma,
    emailService = new EmailService(),
    googleSheetsService = new GoogleSheetsService(),
    whatsappService = new WhatsAppService(),
    pdfGenerator = generateAndStoreQuotePdf,
    logger = console,
  } = {}) {
    this.prisma = prismaClient;
    this.emailService = emailService;
    this.googleSheetsService = googleSheetsService;
    this.whatsappService = whatsappService;
    this.pdfGenerator = pdfGenerator;
    this.logger = logger;
  }

  async logNotification(quoteId, type, recipient, status, failure) {
    try {
      await this.prisma.notificationLog.create({
        data: {
          quoteRequestId: quoteId,
          type,
          recipient,
          status,
          ...(failure ? { errorMessage: failure } : {}),
        },
      });
    } catch (logError) {
      this.logger.error(
        `Could not save ${type} notification log for quote ${quoteId}.`,
        logError,
      );
    }
  }

  async addActivity(quoteId, note) {
    try {
      await this.prisma.leadActivity.create({
        data: {
          leadId: quoteId,
          type: 'NOTE',
          note,
        },
      });
    } catch (error) {
      this.logger.error(`Could not save quote pipeline activity for ${quoteId}.`, error);
    }
  }

  async notifyQuoteCreated(data) {
    const pipeline = {
      pdfGenerated: false,
      sheetUpdated: false,
      emailSent: false,
      whatsappSent: false,
    };
    const result = {
      pdf: null,
      googleSheet: null,
      email: null,
      whatsapp: null,
    };

    try {
      const pdf = data.pdf || await this.pdfGenerator(data, this.prisma);
      result.pdf = { status: 'SUCCESS', pdfUrl: pdf.pdfUrl, fileName: pdf.fileName };
      data.pdf = pdf;
      data.quote.pdfUrl = pdf.pdfUrl;
      pipeline.pdfGenerated = true;
      await this.logNotification(data.quote.id, 'PDF', pdf.pdfUrl, 'SUCCESS');
      await this.addActivity(data.quote.id, `PDF generated: ${pdf.fileName}.`);
    } catch (error) {
      const failure = errorMessage(error);
      result.pdf = { status: 'FAILED', errorMessage: failure };
      await this.logNotification(data.quote.id, 'PDF', 'INTERNAL', 'FAILED', failure);
      await this.addActivity(data.quote.id, `PDF generation failed: ${failure}`);
    }

    const recipient = this.emailService.getRecipient();
    try {
      await this.emailService.sendQuoteNotification(data);
      result.email = { status: 'SUCCESS' };
      pipeline.emailSent = true;
      await this.logNotification(data.quote.id, 'EMAIL', recipient, 'SUCCESS');
      await this.addActivity(data.quote.id, 'Email sent with quotation PDF.');
    } catch (error) {
      const failure = errorMessage(error);
      result.email = { status: 'FAILED', errorMessage: failure };
      await this.logNotification(data.quote.id, 'EMAIL', recipient, 'FAILED', failure);
      await this.addActivity(data.quote.id, `Email failed: ${failure}`);
    }

    try {
      const whatsappResult = await this.whatsappService.sendQuoteDocument(data, data.pdf);
      result.whatsapp = whatsappResult.status === 'SUCCESS'
        ? { status: 'SUCCESS' }
        : { status: 'FALLBACK', message: whatsappResult.message };
      pipeline.whatsappSent = whatsappResult.status === 'SUCCESS';
      await this.logNotification(data.quote.id, 'WHATSAPP', 'WhatsApp', 'SUCCESS');
      await this.addActivity(
        data.quote.id,
        whatsappResult.status === 'SUCCESS'
          ? 'WhatsApp PDF sent.'
          : 'WhatsApp fallback used; website text message remains available.',
      );
    } catch (error) {
      const failure = errorMessage(error);
      result.whatsapp = { status: 'FAILED', errorMessage: failure };
      await this.logNotification(data.quote.id, 'WHATSAPP', 'WhatsApp', 'FAILED', failure);
      await this.addActivity(data.quote.id, `WhatsApp failed: ${failure}`);
    }

    try {
      await this.googleSheetsService.appendQuote(data, pipeline);
      result.googleSheet = { status: 'SUCCESS' };
      pipeline.sheetUpdated = true;
      await this.logNotification(data.quote.id, 'GOOGLE_SHEET', 'Google Sheet', 'SUCCESS');
      await this.addActivity(data.quote.id, 'Google Sheet updated.');
    } catch (error) {
      const failure = errorMessage(error);
      result.googleSheet = { status: 'FAILED', errorMessage: failure };
      await this.logNotification(data.quote.id, 'GOOGLE_SHEET', 'Google Sheet', 'FAILED', failure);
      await this.addActivity(data.quote.id, `Sheet sync failed: ${failure}`);
    }

    this.logger.info(`Quote distribution pipeline completed for ${data.quote.enquiryNumber}.`);
    return result;
  }
}

module.exports = {
  NotificationService,
};
