---
name: sre-observability-platform
description: "Use when building or extending a self-hosted observability platform with logging, Grafana dashboards, incident detection, AI diagnosis, GitHub Actions automation, rollback hooks, hotfix branches, and audit logging. Best for Node.js and Kubernetes services focused on production issue triage and remediation."
argument-hint: "what part of the observability platform to build or extend"
user-invocable: true
disable-model-invocation: false
---

# SRE Observability Platform Workflow

## What This Skill Produces

This skill helps build the non-core platform plumbing for a self-hosted production-issue platform. It focuses on defaults, integration scaffolding, validation, and operational guardrails so the user can spend time on the parts they want to showcase.

## Use When

- Adding logging, metrics, dashboards, alerts, or traces
- Wiring incident detection, event buses, or structured incident objects
- Connecting incidents to an AI diagnosis service
- Building GitHub Actions, rollback hooks, hotfix branch automation, or audit logs
- Extending the existing api-service, worker-service, or k8s manifests

## Defaults to Assume Unless the User Says Otherwise

- Runtime: Node.js 18
- Logging: structured JSON logs with pino
- Metrics: Prometheus format at /metrics via prom-client
- Dashboarding: Grafana
- Log storage: Loki first, ELK only if explicitly needed
- Event bus: Redis Streams or a small Redis-backed queue before Kafka
- Kubernetes: keep manifests under k8s/
- Deployment style: containerized, non-root, minimal base image
- Automation: GitHub Actions for CI/CD and remediation hooks

## What the Assistant Should Do Without Asking

1. Inspect the repo for the nearest existing boundary before editing.
2. Keep changes localized to the platform layer, not the showcase logic.
3. Prefer deterministic configuration over hidden behavior.
4. Define structured contracts early:
   - incident objects
   - diagnosis responses
   - remediation events
   - audit records
5. Add validation paths for every new integration.
6. Update docs only when they explain an operational contract or setup step.

## Build Order

1. Observability foundation
   - Ensure each service emits consistent structured logs.
   - Confirm metrics names, labels, and scrape paths are stable.
   - Add dashboard-friendly metadata such as request ID, service name, latency, and error class.
   - Validate that logs and metrics can be scraped or ingested end to end.

2. Incident detection
   - Build rule-based detection before any AI layer.
   - Keep rules explicit and testable for:
     - error-rate spikes
     - latency regressions
     - memory growth
   - Emit a structured incident object that includes service, signal type, severity, evidence, timestamps, and rule name.
   - Send incidents to the event bus instead of coupling detection to downstream actions.

3. AI diagnosis
   - Pull only the context needed for the incident type.
   - Use a structured prompt, not freeform chat.
   - Require structured JSON output with:
     - likely_causes
     - confidence
     - recommended_actions
   - Validate the output against a schema before use.
   - Keep the diagnosis service isolated from remediation decisions.

4. CI/CD automation
   - Use GitHub Actions as the default automation surface.
   - Trigger rollback only from validated incident signals.
   - Prefer opening a PR or hotfix branch over direct mutation unless the user explicitly wants auto-remediation.
   - Record every automated action in audit logs with actor, reason, target, and timestamp.

## Decision Rules

- Do not ask the user about implementation details that have safe defaults.
- Ask only when the choice changes the product direction, such as:
  - Loki vs ELK
  - Redis vs Kafka
  - manual approval vs automatic remediation
- If a choice does not affect the showcase value, pick the simplest production-shaped default and keep moving.
- If the repo already has code that satisfies a contract, extend it rather than replace it.

## Completion Checks

- Logs are structured, searchable, and correlated with a request or incident ID.
- Metrics can be scraped from each service and rendered in a dashboard.
- Rules emit a repeatable incident object for the target failure mode.
- The AI layer returns schema-valid JSON only.
- Automated actions are visible in GitHub Actions and audit logs.
- No step depends on freeform operator input unless a human approval gate is intentionally part of the design.

## Working Style

- Preserve the existing service split between api-service and worker-service.
- Keep platform code boring, explicit, and easy to test.
- Favor small, composable modules over one large orchestration file.
- Treat observability and automation wiring as infrastructure, not the product differentiator.