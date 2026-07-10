const { errorResponse } = require('../utils/apiResponse');

function notFound(req, res) {
  return errorResponse(res, 404, 'Route not found.', [
    {
      field: 'path',
      message: `${req.method} ${req.originalUrl} is not available.`,
    },
  ]);
}

module.exports = notFound;
