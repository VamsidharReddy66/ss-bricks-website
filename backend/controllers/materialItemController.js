const { prisma } = require('../config/database');
const { materialItemSchema } = require('../validators/materialItemValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

function inputData(input) {
  return {
    ...input,
    openingStockAsOn: input.openingStockAsOn ? new Date(`${input.openingStockAsOn}T00:00:00.000Z`) : null,
  };
}

function failure(res, error) {
  return errorResponse(res, 400, 'Validation failed.', error.issues.map((issue) => ({
    field: issue.path.join('.'), message: issue.message,
  })));
}

function handleError(error, res, next) {
  if (error.code === 'P2002') return errorResponse(res, 409, 'Item code already exists.');
  return next(error);
}

async function list(req, res, next) {
  try {
    const items = await prisma.materialItem.findMany({ orderBy: [{ itemName: 'asc' }, { id: 'asc' }] });
    return successResponse(res, 200, 'Material items fetched.', { items });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  const parsed = materialItemSchema.safeParse(req.body);
  if (!parsed.success) return failure(res, parsed.error);
  try {
    const item = await prisma.materialItem.create({
      data: { ...inputData(parsed.data), createdBy: req.admin.id },
    });
    return successResponse(res, 201, 'Material item created.', { item });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function update(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return errorResponse(res, 400, 'Invalid item ID.');
  const parsed = materialItemSchema.safeParse(req.body);
  if (!parsed.success) return failure(res, parsed.error);
  try {
    const item = await prisma.materialItem.update({ where: { id }, data: inputData(parsed.data) });
    return successResponse(res, 200, 'Material item updated.', { item });
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 404, 'Material item not found.');
    return handleError(error, res, next);
  }
}

module.exports = { list, create, update };
