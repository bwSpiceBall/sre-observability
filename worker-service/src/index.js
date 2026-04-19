const express = require('express');
const logger = require('./logger');
const InMemoryQueue = require('./services/queue');
const Worker = require('./services/worker');
const metrics = require('./metrics');

const PORT = process.env.PORT || 4000;

const app = express();

// Very small API for health and metrics so Prometheus can scrape
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (ex) {
    logger.error({ message: 'Failed to collect metrics', metadata: { err: ex } });
    res.status(500).send('Error collecting metrics');
  }
});

// Start HTTP server for metrics
const server = app.listen(PORT, () => {
  logger.info({ message: 'worker-service metrics server listening', metadata: { port: PORT } });
});

// Setup queue and worker
const queue = new InMemoryQueue(logger);
queue.startProducing(300); // produce a job ~ every 300ms

const worker = new Worker(queue);
worker.start();

// Update memory metric on startup (label with worker name if available)
const initialWorkerName = process.env.WORKER_NAME || 'worker-1';
metrics.memoryUsageGauge.set({ worker: initialWorkerName }, process.memoryUsage().heapUsed);

// Graceful shutdown
function shutdown(signal) {
  logger.info({ message: 'Shutdown initiated', metadata: { signal } });
  worker.stop();
  queue.stopProducing();

  server.close((err) => {
    if (err) {
      logger.error({ message: 'Error closing server', metadata: { err } });
      process.exit(1);
    }
    logger.info({ message: 'Server closed, exiting' });
    process.exit(0);
  });

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
