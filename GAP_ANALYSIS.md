# Gap Analysis — Prototype vs. Production

This document maps what the current React prototype covers against what a production-grade system requires. It draws on three sources:

1. The current prototype (`pe-sub-platform` React SPA) — **updated May 2026**
2. The process flow diagram (`BB_PROCESS_FLOW.md`) — the confirmed as-is manual workflow
3. The solution architecture and phased delivery proposal (v3, April 2026) — the agreed production target

---

## Proposal Baseline (for reference)

| Dimension | Value |
|---|---|
| Build cost | USD 1.28M – 1.45M (10–15% contingency) |
| Annual maintenance (Year 2+) | USD 275K – 325K |
| 5-year TCO | ~USD 2.60M |
| Build timeline | 12 months across 3 phases |
| Team | 8 FTE: Solution Architect, 2× Senior Java Dev, Senior Frontend Dev (React), QA Engineer, Fund Finance BA, 0.5× DevOps, 0.5× PM |
| Tech stack | Java 21, Spring Boot 3.4.x, React 18 + Redux, PostgreSQL Flexible Server, Azure AKS |
| Pilot facility | Blue Owl GP Stakes V (900 LPs, May 2026 snapshot) |

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Implemented in prototype |
| ⚠️ | Partially implemented — UI exists, logic simulated or not persisted |
| ❌ | Not modelled |

---

## 1. Data Layer

| Area | Prototype Status | Production Gap |
|---|---|---|
| LP Master | ✅ 900-record dataset; 9 field groups (Identity, Classification, Location, Investor Profile, Ratings, Financial Scale, Commitment Data, Uncalled Data, Borrowing Base); search, filter, 20-row pagination; draggable detail overlay; RBAC-gated edit (Analyst/Account/Transaction Manager); reclassify workflow inline; version history inline; 35-field CSV export | Persistent `lp_master` PostgreSQL table; bank-wide LP deduplication across all facilities; custom fields and annotations; nightly sync from UBS counterparty/KYC system |
| LP Submission Record | ❌ Not modelled | `lp_submission_record` table (keyed on lp_id, submission_id) stores 14 computed fields plus UBS Included flag, Reclassified flag, Transferee flag per submission |
| UBS Included flag | ✅ `inc` field on LP records; filters Shadow BB aggregates and executive summary; CO-editable in LP Master and Shadow BB screen | Production: persisted per LP per submission; changes logged to audit trail |
| AUM storage | ⚠️ String labels (e.g. "$2.4B") in LP dataset | AUM stored as numeric; agent-supplied text ranges (e.g. "1bn–5bn") normalized at ingestion; manual review queue for unmapped ranges |
| Facilities | ⚠️ 82 static records with status, agent bank, UBS participation, delta, EAR | CRUD-managed facility registry linked to credit agreements; agent bank profiles; advance rate and concentration limit configuration per facility |
| Submissions | ⚠️ Static array in `facilityData.js`; no file storage | File ingestion pipeline; document versioning; blob storage for original Agent BB files. Submission notes should be pipeline-generated (not authored): each processing stage appends its findings as a timestamped event (e.g. extraction complete, N name variants detected, M eligibility conflicts). Submission History rows would then surface contextual shortcut buttons (Go to Match Queue, Open Shadow BB) driven by submission state, not by note text — note text is read-only system output |
| Audit log | ⚠️ Static array in `facilityData.js`; surfaced in a real Audit Trail screen with filtering, search, and pagination | Immutable append-only store; 7-year retention (regulatory requirement); tamper-evident |
| Shadow BB results | ⚠️ Computed in-memory by real `bbCalculationService.js`; not persisted between sessions | Persisted per submission as `bb_calculation_snapshot`; versioned; immutably stored for audit; retrievable for historical comparison |

---

## 2. Ingestion Pipeline

