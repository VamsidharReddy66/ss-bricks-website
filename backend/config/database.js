const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

async function connectDatabase() {
  await prisma.$connect();
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
};
