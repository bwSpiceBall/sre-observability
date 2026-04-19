const express = require('express');
const router = express.Router();
const logger = require('../logger');
const { simulateDownstream } = require('../services/downstream');
const { getCircuit } = require('../services/circuitBreaker');

const DOWNSTREAM_TIMEOUT_MS = parseInt(process.env.DOWNSTREAM_TIMEOUT_MS || '0', 10);

const downstreamCircuit = getCircuit('downstream');
const metrics = require('../metrics');

const ERROR_RATE = parseFloat(process.env.ERROR_RATE || '0.0');
const LATENCY_MS = parseInt(process.env.LATENCY_MS || '0', 10);

// Helper to maybe inject artificial latency for the API endpoint itself
function maybeLatency() {
  if (LATENCY_MS > 0) {
    // Apply latency randomly, 20% chance
    if (Math.random() < 0.2) {
      return new Promise((res) => setTimeout(res, LATENCY_MS));
    }
  }
  return Promise.resolve();
}

router.get('/data', async (req, res, next) => {
  const requestId = req.requestId;
  const start = Date.now();

  // Randomly return a 500 error according to ERROR_RATE
  if (Math.random() < ERROR_RATE) {
    logger.info({ message: 'Injecting random 500 for testing', requestId, metadata: {} });
    // small delay to make it appear realistic
    await new Promise((r) => setTimeout(r, 50));
    return res.status(500).json({ error: 'injected_error', requestId });
  }

  try {
    await maybeLatency();

    // Circuit breaker: check if we can call downstream
    if (!downstreamCircuit.allowRequest()) {
      logger.warn({ message: 'Circuit open, skipping downstream call', requestId });
      // Increment downstream timeout/blocked metric for visibility
     const DOWNSTREAM_RETRY_MAX = parseInt(process.env.DOWNSTREAM_RETRY_MAX || '2', 10);
     const DOWNSTREAM_RETRY_BASE_MS = parseInt(process.env.DOWNSTREAM_RETRY_BASE_MS || '100', 10);
      metrics.downstreamTimeouts.inc({ dependency: 'simulated' });
      return res.status(503).json({ error: 'service_unavailable', detail: 'downstream_circuit_open', requestId });
    }

    // Simulate a downstream call which can fail or delay. Wrap with timeout.
    let downstream;
    try {
      if (DOWNSTREAM_TIMEOUT_MS > 0) {
        const endDown = metrics.downstreamRequestDuration.startTimer({ dependency: 'simulated', status: 'unknown' });
        downstream = await Promise.race([
          simulateDownstream(requestId),
          new Promise((_, rej) => setTimeout(() => rej(new Error('downstream_timeout')), DOWNSTREAM_TIMEOUT_MS))
        ]);
        endDown({ dependency: 'simulated', status: 'success' });
        metrics.downstreamRequestCount.inc({ dependency: 'simulated', status: 'success' });
      } else {
        const endDown = metrics.downstreamRequestDuration.startTimer({ dependency: 'simulated', status: 'unknown' });
        downstream = await simulateDownstream(requestId);
        endDown({ dependency: 'simulated', status: 'success' });
        metrics.downstreamRequestCount.inc({ dependency: 'simulated', status: 'success' });
      }
      // success -> inform circuit
      downstreamCircuit.recordSuccess();
    } catch (err) {
      // record failure in circuit
      downstreamCircuit.recordFailure();
      // Translate timeout to 504
      if (err && err.message === 'downstream_timeout') {
        const e = new Error('downstream_timeout');
        e.code = 'DOWNSTREAM_TIMEOUT';
        throw e;
      }
      throw err; // let outer catch handle response
    }

    const payload = {
      id: Math.floor(Math.random() * 1000000),
      name: 'api-service-data',
      downstream,
      serverTime: new Date().toISOString()
    };

    logger.info({
      message: 'Served /data',
      requestId,
      metadata: { route: '/data', durationMs: Date.now() - start }
    });

    res.json(payload);
  } catch (err) {
    // If downstream throws, map certain errors to specific status codes
    logger.warn({ message: 'Downstream call failed', requestId, metadata: { err: { message: err.message } } });
    if (err && err.code === 'DOWNSTREAM_TIMEOUT') {
      return res.status(504).json({ error: 'gateway_timeout', detail: err.message, requestId });
    }
    if (err && err.code === 'DOWNSTREAM_FAIL') {
      return res.status(502).json({ error: 'bad_gateway', detail: err.message, requestId });
    }
    // Generic fallback
    res.status(502).json({ error: 'bad_gateway', detail: err.message, requestId });
  }
});

module.exports = router;
