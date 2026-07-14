const test = require('node:test');
const assert = require('node:assert/strict');
const { EmailService } = require('../services/emailService');
const { NotificationService } = require('../services/notificationService');

const completeConfig = {
  host: 'smtp.example.test',
  port: 587,
  secure: false,
  user: 'sender@example.test',
  password: 'test-app-password',
  recipient: 'admin@example.test',
  connectionTimeout: 100,
  greetingTimeout: 100,
  socketTimeout: 100,
};

const quoteData = {
  customer: {
    name: 'Ramesh',
    phone: '9876543210',
    location: 'Nellore',
  },
  quote: {
    id: 42,
    enquiryNumber: 'SSB-20260703-0008',
    product: 'Fly Ash Bricks',
    quantity: 500,
    deliveryDate: new Date('2026-07-15T00:00:00.000Z'),
    message: 'Need delivery before weekend.',
    status: 'NEW',
    createdAt: new Date('2026-07-03T05:15:00.000Z'),
  },
};

function createHarness(sendQuoteNotification) {
  const logs = [];
  const calls = {
    quoteDeletes: 0,
  };
  const prismaClient = {
    notificationLog: {
      create: async ({ data }) => {
        logs.push(data);
        return data;
      },
    },
    leadActivity: {
      create: async () => ({}),
    },
    quoteRequest: {
      delete: async () => {
        calls.quoteDeletes += 1;
      },
    },
  };
  const logger = {
    info() {},
    error() {},
  };
  const emailService = {
    getRecipient: () => completeConfig.recipient,
    sendQuoteNotification,
  };
  const pdfGenerator = async () => ({
    fileName: `${quoteData.quote.enquiryNumber}.pdf`,
    content: Buffer.from('%PDF-1.4 test'),
    contentType: 'application/pdf',
    pdfUrl: `/api/quotes/${quoteData.quote.enquiryNumber}/pdf`,
  });
  const googleSheetsService = {
    appendQuote: async () => ({ status: 'SUCCESS' }),
  };
  const whatsappService = {
    sendQuoteDocument: async () => ({ status: 'SUCCESS' }),
  };

  return {
    logs,
    calls,
    service: new NotificationService({
      prismaClient,
      emailService,
      googleSheetsService,
      logger,
      pdfGenerator,
      whatsappService,
    }),
  };
}

test('sends an email and records a successful NotificationLog', async () => {
  const harness = createHarness(async () => ({ messageId: 'test-message-id' }));

  const result = await harness.service.notifyQuoteCreated(quoteData);

  assert.equal(result.email.status, 'SUCCESS');
  assert.deepEqual(harness.logs.find((log) => log.type === 'EMAIL'), {
    quoteRequestId: 42,
    type: 'EMAIL',
    recipient: completeConfig.recipient,
    status: 'SUCCESS',
  });
});

for (const scenario of [
  ['SMTP authentication failure', 'EAUTH', 'Authentication failed'],
  ['invalid SMTP credentials', 'EAUTH', 'Invalid login'],
  ['SMTP server unavailable', 'ECONNREFUSED', 'Connection refused'],
  ['email timeout', 'ETIMEDOUT', 'Connection timed out'],
]) {
  test(`${scenario[0]} records failure and preserves the quote`, async () => {
    const smtpError = new Error(scenario[2]);
    smtpError.code = scenario[1];
    const harness = createHarness(async () => {
      throw smtpError;
    });

    const result = await harness.service.notifyQuoteCreated(quoteData);

    assert.equal(result.email.status, 'FAILED');
    const emailLog = harness.logs.find((log) => log.type === 'EMAIL');
    assert.equal(emailLog.status, 'FAILED');
    assert.equal(emailLog.errorMessage, scenario[2]);
    assert.equal(harness.calls.quoteDeletes, 0);
  });
}

test('missing SMTP configuration is rejected before transport creation', async () => {
  let transportCreated = false;
  const service = new EmailService({
    config: {
      ...completeConfig,
      host: '',
      user: '',
      password: '',
    },
    createTransport: () => {
      transportCreated = true;
      return {};
    },
  });

  await assert.rejects(
    service.sendQuoteNotification(quoteData),
    (error) => error.code === 'SMTP_CONFIG_INVALID',
  );
  assert.equal(transportCreated, false);
});

test('EmailService sends text and professional HTML content to the configured recipient', async () => {
  let mail;
  const service = new EmailService({
    config: completeConfig,
    createTransport: () => ({
      sendMail: async (message) => {
        mail = message;
        return { messageId: 'test-message-id' };
      },
    }),
  });

  await service.sendQuoteNotification(quoteData);

  assert.equal(mail.to, completeConfig.recipient);
  assert.equal(mail.subject, 'New Quote Request - SSB-20260703-0008');
  assert.match(mail.text, /Phone Number\n9876543210/);
  assert.match(mail.html, /<table/);
  assert.match(mail.html, /Need delivery before weekend\./);
});
