function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('');
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

module.exports = {
  localDateKey,
  parseDateOnly,
};
