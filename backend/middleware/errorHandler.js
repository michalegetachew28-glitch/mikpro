/**
 * Centralized backend error handler.
 *
 * Rules:
 *  - ALWAYS log the full error (stack trace, Prisma details, etc.) to the server console.
 *  - NEVER expose internal details to the client.
 *  - Return a generic, user-friendly JSON response.
 */

const DB_ERROR_CODES = new Set([
  'P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1009', 'P1010', 'P1011',
  'P1012', 'P1013', 'P1014', 'P1015', 'P1016', 'P1017', // Prisma connection/schema errors
  'P2024', // Prisma connection pool timeout
]);

const NETWORK_MESSAGES = [
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH',
  "Can't reach database", 'Connection refused', 'connection timed out',
  'PrismaClientInitializationError', 'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError', 'PrismaClientRustPanicError',
  'prisma.', 'Invalid `prisma.',
];

/**
 * Detects whether an error is a database / network connectivity error.
 */
function isDbOrNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || '') + (err.constructor?.name || '');
  if (DB_ERROR_CODES.has(err.code)) return true;
  return NETWORK_MESSAGES.some((pattern) => msg.includes(pattern));
}

/**
 * Call this inside every route catch block.
 *
 * @param {Error} err   - The caught error object
 * @param {string} label - A short label for the server log (e.g. 'GET /attendances')
 * @param {object} res   - Express response object
 */
const fs = require('fs');

function handleRouteError(err, label, res) {
  // Always log full details server-side
  console.error(`[${label}] Error:`, err);
  
  try {
    fs.appendFileSync('backend_errors_log.txt', new Date().toISOString() + ' [' + label + '] ' + (err.stack || err.message || err.toString()) + '\n');
  } catch(e) {}

  if (isDbOrNetworkError(err)) {
    return res.status(503).json({
      success: false,
      message: 'Network connection is unstable. Please try again. ERROR: ' + err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again. ERROR: ' + err.message,
  });
}

/**
 * Express global error-handler middleware (4-argument form).
 */
function globalErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[Global Error Handler]', err);

  if (isDbOrNetworkError(err)) {
    return res.status(503).json({
      success: false,
      message: 'Network connection is unstable. Please try again.',
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
  });
}

module.exports = { handleRouteError, globalErrorHandler };
