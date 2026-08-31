const businessImportService = require('../services/businessImportService');
const businessLedgerService = require('../services/businessLedgerService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  formatBusinessErrors,
  listBusinessRecordsSchema,
  recordCorrectionSchema,
  recordIdSchema,
  recordSchemas,
  recordTypeSchema,
  voidRecordSchema,
} = require('../validators/businessValidator');

function validationFailure(res, error) {
  return errorResponse(res, 400, 'Validation failed.', formatBusinessErrors(error));
}

function parsedType(value, res) {
  const parsed = recordTypeSchema.safeParse(value);
  if (!parsed.success) {
    errorResponse(res, 404, 'Business record type not found.', []);
    return null;
  }
  return parsed.data;
}

async function previewImport(req, res, next) {
  try {
    if (!req.file) return errorResponse(res, 400, 'Upload an XLSX workbook.', [{ field: 'file', message: 'XLSX file is required.' }]);
    const preview = await businessImportService.previewBusinessWorkbook(req.file);
    return successResponse(res, 200, 'Business workbook preview generated.', preview);
  } catch (error) {
    return next(error);
  }
}

async function commitImport(req, res, next) {
  try {
    if (!req.file) return errorResponse(res, 400, 'Upload an XLSX workbook.', [{ field: 'file', message: 'XLSX file is required.' }]);
    const result = await businessImportService.commitBusinessWorkbook(req.file, req.admin.id);
    return successResponse(res, 201, 'Business workbook imported successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function listImports(_req, res, next) {
  try {
    const imports = await businessImportService.listBusinessImports();
    return successResponse(res, 200, 'Business imports fetched successfully.', { imports });
  } catch (error) {
    return next(error);
  }
}

async function listRecords(req, res, next) {
  try {
    const type = parsedType(req.params.type, res);
    if (!type) return null;
    const query = listBusinessRecordsSchema.safeParse(req.query);
    if (!query.success) return validationFailure(res, query.error);
    const result = await businessLedgerService.listRecords(type, query.data);
    return successResponse(res, 200, 'Business records fetched successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function createRecord(req, res, next) {
  try {
    const type = parsedType(req.params.type, res);
    if (!type) return null;
    const parsed = recordSchemas[type].safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const record = await businessLedgerService.createRecord(type, parsed.data, req.admin.id);
    return successResponse(res, 201, 'Business record created successfully.', { record });
  } catch (error) {
    return next(error);
  }
}

async function updateRecord(req, res, next) {
  try {
    const type = parsedType(req.params.type, res);
    if (!type) return null;
    const id = recordIdSchema.safeParse(req.params.id);
    if (!id.success) return validationFailure(res, id.error);
    const correction = recordCorrectionSchema.safeParse(req.body);
    if (!correction.success) return validationFailure(res, correction.error);
    const parsed = recordSchemas[type].safeParse(correction.data.data);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const record = await businessLedgerService.updateRecord(
      type,
      id.data,
      parsed.data,
      correction.data.reason,
      req.admin.id,
    );
    return successResponse(res, 200, 'Business record updated successfully.', { record });
  } catch (error) {
    return next(error);
  }
}

async function voidRecord(req, res, next) {
  try {
    const type = parsedType(req.params.type, res);
    if (!type) return null;
    const id = recordIdSchema.safeParse(req.params.id);
    if (!id.success) return validationFailure(res, id.error);
    const parsed = voidRecordSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const record = await businessLedgerService.voidRecord(type, id.data, parsed.data.reason, req.admin.id);
    return successResponse(res, 200, 'Business record voided successfully.', { record });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  commitImport,
  createRecord,
  listImports,
  listRecords,
  previewImport,
  updateRecord,
  voidRecord,
};
