const ApiError = require('../utils/ApiError');

/** Catch-all for unmatched routes; must be registered after every router. */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Translates the error shapes this app can actually produce into status codes,
 * and never leaks internals to the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server error';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)[0]?.message || 'Validation failed';
    details = { errors: Object.values(err.errors).map((e) => ({ path: e.path, msg: e.message })) };
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message =
      field === 'email'
        ? 'Email already in use'
        : `That ${field} is already taken`;
    details = err.keyValue;
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  if (statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    message = 'Server error';
    details = undefined;
  }

  const body = { message };
  if (details) body.details = details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };