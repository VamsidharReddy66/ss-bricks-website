const express = require('express');
const quoteController = require('../controllers/quoteController');

const router = express.Router();

router.post('/', quoteController.createQuote);
router.get('/:enquiryNumber/pdf', quoteController.getQuotePdf);

module.exports = router;
