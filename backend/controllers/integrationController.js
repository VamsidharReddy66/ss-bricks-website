const wanamasteService = require('../services/wanamasteService');
const { successResponse } = require('../utils/apiResponse');

async function wanamasteStatus(_req, res, next) {
  try {
    const status = await wanamasteService.inspectConnection();
    return successResponse(res, 200, 'WAnamaste configuration inspected safely.', status);
  } catch (error) {
    return next(error);
  }
}

module.exports = { wanamasteStatus };
