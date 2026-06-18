const { v4: uuidv4 } = require('uuid');
const { queryInstant } = require('../prometheus');

const QUERY = 'max(worker_service_memory_usage_bytes)';

const WARNING_THRESHOLD  = parseFloat(process.env.MEMORY_THRESHOLD_BYTES || '209715200'); // 200 MB
const CRITICAL_THRESHOLD = 419430400; // 400 MB

const rule = {
  name: 'worker_memory_pressure',

  async evaluate(prometheusBaseUrl) {
    const bytes = await queryInstant(prometheusBaseUrl, QUERY);

    if (bytes === null) {
      return null;
    }

    if (bytes <= WARNING_THRESHOLD) {
      return null;
    }

    const severity = bytes > CRITICAL_THRESHOLD ? 'critical' : 'warning';
    const threshold = severity === 'critical' ? CRITICAL_THRESHOLD : WARNING_THRESHOLD;

    return {
      id: uuidv4(),
      service: 'worker-service',
      signal_type: 'memory_pressure',
      severity,
      rule_name: rule.name,
      evidence: {
        metric: 'worker_service_memory_usage_bytes',
        value: bytes,
        threshold,
        query: QUERY
      },
      timestamps: {
        detected_at: new Date().toISOString(),
        evaluation_window: 'instant'
      }
    };
  }
};

module.exports = rule;
