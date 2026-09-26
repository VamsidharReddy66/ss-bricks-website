const wanamasteService = require('../services/wanamasteService');
const { NotificationService } = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const notificationService = new NotificationService();

async function wanamasteStatus(_req, res, next) {
  try {
    const status = await wanamasteService.inspectConnection();
    return successResponse(res, 200, 'WAnamaste configuration inspected safely.', status);
  } catch (error) {
    return next(error);
  }
}

async function wanamasteTestSend(req, res, next) {
  try {
    const result = await wanamasteService.sendControlledTestQuotation(req.body);
    return res.status(result.success ? 200 : 502).json({
      success: result.success,
      message: result.success
        ? 'Controlled WAnamaste test completed successfully.'
        : 'Controlled WAnamaste test was rejected or could not be completed.',
      data: result,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return errorResponse(res, 400, 'Validation failed.', [{
        field: error.field || 'request',
        message: error.message,
      }]);
    }
    return next(error);
  }
}

async function retryQuoteWhatsapp(req, res, next) {
  try {
    const result = await notificationService.retryWanamasteQuotation(req.params.quoteId, req.admin.id, req.body);
    return successResponse(res, 200, 'Quotation WhatsApp recovery completed.', result);
  } catch (error) {
    if ([400, 404, 409].includes(error.statusCode)) {
      return errorResponse(res, error.statusCode, error.message, [{ field: 'whatsappRecovery', message: error.message }]);
    }
    return next(error);
  }
}

module.exports = { wanamasteStatus, wanamasteTestSend, retryQuoteWhatsapp };
