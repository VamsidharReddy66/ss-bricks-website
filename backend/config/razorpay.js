const Razorpay = require('razorpay');
const env = require('./env');

function validateRazorpayConfig() {
  const errors = [];
  if (!env.razorpay.keyId) errors.push('RAZORPAY_KEY_ID is required.');
  if (!env.razorpay.secret) errors.push('RAZORPAY_SECRET is required.');
  if (env.razorpay.keyId && !env.razorpay.keyId.startsWith('rzp_test_')) {
    errors.push('Only Razorpay Test Mode keys are allowed.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function requireRazorpayConfig() {
  const validation = validateRazorpayConfig();
  if (!validation.valid) {
    const error = new Error(`Razorpay Test Mode is not configured. ${validation.errors.join(' ')}`);
    error.statusCode = 503;
    error.field = 'payment';
    throw error;
  }
}

function createRazorpayClient() {
  requireRazorpayConfig();
  return new Razorpay({
    key_id: env.razorpay.keyId,
    key_secret: env.razorpay.secret,
  });
}

module.exports = {
  createRazorpayClient,
  requireRazorpayConfig,
  validateRazorpayConfig,
};
