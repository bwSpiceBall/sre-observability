/**
 * Simulated downstream dependency.
 * This function simulates latency and failures according to environment variables.
 */

const logger = require('../logger');
const metrics = require('../metrics');

const ERROR_RATE = parseFloat(process.env.DEPENDENCY_FAIL_RATE || '0.0');
const LATENCY_MS = parseInt(process.env.LATENCY_MS || '0', 10);
const LATENCY_JITTER_MS = parseInt(process.env.LATENCY_JITTER_MS || '0', 10);
const DOWNSTREAM_TIMEOUT_MS = parseInt(process.env.DOWNSTREAM_TIMEOUT_MS || '0', 10);
// Probability that a downstream call will hang/timeout (0.0 - 1.0)
const DOWNSTREAM_TIMEOUT_PROB = parseFloat(process.env.DOWNSTREAM_TIMEOUT_PROB || '0.0');
// Small chance of transient throttling (429)
const DOWNSTREAM_THROTTLE_PROB = parseFloat(process.env.DOWNSTREAM_THROTTLE_PROB || '0.0');

// We will optionally simulate timeouts by not resolving the promise before timeout

async function simulateDownstream(requestId) {
  // startTimer returns a function to observe the duration; use 'status' label to classify outcome
  const end = metrics.downstreamRequestDuration.startTimer({ dependency: 'simulated', result: 'unknown' });
  // Random latency if LATENCY_MS is set (used to simulate service slowness)
  if (LATENCY_MS > 0) {
    // Randomly decide whether to apply the latency spike (50% of the time when set)
    if (Math.random() < 0.5) {
      const jitter = LATENCY_JITTER_MS > 0 ? (Math.random() * LATENCY_JITTER_MS - LATENCY_JITTER_MS / 2) : 0;
      const actual = Math.max(0, LATENCY_MS + Math.round(jitter));
      logger.debug({ message: 'Applying downstream latency spike', requestId, metadata: { latency: actual } });
      await new Promise((res) => setTimeout(res, actual));
    }
  }

  // Random failure
  if (Math.random() < ERROR_RATE) {
    logger.warn({ message: 'Simulated downstream failure', requestId });
    end({ dependency: 'simulated', result: 'failure' });
    metrics.downstreamRequestCount.inc({ dependency: 'simulated', result: 'failure' });
    const err = new Error('downstream_failure');
    err.code = 'DOWNSTREAM_FAIL';
    throw err;
  }

  // Random transient throttle (429)
  if (Math.random() < DOWNSTREAM_THROTTLE_PROB) {
    logger.warn({ message: 'Simulated downstream throttle (429)', requestId });
    end({ dependency: 'simulated', result: 'throttle' });
    metrics.downstreamRequestCount.inc({ dependency: 'simulated', result: 'throttle' });
    const err = new Error('downstream_throttle');
    err.code = 'DOWNSTREAM_THROTTLE';
    throw err;
  }

  // Simulate downstream timeout: if DOWNSTREAM_TIMEOUT_MS is set, randomly decide to hang
  if (DOWNSTREAM_TIMEOUT_MS > 0 && DOWNSTREAM_TIMEOUT_PROB > 0) {
    if (Math.random() < DOWNSTREAM_TIMEOUT_PROB) {
      logger.warn({ message: 'Simulating downstream timeout (will hang)', requestId, metadata: { timeoutMs: DOWNSTREAM_TIMEOUT_MS } });
      // Record that we attempted
      metrics.downstreamRequestCount.inc({ dependency: 'simulated', result: 'timeout' });
      // Return a promise that resolves after a period longer than the configured timeout
      return new Promise((res) => setTimeout(res, DOWNSTREAM_TIMEOUT_MS + 5000));
    }
  }

  // Otherwise return some realistic payload
  return {
    id: Math.floor(Math.random() * 100000),
    value: 'Hello from downstream',
    timestamp: new Date().toISOString()
  };
}

module.exports = { simulateDownstream };
