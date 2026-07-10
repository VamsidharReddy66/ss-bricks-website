const { prisma } = require('../config/database');
const { EmailService } = require('./emailService');

function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

class NotificationService {
  constructor({
    prismaClient = prisma,
    emailService = new EmailService(),
    logger = console,
  } = {}) {
    this.prisma = prismaClient;
    this.emailService = emailService;
    this.logger = logger;
  }

  async notifyQuoteCreated(data) {
    const recipient = this.emailService.getRecipient();
    let status = 'SUCCESS';
    let failure;

    try {
      await this.emailService.sendQuoteNotification(data);
    } catch (error) {
      status = 'FAILED';
      failure = errorMessage(error);
    }

    try {
      await this.prisma.notificationLog.create({
        data: {
          quoteRequestId: data.quote.id,
          type: 'EMAIL',
          recipient,
          status,
          ...(failure ? { errorMessage: failure } : {}),
        },
      });
    } catch (logError) {
      this.logger.error(
        `Could not save email notification log for ${data.quote.enquiryNumber}.`,
        logError,
      );
    }

    if (status === 'SUCCESS') {
      this.logger.info(`Quote email sent for ${data.quote.enquiryNumber} to ${recipient}.`);
      return { status: 'SUCCESS' };
    }

    this.logger.error(`Quote email failed for ${data.quote.enquiryNumber}: ${failure}`);
    return { status: 'FAILED', errorMessage: failure };
  }
}

module.exports = {
  NotificationService,
};
