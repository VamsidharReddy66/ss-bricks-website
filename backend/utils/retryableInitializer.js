function createRetryableInitializer(initializer) {
  let pending = null;

  return function initialize() {
    if (pending) return pending;

    const attempt = Promise.resolve().then(initializer);
    pending = attempt;
    attempt.catch(() => {
      if (pending === attempt) pending = null;
    });

    return attempt;
  };
}

module.exports = { createRetryableInitializer };
