(function () {
  'use strict';

  const API_BASE_URL = window.SSB_API_BASE_URL || '';
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token') || '';
  const autoStart = searchParams.get('autostart') === '1';
  const loading = document.getElementById('payment-loading');
  const content = document.getElementById('payment-content');
  const message = document.getElementById('payment-message');
  const payButton = document.getElementById('payment-pay-button');
  const successPanel = document.getElementById('payment-success');
  let quotation = null;
  let currentOrderId = null;

  function money(value) {
    return `Rs.${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
      const error = new Error(result.errors?.[0]?.message || result.message || 'Request failed.');
      error.status = response.status;
      throw error;
    }
    return result.data;
  }

  function showSuccessfulPayment(payment) {
    successPanel.hidden = false;
    payButton.hidden = true;
    document.getElementById('payment-id').textContent = payment.paymentId || '-';
    document.getElementById('payment-order-id').textContent = payment.orderId || '-';
    document.getElementById('payment-success-quotation').textContent = quotation.quotationNumber;
    const receipt = document.getElementById('payment-receipt');
    receipt.href = payment.receiptUrl || `/api/payment/quote/${encodeURIComponent(token)}/receipt`;
    clearMessage();
  }

  function renderQuotation(data) {
    quotation = data;
    document.getElementById('payment-quotation').textContent = data.quotationNumber;
    document.getElementById('payment-customer').textContent = data.customer.name;
    document.getElementById('payment-product').textContent = data.product;
    document.getElementById('payment-quantity').textContent = Number(data.quantity).toLocaleString('en-IN');
    document.getElementById('payment-amount').textContent = money(data.finalAmount);
    loading.hidden = true;
    content.hidden = false;

    if (data.payment?.status === 'SUCCESS') {
      showSuccessfulPayment(data.payment);
      return;
    }
    payButton.disabled = false;
    if (autoStart) {
      window.setTimeout(openCheckout, 150);
    }
  }

  async function recordFailure(error) {
    if (!currentOrderId) return;
    try {
      await api('/api/payment/failure', {
        method: 'POST',
        body: JSON.stringify({
          paymentToken: token,
          razorpay_order_id: error?.metadata?.order_id || currentOrderId,
          razorpay_payment_id: error?.metadata?.payment_id || null,
          reason: error?.description || error?.reason || 'Payment was not completed.',
        }),
      });
    } catch (_error) {
      // The visible Checkout failure remains the source of the customer-facing message.
    }
  }

  async function openCheckout() {
    clearMessage();
    if (typeof window.Razorpay !== 'function') {
      showMessage('Razorpay Checkout could not be loaded. Check your connection and try again.', true);
      return;
    }

    payButton.disabled = true;
    payButton.textContent = 'Preparing Payment...';
    try {
      const data = await api('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ paymentToken: token }),
      });
      const order = data.order;
      currentOrderId = order.orderId;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'SS Bricks',
        description: `Test payment for ${order.quotationNumber}`,
        order_id: order.orderId,
        prefill: {
          name: order.customer.name || '',
          email: order.customer.email || '',
          contact: order.customer.phone ? `+91${order.customer.phone}` : '',
        },
        notes: {
          quotation_number: order.quotationNumber,
        },
        theme: {
          color: '#6B1713',
        },
        modal: {
          ondismiss: function () {
            payButton.disabled = false;
            payButton.textContent = 'Try Again';
            showMessage('Payment was cancelled. You can try again.', true);
          },
        },
        handler: async function (response) {
          try {
            showMessage('Verifying payment...');
            const verified = await api('/api/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                paymentToken: token,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (verified.payment.status === 'SUCCESS') {
              showSuccessfulPayment(verified.payment);
            } else {
              showMessage('Payment is verified and awaiting capture. Refresh shortly.', false);
              payButton.textContent = 'Check Again';
              payButton.disabled = false;
            }
          } catch (error) {
            showMessage(error.message || 'Payment verification failed. Please try again.', true);
            payButton.textContent = 'Try Again';
            payButton.disabled = false;
          }
        },
      });

      checkout.on('payment.failed', async function (response) {
        await recordFailure(response.error);
        showMessage(response.error?.description || 'Payment failed. Please try again.', true);
        payButton.textContent = 'Try Again';
        payButton.disabled = false;
      });
      checkout.open();
    } catch (error) {
      showMessage(error.message || 'Unable to start payment. Please try again.', true);
      payButton.disabled = false;
      payButton.textContent = 'Try Again';
    }
  }

  payButton.addEventListener('click', openCheckout);

  if (!/^[a-f0-9]{48}$/.test(token)) {
    loading.textContent = 'This payment link is invalid.';
  } else {
    api(`/api/payment/quote/${encodeURIComponent(token)}`)
      .then((data) => renderQuotation(data.quotation))
      .catch((error) => {
        loading.textContent = error.message || 'Unable to load this payment link.';
      });
  }
}());
