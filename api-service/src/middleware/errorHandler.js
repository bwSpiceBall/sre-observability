const logger = require('../logger');

function errorHandler(err, req, res, next) {
  // Structured error log
  logger.error({
    message: 'Unhandled error in request',
    requestId: req && req.requestId,
    metadata: {
      err: {
        message: err.message,
        stack: err.stack
      }
    }
  });

  // Generic 500 response
  res.status(500).json({ error: 'internal_server_error', requestId: req.requestId });
}

module.exports = errorHandler;
