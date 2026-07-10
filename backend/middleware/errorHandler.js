const { Prisma } = require('@prisma/client');
const { ZodError } = require('zod');
const { errorResponse } = require('../utils/apiResponse');
const { formatZodErrors } = require('../validators/quoteValidator');

function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return errorResponse(res, 400, 'Validation failed.', formatZodErrors(error));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return errorResponse(res, 409, 'A record with this unique value already exists.', [
        {
          field: Array.isArray(error.meta?.target) ? error.meta.target.join('.') : 'unique',
          message: 'Duplicate value.',
        },
      ]);
    }
  }

  if (error.type === 'entity.too.large') {
    return errorResponse(res, 413, 'Request payload is too large.', [
      {
        field: 'request',
        message: 'Payload exceeds the allowed size.',
      },
    ]);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 413, 'Uploaded file is too large.', [
      {
        field: 'file',
        message: 'Upload a CSV or XLSX file up to 5 MB.',
      },
    ]);
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return errorResponse(res, error.statusCode, error.message || 'Request failed.', [
      {
        field: error.field || 'request',
        message: error.message || 'Request failed.',
      },
    ]);
  }

  if (error.type === 'entity.parse.failed') {
    return errorResponse(res, 400, 'Validation failed.', [
      {
        field: 'request',
        message: 'Request body must be valid JSON.',
      },
    ]);
  }

  console.error(error);
  return errorResponse(res, 500, 'Internal server error.', [
    {
      field: 'server',
      message: 'Something went wrong while processing the request.',
    },
  ]);
}

module.exports = errorHandler;
