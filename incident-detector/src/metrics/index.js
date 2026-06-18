const client = require('prom-client');

const register = new client.Registry();
const prefix = 'incident_detector_';

client.collectDefaultMetrics({ register });

const ruleEvaluationsTotal = new client.Counter({
  name: prefix + 'rule_evaluations_total',
  help: 'Total rule evaluations',
  labelNames: ['rule', 'result'],
  registers: [register]
});

const incidentsEmittedTotal = new client.Counter({
  name: prefix + 'incidents_emitted_total',
  help: 'Total incidents emitted to the event bus',
  labelNames: ['rule', 'severity'],
  registers: [register]
});

const ruleEvaluationDuration = new client.Histogram({
  name: prefix + 'rule_evaluation_duration_seconds',
  help: 'Time spent evaluating each rule',
  labelNames: ['rule'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

module.exports = {
  client,
  register,
  ruleEvaluationsTotal,
  incidentsEmittedTotal,
  ruleEvaluationDuration
};
