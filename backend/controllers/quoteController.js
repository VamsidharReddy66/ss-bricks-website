const { waitUntil } = require('@vercel/functions');
const { quoteRequestSchema, formatZodErrors } = require('../validators/quoteValidator');
const quoteService = require('../services/quoteService');
const { NotificationService } = require('../services/notificationService');
const { generateAndStoreQuotePdf } = require('../services/pdfService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const notificationService = new NotificationService();

function runQuoteDistribution(result) {
  const task = notificationService.notifyQuoteCreated(result).catch((error) => {
    console.error(`Unexpected notification error for ${result.quote.enquiryNumber}.`, error);
  });

  if (process.env.VERCEL) {
    waitUntil(task);
    return;
  }

  setImmediate(() => {
    task.catch(() => {});
  });
}

async function createQuote(req, res, next) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return errorResponse(res, 400, 'Validation failed.', [
        {
          field: 'request',
          message: 'Request body cannot be empty.',
        },
      ]);
    }

    const parsed = quoteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const result = await quoteService.createQuote(parsed.data);
    let pdf = null;

    try {
      pdf = await generateAndStoreQuotePdf(result);
      result.pdf = pdf;
      result.quote.pdfUrl = pdf.pdfUrl;
    } catch (error) {
      console.error(`Could not generate immediate quotation PDF for ${result.quote.enquiryNumber}.`, error);
    }

    runQuoteDistribution(result);

    return successResponse(res, 201, 'Quotation submitted successfully.', {
      enquiryNumber: result.quote.enquiryNumber,
      quoteId: result.quote.id,
      status: result.quote.status,
      createdAt: result.quote.createdAt,
      pdfUrl: pdf?.pdfUrl || result.quote.pdfUrl || null,
      pdfReady: Boolean(pdf),
      distribution: {
        pdf: pdf ? 'SUCCESS' : 'FAILED',
        googleSheet: 'QUEUED',
        email: 'QUEUED',
        whatsapp: 'QUEUED',
      },
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return errorResponse(res, 400, 'Validation failed.', error.errors || [
        {
          field: 'request',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function getQuotePdf(req, res, next) {
  try {
    const document = await quoteService.getQuoteDocument(req.params.enquiryNumber);
    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(Buffer.from(document.content));
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'pdf',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

module.exports = {
  createQuote,
  getQuotePdf,
};
