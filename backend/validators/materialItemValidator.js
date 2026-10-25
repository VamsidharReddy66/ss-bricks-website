const { z } = require('zod');

const requiredText = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
const optionalNumber = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? null : Number(value),
  z.number().finite().nonnegative().nullable(),
);
const optionalDays = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? null : Number(value),
  z.number().int().nonnegative().nullable(),
);

const materialItemSchema = z.object({
  itemCode: requiredText(64).transform((value) => value.toUpperCase()),
  itemName: requiredText(160),
  category: requiredText(100),
  subCategory: requiredText(100),
  unit: requiredText(40),
  conversion: optionalText(120),
  gradeSpec: optionalText(160),
  preferredSupplier: optionalText(160),
  alternateSupplier: optionalText(160),
  criticalItem: z.boolean(),
  storageLocation: optionalText(160),
  standardRate: optionalNumber,
  standardUseProduct: optionalText(160),
  standardUsePer1000: optionalNumber,
  reorderLevel: optionalNumber,
  reorderQuantity: optionalNumber,
  leadTimeDays: optionalDays,
  shelfLifeDays: optionalDays,
  openingStock: optionalNumber,
  openingStockAsOn: z.string().trim().nullable().optional().refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
    'Enter a valid opening stock date.',
  ),
}).superRefine((value, context) => {
  if (value.openingStock !== null && !value.openingStockAsOn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['openingStockAsOn'], message: 'Enter the opening stock date.' });
  }
});

module.exports = { materialItemSchema };
