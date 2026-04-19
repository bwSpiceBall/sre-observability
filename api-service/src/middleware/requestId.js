const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

// Attach a requestId to each request and bind it to the AsyncLocalStorage
// context provided by the logger. This ensures any module that logs using
// the shared logger will automatically include the requestId for the
// duration of the request (including async operations).
function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = incoming || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  // Run the rest of the request handling inside the logger's request
  // context so later logs can read the requestId automatically.
  logger.bindRequest(id, () => {
    next();
  });
}

module.exports = requestIdMiddleware;
