const { v4: uuidv4 } = require('uuid');
const { queryInstant } = require('../prometheus');

const QUERY = 'histogram_quantile(0.95, sum(rate(api_service_http_request_duration_seconds_bucket[5m])) by (le))';

const WARNING_THRESHOLD  = parseFloat(process.env.LATENCY_P95_THRESHOLD_S || '2.0');
const CRITICAL_THRESHOLD = 5.0;

const rule = {
  name: 'api_p95_latency_high',

  async evaluate(prometheusBaseUrl) {
    const p95 = await queryInstant(prometheusBaseUrl, QUERY);

    if (p95 === null) {
      return null;
    }

    if (p95 <= WARNING_THRESHOLD) {
      return null;
    }

    const severity = p95 > CRITICAL_THRESHOLD ? 'critical' : 'warning';
    const threshold = severity === 'critical' ? CRITICAL_THRESHOLD : WARNING_THRESHOLD;

    return {
      id: uuidv4(),
      service: 'api-service',
      signal_type: 'high_latency',
      severity,
      rule_name: rule.name,
      evidence: {
        metric: 'api_service_http_request_duration_seconds',
        value: p95,
        threshold,
        query: QUERY
      },
      timestamps: {
        detected_at: new Date().toISOString(),
        evaluation_window: '5m'
      }
    };
  }
};

module.exports = rule;
