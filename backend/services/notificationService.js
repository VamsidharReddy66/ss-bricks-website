const { prisma } = require('../config/database');
const env = require('../config/env');
const { isUniqueConstraintError } = require('../utils/prisma');
const { EmailService } = require('./emailService');
const { GoogleSheetsService } = require('./googleSheetsService');
const { generateAndStoreQuotePdf } = require('./pdfService');
const wanamasteService = require('./wanamasteService');

function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

function maskedWhatsappRecipient(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? `WhatsApp ending ${digits.slice(-4)}` : 'Customer WhatsApp';
}

class NotificationService {
  constructor({
    prismaClient = prisma,
    emailService = new EmailService(),
    googleSheetsService = new GoogleSheetsService(),
    wanamaste = wanamasteService,
    publicSiteUrl = env.publicSiteUrl,
    pdfGenerator = generateAndStoreQuotePdf,
    logger = console,
  } = {}) {
    this.prisma = prismaClient;
    this.emailService = emailService;
    this.googleSheetsService = googleSheetsService;
    this.wanamaste = wanamaste;
    this.publicSiteUrl = publicSiteUrl;
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

  async claimWanamasteDelivery(data) {
    const deduplicationKey = `WANAMASTE_QUOTE:${data.quote.id}`;
    try {
      await this.prisma.notificationLog.create({
        data: {
          quoteRequestId: data.quote.id,
          type: 'WHATSAPP',
          recipient: maskedWhatsappRecipient(data.customer.phone),
          status: 'PENDING',
          deduplicationKey,
        },
      });
      return deduplicationKey;
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  async completeWanamasteDelivery(deduplicationKey, status, failure = null) {
    try {
      await this.prisma.notificationLog.update({
        where: { deduplicationKey },
        data: {
          status,
          errorMessage: failure,
        },
      });
      return true;
    } catch (_error) {
      this.logger.error('Could not update the WAnamaste delivery status; automatic retry is disabled.');
      return false;
    }
  }

  async sendWanamasteQuotation(data) {
    let deduplicationKey;
    try {
      deduplicationKey = await this.claimWanamasteDelivery(data);
    } catch (_error) {
      this.logger.error(`Could not claim WAnamaste delivery for quote ${data.quote.id}; no send attempted.`);
      return { status: 'FAILED', errorMessage: 'DELIVERY_CLAIM_FAILED' };
    }

    if (!deduplicationKey) {
      return { status: 'SKIPPED', reason: 'ALREADY_CLAIMED' };
    }

    try {
      if (!data.pdf?.pdfUrl || !data.pdf?.fileName) {
        throw new Error('The canonical quotation PDF is unavailable.');
      }

      const phoneNumber = this.wanamaste.normalizeWanamastePhone(data.customer.phone);
      const documentUrl = this.wanamaste.buildPublicDocumentUrl(data.pdf.pdfUrl, {
        origin: this.publicSiteUrl,
      });
      const providerResult = await this.wanamaste.sendQuotationTemplate({
        phoneNumber,
        customerName: data.customer.name,
        quotationNumber: data.quote.enquiryNumber,
        documentUrl,
        documentName: data.pdf.fileName,
      });

      if (!providerResult.success) {
        const failure = providerResult.failureCode
          || (providerResult.httpStatus ? `PROVIDER_HTTP_${providerResult.httpStatus}` : 'PROVIDER_FAILED');
        const ambiguous = ['TIMEOUT', 'NETWORK_ERROR', 'DNS_ERROR', 'TLS_ERROR'].includes(failure);
        const failureStatus = ambiguous ? 'PENDING' : 'FAILED';
        await this.completeWanamasteDelivery(deduplicationKey, failureStatus, failure);
        await this.addActivity(data.quote.id, `WhatsApp quotation failed: ${failure}.`);
        return { status: failureStatus, errorMessage: failure };
      }

      const persisted = await this.completeWanamasteDelivery(deduplicationKey, 'SUCCESS');
      await this.addActivity(data.quote.id, 'WhatsApp quotation accepted by WAnamaste.');
      if (!persisted) {
        return { status: 'PENDING', errorMessage: 'PROVIDER_ACCEPTED_STATUS_PERSISTENCE_FAILED' };
      }
      return { status: 'SUCCESS', providerStatus: providerResult.httpStatus };
    } catch (error) {
      const failure = errorMessage(error);
      await this.completeWanamasteDelivery(deduplicationKey, 'FAILED', failure);
      this.logger.error(`Quote WhatsApp delivery failed for quote ${data.quote.id}: ${failure}`);
      await this.addActivity(data.quote.id, `WhatsApp quotation failed: ${failure}.`);
      return { status: 'FAILED', errorMessage: failure };
    }
  }

  async retryWanamasteQuotation(quoteId, adminId, { confirmation, reason, acknowledgeDuplicateRisk = false } = {}) {
    if (confirmation !== 'RETRY_QUOTATION_WHATSAPP') {
      const error = new Error('confirmation must equal RETRY_QUOTATION_WHATSAPP.'); error.statusCode = 400; throw error;
    }
    const normalizedReason = String(reason || '').trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      const error = new Error('A recovery reason between 5 and 500 characters is required.'); error.statusCode = 400; throw error;
    }
    const id = Number(quoteId);
    if (!Number.isInteger(id) || id <= 0) { const error = new Error('Quotation not found.'); error.statusCode = 404; throw error; }
    const quote = await this.prisma.quoteRequest.findUnique({
      where: { id },
      include: { customer: true, document: true, notificationLogs: { where: { deduplicationKey: `WANAMASTE_QUOTE:${id}` }, take: 1 } },
    });
    if (!quote || !quote.document) { const error = new Error('Quotation or stored PDF not found.'); error.statusCode = 404; throw error; }
    const notification = quote.notificationLogs[0];
    if (!notification) { const error = new Error('No automatic WhatsApp delivery record exists.'); error.statusCode = 409; throw error; }
    if (notification.status === 'SUCCESS') { const error = new Error('Quotation WhatsApp delivery already succeeded.'); error.statusCode = 409; throw error; }
    if (notification.recoveryAttemptCount >= 1) { const error = new Error('The single administrative recovery attempt has already been used.'); error.statusCode = 409; throw error; }
    if ((notification.status === 'PENDING' || notification.status === 'RETRYING') && !acknowledgeDuplicateRisk) {
      const error = new Error('Previous delivery is ambiguous. Resending may result in duplicate WhatsApp messages.'); error.statusCode = 409; throw error;
    }

    const claimed = await this.prisma.notificationLog.updateMany({
      where: { id: notification.id, status: notification.status, recoveryAttemptCount: 0 },
      data: { status: 'RETRYING', recoveryAttemptCount: { increment: 1 }, errorMessage: 'ADMIN_RECOVERY_IN_PROGRESS' },
    });
    if (claimed.count !== 1) { const error = new Error('Another administrator already claimed this recovery.'); error.statusCode = 409; throw error; }

    let newStatus = 'FAILED'; let outcome = 'PROVIDER_FAILED'; let providerStatus = null;
    try {
      const result = await this.wanamaste.sendQuotationTemplate({
        phoneNumber: this.wanamaste.normalizeWanamastePhone(quote.customer.phone),
        customerName: quote.customer.name,
        quotationNumber: quote.enquiryNumber,
        documentUrl: this.wanamaste.buildPublicDocumentUrl(`/api/quotes/${encodeURIComponent(quote.enquiryNumber)}/pdf`, { origin: this.publicSiteUrl }),
        documentName: quote.document.fileName,
      });
      providerStatus = result.httpStatus === null ? null : String(result.httpStatus);
      if (result.success) { newStatus = 'SUCCESS'; outcome = 'ACCEPTED'; }
      else if (['TIMEOUT', 'NETWORK_ERROR', 'DNS_ERROR', 'TLS_ERROR'].includes(result.failureCode)) { newStatus = 'PENDING'; outcome = result.failureCode; }
      else { outcome = result.failureCode || 'PROVIDER_REJECTED'; }
    } catch (error) {
      outcome = errorMessage(error);
    }

    const persisted = await this.prisma.$transaction(async (tx) => {
      await tx.notificationLog.update({ where: { id: notification.id }, data: { status: newStatus, errorMessage: newStatus === 'SUCCESS' ? null : outcome } });
      await tx.whatsAppRecoveryAudit.create({ data: { quoteRequestId: id, notificationLogId: notification.id, adminId, previousStatus: notification.status, newStatus, reason: normalizedReason, providerStatus, outcome } });
      await tx.leadActivity.create({ data: { leadId: id, type: 'NOTE', createdBy: adminId, note: `WhatsApp recovery: ${notification.status} to ${newStatus}. Reason: ${normalizedReason}` } });
      return true;
    }).catch(() => false);
    if (!persisted) return { status: 'PENDING', warning: 'PROVIDER_RESULT_STATUS_PERSISTENCE_FAILED' };
    return { status: newStatus, outcome, warning: notification.status === 'PENDING' ? 'Previous delivery was ambiguous; duplicate risk was acknowledged.' : null };
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
      this.logger.error(`Quote PDF pipeline failed for ${data.quote.enquiryNumber}: ${failure}`);
      await this.logNotification(data.quote.id, 'PDF', 'INTERNAL', 'FAILED', failure);
      await this.addActivity(data.quote.id, `PDF generation failed: ${failure}`);
    }

    const recipient = this.emailService.getRecipient(data);
    try {
      await this.emailService.sendQuoteNotification(data);
      result.email = { status: 'SUCCESS' };
      pipeline.emailSent = true;
      await this.logNotification(data.quote.id, 'EMAIL', recipient, 'SUCCESS');
      await this.addActivity(data.quote.id, 'Email sent with quotation PDF.');
    } catch (error) {
      const failure = errorMessage(error);
      result.email = { status: 'FAILED', errorMessage: failure };
      this.logger.error(`Quote email failed for ${data.quote.enquiryNumber}: ${failure}`);
      await this.logNotification(data.quote.id, 'EMAIL', recipient, 'FAILED', failure);
      await this.addActivity(data.quote.id, `Email failed: ${failure}`);
    }

    result.whatsapp = await this.sendWanamasteQuotation(data);
    pipeline.whatsappSent = result.whatsapp.status === 'SUCCESS';

    try {
      await this.googleSheetsService.appendQuote(data, pipeline);
      result.googleSheet = { status: 'SUCCESS' };
      pipeline.sheetUpdated = true;
      await this.logNotification(data.quote.id, 'GOOGLE_SHEET', 'Google Sheet', 'SUCCESS');
      await this.addActivity(data.quote.id, 'Google Sheet updated.');
    } catch (error) {
      const failure = errorMessage(error);
      result.googleSheet = { status: 'FAILED', errorMessage: failure };
      this.logger.error(`Google Sheets sync failed for ${data.quote.enquiryNumber}: ${failure}`);
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
