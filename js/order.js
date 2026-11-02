(function () {
  'use strict';

  const catalogue = [
    { slug: 'solid-cement-blocks', name: 'Solid Cement Blocks', image: 'images/solid-cement-blocks.png', unit: 'block', description: 'Dense, load-bearing blocks for walls and foundations.' },
    { slug: 'fly-ash-bricks', name: 'Fly Ash Bricks', image: 'images/fly-ash-bricks.png', unit: 'brick', description: 'Consistent size and a smooth finish for everyday construction.' },
    { slug: 'mud-bricks', name: 'Mud Bricks', image: 'images/mud-bricks.png', unit: 'brick', description: 'Traditional earth bricks for a natural build.' },
    { slug: 'paver-blocks', name: 'Paver Blocks', image: 'images/paver-blocks.png', unit: 'sq.ft', description: 'Interlocking paving for paths and driveways.' },
  ];
  const quantities = new Map(catalogue.map((product) => [product.slug, 0]));
  const products = new Map(catalogue.map((product) => [product.slug, product]));
  const form = document.getElementById('order-form');
  const productList = document.getElementById('order-products');
  const error = document.getElementById('order-error');
  const review = document.getElementById('order-review');
  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat('en-IN');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function selectedProducts() {
    return catalogue.filter((product) => quantities.get(product.slug) > 0)
      .map((product) => ({ ...products.get(product.slug), quantity: quantities.get(product.slug) }));
  }

  function renderProducts() {
    productList.innerHTML = catalogue.map((item) => {
      const product = products.get(item.slug);
      const unavailable = product.availability && product.availability !== 'IN_STOCK';
      const price = Number.isFinite(product.standardPrice) ? `${currency.format(product.standardPrice)} / ${product.unit}` : 'Price confirmed by team';
      return `<article class="order-product${unavailable ? ' unavailable' : ''}" data-product="${escapeHtml(product.slug)}">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />
        <div class="order-product-info"><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(item.description)}</p><small>${unavailable ? 'Currently unavailable' : price}</small></div>
        <div class="order-product-controls"><div class="order-stepper"><button type="button" data-change="-1" aria-label="Remove one ${escapeHtml(product.unit)} of ${escapeHtml(product.name)}" ${unavailable ? 'disabled' : ''}>-</button><input type="number" min="0" max="10000000" step="1" inputmode="numeric" aria-label="${escapeHtml(product.name)} quantity in ${escapeHtml(product.unit)}" value="${quantities.get(item.slug)}" ${unavailable ? 'disabled' : ''} /><button type="button" data-change="1" aria-label="Add one ${escapeHtml(product.unit)} of ${escapeHtml(product.name)}" ${unavailable ? 'disabled' : ''}>+</button></div><div class="order-quick-add"><button type="button" data-change="500" ${unavailable ? 'disabled' : ''}>+500</button><button type="button" data-change="1000" ${unavailable ? 'disabled' : ''}>+1,000</button></div></div>
      </article>`;
    }).join('');
    renderSummary();
  }

  function renderSummary() {
    const items = selectedProducts();
    const target = document.getElementById('order-summary-items');
    target.innerHTML = items.length ? items.map((item) => `<div><span>${escapeHtml(item.name)}<small>${number.format(item.quantity)} ${escapeHtml(item.unit)}</small></span><strong>${Number.isFinite(item.standardPrice) ? currency.format(item.quantity * item.standardPrice) : '-'}</strong></div>`).join('') : '<p>No products selected. Use + to add quantities.</p>';
    document.getElementById('order-total-units').textContent = number.format(items.reduce((total, item) => total + item.quantity, 0));
    const priced = items.length > 0 && items.every((item) => Number.isFinite(item.standardPrice));
    const estimate = priced ? currency.format(items.reduce((total, item) => total + item.quantity * item.standardPrice, 0)) : '-';
    document.getElementById('order-estimate').textContent = estimate;
    document.getElementById('order-estimate-large').textContent = estimate;
  }

  function setQuantity(slug, value) {
    const product = products.get(slug);
    if (!product || (product.availability && product.availability !== 'IN_STOCK')) return;
    const next = Math.max(0, Math.min(10000000, Math.trunc(Number(value) || 0)));
    quantities.set(slug, next);
    const input = productList.querySelector(`[data-product="${slug}"] input`);
    if (input) input.value = String(next);
    error.textContent = '';
    renderSummary();
    review.hidden = true;
  }

  function formValues() {
    const data = new FormData(form);
    return Object.fromEntries(['name', 'phone', 'address', 'area', 'pincode', 'deliveryDate', 'locationLink', 'notes', 'buyerType', 'payment'].map((key) => [key, String(data.get(key) || '').trim()]));
  }

  function validPhone(value) {
    return /^(?:\+?91[- ]?)?[6-9]\d{9}$/.test(value.replace(/[\s-]/g, ''));
  }

  function showReview(values) {
    const items = selectedProducts();
    const lines = [
      'Hello SS Bricks, I would like to request an order.',
      '',
      ...items.map((item) => `- ${item.name}: ${number.format(item.quantity)} ${item.unit}`),
      '',
      `Name: ${values.name}`,
      `WhatsApp: ${values.phone}`,
      `Buyer: ${values.buyerType}`,
      `Delivery: ${values.address}, ${values.area} - ${values.pincode}`,
      `Preferred date: ${values.deliveryDate}`,
      `Payment preference: ${values.payment}`,
    ];
    if (values.locationLink) lines.push(`Site map: ${values.locationLink}`);
    if (values.notes) lines.push(`Notes: ${values.notes}`);
    lines.push('', 'Please confirm the final price, transport and dispatch date.');
    document.getElementById('order-whatsapp-link').href = `https://wa.me/918886100065?text=${encodeURIComponent(lines.join('\n'))}`;
    document.getElementById('order-review-details').innerHTML = `<div><strong>${escapeHtml(values.name)}</strong><span>${escapeHtml(values.phone)}</span></div><div><strong>${items.length} product${items.length === 1 ? '' : 's'}</strong><span>${items.map((item) => `${number.format(item.quantity)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}`).join(' &middot; ')}</span></div><div><strong>Delivery</strong><span>${escapeHtml(values.area)} - ${escapeHtml(values.pincode)} &middot; ${escapeHtml(values.deliveryDate)}</span></div>`;
    review.hidden = false;
    review.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  productList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-change]');
    const row = button?.closest('[data-product]');
    if (!row) return;
    setQuantity(row.dataset.product, quantities.get(row.dataset.product) + Number(button.dataset.change));
  });
  productList.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="number"]');
    if (input) setQuantity(input.closest('[data-product]').dataset.product, input.value);
  });
  form.addEventListener('input', () => { review.hidden = true; error.textContent = ''; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!selectedProducts().length) { error.textContent = 'Choose at least one product and quantity.'; productList.scrollIntoView({ behavior: 'smooth' }); return; }
    if (!form.reportValidity()) return;
    const values = formValues();
    if (!validPhone(values.phone)) { error.textContent = 'Enter a valid Indian mobile number.'; form.elements.phone.focus(); return; }
    if (values.deliveryDate < document.querySelector('[name="deliveryDate"]').min) { error.textContent = 'Choose today or a future delivery date.'; form.elements.deliveryDate.focus(); return; }
    showReview(values);
  });
  document.getElementById('order-edit').addEventListener('click', () => { review.hidden = true; form.scrollIntoView({ behavior: 'smooth' }); });

  const localToday = new Date();
  const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
  document.querySelector('[name="deliveryDate"]').min = today;
  const burger = document.getElementById('nav-burger');
  const mobileNav = document.getElementById('mobile-nav');
  const closeMenu = () => { mobileNav.classList.remove('open'); mobileNav.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => { const opening = !mobileNav.classList.contains('open'); mobileNav.classList.toggle('open', opening); mobileNav.setAttribute('aria-hidden', String(!opening)); burger.setAttribute('aria-expanded', String(opening)); });
  document.getElementById('nav-close').addEventListener('click', closeMenu);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

  renderProducts();
  const preselected = new URLSearchParams(location.search).get('product');
  if (products.has(preselected)) setQuantity(preselected, 500);
  fetch(`${window.SSB_API_BASE_URL || ''}/api/products`)
    .then((response) => { if (!response.ok) throw new Error('Catalogue unavailable'); return response.json(); })
    .then((result) => {
      if (!Array.isArray(result.data?.products)) throw new Error('Catalogue unavailable');
      for (const item of result.data.products) {
        if (!products.has(item.slug)) continue;
        const price = item.standardPrice == null ? NaN : Number(item.standardPrice);
        products.set(item.slug, { ...products.get(item.slug), name: item.name, unit: item.unit, standardPrice: price > 0 ? price : NaN, availability: item.availability });
        if (item.availability !== 'IN_STOCK') quantities.set(item.slug, 0);
      }
      document.getElementById('order-catalog-status').textContent = 'Material estimates use the current listed price. Final pricing is confirmed by our team.';
      renderProducts();
    })
    .catch(() => { document.getElementById('order-catalog-status').textContent = 'Live prices are unavailable. You can still prepare a request; our team will confirm pricing.'; });
}());
