# PE Sub Platform — Solution Design

> **Living document.** Updated continuously as architecture and implementation decisions are made.  
> Business context: `pe-sub-platform/docs/PE_SUB_SOLUTION.md`  
> As-is process: `pe-sub-platform/docs/BB_PROCESS_FLOW.md`  
> Prototype process: `pe-sub-platform/docs/NEW_BB_PROCESS_FLOW.md`

---

## 1. Repositories

| Repo | Purpose |
|------|---------|
| `pe-sub-ui` | React / TypeScript / Vite frontend. Domain types (`LP`, `Facility`, `BBResult`, etc.) live in `src/types/` |
| `pe-sub-api` | Spring Boot 3.5 / Java 21 REST API — business logic, route handlers, JPA / DB access |
| `pe-sub-extraction` | Spring Boot 3.5 / Java 21 document extraction service — parses XLSX/CSV agent schedules, returns structured LP records to `pe-sub-api`; maintains BB template registry |
| `pe-sub-jobs` | Spring Boot 3.5 / Java 21 background jobs service — scheduled recalculations and async processing (skeleton; no jobs implemented yet) |
| `pe-sub-infra` | Kubernetes manifests for local cluster (Docker Desktop / Rancher Desktop) and managed Kubernetes deployment |
| `pe-sub-docs` | Solution design, OpenAPI specification (`openapi.yaml` v0.7.0), and Postman/Talend API collection |
| `pe-sub-platform` | Working prototype only — used to gather and refine requirements; not deployed to production |

### Decision: flat repos, not a monorepo

Rejected: Turborepo / pnpm workspaces monorepo with nested `apps/` and `packages/`.

Chosen: flat repos.

**Rationale:** Simpler to navigate and own. Monorepo tooling overhead is not justified for a focused internal tool where API and UI are always deployed together. The original `pe-sub-common` shared-TypeScript package was dissolved (see §7, Decision 11) so there is no longer a code-sharing reason to use workspace tooling.

### `pe-sub-infra` — current state

Contains Kubernetes manifests for a local cluster (Docker Desktop / Rancher Desktop). Terraform for Azure cloud resources remains deferred until the cloud architecture is confirmed. Target Azure resources include Container Apps (or App Service), Azure Database for PostgreSQL Flexible Server, Azure Key Vault, and networking / DNS. See §6 for current state.

---

## 2. Tech Stack

### Core services (pe-sub-api, pe-sub-extraction, pe-sub-jobs)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Java 21 (LTS) | All three backend services |
| Runtime | Spring Boot 3.5 | All three backend services |
| Build tool | Maven 3.9 + Maven Wrapper (`mvnw`) | Pins Maven version; no pre-install required in Docker / CI |
| ORM / persistence | Spring Data JPA (Hibernate 6) | `pe-sub-api` and `pe-sub-extraction` |
| Schema / migrations | Flyway | SQL migrations in `pe-sub-api/src/main/resources/db/migration/`; applied automatically on startup |
| Database | PostgreSQL 16 | Azure Database for PostgreSQL Flexible Server in production; Docker locally |
| JSON / JSONB | Jackson 2, `PGobject` | `bb_snapshots.result` column via `AttributeConverter` |
| HTTP client | Spring `RestClient` | `pe-sub-api` → `pe-sub-extraction` calls |
| XLSX / XLS parsing | Apache POI 5.3.0 (`poi-ooxml`) | `pe-sub-extraction` |
| CSV parsing | Apache Commons CSV 1.11.0 | `pe-sub-extraction` |
| Logging | Logback via `logback-spring.xml` | Rolling daily log, gzip archive, 30-day retention, 2 GB cap; both `pe-sub-api` and `pe-sub-extraction` |

### Frontend (pe-sub-ui)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript 5.x | |
| Runtime | React 18, Vite 6 | |
| Dev server proxy | Vite `server.proxy` | `/api` → `localhost:3001`; avoids CORS config in development |

---

## 3. Architecture

```
Browser
  │
  └─ pe-sub-ui  (React / Vite, port 3000)
        │
        └─ /api/* (Vite proxy) ──────────────────────────────▶  pe-sub-api  (port 3001)
                                                                      │
                                                               Spring Data JPA
                                                                      │
                                                                  PostgreSQL
                                                                      │
                                                     POST /api/extract (forward=false)
                                                                      ▼
                                                           pe-sub-extraction  (port 3002)
                                                               (returns ExtractionResult
                                                                to pe-sub-api; pe-sub-api
                                                                persists and ingest-routes)


pe-sub-jobs  (port 3003)  ──── scheduled HTTP ──────────────▶  pe-sub-api
  (no jobs implemented yet)
```

- `pe-sub-ui` calls `pe-sub-api` exclusively via the Vite dev proxy. It never calls `pe-sub-extraction` directly.
- `pe-sub-api` owns all business logic: LP management, BB calculation (Java port of the engine), submission ingestion, name matching, and configuration management.
- `pe-sub-api` calls `pe-sub-extraction` with `forward=false` on upload, receives the `ExtractionResult` directly, and handles persistence and LP ingest internally.
- `pe-sub-extraction` parses uploaded spreadsheets, scores fields by confidence, and returns structured results. When `forward=true` it can also POST to `pe-sub-api/lps/ingest` directly (used for standalone testing only).
- `pe-sub-jobs` is intended to run scheduled tasks (e.g. automatic monthly BB recalculation) against `pe-sub-api`. No jobs are implemented yet.
- In Kubernetes, `pe-sub-extraction` and `pe-sub-jobs` are `ClusterIP` (internal only). Only `pe-sub-api` has a `NodePort` (30001) accessible outside the cluster.

---

## 4. Database Schema

Defined by Flyway SQL migrations in `pe-sub-api/src/main/resources/db/migration/`:

| File | Contents |
|------|----------|
| `V1_1__schema.sql` | All DDL — `users`, `facilities`, `lp_records`, `bb_snapshots`, `config`, `submissions` (incl. `wizard_step` / `shadow_bb_overrides`), `audit_log`, `lp_rates`, `submission_extractions`, `match_queue_entries`, FM Dictionary tables, BB template registry tables |
| `V1_2__seed.sql` | Config seed (`busa_tiers`, `agent_tiers` 5-tier, `agent_rate_params`, `elig_rules`, `conc_limits`, `global_settings`, `matching_config`); FM Dictionary — 30 canonical fields (incl. **Agent LP Classification** + derived **UBS LP Classification**), all aliases, blocklist, suggestions; BB template registry (3 agent banks, GS group headers using Agent LP Classification taxonomy); LP rates feed seeded from `lp_records` (effective 2025-01-01, `source='SIMULATED'`) |
| `V1_3`–`V1_10` | BB template registry rows: KKR Ascendant, Audax VII, CCP VII Lev, AEP VII, CP VII, WF Blue Owl, GS Blue Owl, Petershill |
| `V1_11__multi_tab_support.sql` | `lp_records.fund_sleeve` column; `bb_template_tabs.sleeve_name`; `bb_templates.auto_discover_tabs` |
| `V1_12__multi_tab_templates.sql` | Audax VII three-sleeve config (Nerdio/Apptio/Marlin); CCP VII Lev auto-discover flag |
| *(planned V1_13+)* `facility_seed.sql` | INSERT all 71 facility rows from Agent Bank Summary with `account_number`, `loan_amount`, `maturity_date`, `collateral_date`, `bank_status`, `bank_status_date` (Decision 30, 41) |
| *(planned V1_14+)* `fm_alias_seed.sql` | Bank-scoped FM Dictionary aliases for WELLS_FARGO and SILICON_VALLEY_BANK (Decision 42; §10.2–10.4) |

To make a schema change: add a new `V1_N__description.sql` (or `V2_1__` for the next major release) and restart `pe-sub-api`. V1_1 and V1_2 are the consolidated base — do **not** modify them once a production DB has been initialised; use new numbered files instead (see Decision 44).

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| email | varchar(255) unique | |
| name | varchar(255) | |
| role | varchar(50) | `Analyst` \| `Account/Transaction Manager` |
| created_at | timestamp | |

### `facilities`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar(255) unique | |
| agent_bank | varchar(255) | Maps to `template_format` identifier |
| status | varchar(50) | Workflow status: `Not Started` \| `In Progress` \| `Needs Review` \| `Active` \| `Pending` |
| conc_limit_m | numeric(10,2) | Per-LP concentration limit in $M; default 25 |
| last_run_at | timestamp nullable | Set on each Shadow BB run |
| created_at / updated_at | timestamp | |
| account_number | varchar(20) nullable | *(planned)* UBS internal loan reference, e.g. `5VX1796`; unique; operational link to UBS loan administration |
| loan_amount | numeric(15,2) nullable | *(planned)* Committed facility size in USD from Agent Bank Summary |
| maturity_date | date nullable | *(planned)* Facility maturity date |
| collateral_date | date nullable | Collateral as-of date from Agent Bank Summary |
| bank_status | varchar(50) nullable | *(planned)* Credit/operational status, e.g. `Active` / `Terminated`; distinct from workflow `status` |
| bank_status_date | date nullable | *(planned)* Most recent `bank_status` change date from Agent Bank Summary |

### `lp_records`

Stores the LP Master — one record per LP per facility.

Column naming aligned with LP Master schema: API/DTO field names (e.g. `cls`, `uc`, `inc`) differ from DB column names — see MASTER_DB_MAPPING.md for the full mapping.

| Group | DB columns |
|-------|---------|
| Identity & Classification | investor_name, parent, spv, high_qty, inv_type, region, investment_grade, classification, classification_tag, agent_cls, fund_sleeve |
| Ratings | sp, mdy, fitch |
| Financial Scale | aum, nav, pension, pension_funded |
| Commitment Data | cap_commit, pct_cap_commit, called_cap |
| Uncalled / Eligible Capital | uncalled_capital, pct_uncalled, pct_called |
| Concentration & BB | agent_conc, ubs_conc, agent_excess_conc, ubs_excess_conc, agent_rate, ubs_rate, agent_bb, ubs_bb |
| Status | included, rcl, recallable_dist, transferee, source_seq |
| Meta | notes, facility_id (FK → facilities), created_at, updated_at |

