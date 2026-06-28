# PE Sub Platform — Open Questions

> Questions requiring a business or architectural decision before the relevant feature can be built or finalised.
> Last updated: 2026-06-28 (Q14 added).
>
> **Legend:** 🔴 Blocks Phase 1 build · 🟡 Affects Phase 1 design · 🔵 Phase 2 / deferred

---

## 1. Workflow & Process

### Q1 — Shadow BB re-run on an Active facility 🔴

Once a Shadow BB run is accepted and a facility moves to `Active`, can the credit officer re-run the Shadow BB within the same cycle (e.g. after a data correction), or must they start a new submission?

**Impact:** If re-runs are allowed, the `POST /submissions/:id/complete` endpoint must be reversible, and the facility must be able to return to `In Progress` without creating a new submission record. If not, the UI must prevent re-entry on `Active` facilities.

---

### Q2 — Upload without Shadow BB ("LP Master update only" path) 🔴

Shadow BB is only prepared when a credit decision is required (renewal, amendment, new origination). For all other monthly agent BB receipts, what should the system do after ingesting the LP data?

**Options to confirm:**
- (a) Upload and ingest updates LP Master figures, submission is marked `Processed`, facility stays at its current status — no BB run triggered.
- (b) Upload always requires a Shadow BB run regardless of whether a credit decision is needed.

**Impact:** If (a), the wizard needs a branch after the match-queue step: "Run Shadow BB" vs "Update LP Master Only". The facility workflow and status logic must handle a completed submission with no `bb_snapshot`.

---

### Q3 — Account Manager accuracy review — system action or operational only? 🟡

After the two analysts prepare the Shadow BB, the Account Manager reviews for accuracy. Is this review tracked in the system (e.g. a `Reviewed` status, an approval button, a comment), or is it a purely operational step outside the platform?

**Note:** Formal workflow and approval routing are explicitly deferred to Phase 2. This question is only about whether the Account Manager's review needs any system footprint in Phase 1 (even just an audit log entry).

---

### Q4 — Concurrent analyst access on the same facility 🟡

Two analysts (in different locations) independently prepare the Shadow BB. Can they work on the same facility simultaneously in the platform, or is access sequential (one at a time)?

**Impact:** If concurrent, the submission record and LP overrides must handle concurrent writes without silent data loss. If sequential, ownership locking or a simple "in-use" indicator is sufficient.

---

## 2. LP Master & Data Management

### Q5 — LP record deletion / archival (Phase 1 scope) 🟡

Should credit officers be able to delete or archive LP records that are no longer relevant (e.g. an LP that has exited a fund)?

**Current design:** The `inc` (included) boolean already exists on every LP record. Setting `inc = false` excludes the LP from all BB calculations without deleting it, preserving the audit trail. Hard deletion would break FK constraints from `lp_rates` and `match_queue_entries`.

**Confirm:** Is `inc = false` (soft-exclude with filter in LP Master screen) sufficient for Phase 1, with formal archival/purge deferred to Phase 2?

---

### Q6 — LP identifier: LEI vs internal UBS counterparty ID 🟡

LP records currently use `investor_name` as the primary identifier for matching. A stable machine-readable identifier is needed for REST-based classification auto-population and cross-facility deduplication.

**Options:**
- (a) LEI (Legal Entity Identifier) — globally standard, publicly available via GLEIF, independent of UBS systems.
- (b) Internal UBS counterparty ID — already in use by UBS Credit for loan administration; operationally linked to the loan system.

**Impact:** Affects the LP Master schema (`lei` or `counterparty_id` field), matching logic, and any future integration with external classification or rating feeds.

---

### Q7 — LP Master fields editable post-ingestion, and by whom 🔴

After an agent BB is ingested and LP figures are written to the LP Master, which fields can a credit officer edit directly (outside of a new submission cycle), and are there any that only the account manager / supervisor can change?

**Known:** `PATCH /api/lps/:id` currently allows editing `cls`, `clsTag`, `abb`, `inc`, `rcl`, `notes`. AUM and ratings are entered manually.

