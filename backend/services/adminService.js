const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const env = require('../config/env');

const SALT_ROUNDS = 12;

function publicAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
  };
}

async function ensureBootstrapAdmin() {
  if (!env.admin.email || !env.admin.password) {
    return null;
  }

  const passwordHash = await bcrypt.hash(env.admin.password, SALT_ROUNDS);
  const admin = await prisma.admin.upsert({
    where: {
      email: env.admin.email.toLowerCase(),
    },
    update: {
      name: env.admin.name,
      passwordHash,
    },
    create: {
      name: env.admin.name,
      email: env.admin.email.toLowerCase(),
      passwordHash,
    },
  });

  return publicAdmin(admin);
}

async function login(payload) {
  const admin = await prisma.admin.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!admin) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const validPassword = await bcrypt.compare(payload.password, admin.passwordHash);
  if (!validPassword) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(publicAdmin(admin), env.jwtSecret, {
    expiresIn: payload.rememberMe ? '7d' : '8h',
  });

  return {
    token,
    admin: publicAdmin(admin),
  };
}

module.exports = {
  ensureBootstrapAdmin,
  login,
};
