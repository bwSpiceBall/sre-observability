/**
 * Simple in-memory circuit breaker
 * - Opens after N consecutive failures
 * - Stays open for resetTimeout ms
 * - Allows a single trial request (half-open) after timeout
 *
 * This is lightweight and not distributed. Suitable for demo/testing.
 */

const logger = require('../logger');
const metrics = require('../metrics');

const FAILURE_THRESHOLD = parseInt(process.env.CB_FAILURE_THRESHOLD || '5', 10);
const RESET_TIMEOUT_MS = parseInt(process.env.CB_RESET_TIMEOUT_MS || '10000', 10);

class CircuitBreaker {
  constructor(name) {
    this.name = name;
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextRetry = 0;
    this.trialInProgress = false; // for HALF_OPEN single-trial enforcement
  }

  recordSuccess() {
    this.failures = 0;
    if (this.state !== 'CLOSED') {
      logger.info({ message: 'Circuit closed after success', metadata: { circuit: this.name } });
      try { metrics.circuitClosed.inc({ circuit: this.name }); } catch (e) {}
    }
    this.state = 'CLOSED';
    this.trialInProgress = false;
  }

  recordFailure() {
    this.failures += 1;
    logger.debug({ message: 'Circuit failure increment', metadata: { circuit: this.name, failures: this.failures } });
    if (this.failures >= FAILURE_THRESHOLD && this.state === 'CLOSED') {
      this.open();
    }
  }

  open() {
    this.state = 'OPEN';
    this.nextRetry = Date.now() + RESET_TIMEOUT_MS;
    logger.warn({ message: 'Circuit opened', metadata: { circuit: this.name, nextRetry: this.nextRetry } });
    try { metrics.circuitOpened.inc({ circuit: this.name }); } catch (e) {}
  }

  allowRequest() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextRetry) {
        // move to half-open and allow a trial
        this.state = 'HALF_OPEN';
        this.trialInProgress = false;
        logger.info({ message: 'Circuit half-open, allowing trial', metadata: { circuit: this.name } });
        try { metrics.circuitHalfOpen.inc({ circuit: this.name }); } catch (e) {}
        // allow one trial only
        this.trialInProgress = true;
        return true;
      }
      return false;
    }
    // HALF_OPEN - allow a single trial only; if trial already in progress, disallow
    if (!this.trialInProgress) {
      this.trialInProgress = true;
      return true;
    }
    return false;
  }

  getStateValue() {
    if (this.state === 'CLOSED') return 0;
    if (this.state === 'HALF_OPEN') return 1;
    if (this.state === 'OPEN') return 2;
    return 0;
  }
}

const breakers = {};

function getCircuit(name) {
  if (!breakers[name]) breakers[name] = new CircuitBreaker(name);
  return breakers[name];
}

function listCircuits() {
  return Object.keys(breakers).map((k) => ({ name: k, state: breakers[k].state, value: breakers[k].getStateValue() }));
}

module.exports = { getCircuit, listCircuits };
