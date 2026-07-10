const { loginSchema } = require('../validators/adminValidator');
const { productUpdateSchema, formatZodErrors } = require('../validators/productValidator');
const adminService = require('../services/adminService');
const leadService = require('../services/leadService');
const leadImportService = require('../services/leadImportService');
const productService = require('../services/productService');
const {
  leadActivitySchema,
  leadCreateSchema,
  leadNotesUpdateSchema,
  leadPriorityUpdateSchema,
  leadUpdateSchema,
  leadStatusUpdateSchema,
  importCommitSchema,
} = require('../validators/leadValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const result = await adminService.login(parsed.data);
    return successResponse(res, 200, 'Login successful.', result);
  } catch (error) {
    if (error.statusCode === 401) {
      return errorResponse(res, 401, error.message, [
        {
          field: 'credentials',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    const [leadStats, productStats] = await Promise.all([
      leadService.getLeadStats(),
      productService.getProductStats(),
    ]);

    return successResponse(res, 200, 'Dashboard fetched successfully.', {
      ...leadStats,
      ...productStats,
      admin: req.admin,
    });
  } catch (error) {
    return next(error);
  }
}

async function listProducts(_req, res, next) {
  try {
    const products = await productService.listProducts();
    return successResponse(res, 200, 'Admin products fetched successfully.', {
      products,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const product = await productService.updateProduct(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 200, 'Product updated successfully.', {
      product,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'product',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function listPriceHistory(_req, res, next) {
  try {
    const history = await productService.listPriceHistory();
    return successResponse(res, 200, 'Price history fetched successfully.', {
      history,
    });
  } catch (error) {
    return next(error);
  }
}

async function listQuotes(req, res, next) {
  try {
    const result = await leadService.listLeads(req.query);
    return successResponse(res, 200, 'Leads fetched successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function createLead(req, res, next) {
  try {
    const parsed = leadCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const lead = await leadService.createLead(parsed.data, req.admin.id);
    return successResponse(res, 201, 'Lead created successfully.', {
      lead,
    });
  } catch (error) {
    return next(error);
  }
}

async function getLead(req, res, next) {
  try {
    const lead = await leadService.getLeadById(req.params.id);
    return successResponse(res, 200, 'Lead fetched successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function updateLead(req, res, next) {
  try {
    const parsed = leadUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const lead = await leadService.updateLead(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 200, 'Lead updated successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function updateLeadStatus(req, res, next) {
  try {
    const parsed = leadStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const lead = await leadService.updateLeadStatus(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 200, 'Lead updated successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function updateLeadPriority(req, res, next) {
  try {
    const parsed = leadPriorityUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const lead = await leadService.updateLeadPriority(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 200, 'Lead priority updated successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function updateLeadNotes(req, res, next) {
  try {
    const parsed = leadNotesUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const lead = await leadService.updateLeadNotes(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 200, 'Lead notes updated successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function deleteLeadNotes(req, res, next) {
  try {
    const lead = await leadService.updateLeadNotes(req.params.id, { notes: null }, req.admin.id);
    return successResponse(res, 200, 'Lead notes deleted successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function deleteLead(req, res, next) {
  try {
    await leadService.deleteLead(req.params.id);
    return successResponse(res, 200, 'Lead deleted successfully.', {});
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function addLeadActivity(req, res, next) {
  try {
    const parsed = leadActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const lead = await leadService.addLeadActivity(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 201, 'Lead activity added successfully.', {
      lead,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return errorResponse(res, 404, error.message, [
        {
          field: 'lead',
          message: error.message,
        },
      ]);
    }
    return next(error);
  }
}

async function previewLeadImport(req, res, next) {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'Validation failed.', [
        {
          field: 'file',
          message: 'Upload a CSV or XLSX file.',
        },
      ]);
    }

    let mapping = null;
    if (req.body.mapping) {
      try {
        mapping = JSON.parse(req.body.mapping);
      } catch (_error) {
        return errorResponse(res, 400, 'Validation failed.', [
          {
            field: 'mapping',
            message: 'Mapping must be valid JSON.',
          },
        ]);
      }
    }

    const preview = await leadImportService.previewImport(req.file, mapping);
    return successResponse(res, 200, 'Import preview generated successfully.', preview);
  } catch (error) {
    return next(error);
  }
}

async function commitLeadImport(req, res, next) {
  try {
    const parsed = importCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Validation failed.', formatZodErrors(parsed.error));
    }

    const summary = await leadService.importLeads(parsed.data.rows, parsed.data.duplicateStrategy, req.admin.id);
    return successResponse(res, 201, 'Leads imported successfully.', {
      summary,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addLeadActivity,
  commitLeadImport,
  createLead,
  dashboard,
  deleteLead,
  deleteLeadNotes,
  getLead,
  listPriceHistory,
  listProducts,
  listQuotes,
  login,
  previewLeadImport,
  updateLead,
  updateLeadNotes,
  updateLeadPriority,
  updateLeadStatus,
  updateProduct,
};
