# Identity and Role-Based Access Control — PE Sub Platform

## Purpose and scope

This is the authoritative identity and authorization specification for the regulated PE Sub Lending application deployed on UBS-hosted Azure.

User onboarding, access requests, entitlement reviews, and user-role assignment are outside the application. They are governed through AACM, Security Principal registration, UBS Intra ID (Microsoft Entra ID), and MAC entitlement governance. The application must never provide user-management screens, maintain a user directory, or persist user-role assignments locally. Storing a stable external user identifier for workflow ownership or audit evidence is permitted because it records business activity, not entitlement assignment.

## Identity architecture

1. The UI authenticates with UBS Intra ID using OIDC Authorization Code flow with PKCE.
2. The API validates an Intra ID access token as a Spring Security OAuth2 resource server, including signature, issuer, audience, lifetime, and UBS-required tenant/client restrictions.
3. The only application roles are Intra ID App Roles `APP_ANALYST` and `APP_MANAGER`.
4. App Roles map to UBS MAC entitlements through the AACM onboarding path.
5. The API maps the validated token `roles` claim to Spring authorities. Unknown roles grant no access.
6. An authenticated user without a recognized App Role receives `403 Forbidden` for application data and operations.
7. Production fails closed. Fixed dev identities, user switchers, and caller-supplied identity/role headers must not be enabled in production.
8. UI gating is for usability; Spring Security and domain authorization enforce every permission server-side.

The SPA uses identity-token claims for presentation and sends an access token—not an ID token—to the API. The API creates its user context only from the validated access token.

## Roles

### `APP_ANALYST` — Analyst

Day-to-day operator. Analysts upload Agent BBs, review extraction, resolve LP matches, prepare Shadow BB calculations, maintain global LP reference data, and manage calculation configuration. An Analyst owns submissions they upload and may modify active workflow steps on owned submissions. Other Analysts have read-only access.

### `APP_MANAGER` — Account/Transaction Manager

Operational owner and independent review authority. Managers may act on any submission, accept or reject a completed Shadow BB, reassign workflow ownership, perform documented overrides, and review the complete audit trail. Managers have read-only access to Analyst-maintained configuration.

### `APP_VIEWER` — IT / Read-Only

Non-operational oversight and IT support. A Viewer may read and **download/export** any application data — facilities, submissions, LP Master, Shadow BB inputs/results, configuration, templates, and accepted reports — but may **not** create, edit, delete, or upload anything. It holds no operator capability: no upload, no extraction/match changes, no Shadow BB run, no accept/reject, no configuration edit. Enforced server-side by denying every mutating verb (`POST`/`PUT`/`PATCH`/`DELETE`) under `/api` to this role while leaving `GET` open. The in-code Spring role token is `VIEWER`; the Intra ID App Role is `APP_VIEWER`.

Human-readable role labels are presentation values only. Authorization code, tests, policy, and operational documentation use the canonical App Role values.

## Permission matrix

“Owner” means the current submission owner identified by stable external identity. Manager override and reassignment actions require a reason and an audit event.

| Capability | `APP_ANALYST` owner | `APP_ANALYST` other | `APP_MANAGER` |
|---|:---:|:---:|:---:|
| View facilities and submissions | Yes | Yes | Yes |
| Upload Agent BB | Yes | Yes | Yes |
| View extraction results | Yes | Yes | Yes |
| Correct, re-extract, or remap extraction | Yes | No | Override |
| View LP match queue | Yes | Yes | Yes |
| Resolve LP match queue | Yes | No | Override |
| View Shadow BB inputs and results | Yes | Yes | Yes |
| Edit submission-specific classification/rates | Yes | No | Override |
| Run or recalculate Shadow BB | Yes | No | Yes |
| Submit Shadow BB for independent review | Yes | No | Yes |
| Accept or reject completed Shadow BB | No | No | Yes |
| Accept or reject own Shadow BB submission | No | No | Yes |
| Export reports for accepted Shadow BB | Yes | Yes | Yes |
| Abort active submission | Yes | No | Yes, with reason |
| Reassign workflow ownership | No | No | Yes, with reason |
| View LP Master | Yes | Yes | Yes |
| Edit global LP Master classification | Yes | Yes | Yes, with reason |
| View configuration, thresholds, mappings, templates | Yes | Yes | Yes |
| Edit configuration, thresholds, mappings, templates | Yes | Yes | No |
| View audit events for owned submissions | Yes | No | Yes |
| View audit events for non-owned submissions | No | No | Yes |

Facility create, update, status-change, and delete permissions require explicit business approval before production exposure. Until approved, they are deny-by-default except as a controlled result of an authorized workflow transition. Destructive actions require audit events.

There is no internally produced Shadow BB certificate artifact. “Accept” means independent review is complete; the facility may transition to `Active` and accepted reports may be exposed.

