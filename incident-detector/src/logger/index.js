const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: process.env.SERVICE_NAME || 'incident-detector' },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  timestampKey: 'timestamp'
});

module.exports = logger;
