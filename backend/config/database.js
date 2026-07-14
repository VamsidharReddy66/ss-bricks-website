const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

function configuredDatabaseTarget() {
  try {
    const databaseUrl = new URL(env.databaseUrl);
    return {
      host: databaseUrl.hostname,
      database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, '')),
      schema: databaseUrl.searchParams.get('schema') || 'public',
    };
  } catch (_error) {
    return {
      host: 'invalid-url',
      database: 'unknown',
      schema: 'unknown',
    };
  }
}

async function getDatabaseReadiness() {
  const [readiness] = await prisma.$queryRaw`
    SELECT
      current_database() AS "databaseName",
      current_schema() AS "schemaName",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'QuoteRequest'
          AND column_name = 'pdfUrl'
      ) AS "quotePdfColumnExists",
      to_regclass(format('%I.%I', current_schema(), 'QuoteDocument')) IS NOT NULL
        AS "quoteDocumentTableExists"
  `;

  return readiness;
}

async function connectDatabase() {
  await prisma.$connect();

  const readiness = await getDatabaseReadiness();
  console.info('Database readiness:', {
    configuredTarget: configuredDatabaseTarget(),
    runtimeDatabase: readiness.databaseName,
    runtimeSchema: readiness.schemaName,
    quotePdfColumnExists: readiness.quotePdfColumnExists,
    quoteDocumentTableExists: readiness.quoteDocumentTableExists,
    vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  });
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
  getDatabaseReadiness,
};