**Needs confirmation:** Are AUM, ratings (S&P / Moody's / Fitch), and concentration limits also editable at any time by any credit officer, or do changes to financial figures require a new submission / supervisor approval?

---

## 3. Concentration Limits

### Q8 — Class-level concentration limits: where configured and stored 🔴

Some facilities carry an overall class concentration limit (e.g. a cap on total Unrated LP exposure) on top of the per-LP limit. Both are calculated against total uncalled capital.

**Needs confirmation:**
- Which classification tiers can carry a class-level CL (all five, or a subset)?
- Is the class-level CL set per facility, or is it a global config value applied to all facilities?
- Should it be configurable via the Configuration screen (alongside per-LP limits), or set at the time a facility is created?

**Impact:** Affects the `config` table schema (`conc_limits` key structure), the `BbCalculationService` breach-detection logic, and the Configuration screen UI.

---

### Q13 — Advance Rate Schedule tables: correct tier values and Concentration Limit column 🔴

The **Admin → Configuration** screen displays two tables — **BUSA Advance Rate Schedule** and **Agent Advance Rate Schedule** — each with a `CLASSIFICATION` column and a `RATE (%)` column. Both are currently seeded with identical placeholder values (Rated 90%, Unrated AUM >$2bn 75%, Unrated AUM $1–2bn 65%, Eligible <$1bn 50%, Excluded 0%). Neither has a Concentration Limit column.

**Current code locations (for reference):**
- DB seed: `pe-sub-api/.../V1_2__seed.sql` — `busa_tiers` and `agent_tiers` JSONB config keys seeded identically.
- Frontend: `pe-sub-ui/src/config/eligibilityConfig.ts` — `BUSA_TIERS` and `AGENT_TIERS` arrays, same values.
- Calculation engine: `BbCalculationService.java` and `bbCalculationService.ts` — hardcoded `BUSA_RATES` map consumed by all BB runs.
- Portfolio-level concentration limits exist separately as global constants (`CONC_LIMITS`) — not tied to classification tier.

**Questions for PE Sub Management Team:**

**Rate values (blocks seeding correct data):**
1. What are the correct BUSA (UBS) tier names and advance rate percentages? Are the current five tiers and rates listed above correct, or do they need to change?
2. What are the correct Agent tier names and advance rate percentages? Are they a completely different schedule from BUSA, or the same tier names with different rates?

**Concentration Limit column (blocks schema design):**
3. Should each classification tier in both schedules carry its own Concentration Limit (%)? For example: a Rated LP may have a 90% advance rate and a 15% CL, while an Unrated LP has 75% and 10%.
4. If yes, are the BUSA concentration limits and the Agent concentration limits independently defined, or do they share the same CL schedule?
5. Is the per-tier CL checked at **eligibility** time (commitment), at **BB calculation** time (breach detection), or both?

**Scope:**
6. Should Admin users be able to edit these schedules via the Configuration screen (the PUT endpoint already exists), or are they policy-locked and only changeable via a database migration/release?

**Impact:** Confirmed tier values unblock correcting the seed data and hardcoded maps. A per-tier Concentration Limit column changes the JSONB schema in the `config` table, the `RateTier` TypeScript type, the `BbCalculationService` breach logic (currently using the separate global `CONC_LIMITS` object), and the Configuration screen UI. Q8 (class-level CL per facility vs global) is a related but separate concern.

---

## 4. Template & Extraction

### Q9 — Missing agent bank templates: onboarding plan and timeline 🟡

15 of 17 agent banks have no template received. The extraction service can only process a new agent's BB after at least one template is classified and its aliases are seeded.

**Needs confirmation:** Is there a timeline or process for receiving the outstanding templates? Should the platform surface a "no template available" warning when a user attempts to upload for an agent bank with no registered template?

---

### Q10 — AI-assisted extraction for novel templates 🔵

For agent BB templates that cannot be expressed as structural rules (new classification schemes, non-standard layouts), should AI-assisted extraction be considered?

**Current position (agreed 2026-06-13):** Heuristic-first. AI extraction is not suitable for direct write to LP Master in a production financial controls environment (non-deterministic, audit trail concerns). If considered at all, it should be a pre-processing suggestion step requiring credit officer confirmation — not automatic ingestion.

**Confirm when relevant:** Revisit only if a template class emerges that genuinely cannot be handled by the existing heuristic + alias + section-row pipeline.

---

### Q14 — Feeder tab handling: investor type and LP classification mapping 🔴

Raised from CCP-VII (Comvest Credit Partners VII, LP). Agent BB workbooks may contain **Feeder tabs** representing aggregation vehicles for specific investor categories:

- **Cayman / Offshore Feeder** — typically aggregates non-US and tax-exempt institutional investors (sovereign wealth funds, foreign pension funds).
- **Delaware / Onshore Feeder** — typically aggregates US taxable investors.

**Current extraction behaviour:** The multi-tab engine can parse all tabs and tag each LP record with a `fundSleeve` value matching the tab name (e.g. `"Cayman Feeder"`, `"Delaware Feeder"`). This is already implemented for CCP-VII via `auto_discover_tabs`.

**What is unresolved:** `fundSleeve` alone does not convey investor type or LP classification. Further derivation — mapping a feeder tab to an **Investor Type** (e.g. `Non-US / Tax-Exempt`, `US Taxable`) or to a specific **LP Classification / Rate tier** (Rated, Unrated, Eligible, Excluded) — is structurally complex and cannot be inferred reliably from the tab name alone.

**Options to confirm:**

- (a) **Manual override only** — Credit officers assign Investor Type and LP Classification manually via the dropdowns on the LP Classification & Rate Aggregation screen after ingestion. The system makes no automatic assumption based on feeder tab name.
- (b) **System suggestion with manual confirmation** — The extraction engine applies a configurable tab-name-to-investor-type mapping (e.g. `"Cayman"` → `Non-US / Tax-Exempt`) as a default that the credit officer can override.
- (c) **Feeder tabs excluded from extraction** — Feeder LP records are skipped during ingestion; only the "master" or consolidated tab is processed.

**Impact:** Determines whether the existing `lp_records.inv_type` column is sufficient to capture feeder-derived investor type (it already exists; the question is whether values can be reliably derived from tab name alone), whether the LP Classification & Rate Aggregation screen must surface a bulk-assign workflow for feeder-sourced records, and whether any tab-name alias config is needed in the extraction service.

---

## 5. Infrastructure & Deployment

### Q11 — Azure hosting model 🔵

Azure architecture target is confirmed but the specific hosting model is not.

**Open:** Container Apps vs App Service for `pe-sub-api`, `pe-sub-extraction`, `pe-sub-jobs`. Region, VNet configuration, Key Vault integration, and managed identity approach.

**Blocks:** `pe-sub-infra` Terraform scaffolding and AKS → Container Apps migration planning.

---

### Q12 — Authentication: Azure AD (Entra ID) vs internal auth 🔵

No authentication is implemented. All user context is hardcoded to "J. Smith". Unblocks: audit log user attribution, RBAC enforcement (Analyst vs Account/Transaction Manager), LP edit ownership.

**Open:** Azure AD (Entra ID) SSO — preferred for UBS internal tools — vs a standalone internal auth implementation.

---

## 6. Future Considerations (explicitly Phase 2)

These items were raised during design but are **out of scope for Phase 1**. Recorded here to avoid re-raising them as new questions.

| # | Item | Notes |
|---|------|-------|
| P2-1 | Workflow approvals and formal sign-off routing | Account Manager review, escalation paths, multi-step approval for credit decisions |
| P2-2 | LP record purge / archival admin function | Phase 1 uses `inc = false` (soft-exclude). Hard delete or time-based archival is Phase 2 |
| P2-3 | Scheduled monthly BB recalculation | `pe-sub-jobs` skeleton exists (port 3003); no jobs implemented. Monthly reset of `Active` → `Not Started` and auto-recalculation driven by `snapshot-freq` global setting |
| P2-4 | Agent Bank Exposure report | One of four Step 6 report types; endpoint and UI not built |
| P2-5 | Effective Advance Rate history report | `GET /api/reports/ear/:facilityId` planned; not implemented |
| P2-6 | Multi-class concentration limits in BB engine | `BbCalculationService` breach thresholds currently hardcoded; must be wired to `ConfigService` (Gap G1/G2) to make class-level CL configurable |

---

## Resolved Questions (for reference)

| # | Question | Resolution | Date |
|---|----------|------------|------|
| R1 | Should Shadow BB be produced every cycle? | No — only when a credit decision is required (renewal, amendment, new origination) | 2026-06-13 |
| R2 | Is a Shadow BB certificate required? | No — `Active` status on completion is sufficient; no document submission | 2026-06-13 |
| R3 | What is the completed-BB facility status? | `Active` (replaces prior `Certified`) | 2026-06-13 |
| R4 | Are concentration limits against facility size or uncalled capital? | Total uncalled capital | 2026-06-13 |
| R5 | Is there a class-level concentration limit? | Yes — some facilities carry one on top of the per-LP limit | 2026-06-13 |
| R6 | Authorization required to create LP records? | No — LP must be in the agent BB and figures verified; no approver needed | 2026-06-13 |
| R7 | How are AUM and ratings sourced? | Manually, from Pitchbook, rating agency sites, and internet searches | 2026-06-13 |
| R8 | Who compiles the LP Master? | Two individuals on the PE Sub Management team | 2026-06-13 |
| R9 | Flat repos or monorepo? | Flat repos | Prior |
| R10 | Cloud provider? | Azure (Container Apps / AKS target; Terraform deferred) | Prior |
| R11 | Two roles or three? | Two: Analyst, Account/Transaction Manager | Prior |
