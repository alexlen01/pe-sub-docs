# PE Sub Platform Logging and Audit Design

## 1. Purpose and decisions

The platform maintains two complementary records:

- **Business audit trail** — durable, append-only PostgreSQL events answering who changed or exported business data, what changed, for which facility/submission, when, and why. Audit events are transactional business records and are not replaced by application logs.
- **Operational observability** — structured JSON application logs answering which request, extraction stage, dependency, or background operation failed and how long it took. These logs are optimized for local files today and CloudWatch/Datadog/Azure Monitor later.

This separation avoids routing complexity for the current 10–15 user team while preserving a stable event contract. Logging must never become a second copy of the LP Master or uploaded workbook.

## 2. Security and data-classification rules

Operational logs **must not contain** raw workbook rows/cells, LP or investor names, account numbers, tokens, cookies, request/response bodies, alias configuration payloads, or stack traces containing file content. Log identifiers, counts, hashes, column names, types, thresholds, durations, and aggregate variances instead. Filenames are sanitized to the base name and should be treated as confidential metadata.

Audit events may contain old/new business values only for approved mutable configuration and financial overrides. Secrets and full file contents are forbidden everywhere. Exceptions are logged with type and safe message; stack traces remain ERROR-only. Access to logs follows least privilege. Production audit retention is seven years; operational retention starts at 30 days/2 GB per service and is reviewed after volume is measured.

File integrity uses SHA-256. Hashes support traceability but are not secrets or substitutes for malware scanning.

## 3. Canonical operational event envelope

Every JSON line contains the logger-provided `timestamp`, `level`, `service`, `component`, `message`, and these MDC fields when known:

| Field | Meaning |
|---|---|
| `correlation_id` | End-to-end request/file journey; accepted from `X-Correlation-Id` or generated as a UUID |
| `session_id` | Optional UI session/workflow identifier from `X-Session-Id`; not an auth session token |
| `user_id` | Stable authenticated principal; `system` for unattended work |
| `user_role` | Comma-separated effective roles |
| `tenant_id` | Optional tenant boundary; reserved until tenancy is implemented |
| `fund_id` / `facility_id` | Business scope when known |
| `submission_id` | Upload/workflow scope when known |
| `event_type` | Stable dotted event name, e.g. `extraction.completed` |
| `duration_ms` | Elapsed operation time where applicable |
| `outcome` | `started`, `succeeded`, `rejected`, `failed`, or `overridden` |

The API returns the correlation ID in `X-Correlation-Id` and sends it to pe-sub-extraction. Legacy `X-Transaction-Id` is accepted during migration and mirrored in the response.

## 4. Event catalog and severity

| Stage | Required operational events | Level |
|---|---|---|
| Upload | `upload.received`, `upload.accepted`, `upload.rejected`; base filename, SHA-256, bytes, extension, submission/facility IDs | INFO; rejected input WARN; storage failure ERROR |
| Template/extraction | `template.matched`/`template.unmatched`, `extraction.completed`, `extraction.failed`; sheet count, row count, mapped/unmapped header counts, parser type, duration | INFO; mapping anomaly WARN; parser failure ERROR |
| Match queue | `match.auto_decided`, `match.review_required`; record IDs, confidence, configured threshold and rule identifiers | INFO/WARN |
| Human matching | `match.approved`, `match.rejected`, `dictionary.alias_linked`; actor, target IDs, before/after decision, reason | WARN operational plus durable audit |
| Shadow BB | `shadow_bb.completed`, `shadow_bb.variance`, `shadow_bb.overridden`; aggregate inputs, outputs, thresholds, variance and approval reason | INFO/WARN plus durable audit for override |
| Settlement | `lp_master.committed`; inserted/updated/transaction counts and activation timestamp | INFO plus durable audit |
| Admin/export | `config.changed`, `template.changed`, `dictionary.changed`, `report.exported`; object IDs, old/new values where approved, filters, format, row count | INFO/WARN plus durable audit |

Do not use WARN for normal retryable flow merely to attract attention. ERROR means an operation failed and normally includes `error_type`, safe `error_message`, and whether retry is possible.

## 5. Audit event contract

Audit rows are append-only and include stable event type, actor ID/display name and role, facility/fund/submission scope, correlation ID, server timestamp, source IP, outcome, reason for overrides, and structured details. Configuration changes record old and new values. Data changes record entity IDs and changed field names; bulk changes use counts and a batch identifier rather than one row per cell.

Audit writes for successful business mutations occur in the same database transaction as the mutation. Failed attempts that matter for security are written independently after rollback. Application roles cannot update/delete audit rows. Facility deletion detaches the foreign key but retains history.

## 6. Pipeline requirements

1. API request middleware validates correlation/session header length and characters, establishes MDC, and clears it in `finally` to prevent virtual-thread reuse leakage.
2. Authenticated identity and roles are added after authentication and before controller/service logs.
3. Outbound extraction calls forward correlation, session, user, role, tenant, facility, and submission context. The extraction service treats identity headers as trusted only on its internal network.
4. Async/background executors copy the MDC map at task submission and restore/clear it around execution. Scheduled work creates a fresh correlation ID and uses `user_id=system`.
5. Metrics should eventually be derived from stable event types, but high-cardinality IDs and filenames must never become metric labels.

## 7. Failure handling and validation

Logging failure must not fail the business operation, except a required durable audit write: if the audit record cannot commit with a regulated mutation, the mutation fails atomically. JSON schema smoke tests verify required envelope keys and valid one-line JSON. Integration tests verify header generation/echo, propagation to extraction, MDC cleanup, redaction, actor attribution, old/new audit values, and audit preservation.

## 8. Rollout

- Phase 1: JSON encoders, correlation middleware/propagation, request and extraction summary events.
- Phase 2: migrate existing free-text audit details to structured JSON columns and stable event types; add old/new values for configuration, dictionary, template, override, settlement, and export events.
- Phase 3: add MDC task decoration for every asynchronous executor, dashboards/alerts, immutable audit archive, retention jobs, and schema/version governance.

Acceptance criteria: one correlation ID follows upload through extraction; every material mutation/export has one attributable audit event; an operator can diagnose a failed extraction without workbook content in logs; and all JSON lines are parseable by a standard log viewer.