| Area | Prototype Status | Production Gap |
|---|---|---|
| Agent BB sourcing | ⚠️ Manual file upload via DropZone UI; representative Goldman Sachs-format Excel file (`Agent-BB-Blue-Owl-GP-Stakes-V-Apr-2026.xlsx`) generated from actual extraction data and available for demo | Analysts download certificates manually from deal sites (SyndTrak, Intralinks, Debt Domain) and upload via the platform UI; authenticated deal site integration is a future roadmap item |
| File upload | ⚠️ DropZone accepts file; processing is simulated (timeout) | Real multipart upload to Azure Blob Storage; virus scan; format validation |
| Document parsing | ⚠️ Pre-scored extraction data in `extractionData.js`; ExtractionPreview screen shows column mapping and per-row confidence | Apache POI for real Excel parsing; structural detection (header row, LP row range, multi-sheet); real column confidence scoring |
| Canonical field mapping | ✅ Field Mapping screen with Core aliases (read-only) and Custom aliases (add/edit/delete); alias dictionary applies to column recognition | Production: engine applies aliases at parse time; unrecognised columns queued for admin review; approved aliases written back to dictionary |
| AUM normalization | ❌ Not modelled | Normalization service converts text ranges (e.g. "1bn–5bn") to numeric; manual review queue for ambiguous values |
| LP name extraction | ⚠️ Pre-extracted names; normalization pipeline visible in Match Analysis panel | Raw text normalization pipeline applied at parse time before matching: legal suffix stripping, abbreviation expansion, unicode normalization |
| Unrecognised columns | ⚠️ Surfaced in ExtractionPreview for manual mapping | Queued for admin review; LLM or fuzzy-match suggestions; approved aliases written back to dictionary |

---

## 3. LP Name Matching

| Area | Prototype Status | Production Gap |
|---|---|---|
| Algorithm | ✅ Real Jaro-Winkler + Levenshtein scoring in `fuzzyMatch.js`; combined score = JW×0.6 + Lev×0.4; scores computed from actual agent/master name pairs in `matchQueueData.js` | Production: scoring via Apache Commons Text + PostgreSQL `pg_trgm` at submission time |
| Match Analysis panel | ✅ Step-by-step normalization pipeline display (case fold, punctuation, legal suffixes, abbreviation expansion); JW and Lev component scores; threshold decision logic shown per match | — |
| Match thresholds | ✅ MatchThresholds screen with configurable auto-accept, review band, and reject thresholds; thresholds drive tier assignment in data generation | Production: threshold changes retroactively re-score pending matches; persisted with effective dates |
| Match queue | ✅ Pre-populated with 900 LPs; ~65% auto-accepted (≥95%); remaining ~35% in review queue; Accept/Reject decisions update local state; queue displays score, facility, status | Production: decisions persisted; audit-logged with confirmed_by and confirmed_at; trigger downstream Shadow BB recalculation |
| New LP onboarding | ⚠️ 135 unmatched new LP names in queue; Accept flow modelled in UI | Production: unmatched LPs go through credit officer approval before entering LP Master and BB calculation. LP Master UI has no manual "New LP" entry — new records enter only via the ingestion pipeline or direct DBA INSERT (data migration / seeding) |
| Duplicate detection | ❌ Not modelled | Cross-facility duplicate detection; parent/subsidiary resolution; merge/split workflows |
| Orphan LP detection | ❌ Not modelled | LPs in Master that no longer appear in any active facility's agent BB over N consecutive cycles should be flagged for review — LP may have redeemed, transferred, or the name may have drifted. Requires a periodic reconciliation job comparing LP Master against the latest ingested submissions per facility |

---

## 4. Shadow BB Calculation

