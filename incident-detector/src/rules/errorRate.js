const { v4: uuidv4 } = require('uuid');
const { queryInstant } = require('../prometheus');

const QUERY_ERRORS   = 'sum(rate(api_service_http_errors_total[1m]))';
const QUERY_REQUESTS = 'sum(rate(api_service_http_requests_total[1m]))';

const WARNING_THRESHOLD  = parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05');
const CRITICAL_THRESHOLD = 0.25;

const rule = {
  name: 'api_error_rate_spike',

  async evaluate(prometheusBaseUrl) {
    const [errors, requests] = await Promise.all([
      queryInstant(prometheusBaseUrl, QUERY_ERRORS),
      queryInstant(prometheusBaseUrl, QUERY_REQUESTS)
    ]);

    if (errors === null || requests === null || requests === 0) {
      return null;
    }

    const rate = errors / requests;

    if (rate <= WARNING_THRESHOLD) {
      return null;
    }

    const severity = rate > CRITICAL_THRESHOLD ? 'critical' : 'warning';
    const threshold = severity === 'critical' ? CRITICAL_THRESHOLD : WARNING_THRESHOLD;

    return {
      id: uuidv4(),
      service: 'api-service',
      signal_type: 'error_rate_spike',
      severity,
      rule_name: rule.name,
      evidence: {
        metric: 'api_service_http_errors_total',
        value: rate,
        threshold,
        query: `${QUERY_ERRORS} / ${QUERY_REQUESTS}`
      },
      timestamps: {
        detected_at: new Date().toISOString(),
        evaluation_window: '1m'
      }
    };
  }
};

module.exports = rule;
