const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', productController.listProducts);
router.get('/:slug', productController.getProduct);

module.exports = router;
