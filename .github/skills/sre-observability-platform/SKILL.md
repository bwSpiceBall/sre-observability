---
name: sre-observability-platform
description: "Use when building or extending the Autonomous DevOps Reliability (ADR) platform: observability stack, incident detection, AI diagnosis, CI/CD automation, frontend dashboard, and optional autonomous remediation. Best for Node.js and Kubernetes services focused on production issue triage and remediation."
argument-hint: "what part of the ADR platform to build or extend"
user-invocable: true
disable-model-invocation: false
---

# Autonomous DevOps Reliability (ADR) Platform — Skill

## What This Skill Produces

A self-hosted platform that monitors, diagnoses, and proposes fixes for production issues using observability data, AI reasoning, and CI/CD hooks — with optional auto-remediation. The skill builds non-core platform plumbing: scaffolding, integration wiring, validation, and operational guardrails, so the user can focus on the parts that showcase their platform engineering.

## Use When

- Adding logging, metrics, dashboards, alerts, or traces
- Deploying or configuring Loki, Prometheus, or Grafana
- Wiring incident detection, event buses, or structured incident objects
- Connecting incidents to an AI diagnosis service
- Building GitHub Actions workflows, rollback hooks, hotfix branch automation, or audit logs
- Adding a frontend dashboard (incident feed, diagnosis output, audit log)
- Extending api-service, worker-service, incident-detector, or k8s manifests
- Adding optional upgrades: autonomous mode, policy engine, chaos engineering, Slack/Discord bot

## Defaults to Assume Unless the User Says Otherwise

- Runtime: Node.js 22 (LTS)
- Logging: structured JSON with pino; keys: `timestamp`, `level`, `service`, `message`, `metadata`
- Metrics: Prometheus format at `/metrics` via prom-client
- Log aggregation: Loki + Promtail (ELK only if explicitly requested)
- Dashboarding: Grafana (pre-wire Prometheus and Loki as datasources)
- Event bus: Redis Streams before Kafka
- Kubernetes: manifests under `k8s/`; Helm charts when the user asks for packaging
- Deployment style: containerized, non-root (`node` user), `node:22-alpine` base
- AI layer: Claude API (structured prompting + tool calling); OpenAI as fallback if user specifies
- Automation: GitHub Actions for CI/CD and remediation hooks
- Frontend: lightweight — a single Node.js or static-file server is fine before adding a React app

## Failure Simulations (target app capabilities)

The api-service and worker-service already support these via env vars. When extending them:
- Latency spikes: `LATENCY_MS`, `LATENCY_JITTER_MS`
- Random failures: `ERROR_RATE`, `DEPENDENCY_FAIL_RATE`
- Resource leaks: `MEMORY_LEAK_ENABLED` on worker-service
- Bad deploys: simulate by deploying a broken image tag or setting `ERROR_RATE=1.0` via `kubectl set env`
- Circuit breaker behaviour: `CB_FAILURE_THRESHOLD`, `CB_RESET_TIMEOUT_MS`

## What the Assistant Should Do Without Asking

1. Inspect the repo for the nearest existing boundary before editing.
2. Keep changes localized to the platform layer, not the showcase logic.
3. Prefer deterministic configuration over hidden behaviour.
4. Define structured contracts early and keep them stable:
   - incident objects: `{ id, service, signal_type, severity, rule_name, evidence, timestamps }`
   - diagnosis responses: `{ likely_causes, confidence, recommended_actions }`
   - remediation events: `{ actor, action, target, reason, timestamp }`
   - audit records: `{ actor, action, target, reason, outcome, timestamp }`
5. Add validation paths for every new integration.
6. Update docs only when they explain an operational contract or setup step.

## Build Order

### 1. Observability foundation ✅
- Structured JSON logs from all services, correlated with request/incident ID.
- Stable metric names, labels, and scrape paths on each service.
- Prometheus scraping all services; Grafana connected to Prometheus.
- **Remaining:** Deploy Loki + Promtail so logs are queryable in Grafana alongside metrics.

### 2. Incident detection ✅
- Rule-based detection (no AI) for error-rate spikes, latency regressions, memory growth.
- Structured incident object emitted on rule trigger; validated against schema.
- Redis Streams as the event bus (`incidents` stream, XADD with MAXLEN).
- Per-rule cooldown (5 min default) to suppress repeated alerts.

