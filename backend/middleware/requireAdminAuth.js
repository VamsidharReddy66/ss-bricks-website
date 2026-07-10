const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { errorResponse } = require('../utils/apiResponse');

function requireAdminAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return errorResponse(res, 401, 'Authentication required.', [
      {
        field: 'authorization',
        message: 'Login before accessing admin data.',
      },
    ]);
  }

  try {
    req.admin = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (_error) {
    return errorResponse(res, 401, 'Session expired. Please login again.', [
      {
        field: 'authorization',
        message: 'Invalid or expired token.',
      },
    ]);
  }
}

module.exports = requireAdminAuth;
