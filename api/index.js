const app = require('../backend/app');
const { connectDatabase } = require('../backend/config/database');
const { validateSmtpConfig } = require('../backend/config/smtp');
const { ensureBootstrapAdmin } = require('../backend/services/adminService');
const { ensureDefaultProducts } = require('../backend/services/productService');
const { ensureDefaultCalculatorConfig } = require('../backend/services/calculatorService');
const { createRetryableInitializer } = require('../backend/utils/retryableInitializer');

async function prepareServerlessApp() {
  await connectDatabase();
  await ensureDefaultProducts();
  await ensureDefaultCalculatorConfig();
  await ensureBootstrapAdmin();

  const smtpValidation = validateSmtpConfig();
  if (!smtpValidation.valid) {
    console.warn(
      `SMTP notification is not fully configured: ${smtpValidation.errors.join(' ')}`,
    );
  }
}

const initializeServerlessApp = createRetryableInitializer(prepareServerlessApp);

module.exports = async function handler(req, res) {
  await initializeServerlessApp();
  return app(req, res);
};
