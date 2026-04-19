const pino = require('pino');

const serviceName = process.env.SERVICE_NAME || 'worker-service';

// Configure message and timestamp keys to match required logging schema
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: serviceName },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  timestampKey: 'timestamp'
});

module.exports = logger;
