const retailPackQuantities = Object.freeze({
  'fly-ash-bricks': Object.freeze([500, 1000]),
  'solid-cement-blocks': Object.freeze([100, 250]),
  'paver-blocks': Object.freeze([100, 250]),
  'mud-bricks': Object.freeze([500, 1000]),
});

function getRetailPackQuantities(slug) {
  return retailPackQuantities[slug] || [];
}

function isRetailPackQuantity(slug, quantity) {
  return getRetailPackQuantities(slug).includes(Number(quantity));
}

module.exports = {
  getRetailPackQuantities,
  isRetailPackQuantity,
  retailPackQuantities,
};
