/**
 * Wraps an async Express route handler to catch rejected promises
 * and forward them to Express error handling middleware.
 *
 * Usage:
 *   router.get('/foo', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  try {
    return Promise.resolve(fn(req, res, next)).catch(next);
  } catch (err) {
    next(err);
  }
};

module.exports = asyncHandler;
