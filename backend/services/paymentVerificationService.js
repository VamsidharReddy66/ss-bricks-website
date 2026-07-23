const crypto = require('crypto');

function equalHexDigest(expected, received) {
  if (!/^[a-f0-9]+$/i.test(received || '')) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyPaymentSignature({ orderId, paymentId, signature, secret }) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`, 'utf8')
    .digest('hex');
  return equalHexDigest(expected, signature);
}

function verifyWebhookSignature({ rawBody, signature, secret }) {
  if (!Buffer.isBuffer(rawBody)) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return equalHexDigest(expected, signature);
}

module.exports = {
  verifyPaymentSignature,
  verifyWebhookSignature,
};
