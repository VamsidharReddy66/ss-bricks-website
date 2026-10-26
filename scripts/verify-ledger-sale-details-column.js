const { PrismaClient } = require('@prisma/client');

const expected = process.env.SALES_DETAILS_COLUMN_EXPECTED;
if (!['absent', 'present'].includes(expected)) {
  console.error('Expected Sales column state was not specified.');
  process.exit(1);
}

async function verify() {
  const prisma = new PrismaClient();
  try {
    const columns = await prisma.$queryRaw`
      SELECT data_type AS type, is_nullable AS nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'ledger_sales'
        AND column_name = 'sale_details'
    `;
    if (expected === 'absent' && columns.length !== 0) {
      throw new Error('Sales details column exists before the reviewed migration.');
    }
    if (expected === 'present' &&
        (columns.length !== 1 || columns[0].type !== 'jsonb' || columns[0].nullable !== 'YES')) {
      throw new Error('Sales details column does not match the reviewed migration.');
    }
    console.log(`Sales details column ${expected} state verified.`);
  } finally {
    await prisma.$disconnect();
  }
}

verify().catch(() => {
  console.error('Read-only Sales details schema verification failed.');
  process.exitCode = 1;
});
