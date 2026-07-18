const express = require('express');
const calculatorController = require('../controllers/calculatorController');

const router = express.Router();

router.get('/config', calculatorController.getConfig);
router.post('/calculate', calculatorController.calculate);

module.exports = router;
