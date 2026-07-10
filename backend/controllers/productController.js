const productService = require('../services/productService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function listProducts(_req, res, next) {
  try {
    const products = await productService.listProducts();
    return successResponse(res, 200, 'Products fetched successfully.', {
      products,
    });
  } catch (error) {
    return next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    if (!product) {
      return errorResponse(res, 404, 'Product not found.', [
        {
          field: 'slug',
          message: 'No product exists with this slug.',
        },
      ]);
    }

    return successResponse(res, 200, 'Product fetched successfully.', {
      product,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getProduct,
  listProducts,
};
