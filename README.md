# SRE Observability Demo

This repository contains two Node.js services designed for observability testing and failure simulation:

- `api-service` (port 3000 by default)
- `worker-service` (port 4000 by default)

Both services:
- Use `pino` for structured JSON logging with keys `timestamp`, `level`, `service`, `message`, and `metadata`.
- Expose Prometheus metrics at `/metrics` via `prom-client`.
- Are Dockerized with `node:18-alpine` and run as non-root `node` user.

Quick start (build + run):

# Build images
```bash
docker build -t api-service:latest -f api-service/Dockerfile ./api-service
docker build -t worker-service:latest -f worker-service/Dockerfile ./worker-service
```

# Run services (example)
```bash
# API service
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e ERROR_RATE=0.05 \
  -e LATENCY_MS=2000 \
  -e DEPENDENCY_FAIL_RATE=0.03 \
  -e DOWNSTREAM_TIMEOUT_MS=1200 \
  --name api-service api-service:latest

# Worker service
docker run --rm -p 4000:4000 \
  -e PORT=4000 \
  -e JOB_FAILURE_RATE=0.1 \
  -e PROCESS_LATENCY_MS=1000 \
  -e MEMORY_LEAK_ENABLED=false \
  --name worker-service worker-service:latest
```

Smoke tests:
```bash
# API health
curl -s http://localhost:3000/health | jq
# API data
curl -s http://localhost:3000/data | jq
# API metrics
curl -s http://localhost:3000/metrics | head -n 40

# Worker health
curl -s http://localhost:4000/health | jq
# Worker metrics
curl -s http://localhost:4000/metrics | head -n 40
```

Notes and recommendations:
- The log format is configured to expose `message` and `timestamp` keys. Use a log ingestion pipeline that parses `metadata` for rich fields like `requestId`.
- Tweak environment variables in each service's `.env.example` to simulate different failure modes.
- Add Kubernetes manifests and readiness/liveness probes when deploying to a cluster.

Files of interest:
- api-service/src — API implementation, routes, middleware, metrics, and circuit breaker
- worker-service/src — worker loop, in-memory queue, metrics

Enjoy testing observability pipelines with these services.
