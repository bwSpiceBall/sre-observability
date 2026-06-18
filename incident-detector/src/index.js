const express        = require('express');
const logger         = require('./logger');
const metrics        = require('./metrics');
const Detector       = require('./detector');
const RedisStreamBus = require('./bus/redisStream');

const PORT             = parseInt(process.env.PORT || '5000', 10);
const PROMETHEUS_URL   = process.env.PROMETHEUS_URL  || 'http://prometheus.monitoring.svc.cluster.local:9090';
const REDIS_HOST       = process.env.REDIS_HOST      || 'redis.default.svc.cluster.local';
const REDIS_PORT       = parseInt(process.env.REDIS_PORT || '6379', 10);
const EVAL_INTERVAL_MS = parseInt(process.env.EVAL_INTERVAL_MS || '15000', 10);
const COOLDOWN_MS      = parseInt(process.env.COOLDOWN_MS || '300000', 10);

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (ex) {
    logger.error({ message: 'Failed to collect metrics', metadata: { err: ex.message } });
    res.status(500).send('Error collecting metrics');
  }
});

const bus = new RedisStreamBus({ host: REDIS_HOST, port: REDIS_PORT });
const detector = new Detector({ prometheusUrl: PROMETHEUS_URL, bus, evalIntervalMs: EVAL_INTERVAL_MS, cooldownMs: COOLDOWN_MS });

// Listen first so /health is reachable before Redis/Prometheus are connected
const server = app.listen(PORT, () => {
  logger.info({ message: 'incident-detector started', metadata: { port: PORT, prometheusUrl: PROMETHEUS_URL } });
  bus.connect();
  detector.start();
});

function shutdown(signal) {
  logger.info({ message: 'Shutdown initiated', metadata: { signal } });
  detector.stop();
  server.close(async (err) => {
    if (err) {
      logger.error({ message: 'Error closing server', metadata: { err: err.message } });
    }
    await bus.disconnect();
    process.exit(err ? 1 : 0);
  });

  setTimeout(() => {
    logger.warn({ message: 'Forcing shutdown after timeout' });
    process.exit(1);
  }, 30000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error({ message: 'uncaughtException', metadata: { err: err.message } });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'unhandledRejection', metadata: { reason: String(reason) } });
  process.exit(1);
});
