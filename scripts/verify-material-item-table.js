const { PrismaClient } = require('@prisma/client');

const expected = process.env.MATERIAL_ITEM_TABLE_EXPECTED;
if (!['absent', 'present'].includes(expected)) {
  console.error('Expected table state was not specified.');
  process.exit(1);
}

const columns = [
  'id', 'item_code', 'item_name', 'category', 'sub_category', 'unit',
  'conversion', 'grade_spec', 'preferred_supplier', 'alternate_supplier',
  'critical_item', 'storage_location', 'standard_rate', 'standard_use_product',
  'standard_use_per_1000', 'reorder_level', 'reorder_quantity', 'lead_time_days',
  'shelf_life_days', 'opening_stock', 'opening_stock_as_on', 'created_by',
  'created_at', 'updated_at',
];

async function verify() {
  const prisma = new PrismaClient();
  try {
    const [table] = await prisma.$queryRaw`
      SELECT to_regclass(format('%I.%I', current_schema(), 'material_items')) IS NOT NULL AS "exists"
    `;
    if (table?.exists !== (expected === 'present')) {
      throw new Error('Material Item table state differs from the reviewed migration state.');
    }
    if (expected === 'present') {
      const actual = await prisma.$queryRaw`
        SELECT column_name AS name
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'material_items'
      `;
      const names = new Set(actual.map((row) => row.name));
      if (columns.some((name) => !names.has(name))) {
        throw new Error('Material Item table is missing expected columns.');
      }
      const indexes = await prisma.$queryRaw`
        SELECT indexname AS name FROM pg_indexes
        WHERE schemaname = current_schema() AND tablename = 'material_items'
      `;
      const indexNames = new Set(indexes.map((row) => row.name));
      if (['material_items_pkey', 'material_items_item_code_key', 'material_items_category_idx', 'material_items_item_name_idx'].some((name) => !indexNames.has(name))) {
        throw new Error('Material Item table is missing expected indexes.');
      }
      const [foreignKey] = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
            AND conrelid = to_regclass(format('%I.%I', current_schema(), 'material_items'))
            AND conname = 'material_items_created_by_fkey'
        ) AS "exists"
      `;
      if (!foreignKey?.exists) throw new Error('Material Item table is missing its admin foreign key.');
    }
    console.log(`Material Item table ${expected} state verified.`);
  } finally {
    await prisma.$disconnect();
  }
}

verify().catch(() => {
  console.error('Read-only Material Item schema verification failed.');
  process.exitCode = 1;
});
