const express = require('express');
const logger = require('./logger');
const requestIdMiddleware = require('./middleware/requestId');
const metricsMiddleware = require('./middleware/metricsMiddleware');
const metrics = require('./metrics');
const errorHandler = require('./middleware/errorHandler');

const healthRoutes = require('./routes/health');
const dataRoutes = require('./routes/data');

const PORT = process.env.PORT || 3000;

const app = express();

// Basic JSON parsing middleware (if needed in future)
app.use(express.json());

// Request ID assignment
app.use(requestIdMiddleware);

// Attach a request-local log helper that delegates to the central logger.
// The central logger will automatically include requestId via AsyncLocalStorage
// if the requestId middleware has bound the context.
app.use((req, res, next) => {
  req.log = {
    info: (obj) => logger.info(obj),
    warn: (obj) => logger.warn(obj),
    error: (obj) => logger.error(obj),
    debug: (obj) => logger.debug(obj)
  };
  next();
});

// Metrics middleware should be after request id so metrics could include it if needed
app.use(metricsMiddleware);

// Routes
app.use('/', healthRoutes);
app.use('/', dataRoutes);

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (ex) {
    logger.error({ message: 'Failed to collect metrics', metadata: { err: ex } });
    res.status(500).send('Error collecting metrics');
  }
});

// Error handler (last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info({ message: 'api-service started', metadata: { port: PORT } });
});

// Log circuit breaker config
logger.info({ message: 'Circuit breaker config', metadata: { cb: { failureThreshold: process.env.CB_FAILURE_THRESHOLD || 5, resetTimeoutMs: process.env.CB_RESET_TIMEOUT_MS || 10000 } } });

// Expose circuit breaker metrics periodically
const { listCircuits } = require('./services/circuitBreaker');
const metricsModule = require('./metrics');

setInterval(() => {
  try {
    const circuits = listCircuits();
    circuits.forEach((c) => {
      metricsModule.circuitStateGauge.set({ circuit: c.name }, c.value);
    });
  } catch (err) {
    logger.debug({ message: 'Error updating circuit metrics', metadata: { err } });
  }
}, 2000).unref();

// Graceful shutdown
function shutdown(signal) {
  logger.info({ message: 'Shutdown initiated', metadata: { signal } });
  server.close((err) => {
    if (err) {
      logger.error({ message: 'Error closing server', metadata: { err } });
      process.exit(1);
    }
    logger.info({ message: 'Server closed, exiting' });
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.warn({ message: 'Forcing shutdown after timeout' });
    process.exit(1);
  }, 30000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Unhandled errors - log and exit
process.on('uncaughtException', (err) => {
  logger.error({ message: 'uncaughtException', metadata: { err } });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'unhandledRejection', metadata: { reason } });
  process.exit(1);
});
