// Error handling utilities for AetherPress
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const ERROR_TYPES = {
  VALIDATION: "VALIDATION_ERROR",
  PROCESSING: "PROCESSING_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
};

/**
 * Creates a standardized error response object
 * @param {string} message - User-friendly error message
 * @param {string} code - Error type code
 * @param {number} status - HTTP status code
 * @param {any} details - Technical details (only included in development)
 * @param {string} requestId - Optional request ID
 * @returns {Object} Formatted error response
 */
function createErrorResponse(
  message,
  code,
  status,
  details = null,
  requestId = null
) {
  const isDev = process.env.NODE_ENV !== "production";
  const errorResponse = {
    error: {
      message,
      code,
      status,
      timestamp: new Date().toISOString(),
      requestId: requestId || uuidv4(),
    },
  };

  // Only include details in development mode
  if (isDev && details) {
    errorResponse.error.details = details;
  }

  return errorResponse;
}

/**
 * Sends a validation error response (400)
 */
function sendValidationError(res, message, details = null) {
  const requestId = (res && res.locals && res.locals.requestId) || null;
  const response = createErrorResponse(
    message,
    ERROR_TYPES.VALIDATION,
    400,
    details,
    requestId
  );
  res.status(400).json(response);
}

/**
 * Sends a processing error response (500)
 */
function sendProcessingError(res, message, details = null) {
  const requestId = (res && res.locals && res.locals.requestId) || null;
  const response = createErrorResponse(
    message,
    ERROR_TYPES.PROCESSING,
    500,
    details,
    requestId
  );
  res.status(500).json(response);
}

/**
 * Sends a not found error response (404)
 */
function sendNotFoundError(res, message, details = null) {
  const requestId = (res && res.locals && res.locals.requestId) || null;
  const response = createErrorResponse(
    message,
    ERROR_TYPES.NOT_FOUND,
    404,
    details,
    requestId
  );
  res.status(404).json(response);
}

/**
 * Sends a service unavailable error response (503)
 */
function sendServiceUnavailableError(res, message, details = null) {
  const requestId = (res && res.locals && res.locals.requestId) || null;
  const response = createErrorResponse(
    message,
    ERROR_TYPES.SERVICE_UNAVAILABLE,
    503,
    details,
    requestId
  );
  res.status(503).json(response);
}

/**
 * Enhanced error middleware that maintains backward compatibility
 */
function errorMiddleware(err, req, res, next) {
  // Preserve previous logging behavior while centralizing the response
  // generation and file-based error append so the index.js file stays small.
  console.error("--- Error Handler ---");
  console.error("Time:", new Date().toISOString());
  console.error("Method:", req && req.method);
  console.error("URL:", req && req.originalUrl);
  console.error("Body:", req && req.body);
  console.error("Error Stack:", err && err.stack ? err.stack : err);

  const isDev = process.env.NODE_ENV !== "production";
  const status = err.status || 500;
  const requestId =
    (req && req.requestId) ||
    (res && res.locals && res.locals.requestId) ||
    "-";

  // Append a compact structured error line to server-logs/errors.log for quick lookups
  try {
    const logsDir = path.resolve(__dirname, "..", "logs");
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir);
      } catch (e) {
        // ignore mkdir errors
      }
    }

    const logLine = JSON.stringify({
      t: new Date().toISOString(),
      id: requestId,
      method: req && req.method,
      url: req && req.originalUrl,
      status: status,
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.split("\n")[0] : null,
    });
    try {
      fs.appendFileSync(path.join(logsDir, "errors.log"), logLine + "\n");
    } catch (e) {
      console.warn(
        "Failed to append to errors.log:",
        e && e.message ? e.message : e
      );
    }
  } catch (e) {
    console.warn(
      "Failed to build error log line:",
      e && e.message ? e.message : e
    );
  }

  // Surface a short error header to aid proxied requests / reverse-proxies
  try {
    res.setHeader(
      "X-Backend-Error",
      err && err.message ? String(err.message).slice(0, 200) : "error"
    );
    res.setHeader("X-Request-Id", requestId);
  } catch (e) {
    // ignore header-setting errors in error handler
  }

  // Build a structured response including the requestId
  const response = createErrorResponse(
    isDev ? err && err.message : "Internal Server Error",
    ERROR_TYPES.PROCESSING,
    status,
    isDev ? err && err.stack : null,
    requestId
  );

  // Ensure a JSON content-type so test clients and API consumers get a parsable body
  try {
    if (res.headersSent) {
      try {
        res.write(JSON.stringify(response));
        res.end();
      } catch (e) {
        try {
          res.end();
        } catch (er) {
          void er; // ignore
        }
      }
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(status).json(response);
  } catch (e) {
    try {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.status(500).send(JSON.stringify({ error: "error-handler-failed" }));
      } else {
        try {
          res.end();
        } catch (er) {
          void er;
        }
      }
    } catch (ee) {
      void ee;
    }
  }
}

// Error classes
class TransportError extends Error {
  constructor(
    message,
    status = 500,
    code = ERROR_TYPES.PROCESSING,
    details = null
  ) {
    super(message);
    this.name = "TransportError";
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

class ServiceError extends Error {
  constructor(
    message,
    status = 500,
    code = ERROR_TYPES.PROCESSING,
    details = null
  ) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

module.exports = {
  ERROR_TYPES,
  createErrorResponse,
  sendValidationError,
  sendProcessingError,
  sendNotFoundError,
  sendServiceUnavailableError,
  errorMiddleware,
  TransportError,
  ServiceError,
};
