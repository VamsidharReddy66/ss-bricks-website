const calculatorService = require('../services/calculatorService');
const { calculatorRequestSchema, formatCalculatorErrors } = require('../validators/calculatorValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function getConfig(_req, res, next) {
  try {
    const config = await calculatorService.getCalculatorConfig();
    return successResponse(res, 200, 'Calculator configuration fetched successfully.', config);
  } catch (error) {
    return next(error);
  }
}

async function calculate(req, res, next) {
  try {
    const parsed = calculatorRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatCalculatorErrors(parsed.error));
    }

    const estimate = await calculatorService.calculate(parsed.data);
    return successResponse(res, 200, 'Material estimate calculated successfully.', estimate);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  calculate,
  getConfig,
};
