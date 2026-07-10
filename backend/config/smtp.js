const env = require('./env');

function validateSmtpConfig(config = env.smtp) {
  const errors = [];

  for (const field of ['host', 'user', 'password', 'recipient']) {
    if (!config[field]) {
      errors.push(`SMTP ${field} is not configured.`);
    }
  }

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('SMTP port must be an integer between 1 and 65535.');
  }

  for (const field of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) {
    if (!Number.isFinite(config[field]) || config[field] < 1) {
      errors.push(`SMTP ${field} must be a positive number.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function smtpTransportOptions(config = env.smtp) {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
  };
}

module.exports = {
  validateSmtpConfig,
  smtpTransportOptions,
};