## Workflow ownership and independent review

1. Upload establishes ownership from authenticated `uuName`; ownership is never accepted from the request body.
2. Store ownership as an external identity such as `owner_uu_name`, never as a foreign key to a locally managed user/role table.
3. Only a manager may reassign ownership. Record previous owner, new owner, manager, reason, and timestamp.
4. Analysts may read colleagues' submissions but may not call their state-changing workflow operations.
5. A manager may override an active step without becoming owner but must provide a reason; audit both action and reason.
6. An Analyst submits completed work for review. Only a manager may accept or reject it; if the
   manager submitted the work themselves, they may also perform that review to avoid a lockout when
   no second manager is available. Record submitter and reviewer independently.
7. Rejection returns the submission to a defined actionable state and records reviewer rationale.
8. Acceptance records the reviewed version/snapshot, manager, timestamp, outcome, and then transitions the facility to `Active`.
9. Server authorization evaluates App Role, ownership, and workflow state. URL knowledge or UI manipulation cannot bypass it.

## Identity separation

The application treats four identity concerns separately even when they originate from one validated token.

### Authentication identity — who the user is

```java
public record UserContext(
    String subject,
    String uuName,
    String firstName,
    String lastName,
    String displayName,
    Set<String> roles
) {}
```

`subject` is the immutable OIDC subject. `uuName` is the stable UBS business identifier used for ownership and audit lookup. Names are display attributes, never authorization keys. Exact claim names must be confirmed during Intra ID/AACM onboarding.

### Authorization identity — what the user can do

Authorization uses validated App Roles plus domain facts such as ownership and workflow state. Allowlist `APP_ANALYST` and `APP_MANAGER`; arbitrary groups, headers, display roles, or database fields grant no authority.

### Audit identity — who performed an action

Use stable `uuName` and `subject`, copying display name only for readability. Material events record action, resource identifiers, UTC timestamp, outcome, before/after fields, required reason, correlation ID, and service context. Capture identity on the request thread and propagate it explicitly to asynchronous work.

### Operational tracing identity — who generated a log entry

Structured logs include correlation ID, authenticated `uuName` or an approved pseudonym, service identity, operation, outcome, and duration via MDC/OpenTelemetry. Never log bearer tokens, full claim payloads, sensitive Lending data, or authorization secrets. Background/service operations use workload identity rather than an unattributed `system` value where attribution matters.

## Enforcement requirements

- Use Spring OAuth2 resource-server JWT validation.
- Map only the App Role claim to canonical authorities with one documented naming convention.
- Use deny-by-default endpoint rules plus method/domain authorization for ownership and workflow state.
- Return `401` for missing/invalid authentication and `403` for an authenticated principal lacking permission.
- Gate reads as well as writes where audit scope or sensitive data differs.
- Do not expose event streams anonymously because `EventSource` cannot attach a header; use a secure same-origin session/BFF or an authenticated streaming client.
- Separate service-to-service permissions from human roles and validate workload identity and audience.
- Test every matrix row positively and negatively: owner, non-owner, manager, unknown/no role,
  invalid token, reassignment, override, and manager self-review.

## UI requirements

- Replace prototype users and `DEFAULT_USER` with OIDC authentication context.
- Render names/roles from claims; never compare display name to determine ownership.
- Route guards and disabled controls mirror server decisions for usability.
- Handle `401` through approved sign-in/session recovery and show an access-denied state for `403`.
- Collect required reasons for override, reassignment, rejection, and destructive actions.
- Provide no user or role administration capability.

## AACM and MAC responsibilities

AACM onboarding registers the application Security Principal, redirect URIs, API audience/scopes, App Roles, owners, credential/certificate lifecycle, and environments. MAC mappings and governance control assignment of `APP_ANALYST` and `APP_MANAGER`, including approval, recertification, and removal. The application consumes signed claims and does not replicate governance state.

## Current implementation gaps

The current implementation is not compliant with this target:

- API authentication uses a fixed dev identity or trusted headers instead of validated Intra ID JWTs.
- Existing roles are `ANALYST`, `MANAGER`, and `SERVICE`, not canonical App Roles.
- Most state-changing endpoints require only an authenticated identity.
- Submission ownership is neither populated from authentication nor enforced server-side.
- Reassignment, reasoned override, and independent accept/reject controls are missing.
- Every authenticated operator can retrieve the complete audit feed.
- Audit attribution stores a display string instead of stable authentication identity.
- Operational logging has transaction ID but no authenticated/workload tracing identity.
- The UI always uses a fixed prototype user and lacks authenticated route/permission context.
- The schema contains a local `users` table and user foreign keys that must not be used for entitlement assignment.

These gaps must be resolved before production. Local user-role administration must not be introduced as an interim solution.
