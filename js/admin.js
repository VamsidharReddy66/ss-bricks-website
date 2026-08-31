(function () {
  'use strict';

  const API_BASE_URL = window.SSB_API_BASE_URL || '';
  const loginView = document.getElementById('admin-login-view');
  const appView = document.getElementById('admin-app-view');
  const loginForm = document.getElementById('admin-login-form');
  const loginStatus = document.getElementById('admin-login-status');
  const toast = document.getElementById('admin-toast');
  const modal = document.getElementById('admin-product-modal');
  const leadModal = document.getElementById('admin-lead-modal');
  const leadDetailModal = document.getElementById('admin-lead-detail-modal');
  const importModal = document.getElementById('admin-import-modal');
  const businessImportModal = document.getElementById('admin-business-import-modal');
  const businessRecordModal = document.getElementById('admin-business-record-modal');
  const saleModal = document.getElementById('admin-sale-modal');
  const productForm = document.getElementById('admin-product-form');
  const leadForm = document.getElementById('admin-lead-form');
  const saleForm = document.getElementById('admin-sale-form');
  const leadEditForm = document.getElementById('admin-lead-edit-form');
  const leadNotesForm = document.getElementById('admin-lead-notes-form');
  const leadNoteForm = document.getElementById('admin-lead-note-form');
  const paymentForm = document.getElementById('admin-payment-form');
  const importForm = document.getElementById('admin-import-form');
  const businessImportForm = document.getElementById('admin-business-import-form');
  const businessRecordForm = document.getElementById('admin-business-record-form');
  const productStatus = document.getElementById('admin-product-status');
  const leadStatus = document.getElementById('admin-lead-status');
  const leadEditStatus = document.getElementById('admin-lead-edit-status');
  const leadNotesStatus = document.getElementById('admin-lead-notes-status');
  const leadNoteStatus = document.getElementById('admin-lead-note-status');
  const paymentStatus = document.getElementById('admin-payment-status');
  const importStatus = document.getElementById('admin-import-status');
  const saleFormStatus = document.getElementById('admin-sale-status');
  const importPreview = document.getElementById('admin-import-preview');
  const businessImportPreview = document.getElementById('admin-business-import-preview');
  const businessImportStatus = document.getElementById('admin-business-import-status');
  const businessRecordStatus = document.getElementById('admin-business-record-status');
  const pageTitle = document.getElementById('admin-page-title');

  let products = [];
  let dashboard = {};
  let admin = null;
  let importRows = [];
  let leadPage = 1;
  let leadFilter = 'ALL';
  let leadSearch = '';
  let leadPagination = {
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20,
  };
  let activeLead = null;
  let showAllTimeline = false;
  let analytics = {};
  let sales = [];
  let salesTotals = {};
  let salesRange = 'LAST_6_MONTHS';
  let salesType = 'ALL';
  let salesStatusFilter = 'ALL';
  let salesSearch = '';
  let salesPage = 1;
  let salesPagination = {
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20,
  };
  let salesGridEditing = false;
  let salesGridDrafts = new Map();
  let salesGridOriginals = new Map();
  let salesGridDirty = new Set();
  let businessImportReady = false;
  const businessRecordCache = new Map();
  const businessLogState = Object.fromEntries(
    ['sales', 'receipts', 'expenses', 'purchases', 'production', 'labour'].map((type) => [type, {
      page: 1,
      totalPages: 1,
      total: 0,
      search: '',
      origin: 'ALL',
    }]),
  );

  const BUSINESS_RECORD_FIELDS = {
    sales: [
      ['saleDate', 'Sale Date', 'date', true],
      ['customerName', 'Customer Name', 'text', true],
      ['customerPhone', 'Phone', 'tel'],
      ['location', 'Location', 'text'],
      ['productName', 'Product', 'text'],
      ['quantity', 'Quantity', 'number'],
      ['quantityUnit', 'Quantity Unit', 'text', true, 'load'],
      ['unitPrice', 'Unit Price', 'number'],
      ['driverBatta', 'Driver Batta', 'number'],
      ['invoicedAmount', 'Invoiced Amount', 'number', true],
      ['paymentMethod', 'Payment Method', 'text'],
      ['receivedTo', 'Received To', 'text'],
      ['notes', 'Notes', 'textarea'],
    ],
    receipts: [
      ['receiptDate', 'Receipt Date', 'date', true],
      ['saleId', 'Ledger Sale ID', 'number'],
      ['customerName', 'Customer Name', 'text'],
      ['amount', 'Amount Received', 'number', true],
      ['paymentMethod', 'Payment Method', 'text'],
      ['receivedTo', 'Received To', 'text'],
      ['reference', 'Payment Reference', 'text'],
      ['notes', 'Notes', 'textarea'],
    ],
    expenses: [
      ['expenseDate', 'Expense Date', 'date', true],
      ['category', 'Category', 'text', true, 'UNCATEGORIZED'],
      ['description', 'Description', 'text'],
      ['amount', 'Amount', 'number', true],
      ['paymentMethod', 'Payment Method', 'text'],
      ['paidBy', 'Paid By', 'text'],
      ['notes', 'Notes', 'textarea'],
    ],
    purchases: [
      ['purchaseDate', 'Purchase Date', 'date', true],
      ['materialName', 'Material', 'text', true],
      ['unitPrice', 'Unit Price', 'number'],
      ['quantity', 'Quantity', 'number'],
      ['purchaseAmount', 'Purchase Amount', 'number', true],
      ['driverBatta', 'Driver Batta', 'number', false, '0'],
      ['vendorName', 'Vendor', 'text'],
      ['paidDate', 'Paid Date', 'date'],
      ['paymentStatus', 'Payment Status', 'select', true, 'UNKNOWN', ['PAID', 'PENDING', 'UNKNOWN']],
      ['paymentMethod', 'Payment Method', 'text'],
      ['paidBy', 'Paid By', 'text'],
      ['notes', 'Notes', 'textarea'],
    ],
    production: [
      ['recordDate', 'Record Date', 'date', true],
      ['recordType', 'Record Type', 'select', true, 'PRODUCTION', ['PRODUCTION', 'NO_PRODUCTION', 'SUNDAY', 'UNKNOWN']],
      ['productName', 'Product', 'text'],
      ['quantity', 'Quantity', 'number'],
      ['reason', 'Reason', 'text'],
      ['qualityNote', 'Quality Note', 'textarea'],
    ],
    labour: [
      ['paymentDate', 'Payment Date', 'date', true],
      ['workDescription', 'Work Description', 'text', true],
      ['quantity', 'Quantity', 'number'],
      ['rawQuantity', 'Original Quantity Note', 'text'],
      ['brickMakingAmount', 'Brick Making Amount', 'number'],
      ['otherPaymentNote', 'Other Payment Note', 'text'],
      ['totalAmount', 'Total Amount', 'number', true],
      ['pendingAmount', 'Pending Amount Stated', 'number'],
      ['paymentMethod', 'Payment Method', 'text'],
      ['paidBy', 'Paid By', 'text'],
      ['notes', 'Notes', 'textarea'],
    ],
    events: [
      ['occurredAt', 'Occurred At', 'datetime-local', true],
      ['type', 'Event Type', 'select', true, 'BUSINESS_NOTE', ['CUSTOMER_ISSUE', 'MACHINE_PROBLEM', 'STOCK_ISSUE', 'VENDOR_ISSUE', 'RECEIVABLE_FOLLOW_UP', 'LARGE_ORDER', 'CORRECTION', 'OPERATIONAL_OBSERVATION', 'BUSINESS_NOTE']],
      ['category', 'Category', 'text'],
      ['description', 'Description', 'textarea', true],
      ['amount', 'Related Amount', 'number'],
      ['impact', 'Impact', 'select', true, 'NEUTRAL', ['POSITIVE', 'NEGATIVE', 'NEUTRAL']],
      ['status', 'Status', 'select', true, 'OPEN', ['OPEN', 'RESOLVED', 'ARCHIVED']],
    ],
  };

  function getToken() {
    return localStorage.getItem('ssbAdminToken') || sessionStorage.getItem('ssbAdminToken');
  }

  function setToken(token, remember) {
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem('ssbAdminToken');
    target.setItem('ssbAdminToken', token);
  }

  function clearToken() {
    localStorage.removeItem('ssbAdminToken');
    sessionStorage.removeItem('ssbAdminToken');
  }

  function showStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', Boolean(isError));
    el.classList.add('show');
  }

  function hideStatus(el) {
    if (!el) return;
    el.classList.remove('show', 'error');
    el.textContent = '';
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function money(value) {
    return `Rs.${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function compactNumber(value) {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value || 0));
  }

  function compactMoney(value) {
    return `Rs.${compactNumber(value)}`;
  }

  function percent(value) {
    return `${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}%`;
  }

  function dateTime(value) {
    if (!value) return 'Not updated yet';
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function dateOnly(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', {
      dateStyle: 'medium',
    });
  }

  function dateInputValue(value) {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 10);
  }

  function label(value) {
    return String(value || '')
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function statusOptions(current) {
    return ['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST', 'CLOSED']
      .map((status) => `<option value="${status}" ${status === current ? 'selected' : ''}>${label(status)}</option>`)
      .join('');
  }

  function priorityOptions(current) {
    return ['HIGH', 'MEDIUM', 'LOW']
      .map((priority) => `<option value="${priority}" ${priority === current ? 'selected' : ''}>${label(priority)}</option>`)
      .join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function mappingSelect(field, labelText, headers, mapping) {
    let current = mapping?.[field] || '';
    if (!current && mapping?.name?.includes('+')) {
      const [firstName, lastName] = mapping.name.split('+');
      if (field === 'firstName') current = firstName;
      if (field === 'lastName') current = lastName;
    }
    const baseOptions = [''].concat(headers || []);
    if (field === 'name' && current.includes('+') && !baseOptions.includes(current)) {
      baseOptions.splice(1, 0, current);
    }
    const options = baseOptions.map((header) => {
      const labelValue = header.includes('+') ? header.replace('+', ' + ') : header;
      return `<option value="${escapeHtml(header)}" ${header === current ? 'selected' : ''}>${header ? escapeHtml(labelValue) : 'Not mapped'}</option>`;
    }).join('');

    return `
      <label class="admin-map-field">
        <span>${labelText}</span>
        <select class="form-select" data-import-map="${field}">${options}</select>
      </label>
    `;
  }

  function getImportMapping() {
    const selects = document.querySelectorAll('[data-import-map]');
    if (!selects.length) return null;

    const mapping = {};
    selects.forEach((select) => {
      if (select.value) mapping[select.dataset.importMap] = select.value;
    });

    if (!mapping.name && mapping.firstName && mapping.lastName) {
      mapping.name = `${mapping.firstName}+${mapping.lastName}`;
    }

    delete mapping.firstName;
    delete mapping.lastName;
    return mapping;
  }

  function duplicateActionOptions(current) {
    return ['SKIP', 'UPDATE_EXISTING', 'IMPORT_ANYWAY']
      .map((action) => `<option value="${action}" ${action === current ? 'selected' : ''}>${label(action)}</option>`)
      .join('');
  }

  function refreshImportRowActions() {
    document.querySelectorAll('[data-import-row-action]').forEach((select) => {
      const index = Number(select.dataset.importRowAction);
      if (importRows[index]) {
        importRows[index].duplicateAction = select.value;
      }
    });
  }

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      if (response.status === 401) {
        clearToken();
        showLogin();
      }
      const error = new Error(result.message || 'Request failed.');
      error.errors = result.errors || [];
      throw error;
    }

    return result.data || {};
  }

  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
  }

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
  }

  function productCard(product, compact) {
    const stockClass = product.availability === 'IN_STOCK' ? 'in' : 'out';
    const stockText = product.availability === 'IN_STOCK' ? 'In Stock' : 'Out of Stock';
    return `
      <article class="admin-product-card">
        <div class="admin-product-top">
          <div>
            <div class="admin-product-name">${escapeHtml(product.name)}</div>
            ${compact ? '' : `<p class="body-sm text-muted">${escapeHtml(product.description)}</p>`}
          </div>
          <span class="admin-stock ${stockClass}">${stockText}</span>
        </div>
        <div class="admin-price-row">
          <div>
            <div class="admin-price-label">Standard Price</div>
            <div class="admin-price-value">${money(product.standardPrice)}</div>
          </div>
          <div>
            <div class="admin-price-label">Bulk Price</div>
            <div class="admin-price-value">${money(product.bulkPrice)}</div>
          </div>
        </div>
        <p class="body-sm text-muted">Bulk from ${Number(product.bulkQuantity).toLocaleString('en-IN')} ${escapeHtml(product.unit)}${product.bulkQuantity === 1 ? '' : 's'}</p>
        <button class="btn btn-maroon btn-sm btn-full" type="button" data-edit-product="${product.id}">Edit</button>
      </article>
    `;
  }

  function renderProducts() {
    const dashboardGrid = document.getElementById('admin-dashboard-products');
    const productsGrid = document.getElementById('admin-products');
    if (dashboardGrid) dashboardGrid.innerHTML = products.map((item) => productCard(item, true)).join('');
    if (productsGrid) productsGrid.innerHTML = products.map((item) => productCard(item, false)).join('');
    const leadProduct = document.getElementById('lead-product');
    if (leadProduct) {
      leadProduct.innerHTML = products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>`).join('');
    }
    const editLeadProduct = document.getElementById('edit-lead-product');
    if (editLeadProduct) {
      editLeadProduct.innerHTML = products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>`).join('');
    }
    const saleProduct = document.getElementById('sale-product');
    if (saleProduct) {
      saleProduct.innerHTML = products.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>`).join('');
    }
  }

  function renderStats() {
    const stats = document.getElementById('admin-stats');
    if (!stats) return;

    const values = [
      {
        label: 'Total Leads',
        value: dashboard.totalLeads || 0,
        secondary: `↑ +${dashboard.todayLeads || 0} Today`,
      },
      {
        label: 'Pending Follow-ups',
        value: dashboard.pendingFollowUps || 0,
      },
      {
        label: 'Products',
        value: dashboard.productCount || products.length,
      },
      {
        label: 'Last Price Update',
        value: dashboard.lastPriceUpdate ? dateTime(dashboard.lastPriceUpdate) : 'None',
      },
    ];
    values[0].secondary = `\u2191 +${dashboard.todayLeads || 0} Today`;

    stats.innerHTML = values.map((item) => `
      <article class="admin-stat-card">
        <div class="admin-stat-label">${escapeHtml(item.label)}</div>
        <div class="admin-stat-value">${escapeHtml(item.value)}</div>
        ${item.secondary ? `<div class="admin-stat-secondary">${escapeHtml(item.secondary)}</div>` : ''}
      </article>
    `).join('');

    const activityList = document.getElementById('admin-recent-activities');
    if (activityList) {
      const activities = dashboard.recentActivities || [];
      activityList.innerHTML = activities.length ? activities.map((activity) => `
        <div class="admin-history-item">
          <div>
            <strong>${escapeHtml(activity.customerName)}</strong>
            <div class="body-sm text-muted">${escapeHtml(activity.note)}</div>
          </div>
          <div class="body-sm text-muted">${escapeHtml(dateTime(activity.createdAt))}</div>
        </div>
      `).join('') : '<p class="body-sm text-muted">No lead activities yet.</p>';
    }
  }

  async function loadDashboard() {
    dashboard = await api('/api/admin/dashboard');
    admin = dashboard.admin;
    renderStats();
    document.getElementById('admin-account-summary').textContent = admin
      ? `${admin.name} (${admin.email})`
      : '';
  }

  async function loadProducts() {
    const data = await api('/api/admin/products');
    products = data.products || [];
    renderProducts();
    renderStats();
  }

  function renderAnalyticsStats() {
    const target = document.getElementById('admin-analytics-stats');
    if (!target) return;
    const report = analytics.business || {};
    const sales = Number(report.sales?.invoicedAmount || 0);
    const outflows = Number(report.finance?.recordedOutflows || 0);
    const cards = [
      {
        label: 'Invoiced Sales',
        value: money(sales),
        context: `${Number(report.sales?.records || 0).toLocaleString('en-IN')} normalized sale records`,
      },
      {
        label: 'Recorded Outflows',
        value: money(outflows),
        context: 'Recorded payments and obligations; not COGS',
      },
      {
        label: 'Sales / Outflows',
        value: percent(outflows ? (sales / outflows) * 100 : 0),
        context: 'Coverage comparison only; not margin or break-even',
      },
      {
        label: 'Production Output',
        value: Number(report.operations?.productionUnits || 0).toLocaleString('en-IN'),
        context: `${Number(report.operations?.productionLineItems || 0).toLocaleString('en-IN')} production entries`,
      },
      {
        label: 'No-production Rows',
        value: Number(report.operations?.noProductionDays || 0).toLocaleString('en-IN'),
        context: 'Explicitly recorded in the production sheet',
      },
      {
        label: 'Rows to Review',
        value: Number(report.trust?.reviewRows || 0).toLocaleString('en-IN'),
        context: `${Number(report.trust?.sourceRows || 0).toLocaleString('en-IN')} total workbook rows`,
      },
    ];
    target.innerHTML = cards.map((card) => `
      <article class="admin-stat-card">
        <div class="admin-stat-label">${escapeHtml(card.label)}</div>
        <div class="admin-stat-value">${escapeHtml(card.value)}</div>
        <div class="${card.secondary ? 'admin-stat-secondary' : 'admin-stat-context'}">${escapeHtml(card.context)}</div>
      </article>
    `).join('');
  }

  function renderMonthlySales() {
    const rows = analytics.business?.sales?.monthly || [];
    renderColumnChart('admin-sales-monthly-chart', rows, [
      { key: 'invoiced', title: 'invoiced', formatter: compactMoney, color: analyticsColors[1] },
    ], { emptyMessage: 'No workbook sales in this period.' });
  }

  function renderLeadPipeline() {
    const target = document.getElementById('admin-lead-pipeline-chart');
    const rows = (analytics.leadPipeline || []).filter((row) => row.count > 0);
    if (!rows.length) {
      target.innerHTML = '<p class="body-sm text-muted">No leads in this period.</p>';
      return;
    }
    const maxValue = Math.max(...rows.map((row) => row.count), 1);
    target.innerHTML = rows.map((row) => `
      <div class="admin-pipeline-row">
        <span class="admin-pipeline-label" title="${escapeHtml(label(row.status))}">${escapeHtml(label(row.status))}</span>
        <span class="admin-pipeline-track"><span class="admin-pipeline-fill" style="width:${(row.count / maxValue) * 100}%"></span></span>
        <span class="admin-pipeline-value">${Number(row.count).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  function renderProductPerformance() {
    const rows = analytics.business?.sales?.products || [];
    renderHorizontalChart('admin-overview-product-bars', rows, {
      formatter: compactMoney,
      emptyMessage: 'No workbook sales in this period.',
    });
  }

  function renderSourcePerformance() {
    const target = document.getElementById('admin-source-performance');
    const rows = analytics.sourcePerformance || [];
    target.innerHTML = rows.length ? rows.map((row) => `
      <div class="admin-source-row">
        <div>
          <div class="admin-source-name">${escapeHtml(label(row.source))}</div>
          <div class="admin-source-meta">${Number(row.converted).toLocaleString('en-IN')} verified conversion${row.converted === 1 ? '' : 's'}</div>
        </div>
        <div class="admin-source-meta">${Number(row.leads).toLocaleString('en-IN')} lead${row.leads === 1 ? '' : 's'}<br>${escapeHtml(percent(row.conversionRate))}</div>
      </div>
    `).join('') : '<p class="body-sm text-muted">No lead source data in this period.</p>';
  }

  function renderOutstandingAccounts() {
    const target = document.getElementById('admin-outstanding-accounts');
    const rows = analytics.business?.sales?.customers || [];
    target.innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td>${escapeHtml(money(row.value))}</td>
        <td>${Number(row.records).toLocaleString('en-IN')}</td>
      </tr>
    `).join('') : '<tr><td colspan="3" class="text-muted">No workbook customers in this period.</td></tr>';
  }

  function renderAnalyticsCoverage() {
    const target = document.getElementById('admin-analytics-coverage');
    const report = analytics.business || {};
    const rows = [
      ['Sales', report.sales?.records || 0],
      ['Receipt references', report.trust?.summary?.receipts || 0],
      ['Expenses', report.trust?.summary?.expenses || 0],
      ['Material purchases', report.trust?.summary?.materialPurchases || 0],
      ['Production records', report.trust?.summary?.productionRecords || 0],
      ['Labour payments', report.labour?.paymentRecords || 0],
      ['Vendor references', report.trust?.summary?.vendors || 0],
      ['Customer references', report.trust?.summary?.customerReferences || 0],
      ['Source rows', report.trust?.sourceRows || 0],
      ['Rows requiring review', report.trust?.reviewRows || 0],
    ];
    target.innerHTML = rows.map(([name, value]) => `
      <div class="admin-coverage-row">
        <span class="admin-coverage-name">${escapeHtml(name)}</span>
        <span class="admin-coverage-value">${Number(value).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  function renderReportStats(targetId, cards) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = cards.map((card) => `
      <article class="admin-stat-card">
        <div class="admin-stat-label">${escapeHtml(card.label)}</div>
        <div class="admin-stat-value">${escapeHtml(card.value)}</div>
        <div class="${card.tone === 'positive' ? 'admin-stat-secondary' : 'admin-stat-context'}">${escapeHtml(card.context || '')}</div>
      </article>
    `).join('');
  }

  function renderBreakdown(targetId, rows, emptyMessage) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = rows.length ? rows.map((row) => `
      <div class="admin-breakdown-row ${escapeHtml(row.tone || '')}">
        <div>
          <div class="admin-breakdown-name">${escapeHtml(row.name)}</div>
          ${row.detail ? `<div class="admin-breakdown-meta">${escapeHtml(row.detail)}</div>` : ''}
        </div>
        <strong>${escapeHtml(row.value)}</strong>
      </div>
    `).join('') : `<p class="body-sm text-muted">${escapeHtml(emptyMessage)}</p>`;
  }

  const analyticsColors = ['#6B1713', '#2F6F9F', '#16A34A', '#C47A21', '#7C6DD1', '#A72F22', '#537A63', '#ABA28F'];

  function businessInsightIcon(severity) {
    const icons = {
      CRITICAL: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><path d="M12 17h.01"></path></svg>',
      WARNING: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path></svg>',
      OPPORTUNITY: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg>',
      INFO: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7h.01"></path></svg>',
    };
    return icons[severity] || icons.INFO;
  }

  function renderLineChart(targetId, rows, series, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const visibleRows = rows || [];
    if (!visibleRows.length) {
      target.innerHTML = `<div class="admin-chart-empty">${escapeHtml(options.emptyMessage || 'No activity in this period.')}</div>`;
      return;
    }
    const width = 760;
    const height = 285;
    const padding = { top: 18, right: 18, bottom: 42, left: 58 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const values = visibleRows.flatMap((row) => series.map((item) => Number(row[item.key] || 0)));
    const maxValue = Math.max(...values, 1);
    const xAt = (index) => padding.left + (visibleRows.length === 1 ? plotWidth / 2 : (index / (visibleRows.length - 1)) * plotWidth);
    const yAt = (value) => padding.top + plotHeight - ((Number(value || 0) / maxValue) * plotHeight);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const y = padding.top + plotHeight - (ratio * plotHeight);
      return `<line class="admin-chart-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}"></line><text class="admin-chart-axis-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(compactNumber(maxValue * ratio))}</text>`;
    }).join('');
    const xLabels = visibleRows.map((row, index) => `<text class="admin-chart-axis-label" x="${xAt(index)}" y="${height - 12}" text-anchor="middle">${escapeHtml(row.label)}</text>`).join('');
    const lines = series.map((item, seriesIndex) => {
      const color = item.color || analyticsColors[seriesIndex % analyticsColors.length];
      const points = visibleRows.map((row, index) => `${xAt(index)},${yAt(row[item.key])}`).join(' ');
      const area = item.area
        ? `<polygon class="admin-chart-area" points="${padding.left},${padding.top + plotHeight} ${points} ${width - padding.right},${padding.top + plotHeight}" fill="${color}"></polygon>`
        : '';
      const circles = visibleRows.map((row, index) => {
        const value = Number(row[item.key] || 0);
        const formatted = (item.formatter || compactNumber)(value);
        return `<circle class="admin-chart-point" cx="${xAt(index)}" cy="${yAt(value)}" r="4" fill="${color}"><title>${escapeHtml(`${row.label}: ${formatted} ${item.title || ''}`.trim())}</title></circle>`;
      }).join('');
      return `${area}<polyline class="admin-chart-series" points="${points}" stroke="${color}"></polyline>${circles}`;
    }).join('');
    target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.ariaLabel || 'Analytics trend chart')}">${grid}${xLabels}${lines}</svg>`;
  }

  function renderColumnChart(targetId, rows, series, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const visibleRows = rows || [];
    if (!visibleRows.length) {
      target.innerHTML = `<div class="admin-chart-empty">${escapeHtml(options.emptyMessage || 'No activity in this period.')}</div>`;
      return;
    }
    const maxValue = Math.max(...visibleRows.flatMap((row) => series.map((item) => Number(row[item.key] || 0))), 1);
    target.style.setProperty('--chart-columns', String(visibleRows.length));
    target.innerHTML = visibleRows.map((row) => `
      <div class="admin-column-group">
        <div class="admin-column-bars">
          ${series.map((item, index) => {
            const value = Number(row[item.key] || 0);
            const height = value ? Math.max((value / maxValue) * 178, 3) : 0;
            const formatted = (item.formatter || compactNumber)(value);
            return `<span class="admin-column-bar" style="height:${height}px;--bar-color:${item.color || analyticsColors[index % analyticsColors.length]}" title="${escapeHtml(`${row.label}: ${formatted} ${item.title || ''}`.trim())}"></span>`;
          }).join('')}
        </div>
        <span class="admin-month-label">${escapeHtml(row.label)}</span>
      </div>
    `).join('');
  }

  function renderHorizontalChart(targetId, rows, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const visibleRows = (rows || []).filter((row) => Number(row.value || 0) >= 0);
    if (!visibleRows.length) {
      target.innerHTML = `<div class="admin-chart-empty">${escapeHtml(options.emptyMessage || 'No values in this period.')}</div>`;
      return;
    }
    const maxValue = Math.max(...visibleRows.map((row) => Number(row.value || 0)), 1);
    target.innerHTML = visibleRows.map((row, index) => {
      const value = Number(row.value || 0);
      const formatted = (options.formatter || compactNumber)(value);
      const color = row.color || analyticsColors[index % analyticsColors.length];
      return `
        <div class="admin-horizontal-row">
          <span class="admin-horizontal-label" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
          <span class="admin-horizontal-track"><span class="admin-horizontal-fill" style="width:${value ? Math.max((value / maxValue) * 100, 1.5) : 0}%;--bar-color:${color}"></span></span>
          <span class="admin-horizontal-value">${escapeHtml(formatted)}</span>
        </div>
      `;
    }).join('');
  }

  function renderDonutChart(targetId, rows, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const visibleRows = (rows || []).filter((row) => Number(row.value || 0) > 0);
    const total = visibleRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    if (!visibleRows.length || !total) {
      target.innerHTML = `<div class="admin-chart-empty">${escapeHtml(options.emptyMessage || 'No values in this period.')}</div>`;
      return;
    }
    let cursor = 0;
    const segments = visibleRows.map((row, index) => {
      const start = cursor;
      cursor += (Number(row.value) / total) * 100;
      return `${row.color || analyticsColors[index % analyticsColors.length]} ${start}% ${cursor}%`;
    }).join(', ');
    const formatter = options.formatter || compactNumber;
    target.innerHTML = `
      <div class="admin-donut" style="--donut-fill:conic-gradient(${segments})">
        <div class="admin-donut-center"><strong>${escapeHtml(formatter(total))}</strong><span>${escapeHtml(options.centerLabel || 'total')}</span></div>
      </div>
      <div class="admin-donut-legend">
        ${visibleRows.map((row, index) => `
          <div class="admin-donut-legend-row">
            <i class="admin-donut-swatch" style="--swatch-color:${row.color || analyticsColors[index % analyticsColors.length]}"></i>
            <span>${escapeHtml(row.name)}</span>
            <strong>${escapeHtml(formatter(row.value))}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function businessRecordKey(type, id) {
    return `${type}:${id}`;
  }

  function cacheBusinessRecords(type, rows) {
    (rows || []).forEach((row) => businessRecordCache.set(businessRecordKey(type, row.id), row));
  }

  function businessSource(record) {
    if (record.origin === 'XLSX_IMPORT') {
      const location = record.sourceRow ? `${record.sourceRow.sheetName}, row ${record.sourceRow.rowNumber}` : 'Workbook import';
      return `<span class="admin-source-badge" title="${escapeHtml(location)}">XLSX</span>`;
    }
    return '<span class="admin-source-badge manual">Manual</span>';
  }

  function businessActions(type, record) {
    return `
      <span class="admin-record-actions">
        <button class="admin-link-button inline" type="button" data-edit-business-record="${record.id}" data-business-type="${escapeHtml(type)}">Edit</button>
        <button class="admin-icon-button small danger admin-record-void" type="button" title="Void record" aria-label="Void record" data-void-business-record="${record.id}" data-business-type="${escapeHtml(type)}">
          <svg class="admin-trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h1.5v-7H10Zm2.5 0v7H14v-7h-1.5Z"></path>
          </svg>
        </button>
      </span>
    `;
  }

  function renderBusinessTrust(report) {
    const target = document.getElementById('admin-business-import-trust');
    if (!target) return;
    if (!report?.available) {
      target.innerHTML = `<strong>Business workbook:</strong> ${escapeHtml(report?.reason || 'No business workbook has been imported yet.')}`;
      return;
    }
    const trust = report.trust || {};
    if (!trust.lastImport) {
      target.innerHTML = '<strong>Business workbook:</strong> No workbook has been imported. Analytics remains empty until an XLSX import is completed.';
      return;
    }
    const mismatches = (trust.reconciliation || []).filter((row) => row.status === 'MISMATCH').length;
    target.innerHTML = `
      <div><strong>Imported source:</strong> ${escapeHtml(trust.lastImport.fileName)} <span class="text-muted">${escapeHtml(dateTime(trust.lastImport.importedAt))}</span></div>
      <div class="admin-trust-summary">
        <span>${Number(trust.sourceRows || 0).toLocaleString('en-IN')} source rows</span>
        <span>${Number(trust.reviewRows || 0).toLocaleString('en-IN')} require review</span>
        <span>${Number(mismatches).toLocaleString('en-IN')} reconciliation mismatch${mismatches === 1 ? '' : 'es'}</span>
      </div>
    `;
  }

  function renderBusinessLogs(report) {
    const salesRows = report.sales?.recent || [];
    cacheBusinessRecords('sales', salesRows);
    document.getElementById('admin-business-sales-log').innerHTML = salesRows.length ? salesRows.map((row) => `
      <tr>
        <td>${escapeHtml(dateOnly(row.saleDate || row.reportingMonth))}</td>
        <td><strong>${escapeHtml(row.customerName)}</strong><br><span class="text-muted">Ledger #${Number(row.id).toLocaleString('en-IN')}${row.customerPhone ? ` · ${escapeHtml(row.customerPhone)}` : ''}</span></td>
        <td>${escapeHtml(row.productName || 'Not specified')}</td>
        <td>${row.quantity === null ? '-' : Number(row.quantity).toLocaleString('en-IN')} <span class="text-muted">${escapeHtml(row.quantityUnit || '')}</span></td>
        <td>${escapeHtml(money(row.invoicedAmount || 0))}</td>
        <td>${businessSource(row)}</td>
        <td>${businessActions('sales', row)}</td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-muted">No imported workbook sales in this period.</td></tr>';

    const receipts = report.finance?.recentReceipts || [];
    cacheBusinessRecords('receipts', receipts);
    document.getElementById('admin-receipt-log').innerHTML = receipts.length ? receipts.map((row) => `
      <tr><td>${escapeHtml(dateOnly(row.receiptDate || row.reportingMonth))}</td><td>${row.saleId ? `#${Number(row.saleId).toLocaleString('en-IN')}` : '-'}</td><td><strong>${escapeHtml(row.customerName || 'Not specified')}</strong></td><td class="admin-amount-received">${escapeHtml(money(row.amount))}</td><td>${escapeHtml(row.paymentMethod || '-')}</td><td>${businessSource(row)}</td><td>${businessActions('receipts', row)}</td></tr>
    `).join('') : '<tr><td colspan="7" class="text-muted">No receipt references in this period.</td></tr>';

    const expenses = report.finance?.recentExpenses || [];
    cacheBusinessRecords('expenses', expenses);
    document.getElementById('admin-expense-log').innerHTML = expenses.length ? expenses.map((row) => `
      <tr><td>${escapeHtml(dateOnly(row.expenseDate || row.reportingMonth))}</td><td><strong>${escapeHtml(row.description || 'No description')}</strong><br><span class="text-muted">${escapeHtml(label(row.category))}</span></td><td>${escapeHtml(money(row.amount))}</td><td>${escapeHtml(row.paidBy || '-')}</td><td>${businessSource(row)}</td><td>${businessActions('expenses', row)}</td></tr>
    `).join('') : '<tr><td colspan="6" class="text-muted">No expense records in this period.</td></tr>';

    const purchases = report.finance?.recentPurchases || [];
    cacheBusinessRecords('purchases', purchases);
    document.getElementById('admin-purchase-log').innerHTML = purchases.length ? purchases.map((row) => `
      <tr><td>${escapeHtml(dateOnly(row.purchaseDate || row.reportingMonth))}</td><td><strong>${escapeHtml(row.materialName)}</strong><br><span class="text-muted">${escapeHtml(row.vendorName || 'Vendor not specified')}</span></td><td>${row.quantity === null ? '-' : Number(row.quantity).toLocaleString('en-IN')}</td><td>${escapeHtml(money(row.purchaseAmount))}</td><td>${escapeHtml(label(row.paymentStatus))}</td><td>${businessSource(row)}</td><td>${businessActions('purchases', row)}</td></tr>
    `).join('') : '<tr><td colspan="7" class="text-muted">No material purchase records in this period.</td></tr>';

    const production = report.operations?.recentProduction || [];
    cacheBusinessRecords('production', production);
    document.getElementById('admin-production-log').innerHTML = production.length ? production.map((row) => `
      <tr><td>${escapeHtml(dateOnly(row.recordDate || row.reportingMonth))}</td><td>${escapeHtml(label(row.recordType))}</td><td><strong>${escapeHtml(row.productName || row.reason || '-')}</strong></td><td>${row.quantity === null ? '-' : Number(row.quantity).toLocaleString('en-IN')}</td><td>${businessSource(row)}</td><td>${businessActions('production', row)}</td></tr>
    `).join('') : '<tr><td colspan="6" class="text-muted">No production records in this period.</td></tr>';

    const labour = report.labour?.recent || [];
    cacheBusinessRecords('labour', labour);
    document.getElementById('admin-labour-log').innerHTML = labour.length ? labour.map((row) => `
      <tr><td>${escapeHtml(dateOnly(row.paymentDate || row.reportingMonth))}</td><td><strong>${escapeHtml(row.workDescription)}</strong></td><td>${row.quantity === null ? escapeHtml(row.rawQuantity || '-') : Number(row.quantity).toLocaleString('en-IN')}</td><td>${escapeHtml(money(row.totalAmount))}</td><td>${row.pendingAmount === null ? '-' : escapeHtml(money(row.pendingAmount))}</td><td>${businessSource(row)}</td><td>${businessActions('labour', row)}</td></tr>
    `).join('') : '<tr><td colspan="7" class="text-muted">No labour payment records in this period.</td></tr>';

    const events = report.events || [];
    cacheBusinessRecords('events', events);
    document.getElementById('admin-business-events-log').innerHTML = events.length ? events.map((row) => `
      <tr><td>${escapeHtml(dateTime(row.occurredAt))}</td><td>${escapeHtml(label(row.type))}</td><td><strong>${escapeHtml(row.description)}</strong>${row.category ? `<br><span class="text-muted">${escapeHtml(row.category)}</span>` : ''}</td><td>${escapeHtml(label(row.impact))}</td><td>${escapeHtml(label(row.status))}</td><td>${businessActions('events', row)}</td></tr>
    `).join('') : '<tr><td colspan="6" class="text-muted">No business events recorded in this period.</td></tr>';
  }

  function renderBusinessAnalytics() {
    const report = analytics.business || {};
    renderBusinessTrust(report);
    if (!report.available) {
      renderBusinessLogs(report);
      return;
    }

    renderLineChart('admin-overview-performance-chart', report.overview?.monthlyPerformance || [], [
      { key: 'invoiced', title: 'invoiced sales', formatter: compactMoney, color: analyticsColors[1], area: true },
      { key: 'recordedOutflows', title: 'recorded outflows', formatter: compactMoney, color: analyticsColors[3] },
    ], { ariaLabel: 'Monthly invoiced sales compared with recorded outflows' });
    renderDonutChart('admin-overview-outflow-donut', report.overview?.outflowComposition || [], {
      formatter: compactMoney,
      centerLabel: 'outflows',
    });

    const attentionTarget = document.getElementById('admin-overview-attention');
    const attention = (report.insights || []).slice(0, 5);
    attentionTarget.innerHTML = attention.length ? attention.map((item) => `
      <article class="admin-attention-item ${escapeHtml(item.severity.toLowerCase())}">
        <span class="admin-attention-icon">${businessInsightIcon(item.severity)}</span>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
        <button class="admin-insight-department" type="button" title="Open ${escapeHtml(label(item.target))} analytics" data-analytics-target="${escapeHtml(item.target)}">${escapeHtml(item.department || label(item.target))}</button>
      </article>
    `).join('') : '<p class="body-sm text-muted">No deterministic workbook alerts for this period.</p>';

    renderReportStats('admin-sales-workbook-stats', [
      { label: 'Invoiced Sales', value: money(report.sales.invoicedAmount), context: 'Normalized workbook sale value' },
      { label: 'Average Invoice', value: money(report.sales.averageInvoiceValue), context: 'Mean across normalized sale rows' },
      { label: 'Sale Records', value: Number(report.sales.records).toLocaleString('en-IN'), context: `${Number(report.sales.pricedRecords).toLocaleString('en-IN')} include a recorded unit price` },
      { label: 'Unique Customers', value: Number(report.sales.uniqueCustomers).toLocaleString('en-IN'), context: 'Normalized recorded customer names' },
    ]);
    renderDonutChart('admin-sales-product-donut', report.sales.products || [], {
      formatter: compactMoney,
      centerLabel: 'invoiced',
    });
    renderHorizontalChart('admin-sales-customer-bars', (report.sales.customers || []).slice(0, 6), {
      formatter: compactMoney,
      emptyMessage: 'No workbook customers in this period.',
    });
    const priceTarget = document.getElementById('admin-sales-price-summary');
    priceTarget.innerHTML = (report.sales.products || []).length ? report.sales.products.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td>${Number(row.records).toLocaleString('en-IN')}</td>
        <td>${escapeHtml(money(row.value))}</td>
        <td>${Number(row.quantity || 0).toLocaleString('en-IN')}</td>
        <td>${row.averageUnitPrice === null ? '<span class="text-muted">Not recorded</span>' : escapeHtml(money(row.averageUnitPrice))}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-muted">No workbook product pricing in this period.</td></tr>';

    renderReportStats('admin-finance-stats', [
      { label: 'Recorded Outflows', value: money(report.finance.recordedOutflows), context: 'Not profit, COGS, or cash balance' },
      { label: 'Factory Expenses', value: money(report.finance.factoryExpenses), context: 'Normalized expense line items' },
      { label: 'Material Purchases', value: money(report.finance.materialPurchases), context: 'Driver batta shown separately' },
      { label: 'Labour Obligations', value: money(report.finance.labourPayments), context: `${Number(report.labour.paymentRecords).toLocaleString('en-IN')} payment records` },
      { label: 'Driver Batta', value: money(report.finance.driverBatta), context: 'Recorded with material purchases' },
      { label: 'Pending Purchases', value: money(report.finance.pendingPurchaseValue), context: `${Number(report.operations.pendingPurchases).toLocaleString('en-IN')} rows explicitly marked pending` },
    ]);
    renderLineChart('admin-business-outflow-chart', report.finance.monthly || [], [
      { key: 'total', title: 'recorded outflows', formatter: compactMoney, color: analyticsColors[0], area: true },
    ], { ariaLabel: 'Monthly recorded workbook outflows' });
    renderDonutChart('admin-finance-outflow-donut', report.finance.outflowComposition || [], { formatter: compactMoney, centerLabel: 'outflows' });
    renderHorizontalChart('admin-finance-expense-bars', report.finance.expenses || [], { formatter: compactMoney });
    renderHorizontalChart('admin-finance-material-bars', report.finance.materials || [], { formatter: compactMoney });
    renderHorizontalChart('admin-finance-vendor-bars', report.finance.vendors || [], { formatter: compactMoney });
    renderBreakdown('admin-finance-purchase-status', (report.finance.purchaseStatuses || []).map((row) => ({
      name: label(row.name),
      detail: `${Number(row.records).toLocaleString('en-IN')} purchase row${row.records === 1 ? '' : 's'}`,
      value: money(row.value),
      tone: row.name === 'PENDING' ? 'warning' : '',
    })), 'No purchase payment markers in this period.');

    renderReportStats('admin-operations-stats', [
      { label: 'Production Output', value: Number(report.operations.productionUnits).toLocaleString('en-IN'), context: 'Units recorded in production rows' },
      { label: 'Production Entries', value: Number(report.operations.productionLineItems).toLocaleString('en-IN'), context: `${Number(report.operations.productionDays).toLocaleString('en-IN')} distinct dated production days` },
      { label: 'Average per Entry', value: Number(report.operations.averageOutputPerEntry).toLocaleString('en-IN', { maximumFractionDigits: 0 }), context: 'Output divided by production entries' },
      { label: 'No-production Rows', value: Number(report.operations.noProductionDays).toLocaleString('en-IN'), context: 'Explicit source rows, not inferred downtime' },
      { label: 'Sunday Rows', value: Number(report.operations.sundayRows).toLocaleString('en-IN'), context: 'Recorded separately from production output' },
      { label: 'Material Spend', value: money(report.finance.materialPurchases), context: `${Number(report.operations.pendingPurchases).toLocaleString('en-IN')} purchases marked pending` },
    ]);
    renderLineChart('admin-production-trend-chart', report.operations.monthlyProduction || [], [
      { key: 'production', title: 'produced units', formatter: compactNumber, color: analyticsColors[1], area: true },
    ], { ariaLabel: 'Monthly production output' });
    renderHorizontalChart('admin-production-product-bars', report.operations.products || [], { formatter: compactNumber });
    renderColumnChart('admin-production-activity-chart', report.operations.monthlyActivity || [], [
      { key: 'productionEntries', title: 'production entries', color: analyticsColors[1] },
      { key: 'noProduction', title: 'no-production rows', color: analyticsColors[5] },
      { key: 'sundays', title: 'Sunday rows', color: analyticsColors[7] },
    ]);
    renderBreakdown('admin-no-production-reasons', (report.operations.noProductionReasons || []).map((row) => ({
      name: row.name,
      value: `${Number(row.records).toLocaleString('en-IN')} row${row.records === 1 ? '' : 's'}`,
    })), 'No no-production reasons in this period.');

    renderReportStats('admin-team-stats', [
      { label: 'Labour Obligation', value: money(report.labour.paymentObligation), context: `${Number(report.labour.paymentRecords).toLocaleString('en-IN')} payment records` },
      { label: 'Pending Stated', value: money(report.labour.statedPendingAmount), context: 'Workbook field, not employee payroll balance' },
      { label: 'Payment Records', value: Number(report.labour.paymentRecords).toLocaleString('en-IN'), context: 'Normalized labour rows in the selected period' },
      { label: 'Average Payment', value: money(report.labour.averagePayment), context: `${Number(report.labour.pendingRecords).toLocaleString('en-IN')} rows contain a stated pending value` },
    ]);
    renderLineChart('admin-labour-trend-chart', report.labour.monthly || [], [
      { key: 'amount', title: 'labour obligations', formatter: compactMoney, color: analyticsColors[2], area: true },
    ], { ariaLabel: 'Monthly labour payment obligations' });
    renderDonutChart('admin-labour-payment-donut', report.labour.paymentMethods || [], { formatter: compactMoney, centerLabel: 'obligation' });
    renderHorizontalChart('admin-labour-work-bars', report.labour.work || [], { formatter: compactMoney });

    document.getElementById('admin-finance-coverage').innerHTML = '<strong>Scope note:</strong> Outflows are recorded ledger totals. Profit, cash balance, bank balance, and official historical receivables are unavailable because the source does not contain a complete accounting ledger or reliable receipt allocation.';
    document.getElementById('admin-operations-coverage').innerHTML = '<strong>Scope note:</strong> Production output and no-production reasons are available. Inventory, capacity utilization, material consumption, and machine downtime hours are not present in the source and are not estimated.';
    renderBusinessLogs(report);
  }

  function setBusinessLogRows(type, rows) {
    if (!analytics.business) return;
    if (type === 'sales') analytics.business.sales.recent = rows;
    if (type === 'receipts') analytics.business.finance.recentReceipts = rows;
    if (type === 'expenses') analytics.business.finance.recentExpenses = rows;
    if (type === 'purchases') analytics.business.finance.recentPurchases = rows;
    if (type === 'production') analytics.business.operations.recentProduction = rows;
    if (type === 'labour') analytics.business.labour.recent = rows;
    if (type === 'events') analytics.business.events = rows;
  }

  function renderBusinessLogPagination(type) {
    const target = document.querySelector(`[data-business-log-pagination="${type}"]`);
    const state = businessLogState[type];
    if (!target || !state) return;
    target.innerHTML = `
      <button class="btn btn-outline btn-sm" type="button" data-business-log-page="${Math.max(state.page - 1, 1)}" data-business-type="${type}" ${state.page <= 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${Number(state.page).toLocaleString('en-IN')} of ${Number(state.totalPages).toLocaleString('en-IN')} <small>(${Number(state.total).toLocaleString('en-IN')} records)</small></span>
      <button class="btn btn-outline btn-sm" type="button" data-business-log-page="${Math.min(state.page + 1, state.totalPages)}" data-business-type="${type}" ${state.page >= state.totalPages ? 'disabled' : ''}>Next</button>
    `;
  }

  async function loadBusinessLog(type, page = businessLogState[type].page) {
    const state = businessLogState[type];
    const params = new URLSearchParams({
      page: String(page),
      limit: '12',
      search: state.search,
      state: 'ACTIVE',
      origin: state.origin,
      range: salesRange,
    });
    const data = await api(`/api/admin/business-records/${type}?${params}`);
    state.page = data.pagination?.page || page;
    state.totalPages = data.pagination?.totalPages || 1;
    state.total = data.pagination?.total || 0;
    setBusinessLogRows(type, data.records || []);
    renderBusinessLogs(analytics.business);
    renderBusinessLogPagination(type);
  }

  async function loadBusinessLogs() {
    if (!analytics.business?.available) return;
    await Promise.all(Object.keys(businessLogState).map((type) => loadBusinessLog(type, businessLogState[type].page)));
  }

  function renderSeriesChart(targetId, rows, series) {
    const chart = document.getElementById(targetId);
    if (!chart) return;
    if (!rows.length) {
      chart.innerHTML = '<div class="admin-chart-empty">No activity in this period.</div>';
      return;
    }
    const maxValue = Math.max(
      ...rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0))),
      0,
    );
    chart.style.setProperty('--chart-columns', String(rows.length));
    chart.innerHTML = rows.map((row) => `
      <div class="admin-month-column">
        <div class="admin-month-bars">
          ${series.map((item) => {
            const value = Number(row[item.key] || 0);
            const height = maxValue ? (value / maxValue) * 170 : 0;
            return `<span class="admin-month-bar ${escapeHtml(item.className)} ${value ? '' : 'zero'}" style="height:${height}px" title="${escapeHtml(`${row.label}: ${value.toLocaleString('en-IN')} ${item.title}`)}"></span>`;
          }).join('')}
        </div>
        <span class="admin-month-label">${escapeHtml(row.label)}</span>
      </div>
    `).join('');
  }

  function renderPipeline(targetId, rows) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const visible = (rows || []).filter((row) => row.count > 0);
    if (!visible.length) {
      target.innerHTML = '<p class="body-sm text-muted">No leads in this period.</p>';
      return;
    }
    const maxValue = Math.max(...visible.map((row) => row.count), 1);
    target.innerHTML = visible.map((row) => `
      <div class="admin-pipeline-row">
        <span class="admin-pipeline-label" title="${escapeHtml(label(row.status))}">${escapeHtml(label(row.status))}</span>
        <span class="admin-pipeline-track"><span class="admin-pipeline-fill" style="width:${(row.count / maxValue) * 100}%"></span></span>
        <span class="admin-pipeline-value">${Number(row.count).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  function renderMarketingReport() {
    const report = analytics.marketing || {};
    const metrics = report.metrics || {};
    renderReportStats('admin-marketing-stats', [
      {
        label: 'Total Leads',
        value: Number(metrics.totalLeads || 0).toLocaleString('en-IN'),
        context: `${Number(metrics.newLeads || 0).toLocaleString('en-IN')} currently new`,
      },
      {
        label: 'Active Leads',
        value: Number(metrics.activeLeads || 0).toLocaleString('en-IN'),
        context: `${Number(metrics.highPriority || 0).toLocaleString('en-IN')} high priority`,
      },
      {
        label: 'Conversion Rate',
        value: percent(metrics.conversionRate),
        context: `${Number(metrics.convertedLeads || 0).toLocaleString('en-IN')} verified conversions`,
        tone: 'positive',
      },
      {
        label: 'Follow-up Attention',
        value: Number((metrics.dueToday || 0) + (metrics.overdueFollowUps || 0)).toLocaleString('en-IN'),
        context: `${Number(metrics.overdueFollowUps || 0).toLocaleString('en-IN')} overdue`,
      },
    ]);

    renderSeriesChart('admin-lead-trend-chart', report.leadTrend || [], [
      { key: 'leads', className: 'leads', title: 'leads' },
      { key: 'converted', className: 'converted', title: 'converted' },
    ]);
    renderPipeline('admin-marketing-funnel', analytics.leadPipeline || []);
    renderBreakdown('admin-marketing-sources', (analytics.sourcePerformance || []).map((row) => ({
      name: label(row.source),
      detail: `${Number(row.converted).toLocaleString('en-IN')} verified conversion${row.converted === 1 ? '' : 's'} (${percent(row.conversionRate)})`,
      value: `${Number(row.leads).toLocaleString('en-IN')} lead${row.leads === 1 ? '' : 's'}`,
    })), 'No acquisition source data.');
    renderBreakdown('admin-marketing-priorities', (report.priorityBreakdown || []).map((row) => ({
      name: label(row.priority),
      value: Number(row.count).toLocaleString('en-IN'),
      tone: row.priority === 'HIGH' ? 'critical' : row.priority === 'MEDIUM' ? 'warning' : '',
    })), 'No priority data.');

    const followUp = report.followUpHealth || {};
    renderBreakdown('admin-followup-health', [
      { name: 'Overdue', value: Number(followUp.overdue || 0).toLocaleString('en-IN'), tone: 'critical' },
      { name: 'Due Today', value: Number(followUp.dueToday || 0).toLocaleString('en-IN'), tone: 'warning' },
      { name: 'Scheduled Later', value: Number(followUp.future || 0).toLocaleString('en-IN') },
      { name: 'Not Scheduled', value: Number(followUp.unscheduled || 0).toLocaleString('en-IN') },
    ], 'No follow-up data.');

    const quality = report.dataQuality || {};
    renderBreakdown('admin-marketing-quality', [
      { name: 'Zero Quantity', value: Number(quality.zeroQuantity || 0).toLocaleString('en-IN') },
      { name: 'Unmatched Product', value: Number(quality.unspecifiedProduct || 0).toLocaleString('en-IN') },
      { name: 'Unassigned Leads', value: Number(quality.unassigned || 0).toLocaleString('en-IN') },
      { name: 'Missing Follow-up', value: Number(quality.missingFollowUp || 0).toLocaleString('en-IN') },
    ], 'No data quality exceptions.');

    const locations = report.locationPerformance || [];
    const locationTarget = document.getElementById('admin-location-performance');
    locationTarget.innerHTML = locations.length ? locations.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.location)}</strong></td>
        <td>${Number(row.leads).toLocaleString('en-IN')}</td>
        <td>${Number(row.converted).toLocaleString('en-IN')} <span class="text-muted">(${escapeHtml(percent(row.conversionRate))})</span></td>
        <td>${Number(row.requestedQuantity).toLocaleString('en-IN')}</td>
        <td>${escapeHtml(money(row.pipelineValue))}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-muted">No location data in this period.</td></tr>';
  }

  function renderSalesReport() {
    const report = analytics.salesReport || {};
    const metrics = analytics.metrics || {};
    renderReportStats('admin-sales-report-stats', [
      {
        label: 'Recorded Sales',
        value: Number(metrics.salesCount || 0).toLocaleString('en-IN'),
        context: `${Number(report.typeBreakdown?.find((row) => row.type === 'OFFLINE')?.count || 0).toLocaleString('en-IN')} offline records`,
      },
      { label: 'Invoiced', value: money(metrics.invoicedAmount || 0), context: 'Confirmed sales value' },
      {
        label: 'Collected',
        value: money(metrics.receivedAmount || 0),
        context: `${percent(metrics.collectionRate)} collection rate`,
        tone: 'positive',
      },
      { label: 'Outstanding', value: money(metrics.outstandingAmount || 0), context: 'Remaining confirmed balance' },
    ]);

    renderBreakdown('admin-sales-status-breakdown', (report.statusBreakdown || []).map((row) => ({
      name: label(row.status),
      detail: `${Number(row.count).toLocaleString('en-IN')} record${row.count === 1 ? '' : 's'}`,
      value: money(row.amount),
      tone: row.status === 'PAID' ? 'positive' : row.status === 'OUTSTANDING' ? 'warning' : '',
    })), 'No sales data in this period.');
    renderBreakdown('admin-sales-type-breakdown', (report.typeBreakdown || []).map((row) => ({
      name: row.type === 'QUOTE' ? 'Website Quotations' : 'Offline Sales',
      detail: `${Number(row.count).toLocaleString('en-IN')} record${row.count === 1 ? '' : 's'}`,
      value: money(row.invoicedAmount),
    })), 'No sales records in this period.');

    const target = document.getElementById('admin-top-customers');
    const customers = report.topCustomers || [];
    target.innerHTML = customers.length ? customers.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.customerName)}</strong>${row.phone ? `<br><span class="text-muted">${escapeHtml(row.phone)}</span>` : ''}</td>
        <td>${Number(row.sales).toLocaleString('en-IN')}</td>
        <td>${escapeHtml(money(row.invoicedAmount))}</td>
        <td class="admin-amount-received">${escapeHtml(money(row.receivedAmount))}</td>
        <td class="admin-amount-outstanding">${escapeHtml(money(row.outstandingAmount))}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-muted">No confirmed customers in this period.</td></tr>';
  }

  function renderFinanceReport() {
    const report = analytics.finance || {};
    const metrics = report.metrics || {};
    renderReportStats('admin-finance-stats', [
      { label: 'Invoiced', value: money(metrics.invoicedAmount || 0), context: 'Confirmed sales value' },
      {
        label: 'Collected',
        value: money(metrics.receivedAmount || 0),
        context: `${percent(metrics.collectionRate)} collected`,
        tone: 'positive',
      },
      { label: 'Receivables', value: money(metrics.outstandingAmount || 0), context: 'Outstanding confirmed balance' },
      {
        label: 'Payment Success',
        value: `${Number(metrics.successfulAttempts || 0).toLocaleString('en-IN')} / ${Number(metrics.paymentAttempts || 0).toLocaleString('en-IN')}`,
        context: `${percent(metrics.failureRate)} failure rate`,
      },
    ]);

    renderBreakdown('admin-finance-payment-status', (report.paymentStatus || []).map((row) => ({
      name: label(row.status),
      detail: `${Number(row.count).toLocaleString('en-IN')} attempt${row.count === 1 ? '' : 's'}`,
      value: money(row.amount),
      tone: row.status === 'SUCCESS' ? 'positive' : row.status === 'FAILED' ? 'critical' : '',
    })), 'No gateway attempts in this period.');

    renderBreakdown('admin-payment-methods', (report.paymentMethods || []).map((row) => ({
      name: label(row.method),
      detail: `${Number(row.records).toLocaleString('en-IN')} receipt${row.records === 1 ? '' : 's'}`,
      value: money(row.amount),
      tone: 'positive',
    })), 'No successful receipt methods recorded.');

    const agingTarget = document.getElementById('admin-receivable-aging');
    const aging = report.receivableAging || [];
    agingTarget.innerHTML = aging.map((row) => `
      <div class="admin-aging-item">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(money(row.amount))}</strong>
        <small>${Number(row.records).toLocaleString('en-IN')} record${row.records === 1 ? '' : 's'}</small>
      </div>
    `).join('');

    const transactionTarget = document.getElementById('admin-finance-transactions');
    const transactions = report.recentTransactions || [];
    transactionTarget.innerHTML = transactions.length ? transactions.map((row) => `
      <tr title="${escapeHtml(row.failureReason || '')}">
        <td>${escapeHtml(dateTime(row.updatedAt))}</td>
        <td><strong>${escapeHtml(row.enquiryNumber)}</strong></td>
        <td>${escapeHtml(row.customerName)}</td>
        <td>${escapeHtml(money(row.amount))}</td>
        <td>${escapeHtml(row.method ? label(row.method) : 'Not specified')}</td>
        <td><span class="admin-sale-status ${saleStatusClass(row.status)}">${escapeHtml(label(row.status))}</span></td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="text-muted">No payment transactions in this period.</td></tr>';

    document.getElementById('admin-finance-coverage').innerHTML = `
      <strong>Scope note:</strong>
      This report uses confirmed sales and recorded payment transactions. Expense ledger, production costs, and profit and loss are not tracked in the current system, so no values are estimated for them.
    `;
  }

  function renderOperationsReport() {
    const report = analytics.operations || {};
    const metrics = report.metrics || {};
    renderReportStats('admin-operations-stats', [
      {
        label: 'Requested Quantity',
        value: Number(metrics.requestedQuantity || 0).toLocaleString('en-IN'),
        context: 'Units requested in selected period',
      },
      {
        label: 'Products In Stock',
        value: `${Number(metrics.inStockProducts || 0).toLocaleString('en-IN')} / ${Number(metrics.configuredProducts || 0).toLocaleString('en-IN')}`,
        context: `${Number(metrics.outOfStockProducts || 0).toLocaleString('en-IN')} marked out of stock`,
      },
      {
        label: 'Scheduled Deliveries',
        value: Number(metrics.scheduledDeliveries || 0).toLocaleString('en-IN'),
        context: `${Number(metrics.overdueDeliveries || 0).toLocaleString('en-IN')} overdue`,
      },
      {
        label: 'Unavailable Demand',
        value: Number(metrics.demandOnOutOfStock || 0).toLocaleString('en-IN'),
        context: 'Active units tied to out-of-stock products',
      },
    ]);

    renderSeriesChart('admin-demand-trend-chart', report.demandTrend || [], [
      { key: 'requestedQuantity', className: 'demand', title: 'requested units' },
    ]);

    const health = report.deliveryHealth || {};
    renderBreakdown('admin-delivery-health', [
      { name: 'Overdue', value: Number(health.overdue || 0).toLocaleString('en-IN'), tone: 'critical' },
      { name: 'Today', value: Number(health.today || 0).toLocaleString('en-IN'), tone: 'warning' },
      { name: 'Next 7 Days', value: Number(health.next7Days || 0).toLocaleString('en-IN') },
      { name: 'Next 30 Days', value: Number(health.next30Days || 0).toLocaleString('en-IN') },
      { name: 'Later', value: Number(health.later || 0).toLocaleString('en-IN') },
      { name: 'Not Scheduled', value: Number(health.unscheduled || 0).toLocaleString('en-IN') },
    ], 'No delivery timing data.');

    const productTarget = document.getElementById('admin-product-demand');
    const productsData = report.productDemand || [];
    productTarget.innerHTML = productsData.length ? productsData.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.product)}</strong></td>
        <td><span class="admin-sale-status ${saleStatusClass(row.availability)}">${escapeHtml(label(row.availability))}</span></td>
        <td>${Number(row.leads).toLocaleString('en-IN')}</td>
        <td>${Number(row.requestedQuantity).toLocaleString('en-IN')} <span class="text-muted">${escapeHtml(row.unit)}</span></td>
        <td>${Number(row.activeDemand).toLocaleString('en-IN')} <span class="text-muted">${escapeHtml(row.unit)}</span></td>
        <td>${escapeHtml(money(row.standardPrice))}</td>
        <td>${escapeHtml(money(row.bulkPrice))} <span class="text-muted">from ${Number(row.bulkQuantity).toLocaleString('en-IN')}</span></td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-muted">No product demand in this period.</td></tr>';

    const deliveryTarget = document.getElementById('admin-upcoming-deliveries');
    const deliveries = report.upcomingDeliveries || [];
    deliveryTarget.innerHTML = deliveries.length ? deliveries.map((row) => `
      <tr>
        <td>${escapeHtml(dateOnly(row.deliveryDate))}</td>
        <td><strong>${escapeHtml(row.enquiryNumber)}</strong></td>
        <td>${escapeHtml(row.customerName)}</td>
        <td>${escapeHtml(row.location || '-')}</td>
        <td>${escapeHtml(row.product)}</td>
        <td>${Number(row.quantity).toLocaleString('en-IN')}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="text-muted">No upcoming delivery dates recorded.</td></tr>';

    const priceTarget = document.getElementById('admin-price-changes');
    const changes = report.recentPriceChanges || [];
    priceTarget.innerHTML = changes.length ? changes.map((row) => `
      <div class="admin-price-change">
        <div>
          <strong>${escapeHtml(row.product)}</strong>
          <span>${escapeHtml(label(row.priceType))}</span>
        </div>
        <div class="admin-price-change-values">
          <span>${escapeHtml(money(row.oldPrice))}</span>
          <strong>${escapeHtml(money(row.newPrice))}</strong>
        </div>
        <small>${escapeHtml(dateTime(row.updatedAt))}${row.updatedBy ? ` by ${escapeHtml(row.updatedBy)}` : ''}</small>
      </div>
    `).join('') : '<p class="body-sm text-muted">No price changes in this period.</p>';

    document.getElementById('admin-operations-coverage').innerHTML = `
      <strong>Scope note:</strong>
      Demand and delivery reporting uses lead requirements and product availability. Production output, raw-material consumption, and machine downtime are not tracked, so they are not displayed.
    `;
  }

  function renderTeamReport() {
    const report = analytics.team || {};
    const metrics = report.metrics || {};
    renderReportStats('admin-team-stats', [
      { label: 'Assigned Leads', value: Number(metrics.assignedLeads || 0).toLocaleString('en-IN'), context: 'Leads with a recorded owner' },
      { label: 'Unassigned Leads', value: Number(metrics.unassignedLeads || 0).toLocaleString('en-IN'), context: 'Leads needing ownership' },
      { label: 'Active Workload', value: Number(metrics.activeWorkload || 0).toLocaleString('en-IN'), context: `${Number(metrics.overdueFollowUps || 0).toLocaleString('en-IN')} overdue follow-ups` },
      { label: 'Recorded Activity', value: Number(metrics.recordedActivities || 0).toLocaleString('en-IN'), context: `${Number(metrics.contributors || 0).toLocaleString('en-IN')} recorded contributors` },
    ]);

    const assignmentTarget = document.getElementById('admin-assignment-performance');
    const assignments = report.assignmentPerformance || [];
    assignmentTarget.innerHTML = assignments.length ? assignments.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.assignee)}</strong></td>
        <td>${Number(row.leads).toLocaleString('en-IN')}</td>
        <td>${Number(row.active).toLocaleString('en-IN')}</td>
        <td>${Number(row.highPriority).toLocaleString('en-IN')}</td>
        <td>${Number(row.overdueFollowUps).toLocaleString('en-IN')}</td>
        <td>${Number(row.converted).toLocaleString('en-IN')} <span class="text-muted">(${escapeHtml(percent(row.conversionRate))})</span></td>
        <td>${escapeHtml(money(row.pipelineValue))}</td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-muted">No assignment data in this period.</td></tr>';

    const activityTarget = document.getElementById('admin-activity-performance');
    const activities = report.activityPerformance || [];
    activityTarget.innerHTML = activities.length ? activities.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td>${Number(row.activities).toLocaleString('en-IN')}</td>
        <td>${Number(row.leadsTouched).toLocaleString('en-IN')}</td>
        <td>${Number(row.notes).toLocaleString('en-IN')}</td>
        <td>${Number(row.statusChanges).toLocaleString('en-IN')}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-muted">No recorded admin activity in this period.</td></tr>';

    const coverage = report.dataCoverage || {};
    const coverageRows = [
      ['Lead assignments', coverage.assignments],
      ['Admin CRM activities', coverage.adminActivities],
      ['Employee roster', coverage.employeeRoster],
      ['Attendance', coverage.attendance],
      ['Payroll', coverage.payroll],
    ];
    document.getElementById('admin-team-coverage').innerHTML = coverageRows.map(([name, available]) => `
      <div class="admin-coverage-row">
        <span class="admin-coverage-name">${escapeHtml(name)}</span>
        <span class="admin-coverage-status ${available ? 'available' : 'unavailable'}">${available ? 'Tracked' : 'Not tracked'}</span>
      </div>
    `).join('');
  }

  function renderInsights() {
    const insights = analytics.business?.insights || [];
    const counts = ['CRITICAL', 'WARNING', 'OPPORTUNITY', 'INFO'].map((severity) => ({
      severity,
      count: insights.filter((item) => item.severity === severity).length,
    }));
    document.getElementById('admin-insight-summary').innerHTML = counts.map((row) => `
      <div class="admin-insight-count ${row.severity.toLowerCase()}">
        <strong>${Number(row.count).toLocaleString('en-IN')}</strong>
        <span>${escapeHtml(label(row.severity))}</span>
      </div>
    `).join('');

    const target = document.getElementById('admin-insights-list');
    target.innerHTML = insights.length ? insights.map((item) => `
      <article class="admin-insight-card ${escapeHtml(item.severity.toLowerCase())}">
        <span class="admin-insight-icon">${businessInsightIcon(item.severity)}</span>
        <div class="admin-insight-content">
          <span class="admin-insight-severity">${escapeHtml(label(item.severity))}</span>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.detail)}</p>
        </div>
        <button class="admin-insight-department" type="button" title="Open ${escapeHtml(label(item.target))} analytics" data-analytics-target="${escapeHtml(item.target)}">${escapeHtml(item.department || label(item.target))}</button>
      </article>
    `).join('') : '<p class="body-sm text-muted">No insights are available for this period.</p>';

    const coverageTarget = document.getElementById('admin-reference-coverage');
    const coverage = analytics.business?.referenceCoverage || [];
    coverageTarget.innerHTML = coverage.length ? coverage.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.area)}</strong></td>
        <td>${escapeHtml(row.metric)}</td>
        <td><span class="admin-coverage-status ${row.status === 'SUPPORTED' ? '' : 'unavailable'}">${escapeHtml(label(row.status))}</span></td>
        <td>${escapeHtml(row.reason)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="text-muted">No coverage assessment is available.</td></tr>';

    document.getElementById('admin-insights-coverage').innerHTML = `
      <strong>How this is calculated:</strong>
      Insights are deterministic checks across imported workbook sales, expenses, purchases, production, labour, and reconciliation results. Website leads, CSV leads, application payments, deliveries, manual logs, and CRM activity are excluded.
    `;
  }

  function renderAnalytics() {
    renderAnalyticsStats();
    renderMonthlySales();
    renderProductPerformance();
    renderOutstandingAccounts();
    renderAnalyticsCoverage();
    renderInsights();
    renderBusinessAnalytics();
  }

  async function loadAnalytics() {
    analytics = await api(`/api/admin/analytics?range=${encodeURIComponent(salesRange)}`);
    renderAnalytics();
    await loadBusinessLogs();
  }

  function salesQuery(page = salesPage, limit = 20) {
    const params = new URLSearchParams({
      range: salesRange,
      type: salesType,
      status: salesStatusFilter,
      search: salesSearch,
      page: String(page),
      limit: String(limit),
    });
    return params.toString();
  }

  function renderSalesTotals(totals = {}) {
    document.getElementById('admin-sales-totals').innerHTML = [
      ['Invoiced', totals.invoicedAmount || 0],
      ['Received', totals.receivedAmount || 0],
      ['Outstanding', totals.outstandingAmount || 0],
    ].map(([name, value]) => `
      <div class="admin-sales-total">
        <span>${escapeHtml(name)}</span>
        <strong>${escapeHtml(money(value))}</strong>
      </div>
    `).join('');
  }

  function renderSalesGridTotals() {
    const totals = {
      invoicedAmount: Number(salesTotals.invoicedAmount || 0),
      receivedAmount: Number(salesTotals.receivedAmount || 0),
      outstandingAmount: Number(salesTotals.outstandingAmount || 0),
    };
    sales.forEach((sale) => {
      if (sale.status === 'CANCELLED') return;
      const draft = salesGridDrafts.get(salesGridKey(sale));
      if (!draft) return;
      const nextInvoiced = Number(draft.invoicedAmount || 0);
      const nextReceived = Number(draft.receivedAmount || 0);
      totals.invoicedAmount += nextInvoiced - Number(sale.invoicedAmount || 0);
      totals.receivedAmount += nextReceived - Number(sale.receivedAmount || 0);
      totals.outstandingAmount += Math.max(nextInvoiced - nextReceived, 0) - Number(sale.outstandingAmount || 0);
    });
    renderSalesTotals(totals);
  }

  function saleStatusClass(status) {
    return String(status || '').toLowerCase();
  }

  function salesGridKey(sale) {
    return `${sale.type}:${sale.recordId}`;
  }

  function createSalesGridDraft(sale) {
    const unitPrice = sale.unitPrice ?? (sale.quantity > 0 ? sale.invoicedAmount / sale.quantity : 0);
    return {
      key: salesGridKey(sale),
      type: sale.type,
      id: sale.recordId,
      expectedUpdatedAt: sale.updatedAt,
      saleDate: dateInputValue(sale.saleDate),
      customerName: sale.customerName || '',
      customerPhone: sale.customerPhone || '',
      location: sale.location || '',
      product: sale.product || '',
      quantity: String(sale.quantity ?? ''),
      unit: sale.unit || 'unit',
      unitPrice: Number(unitPrice || 0).toFixed(2),
      invoicedAmount: Number(sale.invoicedAmount || 0).toFixed(2),
      receivedAmount: Number(sale.receivedAmount || 0).toFixed(2),
      receivedDate: dateInputValue(sale.receivedDate),
      paymentMethod: sale.paymentMethod || '',
      notes: sale.notes || '',
      cancelled: sale.status === 'CANCELLED',
    };
  }

  function salesGridDraftSignature(draft) {
    const common = {
      customerName: draft.customerName.trim(),
      customerPhone: draft.customerPhone.trim(),
      location: draft.location.trim(),
      product: draft.product,
      quantity: String(draft.quantity),
      unitPrice: String(draft.unitPrice),
      invoicedAmount: String(draft.invoicedAmount),
    };
    if (draft.type === 'QUOTE') return JSON.stringify(common);
    return JSON.stringify({
      ...common,
      saleDate: draft.saleDate,
      receivedAmount: String(draft.receivedAmount),
      receivedDate: draft.receivedDate,
      paymentMethod: draft.paymentMethod,
      notes: draft.notes,
    });
  }

  function calculatedSalesGridStatus(draft) {
    if (draft.cancelled) return 'CANCELLED';
    const invoiced = Number(draft.invoicedAmount || 0);
    const received = Number(draft.receivedAmount || 0);
    if (invoiced > 0 && received >= invoiced) return 'PAID';
    if (received > 0) return 'PARTIAL';
    return 'OUTSTANDING';
  }

  function salesGridProductOptions(current) {
    const configured = products.map((product) => product.name);
    const names = configured.includes(current) ? configured : [current].concat(configured);
    return names.filter(Boolean).map((name) => (
      `<option value="${escapeHtml(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`
    )).join('');
  }

  function salesGridInput(draft, field, options = {}) {
    const type = options.type || 'text';
    const value = draft[field] ?? '';
    const attributes = [
      `type="${escapeHtml(type)}"`,
      `value="${escapeHtml(value)}"`,
      `data-sales-grid-key="${escapeHtml(draft.key)}"`,
      `data-sales-grid-field="${escapeHtml(field)}"`,
      `aria-label="${escapeHtml(options.label || field)}"`,
    ];
    if (options.min !== undefined) attributes.push(`min="${escapeHtml(options.min)}"`);
    if (options.step !== undefined) attributes.push(`step="${escapeHtml(options.step)}"`);
    if (options.maxlength !== undefined) attributes.push(`maxlength="${escapeHtml(options.maxlength)}"`);
    if (options.inputmode) attributes.push(`inputmode="${escapeHtml(options.inputmode)}"`);
    return `<input class="admin-grid-input ${escapeHtml(options.className || '')}" ${attributes.join(' ')} />`;
  }

  function renderEditableSalesRow(sale) {
    const draft = salesGridDrafts.get(salesGridKey(sale));
    const status = calculatedSalesGridStatus(draft);
    const outstanding = Math.max(Number(draft.invoicedAmount || 0) - Number(draft.receivedAmount || 0), 0);
    const dirty = salesGridDirty.has(draft.key);
    return `
      <tr class="admin-sales-edit-row ${dirty ? 'dirty' : ''}" data-sales-grid-row="${escapeHtml(draft.key)}">
        <td>
          ${draft.type === 'OFFLINE'
            ? salesGridInput(draft, 'saleDate', { type: 'date', label: 'Sale date' })
            : `<span class="admin-grid-readonly" title="Website quotation dates are preserved">${escapeHtml(dateOnly(sale.saleDate))}</span>`}
        </td>
        <td>
          <strong>${escapeHtml(sale.saleNumber)}</strong><br>
          <span class="admin-record-type">${sale.type === 'QUOTE' ? 'Website Quote' : 'Offline Sale'}</span>
        </td>
        <td>
          <div class="admin-grid-field-stack">
            ${salesGridInput(draft, 'customerName', { label: 'Customer name', maxlength: 100 })}
            ${salesGridInput(draft, 'customerPhone', { label: 'Customer phone', maxlength: 10, inputmode: 'numeric', className: 'secondary' })}
          </div>
        </td>
        <td>${salesGridInput(draft, 'location', { label: 'Location', maxlength: 100 })}</td>
        <td>
          <select class="admin-grid-input" data-sales-grid-key="${escapeHtml(draft.key)}" data-sales-grid-field="product" aria-label="Product">
            ${salesGridProductOptions(draft.product)}
          </select>
        </td>
        <td>${salesGridInput(draft, 'quantity', { type: 'number', label: 'Quantity', min: 1, step: 1, inputmode: 'numeric' })}<span class="admin-grid-unit">${escapeHtml(draft.unit)}</span></td>
        <td>${salesGridInput(draft, 'unitPrice', { type: 'number', label: 'Unit price', min: 0.01, step: 0.01, inputmode: 'decimal' })}</td>
        <td>${salesGridInput(draft, 'invoicedAmount', { type: 'number', label: 'Invoiced amount', min: 0.01, step: 0.01, inputmode: 'decimal' })}</td>
        <td>
          ${draft.type === 'OFFLINE'
            ? salesGridInput(draft, 'receivedAmount', { type: 'number', label: 'Received amount', min: 0, step: 0.01, inputmode: 'decimal' })
            : `<span class="admin-grid-readonly admin-amount-received" title="Verified gateway receipts are read-only">${escapeHtml(money(draft.receivedAmount))}</span>`}
        </td>
        <td class="admin-amount-outstanding" data-sales-grid-computed="outstanding">${escapeHtml(money(outstanding))}</td>
        <td><span class="admin-sale-status ${saleStatusClass(status)}" data-sales-grid-computed="status">${escapeHtml(label(status))}</span></td>
        <td><span class="admin-grid-row-state ${dirty ? 'dirty' : ''}" data-sales-grid-state>${dirty ? 'Modified' : 'Ready'}</span></td>
      </tr>
    `;
  }

  function renderSalesLog(totals) {
    const target = document.getElementById('admin-sales-log');
    if (salesGridEditing) {
      target.innerHTML = sales.length
        ? sales.map(renderEditableSalesRow).join('')
        : '<tr><td colspan="12" class="text-muted">No sales match these filters.</td></tr>';
      renderSalesGridTotals();
      renderSalesPagination();
      return;
    }
    target.innerHTML = sales.length ? sales.map((sale) => `
      <tr>
        <td>${escapeHtml(dateOnly(sale.saleDate))}</td>
        <td>
          <strong>${escapeHtml(sale.saleNumber)}</strong><br>
          <span class="admin-record-type">${sale.type === 'QUOTE' ? 'Website Quote' : 'Offline Sale'}</span>
        </td>
        <td>${escapeHtml(sale.customerName)}${sale.customerPhone ? `<br><span class="text-muted">${escapeHtml(sale.customerPhone)}</span>` : ''}</td>
        <td>${escapeHtml(sale.location || '-')}</td>
        <td>${escapeHtml(sale.product)}</td>
        <td>${Number(sale.quantity).toLocaleString('en-IN')} <span class="text-muted">${escapeHtml(sale.unit)}</span></td>
        <td>${sale.unitPrice === null ? '-' : escapeHtml(money(sale.unitPrice))}</td>
        <td>${escapeHtml(money(sale.invoicedAmount))}</td>
        <td class="admin-amount-received">${escapeHtml(money(sale.receivedAmount))}</td>
        <td class="admin-amount-outstanding">${escapeHtml(money(sale.outstandingAmount))}</td>
        <td><span class="admin-sale-status ${saleStatusClass(sale.status)}">${escapeHtml(label(sale.status))}</span></td>
        <td>
          <div class="admin-row-actions">
            ${sale.type === 'QUOTE'
              ? `<button class="admin-link-button inline" type="button" data-view-sale-lead="${sale.recordId}">View Lead</button>`
              : `
                <button class="admin-link-button inline" type="button" data-edit-sale="${sale.recordId}">Edit</button>
                <button class="admin-icon-button small danger" type="button" aria-label="Delete offline sale" title="Delete offline sale" data-delete-sale="${sale.recordId}">
                  <svg class="admin-trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h1.5v-7H10Zm2.5 0v7H14v-7h-1.5Z"></path>
                  </svg>
                </button>
              `}
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="12" class="text-muted">No sales match these filters.</td></tr>';
    renderSalesTotals(totals);
    renderSalesPagination();
  }

  function setSalesGridNotice(message, isError = false) {
    const notice = document.getElementById('admin-sales-grid-notice');
    notice.textContent = message;
    notice.hidden = !message;
    notice.classList.toggle('error', isError);
  }

  function setSalesGridControls() {
    document.getElementById('admin-edit-sales-grid').hidden = salesGridEditing;
    document.getElementById('admin-save-sales-grid').hidden = !salesGridEditing;
    document.getElementById('admin-cancel-sales-grid').hidden = !salesGridEditing;
    document.getElementById('admin-save-sales-grid').disabled = salesGridDirty.size === 0;
    [
      'admin-export-sales',
      'admin-add-offline-sale',
      'admin-sales-search',
      'admin-sales-type',
      'admin-sales-status-filter',
      'admin-analytics-range',
    ].forEach((id) => {
      const control = document.getElementById(id);
      if (control) control.disabled = salesGridEditing;
    });
    if (!salesGridEditing) setSalesGridNotice('');
  }

  function beginSalesGridEdit() {
    if (!sales.length) {
      showToast('No visible sales records to edit');
      return;
    }
    salesGridEditing = true;
    salesGridDrafts = new Map();
    salesGridOriginals = new Map();
    salesGridDirty = new Set();
    sales.forEach((sale) => {
      const draft = createSalesGridDraft(sale);
      salesGridDrafts.set(draft.key, draft);
      salesGridOriginals.set(draft.key, salesGridDraftSignature(draft));
    });
    setSalesGridControls();
    setSalesGridNotice(
      `Editing ${sales.length} visible record${sales.length === 1 ? '' : 's'}. Website payment receipts and record identifiers are protected.`,
    );
    renderSalesLog(salesTotals);
  }

  function cancelSalesGridEdit() {
    salesGridEditing = false;
    salesGridDrafts = new Map();
    salesGridOriginals = new Map();
    salesGridDirty = new Set();
    setSalesGridControls();
    renderSalesLog(salesTotals);
  }

  function confirmCancelSalesGridEdit() {
    if (salesGridDirty.size && !window.confirm('Discard unsaved sales-grid changes?')) return false;
    cancelSalesGridEdit();
    return true;
  }

  function updateSalesGridRow(key) {
    const draft = salesGridDrafts.get(key);
    const row = document.querySelector(`[data-sales-grid-row="${CSS.escape(key)}"]`);
    if (!draft || !row) return;
    const outstanding = Math.max(Number(draft.invoicedAmount || 0) - Number(draft.receivedAmount || 0), 0);
    const status = calculatedSalesGridStatus(draft);
    const outstandingCell = row.querySelector('[data-sales-grid-computed="outstanding"]');
    const statusCell = row.querySelector('[data-sales-grid-computed="status"]');
    const state = row.querySelector('[data-sales-grid-state]');
    const dirty = salesGridDirty.has(key);
    outstandingCell.textContent = money(outstanding);
    statusCell.textContent = label(status);
    statusCell.className = `admin-sale-status ${saleStatusClass(status)}`;
    state.textContent = dirty ? 'Modified' : 'Ready';
    state.classList.toggle('dirty', dirty);
    row.classList.toggle('dirty', dirty);
  }

  function recalculateSalesGridInvoice(row, draft) {
    const quantity = Number(draft.quantity);
    const unitPrice = Number(draft.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) return;
    draft.invoicedAmount = (quantity * unitPrice).toFixed(2);
    const invoiceInput = row.querySelector('[data-sales-grid-field="invoicedAmount"]');
    if (invoiceInput) invoiceInput.value = draft.invoicedAmount;
  }

  function handleSalesGridFieldChange(input) {
    const key = input.dataset.salesGridKey;
    const field = input.dataset.salesGridField;
    const draft = salesGridDrafts.get(key);
    const row = input.closest('[data-sales-grid-row]');
    if (!salesGridEditing || !draft || !row || !field) return;
    draft[field] = input.value;
    if (field === 'product') {
      const product = products.find((item) => item.name === input.value);
      if (product) {
        draft.unit = product.unit;
        draft.unitPrice = Number(product.standardPrice).toFixed(2);
        const unitPriceInput = row.querySelector('[data-sales-grid-field="unitPrice"]');
        const unitLabel = row.querySelector('.admin-grid-unit');
        if (unitPriceInput) unitPriceInput.value = draft.unitPrice;
        if (unitLabel) unitLabel.textContent = draft.unit;
      }
    }
    if (['product', 'quantity', 'unitPrice'].includes(field)) recalculateSalesGridInvoice(row, draft);
    if (field === 'receivedAmount' && Number(draft.receivedAmount) > 0 && !draft.receivedDate) {
      draft.receivedDate = todayInputValue();
    }
    const dirty = salesGridDraftSignature(draft) !== salesGridOriginals.get(key);
    if (dirty) salesGridDirty.add(key);
    else salesGridDirty.delete(key);
    updateSalesGridRow(key);
    renderSalesGridTotals();
    setSalesGridControls();
    setSalesGridNotice(
      `${salesGridDirty.size} modified record${salesGridDirty.size === 1 ? '' : 's'}. Save changes before leaving this page.`,
    );
  }

  function salesGridUpdatePayload(draft) {
    const sale = sales.find((item) => salesGridKey(item) === draft.key);
    const prefix = sale?.saleNumber || 'Sales record';
    const customerName = draft.customerName.trim();
    const customerPhone = draft.customerPhone.replace(/\D/g, '').slice(-10);
    const location = draft.location.trim();
    const quantity = Number(draft.quantity);
    const unitPrice = Number(draft.unitPrice);
    const invoicedAmount = Number(draft.invoicedAmount);
    const receivedAmount = Number(draft.receivedAmount);

    if (customerName.length < 2) throw new Error(`${prefix}: enter a valid customer name.`);
    if (draft.type === 'QUOTE' && !/^[6-9]\d{9}$/.test(customerPhone)) {
      throw new Error(`${prefix}: enter a valid 10 digit customer phone number.`);
    }
    if (draft.type === 'OFFLINE' && customerPhone && !/^[6-9]\d{9}$/.test(customerPhone)) {
      throw new Error(`${prefix}: enter a valid 10 digit customer phone number or leave it blank.`);
    }
    if (draft.type === 'QUOTE' && location.length < 2) throw new Error(`${prefix}: enter a valid location.`);
    if (!draft.product) throw new Error(`${prefix}: select a product.`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`${prefix}: quantity must be a positive whole number.`);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`${prefix}: unit price must be greater than zero.`);
    if (!Number.isFinite(invoicedAmount) || invoicedAmount <= 0) throw new Error(`${prefix}: invoiced amount must be greater than zero.`);

    const update = {
      type: draft.type,
      id: draft.id,
      expectedUpdatedAt: draft.expectedUpdatedAt,
      data: {
        customerName,
        customerPhone,
        location,
        product: draft.product,
        quantity,
        invoicedAmount,
      },
    };
    if (draft.type === 'QUOTE') return update;
    if (!draft.saleDate) throw new Error(`${prefix}: sale date is required.`);
    if (!Number.isFinite(receivedAmount) || receivedAmount < 0 || receivedAmount > invoicedAmount) {
      throw new Error(`${prefix}: received amount must be between zero and the invoiced amount.`);
    }
    update.data = {
      ...update.data,
      unitPrice,
      receivedAmount,
      saleDate: draft.saleDate,
      receivedDate: receivedAmount > 0 ? (draft.receivedDate || todayInputValue()) : '',
      paymentMethod: draft.paymentMethod,
      notes: draft.notes,
    };
    return update;
  }

  async function saveSalesGrid() {
    if (!salesGridDirty.size) return;
    const button = document.getElementById('admin-save-sales-grid');
    let updates;
    try {
      updates = [...salesGridDirty].map((key) => salesGridUpdatePayload(salesGridDrafts.get(key)));
    } catch (error) {
      setSalesGridNotice(error.message, true);
      return;
    }
    button.disabled = true;
    button.textContent = 'Saving...';
    setSalesGridNotice(`Saving ${updates.length} modified record${updates.length === 1 ? '' : 's'}...`);
    try {
      await api('/api/admin/sales/grid', {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      });
      salesGridEditing = false;
      salesGridDrafts = new Map();
      salesGridOriginals = new Map();
      salesGridDirty = new Set();
      setSalesGridControls();
      await Promise.all([loadAnalytics(), loadSales()]);
      showToast(`${updates.length} sales record${updates.length === 1 ? '' : 's'} updated`);
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      setSalesGridNotice(firstError || error.message, true);
    } finally {
      button.textContent = 'Save Changes';
      button.disabled = salesGridDirty.size === 0;
    }
  }

  function renderSalesPagination() {
    const pager = document.getElementById('admin-sales-pagination');
    if (salesGridEditing) {
      pager.innerHTML = `<span>Editing ${sales.length} visible record${sales.length === 1 ? '' : 's'}. Save or cancel to change pages.</span>`;
      return;
    }
    const totalPages = salesPagination.totalPages || 1;
    const currentPage = salesPagination.page || 1;
    if (totalPages <= 1) {
      pager.innerHTML = `<span>${salesPagination.total || 0} sale record${salesPagination.total === 1 ? '' : 's'}</span>`;
      return;
    }
    pager.innerHTML = `
      <span>${salesPagination.total || 0} sale records</span>
      <button class="admin-page-button" type="button" data-sales-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${currentPage} of ${totalPages}</span>
      <button class="admin-page-button" type="button" data-sales-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
    `;
  }

  async function loadSales() {
    const data = await api(`/api/admin/sales?${salesQuery()}`);
    sales = data.sales || [];
    salesTotals = data.totals || {};
    salesPagination = data.pagination || salesPagination;
    salesPage = salesPagination.page;
    renderSalesLog(salesTotals);
  }

  function setAnalyticsTab(name) {
    document.querySelectorAll('[data-analytics-tab]').forEach((button) => {
      const active = button.dataset.analyticsTab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.admin-analytics-panel').forEach((panel) => {
      const active = panel.id === `admin-analytics-${name}`;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  function fieldValue(record, name, type, fallback = '') {
    const value = record?.[name];
    if (value === null || value === undefined || value === '') return fallback;
    if (type === 'date') return dateInputValue(value);
    if (type === 'datetime-local') {
      const date = new Date(value);
      return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    return value;
  }

  function businessFieldMarkup(field, record) {
    const [name, text, type, required = false, fallback = '', options = []] = field;
    let defaultValue = fallback;
    if (!record && required && type === 'date') defaultValue = new Date().toISOString().slice(0, 10);
    if (!record && required && type === 'datetime-local') {
      const now = new Date();
      defaultValue = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    const value = fieldValue(record, name, type, defaultValue);
    const requiredAttribute = required ? 'required' : '';
    if (type === 'select') {
      return `<label class="form-field"><span class="form-label">${escapeHtml(text)}</span><select class="form-select" data-business-field="${escapeHtml(name)}" ${requiredAttribute}>${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(label(option))}</option>`).join('')}</select></label>`;
    }
    if (type === 'textarea') {
      return `<label class="form-field"><span class="form-label">${escapeHtml(text)}</span><textarea class="form-input form-textarea" data-business-field="${escapeHtml(name)}" ${requiredAttribute}>${escapeHtml(value)}</textarea></label>`;
    }
    const numberAttributes = type === 'number' ? 'min="0" step="0.01"' : '';
    return `<label class="form-field"><span class="form-label">${escapeHtml(text)}</span><input class="form-input" type="${escapeHtml(type)}" data-business-field="${escapeHtml(name)}" value="${escapeHtml(value)}" ${numberAttributes} ${requiredAttribute} /></label>`;
  }

  function openBusinessRecordModal(type, record = null) {
    const fields = BUSINESS_RECORD_FIELDS[type];
    if (!fields) return;
    hideStatus(businessRecordStatus);
    document.getElementById('business-record-type').value = type;
    document.getElementById('business-record-id').value = record?.id || '';
    const titles = { sales: 'Sale Record', receipts: 'Payment Received', expenses: 'Expense', purchases: 'Material Purchase', production: 'Production Record', labour: 'Labour Payment', events: 'Business Event' };
    document.getElementById('admin-business-record-title').textContent = `${record ? 'Edit' : 'Add'} ${titles[type]}`;
    document.getElementById('admin-business-record-scope-note').textContent = record
      ? `Editing a ${record.origin === 'XLSX_IMPORT' ? 'workbook-import' : 'manual'} record. The correction is retained in the audit history.`
      : 'This entry will be saved with a Manual source label. Workbook-only KPIs and charts will not include it.';
    document.getElementById('admin-business-record-fields').innerHTML = fields.map((field) => businessFieldMarkup(field, record)).join('');
    const correctionField = document.getElementById('admin-business-correction-field');
    correctionField.hidden = !record;
    document.getElementById('business-record-reason').value = '';
    businessRecordModal.hidden = false;
    businessRecordModal.querySelector('[data-business-field]')?.focus();
  }

  function closeBusinessRecordModal() {
    businessRecordModal.hidden = true;
    businessRecordForm.reset();
    hideStatus(businessRecordStatus);
  }

  function businessRecordPayload(type) {
    const fields = BUSINESS_RECORD_FIELDS[type] || [];
    return Object.fromEntries(fields.map(([name, _label, typeName]) => {
      const input = businessRecordForm.querySelector(`[data-business-field="${name}"]`);
      if (typeName === 'number') return [name, input.value === '' ? null : Number(input.value)];
      return [name, input.value.trim()];
    }));
  }

  function openBusinessImportModal() {
    businessImportForm.reset();
    businessImportReady = false;
    businessImportPreview.innerHTML = '';
    businessImportPreview.classList.remove('show');
    businessImportForm.querySelector('[type="submit"]').disabled = true;
    hideStatus(businessImportStatus);
    businessImportModal.hidden = false;
    document.getElementById('business-import-file').focus();
  }

  function closeBusinessImportModal() {
    businessImportModal.hidden = true;
    businessImportReady = false;
    hideStatus(businessImportStatus);
  }

  async function businessFileRequest(path, file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      const error = new Error(result.message || 'Workbook request failed.');
      error.errors = result.errors || [];
      throw error;
    }
    return result.data || {};
  }

  function renderBusinessImportPreview(data) {
    const rows = Object.entries(data.reconciliation || {});
    const samples = data.reviewSamples || [];
    businessImportPreview.innerHTML = `
      <div class="admin-import-summary-grid">
        <div><strong>${Number(data.summary?.sourceRows || 0).toLocaleString('en-IN')}</strong><span>source rows</span></div>
        <div><strong>${Number(data.summary?.importedRows || 0).toLocaleString('en-IN')}</strong><span>clean rows</span></div>
        <div><strong>${Number(data.summary?.reviewRows || 0).toLocaleString('en-IN')}</strong><span>review rows</span></div>
        <div><strong>${Number(data.summary?.sales || 0).toLocaleString('en-IN')}</strong><span>sales</span></div>
      </div>
      ${data.duplicateImport ? `<p class="admin-import-warning"><strong>Already imported:</strong> batch ${Number(data.duplicateImport.id)} on ${escapeHtml(dateTime(data.duplicateImport.importedAt))}.</p>` : ''}
      <div class="admin-table-wrap admin-table-flat"><table class="admin-table admin-analytics-table">
        <thead><tr><th>Metric</th><th>Source</th><th>Normalized</th><th>Difference</th><th>Status</th></tr></thead>
        <tbody>${rows.map(([name, row]) => `<tr><td>${escapeHtml(label(name))}</td><td>${row.source === null ? 'Unavailable' : escapeHtml(Number(row.source).toLocaleString('en-IN'))}</td><td>${escapeHtml(Number(row.normalized || 0).toLocaleString('en-IN'))}</td><td>${row.discrepancy === null ? '-' : escapeHtml(Number(row.discrepancy).toLocaleString('en-IN'))}</td><td><span class="admin-sale-status ${row.status === 'MATCH' ? 'paid' : row.status === 'MISMATCH' ? 'outstanding' : ''}">${escapeHtml(label(row.status))}</span></td></tr>`).join('')}</tbody>
      </table></div>
      ${samples.length ? `<details class="admin-import-review"><summary>Review sample (${samples.length})</summary>${samples.map((row) => `<p><strong>${escapeHtml(row.sheetName)}, row ${row.rowNumber}:</strong> ${escapeHtml((row.issues || []).map((item) => item.message).join(' '))}</p>`).join('')}</details>` : ''}
    `;
    businessImportPreview.classList.add('show');
    businessImportReady = !data.duplicateImport;
    businessImportForm.querySelector('[type="submit"]').disabled = !businessImportReady;
  }

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  async function exportSalesCsv() {
    const first = await api(`/api/admin/sales?${salesQuery(1, 100)}`);
    const rows = [...(first.sales || [])];
    const pages = first.pagination?.totalPages || 1;
    for (let page = 2; page <= pages; page += 1) {
      const data = await api(`/api/admin/sales?${salesQuery(page, 100)}`);
      rows.push(...(data.sales || []));
    }
    const headings = [
      'Date',
      'Sale Number',
      'Record Type',
      'Customer',
      'Phone',
      'Location',
      'Product',
      'Quantity',
      'Unit',
      'Unit Price',
      'Invoiced',
      'Received',
      'Outstanding',
      'Status',
      'Payment Method',
      'Notes',
    ];
    const values = rows.map((sale) => [
      dateInputValue(sale.saleDate),
      sale.saleNumber,
      sale.type,
      sale.customerName,
      sale.customerPhone,
      sale.location,
      sale.product,
      sale.quantity,
      sale.unit,
      sale.unitPrice,
      sale.invoicedAmount,
      sale.receivedAmount,
      sale.outstandingAmount,
      sale.status,
      sale.paymentMethod,
      sale.notes,
    ]);
    const csv = [headings, ...values].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ss-bricks-sales-${todayInputValue()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function loadLeads() {
    const params = new URLSearchParams({
      page: String(leadPage),
      limit: '20',
      filter: leadFilter,
    });
    if (leadSearch) params.set('search', leadSearch);
    const data = await api(`/api/admin/leads?${params.toString()}`);
    leadPagination = data.pagination || leadPagination;
    const tbody = document.getElementById('admin-leads');
    const leads = data.leads || [];
    tbody.innerHTML = leads.length ? leads.map((lead) => `
      <tr>
        <td><strong>${escapeHtml(lead.enquiryNumber)}</strong></td>
        <td>${escapeHtml(lead.customerName)}<br><span class="text-muted">${escapeHtml(lead.phone)}</span></td>
        <td>${escapeHtml(lead.product)}</td>
        <td>${Number(lead.quantity).toLocaleString('en-IN')}</td>
        <td>${label(lead.source)}</td>
        <td>
          <select class="admin-priority-select ${String(lead.priority).toLowerCase()}" data-lead-priority="${lead.id}">
            ${priorityOptions(lead.priority)}
          </select>
        </td>
        <td><select class="admin-status-select" data-lead-status="${lead.id}">${statusOptions(lead.status)}</select></td>
        <td>${dateOnly(lead.nextFollowUpDate)}</td>
        <td>
          ${escapeHtml(dateTime(lead.createdAt))}<br>
          <div class="admin-row-actions">
            <button class="admin-link-button inline" type="button" data-view-lead="${lead.id}">View</button>
            <button class="admin-icon-button small danger" type="button" aria-label="Delete lead" title="Delete lead" data-delete-lead="${lead.id}">
              <svg class="admin-trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h1.5v-7H10Zm2.5 0v7H14v-7h-1.5Z"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="9" class="text-muted">No leads found.</td></tr>';
    renderLeadPagination();
  }

  function renderLeadPagination() {
    const pager = document.getElementById('admin-lead-pagination');
    if (!pager) return;
    const totalPages = leadPagination.totalPages || 1;
    const currentPage = leadPagination.page || 1;
    if (totalPages <= 1) {
      pager.innerHTML = `<span>${leadPagination.total || 0} lead${leadPagination.total === 1 ? '' : 's'}</span>`;
      return;
    }

    const pages = [];
    const start = Math.max(currentPage - 2, 1);
    const end = Math.min(start + 4, totalPages);
    for (let page = start; page <= end; page += 1) {
      pages.push(`<button class="admin-page-button ${page === currentPage ? 'active' : ''}" type="button" data-lead-page="${page}">${page}</button>`);
    }

    pager.innerHTML = `
      <span>${leadPagination.total || 0} leads</span>
      <button class="admin-page-button" type="button" data-lead-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button>
      ${start > 1 ? '<span>...</span>' : ''}
      ${pages.join('')}
      ${end < totalPages ? '<span>...</span>' : ''}
      <button class="admin-page-button" type="button" data-lead-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
    `;
  }

  async function loadHistory() {
    const data = await api('/api/admin/price-history');
    const list = document.getElementById('admin-history');
    const history = data.history || [];
    list.innerHTML = history.length ? history.map((item) => `
      <div class="admin-history-item">
        <div>
          <strong>${escapeHtml(item.productName)}</strong>
          <div class="body-sm text-muted">${escapeHtml(item.priceType)} price by ${escapeHtml(item.updatedBy)}</div>
        </div>
        <div>${escapeHtml(money(item.oldPrice))} to ${escapeHtml(money(item.newPrice))}<br><span class="body-sm text-muted">${escapeHtml(dateTime(item.updatedAt))}</span></div>
      </div>
    `).join('') : '<p class="body-sm text-muted">No price updates yet.</p>';
  }

  function openView(name) {
    document.querySelectorAll('.admin-nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === name);
    });
    document.querySelectorAll('.admin-view').forEach((view) => {
      view.classList.toggle('active', view.id === `admin-view-${name}`);
    });
    pageTitle.textContent = {
      dashboard: 'Dashboard',
      analytics: 'Analytics',
      leads: 'Leads',
      products: 'Products',
      settings: 'Settings',
    }[name] || 'Dashboard';

    if (name === 'leads') loadLeads().catch((error) => showToast(error.message));
    if (name === 'analytics') {
      loadAnalytics().catch((error) => showToast(error.message));
    }
    if (name === 'settings') loadHistory().catch((error) => showToast(error.message));
  }

  function openModal(product) {
    hideStatus(productStatus);
    document.getElementById('admin-product-id').value = product.id;
    document.getElementById('admin-product-name').value = product.name;
    document.getElementById('admin-modal-title').textContent = product.name;
    document.getElementById('admin-standard-price').value = product.standardPrice;
    document.getElementById('admin-bulk-price').value = product.bulkPrice;
    document.getElementById('admin-bulk-quantity').value = product.bulkQuantity;
    document.getElementById('admin-availability').value = product.availability;
    document.getElementById('admin-description').value = product.description;
    modal.hidden = false;
    document.getElementById('admin-standard-price').focus();
  }

  function closeModal() {
    modal.hidden = true;
  }

  function openLeadModal() {
    hideStatus(leadStatus);
    leadForm.reset();
    document.getElementById('lead-quantity').value = 0;
    document.getElementById('lead-email').value = '';
    document.getElementById('lead-source').value = 'PHONE';
    document.getElementById('lead-priority').value = 'MEDIUM';
    leadModal.hidden = false;
    document.getElementById('lead-name').focus();
  }

  function closeLeadModal() {
    leadModal.hidden = true;
  }

  function todayInputValue() {
    const now = new Date();
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 10);
  }

  function updateSaleTotal() {
    const quantity = Number(document.getElementById('sale-quantity').value);
    const unitPrice = Number(document.getElementById('sale-unit-price').value);
    if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
      document.getElementById('sale-invoiced-amount').value = (quantity * unitPrice).toFixed(2);
    }
  }

  function selectSaleProduct(productName) {
    const product = products.find((item) => item.name === productName) || products[0];
    if (!product) return;
    document.getElementById('sale-product').value = product.name;
    document.getElementById('sale-unit-price').value = Number(product.standardPrice).toFixed(2);
  }

  function openSaleModal(sale = null) {
    hideStatus(saleFormStatus);
    saleForm.reset();
    document.getElementById('admin-sale-id').value = sale?.recordId || '';
    document.getElementById('admin-sale-modal-title').textContent = sale ? 'Edit Offline Sale' : 'Add Offline Sale';
    document.getElementById('sale-customer-name').value = sale?.customerName || '';
    document.getElementById('sale-customer-phone').value = sale?.customerPhone || '';
    document.getElementById('sale-location').value = sale?.location || '';
    selectSaleProduct(sale?.product);
    document.getElementById('sale-quantity').value = sale?.quantity || 1;
    document.getElementById('sale-unit-price').value = sale?.unitPrice ?? document.getElementById('sale-unit-price').value;
    document.getElementById('sale-invoiced-amount').value = sale?.invoicedAmount ?? '';
    document.getElementById('sale-received-amount').value = sale?.receivedAmount ?? 0;
    document.getElementById('sale-date').value = dateInputValue(sale?.saleDate) || todayInputValue();
    document.getElementById('sale-received-date').value = dateInputValue(sale?.receivedDate);
    document.getElementById('sale-payment-method').value = sale?.paymentMethod || '';
    document.getElementById('sale-notes').value = sale?.notes || '';
    if (!sale) updateSaleTotal();
    saleModal.hidden = false;
    document.getElementById('sale-customer-name').focus();
  }

  function closeSaleModal() {
    saleModal.hidden = true;
  }

  function detailItem(labelText, value) {
    return `
      <div class="admin-detail-item">
        <div class="admin-detail-label">${escapeHtml(labelText)}</div>
        <div class="admin-detail-value">${escapeHtml(value || '-')}</div>
      </div>
    `;
  }

  function timelineIcon(name) {
    const icons = {
      created: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
      imported: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>',
      status: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-7a5 5 0 0 0-5 5"></path><path d="m17 4 3 3-3 3"></path><path d="M4 17h7a5 5 0 0 0 5-5"></path><path d="m7 20-3-3 3-3"></path></svg>',
      priority: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V5"></path><path d="M5 5h11l-1.5 4L16 13H5"></path></svg>',
      followup: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="M4 9h16"></path><rect x="4" y="5" width="16" height="16" rx="2"></rect><path d="M8 13h3"></path><path d="M8 17h6"></path></svg>',
      note: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"></path><path d="M14 3v4h4"></path><path d="M9 12h6"></path><path d="M9 16h6"></path></svg>',
      deleted: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4"></path><path d="M4 5h16"></path><path d="m7 9 .7 11h8.6L17 9"></path><path d="M10 12v5"></path><path d="M14 12v5"></path></svg>',
      quote: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path></svg>',
      updated: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16z"></path><path d="m13 7 4 4"></path></svg>',
      default: '<svg class="admin-timeline-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle></svg>',
    };
    return icons[name] || icons.default;
  }

  function activityMeta(activity) {
    const note = activity.note || '';
    if (activity.type === 'CREATED') return { icon: 'created', title: 'Lead Created' };
    if (activity.type === 'IMPORTED') return { icon: 'imported', title: 'Lead Imported' };
    if (activity.type === 'STATUS_CHANGE') return { icon: 'status', title: 'Status Changed' };
    if (note.startsWith('Priority changed')) return { icon: 'priority', title: 'Priority Changed' };
    if (note.startsWith('Follow-up scheduled')) return { icon: 'followup', title: 'Follow-up Scheduled' };
    if (note.startsWith('Follow-up cleared')) return { icon: 'followup', title: 'Follow-up Cleared' };
    if (note.startsWith('Note added')) return { icon: 'note', title: 'Note Added' };
    if (note.includes('note edited')) return { icon: 'updated', title: 'Note Edited' };
    if (note.includes('note deleted')) return { icon: 'deleted', title: 'Note Deleted' };
    if (note === 'Quotation sent.') return { icon: 'quote', title: 'Quotation Sent' };
    if (note === 'Lead details updated.') return { icon: 'updated', title: 'Lead Updated' };
    return { icon: 'default', title: label(activity.type) };
  }

  function renderLeadDetail(lead) {
    document.getElementById('admin-lead-detail-title').textContent = lead.customerName;
    document.getElementById('admin-lead-note-id').value = lead.id;
    document.getElementById('edit-lead-id').value = lead.id;
    document.getElementById('edit-lead-name').value = lead.customerName || '';
    document.getElementById('edit-lead-phone').value = lead.phone || '';
    document.getElementById('edit-lead-email').value = lead.email || '';
    document.getElementById('edit-lead-location').value = lead.location || '';
    document.getElementById('edit-lead-company').value = lead.company || '';
    document.getElementById('edit-lead-product').value = lead.product || '';
    document.getElementById('edit-lead-quantity').value = lead.quantity ?? '';
    document.getElementById('edit-lead-source').value = lead.source || 'MANUAL';
    document.getElementById('edit-lead-priority').value = lead.priority || 'MEDIUM';
    document.getElementById('edit-lead-status').value = lead.status || 'NEW';
    document.getElementById('edit-lead-assigned-to').value = lead.assignedTo || '';
    document.getElementById('edit-lead-follow-up').value = dateInputValue(lead.nextFollowUpDate);
    document.getElementById('edit-lead-notes').value = lead.crmNotes || '';
    document.getElementById('admin-lead-note').value = '';
    hideStatus(leadEditStatus);
    hideStatus(leadNotesStatus);
    hideStatus(leadNoteStatus);
    hideStatus(paymentStatus);

    document.getElementById('admin-lead-detail-grid').innerHTML = [
      detailItem('Customer Details', lead.customerName),
      detailItem('Lead Number', lead.enquiryNumber),
      detailItem('Phone', lead.phone),
      detailItem('Email', lead.email),
      detailItem('Company', lead.company),
      detailItem('Location', lead.location),
      detailItem('Lead Information', `${label(lead.status)} - ${label(lead.priority)}`),
      detailItem('Product', lead.product),
      detailItem('Quantity', Number(lead.quantity).toLocaleString('en-IN')),
      detailItem('Source', label(lead.source)),
      detailItem('Priority', label(lead.priority)),
      detailItem('Status', label(lead.status)),
      detailItem('Next Follow-up', dateOnly(lead.nextFollowUpDate)),
      detailItem('Assigned To', lead.assignedTo),
      detailItem('CRM Notes', lead.crmNotes),
    ].join('');

    const amountInput = document.getElementById('admin-payment-amount');
    const linkInput = document.getElementById('admin-payment-link');
    const copyLinkButton = document.getElementById('admin-copy-payment-link');
    const openLink = document.getElementById('admin-open-payment-link');
    const receiptLink = document.getElementById('admin-payment-receipt');
    const paymentSaveButton = paymentForm.querySelector('[type="submit"]');
    const paymentLink = lead.paymentUrl ? new URL(lead.paymentUrl, window.location.origin).href : '';
    const successfulPayment = (lead.payments || []).find((payment) => payment.status === 'SUCCESS');
    const latestPayment = successfulPayment || lead.payments?.[0] || null;

    amountInput.value = lead.finalAmount ?? '';
    amountInput.readOnly = Boolean(successfulPayment);
    paymentSaveButton.disabled = Boolean(successfulPayment);
    linkInput.value = paymentLink;
    copyLinkButton.disabled = !paymentLink;
    openLink.href = paymentLink || '#';
    openLink.setAttribute('aria-disabled', paymentLink ? 'false' : 'true');
    receiptLink.hidden = !successfulPayment?.receiptUrl;
    receiptLink.href = successfulPayment?.receiptUrl || '#';
    document.getElementById('admin-payment-summary').innerHTML = [
      detailItem('Final Amount', lead.finalAmount ? money(lead.finalAmount) : 'Not configured'),
      detailItem('Payment Status', label(lead.paymentStatus)),
      detailItem('Payment Date', latestPayment ? dateTime(latestPayment.updatedAt) : '-'),
      detailItem('Payment ID', latestPayment?.paymentId),
      detailItem('Order ID', latestPayment?.orderId),
      detailItem('Payment Method', latestPayment?.paymentMethod ? label(latestPayment.paymentMethod) : '-'),
    ].join('');

    activeLead = lead;
    const timeline = document.getElementById('admin-lead-timeline');
    const activities = lead.activities || [];
    const limit = 5;
    const visibleActivities = showAllTimeline ? activities : activities.slice(0, limit);
    timeline.classList.toggle('expanded', showAllTimeline);
    timeline.innerHTML = activities.length ? `
      <div class="admin-timeline-count">
        <span>${showAllTimeline ? `Showing all ${activities.length} activities` : `Showing latest ${Math.min(limit, activities.length)} of ${activities.length}`}</span>
        ${activities.length > limit ? `<button class="admin-link-button inline" type="button" data-toggle-timeline>${showAllTimeline ? 'Show latest only' : 'Show all activities'}</button>` : ''}
      </div>
      ${visibleActivities.map((activity) => {
      const meta = activityMeta(activity);
      return `
      <article class="admin-timeline-item">
        <span class="admin-timeline-icon">${timelineIcon(meta.icon)}</span>
        <div class="admin-timeline-content">
          <strong>${escapeHtml(meta.title)}</strong>
          <div class="body-sm text-muted">${escapeHtml(activity.note)}</div>
        </div>
        <div class="admin-timeline-meta body-sm text-muted">${escapeHtml(dateTime(activity.createdAt))}${activity.createdBy ? `<br>${escapeHtml(activity.createdBy)}` : ''}</div>
      </article>
    `;
    }).join('')}
    ` : '<p class="body-sm text-muted">No timeline activity yet.</p>';
  }

  async function openLeadDetail(leadId) {
    const data = await api(`/api/admin/leads/${leadId}`);
    showAllTimeline = false;
    renderLeadDetail(data.lead);
    leadDetailModal.hidden = false;
  }

  function closeLeadDetailModal() {
    leadDetailModal.hidden = true;
  }

  function openImportModal() {
    hideStatus(importStatus);
    importRows = [];
    importForm.reset();
    importPreview.classList.remove('show');
    importPreview.innerHTML = '';
    importForm.querySelector('[type="submit"]').disabled = true;
    importModal.hidden = false;
  }

  function closeImportModal() {
    importModal.hidden = true;
  }

  function validateProductPayload(payload) {
    const errors = [];
    if (!payload.standardPrice || payload.standardPrice <= 0) {
      errors.push('Standard price must be greater than zero.');
    }
    if (!payload.bulkPrice || payload.bulkPrice <= 0) {
      errors.push('Bulk price must be greater than zero.');
    }
    if (payload.bulkPrice > payload.standardPrice) {
      errors.push('Bulk price must be less than or equal to standard price.');
    }
    if (!Number.isInteger(payload.bulkQuantity) || payload.bulkQuantity <= 0) {
      errors.push('Bulk quantity must be a positive whole number.');
    }
    if (!payload.description || payload.description.length < 20) {
      errors.push('Product information must be at least 20 characters.');
    }
    return errors;
  }

  function getLeadPayload() {
    return {
      name: document.getElementById('lead-name').value.trim(),
      phone: document.getElementById('lead-phone').value.trim(),
      email: document.getElementById('lead-email').value.trim(),
      location: document.getElementById('lead-location').value.trim(),
      company: document.getElementById('lead-company').value.trim(),
      product: document.getElementById('lead-product').value,
      quantity: Number(document.getElementById('lead-quantity').value),
      source: document.getElementById('lead-source').value,
      priority: document.getElementById('lead-priority').value,
      assignedTo: document.getElementById('lead-assigned-to').value.trim(),
      notes: document.getElementById('lead-notes').value.trim(),
    };
  }

  function getLeadEditPayload() {
    return {
      name: document.getElementById('edit-lead-name').value.trim(),
      phone: document.getElementById('edit-lead-phone').value.trim(),
      email: document.getElementById('edit-lead-email').value.trim(),
      location: document.getElementById('edit-lead-location').value.trim(),
      company: document.getElementById('edit-lead-company').value.trim(),
      product: document.getElementById('edit-lead-product').value,
      quantity: Number(document.getElementById('edit-lead-quantity').value),
      source: document.getElementById('edit-lead-source').value,
      status: document.getElementById('edit-lead-status').value,
      priority: document.getElementById('edit-lead-priority').value,
      assignedTo: document.getElementById('edit-lead-assigned-to').value.trim(),
      nextFollowUpDate: document.getElementById('edit-lead-follow-up').value,
    };
  }

  function validateLeadPayload(payload) {
    if (!payload.name || !payload.phone || !payload.location || !payload.product) {
      return 'Name, phone, location, and product are required.';
    }
    if (!Number.isInteger(payload.quantity) || payload.quantity < 0) {
      return 'Quantity must be zero or more.';
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  function getOfflineSalePayload() {
    return {
      customerName: document.getElementById('sale-customer-name').value.trim(),
      customerPhone: document.getElementById('sale-customer-phone').value.trim(),
      location: document.getElementById('sale-location').value.trim(),
      product: document.getElementById('sale-product').value,
      quantity: Number(document.getElementById('sale-quantity').value),
      unitPrice: Number(document.getElementById('sale-unit-price').value),
      invoicedAmount: Number(document.getElementById('sale-invoiced-amount').value),
      receivedAmount: Number(document.getElementById('sale-received-amount').value),
      saleDate: document.getElementById('sale-date').value,
      receivedDate: document.getElementById('sale-received-date').value,
      paymentMethod: document.getElementById('sale-payment-method').value,
      notes: document.getElementById('sale-notes').value.trim(),
    };
  }

  function validateOfflineSale(payload) {
    if (!payload.customerName || !payload.product || !payload.saleDate) {
      return 'Customer, product, and sale date are required.';
    }
    if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
      return 'Quantity must be a positive whole number.';
    }
    if (!Number.isFinite(payload.unitPrice) || payload.unitPrice <= 0) {
      return 'Unit price must be greater than zero.';
    }
    if (!Number.isFinite(payload.invoicedAmount) || payload.invoicedAmount <= 0) {
      return 'Invoiced amount must be greater than zero.';
    }
    if (!Number.isFinite(payload.receivedAmount) || payload.receivedAmount < 0) {
      return 'Received amount cannot be negative.';
    }
    if (payload.receivedAmount > payload.invoicedAmount) {
      return 'Received amount cannot exceed the invoiced amount.';
    }
    if (payload.receivedAmount > 0 && !payload.receivedDate) {
      return 'Received date is required when an amount has been received.';
    }
    return null;
  }

  async function bootstrap() {
    if (!getToken()) {
      showLogin();
      return;
    }

    showApp();
    await Promise.all([loadDashboard(), loadProducts()]);
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(loginStatus);
    const button = loginForm.querySelector('[type="submit"]');
    const rememberMe = document.getElementById('admin-remember').checked;
    button.disabled = true;
    button.textContent = 'Logging in...';

    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('admin-email').value,
          password: document.getElementById('admin-password').value,
          rememberMe,
        }),
      });

      setToken(data.token, rememberMe);
      admin = data.admin;
      showApp();
      await Promise.all([loadDashboard(), loadProducts()]);
      showToast('Login successful');
    } catch (error) {
      showStatus(loginStatus, error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Login';
    }
  });

  document.addEventListener('click', (event) => {
    const navButton = event.target.closest('[data-view]');
    if (navButton) {
      if (salesGridEditing && !confirmCancelSalesGridEdit()) return;
      openView(navButton.dataset.view);
      return;
    }

    const analyticsTab = event.target.closest('[data-analytics-tab]');
    if (analyticsTab) {
      if (
        salesGridEditing
        && analyticsTab.dataset.analyticsTab !== 'sales'
        && !confirmCancelSalesGridEdit()
      ) return;
      setAnalyticsTab(analyticsTab.dataset.analyticsTab);
      return;
    }

    const analyticsTarget = event.target.closest('[data-analytics-target]');
    if (analyticsTarget) {
      setAnalyticsTab(analyticsTarget.dataset.analyticsTarget);
      document.getElementById('admin-view-analytics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const editButton = event.target.closest('[data-edit-product]');
    if (editButton) {
      const product = products.find((item) => item.id === Number(editButton.dataset.editProduct));
      if (product) openModal(product);
      return;
    }

    if (event.target.closest('[data-open-lead-modal]')) {
      openLeadModal();
      return;
    }

    if (event.target.closest('[data-open-import-modal]')) {
      openImportModal();
      return;
    }

    if (event.target.closest('[data-open-business-import]')) {
      openBusinessImportModal();
      return;
    }

    const openBusinessRecordButton = event.target.closest('[data-open-business-record]');
    if (openBusinessRecordButton) {
      openBusinessRecordModal(openBusinessRecordButton.dataset.openBusinessRecord);
      return;
    }

    const editBusinessRecordButton = event.target.closest('[data-edit-business-record]');
    if (editBusinessRecordButton) {
      const type = editBusinessRecordButton.dataset.businessType;
      const record = businessRecordCache.get(businessRecordKey(type, Number(editBusinessRecordButton.dataset.editBusinessRecord)));
      if (record) openBusinessRecordModal(type, record);
      return;
    }

    const voidBusinessRecordButton = event.target.closest('[data-void-business-record]');
    if (voidBusinessRecordButton) {
      const reason = window.prompt('Reason for voiding this record:');
      if (!reason || reason.trim().length < 3) return;
      voidBusinessRecordButton.disabled = true;
      api(`/api/admin/business-records/${voidBusinessRecordButton.dataset.businessType}/${voidBusinessRecordButton.dataset.voidBusinessRecord}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason.trim() }),
      })
        .then(() => loadAnalytics())
        .then(() => showToast('Business record voided'))
        .catch((error) => {
          showToast(error.errors?.[0]?.message || error.message);
          voidBusinessRecordButton.disabled = false;
        });
      return;
    }

    if (event.target.closest('#admin-edit-sales-grid')) {
      beginSalesGridEdit();
      return;
    }

    if (event.target.closest('#admin-save-sales-grid')) {
      saveSalesGrid().catch((error) => setSalesGridNotice(error.message, true));
      return;
    }

    if (event.target.closest('#admin-cancel-sales-grid')) {
      confirmCancelSalesGridEdit();
      return;
    }

    if (event.target.closest('[data-open-sale-modal]')) {
      openSaleModal();
      return;
    }

    const editSaleButton = event.target.closest('[data-edit-sale]');
    if (editSaleButton) {
      const sale = sales.find((item) => item.type === 'OFFLINE' && item.recordId === Number(editSaleButton.dataset.editSale));
      if (sale) openSaleModal(sale);
      return;
    }

    const viewSaleLeadButton = event.target.closest('[data-view-sale-lead]');
    if (viewSaleLeadButton) {
      openLeadDetail(viewSaleLeadButton.dataset.viewSaleLead).catch((error) => showToast(error.message));
      return;
    }

    const viewLeadButton = event.target.closest('[data-view-lead]');
    if (viewLeadButton) {
      openLeadDetail(viewLeadButton.dataset.viewLead).catch((error) => showToast(error.message));
      return;
    }

    if (event.target.closest('[data-toggle-timeline]')) {
      showAllTimeline = !showAllTimeline;
      if (activeLead) renderLeadDetail(activeLead);
      return;
    }

    const pageButton = event.target.closest('[data-lead-page]');
    if (pageButton && !pageButton.disabled) {
      leadPage = Number(pageButton.dataset.leadPage);
      loadLeads().catch((error) => showToast(error.message));
      return;
    }

    const salesPageButton = event.target.closest('[data-sales-page]');
    if (salesPageButton && !salesPageButton.disabled) {
      salesPage = Number(salesPageButton.dataset.salesPage);
      loadSales().catch((error) => showToast(error.message));
      return;
    }

    const businessLogPageButton = event.target.closest('[data-business-log-page]');
    if (businessLogPageButton && !businessLogPageButton.disabled) {
      loadBusinessLog(
        businessLogPageButton.dataset.businessType,
        Number(businessLogPageButton.dataset.businessLogPage),
      ).catch((error) => showToast(error.message));
      return;
    }

    const deleteSaleButton = event.target.closest('[data-delete-sale]');
    if (deleteSaleButton) {
      const saleId = deleteSaleButton.dataset.deleteSale;
      if (!window.confirm('Delete Offline Sale?\n\nThis action cannot be undone.')) return;
      deleteSaleButton.disabled = true;
      api(`/api/admin/sales/${saleId}`, {
        method: 'DELETE',
      })
        .then(() => Promise.all([loadAnalytics(), loadSales()]))
        .then(() => showToast('Offline sale deleted'))
        .catch((error) => {
          showToast(error.message);
          deleteSaleButton.disabled = false;
        });
      return;
    }

    const deleteLeadButton = event.target.closest('[data-delete-lead]');
    if (deleteLeadButton) {
      const leadId = deleteLeadButton.dataset.deleteLead;
      if (!window.confirm('Delete Lead?\n\nThis action cannot be undone.')) return;
      deleteLeadButton.disabled = true;
      api(`/api/admin/leads/${leadId}`, {
        method: 'DELETE',
      })
        .then(() => Promise.all([loadDashboard(), loadLeads()]))
        .then(() => showToast('Lead deleted'))
        .catch((error) => {
          showToast(error.message);
          deleteLeadButton.disabled = false;
        });
      return;
    }

    if (event.target.closest('[data-close-modal]')) {
      closeModal();
    }

    if (event.target.closest('[data-close-lead-modal]')) {
      closeLeadModal();
    }

    if (event.target.closest('[data-close-import-modal]')) {
      closeImportModal();
    }

    if (event.target.closest('[data-close-business-import]')) {
      closeBusinessImportModal();
    }

    if (event.target.closest('[data-close-business-record]')) {
      closeBusinessRecordModal();
    }

    if (event.target.closest('[data-close-sale-modal]')) {
      closeSaleModal();
    }

    if (event.target.closest('[data-close-lead-detail-modal]')) {
      closeLeadDetailModal();
    }
  });

  document.addEventListener('change', async (event) => {
    if (event.target.id === 'business-import-file') {
      businessImportReady = false;
      businessImportForm.querySelector('[type="submit"]').disabled = true;
      businessImportPreview.classList.remove('show');
      hideStatus(businessImportStatus);
      return;
    }

    if (event.target.matches('select[data-sales-grid-field]')) {
      handleSalesGridFieldChange(event.target);
      return;
    }

    if (event.target.id === 'admin-analytics-range') {
      salesRange = event.target.value;
      Object.values(businessLogState).forEach((state) => { state.page = 1; });
      await loadAnalytics().catch((error) => showToast(error.message));
      return;
    }

    if (event.target.matches('[data-business-log-origin]')) {
      const type = event.target.dataset.businessLogOrigin;
      businessLogState[type].origin = event.target.value;
      businessLogState[type].page = 1;
      await loadBusinessLog(type, 1).catch((error) => showToast(error.message));
      return;
    }

    if (event.target.id === 'admin-sales-type') {
      salesType = event.target.value;
      salesPage = 1;
      await loadSales().catch((error) => showToast(error.message));
      return;
    }

    if (event.target.id === 'admin-sales-status-filter') {
      salesStatusFilter = event.target.value;
      salesPage = 1;
      await loadSales().catch((error) => showToast(error.message));
      return;
    }

    if (event.target.id === 'sale-product') {
      selectSaleProduct(event.target.value);
      updateSaleTotal();
      return;
    }

    const prioritySelect = event.target.closest('[data-lead-priority]');
    if (prioritySelect) {
      const leadId = prioritySelect.dataset.leadPriority;
      prioritySelect.disabled = true;
      try {
        await api(`/api/admin/leads/${leadId}/priority`, {
          method: 'PUT',
          body: JSON.stringify({
            priority: prioritySelect.value,
          }),
        });
        await Promise.all([loadDashboard(), loadLeads()]);
        showToast('Lead priority updated');
      } catch (error) {
        showToast(error.message);
        await loadLeads();
      } finally {
        prioritySelect.disabled = false;
      }
      return;
    }

    const statusSelect = event.target.closest('[data-lead-status]');
    if (!statusSelect) return;

    const leadId = statusSelect.dataset.leadStatus;
    statusSelect.disabled = true;
    try {
      await api(`/api/admin/leads/${leadId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: statusSelect.value,
        }),
      });
      await loadDashboard();
      showToast('Lead status updated');
    } catch (error) {
      showToast(error.message);
      await loadLeads();
    } finally {
      statusSelect.disabled = false;
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('input[data-sales-grid-field]')) {
      handleSalesGridFieldChange(event.target);
      return;
    }
    if (event.target.matches('[data-business-log-search]')) {
      const type = event.target.dataset.businessLogSearch;
      businessLogState[type].search = event.target.value.trim();
      businessLogState[type].page = 1;
      window.clearTimeout(event.target.searchTimer);
      event.target.searchTimer = window.setTimeout(() => {
        loadBusinessLog(type, 1).catch((error) => showToast(error.message));
      }, 250);
    }
  });

  document.getElementById('admin-lead-filter').addEventListener('change', (event) => {
    leadFilter = event.target.value;
    leadPage = 1;
    loadLeads().catch((error) => showToast(error.message));
  });

  document.getElementById('admin-lead-search').addEventListener('input', (event) => {
    leadSearch = event.target.value.trim();
    leadPage = 1;
    window.clearTimeout(event.target.searchTimer);
    event.target.searchTimer = window.setTimeout(() => {
      loadLeads().catch((error) => showToast(error.message));
    }, 250);
  });

  document.getElementById('admin-sales-search').addEventListener('input', (event) => {
    salesSearch = event.target.value.trim();
    salesPage = 1;
    window.clearTimeout(event.target.searchTimer);
    event.target.searchTimer = window.setTimeout(() => {
      loadSales().catch((error) => showToast(error.message));
    }, 250);
  });

  ['sale-quantity', 'sale-unit-price'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateSaleTotal);
  });

  document.getElementById('sale-received-amount').addEventListener('input', (event) => {
    const receivedDate = document.getElementById('sale-received-date');
    if (Number(event.target.value) > 0 && !receivedDate.value) receivedDate.value = todayInputValue();
  });

  document.getElementById('admin-export-sales').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Exporting...';
    try {
      await exportSalesCsv();
      showToast('Sales CSV exported');
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Export CSV';
    }
  });

  document.getElementById('admin-logout').addEventListener('click', () => {
    clearToken();
    admin = null;
    products = [];
    showLogin();
  });

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(leadStatus);
    const button = leadForm.querySelector('[type="submit"]');
    const payload = getLeadPayload();
    const error = validateLeadPayload(payload);
    if (error) {
      showStatus(leadStatus, error, true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      await api('/api/admin/leads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await Promise.all([loadDashboard(), loadLeads()]);
      closeLeadModal();
      showToast('Lead created successfully');
      openView('leads');
    } catch (submitError) {
      const firstError = submitError.errors?.[0]?.message;
      showStatus(leadStatus, firstError || submitError.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Save Lead';
    }
  });

  saleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(saleFormStatus);
    const saleId = document.getElementById('admin-sale-id').value;
    const payload = getOfflineSalePayload();
    const validationError = validateOfflineSale(payload);
    if (validationError) {
      showStatus(saleFormStatus, validationError, true);
      return;
    }

    const button = saleForm.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      await api(saleId ? `/api/admin/sales/${saleId}` : '/api/admin/sales', {
        method: saleId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      salesPage = 1;
      await Promise.all([loadAnalytics(), loadSales()]);
      closeSaleModal();
      setAnalyticsTab('sales');
      showToast(saleId ? 'Offline sale updated' : 'Offline sale added');
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      showStatus(saleFormStatus, firstError || error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Save Sale';
    }
  });

  leadEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(leadEditStatus);
    const leadId = document.getElementById('edit-lead-id').value;
    const button = leadEditForm.querySelector('[type="submit"]');
    const payload = getLeadEditPayload();
    const error = validateLeadPayload(payload);
    if (error) {
      showStatus(leadEditStatus, error, true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      const data = await api(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      renderLeadDetail(data.lead);
      await Promise.all([loadDashboard(), loadLeads()]);
      showToast('Lead updated successfully');
    } catch (submitError) {
      const firstError = submitError.errors?.[0]?.message;
      showStatus(leadEditStatus, firstError || submitError.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Save Lead Changes';
    }
  });

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(paymentStatus);
    const leadId = document.getElementById('edit-lead-id').value;
    const amount = Number(document.getElementById('admin-payment-amount').value);
    const button = paymentForm.querySelector('[type="submit"]');
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-7) {
      showStatus(paymentStatus, 'Enter a final amount greater than zero with at most two decimal places.', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      await api(`/api/admin/leads/${leadId}/payment`, {
        method: 'PUT',
        body: JSON.stringify({ finalAmount: amount }),
      });
      const data = await api(`/api/admin/leads/${leadId}`);
      renderLeadDetail(data.lead);
      showStatus(paymentStatus, 'Payment amount and customer link are ready.');
      showToast('Payment link ready');
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      showStatus(paymentStatus, firstError || error.message, true);
    } finally {
      button.disabled = Boolean(activeLead?.paymentStatus === 'SUCCESS');
      button.textContent = button.dataset.label || 'Save Payment Amount';
    }
  });

  document.getElementById('admin-copy-payment-link').addEventListener('click', async () => {
    const input = document.getElementById('admin-payment-link');
    if (!input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      showToast('Payment link copied');
    } catch (_error) {
      input.select();
      document.execCommand('copy');
      showToast('Payment link copied');
    }
  });

  document.getElementById('admin-open-payment-link').addEventListener('click', (event) => {
    if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });

  leadNotesForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(leadNotesStatus);
    const leadId = document.getElementById('edit-lead-id').value;
    const button = leadNotesForm.querySelector('[type="submit"]');
    const notes = document.getElementById('edit-lead-notes').value.trim();

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      const data = await api(`/api/admin/leads/${leadId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({
          notes,
        }),
      });
      renderLeadDetail(data.lead);
      await Promise.all([loadDashboard(), loadLeads()]);
      showToast('Note saved');
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      showStatus(leadNotesStatus, firstError || error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Save Note';
    }
  });

  document.getElementById('admin-delete-lead-notes').addEventListener('click', async () => {
    hideStatus(leadNotesStatus);
    const leadId = document.getElementById('edit-lead-id').value;
    if (!document.getElementById('edit-lead-notes').value.trim()) {
      showStatus(leadNotesStatus, 'No note to delete.', true);
      return;
    }
    if (!window.confirm('Delete Note?\n\nThis action cannot be undone.')) return;

    try {
      const data = await api(`/api/admin/leads/${leadId}/notes`, {
        method: 'DELETE',
      });
      renderLeadDetail(data.lead);
      await Promise.all([loadDashboard(), loadLeads()]);
      showToast('Note deleted');
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      showStatus(leadNotesStatus, firstError || error.message, true);
    }
  });

  leadNoteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(leadNoteStatus);
    const leadId = document.getElementById('admin-lead-note-id').value;
    const note = document.getElementById('admin-lead-note').value.trim();
    const button = leadNoteForm.querySelector('[type="submit"]');

    if (note.length < 2) {
      showStatus(leadNoteStatus, 'Note must be at least 2 characters.', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Adding...';

    try {
      const data = await api(`/api/admin/leads/${leadId}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          note,
        }),
      });
      renderLeadDetail(data.lead);
      await Promise.all([loadDashboard(), loadLeads()]);
      showToast('Note added');
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      showStatus(leadNoteStatus, firstError || error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Add Note';
    }
  });

  document.getElementById('admin-preview-business-import').addEventListener('click', async () => {
    hideStatus(businessImportStatus);
    const file = document.getElementById('business-import-file').files[0];
    if (!file) {
      showStatus(businessImportStatus, 'Choose the SS Bricks XLSX workbook.', true);
      return;
    }
    const button = document.getElementById('admin-preview-business-import');
    button.disabled = true;
    button.textContent = 'Checking...';
    try {
      const data = await businessFileRequest('/api/admin/business-import/preview', file);
      renderBusinessImportPreview(data);
    } catch (error) {
      showStatus(businessImportStatus, error.errors?.[0]?.message || error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Preview';
    }
  });

  businessImportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(businessImportStatus);
    const file = document.getElementById('business-import-file').files[0];
    if (!file || !businessImportReady) {
      showStatus(businessImportStatus, 'Preview this workbook before importing it.', true);
      return;
    }
    const button = businessImportForm.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Importing...';
    try {
      const data = await businessFileRequest('/api/admin/business-import/commit', file);
      businessImportReady = false;
      businessImportPreview.innerHTML = `
        <strong>Import completed as batch ${Number(data.summary.batchId)}</strong>
        <ul>
          <li>${Number(data.summary.sales).toLocaleString('en-IN')} sales</li>
          <li>${Number(data.summary.expenses).toLocaleString('en-IN')} expenses</li>
          <li>${Number(data.summary.materialPurchases).toLocaleString('en-IN')} material purchases</li>
          <li>${Number(data.summary.productionRecords).toLocaleString('en-IN')} production records</li>
          <li>${Number(data.summary.labourPayments).toLocaleString('en-IN')} labour payments</li>
        </ul>
      `;
      await loadAnalytics();
      showToast('Business workbook imported');
    } catch (error) {
      showStatus(businessImportStatus, error.errors?.[0]?.message || error.message, true);
    } finally {
      button.disabled = true;
      button.textContent = button.dataset.label || 'Import Workbook';
    }
  });

  businessRecordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(businessRecordStatus);
    const type = document.getElementById('business-record-type').value;
    const id = document.getElementById('business-record-id').value;
    const payload = businessRecordPayload(type);
    const button = businessRecordForm.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      if (id) {
        const reason = document.getElementById('business-record-reason').value.trim();
        await api(`/api/admin/business-records/${type}/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ data: payload, reason }),
        });
      } else {
        await api(`/api/admin/business-records/${type}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (businessLogState[type]) {
          businessLogState[type].origin = 'ALL';
          businessLogState[type].page = 1;
          const originFilter = document.querySelector(`[data-business-log-origin="${type}"]`);
          if (originFilter) originFilter.value = 'ALL';
        }
      }
      closeBusinessRecordModal();
      await loadAnalytics();
      showToast(id ? 'Business record updated' : 'Business record added');
    } catch (error) {
      showStatus(businessRecordStatus, error.errors?.[0]?.message || error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Save Record';
    }
  });

  document.getElementById('admin-preview-import').addEventListener('click', async () => {
    hideStatus(importStatus);
    const file = document.getElementById('lead-import-file').files[0];
    if (!file) {
      showStatus(importStatus, 'Choose a CSV or XLSX file.', true);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const mappingOverride = getImportMapping();
    if (mappingOverride) {
      formData.append('mapping', JSON.stringify(mappingOverride));
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/admin/leads/import/preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to preview import.');
      }

      importRows = (result.data.rows || []).map((row) => ({
        name: row.name,
        phone: row.phone,
        company: row.company,
        location: row.location,
        product: row.product,
        quantity: row.quantity,
        source: row.source,
        status: row.status,
        priority: row.priority,
        notes: row.notes,
        assignedTo: row.assignedTo,
        duplicate: Boolean(row.duplicate),
        duplicateReason: row.duplicateReason || null,
        duplicateAction: row.duplicate ? document.getElementById('lead-duplicate-strategy').value : undefined,
      }));
      const duplicates = (result.data.rows || []).filter((row) => row.duplicate).length;
      const headers = result.data.headers || [];
      const mapping = result.data.mapping || {};
      const duplicateRows = importRows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.duplicate);
      importPreview.innerHTML = `
        <strong>${result.data.validRows} valid rows</strong> ready from ${result.data.totalRows} rows.
        <ul>
          <li>${result.data.invalidRows} invalid rows skipped</li>
          <li>${duplicates} possible duplicates detected</li>
          <li>Review mapping below, then click Preview again if you change it.</li>
        </ul>
        ${duplicateRows.length ? `
          <div class="admin-duplicate-list">
            <strong>Duplicate Review</strong>
            ${duplicateRows.map(({ row, index }) => `
              <label class="admin-duplicate-row">
                <span>${escapeHtml(row.name)} - ${escapeHtml(row.phone)}<br><small>${escapeHtml(row.duplicateReason || 'Possible duplicate')}</small></span>
                <select class="form-select" data-import-row-action="${index}">
                  ${duplicateActionOptions(row.duplicateAction)}
                </select>
              </label>
            `).join('')}
          </div>
        ` : ''}
        <div class="admin-map-grid">
          ${mappingSelect('name', 'Customer Name', headers, mapping)}
          ${mappingSelect('firstName', 'First Name', headers, mapping)}
          ${mappingSelect('lastName', 'Last Name', headers, mapping)}
          ${mappingSelect('phone', 'Phone', headers, mapping)}
          ${mappingSelect('location', 'Location', headers, mapping)}
          ${mappingSelect('product', 'Interested Product', headers, mapping)}
          ${mappingSelect('quantity', 'Quantity', headers, mapping)}
          ${mappingSelect('source', 'Lead Source', headers, mapping)}
          ${mappingSelect('status', 'Status', headers, mapping)}
          ${mappingSelect('priority', 'Priority', headers, mapping)}
          ${mappingSelect('company', 'Company', headers, mapping)}
          ${mappingSelect('assignedTo', 'Assigned To', headers, mapping)}
          ${mappingSelect('notes', 'Notes', headers, mapping)}
        </div>
      `;
      importPreview.classList.add('show');
      importForm.querySelector('[type="submit"]').disabled = importRows.length === 0;
    } catch (previewError) {
      showStatus(importStatus, previewError.message, true);
    }
  });

  importForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(importStatus);
    refreshImportRowActions();
    const button = importForm.querySelector('[type="submit"]');
    if (!importRows.length) {
      showStatus(importStatus, 'Preview a valid file before importing.', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Importing...';

    try {
      const data = await api('/api/admin/leads/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          duplicateStrategy: document.getElementById('lead-duplicate-strategy').value,
          rows: importRows.map((row) => ({
            name: row.name,
            phone: row.phone,
            company: row.company,
            location: row.location,
            product: row.product,
            quantity: row.quantity,
            source: row.source,
            status: row.status,
            priority: row.priority,
            notes: row.notes,
            assignedTo: row.assignedTo,
            duplicateAction: row.duplicateAction,
          })),
        }),
      });
      await Promise.all([loadDashboard(), loadLeads()]);
      openView('leads');
      importPreview.innerHTML = `
        <strong>Import Summary</strong>
        <ul>
          <li>${data.summary.created} created</li>
          <li>${data.summary.updated} updated</li>
          <li>${data.summary.skipped} skipped</li>
          <li>${data.summary.importedAnyway} duplicate rows imported anyway</li>
        </ul>
      `;
      importPreview.classList.add('show');
      importRows = [];
      button.disabled = true;
      showToast(`Imported: ${data.summary.created} created, ${data.summary.updated} updated, ${data.summary.skipped} skipped`);
    } catch (importError) {
      const firstError = importError.errors?.[0]?.message;
      showStatus(importStatus, firstError || importError.message, true);
    } finally {
      button.disabled = importRows.length === 0;
      button.textContent = button.dataset.label || 'Import';
    }
  });

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideStatus(productStatus);
    const productId = document.getElementById('admin-product-id').value;
    const button = productForm.querySelector('[type="submit"]');
    const payload = {
      standardPrice: Number(document.getElementById('admin-standard-price').value),
      bulkPrice: Number(document.getElementById('admin-bulk-price').value),
      bulkQuantity: Number(document.getElementById('admin-bulk-quantity').value),
      availability: document.getElementById('admin-availability').value,
      description: document.getElementById('admin-description').value.trim(),
    };
    const errors = validateProductPayload(payload);
    if (errors.length) {
      showStatus(productStatus, errors[0], true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      await api(`/api/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await Promise.all([loadDashboard(), loadProducts(), loadHistory()]);
      closeModal();
      showToast('Product updated successfully');
    } catch (error) {
      const firstError = error.errors?.[0]?.message;
      showStatus(productStatus, firstError || error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.label || 'Save';
    }
  });

  bootstrap().catch((error) => {
    clearToken();
    showLogin();
    showStatus(loginStatus, error.message, true);
  });
})();