### 3. AI diagnosis engine
- Read incidents from the Redis Stream (XREAD consumer group).
- Pull relevant log lines from Loki and recent metric values from Prometheus as context.
- Build a structured prompt — not freeform chat. Include: service name, signal type, severity, evidence value, recent logs, recent metric trend.
- Call the AI API with structured output / tool calling enforced.
- Require and validate JSON output schema:
  ```json
  {
    "likely_causes": ["string"],
    "confidence": 0.0,
    "recommended_actions": ["string"]
  }
  ```
- Publish diagnosis result back to Redis (e.g. `diagnoses` stream) keyed to the incident ID.
- Keep diagnosis service isolated — it reads and writes, it does not trigger remediation directly.

### 4. CI/CD automation
- GitHub Actions workflow triggered by validated incident+diagnosis pairs.
- Prefer opening a PR or hotfix branch over direct cluster mutation unless the user explicitly enables auto-remediation.
- Rollback trigger: `kubectl rollout undo` or deploy previous image tag via workflow.
- Hotfix branch: create branch, commit a patch suggestion derived from `recommended_actions`, open PR.
- Audit log: append a record `{ actor, action, target, reason, outcome, timestamp }` to a persistent store (file, Redis list, or external service) for every automated action.

### 5. Frontend dashboard
- Incident feed: list of incidents from Redis Stream, newest first, filterable by severity and service.
- AI diagnosis output panel: show `likely_causes`, `confidence`, `recommended_actions` for each incident.
- Audit log view: chronological list of all automated actions with actor and outcome.
- Keep it lightweight — a Node.js Express server rendering JSON or a simple HTML/JS static page is fine before adding a full React app.
- Expose on a new NodePort (next after 30082).

## Optional Upgrades (implement when user asks)

- **Autonomous mode:** auto-rollback deployments, auto-scale pods, auto-restart services — gate behind a policy engine with approval thresholds before enabling.
- **Policy engine:** configurable guardrails (e.g. never auto-remediate in business hours without approval, max one rollback per hour).
- **Chaos engineering:** inject outages on demand via env var changes or a chaos endpoint; document the expected incident detection latency.
- **Slack / Discord bot:** post incident alerts and diagnosis summaries to a channel; allow `approve` / `reject` reactions to gate automated actions.
- **Blameless postmortem generator:** use the AI layer to produce a structured postmortem from the incident timeline, diagnosis, and remediation audit log.
- **Multi-cluster support:** namespace-scope each component; add a cluster label to all metrics and incident objects.
- **Cost tracking per incident:** record pod uptime and resource usage during an incident window; estimate cost impact.
- **Helm charts:** package each service as a Helm chart when the user wants reproducible installs beyond kubectl apply.

## Decision Rules

- Do not ask the user about implementation details that have safe defaults.
- Ask only when the choice changes product direction:
  - Loki vs ELK
  - Redis vs Kafka
  - Claude API vs OpenAI
  - Manual approval vs automatic remediation
  - Lightweight frontend vs full React app
- If a choice does not affect the showcase value, pick the simplest production-shaped default and keep moving.
- If the repo already has code that satisfies a contract, extend it rather than replace it.

## Completion Checks

- Logs are structured, searchable in Grafana/Loki, and correlated with a request or incident ID.
- Metrics are scraped from all services and renderable in Grafana dashboards.
- Rules emit a repeatable, schema-valid incident object for each target failure mode.
- The AI layer returns schema-valid JSON only; invalid output is rejected and logged.
- Automated actions are visible in GitHub Actions runs and in the audit log.
- The frontend shows a live incident feed, diagnosis output, and audit history.
- No step depends on freeform operator input unless a human approval gate is intentionally part of the design.

## Working Style

- Preserve the service split: api-service, worker-service, incident-detector, ai-diagnosis, and any new services each own their domain.
- Keep platform code boring, explicit, and easy to test.
- Favour small, composable modules over one large orchestration file.
- Treat observability and automation wiring as infrastructure, not the product differentiator.
- Each new service must have: `/health`, `/metrics`, structured pino logging, graceful shutdown, and a k8s manifest with probes and resource limits.
