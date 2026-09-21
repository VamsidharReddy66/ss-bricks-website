const analyticsService = require('../services/analyticsService');
const marketingAnalyticsService = require('../services/marketingAnalyticsService');
const offlineSalesService = require('../services/offlineSalesService');
const salesGridService = require('../services/salesGridService');
const {
  analyticsQuerySchema,
  formatSalesErrors,
  offlineSaleSchema,
  salesGridUpdateSchema,
  salesListQuerySchema,
} = require('../validators/salesValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

function validationFailure(res, error) {
  return errorResponse(res, 400, 'Validation failed.', formatSalesErrors(error));
}

async function analytics(req, res, next) {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const result = await analyticsService.getAnalytics(parsed.data);
    return successResponse(res, 200, 'Analytics fetched successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function marketingAnalytics(req, res, next) {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const result = await marketingAnalyticsService.getMarketingAnalytics(parsed.data.range);
    return successResponse(res, 200, 'Marketing analytics fetched successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function listSales(req, res, next) {
  try {
    const parsed = salesListQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const result = await analyticsService.listSales(parsed.data);
    return successResponse(res, 200, 'Sales log fetched successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function createSale(req, res, next) {
  try {
    const parsed = offlineSaleSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const sale = await offlineSalesService.createOfflineSale(parsed.data, req.admin.id);
    return successResponse(res, 201, 'Offline sale created successfully.', { sale });
  } catch (error) {
    if (error.statusCode === 400) {
      return errorResponse(res, 400, error.message, [{
        field: error.field || 'sale',
        message: error.message,
      }]);
    }
    return next(error);
  }
}

async function updateSale(req, res, next) {
  try {
    const parsed = offlineSaleSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const sale = await offlineSalesService.updateOfflineSale(req.params.id, parsed.data);
    return successResponse(res, 200, 'Offline sale updated successfully.', { sale });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 404) {
      return errorResponse(res, error.statusCode, error.message, [{
        field: error.field || 'sale',
        message: error.message,
      }]);
    }
    return next(error);
  }
}

async function updateSalesGrid(req, res, next) {
  try {
    const parsed = salesGridUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const result = await salesGridService.updateSalesGrid(parsed.data, req.admin.id);
    return successResponse(res, 200, 'Sales grid updated successfully.', result);
  } catch (error) {
    if ([400, 404, 409].includes(error.statusCode)) {
      return errorResponse(res, error.statusCode, error.message, [{
        field: error.field || 'sales',
        message: error.message,
      }]);
    }
    return next(error);
  }
}

async function deleteSale(req, res, next) {
  try {
    await offlineSalesService.deleteOfflineSale(req.params.id);
    return successResponse(res, 200, 'Offline sale deleted successfully.', {});
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [{
        field: 'sale',
        message: error.message,
      }]);
    }
    return next(error);
  }
}

module.exports = {
  analytics,
  marketingAnalytics,
  createSale,
  deleteSale,
  listSales,
  updateSale,
  updateSalesGrid,
};
