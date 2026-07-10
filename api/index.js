const app = require('../backend/app');
const { connectDatabase } = require('../backend/config/database');
const { validateSmtpConfig } = require('../backend/config/smtp');
const { ensureBootstrapAdmin } = require('../backend/services/adminService');
const { ensureDefaultProducts } = require('../backend/services/productService');

let ready;

async function prepareServerlessApp() {
  await connectDatabase();
  await ensureDefaultProducts();
  await ensureBootstrapAdmin();

  const smtpValidation = validateSmtpConfig();
  if (!smtpValidation.valid) {
    console.warn(
      `SMTP notification is not fully configured: ${smtpValidation.errors.join(' ')}`,
    );
  }
}

module.exports = async function handler(req, res) {
  if (!ready) {
    ready = prepareServerlessApp();
  }

  await ready;
  return app(req, res);
};
