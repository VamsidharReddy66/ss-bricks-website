/* ============================================================
   SS BRICKS — Main JavaScript
   ============================================================ */

(function () {
  'use strict';

  const API_BASE_URL = window.SSB_API_BASE_URL || '';
  let productCatalog = [];
  let productBySlug = new Map();
  let validProductNames = [];
  let calculatorConfigPromise = null;

  function slugFromName(value) {
    return (value || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function formatMoney(value) {
    return '\u20b9' + Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  function pluralUnit(product) {
    if (!product) return '';
    return product.bulkQuantity === 1 ? product.unit : `${product.unit}s`;
  }

  function productPriceText(product) {
    return `${formatMoney(product.standardPrice)} / ${product.unit}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /* ── Page Cover Transition ─────────────────────── */
  const cover = document.querySelector('.page-cover');
  if (cover) {
    requestAnimationFrame(() => {
      cover.style.transform = 'scaleX(0)';
    });

    document.querySelectorAll('a[href]').forEach(link => {
      const h = link.getAttribute('href') || '';
      if (h && !h.startsWith('#') && !h.startsWith('tel:') && !h.startsWith('mailto:') && !h.startsWith('http') && !h.startsWith('wa.me')) {
        link.addEventListener('click', e => {
          e.preventDefault();
          cover.style.transition = 'transform 0.5s cubic-bezier(0.76,0,0.24,1)';
          cover.style.transformOrigin = 'left';
          cover.style.transform = 'scaleX(1)';
          setTimeout(() => { window.location.href = h; }, 520);
        });
      }
    });
  }

  /* ── Navbar Scroll ─────────────────────────────── */
  const navbar = document.getElementById('navbar');
  function handleNavScroll() {
    if (!navbar) return;
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  /* ── Mobile Nav ────────────────────────────────── */
  const burger = document.getElementById('nav-burger');
  const mobileNav = document.getElementById('mobile-nav');
  const navClose = document.getElementById('nav-close');

  burger?.addEventListener('click', () => {
    mobileNav?.classList.add('open');
    document.body.style.overflow = 'hidden';
    burger.setAttribute('aria-expanded', 'true');
  });

  function closeMobileNav() {
    mobileNav?.classList.remove('open');
    document.body.style.overflow = '';
    burger?.setAttribute('aria-expanded', 'false');
  }

  navClose?.addEventListener('click', closeMobileNav);
  mobileNav?.querySelectorAll('a').forEach(l => l.addEventListener('click', closeMobileNav));

  /* ── Active Nav Highlight ──────────────────────── */
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (page === href || (page === '' && href === 'index.html'))) {
      link.classList.add('active');
    }
  });

  /* ── Scroll Animations ─────────────────────────── */
  const animEls = document.querySelectorAll('.fade-up, .fade-left, .fade-right');
  const animObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        animObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  animEls.forEach(el => animObs.observe(el));

  /* ── Counter Animation ─────────────────────────── */
  document.querySelectorAll('[data-count]').forEach(el => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const target = +el.dataset.count;
        const suffix = el.dataset.suffix || '';
        const duration = 1600;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });
    obs.observe(el);
  });

  /* ── CALCULATOR ────────────────────────────────── */
  async function loadCalculatorConfig() {
    if (!calculatorConfigPromise) {
      calculatorConfigPromise = fetch(`${API_BASE_URL}/api/calculator/config`)
        .then(async response => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.success) {
            throw new Error(result.message || 'Unable to load calculator options.');
          }
          return result.data;
        })
        .catch(error => {
          calculatorConfigPromise = null;
          throw error;
        });
    }

    return calculatorConfigPromise;
  }

  function formatEstimateValue(value, maximumFractionDigits = 2) {
    return Number(value).toLocaleString('en-IN', { maximumFractionDigits });
  }

  function calculatorUnitLabel(unit, quantity = 2) {
    if (unit === 'sq.ft') return unit;
    return Number(quantity) === 1 ? unit : `${unit}s`;
  }

  function initCalculator(prefix) {
    const height = document.getElementById(prefix + 'height-input');
    const heightUnit = document.getElementById(prefix + 'height-unit');
    const width = document.getElementById(prefix + 'width-input');
    const widthUnit = document.getElementById(prefix + 'width-unit');
    const thickness = document.getElementById(prefix + 'thickness-select');
    const productType = document.getElementById(prefix + 'brick-type-select');
    const quantity = document.getElementById(prefix + 'quantity-input');
    const quantityUnit = document.getElementById(prefix + 'quantity-unit');
    const feedback = document.getElementById(prefix + 'calc-feedback');
    const waBtn = document.getElementById(prefix + 'calc-wa-btn');
    const output = {
      cost: document.getElementById(prefix + 'result-cost'),
      brick: document.getElementById(prefix + 'result-brick'),
      size: document.getElementById(prefix + 'result-size'),
      area: document.getElementById(prefix + 'result-area'),
      volume: document.getElementById(prefix + 'result-volume'),
      bricks: document.getElementById(prefix + 'result-bricks'),
      quantity: document.getElementById(prefix + 'result-quantity'),
    };

    if (!height || !heightUnit || !width || !widthUnit || !thickness || !productType || !quantity || !output.cost) {
      return;
    }

    let config = { products: [], thicknessOptions: [] };
    let debounceTimer = null;
    let activeRequest = null;

    function showFeedback(message = '') {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.hidden = !message;
    }

    function setWhatsAppEstimate(data = null) {
      if (!waBtn) return;
      if (!data) {
        waBtn.href = '#';
        waBtn.setAttribute('aria-disabled', 'true');
        return;
      }

      const selectedThickness = thickness.options[thickness.selectedIndex]?.textContent || '';
      const estimatedUnits = data.estimatedBricks === null
        ? 'Not available (dimensions not configured)'
        : formatEstimateValue(data.estimatedBricks, 0);
      const message = encodeURIComponent(
        `Hello SS Bricks! I used your wall material calculator.\nProduct: ${data.brickType}\nWall: ${height.value} ${heightUnit.value} x ${width.value} ${widthUnit.value}\nThickness: ${selectedThickness}\nEstimated Units: ${estimatedUnits}\nQuantity: ${formatEstimateValue(data.quantity, 0)} ${calculatorUnitLabel(data.quantityUnit, data.quantity)}\nEstimated Cost: ${formatMoney(data.estimatedCost)}\nPlease share the final quotation.`
      );
      waBtn.href = `https://wa.me/919876543210?text=${message}`;
      waBtn.removeAttribute('aria-disabled');
    }

    function resetResult() {
      output.cost.textContent = '\u20b90';
      ['brick', 'size', 'area', 'volume', 'bricks', 'quantity'].forEach(key => {
        if (output[key]) output[key].textContent = '\u2014';
      });
      setWhatsAppEstimate();
    }

    function renderResult(data) {
      output.cost.textContent = formatMoney(data.estimatedCost);
      output.brick.textContent = data.brickType;
      output.size.textContent = data.brickSize || 'Not configured';
      output.area.textContent = `${formatEstimateValue(data.wallArea)} ${data.wallAreaUnit}`;
      output.volume.textContent = `${formatEstimateValue(data.wallVolume)} ${data.wallVolumeUnit}`;
      output.bricks.textContent = data.estimatedBricks === null
        ? 'Not available'
        : formatEstimateValue(data.estimatedBricks, 0);
      output.quantity.textContent = `${formatEstimateValue(data.quantity, 0)} ${calculatorUnitLabel(data.quantityUnit, data.quantity)}`;
      setWhatsAppEstimate(data);
    }

    function payloadOrMessage() {
      const heightValue = Number(height.value);
      const widthValue = Number(width.value);
      const quantityValue = Number(quantity.value);

      if (!height.value && !width.value) return { payload: null, message: '' };
      if (!Number.isFinite(heightValue) || heightValue <= 0) {
        return { payload: null, message: 'Wall height must be greater than zero.' };
      }
      if (!Number.isFinite(widthValue) || widthValue <= 0) {
        return { payload: null, message: 'Wall width must be greater than zero.' };
      }
      if (!thickness.value) return { payload: null, message: 'Select a wall thickness.' };
      if (!productType.value) return { payload: null, message: 'Select a product type.' };
      if (!Number.isInteger(quantityValue) || quantityValue <= 0) {
        return { payload: null, message: 'Quantity must be a whole number greater than zero.' };
      }

      return {
        payload: {
          height: heightValue,
          heightUnit: heightUnit.value,
          width: widthValue,
          widthUnit: widthUnit.value,
          thicknessId: Number(thickness.value),
          productId: Number(productType.value),
          quantity: quantityValue,
        },
        message: '',
      };
    }

    async function compute() {
      const state = payloadOrMessage();
      if (!state.payload) {
        activeRequest?.abort();
        activeRequest = null;
        resetResult();
        showFeedback(state.message);
        return;
      }

      activeRequest?.abort();
      activeRequest = new AbortController();
      showFeedback();

      try {
        const response = await fetch(`${API_BASE_URL}/api/calculator/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.payload),
          signal: activeRequest.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.errors?.[0]?.message || result.message || 'Unable to calculate estimate.');
        }
        renderResult(result.data);
      } catch (error) {
        if (error.name === 'AbortError') return;
        resetResult();
        showFeedback(error.message || 'Unable to calculate estimate.');
      }
    }

    function scheduleCalculation() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(compute, 250);
    }

    [height, width].forEach(input => input.addEventListener('input', scheduleCalculation));
    quantity.addEventListener('input', updateQuantityUnit);
    function updateQuantityUnit() {
      const selected = config.products.find(item => String(item.id) === productType.value);
      if (quantityUnit) quantityUnit.textContent = selected
        ? calculatorUnitLabel(selected.unit, quantity.value)
        : 'units';
      scheduleCalculation();
    }

    [heightUnit, widthUnit, thickness].forEach(select => select.addEventListener('change', scheduleCalculation));
    productType.addEventListener('change', updateQuantityUnit);

    resetResult();

    loadCalculatorConfig().then(data => {
      config = data;
      thickness.innerHTML = '<option value="">Select Thickness</option>';
      data.thicknessOptions.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.displayName;
        thickness.appendChild(option);
      });

      productType.innerHTML = '<option value="">Select Product Type</option>';
      data.products.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.availability === 'IN_STOCK'
          ? `${item.name} (${formatMoney(item.pricePerUnit)} / ${item.unit})`
          : `${item.name} (${formatMoney(item.pricePerUnit)} / ${item.unit}) - Out of Stock`;
        option.disabled = item.availability !== 'IN_STOCK';
        productType.appendChild(option);
      });

      const availableProducts = data.products.filter(item => item.availability === 'IN_STOCK');
      if (availableProducts.length === 1) {
        productType.value = String(availableProducts[0].id);
      }
      updateQuantityUnit();

      if (!availableProducts.length || !data.thicknessOptions.length) {
        showFeedback('Calculator configuration is not available. Please contact SS Bricks.');
      }
    }).catch(error => {
      thickness.innerHTML = '<option value="">Unavailable</option>';
      productType.innerHTML = '<option value="">Unavailable</option>';
      showFeedback(error.message || 'Unable to load calculator configuration.');
    });
  }

  function refreshProductSelects() {
    document.querySelectorAll('.quote-form select[name="product"]').forEach(select => {
      const current = select.value;
      select.innerHTML = '<option value="">Select Product</option>';
      productCatalog.forEach(product => {
        const option = document.createElement('option');
        option.value = product.name;
        option.textContent = product.availability === 'IN_STOCK'
          ? product.name
          : `${product.name} (Out of Stock)`;
        option.disabled = product.availability !== 'IN_STOCK';
        select.appendChild(option);
      });
      if (current && validProductNames.includes(current)) select.value = current;
    });
  }

  function updateHeroPrice() {
    const product = productCatalog[0];
    if (!product) return;

    const amount = document.querySelector('.hpc-price .amount');
    const unit = document.querySelector('.hpc-price .unit');
    const bulk = document.querySelector('.hpc-bulk');
    if (amount) amount.textContent = formatMoney(product.standardPrice);
    if (unit) unit.textContent = `/ ${product.unit}`;
    if (bulk) {
      bulk.innerHTML = `${escapeHtml(product.name)} &nbsp;&middot;&nbsp; <strong>${escapeHtml(formatMoney(product.bulkPrice))} / ${escapeHtml(product.unit)}</strong> above ${Number(product.bulkQuantity).toLocaleString('en-IN')} ${escapeHtml(pluralUnit(product))}`;
    }
  }

  function updatePriceCards() {
    document.querySelectorAll('.price-card').forEach(card => {
      const nameEl = card.querySelector('.pc-product');
      const product = productBySlug.get(slugFromName(nameEl?.textContent));
      if (!product) return;

      nameEl.textContent = product.name;
      const price = card.querySelector('.pc-price');
      const bulkPrice = card.querySelector('.pc-bulk-price');
      const bulkCond = card.querySelector('.pc-bulk-cond');
      if (price) price.innerHTML = `${escapeHtml(formatMoney(product.standardPrice))} <span>/ ${escapeHtml(product.unit)}</span>`;
      if (bulkPrice) bulkPrice.textContent = `${formatMoney(product.bulkPrice)} / ${product.unit}`;
      if (bulkCond) bulkCond.textContent = `Above ${Number(product.bulkQuantity).toLocaleString('en-IN')} ${pluralUnit(product)}`;
    });
  }

  function updateBulkOffers() {
    const product = productCatalog[0];
    if (!product) return;

    document.querySelectorAll('.bulk-card').forEach((card, index) => {
      if (index > 1) return;
      const qty = card.querySelector('.bulk-qty');
      const feature = Array.from(card.querySelectorAll('.bulk-feat')).find(item => item.textContent.includes('pricing'));
      if (qty) qty.textContent = `${Number(product.bulkQuantity * (index + 1)).toLocaleString('en-IN')}+ ${product.name}`;
      if (feature) feature.innerHTML = `<span class="bulk-feat-icon" aria-hidden="true">✓</span> Special builder pricing (${escapeHtml(formatMoney(product.bulkPrice))} / ${escapeHtml(product.unit)})`;
    });
  }

  function updateProductPreview() {
    document.querySelectorAll('.prod-prev-card').forEach(card => {
      const nameEl = card.querySelector('h3');
      const product = productBySlug.get(slugFromName(nameEl?.textContent));
      if (!product) return;

      const start = card.querySelector('.prod-prev-start');
      const img = card.querySelector('img');
      nameEl.textContent = product.name;
      if (start) start.textContent = `From ${productPriceText(product)}`;
      if (img) {
        img.src = product.image;
        img.alt = `${product.name} by SS Bricks Tirupati`;
      }
    });
  }

  function updateProductDetails() {
    document.querySelectorAll('.prod-detail').forEach(section => {
      const product = productBySlug.get(section.id);
      if (!product) return;

      const title = section.querySelector('h2');
      const description = section.querySelector('.prod-detail-content > p');
      const image = section.querySelector('.prod-img-wrap img');
      const imagePrice = section.querySelector('.pip-price');
      const imageUnit = section.querySelector('.pip-unit');
      const boxes = section.querySelectorAll('.prod-info-box');

      if (title) title.textContent = product.name;
      if (description) description.textContent = product.description;
      if (image) {
        image.src = product.image;
        image.alt = `${product.name} - SS Bricks Tirupati`;
      }
      if (imagePrice) imagePrice.textContent = formatMoney(product.standardPrice);
      if (imageUnit) imageUnit.textContent = `per ${product.unit}`;
      if (boxes[0]) {
        boxes[0].querySelector('.pib-val').textContent = formatMoney(product.standardPrice);
        boxes[0].querySelector('.pib-sub').textContent = `per ${product.unit}`;
      }
      if (boxes[1]) {
        boxes[1].querySelector('.pib-val').textContent = formatMoney(product.bulkPrice);
        boxes[1].querySelector('.pib-sub').textContent = `Above ${Number(product.bulkQuantity).toLocaleString('en-IN')} ${pluralUnit(product)}`;
      }
    });
  }

  function updateComparisonTable() {
    document.querySelectorAll('.comp-table tbody tr').forEach(row => {
      const product = productCatalog.find(item => row.textContent.includes(item.name));
      if (!product) return;
      const cells = row.querySelectorAll('td');
      if (cells[1]) cells[1].innerHTML = `<strong style="color:var(--maroon);">${escapeHtml(productPriceText(product))}</strong>`;
      if (cells[5]) cells[5].textContent = `Above ${Number(product.bulkQuantity).toLocaleString('en-IN')} ${pluralUnit(product)}`;
    });
  }

  function renderPublicProducts() {
    updateHeroPrice();
    updatePriceCards();
    updateBulkOffers();
    updateProductPreview();
    updateProductDetails();
    updateComparisonTable();
    refreshProductSelects();
  }

  async function loadPublicProducts() {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to load product data.');
    }

    productCatalog = result.data.products || [];
    productBySlug = new Map(productCatalog.map(product => [product.slug, product]));
    validProductNames = productCatalog
      .filter(product => product.availability === 'IN_STOCK')
      .map(product => product.name);
    renderPublicProducts();
  }

  initCalculator('home-');
  initCalculator('prod-');
  loadPublicProducts().catch(error => {
    console.error(error);
  });

  /* ── Quote Form Submit ─────────────────────────── */
  const WHATSAPP_PHONE = '919876543210';

  function normalizeSpaces(value) {
    return (value || '').trim();
  }

  function normalizePhone(value) {
    let phone = normalizeSpaces(value).replace(/[\s-]/g, '');
    if (phone.startsWith('+91')) phone = phone.slice(3);
    if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
    return phone;
  }

  function normalizeQuantity(value) {
    const cleaned = normalizeSpaces(value).replace(/,/g, '');
    return cleaned || '0';
  }

  function getField(form, name) {
    return form.querySelector(`[name="${name}"]`);
  }

  function getFormPayload(form) {
    return {
      name: normalizeSpaces(getField(form, 'name')?.value),
      phone: normalizePhone(getField(form, 'mobile')?.value),
      location: normalizeSpaces(getField(form, 'location')?.value),
      product: normalizeSpaces(getField(form, 'product')?.value),
      quantity: normalizeQuantity(getField(form, 'quantity')?.value),
      deliveryDate: normalizeSpaces(getField(form, 'delivery_date')?.value),
      message: normalizeSpaces(getField(form, 'message')?.value),
    };
  }

  function clearFormFeedback(form) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('.is-invalid').forEach(el => {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });

    const statusEl = form.querySelector('.form-success');
    if (statusEl) {
      statusEl.classList.remove('show', 'error');
    }
  }

  function showFieldError(form, fieldName, message) {
    const fieldMap = {
      phone: 'mobile',
      deliveryDate: 'delivery_date',
    };
    const input = getField(form, fieldMap[fieldName] || fieldName);
    if (!input) return;

    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');

    const fieldWrap = input.closest('.form-field') || input.parentElement;
    if (!fieldWrap) return;

    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    fieldWrap.appendChild(errorEl);
  }

  function showStatus(form, message, isError) {
    const statusEl = form.querySelector('.form-success');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.classList.toggle('error', Boolean(isError));
    statusEl.classList.add('show');
  }

  function validateQuotePayload(payload) {
    const errors = [];
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const quantity = Number(payload.quantity);

    if (!payload.name) {
      errors.push({ field: 'name', message: 'Name is required.' });
    } else if (payload.name.length < 2 || payload.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be 2 to 100 characters.' });
    } else if (!/^[A-Za-z ]+$/.test(payload.name)) {
      errors.push({ field: 'name', message: 'Use alphabets and spaces only.' });
    } else if (/\s{2,}/.test(payload.name)) {
      errors.push({ field: 'name', message: 'Remove consecutive spaces.' });
    }

    if (!/^[6-9]\d{9}$/.test(payload.phone)) {
      errors.push({ field: 'phone', message: 'Enter a valid 10 digit Indian mobile number.' });
    }

    if (!payload.location) {
      errors.push({ field: 'location', message: 'Location is required.' });
    } else if (payload.location.length < 2 || payload.location.length > 100) {
      errors.push({ field: 'location', message: 'Location must be 2 to 100 characters.' });
    }

    if (!validProductNames.includes(payload.product)) {
      errors.push({ field: 'product', message: 'Select a product.' });
    }

    if (!/^\d+$/.test(payload.quantity) || !Number.isInteger(quantity) || quantity < 0) {
      errors.push({ field: 'quantity', message: 'Enter zero or a whole number.' });
    } else if (quantity > 100000) {
      errors.push({ field: 'quantity', message: 'Quantity cannot exceed 100000.' });
    }

    if (!payload.deliveryDate) {
      errors.push({ field: 'deliveryDate', message: 'Delivery date is required.' });
    } else {
      const delivery = new Date(`${payload.deliveryDate}T00:00:00`);
      if (Number.isNaN(delivery.getTime()) || delivery < todayOnly) {
        errors.push({ field: 'deliveryDate', message: 'Delivery date cannot be in the past.' });
      }
    }

    if (payload.message && payload.message.length > 500) {
      errors.push({ field: 'message', message: 'Message must be 500 characters or fewer.' });
    }

    return errors;
  }

  function applyServerErrors(form, errors) {
    if (!Array.isArray(errors) || !errors.length) return;
    errors.forEach(error => showFieldError(form, error.field, error.message));
  }

  function focusFirstInvalidField(form) {
    const firstInvalid = form.querySelector('.is-invalid');
    firstInvalid?.focus();
  }

  function absoluteApiUrl(path) {
    if (!path) return '';
    return new URL(path, API_BASE_URL || window.location.origin).href;
  }

  function buildWhatsAppUrl(payload, enquiryNumber, pdfUrl) {
    const pdfLine = pdfUrl ? `\nQuotation PDF: ${pdfUrl}` : '';
    const msg = encodeURIComponent(
      `New Enquiry from SS Bricks Website\nEnquiry No: ${enquiryNumber}\nName: ${payload.name}\nMobile: ${payload.phone}\nProduct: ${payload.product}\nQuantity: ${payload.quantity}\nLocation: ${payload.location}\nDelivery Date: ${payload.deliveryDate}\nMessage: ${payload.message || 'N/A'}${pdfLine}`
    );

    return `https://wa.me/${WHATSAPP_PHONE}?text=${msg}`;
  }

  async function shareQuotePdfFile(pdfUrl, enquiryNumber) {
    if (!pdfUrl || !navigator.share || !window.File) return false;

    try {
      const response = await fetch(pdfUrl, { cache: 'no-store' });
      if (!response.ok) return false;

      const blob = await response.blob();
      const file = new File([blob], `${enquiryNumber}.pdf`, { type: 'application/pdf' });
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) return false;

      await navigator.share({
        files: [file],
        title: `SS Bricks Quote ${enquiryNumber}`,
        text: 'Please send this quotation PDF to SS Bricks on WhatsApp.',
      });

      return true;
    } catch (_error) {
      return false;
    }
  }

  document.querySelectorAll('.quote-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      if (form.dataset.submitting === 'true') return;

      const btn = form.querySelector('[type="submit"]');
      const payload = getFormPayload(form);
      clearFormFeedback(form);

      const clientErrors = validateQuotePayload(payload);
      if (clientErrors.length) {
        clientErrors.forEach(error => showFieldError(form, error.field, error.message));
        showStatus(form, 'Please fix the highlighted fields.', true);
        focusFirstInvalidField(form);
        return;
      }

      form.dataset.submitting = 'true';
      if (btn) {
        btn.textContent = 'Sending...';
        btn.disabled = true;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/quotes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            quantity: Number(payload.quantity),
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          applyServerErrors(form, result.errors);
          showStatus(form, result.message || 'Unable to submit quotation. Please try again.', true);
          focusFirstInvalidField(form);
          return;
        }

        const enquiryNumber = result.data?.enquiryNumber || 'Stored';
        const pdfUrl = result.data?.pdfReady ? absoluteApiUrl(result.data?.pdfUrl) : '';
        const sharedPdf = await shareQuotePdfFile(pdfUrl, enquiryNumber);
        if (!sharedPdf) {
          window.open(buildWhatsAppUrl(payload, enquiryNumber, pdfUrl), '_blank', 'noopener');
        }
        showStatus(form, `Quotation stored successfully. Enquiry number: ${enquiryNumber}`);
        form.reset();
      } catch (_error) {
        showStatus(form, 'Unable to reach the server. Your details are still on the form; please try again.', true);
      } finally {
        form.dataset.submitting = 'false';
        if (btn) {
          btn.textContent = btn.dataset.label || 'Get Quote';
          btn.disabled = false;
        }
      }
    });
  });

  /* ── Smooth scroll for hash links ─────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

})();
