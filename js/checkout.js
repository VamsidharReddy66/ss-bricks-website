(function () {
  'use strict';

  const API_BASE_URL = window.SSB_API_BASE_URL || '';
  const params = new URLSearchParams(window.location.search);
  const productSlug = params.get('product') || '';
  const quantity = Number(params.get('quantity'));
  const loading = document.getElementById('checkout-loading');
  const content = document.getElementById('checkout-content');
  const form = document.getElementById('retail-checkout-form');
  const submitButton = document.getElementById('checkout-submit');
  const message = document.getElementById('checkout-message');
  let selectedProduct = null;
  let selectedPack = null;

  function money(value) {
    return `Rs.${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function unitLabel(product, packQuantity) {
    if (product.unit === 'sq.ft') return product.unit;
    return Number(packQuantity) === 1 ? product.unit : `${product.unit}s`;
  }

  function localDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('error', isError);
    message.classList.add('show');
  }

  function clearMessage() {
    message.textContent = '';
    message.classList.remove('show', 'error');
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.errors?.[0]?.message || result.message || 'Request failed.');
    }
    return result.data;
  }

  function normalizePhone(value) {
    let phone = String(value || '').replace(/[\s-]/g, '').trim();
    if (phone.startsWith('+91')) phone = phone.slice(3);
    if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
    return phone;
  }

  function renderPack(products) {
    selectedProduct = products.find(product => (
      product.slug === productSlug
      && product.availability === 'IN_STOCK'
    ));
    selectedPack = selectedProduct?.retailPacks?.find(pack => Number(pack.quantity) === quantity);

    if (!selectedProduct || !selectedPack) {
      loading.textContent = 'This retail pack is unavailable. Please return to the homepage and choose an available pack.';
      return;
    }

    document.getElementById('checkout-product').textContent = selectedProduct.name;
    document.getElementById('checkout-pack').textContent = `${quantity.toLocaleString('en-IN')} ${unitLabel(selectedProduct, quantity)}`;
    document.getElementById('checkout-total').textContent = money(selectedPack.totalPrice);
    const deliveryDate = document.getElementById('checkout-delivery-date');
    deliveryDate.min = localDateInputValue();
    loading.hidden = true;
    content.hidden = false;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearMessage();
    if (!selectedProduct || !selectedPack) return;

    const data = new FormData(form);
    const payload = {
      productSlug: selectedProduct.slug,
      quantity: selectedPack.quantity,
      name: String(data.get('name') || '').trim(),
      phone: normalizePhone(data.get('phone')),
      email: String(data.get('email') || '').trim(),
      location: String(data.get('location') || '').trim(),
      deliveryDate: String(data.get('deliveryDate') || ''),
    };

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Preparing Secure Checkout...';

    try {
      const result = await api('/api/payment/retail-checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      window.location.assign(result.checkout.paymentUrl);
    } catch (error) {
      showMessage(error.message || 'Unable to prepare checkout. Please try again.', true);
      submitButton.disabled = false;
      submitButton.textContent = 'Continue to Secure Payment';
    }
  });

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug) || !Number.isInteger(quantity) || quantity <= 0) {
    loading.textContent = 'This retail pack link is invalid.';
  } else {
    api('/api/products')
      .then(data => renderPack(data.products || []))
      .catch(error => {
        loading.textContent = error.message || 'Unable to load pack details.';
      });
  }
}());
