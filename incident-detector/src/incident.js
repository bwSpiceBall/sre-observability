const VALID_SEVERITIES   = new Set(['info', 'warning', 'critical']);
const VALID_SIGNAL_TYPES = new Set(['error_rate_spike', 'high_latency', 'memory_pressure']);

/**
 * Validates a candidate incident object.
 * Throws an Error describing the first violation found.
 * @param {object} incident
 */
function validate(incident) {
  const required = ['id', 'service', 'signal_type', 'severity', 'rule_name', 'evidence', 'timestamps'];
  for (const key of required) {
    if (incident[key] === undefined || incident[key] === null) {
      throw new Error(`Incident missing required field: ${key}`);
    }
  }

  if (!VALID_SEVERITIES.has(incident.severity)) {
    throw new Error(`Invalid severity: ${incident.severity}`);
  }

  if (!VALID_SIGNAL_TYPES.has(incident.signal_type)) {
    throw new Error(`Invalid signal_type: ${incident.signal_type}`);
  }

  if (typeof incident.evidence.value !== 'number') {
    throw new Error('evidence.value must be a number');
  }

  if (typeof incident.evidence.threshold !== 'number') {
    throw new Error('evidence.threshold must be a number');
  }

  if (!incident.timestamps.detected_at) {
    throw new Error('timestamps.detected_at is required');
  }
}

module.exports = { validate };
