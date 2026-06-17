# Role-Based Access Control (RBAC) — PE Sub Platform

## Overview

The platform operates with **two roles**: Analyst and Account/Transaction Manager. The Analyst is the day-to-day operator who performs Shadow BB construction and inputs, owns submissions, and manages system configuration. The Account/Transaction Manager holds operational ownership and 4-eye review authority. Workflow ownership is per-submission: the Analyst who uploads an Agent BB owns all active steps for that submission until it is certified or reassigned by an Account/Transaction Manager.

---

## Roles

### Analyst

Day-to-day operator and system configurator. Uploads Agent BBs, resolves LP match queues, runs Shadow BB calculations, and manages credit agreement configuration. Owns submissions they upload and can act on all active steps within their submissions. Can view any submission owned by a colleague in read-only mode.

### Account/Transaction Manager

Operational ownership and 4-eye review authority. Runs with the credit request: performs the 4-eye check on completed Shadow BB analyses before submission to the agent. Can act on **any** submission regardless of ownership — used when the owning Analyst is unavailable or when an escalated decision is required. Can reassign workflow ownership. Has full read access across all facilities and full audit trail visibility. Does not perform day-to-day configuration changes.

---

## Permission Matrix

| Capability | Analyst (owner) | Analyst (other) | Account/Transaction Manager |
|---|:---:|:---:|:---:|
| Upload Agent BB | ✓ | ✓ | ✓ |
| Review Extraction | ✓ | view | ✓ |
| Resolve LP Match Queue | ✓ | view | ✓ |
| Run Shadow BB | ✓ | view | ✓ |
| View Shadow BB / Reports | ✓ | ✓ | ✓ |
| Export BB Certificate | ✓ | ✓ | ✓ |
| Reassign workflow ownership | — | — | ✓ |
| Override any active workflow step | — | — | ✓ |
| LP Master (edit classification) | ✓ | — | ✓ |
| Configuration Studio (edit) | ✓ | ✓ | — |
| Configuration Studio (view) | ✓ | ✓ | ✓ |
| Match Thresholds (edit) | ✓ | ✓ | — |
| Field Mapping (edit) | ✓ | ✓ | — |
| Audit Trail (own facilities) | ✓ | — | — |
| Audit Trail (all facilities) | — | — | ✓ |
| User management | ✓ | ✓ | — |

---

## Account/Transaction Manager — Specific Actions

These four actions are exclusively available to Account/Transaction Managers and are not available to any Analyst regardless of ownership:

1. **Override any active workflow step** — An Account/Transaction Manager can step into the Extraction Review, LP Match Queue, or Shadow BB Run for any submission, whether or not they uploaded it. Used when the owning Analyst is unavailable or when an escalated review is required.

2. **Reassign workflow ownership** — An Account/Transaction Manager can transfer submission ownership from one Analyst to another. Ownership determines who holds the active Resume CTA on the Dashboard for Review and Pending facilities.

3. **Cross-facility Audit Trail** — An Account/Transaction Manager's audit trail view is unrestricted: all facilities, all users, full history. An Analyst's audit trail is scoped to their own submission events only.

4. **LP Classification override (non-owned submissions)** — An Account/Transaction Manager can reclassify any LP in LP Master regardless of which Analyst owns the associated submission. This is the escalation path when a classification dispute requires senior sign-off.

---

## Workflow Ownership Rules

1. **Ownership is established at upload.** The Analyst who submits an Agent BB file owns the resulting workflow (Extraction → Match Queue → Shadow BB) until the submission is certified or reassigned.

2. **Pending facilities require configuration.** A facility in Pending status cannot have a Shadow BB run until an Analyst configures its credit agreement rules. Any Analyst can unblock a Pending facility — ownership is not required for configuration.

3. **Review facilities retain a valid certified BB.** A submission in Review status means the previous certified BB remains live. Only the owning Analyst (or Account/Transaction Manager) can resolve the match queue and certify the new submission.

4. **Account/Transaction Managers can override and reassign.** If an owning Analyst is unavailable, an Account/Transaction Manager can step into any active workflow step or transfer ownership to another Analyst.

5. **Read access is unrestricted within the team.** Any Analyst can view any facility's Shadow BB, match queue, extraction, or report — they simply cannot take action on submissions they do not own.

---

## Dashboard Guidance (Resume CTAs)

The Executive Summary panel on the Dashboard surfaces a context-aware action for each facility status:

| Facility Status | Current User | CTA Shown |
|---|---|---|
| Active | Any | View Shadow BB → |
| Review | Owner / Account/Transaction Manager | Resolve Match Queue → |
| Review | Other Analyst | View Match Queue (read-only) |
| Pending | Analyst | Configure Rules → |
| Pending | Account/Transaction Manager | Pending analyst configuration |

The submitting Analyst's name is displayed alongside the CTA for Review and Pending facilities, so any user can immediately identify who owns the open item.

---

## Simulated Users (Prototype)

Since the prototype has no authentication layer, a user switcher in the TopBar simulates the current session:

| Display | Name | Role |
|---|---|---|
| JS | J. Smith | Analyst |
| MC | M. Chen | Analyst |
| LT | L. Torres | Account/Transaction Manager |

Switching users updates all permission-gated UI elements in real time.

---

## Future Auth Integration

- Replace the TopBar user switcher with an **OAuth 2.0 / SAML SSO** token (UBS AD-integrated)
- Store role in the JWT claims; derive `currentUser` from the decoded token in `AppContext`
- Workflow ownership stored server-side on the submission record (`submittedBy: userId`)
- All write endpoints enforce ownership + role checks server-side; the UI gates are a UX aid, not a security boundary
- DB role values: `'Analyst'` | `'Account/Transaction Manager'`