| Area | Prototype Status | Production Gap |
|---|---|---|
| Shadow BB calculation | ✅ Full calculation engine in `bbCalculationService.js`: UBS Eligible Uncalled Cap = MIN(Uncalled, $25M conc. limit); UBS BB = UEC × BUSA Rate; five-tier BUSA rates (90/75/65/50/0%); EAR; BB delta; 14 computed fields materialized per LP | Production: server-side Java 21 Spring Boot; results persisted to database |
| Calculation engine | ✅ Client-side JS (`bbCalculationService.js`); real formulas; reproducible given same inputs | Server-side; auditable; 14 computed fields materialized in PostgreSQL |
| Rating Normalization Service | ❌ Not modelled | Dedicated service normalizes S&P, Moody's, Fitch to a common scale per configurable hierarchy. Drives Applicable Rating and LP Classification for Rated tier |
| UBS Included flag | ✅ `inc` toggle per LP; filters aggregate BB totals; Shadow BB "Included" vs. "All" views | Production: persisted per LP per submission; every toggle logged to audit trail |
| Reclassification workflow | ✅ Inline in LP Master overlay: classification dropdown, mandatory rationale field, updates version history, triggers save; available to Analyst and Account/Transaction Manager only | Production: approval workflow; audit-logged; triggers BB recalculation |
| Transferee flag | ✅ Extracted from agent BB column (Option A confirmed): `Transferee` added as a canonical field in the field mapping dictionary with aliases (Transferee, Transfer Flag, Assignee, Assignment Flag, Transferred LP); extracted value (`Y` or blank) appears on each LP record and is visible in Extraction Preview detail panel | Production: persisted per LP per submission; affects concentration and eligibility calculations; blank ≠ N (absence of column ≠ confirmed non-transferee) |
| Eligibility rules | ✅ Eligibility rules displayed and toggled in Configuration Studio; applied in `bbCalculationService.js` | Production: rules engine with version history; effective-date tracking; impact simulation before committing |
| Concentration breach checks | ✅ Four rules in `bbCalculationService.js`: Single LP >15% of UBS BB (breach); Top-10 LPs >60% (breach) / >50% (warning); Unrated aggregate >50% (breach); Non-US aggregate >30% (breach); breach rules fire correctly — UI surfacing of results deferred pending UX design (see Open Design Questions §11) | Production: breaches persisted; surfaced in compliance reports; alerts sent to credit officers |
| Per-LP concentration cap | ✅ $25M default per facility; per-LP override modelled in service | Production: configurable per credit agreement; stored in facility params |
| Recalculation modes | ⚠️ Recalculate button present; Shadow BB screen is latest-only (historical snapshots are accessed from Reports); enabled/disabled logic based on active submission state not yet implemented | Production: enabled only when an active submission exists for the current cycle (In Progress or Needs Review); disabled with contextual message otherwise; true incremental mode applies only delta LPs |
| Multi-facility roll-up | ❌ Not modelled | Portfolio-level BB aggregation across 20k+ LPs and 80+ facilities for credit line utilisation reporting |

---

## 5. Configuration Management

