const client = require('prom-client');
const register = new client.Registry();

const prefix = (process.env.METRICS_PREFIX || 'worker_service') + '_';

client.collectDefaultMetrics({ register });

const jobsProcessed = new client.Counter({
  name: prefix + 'jobs_processed_total',
  help: 'Total jobs successfully processed',
  labelNames: ['worker']
});

const jobsFailed = new client.Counter({
  name: prefix + 'jobs_failed_total',
  help: 'Total jobs that failed after retries',
  labelNames: ['worker']
});

const jobDuration = new client.Histogram({
  name: prefix + 'job_processing_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['worker'],
  // Buckets span very short jobs up to long-running jobs (5ms -> 60s)
  buckets: [0.005, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60]
});

const memoryUsageGauge = new client.Gauge({
  name: prefix + 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['worker']
});



register.registerMetric(jobsProcessed);
register.registerMetric(jobsFailed);
register.registerMetric(jobDuration);
register.registerMetric(memoryUsageGauge);

module.exports = { client, register, jobsProcessed, jobsFailed, jobDuration, memoryUsageGauge };