Note: `rate` (BUSA advance rate) and computed fields (`ubb`, `delta`, `uec`) are **not stored** — they are derived at runtime by the BB engine from `cls` and `uc`. Only `abb` (agent's submitted BB value) is stored as a source field.

### `lp_rates`

LP rates feed — one row per LP per effective period. Populated by the monthly batch ingestion process; `LpRateService.findLatestAsOf(lpId, asOf)` returns the most recent row on or before the submission date for use in the Shadow BB calculation. Seeded with simulated rates (`source = 'SIMULATED'`, effective 2025-01-01) so test submissions have rates from day one.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| lp_id | integer FK → lp_records | `ON DELETE CASCADE` |
| effective_date | date | Date rates take effect |
| classification | varchar(50) | `cls` value at time of ingestion |
| ubs_adv_rate_pct | numeric(7,4) | UBS advance rate as decimal fraction (0.9000 = 90%) |
| ubs_conc_limit_pct | numeric(7,4) | Per-LP concentration cap as fraction of total eligible uncalled |
| source | varchar(50) | `BATCH_FEED` (production) or `SIMULATED` (dev seed) |
| created_at | timestamp | |

Unique constraint on `(lp_id, effective_date)`. Indices on `effective_date` and `lp_id`.

### `bb_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| facility_id | integer FK → facilities | |
| calculated_by | integer FK → users nullable | |
| calculated_at | timestamp | |
| result | jsonb | Full `BBResult` — lps[], summary, breaches[] |

Snapshots are append-only. The latest snapshot per facility is the current Shadow BB. Historical snapshots support trend reporting and the audit trail.

### `submissions`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| facility_id | integer FK → facilities | Not null |
| agent_bank | varchar(255) | Not null |
| period_month | varchar(20) | Date string passed from the UI e.g. "2026-05-31" |
| status | varchar(50) | Default `Processing`; transitions to `Review` (extraction complete) or `Error` (pe-sub-extraction unreachable) |
| file_name | varchar(255) | Original filename as uploaded |
| file_path | varchar(512) nullable | Absolute server path to the saved file; configured via `${app.uploads.path}` |
| uploaded_by | integer FK → users nullable | |
| notes | text nullable | Optional analyst notes submitted with the upload form |
| wizard_step | integer | 1-indexed step in the ingest wizard (1=Upload, 3=Review Extraction, 4=Review Matches, 5=LP Classification & Rate Assignment); default 1; step 2 is transient and never stored |
| shadow_bb_overrides | jsonb nullable | LP classification/rate overrides committed by the credit officer on the Run Shadow BB screen; keyed by LP `_key` |
| created_at / updated_at | timestamp | |

### `submission_extractions`

One row per submission; unique index on `submission_id`.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| submission_id | integer FK → submissions unique | |
| template_format | varchar(50) nullable | Detected bank format. Current values: `CITIBANK`, `JPM`, `GOLDMAN_SACHS`, `BARCLAYS`, `BANK_OF_AMERICA`, `WELLS_FARGO`, `PNC_BANK`, `FIFTH_THIRD`, `HUNTINGTON`, `WHITE_OAK`, `ARES`, `MIDCAP_FINANCIAL`, `INTERNAL`, `UNKNOWN`. Planned additions (Decision 32): `BMO`, `BNY_MELLON`, `CIBC`, `CITY_NATIONAL`, `LLOYDS`, `MT_BANK`, `MIZUHO`, `MORGAN_STANLEY`, `NATIXIS`, `SILICON_VALLEY_BANK`, `SMBC`, `SOCIETE_GENERALE`, `UBS_BANK_USA`. Note: `CITIZENS_FINANCIAL` removed — Citizens Financial Group is a separate institution from SVB/First Citizens. |
| template_version | varchar(50) nullable | Reserved for future versioning |
| sheet_name | varchar(255) nullable | Name of the BB sheet extracted from |
| header_row_index | integer nullable | Zero-based header row index in the sheet |
| total_rows | integer | Count of data rows parsed |
| flagged_count | integer | Count of rows with `requiresReview: true` |
| extracted_lps | jsonb nullable | Full `ExtractionResult.records` array |
| field_mappings | jsonb nullable | `ExtractionResult.fieldMappings` array |
| unrecognized_columns | jsonb nullable | `ExtractionResult.unrecognizedColumns` array |
| created_at | timestamp | |

### `match_queue_entries`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| submission_id | integer FK → submissions | |
| facility_id | integer FK → facilities | |
| row_index | integer | Source row in the extracted LP array |
| extracted_name | varchar(255) nullable | Investor name as extracted |
| matched_lp_id | integer FK → lp_records nullable | Best LP Master match, if any |
| matched_lp_name | varchar(255) nullable | Matched LP name at time of ingest |
| match_score | integer nullable | Combined similarity score 0–100 |
| decision | varchar(50) | Default `pending`; transitions to `accepted`, `rejected`, or `manual` |
| master_name_override | varchar(255) nullable | Manual name entered by credit officer |
| is_new | boolean | True if no existing LP Master record matched |
| reasons | jsonb nullable | Array of reason strings explaining the queue action |
| created_at / updated_at | timestamp | |

### `bb_templates`

Auto-learned template registry keyed by agent bank. On first confirmed extraction for an agent bank, the sheet name, header row index, and template class are saved. On subsequent uploads from the same bank, `SubmissionController` passes these as `sheetNameHint` / `headerRowHint` to skip heuristic detection.

> **Multi-format note (Decision 43):** A single agent bank may use more than one template class across different facilities (confirmed for Wells Fargo: Class A on Blue Owl GP Stakes V, Class B on Petershill IV). The current unique key on `agent_bank` is insufficient for this case. When a second confirmed extraction for the same agent bank produces a different template class, a second registry row must be created keyed by `(agent_bank, template_class)` rather than `agent_bank` alone. Schema change planned for `V1_7`.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| agent_bank | varchar(255) | Case-insensitive index; not unique once multi-class support is added |
| template_class | varchar(10) nullable | *(planned)* `A`, `B`, or `C`; populated on `POST /{id}/confirm`; drives extraction parsing path |
| sheet_name | varchar(255) nullable | BB sheet name to target |
| header_row_index | integer nullable | Zero-based header row index |
| auto_learned | boolean | Default `true` — set by `POST /{id}/confirm` |
| created_at / updated_at | timestamp | |

### `audit_log`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| event | varchar(100) | Not null. One of: `BB Recalculated`, `LP Reclassified`, `LP Data Updated`, `Upload`, `Export`, `Config Change`, `Match Config Change`, `Login`, `Field Mapping Change`, `Abort`, `Re-extraction`, `Extraction Confirmed` |
| detail | text nullable | Human-readable event detail; format varies by event type (see §5 Audit) |
| facility_id | integer FK → facilities nullable | Null for non-facility-scoped events (e.g. Login, Config Change) |
| user_id | integer FK → users nullable | Reserved for auth integration; not yet populated |
| user_name | varchar(100) nullable | Display name of the actor stored at write time; decoupled from users FK |
| ip | varchar(45) nullable | Client IP — resolved from `X-Forwarded-For` header if present, else `remoteAddr` |
| created_at | timestamp | Set by `@PrePersist`; not updatable |

A descending index on `created_at` (`idx_audit_log_created_at`) supports the default sort on `GET /api/audit`.

Writers:

- **BbController** — inserts `BB Recalculated` on every `POST /api/bb/run/:facilityId`
- **LpController** — inserts `LP Reclassified` when `cls` changes on `PATCH /api/lps/:id`; inserts `LP Data Updated` when `POST /api/lps/ingest` updates at least one LP record
- **SubmissionController** — inserts `Upload` on every `POST /api/submissions`; `Abort` on `POST /:id/abort`; `Re-extraction` on `POST /:id/reextract`; `Extraction Confirmed` on `POST /:id/confirm`; `Field Mapping Change` on `POST /:id/remap` (when a new alias is created)
- **AuditController** — inserts `Login` on `POST /api/audit/login` (called by UI on app mount)
- **ConfigController** — inserts `Config Change` on `PUT /api/config/eligibility`; inserts `Match Config Change` on `PUT /api/config/matching`; detail names the specific section in both cases
- **FieldMappingController** — inserts `Field Mapping Change` on alias mutations

All writers record `user_name = "J. Smith"` (hardcoded pending auth) and resolve IP via `X-Forwarded-For` → `remoteAddr`.

**Event detail formats by type:**

| Event | Detail format |
|-------|---------------|
| BB Recalculated | `N LPs · UBS BB $X.XM` |
| LP Reclassified | `LP Name → NewCls (was OldCls)` |
| LP Data Updated | `N LP records updated from <TEMPLATE_FORMAT> extraction` |
| Upload | `periodMonth · fileName · agentBank` |
| Login | `User login` |
| Abort | `Submission #N aborted` |
| Re-extraction | `Submission #N re-extracted` |
| Extraction Confirmed | `Submission #N extraction confirmed` |
| Config Change | `<Section> updated` — eligibility sections: `BUSA Advance Rate Schedule`, `Agent Advance Rate Schedule`, `Agent Rate Parameters`, `Eligibility Rules`, `Concentration Limits`, `Global Settings` |
| Match Config Change | `<Section> updated` — matching sections: `Confidence Thresholds`, `Algorithm Weights`, `Legal Entity Suffix Rules`, `Abbreviation Expansion Dictionary` |
| Field Mapping Change | `FM Alias Added: "<text>" → <canonical>` / `FM Alias Removed: "<text>"` / `FM Alias Updated: "<old>" → "<new>"` |

### `config`

Platform configuration — advance rates, eligibility rules, concentration limits, and global settings. Seeded by `V1_2__seed.sql`; editable at runtime via `PUT /api/config/*` endpoints.

| Column | Type | Notes |
|--------|------|-------|
| key | varchar(100) PK | e.g. `busa_tiers`, `elig_rules`, `conc_limits`, `global_settings` |
| value | jsonb | JSON array or object; shape varies by key |
| updated_at | timestamp | Set on upsert |

**Seeded rows (7):** `busa_tiers`, `agent_tiers`, `agent_rate_params`, `elig_rules`, `conc_limits`, `global_settings`, `matching_config`.

**Numeric value conventions:**

| Field type | Storage format | Example |
|---|---|---|
| Advance rate / percentage threshold | Whole-number integer | `90` = 90% |
| Dollar threshold | Raw integer | `500000` = $500,000 |
| Match confidence threshold | Whole-number integer | `95` = 95% (consistent with `matching_config`) |
| Snapshot frequency | Integer (days) | `30` = monthly |
| Audit retention | Integer (years) | `7` = 7 years |
| Text / mode values | String unchanged | `"Exclude"`, `"BBB- / Baa3"` |

`EligRule` rows with numeric values carry a `unit` discriminator (`'%'` or `'$'`); mode/behaviour rows omit it. This allows the calculation engine to interpret values without hard-coding knowledge of each rule by ID.

**Runtime access:** `ConfigService.load()` (`@PostConstruct`) reads all rows into a `ConcurrentHashMap<String, JsonNode>` on every API startup. All reads hit the cache; writes via `ConfigService.put()` update both the DB and the cache atomically. JSONB ↔ `JsonNode` handled via `@JdbcTypeCode(SqlTypes.JSON)` on `ConfigEntry.value`.

---

## 5. API Routes

Base path: `/api`. Full OpenAPI 3.0 specification: `pe-sub-docs/openapi.yaml` v0.7.0.  
API test collection: `pe-sub-docs/pe-sub-platform.postman_collection.json` (Postman v2.1; imports into Talend API Tester).

**Status legend:** ✅ implemented · 🔲 planned

### Facilities

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/facilities` | ✅ | List all facilities ordered by name |
| GET | `/api/facilities/:id` | ✅ | Single facility |
| POST | `/api/facilities` | ✅ | Create facility; body: `{ name, agentBank }` |
| PATCH | `/api/facilities/:id/status` | ✅ | Update facility status |

### LPs

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/lps` | ✅ | List LPs — query params: `facilityId`, `cls`, `search` |
| GET | `/api/lps/:id` | ✅ | Single LP record |
| PATCH | `/api/lps/:id` | ✅ | Update LP fields: `cls`, `clsTag`, `abb`, `inc`, `rcl`, `notes` |
| POST | `/api/lps/ingest` | ✅ | Receive extraction payload from `pe-sub-extraction`; run fuzzy name matching; write financial fields or queue for credit officer review (see below) |

#### `POST /api/lps/ingest` — actions

`LpIngestService` builds a `Prepared` index over the facility's LP names once (`prepare`), then for each extracted LP row runs `matchBest` against it (exact-match fast path + length-band pruning; see §5 Matching and Decision 46):

| Action | Condition | Effect |
|--------|-----------|--------|
| **Updated** | Score ≥ auto-accept threshold AND `!requiresReview` AND all fields ≥ 70% confidence | Writes `aum`, `capCommit`, `uc`, `agentRate`, `agentConc` on the matched LP |
| **Queued** | Medium-confidence match OR low-confidence extraction fields | No data written; returned for credit officer review |
| **Skipped** | Score below review threshold or no investor name extracted | No action |

Writes an `LP Data Updated` audit event when at least one LP is updated.

### Borrowing Base

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/bb/run/:facilityId` | ✅ | Compute Shadow BB (Java engine), persist snapshot, update `last_run_at` |
| GET | `/api/bb/snapshots/:facilityId` | ✅ | All snapshots for a facility ordered by `calculatedAt` |
| GET | `/api/bb/snapshots/:facilityId/latest` | ✅ | Latest snapshot; **204 No Content** when none exists |
| GET | `/api/bb/summary-ext/:facilityId` | ✅ | Extended portfolio summary — LP totals, IG ratio, top-10/20 concentration, classification breakdown, latest snapshot BB figures |

### Reports

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/reports/collateral/:facilityId` | ✅ | Latest snapshot summary (Collateral & Coverage) |
| GET | `/api/reports/concentration/:facilityId` | ✅ | Latest breach list (Concentration Exposures) |
| GET | `/api/reports/ear/:facilityId` | 🔲 | Effective Advance Rate history across all snapshots |

### Submissions

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/submissions` | ✅ | List all submissions; filter by `?facilityId=`; ordered newest first; `Processing` status filtered out |
| POST | `/api/submissions` | ✅ | Create submission — multipart: `facilityId`, `agentBank`, `periodMonth`, `file`, `notes?`; triggers `pe-sub-extraction` immediately; saves file to `${app.uploads.path}` |
| GET | `/api/submissions/:id` | ✅ | Single submission record or 404 |
| POST | `/api/submissions/:id/abort` | ✅ | Abort — deletes file, `submission_extractions` row, match queue entries; resets facility status if no other active submissions. **204 No Content**; **409** if already Processed or Aborted |
| POST | `/api/submissions/:id/confirm` | ✅ | Advances to `wizardStep=4`; auto-learns BB template for the agent bank; rebuilds `match_queue_entries`. Returns `{ templateSaved: boolean, agentBank: string }` |
| PATCH | `/api/submissions/:id/shadow-bb-state` | ✅ | Advances to `wizardStep=5`; persists `shadow_bb_overrides` (LP classification/rate overrides). Body: `{ overrides?: object }`. Returns updated `Submission` |
| GET | `/api/submissions/:id/extracted-lps` | ✅ | Formatted LP rows from `submission_extractions.extracted_lps` JSONB — includes `agentBBFmt`, `pctBBFmt`, `conf` (0–100) |
| GET | `/api/submissions/:id/field-map` | ✅ | Array of `{ extracted, canonical, group, note, tier }` — one per recognised column |
| GET | `/api/submissions/:id/doc-recognition` | ✅ | `{ document, format, tablesIdentified, tableLocation, headerRow, totalRows, mappedColumns, unmatchedColumns, headerInfo }` |
| GET | `/api/submissions/:id/unrecognized-columns` | ✅ | Column headers that could not be mapped to any canonical field |
| POST | `/api/submissions/:id/remap` | ✅ | Body: `{ extractedHeader, canonical }`. Creates a User-tier alias then immediately re-extracts. **200** on success; **502** if alias saved but extraction unreachable |
| POST | `/api/submissions/:id/reextract` | ✅ | Re-runs the full extraction pipeline. **204 No Content**; **502** if `pe-sub-extraction` unreachable |

### Audit

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/audit` | ✅ | All audit log entries, newest first |
| POST | `/api/audit/login` | ✅ | Record a Login event; IP resolved server-side |

### Extraction (pe-sub-extraction, port 3002)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/health` | ✅ | Service health check |
| POST | `/api/extract` | ✅ | Parse XLSX/XLS/CSV agent schedule; return `ExtractionResult` |

`POST /api/extract` accepts multipart:

| Field | Required | Description |
|-------|----------|-------------|
| `facilityId` | yes | Target facility ID |
| `file` | yes | XLSX, XLS, or CSV spreadsheet (max 50 MB) |
| `forward` | no | Forward result to `pe-sub-api/lps/ingest` (default `true`; `pe-sub-api` always passes `false`) |
| `aliasConfig` | no | JSON alias map built from live FM Dictionary; overrides built-in aliases |
| `sheetNameHint` | no | Preferred sheet name; falls back to heuristic if not found |
| `headerRowHint` | no | Known header row index; skips header detection when provided |
| `classificationConfig` | no | JSON `{ "header text": "Agent LP Classification" }` map for templates that group LPs into classification **section rows**; built by `ClassificationConfigBuilder` from `bb_template_groups`. Merged on top of the standard Agent LP Classification values, which are always recognised |

Template format is auto-detected from keywords in the first 5 rows. Header row is detected by highest canonical-alias match score across rows 0–9.

**Agent LP Classification section rows.** Many Agent BB templates separate LPs into classification groups using header rows (e.g. a row reading `Designated PWM` above the LPs in that class) rather than a per-row column, interleaving sub/total rows that must be skipped. `ClassificationRowDetector` recognises a row whose name cell matches a known group header, treats it as a section marker (not an LP), and fills its classification down onto the `AGENT_LP_CLASSIFICATION` field of every LP beneath it until the next header. A populated per-row classification column always wins over the inherited section value; sub/total rows remain filtered.

### Field Mapping

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/field-mapping/alias-groups` | ✅ | Alias-group dictionary grouped by LP Master section |
| GET | `/api/field-mapping/canonical-fields` | ✅ | All canonical fields as `{ value, label, extractable }[]` |
| GET | `/api/field-mapping/blocklist` | ✅ | Global blocklist entries |
| GET | `/api/field-mapping/suggestions` | ✅ | Pending alias suggestions |
| POST | `/api/field-mapping/suggestions` | ✅ | Submit a new alias suggestion |
| POST | `/api/field-mapping/aliases` | ✅ | Add an alias; writes `Field Mapping Change` audit event |
| DELETE | `/api/field-mapping/aliases/:id` | ✅ | Remove an alias; writes audit event |
| PATCH | `/api/field-mapping/aliases/:id` | ✅ | Update alias `text` and/or `bank`; writes audit event |

### Matching

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/matching/test` | ✅ | Body: `{ name }`. Returns `{ input, normalised, matches: [{ name, score, action }] }` — all LP names scored by Jaro-Winkler + Levenshtein |
| GET | `/api/matching/queue` | ✅ | Match queue; `?submissionId=` optional — omit to return all entries |
| PATCH | `/api/matching/queue/:id` | ✅ | Body: `{ decision?, masterName? }`. Decision stored capitalised (`Accepted`/`Rejected`/`Manual`). `masterName` sets override and forces `Accepted` |
| GET | `/api/matching/thresholds` | 🔲 | Use `GET /api/config/matching` instead |
| PATCH | `/api/matching/thresholds` | 🔲 | Use `PUT /api/config/matching` instead |

**Matching algorithm (`MatchingService`):** Jaro-Winkler + Levenshtein, combined as `jwWeight × JW + levWeight × Lev`. Both strings are normalised before scoring: abbreviation expansion → case fold → legal suffix stripping → punctuation removal. All parameters are read live from `matching_config` in the DB cache.

**Performance — `Prepared` index (Decision 46):** matching an upload's worth of rows against the bank-wide LP Master is optimised by building an immutable `Prepared` index once per upload (`prepare(names)`), then calling `matchBest(name, prepared)` per row. `Prepared` holds: the candidate list normalised once (with abbreviation/suffix regexes pre-compiled into `Config`); a `normalized → first-original` exact-match map (an identical name resolves in O(1) at score 100, e.g. re-uploading the same Agent BB); and a length-sorted index enabling a decision-safe length-band prefilter that skips candidates which provably cannot reach the review threshold. `buildMatchQueueEntries` (the `confirm` step) scores rows in parallel via `parallelStream()` (CPU-bound, row-independent, `Prepared` immutable). `MatchingService.test()` still does an exhaustive single-input scan; `LpIngestService.ingest` uses the same `prepare`/`matchBest` path (facility-scoped, sequential).

### Configuration

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/config/eligibility` | ✅ | Returns all 6 eligibility keys from DB cache. Response keys are `SCREAMING_SNAKE_CASE`: `BUSA_TIERS`, `AGENT_TIERS`, `AGENT_RATE_PARAMS`, `ELIG_RULES`, `CONC_LIMITS`, `GLOBAL_SETTINGS` |
| PUT | `/api/config/eligibility` | ✅ | Upserts a single config key; `?section=<key>` required; writes `Config Change` audit event |
| GET | `/api/config/matching` | ✅ | Returns `matching_config` from DB cache |
| PUT | `/api/config/matching` | ✅ | Replaces `matching_config`; `?section=` optional label for audit detail; writes `Match Config Change` audit event |
| GET | `/api/config/wizard` | ✅ | Implemented; returns 404 until `wizard_config` row is seeded. UI falls back to `wizardConfig.ts` |
| GET | `/api/config/audit` | ✅ | Implemented; returns 404 until `audit_config` row is seeded. UI falls back to `auditConfig.ts` |
| GET | `/api/config/reports` | ✅ | Implemented; returns 404 until `report_config` row is seeded. UI falls back to `reportConfig.ts` |

### Notifications

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/notifications/events` | ✅ | SSE stream (`text/event-stream`). Broadcasts facility status changes, BB runs, LP reclassifications, and upload events. Keep-alive; no timeout under normal operation |

---

## 6. Process Flow Alignment

### Step 4 — Final Shadow BB (LP record fields)

The production `lp_records` table schema mirrors the BB_PROCESS_FLOW Step 4 field set. `inv_type` (`Institutional` | `HNW`) covers both "Investor Type" and "Institutional vs HNW".

### Step 6 — Portfolio-Level Reporting

Reports screen tabs correspond 1:1 to Step 6 outputs:

| Step 6 Output | Tab ID | API endpoint | Status |
|---------------|--------|--------------|--------|
| Collateral Market Value & Coverage | `collateral` | `/api/reports/collateral/:id` | ✅ |
| Effective Advance Rates | `ear` | `/api/reports/ear/:id` | 🔲 |
| Agent Bank Exposure | `agent-bank` | TBD | 🔲 |
| Concentration Exposures | `concentration` | `/api/reports/concentration/:id` | ✅ |
| Ad Hoc Reporting | `adhoc` | TBD | 🔲 |

### Scheduled Batch Job

One system-managed job planned: runs on the 1st of each month, resets all `Active` facility statuses to `Not Started`. The `snapshot-freq` global setting (default 30 days) is intended to drive automatic Shadow BB recalculation scheduling in `pe-sub-jobs`. Neither job is implemented yet.

---

## 6a. Business Process Clarifications

### Shadow BB — When It Is Prepared

A Shadow BB is only prepared when a **credit decision is required**: renewal, amendment, or new origination. It is **not** produced for every agent BB received. Two analysts (in different locations) independently prepare the Shadow BB. Once complete, the Account/Transaction Manager reviews for accuracy (4-eye check).

**Workflow and approval routing** (e.g. formal sign-off steps, escalation paths) are **out of scope for Phase 1**. Record as a future consideration for Phase 2.

**No internally produced Shadow BB certificate is required.** The facility status changes to `Active` once the Shadow BB run is accepted — there is no separate certificate step or document submission.

**Facility workflow status values:**

| Status | Meaning |
|--------|---------|
| `Not Started` | No Shadow BB submission processed for this cycle |
| `In Progress` | Agent BB uploaded; analyst is working through matching, classification, and Shadow BB |
| `Needs Review` | Submission has unresolved LP matches or eligibility issues requiring credit officer action |
| `Active` | Shadow BB completed and accepted for this cycle |

### LP Master — Data Sources and Governance

- **AUM and ratings** are sourced manually by analysts from internet searches, rating agency websites (S&P, Moody's, Fitch), and **Pitchbook** (web-based LP intelligence service).
- **Two individuals** on the PE Sub Management team compile and maintain the LP Master for reporting purposes.
- **No authorization is required** to create a new LP record. The only prerequisites are: (a) the LP must appear in the agent BB, and (b) all figures must be verified as accurate.

### Concentration Limits

- Concentration limits are always assigned at the **individual LP level**.
- Some facilities may additionally carry an **overall class concentration limit** (e.g. a cap on total exposure to Unrated LPs) on top of the per-LP limit.
- The concentration limit is calculated against **total uncalled capital**, not facility size.

---

## 6b. Roles & Access Control (RBAC)

The platform operates with **two roles** — **Analyst** and **Account/Transaction Manager** — consolidated from three legacy roles (Credit Officer, Supervisor, Admin; see Decision 27). Workflow ownership is per-submission: the Analyst who uploads an Agent BB owns all active steps for that submission until it is certified or reassigned by an Account/Transaction Manager.

- **Analyst** — day-to-day operator and system configurator. Uploads Agent BBs, resolves LP match queues, runs Shadow BB calculations, edits LP Master classifications, and manages credit agreement configuration. Owns submissions they upload; can view any colleague's submission read-only.
- **Account/Transaction Manager** — operational ownership and 4-eye review authority. Performs the 4-eye check on completed Shadow BB analyses, can act on **any** submission regardless of ownership, reassigns workflow ownership, and has full cross-facility read and audit-trail visibility. Does **not** perform day-to-day configuration changes.

| Capability | Analyst (owner) | Analyst (other) | Account/Transaction Manager |
|---|:---:|:---:|:---:|
| Upload Agent BB / View Shadow BB / Export Certificate | ✓ | ✓ | ✓ |
| Review Extraction / Resolve Match Queue / Run Shadow BB | ✓ | view | ✓ |
| LP Master (edit classification) | ✓ | — | ✓ |
| Configuration / Match Thresholds / Field Mapping (edit) | ✓ | ✓ | — |
| Reassign ownership / Override any active step | — | — | ✓ |
| Audit Trail | own facilities | — | all facilities |
| User management | ✓ | ✓ | — |

**Source of truth:** [`pe-sub-platform/docs/RBAC_ROLES.md`](../pe-sub-platform/docs/RBAC_ROLES.md) holds the full permission matrix, Dashboard Resume-CTA mapping, and future auth-integration notes. DB role values are stored verbatim as `'Analyst'` | `'Account/Transaction Manager'` (see the `users` table in §4). Authentication is not yet implemented (Gap G6) — UI gates are a UX aid, not a security boundary; all write endpoints will enforce ownership + role checks server-side.

---

## 7. Key Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Flat repos, not a monorepo | Simpler ownership and navigation; monorepo tooling overhead unjustified at this scale |
| 2 | `pe-sub-infra` contains Kubernetes manifests, not Terraform | Terraform deferred until Azure architecture is confirmed. Kubernetes manifests enable immediate local cluster deployment and will serve as the basis for AKS when the cloud target is ready |
| 3 | BB engine implemented in both Java (`pe-sub-api`) and TypeScript (`pe-sub-ui`) | Java engine is authoritative and persists snapshots. TypeScript engine powers client-side live preview in Shadow BB screen. Both must produce identical numbers |
| 4 | `pe-sub-db` deleted (2026-05-31) | Was a Drizzle ORM schema/seed package, never a runtime dependency. Schema is now defined exclusively by Flyway SQL migrations |
| 5 | Computed BB fields not stored in `lp_records` | `rate`, `ubb`, `delta`, `uec` are derived — storing them would create drift risk. Only source fields and `agent_bb` (agent-submitted) are persisted |
| 6 | `bb_snapshots.result` as jsonb | Full `BBResult` stored as typed JSON; enables historical reporting without denormalising LP arrays into rows |
| 7 | Vite dev proxy for `/api` | Avoids CORS config in development; prod will route through Azure Front Door or API Management |
| 8 | No mock data fallbacks in production services | Service layer returns empty arrays on API failure; no fake data leaks into production UI |
| 9 | Prototype (`pe-sub-platform`) retained as-is | Continues as the requirements reference |
| 10 | Terraform target: Azure | Cloud provider confirmed; `pe-sub-infra` to be scaffolded when Azure architecture is designed |
| 11 | `pe-sub-common` dissolved into `pe-sub-ui/src/types/` | Once the API moved to Spring Boot (Java), the shared-TypeScript premise broke. Only two files imported from `pe-sub-common`; merged and repo deleted |
| 12 | Configuration persisted to DB; TypeScript files are fallbacks | Config is editable at runtime via `PUT /api/config/*` without a deployment. TypeScript constants in `pe-sub-ui/src/config/` are offline fallbacks; `configService.ts` falls back to them transparently on API error |
| 13 | `lei` field on LP records — deferred | LP identity field for LEI or internal counterparty ID. Decision pending: whether to use LEI or internal UBS counterparty ID as the canonical identifier for REST-based classification auto-population. Field not in current schema |
| 14 | Audit trail: `user_name` stored denormalized, not via FK | `audit_log.user_id` reserved for future auth. A separate `user_name varchar(100)` stores the display name at write time. When auth is added, both columns will be populated |
| 15 | `ConfigEntry.value` uses `@JdbcTypeCode(SqlTypes.JSON)` not `@Convert` | Hibernate 6 routes UPDATE bindings through `ObjectJdbcType` which the PostgreSQL JDBC driver rejects. `@JdbcTypeCode(SqlTypes.JSON)` uses Hibernate 6's native JSON binding path, which works for both INSERT and UPDATE |
| 16 | Vite dev proxy sets `X-Forwarded-For` | Without this, Spring Boot sees `remoteAddr = 127.0.0.1` for all requests. The proxy sets `X-Forwarded-For` to the browser's socket address; `AuditLogService.extractIp()` records workstation IPs correctly |
| 17 | `pe-sub-extraction` as a separate service, not a module in `pe-sub-api` | Document parsing (Apache POI, Commons CSV) adds significant dependencies and a different scaling profile. Keeping extraction separate means `pe-sub-api` has no file-parsing code; the extraction service can be updated or replaced independently |
| 18 | Config numeric values: whole-number integers for rates/percentages | Rates stored as 90 (not "90%" or 0.90) for consistency with `matching_config` (autoAccept: 95). Dollar thresholds stored as raw integers. Text/mode values unchanged. `EligRule` rows carry a `unit` discriminator so callers know how to interpret values without hard-coding per-rule logic |
| 19 | `LpIngestService.matchBestInList` scoped to facility | `MatchingService.test()` matches against all LPs. Ingest needs facility-scoped matching. Added `matchBestInList(name, candidates)` that accepts a pre-filtered name list and reuses all private scoring methods, avoiding duplication |
| 20 | Audit logging in `LpController`, not `LpIngestService` | `HttpServletRequest` (needed for IP extraction) is available in the controller layer. Services should not depend on request context |
| 21 | Configuration screen is self-service | All five config sections (BUSA rates, Agent rates, Eligibility Rules, Concentration Limits, Global Settings) are now editable via `PUT /api/config/eligibility` with per-section save and audit logging. Dropdown controls used for constrained fields to prevent invalid values |
| 22 | BB template registry auto-learned on confirm | `bb_templates` is populated on first `POST /{id}/confirm` for each agent bank (case-insensitive). Subsequent uploads for that bank pass `sheetNameHint` and `headerRowHint` to `pe-sub-extraction`, bypassing heuristic detection and reducing mis-detection risk |
| 23 | Upload triggers extraction immediately; no manual step | `POST /api/submissions` calls `pe-sub-extraction` inline with `forward=false`, stores the result in `submission_extractions`, and advances the submission status to `Review`. There is no separate "trigger extraction" step in the UI |
| 24 | Re-extraction on every Map or Discard action | After mapping or discarding an unrecognised column in the ExtractionPreview screen, the UI automatically calls `POST /{id}/reextract` → `GET /{id}/extracted-lps` before re-rendering. No manual Re-extract button |
| 28 | Upload checks submission status before navigating to ExtractionPreview | When `pe-sub-extraction` is unreachable, `POST /api/submissions` returns the submission with `status = 'Error'` and no `submission_extractions` row exists. The UI checks `sub.status === 'Error'` after upload and surfaces an inline error instead of navigating to ExtractionPreview, preventing a guaranteed 404 cascade on all extraction sub-endpoints |
| 29 | ExtractionPreview state initialises to empty arrays, not prototype data | All five stateful arrays in ExtractionPreview (extracted, fieldMap, docRec, canonicals, unrecog) are initialised to `[]`. Initialising with prototype constants meant any API failure left prototype data visible — the catch block only set `loadError` without clearing state. Prototype data is returned by the service layer when `screenMode === 'prototype'`; the component never holds it directly |
| 25 | Null-marker filtering at two levels | N/A, N/R, NA, NR values are filtered at extraction time: (a) row-level — entire row skipped if investor name is a null marker; (b) field-level — cell value stored as null with a "value missing" warning |
| 26 | `CANONICAL_META` in SubmissionController for field-map labelling | A static map in `SubmissionController.java` keys extraction_key or canonical name to `(canonical, group)`. Used to label field-map rows returned by `GET /{id}/field-map`. Non-extractable fields are keyed by canonical name; extractable fields by extraction_key. Without this map, matched fields appeared in group "Other" |
| 27 | Two-role RBAC: Analyst and Account/Transaction Manager | Consolidated from three roles (Credit Officer, Supervisor, Admin). Analyst performs day-to-day Shadow BB construction and inputs: uploads Agent BBs, resolves LP match queues, runs Shadow BB calculations, manages credit agreement configuration, and edits LP Master records. Account/Transaction Manager holds operational ownership and 4-eye review authority: can act on any submission regardless of ownership, reassign workflow ownership, view the full cross-facility audit trail, and override LP classifications on non-owned submissions. Configuration edits are Analyst-only; Account/Transaction Manager has view-only access to configuration. See `pe-sub-platform/docs/RBAC_ROLES.md` for the full permission matrix |
| 30 | `LP Classification` split into Agent LP Classification + UBS LP Classification (2026-06-12) | The single canonical field conflated the agent's own category label (lifted verbatim from the Agent BB doc) with UBS's computed advance-rate tier. Split into **Agent LP Classification** (raw input, extraction_key `AGENT_LP_CLASSIFICATION`; standard values: Rated Included, Non-Rated Included, Designated Institutional, Designated PWM, Largest 5 Designated, Aggregate Designated PWM) and **UBS LP Classification** (derived tier: Rated / Unrated >2bn / Unrated 1–2bn / Eligible / Excluded). Applied across `fm_canonical_fields` (V1_6), pe-sub-ui + prototype Field Mapping Dictionaries, and the extraction `AGENT_LP_CLASSIFICATION` key |
| 31 | Agent LP Classification section rows handled in extraction, configured via `bb_template_groups` | Agent templates frequently group LPs into classification sections using header rows (e.g. "Designated PWM") rather than a per-row column, interleaving sub/total rows. `ClassificationRowDetector` (pe-sub-extraction) recognises these via the standard values plus a per-agent `classificationConfig` JSON (`header_text → classification`) built by `ClassificationConfigBuilder` from `bb_template_groups`, fills the value down onto LPs beneath the header, and lets a populated per-row column override the inherited value. `bb_template_groups.header_text` stores the agent document's literal grouping text; `classification` stores the resolved canonical value. Onboarding a new template variant is configuration (sheet/header/skip-keywords/aliases/sections), not code — see §8 |

---

## 8. Gaps and Open Questions

### Known implementation gaps

| # | Gap | Impact | Notes |
|---|-----|--------|-------|
| G1 | **`BbCalculationService` uses hardcoded rates and thresholds** | Config screen changes have no effect on calculations | `BUSA_RATES` Map and all `detectBreaches` thresholds (0.15, 0.60, 0.50, 0.30) are hardcoded in Java. Must be wired to `ConfigService` to make the Configuration screen meaningful for calculations |
| G2 | **TypeScript BB engine (`bbCalculationService.ts`) also hardcoded** | Client-side live preview diverges from configurable values | Same issue as G1; both engines must be updated together (see Decision 3) |
| G3 | **`pe-sub-jobs` is empty** | No scheduled recalculations or async processing | Service skeleton exists (port 3003, Kubernetes manifest); no jobs implemented. `snapshot-freq` global setting is stored correctly but not consumed |
| G4 | **LP Match Queue — API implemented, UI not yet built** | Ingest "Queued" rows can be retrieved via API but cannot be reviewed in the UI | `GET /api/matching/queue` and `PATCH /api/matching/queue/:id` are implemented. The MatchQueue screen exists in the UI (skeleton) but the credit officer review workflow is the next milestone |
| G6 | **Authentication not implemented** | All user context hardcoded to "J. Smith" | No session management, no role enforcement. Affects every audit log entry, every LP reclassification, and every config change |
| G7 | **`_eligCache` stale after Configuration screen saves** | Saving config, then navigating away and back returns pre-edit values until page refresh | Module-level promise cache in `configService.ts` is not invalidated by `PUT /api/config/eligibility`; `Configuration/index.tsx` bypasses the cache (calls `api.config.eligibility()` directly) but other consumers still hit the stale cache |
| G8 | **`wizard_config`, `audit_config`, `report_config` not seeded** | `GET /api/config/wizard`, `/audit`, `/reports` always return 404 | UI falls back to local TypeScript constants transparently, but config is not editable or DB-backed for these three sections |
| G9 | **Reports: Agent Bank Exposure** | One of four Step 6 report types not implemented | Agent bank exposure endpoint is planned but not built |
| G10 | **`lp_records` financial fields stored as `VARCHAR`** | `aum`, `cap_commit`, `uncalled_capital`, `agent_rate`, `agent_bb`, `agent_conc` etc. are `VARCHAR(50)` columns containing formatted money strings (`"$25.0M"`). Calculations use `BbCalculationService.parseMoney()` to convert at runtime | Should be `NUMERIC` columns; string parsing is fragile and prevents direct SQL aggregation |

### Open questions

- **Azure architecture**: Container Apps vs App Service, region, networking, Key Vault integration
- **Authentication**: Azure AD (Entra ID) SSO vs internal auth — to be confirmed. Unblocks G6
- **LP identifier (Decision 13)**: LEI vs internal UBS counterparty ID — decision pending
- **`pe-sub-infra` → AKS**: when Azure architecture is confirmed, extend Kubernetes manifests for AKS (registry, ingress, managed identity, secrets from Key Vault)

---

> **Note on `PE-Sub-Platform-Solution-Design.docx`:** The Word document is a point-in-time export and is no longer maintained in sync automatically. `SOLUTION_DESIGN.md` is the canonical reference.

---

## 9. Agent Bank Portfolio

### 9.1 Live Facility Registry

Source: *Agent Bank Summary.xlsx* (extracted 2026-06-12). All facilities are **Active** status.  
Grand total committed loan volume: **$10,555,217,539** across **17 agent banks** and **71 facility rows**.

| Agent Bank | `template_format` | Facilities | Committed Volume (USD) | Templates known | Notes |
|---|---|---|---|---|---|
| Wells Fargo | `WELLS_FARGO` | 16 | $3,183,224,809 | **2** (Class A + Class B) | Blue Owl GP Stakes V (Class A — prior GS template, WF current agent); Petershill IV (Class B) |
| Bank of America | `BANK_OF_AMERICA` | 16 | $2,224,406,381 | 0 | Template not yet received |
| JP Morgan | `JPM` | 6 | $947,357,895 | 0 | Partial FM aliases exist; full template not received |
| Silicon Valley Bank¹ | `SILICON_VALLEY_BANK` | 10 | $925,961,540 | **1** (Class C) | Arctos American Football Fund; 5 paired Committed/Uncommitted tranches; may use variants per fund |
| Morgan Stanley | `MORGAN_STANLEY` | 4 | $677,535,718 | 0 | Template not yet received |
| SMBC | `SMBC` | 2 | $464,705,883² | 0 | Template not yet received |
| Mizuho | `MIZUHO` | 2 | $370,000,000 | 0 | Template not yet received |
| BMO | `BMO` | 2 | $332,500,000 | 0 | Template not yet received |
| Natixis | `NATIXIS` | 2³ | $300,000,000 | 0 | Template not yet received |
| CIBC | `CIBC` | 1 | $165,000,000 | 0 | Template not yet received |
| M&T Bank | `MT_BANK` | 1 | $165,000,000 | 0 | Template not yet received |
| PNC | `PNC_BANK` | 1 | $150,000,000 | 0 | Already in `template_format`; full template not received |
| BNYM | `BNY_MELLON` | 1 | $150,000,000 | 0 | Template not yet received |
| Societe Generale | `SOCIETE_GENERALE` | 2 | $150,000,000 | 0 | Template not yet received |
| City National Bank | `CITY_NATIONAL` | 1 | $125,000,000 | 0 | Template not yet received |
| UBS Bank USA | `UBS_BANK_USA` | 1 | $125,000,000 | 0 | UBS acting as own agent; template TBD |
| Lloyds | `LLOYDS` | 1 | $99,525,317 | 0 | Template not yet received |

**Template coverage:** 3 known templates across 2 active agents (Wells Fargo × 2, SVB × 1). 15 agents have no template received. Minimum expected: 17 templates (one per agent); actual count likely higher given Wells Fargo's confirmed multi-format pattern and SVB's 10-facility range.

¹ Full legal name in summary: "Silicon Valley Bank (A division of First Citizens Bank)"  
² SMBC sub-total in source shows $164,705,883 (NB PD IV only) but the sheet also lists West Street Mezz VIII at $300,000,000. Source total is likely a data entry error — confirmed total to be validated with Credit before seeding  
³ Two account-number rows for the same deal (CD&R X, VI, XII [U]): $292,050,000 + $7,950,000 = $300,000,000 total

### 9.2 UBS Internal Account Numbers

Every facility row in the Agent Bank Summary carries a UBS loan reference in the format `5Vxxxxx` (e.g., `5VX1796`). This is the operational identifier used by UBS Credit for loan administration and must be stored in the `facilities` table as a first-class field. It is distinct from the agent bank's internal deal number.

### 9.3 Structural Patterns in the Portfolio

**Committed / Uncommitted tranche pairs (SVB only)**  
Five SVB borrowers each have two separately account-numbered loans — one Committed and one Uncommitted tranche with equal amounts. Each tranche generates its own monthly BB submission:

| Borrower | Committed account | Uncommitted account | Amount each |
|---|---|---|---|
| Arctos Keystone Partners Fund I | 5VZ9848 | 5VZ9849 | $100,480,770 |
| Arctos American Football Fund | 5VZ4752 | 5VZ4753 | $75,000,000 |
| Audax Private Equity Fund VII LP | 5VAB067 | 5VAB068 | $120M / $180M |
| COMVEST CREDIT PARTNERS VII | 5VY7714 | 5VY7842 | $50,000,000 |
| Arctos Sports Fund II | 5VY4509 | 5VY4577 | $105M / $70M |

**Multi-fund umbrella facilities**  
Several facilities span multiple underlying funds, encoded in the borrower name: e.g., `HIG LBO IV, BH III, GB&E III, IV [U]`, `CD&R X, VI, XII [U]`, `HarbourVest Dover St. X, X AIF, XI [U]`. The `[U]` suffix denotes Uncommitted tranche. LP Master records for these facilities cover investors in all named underlying funds combined.

**Tranched large facilities**  
Wells Fargo Blue Owl GP Stakes V is split across two account numbers ($240,119,760 + $59,880,330 = $300,000,124) and Natixis CD&R across two rows ($292,050,000 + $7,950,000 = $300,000,000). These are participations in a single legal facility divided across UBS loan accounts.

---

## 10. Multi-Agent Template Strategy

### 10.1 Template Class Taxonomy

Three structurally distinct template classes emerge from the three known templates. A single agent bank (Wells Fargo) is confirmed to use both Class A and Class B — demonstrating that **agent bank identity alone does not determine template class**. Template class must always be auto-detected from sheet content at extraction time (see Decision 43).

| Class | Classification source | Ratings columns | Summary structure | Confirmed agent(s) |
|---|---|---|---|---|
| **A — Full BB Schedule, group-header classification** | Separate classification header rows between LP data rows (`Rated Investors` / `Unrated Investors` / `Eligible Investors` / `Excluded Investors`) | Text ratings + numerical 0–9 scale | Tranche A + Tranche B sub-tables | Wells Fargo (Blue Owl GP Stakes V — template originally submitted under prior agent Goldman Sachs Bank USA) |
| **B — Full BB Schedule, column-based classification** | Per-row "Investor Category" column | Text only (S&P / Moody's) | Single summary table | Wells Fargo (Petershill IV) |
| **C — Simplified Callable Capital** | No classification column; credit officer assigns at Wizard Step 5 | None | Header block only (fund name, reporting date) | Silicon Valley Bank (First Citizens) |

**Unclassified agents (0 templates received):** Bank of America, JP Morgan, Morgan Stanley, SMBC, Mizuho, BMO, Natixis, CIBC, M&T Bank, PNC, BNYM, Societe Generale, City National Bank, UBS Bank USA, Lloyds.

These 15 agents may use any of the three known classes or introduce new structural variants. Given Wells Fargo's confirmed multi-format pattern, the portfolio should be assumed to contain **17 or more distinct template formats**. Each new template received must be assigned a class, and new classes defined if required.

### 10.2 Template A — Wells Fargo, Variant 1 (Blue Owl GP Stakes V)

> **Agent history note:** This template was submitted under the header "Blue Owl GP Stakes V BB by Goldman Sachs Bank USA". Goldman Sachs Bank USA is **not** a current active agent in the portfolio. Blue Owl GP Stakes V is now administered by Wells Fargo (accounts 5VAD225, 5VW9761). The template structure and FM aliases are attributed to `WELLS_FARGO`. Goldman Sachs Bank USA may have been the prior administrative agent before the facility transferred.

**Sheet structure:**
Two summary sub-tables precede LP data. LP rows are grouped under classification header rows; color-coded rows signal reclassification and transferee status. Subtotal rows follow each group; a grand Total row closes the sheet.

| Block | Content |
|---|---|
| Tranche A summary | Borrowing Base · Eligible Remaining Commitments · Total Remaining Commitments · Effective Advance Rate |
| Tranche B summary | Tranche B Excluded LPs · Total Eligible Remaining Commitments · Tranche B Advance Rate · Tranche A Maximum Commitments · Tranche B Borrowing Base |
| Classification header rows | `Rated Investors` / `Unrated Investors` / `Eligible Investors` / `Excluded Investors` |
| Row color coding | Pink = Reclassified (`rcl = true`); Blue = Transferee (`transferee = true`) |

**LP data columns and FM Dictionary mappings (bank = `WELLS_FARGO`):**

| Template header | Canonical field | Notes |
|---|---|---|
| Investor | `INVESTOR_NAME` | |
| Parent / Sponsor / Manager | `PARENT` | |
| S&P | `SP` | Short-form header — distinct alias from Variant 2's "S & P's Rating" |
| Moody's | `MDY` | Short-form header |
| Net Assets (range) | `NAV` | Range label, e.g. "$1bn – $5bn" |
| Individual Original Commitment | `CAP_COMMIT` | Per-LP capital commitment |
| Original Commitment | `CAP_COMMIT_TOTAL` | Aggregate — not persisted to `lps` |
| Individual Unfunded Commitment | `UC` | Per-LP uncalled; primary sort field |
| Unfunded Capital Commitment | `UC_TOTAL` | Aggregate — not persisted |
| % Called | `PCT_CALLED` | |
| % Total Unfunded Commitment | `PCT_UNCALLED` | |
| % Eligible Unfunded Commitment | `PCT_ELIGIBLE_UNCALLED` | Computed — not persisted |
| Concentration Limit | `AGENT_CONC` | |
| Excess Concentration | `CONC_EXCESS` | Computed — not persisted |
| Eligible Commitment | `ELIGIBLE_COMMITMENT` | Computed — not persisted |
| Advance Rate | `AGENT_RATE` | |
| Borrowing Base Contribution | `ABB` | Agent-submitted BB value |
| % of Borrowing Base | `PCT_BB` | Computed — not persisted |
| S&P (0–9 scale) | `SP_NUM` | Deferred — not persisted (see Decision 35) |
| Moody's (0–9 scale) | `MDY_NUM` | Deferred — not persisted |
| Applicable Rating (0–9 scale) | `APPLICABLE_RATING_NUM` | Deferred — not persisted |

### 10.3 Template B — Wells Fargo, Variant 2 (Petershill IV)

**Sheet structure:**
Single summary table at the top. LP rows are flat (no group headers); each row carries an Investor Category column that drives classification. An unnamed first column contains a row identifier. An Eligibility column at the far right maps to the `inc` flag.

**LP data columns and FM Dictionary mappings (bank = `WELLS_FARGO`):**

| Template header | Canonical field | Notes |
|---|---|---|
| [unnamed column] | `ROW_ID` | Sequence or identifier — not persisted |
| Investor | `INVESTOR_NAME` | |
| Investor Category | `CLS` | Per-row classification label, e.g. "Rated Investors" |
| S & P's Rating | `SP` | Long-form header — distinct alias from Variant 1's "S&P" |
| Moody's Rating | `MDY` | Long-form header |
| Net Assets (range) | `NAV` | |
| Individual Original Commitment | `CAP_COMMIT` | |
| Original Commitment | `CAP_COMMIT_TOTAL` | Not persisted |
| Individual Unfunded Commitment | `UC` | |
| Unfunded Capital Commitment | `UC_TOTAL` | Not persisted |
| % Called | `PCT_CALLED` | |
| % Total Unfunded Commitment | `PCT_UNCALLED` | |
| % Eligible Unfunded Commitment | `PCT_ELIGIBLE_UNCALLED` | Not persisted |
| Concentration Limit | `AGENT_CONC` | |
| Excess Concentration | `CONC_EXCESS` | Not persisted |
| Eligible Commitment | `ELIGIBLE_COMMITMENT` | Not persisted |
| Advance Rate | `AGENT_RATE` | |
| Borrowing Base Contribution | `ABB` | |
| % of Borrowing Base | `PCT_BB` | Not persisted |
| Eligibility | `INC` | Maps to boolean `inc`; text values to be confirmed (e.g., "Eligible" / "Excluded") |

**Structural differences from Variant 1:** No numerical rating columns; no Tranche B summary table; Fitch column absent; explicit Eligibility column rather than classification inferred from group header rows; "Investor Category" per-row column present. Both variants share `bank = WELLS_FARGO` in the FM Dictionary — the alias resolver applies all WF aliases; structural detection in the extraction service handles parsing logic differences (see Decision 43).

### 10.4 Template C — Silicon Valley Bank / First Citizens (Arctos American Football Fund)

**Sheet structure:**
Header block (fund name, reporting date) followed by a flat LP table. Investors are divided into two sections — "Total included investors" and "Excluded Investors" — by a section header row (identical pattern to Class A group headers but binary Included/Excluded only). No ratings, no advance rate, no BB contribution column.

**LP data columns and FM Dictionary mappings (bank = `SILICON_VALLEY_BANK`):**

| Template header | Canonical field | Notes |
|---|---|---|
| Investor Name | `INVESTOR_NAME` | |
| Committed Capital | `CAP_COMMIT` | |
| Called Capital | `CALLED_CAP` | |
| Recallable Distributions | `RECALLABLE_DIST` | New field — affects drawable capital; see Decision 38 |
| Excess Concentration | `CONC_EXCESS` | Not persisted |
| Remaining Callable Capital | `UC` | Equivalent to Unfunded Capital Commitment in other templates |
| Remaining Callable Capital Adjusted for Concentration Limit | `UEC` | Directly computed in template — not persisted (derived by BB engine) |

**Key distinction:** Advance Rate and Borrowing Base Contribution are absent. These cannot be extracted — they must be derived after the credit officer assigns LP classification in Wizard Step 5. Until classification is set, `agent_rate` and `abb` remain null on LP records for SVB facilities.

### 10.5 Computed Fields — Extraction vs. Persistence Policy

The following canonical fields appear in agent templates but are computed values, not source data. They must be extracted into the `ExtractionResult` for review in the Extraction Preview screen, but must **not** be persisted to the `lp_records` table (consistent with Decision 5):

| Canonical field | Computed as |
|---|---|
| `PCT_ELIGIBLE_UNCALLED` | LP uncalled ÷ total eligible uncalled |
| `ELIGIBLE_COMMITMENT` | LP uncalled − concentration excess |
| `CONC_EXCESS` | MAX(0, LP uncalled − concentration limit × total uncalled) |
| `PCT_BB` | LP ABB ÷ total ABB |
| `UC_TOTAL` | Aggregate uncalled (facility-level) |
| `CAP_COMMIT_TOTAL` | Aggregate capital commitment (facility-level) |

### 10.6 New LP Table Fields Required

The following fields were required in the `lp_records` table to support the full agent template set. Both are now present in `V1_1__schema.sql`.

| Field | Type | Source template(s) | Notes |
|---|---|---|---|
| `transferee` | `BOOLEAN NOT NULL DEFAULT FALSE` | Wells Fargo — Template A (Class A, Variant 1) | ✅ Exists. Set when POI detects blue row background; indicates the LP entered via transfer, not original subscription |
| `recallable_dist` | `VARCHAR(50)` (or `NUMERIC` per G10 resolution) | Silicon Valley Bank (Template C) | ✅ Exists. Recallable distributions reduce net unfunded capital; NULL for non-SVB facilities |

---

## Additions to §7 — Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 30 | `facilities` table enriched with UBS operational metadata | Add `account_number VARCHAR(20)` (UBS loan ref, e.g., `5VX1796`), `loan_amount NUMERIC(15,2)`, `maturity_date DATE`, `collateral_date DATE`, `bank_status VARCHAR(50)`, `bank_status_date DATE`. `bank_status` is the credit/operational status (Active / Terminated) — separate from the workflow `status` column. Without these fields the facility record has no link to UBS loan administration systems and the Agent Bank Exposure report (G9) cannot be built. |
| 31 | SVB Committed / Uncommitted tranches are modelled as separate `facilities` rows | Each tranche has a distinct UBS account number, its own loan amount, and its own monthly BB submission cycle. No parent-child tranche sub-table is introduced. The tranche type is encoded in the facility name (e.g., "Arctos American Football Fund (Committed)"). Merging into one row would require a sub-table and complicate the submission/extraction workflow with no measurable benefit. |
| 32 | `template_format` enum expanded to cover all 17 active portfolio agents | New values added: `BMO`, `BNY_MELLON`, `CIBC`, `CITY_NATIONAL`, `LLOYDS`, `MT_BANK`, `MIZUHO`, `MORGAN_STANLEY`, `NATIXIS`, `SILICON_VALLEY_BANK`, `SMBC`, `SOCIETE_GENERALE`, `UBS_BANK_USA`. `JPM`, `BANK_OF_AMERICA`, `WELLS_FARGO`, `PNC_BANK` already exist. `GOLDMAN_SACHS` remains in the enum for historical submissions but is not an active portfolio agent. `CITIZENS_FINANCIAL` is retired — Citizens Financial Group is a separate institution; SVB is now a First Citizens division and is covered by `SILICON_VALLEY_BANK`. |
| 33 | Bank-scoped FM Dictionary aliases seeded for 2 active agents (WF both variants + SVB); priority order for remaining agents by volume | The `fm_aliases.bank` column supports bank-scoped aliases. `V1_8` pre-seeds all Wells Fargo aliases (covering both Class A and Class B variants under `bank = WELLS_FARGO`) and all Silicon Valley Bank aliases (`bank = SILICON_VALLEY_BANK`) from §10.2–10.4. Both WF variant alias sets coexist under the same bank key; the alias resolver fires whichever headers are present in the file — no per-variant discrimination needed. Priority for template solicitation from remaining 15 agents: Bank of America ($2.22B, 16 facilities) → JP Morgan ($947M, 6) → Morgan Stanley ($678M, 4) → SMBC ($465M, 2) → Mizuho ($370M, 2). |
| 34 | LP classification detection strategy is template-class-specific, not agent-specific | Class A (WF Variant 1): `cls` derived from group-header rows — extraction service tracks the current group header row and stamps it as `cls` on each subsequent LP row until the next header. Class B (WF Variant 2): `cls` read directly from the "Investor Category" per-row column via FM Dictionary alias. Class C (SVB): no classification present; `cls` defaults to blank; credit officer assigns at Wizard Step 5. Template class is determined at extraction time by structural heuristics (see Decision 43), not by agent bank identity. |
| 35 | Numerical ratings columns (Class A 0–9 scale) — deferred | Class A template (WF Variant 1, Blue Owl GP Stakes V) contains S&P (0–9), Moody's (0–9), and Applicable Rating (0–9) columns alongside text ratings. Text ratings (`sp`, `mdy`, `fitch`) are canonical; the 0–9 numerical scale appears to be a convention from the prior Goldman Sachs administration of this facility. The Applicable Rating column replicates the advance rate eligibility determination that the BB engine already makes from text ratings. No new `lps` columns for numerical ratings in the initial implementation; if a future Wells Fargo submission retains this convention, the decision will be re-evaluated. |
| 36 | Row colour coding detected via Apache POI cell background; drives `rcl` and `transferee` flags | Class A template (WF Variant 1) uses pink cell background for Reclassified LPs (`rcl = true`, existing field) and blue for Transferee LPs (`transferee = true`, new field — see §10.6). Apache POI `XSSFCellStyle.getFillForegroundColorColor()` is used per row at extraction time. No equivalent colour convention is confirmed for Class B or C; any agent template received in future may introduce its own colour conventions. |
| 37 | "Individual" vs. aggregate commitment columns — "Individual" maps to LP Master, aggregates discarded | Both WF template variants contain paired commitment columns: Individual Original Commitment / Original Commitment and Individual Unfunded Commitment / Unfunded Capital Commitment. "Individual" = this LP entity's per-fund line amount — the correct value for the LP Master. Aggregate variants = facility- or fund-level totals; extracted for display in ExtractionPreview but not persisted to `lps`. FM Dictionary maps "Individual Original Commitment" → `CAP_COMMIT`; "Individual Unfunded Commitment" → `UC`. Expect other agents' templates to follow the same pattern; FM aliases handle header text variations per bank. |
| 38 | SVB "Recallable Distributions" requires a new `lps.recallable_dist` field | SVB Template C (Class C) includes Recallable Distributions — previously distributed capital that can be recalled and reduces the net remaining callable capital. This affects the drawable capital calculation for SVB facilities. A new `lps.recallable_dist` column is required; it defaults to NULL for all non-SVB templates. The BB engine must be updated to subtract recallable distributions from `uc` when computing uncalled capital for affected SVB facilities. This field may also be required if any of the 15 unclassified agents uses a similar callable-capital template structure. |
| 39 | UBS Bank USA as agent bank — no special treatment | Edison Partners XI LP (account 5VY6837, $125M, maturity 10/14/2026) is agented by UBS Bank USA itself. Despite UBS being the Shadow BB analysis entity, this facility flows through the same extraction and ingest pipeline as any other agent bank and uses `template_format = UBS_BANK_USA`. Internal template format assignment follows first confirmed extraction. |
| 40 | SMBC committed volume discrepancy — confirm before seeding | The source summary shows SMBC "Totals Loan Amount: $164,705,883" but lists two facilities totalling $464,705,883 (NB PD IV $164.7M + West Street Mezz VIII $300M). The sub-total appears to reference NB PD IV only — likely a source spreadsheet formula error. Actual committed volume is $464,705,883 pending Credit confirmation. The `V1_8` seed migration must hold this value as a comment pending sign-off. |
| 41 | Facility seeding migration `V1_8__facility_seed.sql` | All 71 facility rows from the Agent Bank Summary are seeded via a new Flyway migration. Fields populated: `name`, `agent_bank`, `account_number`, `loan_amount`, `maturity_date`, `collateral_date`, `bank_status` (`Active`), `bank_status_date`. The migration uses `INSERT … ON CONFLICT (account_number) DO UPDATE` once `account_number` carries a unique constraint. Depends on the schema additions in Decision 30 being applied in the same migration or a prior one. |
| 42 | FM Dictionary seeding migration `V1_9__fm_alias_seed.sql` covers Wells Fargo (both variants) and SVB | Aliases for `WELLS_FARGO` (columns from §10.2 and §10.3 combined — both WF variants share the same bank key) and `SILICON_VALLEY_BANK` (columns from §10.4) are pre-seeded. Separated from `V1_8` to keep facility metadata and alias seeding independent. Aliases for the 15 remaining agents are populated on first confirmed extraction via the manual remap flow. No Goldman Sachs aliases seeded — GS is not an active agent. |
| 43 | Template class must be auto-detected from sheet content, not inferred from agent bank identity | Wells Fargo uses both Class A (group-header rows, Tranche A/B summary, numerical ratings) and Class B (Investor Category column, single summary, Eligibility column) across different facilities. Agent bank identity alone cannot determine which parsing path to use. The extraction service must detect template class from content heuristics: (1) presence of "Tranche A" or "Tranche B" keyword in the first 15 rows → Class A; (2) "Investor Category" as a column header → Class B; (3) absence of any ratings or Advance Rate columns → Class C; (4) unmatched → Class A as default (widest column coverage). Detected class is cached in `bb_templates` via a new `template_class VARCHAR(10)` column alongside `sheet_name` and `header_row_index`, so subsequent uploads for the same agent/facility pair skip the heuristic. |
| 44 | SQL migrations V1_3–V1_7 consolidated back into V1_1/V1_2 (2026-06-13) | While no production DB exists, incremental ALTER/CREATE migrations added maintenance overhead without the checksum-safety benefit they provide post-launch. All changes (wizard_step/shadow_bb_overrides on submissions, lp_rates table, agent_tiers 5-tier update, Agent/UBS LP Classification split, lp_records rename + column renames) were absorbed into the two base files so fresh environments initialise from a single coherent snapshot. **Rule:** once V1_1 and V1_2 have been applied to a production DB, they must never be modified. All subsequent schema changes go in new `V1_N__` or `V2_1__` files. |
| 45 | Shadow BB screen table expanded to 28 columns — full LP record in the grid (2026-06-13) | The Shadow BB LP table was extended from 10 summary columns to the full 28-column layout defined in `pe-sub-docs/SHADOW_BB_ANALYSIS.md`: Rank, Investor Name, Parent, SPV, UBS Classification, Inst/HNW, Inv. Grade?, Agent Classification, S&P, Moody's, Fitch, LP Size ($B), Size Criteria, UBS Rate, Agent Rate, Cap. Commit., Uncalled, Agent Conc. Limit, UBS Conc. Limit, % of Commit., Called Cap., % Uncalled, % LP Called, Agent Excess, UBS Excess, Agent BB, UBS BB, Notes. Columns removed: Delta, UBS Eligible, Incl. Agent Excess Concentration is a new computed field on `ComputedLPRecord` (`agentExcessM = MAX(0, ucM − totalAllUC × agentConcPct)`) derived in `computePortfolioBB` after the portfolio total is known. `agentCls?: string` added as an optional field to the `LP` type for the Agent LP Classification column. |
| 46 | Name matching optimised — exact-match fast path + length-band candidate pruning + parallel scoring (2026-06-13) | **Symptom:** severe slowdown when the *same* Agent BB was uploaded a second time (reported on Blue Owl GP Stakes V). **Root cause:** `MatchingService.buildMatchQueueEntries` (the `POST /{id}/confirm` step) loads the **bank-wide** LP Master name list (`LpRepository.findAllDistinctNames()`) and scored every extracted row against every master name with combined Jaro-Winkler + Levenshtein — O(rows × names) — and (a) re-normalised the whole candidate list for *every* row, while (b) `normalize()` called `String.replaceAll(...)` per abbreviation and per legal suffix, recompiling a regex `Pattern` on each call → O(rows × names × (#abbrev + #suffix)) regex compilations. The second upload is worse because the first upload's `commitAcceptedMatches` inserts that BB's investors as new LP Master records, so the re-upload re-matches every row against a list grown by exactly those names — both factors of the product jump at once. **Fix** — four layers behind an immutable `MatchingService.Prepared` index built once per upload: (1) **regex pre-compilation** — abbreviation/suffix patterns compiled once into `Config`, plus static punctuation/whitespace patterns; the candidate list is normalised once at `prepare()`, not per row; (2) **exact-match fast path** — `Prepared` holds a `normalized → first-original` map, so a row whose name already exists verbatim in master (the duplicate-upload case) resolves in O(1) at score 100 / `Accept` with no fuzzy scoring, collapsing the dominant cost of the reported scenario; (3) **length-band pruning** — candidates indexed sorted by normalised length; given weights `jwWeight·jw + levWeight·lev` and review threshold T, a candidate whose length is outside `[(1−f)·a, a/(1−f)]` with `f = 1 − (T − jwWeight)/levWeight` cannot reach T even with a perfect Jaro-Winkler, so it is skipped without changing any Accept/Queue/Reject decision or matched name; auto-disabled when the math admits no safe pruning (e.g. `jwWeight ≥ T`); (4) **parallel scoring** — `buildMatchQueueEntries` scores rows via `parallelStream()`; fuzzy matching is CPU-bound and each row is independent, and `Prepared` is immutable so this is thread-safe. Deliberately uses the common ForkJoinPool (platform threads), **not** virtual threads, which would oversubscribe cores on CPU-bound work; persistence stays out of the parallel section. **Bank-wide matching is unchanged** — every existing LP record is still a candidate; only provably useless work is skipped. Tie-break preserved (lowest candidate index wins, matching a sequential full scan); the only observable difference is that the displayed `match_score` of an ultimately below-threshold "New LP" row may differ, since hopeless candidates are not scored — the decision and matched name are identical. `LpIngestService.ingest` inherits layers 1–3 through `prepare`/`matchBest` (left sequential — its loop interleaves DB writes). Guarded by `MatchingServiceTest` (exact-duplicate fast path; length-band-vs-exhaustive-scan equivalence property test). Supersedes the per-row `matchBestInList` usage from Decision 19 (the method remains as a thin wrapper over `prepare`/`matchBest`). **Future option:** a token/trigram inverted-index blocking key prunes far more aggressively but is only heuristically decision-safe, so it was left out of this pass. |

---

## Additions to §8 — Gaps and Open Questions

### New implementation gaps

| # | Gap | Impact | Notes |
|---|-----|--------|-------|
| G11 | **`facilities` table missing operational metadata** | Facility records cannot be linked to UBS loan administration; Agent Bank Exposure report (G9) cannot be built | Requires schema migration adding `account_number`, `loan_amount`, `maturity_date`, `bank_status`, `bank_status_date` (Decision 30) |
| G12 | **`template_format` enum does not cover 13 of 17 active portfolio agents** | Uploads from BMO, BNYM, CIBC, City National, Lloyds, M&T Bank, Mizuho, Morgan Stanley, Natixis, SMBC, Societe Generale, SVB, UBS Bank USA will be tagged `UNKNOWN` | Requires enum expansion (Decision 32) in `submission_extractions` schema and `pe-sub-extraction` detection logic |
| G13 | **FM Dictionary has no bank-scoped aliases for Wells Fargo (either variant) or SVB** | Extraction for all three known templates falls back to heuristic column detection — low field-match confidence and increased unrecognised column count | Requires `V1_8` alias seed migration (Decision 42); full column mappings specified in §10.2–10.4 |
| G14 | **Class A group-header-row classification detection not implemented** | Wells Fargo Variant 1 (Blue Owl GP Stakes V) and any future Class A agent template will not auto-assign `cls` from group headers; all LPs require manual classification in Wizard Step 5 | `pe-sub-extraction` needs a parsing mode that tracks the current classification group header and stamps it on subsequent LP rows (Decision 34) |
| G15 | **Class C (SVB) advance rate / BB absence not handled** | SVB extractions will attempt to populate `agent_rate` and `abb` from non-existent columns; extracted values will be null; wizard must not block on these fields | Extraction must suppress missing-field warnings for `AGENT_RATE` and `ABB` on Class C templates; Wizard Step 5 must prompt for classification before BB can be derived (Decisions 34, 43) |
| G16 | ~~**`lp_records.transferee` field does not exist**~~ ✅ **Resolved** | `transferee BOOLEAN NOT NULL DEFAULT FALSE` exists in `V1_1__schema.sql` | POI colour detection still needs implementation (see G18) |
| G17 | ~~**`lp_records.recallable_dist` field does not exist**~~ ✅ **Resolved** | `recallable_dist VARCHAR(50)` exists in `V1_1__schema.sql` | BB engine update for SVB facilities still needed (Decision 38) |
| G18 | **Apache POI colour extraction not implemented in `pe-sub-extraction`** | Wells Fargo Variant 1 (Class A) row colour codes (Reclassified / Transferee) are silently ignored | Requires `XSSFCellStyle.getFillForegroundColorColor()` check per row in the Class A extraction path (Decision 36) |
| G19 | ~~**`bb_templates` registry has no `template_class` column`**~~ ✅ **Resolved** | `template_class VARCHAR(10) NOT NULL DEFAULT 'A'` exists in `V1_1__schema.sql` | — |

### New open questions

- **SMBC total discrepancy**: Confirm whether West Street Mezz VIII ($300M) belongs in the SMBC sub-total — source appears to be a formula error (Decision 40)
- **Wells Fargo template history**: The Class A template (Blue Owl GP Stakes V) was produced under Goldman Sachs Bank USA letterhead. Confirm whether future Blue Owl GP Stakes V BB submissions from Wells Fargo will retain the Class A structure (Tranche A/B, group headers, numerical ratings) or migrate to the Class B format used for Petershill IV. Until confirmed, `bb_templates` should store distinct entries per facility, not just per agent bank
- **Tranche A / Tranche B LP overlap (Class A template)**: Are individual LPs present in both Tranche A and Tranche B sections of the WF Variant 1 sheet, or is each LP row unique across tranches? Determines whether `lps` rows must be deduplicated at ingest
- **SVB Recallable Distributions formula**: Confirm whether `Remaining Callable Capital = Unfunded Commitment − Recallable Distributions` before implementing the BB engine update (Decision 38)
- **Templates for 15 unclassified agents**: Bank of America, JP Morgan, Morgan Stanley, SMBC, Mizuho, BMO, Natixis, CIBC, M&T Bank, BNYM, Societe Generale, City National, UBS Bank USA, Lloyds, PNC — templates must be solicited from Credit before those facilities can enter active processing. Given the portfolio spans 71 facilities across 17 agents, a minimum of 17 distinct template formats is assumed with additional variants likely
- **Multi-format agents beyond Wells Fargo**: Are any of the 14 unclassified agents confirmed to use multiple template formats across their facilities? Bank of America (16 facilities) and SVB (10 facilities, 5 fund types) are the most likely candidates
- **Multi-fund umbrella LP deduplication**: For umbrella facilities (e.g., HIG LBO IV, BH III, GB&E III, IV [U]), confirm whether the LP Master carries one record per LP across all sub-funds or one record per LP per sub-fund

---

### How the platform handles template variants

The three template classes above differ along predictable axes, each modelled as **data** in
the BB template registry rather than per-bank parsing code:

| Axis | Where configured | Example |
|---|---|---|
| Sheet + header row | `bb_templates.sheet_name`, `bb_template_tabs.header_row_index` | SVB has 2 summary rows above the header (`summary_rows_above_header = 2`) |
| Tranche / tab layout | `bb_templates.tranche_count`, `bb_template_tabs.tab_role` | GS Blue Owl has 2 tranches (A + B) |
| Column wording | `fm_aliases` (live, admin-editable via Field Mapping screen) | WF "Investor Category", SVB "Remaining Callable Capital" |
| Classification **section rows** | `bb_template_groups` (`header_text → classification`) | GS "Rated Investors / Unrated Investors / Eligible Investors / Excluded Investors"; SVB "Excluded Investors" |
| Sub/total rows to drop | `bb_template_tabs.skip_row_keywords` | "Subtotal", "Total", "Total included investors" |
| Colour-coded flags | `bb_templates.has_color_flags` | GS pink = Reclassified, blue = Transferee |

**Agent LP Classification as section rows.** GS and SVB express the agent's classification
as grouping rows (not a column). `ClassificationRowDetector` in pe-sub-extraction recognises
a row whose name cell matches a configured `header_text`, suppresses it from the LP output,
and fills its resolved `classification` down onto the `AGENT_LP_CLASSIFICATION` field of every
LP below it until the next header. A populated per-row classification column (e.g. WF's
"Investor Category") overrides the inherited section value. The recognised headers are the six
standard Agent LP Classification values plus the per-agent `classificationConfig` map that
pe-sub-api builds from `bb_template_groups` and passes on each `POST /api/extract`.

**Agent vs UBS LP Classification.** `Agent LP Classification` is the agent's own category
label, extracted verbatim from the Agent BB document — either a column or **group-header rows**
that separate sections of LPs. When supplied as section rows, the agent's value is filled down
onto every LP beneath the header by pe-sub-extraction. The recognised header texts are
configured per agent bank in `bb_template_groups` and passed to the extraction service as
`classificationConfig` (built by `ClassificationConfigBuilder`). `UBS LP Classification` is the
platform-computed internal advance-rate tier (Rated / Unrated >2bn / Unrated 1–2bn / Eligible /
Excluded), kept separate so the agent label can be cross-checked against the UBS tier.

**Path to fully self-service onboarding.** The Field Mapping screen already edits `fm_aliases`
live. The remaining step is to surface `bb_template_tabs` and `bb_template_groups` in the admin
Configuration screen, so an Analyst can register a new agent template variant —
sheet, header row, skip keywords, column aliases, and classification sections — entirely through
the UI, with no migration or deploy.