| Area | Prototype Status | Production Gap |
|---|---|---|
| Advance rate changes | ✅ BUSA and Agent rate tables editable in Configuration Studio; save fires toast | ✅ pe-sub-api: `busa_tiers` and `agent_tiers` persisted in `config` table; loaded at startup. Remaining gap: versioned rate schedules with effective dates; retroactive recalculation on change |
| Eligibility rule changes | ✅ Toggle active/inactive in Configuration Studio | ✅ pe-sub-api: `elig_rules` persisted in `config` table; active/inactive flags stored per rule. Remaining gap: rule versioning; audit log entry on every change; impact simulation before committing |
| Concentration limits | ✅ Editable in Configuration Studio; state lost on refresh | ✅ pe-sub-api: persisted in `config` table (`conc_limits` key); loaded from DB on API startup via `ConfigService`; served at `GET /api/config/eligibility`. Remaining gap: breach recalculation triggered on change |
| Rating hierarchy | ❌ Not configurable | Per-facility configurable Applicable Rating hierarchy (S&P/Moody's/Fitch precedence) stored in `rating_normalization_rule` table |
| Credit agreement amendments | ⚠️ Configuration Studio provides edit UI for rates, rules, and limits | Production: low-code rules builder allows PE Sub team to apply amendments without engineering involvement |
| Field Mapping Dictionary | ✅ Field Mapping screen; Core aliases read-only; Custom aliases editable (add/edit/delete) | Production: persisted in database; dictionary versioned; new canonical fields require schema migration and platform release |
| Match Thresholds | ✅ MatchThresholds screen; auto-accept threshold, review band, reject threshold configurable | Production: persisted with effective dates; threshold changes retroactively re-score pending queue |

---

## 6. Access Control and Security

| Area | Prototype Status | Production Gap |
|---|---|---|
| Authentication | ⚠️ TopBar user switcher with 4 simulated users: J. Smith (Analyst), M. Chen (Analyst), L. Torres (Account/Transaction Manager), R. Patel (Admin) | Azure Active Directory (Entra ID) SSO with UBS corporate identity; MFA |
| Authorisation | ✅ RBAC enforced in UI: LP Master edit gated to Analyst and Account/Transaction Manager; Admin sees read-only view; Account/Transaction Manager can act on any submission; Analyst read-only on submissions they don't own | Production: enforced at API gateway layer (Spring Security); scoped per facility; UI gates are UX aid, not security boundary |
| Override audit | ✅ Reclassification logged to LP version history with user, timestamp, and rationale; visible in LP detail overlay History subview | Production: every classification override and UBS Included toggle logged server-side; queryable in Audit Trail |
| Data sensitivity | ⚠️ All data visible to all simulated users | LP financial data scoped to facility access; PII fields encrypted at rest via pgcrypto |
| Secrets management | ❌ Not applicable | Azure Key Vault; automated key rotation; no secrets in source code |
| API security | ❌ No API | mTLS between services; JWT tokens; rate limiting; input sanitisation |

---

## 7. Reporting

| Area | Prototype Status | Production Gap |
|---|---|---|
| BB Certificate export | ✅ Reports screen with full certificate configuration UI: facility, snapshot, watermark, format (PDF/XLSX/CSV), detail level (Summary/LP Detail/Full), optional sections (Concentration Analysis, Compliance Tests, Classification Summary, Variance Report); Generate and Schedule buttons fire toast | Production: signed PDF with watermark (iText); version-stamped; immutably stored against submission snapshot; 7-year retention |
| LP Master export | ✅ Real 35-field CSV export; one row per LP; all field groups included; export surface moved to Reports screen | — |
| Compliance tests | ✅ Compliance tab in Reports screen with test results (ERISA 25% cap, Foreign Sovereign, Defaulted LP, Concentration tests) | Production: persisted results; breach alerts; regulatory submission format |
| Scheduled reports | ⚠️ Schedule button in Reports screen; not functional | Production: cron-scheduled generation; email delivery; SharePoint/OneDrive integration |
| Report history | ✅ Report History table in Reports screen (static) | Production: links to actual generated documents in blob storage |
| Parallel run reports | ❌ Not modelled | **Mandatory pre-cutover requirement:** platform runs alongside Excel Shadow BB for at least two full cycles; LP-level comparison per facility; credit officer sign-off per facility |
| Historical comparison | ❌ Not modelled | Period-over-period delta analysis; trend charts |
| Audit Trail screen | ✅ Full Audit Trail screen with event-type filter, user filter, free-text search, pagination, and export button (fires toast) | Production: export generates signed PDF; immutable store; 7-year retention |

---

## 8. Integration Points

| System | Prototype Status | Production Gap |
|---|---|---|
| Agent BB sourcing | ⚠️ Manual upload; representative Goldman Sachs-format Excel available for demo | Authenticated deal site integration (direct download from SyndTrak, Intralinks, Debt Domain) — future roadmap |
| LP Master upstream | ⚠️ Static 900-record seed data | Feeds from UBS counterparty database / KYC system; nightly sync |
| Credit Management System (CMS) | ❌ Not modelled | Phase 2: CMS API integration; facility and commitment data synchronisation; covenant compliance tickler |
| Credit system drawdown | ❌ Not modelled | BB certificate pushed to credit line utilisation system; drawdown availability updated |
| Risk / compliance | ❌ Not modelled | ERISA plan asset cap monitoring; foreign sovereign watchlist checks |
| Document management | ❌ Not modelled | Agent BB originals archived with retention policy |

---

## 9. Data Migration

The proposal includes a full Data Migration ETL module (Module 11) — absent from the current prototype entirely.

| Area | Detail |
|---|---|
| Source systems | Microsoft Access (LP master database) + Microsoft Excel (per-facility Shadow BB spreadsheets for 80+ facilities) |
| AUM normalization | Convert text ranges (e.g. "1bn–5bn") to numeric. Manual review queue for ambiguous or unmapped ranges |
| LP deduplication | Fuzzy name matching across all facility files to build a deduplicated `lp_master`. High-volume name variants catalogued before go-live |
| Classification seeding | Migrate existing LP Classification values as-is. Reclassified flag set where the algorithm would assign differently from the legacy value |
| Historical snapshots | Preserved as document archive in Azure Blob. Not migrated to structured tables unless explicitly required |
| Parallel run | Minimum two full reporting cycles running new platform alongside Excel before cutover per facility |
| Sign-off | Credit officer sign-off per facility. Full migration audit report generated |
| Key risks | AUM range ambiguity; LP name variations across 80+ facilities; classification gaps where criteria cannot be re-derived algorithmically |

---

## 10. Infrastructure

| Area | Prototype Status | Production Gap |
|---|---|---|
| Hosting | ⚠️ Vite dev server; deployable as static SPA | Azure Kubernetes Service (AKS); containerised microservices; horizontal pod autoscaling |
| Database | ❌ None (in-memory React state; state lost on refresh) | PostgreSQL Flexible Server: `lp_master`, facilities, submissions, lp_submission_records, audit; pgcrypto for sensitive fields |
| File storage | ⚠️ Generated Excel saved to `public/`; no server-side blob store | Azure Blob Storage: raw Agent BB documents, generated certificates, export archives |
| Background jobs | ⚠️ `setTimeout` simulating async processing in Upload wizard | Async job queue for BB recalculation on submission; observable; retryable; Quartz Scheduler for future deal site integration |
| Observability | ❌ Browser console | Azure Monitor + Application Insights; structured logging; distributed tracing; alerting on calculation failures |
| Identity | ⚠️ Simulated user switcher in TopBar | Azure Active Directory (Entra ID); Azure Key Vault for secrets and encryption key rotation |
| CI/CD | ❌ None | Azure DevOps pipelines; automated testing; environment promotion (dev → staging → production) |
| Disaster recovery | ❌ Not applicable | RTO/RPO targets; daily backups; cross-region replication for audit data; DR/BCP validation in Phase 3 |

---

## 11. Prototype Coverage Summary

The table below scores each major functional area on a 0–3 scale against what Phase 1 of the proposal requires.

| Functional Area | Prototype Score | Note |
|---|:---:|---|
| LP Master — data model and schema | 3/3 | 900 records, 9 field groups, full CRUD in UI |
| LP Master — RBAC and version history | 2/3 | Role-gated edit, inline version history; no persistence |
| LP Name Matching — algorithm | 3/3 | Real Jaro-Winkler + Levenshtein; scores from actual names |
| LP Name Matching — review workflow | 2/3 | Full queue UI, Accept/Reject, match analysis panel; no persistence |
| Shadow BB — calculation engine | 3/3 | Real formula, 4 breach rules, EAR, 14 computed fields; breach UI surfacing deferred |
| Shadow BB — UBS Included flag | 3/3 | Implemented in engine and UI |
| Shadow BB — Reclassification | 2/3 | Inline workflow, version history; no approval chain or persistence |
| Configuration Studio | 2/3 | Full UI for rates, rules, limits; state lost on refresh |
| Field Mapping Dictionary | 2/3 | Core + custom aliases editable; no persistence |
| Upload wizard — file ingestion | 1/3 | DropZone UI exists; parsing simulated |
| Upload wizard — column extraction | 2/3 | ExtractionPreview shows mapped columns and confidence |
| Reporting — BB certificate | 1/3 | Full configuration UI; generation fires toast not real output |
| Reporting — LP export | 3/3 | Real 35-field CSV; export accessed from Reports screen |
| Reporting — compliance tests | 2/3 | Compliance tab with test results; not wired to live calculation |
| Audit Trail | 2/3 | Full screen with filter, search, pagination; data is static |
| RBAC / user simulation | 2/3 | 4 users, role-gated UI; no real auth layer |
| Dashboard | 3/3 | KPI cards, facility list with CTAs, activity feed, exec summary |
| Data persistence | 0/3 | No database; all state in-memory |
| Infrastructure / CI/CD | 0/3 | Local Vite only |

---

## 12. Open Design Questions

These topics were surfaced during prototype development and require deliberate design before implementation. They are captured here as decision points, not gaps — the prototype intentionally defers them.

### 11.1 Cyclic Dashboard Status Model

**Current state:** The Dashboard uses a static status model — facilities carry a persistent status of Active, Pending, or Review. This describes whether a submission is awaiting action, but it does not reflect the natural monthly rhythm of the workflow.

**The problem:** Every month, the clock resets. Agents post updated borrowing base certificates; credit officers must re-process and re-certify each facility. A facility marked Active last month is not automatically Active in the new cycle — it may not have received its agent certificate yet, or the CO may not have started. The current model cannot express this distinction.

**Proposed cyclic status vocabulary:**

| Status | Meaning |
|---|---|
| Awaiting Agent | Cycle open; agent BB certificate not yet received |
| Not Started | Agent certificate received; CO has not yet uploaded or begun |
| In Progress | Submission uploaded; CO working through matching, classification, and Shadow BB |
| Needs Review | Issues present (name mismatches, eligibility disputes) requiring CO sign-off before certification |
| Certified | Shadow BB signed off and BB certificate submitted to the credit system for this cycle |

At cycle open, all facilities roll back to Not Started. Each submission record carries a cycle identifier (e.g., "2026-04") so historical cycles remain queryable independently.

**Cycle reset — Admin-scheduled job:**
The monthly rollover must be an explicit, Admin-triggered scheduled job — not an automatic background process. An Admin configures the job in a Scheduled Jobs screen (cycle identifier, target date, scope — all facilities or per-agent-bank). On execution, the job sets all in-scope facility statuses to Not Started for the new cycle and writes an audit log entry attributed to the Admin who scheduled it. This design ensures every status transition has a traceable human owner; there is no "system auto-reset" concept. The execution engine (e.g. Quartz Scheduler) is an implementation detail — what matters to the data model is that the job record links the cycle reset event to the Admin who authorised it.

**Implications for adjacent features:**
- Facility status becomes a function of the active cycle, not a persistent property of the facility record.
- Dashboard KPI cards (Active/Pending/Review counts) would be replaced by cycle-aware counts (Certified, In Progress, Awaiting Agent, Needs Review).
- LP Master facility grid cards already display the same `facility.status` field with the same three-value colour map (Active → green, Review → amber, Pending → muted). Both screens share a single source (`getFacilities()`), so any status vocabulary change automatically surfaces in both places — only the colour map constant in `LPMaster/index.jsx` needs to be extended alongside the Dashboard.
- The Recalculate button is only meaningful when the current cycle has an active submission in In Progress or Needs Review state; it must be disabled when no active submission exists. Historical snapshots are accessed from Reports, not from the Shadow BB screen (see §4).
- Submission history would be organised by cycle (e.g., "April 2026 cycle") rather than a flat date-sorted list.

**Recommendation:** Design the cycle data model — cycle open/close dates, status transition rules, status derivation from submission state — before implementation. The existing static facility record schema should not be retrofitted; cycle status should be a derived property computed from cycle + submission state at query time.

---

## Priority Sequencing (Proposal Phases)

| Phase | Months | Scope | Success Criterion |
|---|---|---|---|
| **Phase 1 — Foundation and Pilot** | 1–6 | LP master schema, facility registry, PostgreSQL on Azure, AKS, Azure AD SSO, CI/CD; Shadow BB calculation engine; Agent BB ingestion; LP matching; Rating normalization; Credit officer workspace; Certificate generator | Shadow BB calculated automatically for Blue Owl GP Stakes V from ingested Agent BB. Certificate output matches Excel Shadow BB. Credit officer signs off on parallel run |
| **Phase 2 — Scale and Automation** | 7–10 | Data migration ETL from Access and Excel for all 80+ facilities; AUM normalization; LP deduplication; Portfolio dashboard; Configuration Studio; Low-code rules builder | All LP records migrated. Portfolio-level Shadow BB position available in real time without opening a spreadsheet. PE Sub team can apply credit agreement amendment without engineering involvement |
| **Phase 3 — Analytics and Hardening** | 11–12 | Classification scenario analysis; BB sensitivity; what-if tools; API endpoints; performance tuning at 20k+ LP scale; penetration testing; DR/BCP validation; 7-year audit retention verification; CMS integration | Platform passes bank security review and DR test. Ready for production go-live |
