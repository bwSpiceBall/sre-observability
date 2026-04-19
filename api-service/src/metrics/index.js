const client = require('prom-client');

const register = new client.Registry();

const prefix = (process.env.METRICS_PREFIX || 'api_service') + '_';

client.collectDefaultMetrics({ register });

// HTTP metrics
const httpRequestCount = new client.Counter({
  name: prefix + 'http_requests_total',
  help: 'Total number of HTTP requests',
  // status is HTTP response status code (e.g. 200, 404)
  labelNames: ['method', 'route', 'status']
});

const httpErrorCount = new client.Counter({
  name: prefix + 'http_errors_total',
  help: 'Total number of HTTP error responses',
  labelNames: ['method', 'route', 'status']
});

// Detailed buckets spanning 1ms up to 30s for HTTP request durations
const httpRequestDuration = new client.Histogram({
  name: prefix + 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]
});

// Downstream-specific metrics
// Track downstream (dependency) requests. Use 'dependency' and 'status' labels
// where status is a short result classification (e.g. success, error, timeout)
const downstreamRequestCount = new client.Counter({
  name: prefix + 'downstream_requests_total',
  help: 'Total number of downstream requests attempted',
  labelNames: ['dependency', 'status']
});

const downstreamRequestDuration = new client.Histogram({
  name: prefix + 'downstream_request_duration_seconds',
  help: 'Duration of downstream requests in seconds',
  labelNames: ['dependency', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]
});

const downstreamTimeouts = new client.Counter({
  name: prefix + 'downstream_timeouts_total',
  help: 'Total number of downstream timeouts',
  labelNames: ['dependency']
});

// Circuit breaker gauge: 0=closed,1=half-open,2=open
const circuitStateGauge = new client.Gauge({
  name: prefix + 'circuit_state',
  help: 'Circuit breaker state (0=closed,1=half-open,2=open)',
  labelNames: ['circuit']
});

// Circuit events counters
const circuitOpened = new client.Counter({
  name: prefix + 'circuit_opened_total',
  help: 'Total number of times a circuit opened',
  labelNames: ['circuit']
});

const circuitClosed = new client.Counter({
  name: prefix + 'circuit_closed_total',
  help: 'Total number of times a circuit closed',
  labelNames: ['circuit']
});

const circuitHalfOpen = new client.Counter({
  name: prefix + 'circuit_half_open_total',
  help: 'Total number of times a circuit transitioned to half-open',
  labelNames: ['circuit']
});

register.registerMetric(httpRequestCount);
register.registerMetric(httpErrorCount);
register.registerMetric(httpRequestDuration);
register.registerMetric(downstreamRequestCount);
register.registerMetric(downstreamRequestDuration);
register.registerMetric(downstreamTimeouts);
register.registerMetric(circuitStateGauge);
register.registerMetric(circuitOpened);
register.registerMetric(circuitClosed);
register.registerMetric(circuitHalfOpen);

module.exports = {
  client,
  register,
  httpRequestCount,
  httpErrorCount,
  httpRequestDuration,
  downstreamRequestCount,
  downstreamRequestDuration,
  downstreamTimeouts,
  circuitStateGauge
  ,circuitOpened
  ,circuitClosed
  ,circuitHalfOpen
};
