const { validate } = require('./incident');
const rules        = require('./rules');
const metrics      = require('./metrics');
const logger       = require('./logger');

class Detector {
  constructor({ prometheusUrl, bus, evalIntervalMs, cooldownMs }) {
    this._prometheusUrl  = prometheusUrl;
    this._bus            = bus;
    this._evalIntervalMs = evalIntervalMs;
    this._cooldownMs     = cooldownMs;
    this._cooldowns      = new Map();
    this._timer          = null;
  }

  start() {
    logger.info({
      message: 'Detector starting',
      metadata: { evalIntervalMs: this._evalIntervalMs, cooldownMs: this._cooldownMs }
    });

    this._runCycle().catch((err) => {
      logger.error({ message: 'Unhandled error in initial cycle', metadata: { err: err.message } });
    });

    this._timer = setInterval(() => {
      this._runCycle().catch((err) => {
        logger.error({ message: 'Unhandled error in cycle', metadata: { err: err.message } });
      });
    }, this._evalIntervalMs);

    this._timer.unref();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    logger.info({ message: 'Detector stopped' });
  }

  async _runCycle() {
    for (const rule of rules) {
      await this._evaluateRule(rule);
    }
  }

  async _evaluateRule(rule) {
    const endTimer = metrics.ruleEvaluationDuration.startTimer({ rule: rule.name });

    try {
      const incident = await rule.evaluate(this._prometheusUrl);
      endTimer();

      if (incident === null) {
        metrics.ruleEvaluationsTotal.inc({ rule: rule.name, result: 'clear' });
        logger.debug({ message: 'Rule clear', metadata: { rule: rule.name } });
        return;
      }

      const lastFired = this._cooldowns.get(rule.name);
      if (lastFired && (Date.now() - lastFired) < this._cooldownMs) {
        const remainingMs = this._cooldownMs - (Date.now() - lastFired);
        logger.debug({
          message: 'Rule in cooldown, skipping emit',
          metadata: { rule: rule.name, remainingMs }
        });
        metrics.ruleEvaluationsTotal.inc({ rule: rule.name, result: 'fired' });
        return;
      }

      validate(incident);

      const entryId = await this._bus.publish(incident);
      this._cooldowns.set(rule.name, Date.now());

      metrics.ruleEvaluationsTotal.inc({ rule: rule.name, result: 'fired' });
      metrics.incidentsEmittedTotal.inc({ rule: rule.name, severity: incident.severity });

      logger.info({
        message: 'Incident emitted',
        metadata: {
          rule:          rule.name,
          severity:      incident.severity,
          streamEntryId: entryId,
          incidentId:    incident.id
        }
      });

    } catch (err) {
      endTimer();
      metrics.ruleEvaluationsTotal.inc({ rule: rule.name, result: 'error' });
      logger.error({
        message: 'Rule evaluation error',
        metadata: { rule: rule.name, err: err.message }
      });
    }
  }
}

module.exports = Detector;
