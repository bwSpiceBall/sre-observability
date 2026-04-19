const pino = require('pino');
const { AsyncLocalStorage } = require('async_hooks');

const serviceName = process.env.SERVICE_NAME || 'api-service';

// AsyncLocalStorage used to keep request-scoped data available to logs
const als = new AsyncLocalStorage();

// Base pino logger
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: serviceName },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  timestampKey: 'timestamp'
});

// Wrapper logger that merges requestId from ALS into every log call
const logger = {
  _pino: baseLogger,
  _withRequestId(obj) {
    const store = als.getStore();
    if (store && store.requestId) {
      return { ...obj, requestId: store.requestId };
    }
    return obj;
  },
  info(obj) { baseLogger.info(this._withRequestId(obj)); },
  warn(obj) { baseLogger.warn(this._withRequestId(obj)); },
  error(obj) { baseLogger.error(this._withRequestId(obj)); },
  debug(obj) { baseLogger.debug(this._withRequestId(obj)); },

  // Bind a function execution to a requestId so all logs during that
  // execution will include the requestId automatically.
  bindRequest(requestId, fn) {
    return als.run({ requestId }, fn);
  }
};

module.exports = logger;
