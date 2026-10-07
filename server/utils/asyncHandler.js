/**
 * Wraps an async route handler so rejected promises reach the Express error
 * handler instead of dying as unhandled rejections.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;