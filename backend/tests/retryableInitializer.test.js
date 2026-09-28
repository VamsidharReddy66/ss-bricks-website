const assert = require('node:assert/strict');
const test = require('node:test');
const { createRetryableInitializer } = require('../utils/retryableInitializer');

test('reuses one successful initialization across requests', async () => {
  let calls = 0;
  const initialize = createRetryableInitializer(async () => {
    calls += 1;
    return 'ready';
  });

  const [first, second] = await Promise.all([initialize(), initialize()]);
  const third = await initialize();

  assert.equal(first, 'ready');
  assert.equal(second, 'ready');
  assert.equal(third, 'ready');
  assert.equal(calls, 1);
});

test('clears a failed initialization so the next request can recover', async () => {
  let calls = 0;
  const initialize = createRetryableInitializer(async () => {
    calls += 1;
    if (calls === 1) throw new Error('database schema is not ready');
    return 'ready';
  });

  await assert.rejects(initialize(), /database schema is not ready/);
  assert.equal(await initialize(), 'ready');
  assert.equal(calls, 2);
});

test('shares a failed initialization between concurrent requests before retrying', async () => {
  let calls = 0;
  let rejectAttempt;
  const initialize = createRetryableInitializer(() => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      rejectAttempt = reject;
    });
  });

  const first = initialize();
  const second = initialize();
  await Promise.resolve();
  rejectAttempt(new Error('temporary startup failure'));

  await assert.rejects(first, /temporary startup failure/);
  await assert.rejects(second, /temporary startup failure/);
  assert.equal(calls, 1);
});
