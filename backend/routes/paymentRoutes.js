const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.get('/quote/:token', paymentController.getQuotation);
router.get('/quote/:token/receipt', paymentController.getReceipt);
router.post('/retail-checkout', paymentController.createRetailCheckout);
router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verify);
router.post('/failure', paymentController.recordFailure);

module.exports = router;
