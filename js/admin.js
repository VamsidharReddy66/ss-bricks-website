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
  const productForm = document.getElementById('admin-product-form');
  const leadForm = document.getElementById('admin-lead-form');
  const leadEditForm = document.getElementById('admin-lead-edit-form');
  const leadNotesForm = document.getElementById('admin-lead-notes-form');
  const leadNoteForm = document.getElementById('admin-lead-note-form');
  const paymentForm = document.getElementById('admin-payment-form');
  const importForm = document.getElementById('admin-import-form');
  const productStatus = document.getElementById('admin-product-status');
  const leadStatus = document.getElementById('admin-lead-status');
  const leadEditStatus = document.getElementById('admin-lead-edit-status');
  const leadNotesStatus = document.getElementById('admin-lead-notes-status');
  const leadNoteStatus = document.getElementById('admin-lead-note-status');
  const paymentStatus = document.getElementById('admin-payment-status');
  const importStatus = document.getElementById('admin-import-status');
  const importPreview = document.getElementById('admin-import-preview');
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
      leads: 'Leads',
      products: 'Products',
      settings: 'Settings',
    }[name] || 'Dashboard';

    if (name === 'leads') loadLeads().catch((error) => showToast(error.message));
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
      openView(navButton.dataset.view);
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

    if (event.target.closest('[data-close-lead-detail-modal]')) {
      closeLeadDetailModal();
    }
  });

  document.addEventListener('change', async (event) => {
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
