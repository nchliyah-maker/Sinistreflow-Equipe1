// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message,
    details: err.details,
    stack: err.stack,
  });
};
