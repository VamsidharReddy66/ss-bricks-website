const app = require('./app');
const env = require('./config/env');
const { validateSmtpConfig } = require('./config/smtp');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { ensureBootstrapAdmin } = require('./services/adminService');
const { ensureDefaultProducts } = require('./services/productService');

let server;

async function startServer() {
  await connectDatabase();
  await ensureDefaultProducts();
  await ensureBootstrapAdmin();

  const smtpValidation = validateSmtpConfig();
  if (!smtpValidation.valid) {
    console.warn(
      `SMTP notification is not fully configured: ${smtpValidation.errors.join(' ')}`,
    );
  }

  server = app.listen(env.port, () => {
    console.log(`SS Bricks server running at http://localhost:${env.port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down SS Bricks server.`);

  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    return;
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch(async (error) => {
  console.error('Failed to start SS Bricks server.', error);
  await disconnectDatabase();
  process.exit(1);
});
