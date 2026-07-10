const { quoteRequestSchema, formatZodErrors } = require('../validators/quoteValidator');
const quoteService = require('../services/quoteService');
const { NotificationService } = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const notificationService = new NotificationService();

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

    const response = successResponse(res, 201, 'Quotation submitted successfully.', {
      enquiryNumber: result.quote.enquiryNumber,
      quoteId: result.quote.id,
      status: result.quote.status,
      createdAt: result.quote.createdAt,
    });

    setImmediate(() => {
      notificationService.notifyQuoteCreated(result).catch((error) => {
        console.error(`Unexpected notification error for ${result.quote.enquiryNumber}.`, error);
      });
    });

    return response;
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

module.exports = {
  createQuote,
};
