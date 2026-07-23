const express = require('express');
const multer = require('multer');
const path = require('path');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
const requireAdminAuth = require('../middleware/requireAdminAuth');

const router = express.Router();
const allowedImportExtensions = new Set(['.csv', '.xlsx']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedImportExtensions.has(extension)) {
      callback(null, true);
      return;
    }

    const error = new Error('Upload a CSV or XLSX file.');
    error.statusCode = 400;
    error.field = 'file';
    callback(error);
  },
});

router.post('/login', adminController.login);

router.use(requireAdminAuth);

router.get('/dashboard', adminController.dashboard);
router.get('/leads', adminController.listQuotes);
router.post('/leads', adminController.createLead);
router.get('/leads/:id', adminController.getLead);
router.put('/leads/:id/payment', paymentController.configureQuotation);
router.put('/leads/:id', adminController.updateLead);
router.post('/leads/:id/activities', adminController.addLeadActivity);
router.put('/leads/:id/notes', adminController.updateLeadNotes);
router.delete('/leads/:id/notes', adminController.deleteLeadNotes);
router.put('/leads/:id/priority', adminController.updateLeadPriority);
router.put('/leads/:id/status', adminController.updateLeadStatus);
router.delete('/leads/:id', adminController.deleteLead);
router.post('/leads/import/preview', upload.single('file'), adminController.previewLeadImport);
router.post('/leads/import/commit', adminController.commitLeadImport);
router.get('/products', adminController.listProducts);
router.put('/products/:id', adminController.updateProduct);
router.get('/price-history', adminController.listPriceHistory);
router.get('/quotes', adminController.listQuotes);
router.get('/payments', paymentController.listPayments);

module.exports = router;
