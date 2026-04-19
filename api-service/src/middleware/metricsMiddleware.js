const metrics = require('../metrics');

function metricsMiddleware(req, res, next) {
  const end = metrics.httpRequestDuration.startTimer();
  const route = req.route && req.route.path ? req.route.path : req.path || 'unknown';

  res.on('finish', () => {
    const status = String(res.statusCode);
    metrics.httpRequestCount.inc({ method: req.method, route, status });
    if (res.statusCode >= 500) {
      metrics.httpErrorCount.inc({ method: req.method, route, status });
    }
    end({ method: req.method, route, status });
  });

  next();
}

module.exports = metricsMiddleware;
