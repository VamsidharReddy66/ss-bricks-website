function isUniqueConstraintError(error) {
  return error && error.code === 'P2002';
}

module.exports = {
  isUniqueConstraintError,
};
