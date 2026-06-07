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
| `pe-sub-docs` | Solution design, OpenAPI specification (`openapi.yaml` v0.6.0), and Postman/Talend API collection |
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
| `V1_1__schema.sql` | All DDL — every `CREATE TABLE` and index |
| `V1_2__seed.sql` | Field Mapping Dictionary seed data (`fm_canonical_fields`, `fm_aliases`, `fm_blocklist`) |

To make a schema change: add a new `V1_3__description.sql` (or `V2_1__` for the next major release) and restart `pe-sub-api`.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| email | varchar(255) unique | |
| name | varchar(255) | |
| role | varchar(50) | `Analyst` \| `Credit Officer` \| `Supervisor` |
| created_at | timestamp | |

### `facilities`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar(255) unique | |
| agent_bank | varchar(255) | |
| status | varchar(50) | `Not Started` \| `In Progress` \| `Needs Review` \| `Certified` \| `Pending` |
| conc_limit_m | numeric(10,2) | Per-LP concentration limit in $M; default 25 |
| last_run_at | timestamp nullable | Set on each Shadow BB run |
| created_at / updated_at | timestamp | |

### `lps`

Stores the LP Master — one record per LP per facility.

| Group | Columns |
|-------|---------|
| Identity & Classification | rank, name, parent, spv, hq, type, region, ig, cls, cls_tag |
| Ratings | sp, mdy, fitch |
| Financial Scale | aum, nav, pension, pension_funded |
| Commitment Data | cap_commit, pct_cap_commit, called_cap |
| Uncalled / Eligible Capital | uc, pct_uncalled, pct_called |
| Concentration & BB | agent_conc, ubs_conc, agent_rate, abb |
| Status | inc, rcl, tf |
| Meta | notes, facility_id (FK → facilities), created_at, updated_at |

Note: `rate` (BUSA advance rate) and computed fields (`ubb`, `delta`, `uec`) are **not stored** — they are derived at runtime by the BB engine from `cls` and `uc`. Only `abb` (agent's submitted BB value) is stored as a source field.

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
| status | varchar(50) | Default `Processing`; transitions to `Review` after extraction |
| file_name | varchar(255) | Original filename as uploaded |
| file_path | varchar(512) nullable | Absolute server path to the saved file; configured via `${app.uploads.path}` |
| uploaded_by | integer FK → users nullable | |
| notes | text nullable | Optional analyst notes submitted with the upload form |
| created_at / updated_at | timestamp | |

### `submission_extractions`

One row per submission; unique index on `submission_id`.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| submission_id | integer FK → submissions unique | |
| template_format | varchar(50) nullable | Detected bank format: `CITIBANK`, `JPM`, `GOLDMAN_SACHS`, `BARCLAYS`, `INTERNAL`, `UNKNOWN` |
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
| matched_lp_id | integer FK → lps nullable | Best LP Master match, if any |
| matched_lp_name | varchar(255) nullable | Matched LP name at time of ingest |
| match_score | integer nullable | Combined similarity score 0–100 |
| decision | varchar(50) | Default `pending`; transitions to `accepted`, `rejected`, or `manual` |
| master_name_override | varchar(255) nullable | Manual name entered by credit officer |
| is_new | boolean | True if no existing LP Master record matched |
| reasons | jsonb nullable | Array of reason strings explaining the queue action |
| created_at / updated_at | timestamp | |

### `bb_templates`

Auto-learned template registry keyed by agent bank. On first confirmed extraction for an agent bank, the sheet name and header row index are saved. On subsequent uploads from the same bank, `SubmissionController` passes these as `sheetNameHint` / `headerRowHint` to skip heuristic detection.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| agent_bank | varchar(255) | Unique (case-insensitive index) |
| sheet_name | varchar(255) nullable | BB sheet name to target |
| header_row_index | integer nullable | Zero-based header row index |
| auto_learned | boolean | Default `true` — set by `POST /{id}/confirm` |
| created_at / updated_at | timestamp | |

### `audit_log`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| event | varchar(100) | Not null. One of: `BB Recalculated`, `LP Reclassified`, `LP Data Updated`, `Upload`, `Export`, `Config Change`, `Login`, `Field Mapping Change` |
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
- **SubmissionController** — inserts `Upload` on every `POST /api/submissions`
- **AuditController** — inserts `Login` on `POST /api/audit/login` (called by UI on app mount)
- **ConfigController** — inserts `Config Change` on every `PUT /api/config/matching` and `PUT /api/config/eligibility`; detail names the specific section
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
| Config Change | `<Section> updated` — matching sections: `Confidence Thresholds`, `Algorithm Weights`, `Legal Entity Suffix Rules`, `Abbreviation Expansion Dictionary`; eligibility sections: `BUSA Advance Rate Schedule`, `Agent Advance Rate Schedule`, `Agent Rate Parameters`, `Eligibility Rules`, `Concentration Limits`, `Global Settings` |
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

Base path: `/api`. Full OpenAPI 3.0 specification: `pe-sub-docs/openapi.yaml` v0.6.0.  
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

For each extracted LP row, `LpIngestService` runs `matchBestInList` against the facility's LP names:

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
| GET | `/api/reports/ear/:facilityId` | ✅ | Effective Advance Rate history across all snapshots |

### Submissions

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/submissions` | ✅ | List all submissions; filter by `?facilityId=`; ordered newest first |
| POST | `/api/submissions` | ✅ | Create submission — multipart: `facilityId`, `agentBank`, `periodMonth`, `file`, `notes?`; triggers `pe-sub-extraction` immediately; saves file to `${app.uploads.path}` |
| GET | `/api/submissions/:id` | ✅ | Single submission record or 404 |
| POST | `/api/submissions/:id/abort` | ✅ | Abort a submission — deletes `submission_extractions` row, resets facility status |
| POST | `/api/submissions/:id/confirm` | ✅ | Confirm extraction; auto-learns BB template for the agent bank via `bb_templates` |
| GET | `/api/submissions/:id/extracted-lps` | ✅ | Extracted LP rows with confidence scores (from `submission_extractions.extracted_lps` JSONB) |
| GET | `/api/submissions/:id/field-map` | ✅ | Column → canonical field mapping for this submission |
| GET | `/api/submissions/:id/doc-recognition` | ✅ | Document recognition metadata (format, sheet name, header row, row counts) |
| GET | `/api/submissions/:id/unrecognized-columns` | ✅ | Column headers that could not be mapped to any canonical field |
| POST | `/api/submissions/:id/remap` | ✅ | Map an unrecognised column to a canonical field (`{ extractedKey, canonicalKey }`) |
| POST | `/api/submissions/:id/reextract` | ✅ | Re-run the full extraction pipeline for this submission using the stored file |

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

Template format is auto-detected from keywords in the first 5 rows. Header row is detected by highest canonical-alias match score across rows 0–9.

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
| POST | `/api/matching/test` | ✅ | Test a name against LP Master. Body: `{ "name": "..." }`. Returns top 10 LP matches scored by Jaro-Winkler + Levenshtein |
| GET | `/api/matching/queue` | ✅ | Name-matching queue for a submission (`?submissionId=`) |
| PATCH | `/api/matching/queue/:id` | ✅ | Accept / reject / manual-override a match decision |
| GET | `/api/matching/thresholds` | ✅ | Current auto-accept and review-queue score thresholds |
| PATCH | `/api/matching/thresholds` | ✅ | Update thresholds |

**Matching algorithm (`MatchingService`):** Jaro-Winkler + Levenshtein, combined as `jwWeight × JW + levWeight × Lev`. Both strings are normalised before scoring: abbreviation expansion → case fold → legal suffix stripping → punctuation removal. All parameters are read live from `matching_config` in the DB cache.

### Configuration

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/config/eligibility` | ✅ | Returns all 6 eligibility keys assembled from the in-memory cache |
| PUT | `/api/config/eligibility` | ✅ | Upserts a single config key; `?section=<key>` param used for audit log detail |
| GET | `/api/config/matching` | ✅ | Returns `matching_config` from cache |
| PATCH | `/api/config/matching` | ✅ | Upserts `matching_config`; `?section=` param for audit detail |
| GET | `/api/config/wizard` | 🔲 | No `wizard_config` row seeded — returns 404; UI falls back to `wizardConfig.ts` |
| GET | `/api/config/audit` | 🔲 | No `audit_config` row seeded — returns 404; UI falls back to `auditConfig.ts` |
| GET | `/api/config/reports` | 🔲 | No `report_config` row seeded — returns 404; UI falls back to `reportConfig.ts` |

---

## 6. Process Flow Alignment

### Step 4 — Final Shadow BB (LP record fields)

The production `lps` table schema mirrors the BB_PROCESS_FLOW Step 4 field set. `type` (`Institutional` | `HNW`) covers both "Investor Type" and "Institutional vs HNW".

### Step 6 — Portfolio-Level Reporting

Reports screen tabs correspond 1:1 to Step 6 outputs:

| Step 6 Output | Tab ID | API endpoint | Status |
|---------------|--------|--------------|--------|
| Collateral Market Value & Coverage | `collateral` | `/api/reports/collateral/:id` | ✅ |
| Effective Advance Rates | `ear` | `/api/reports/ear/:id` | ✅ |
| Agent Bank Exposure | `agent-bank` | TBD | 🔲 |
| Concentration Exposures | `concentration` | `/api/reports/concentration/:id` | ✅ |
| Ad Hoc Reporting | `adhoc` | TBD | 🔲 |

### Scheduled Batch Job

One system-managed job planned: runs on the 1st of each month, resets all active facility statuses to `Not Started`. The `snapshot-freq` global setting (default 30 days) is intended to drive automatic Shadow BB recalculation scheduling in `pe-sub-jobs`. Neither job is implemented yet.

---

## 7. Key Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Flat repos, not a monorepo | Simpler ownership and navigation; monorepo tooling overhead unjustified at this scale |
| 2 | `pe-sub-infra` contains Kubernetes manifests, not Terraform | Terraform deferred until Azure architecture is confirmed. Kubernetes manifests enable immediate local cluster deployment and will serve as the basis for AKS when the cloud target is ready |
| 3 | BB engine implemented in both Java (`pe-sub-api`) and TypeScript (`pe-sub-ui`) | Java engine is authoritative and persists snapshots. TypeScript engine powers client-side live preview in Shadow BB screen. Both must produce identical numbers |
| 4 | `pe-sub-db` deleted (2026-05-31) | Was a Drizzle ORM schema/seed package, never a runtime dependency. Schema is now defined exclusively by Flyway SQL migrations |
| 5 | Computed BB fields not stored in `lps` | `rate`, `ubb`, `delta`, `uec` are derived — storing them would create drift risk. Only source fields and `abb` (agent-submitted) are persisted |
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
| 25 | Null-marker filtering at two levels | N/A, N/R, NA, NR values are filtered at extraction time: (a) row-level — entire row skipped if investor name is a null marker; (b) field-level — cell value stored as null with a "value missing" warning |
| 26 | `CANONICAL_META` in SubmissionController for field-map labelling | A static map in `SubmissionController.java` keys extraction_key or canonical name to `(canonical, group)`. Used to label field-map rows returned by `GET /{id}/field-map`. Non-extractable fields are keyed by canonical name; extractable fields by extraction_key. Without this map, matched fields appeared in group "Other" |

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
| G10 | **`lps` financial fields stored as `VARCHAR`** | `aum`, `cap_commit`, `uc`, `agent_rate`, `abb`, `agent_conc` etc. are `VARCHAR(50)` columns containing formatted money strings (`"$25.0M"`). Calculations use `BbCalculationService.parseMoney()` to convert at runtime | Should be `NUMERIC` columns; string parsing is fragile and prevents direct SQL aggregation |

### Open questions

- **Azure architecture**: Container Apps vs App Service, region, networking, Key Vault integration
- **Authentication**: Azure AD (Entra ID) SSO vs internal auth — to be confirmed. Unblocks G6
- **LP identifier (Decision 13)**: LEI vs internal UBS counterparty ID — decision pending
- **`pe-sub-infra` → AKS**: when Azure architecture is confirmed, extend Kubernetes manifests for AKS (registry, ingress, managed identity, secrets from Key Vault)

---

> **Note on `PE-Sub-Platform-Solution-Design.docx`:** The Word document is a point-in-time export and is no longer maintained in sync automatically. `SOLUTION_DESIGN.md` is the canonical reference.


### Multiple Agent BB templates

Template #1: Blue Owl GP Stakes V BB by Goldman Sachs Bank USA

Two summary tables:

Tranche A

Borrowing Base
Eligible Remaining Commitments
Total Remaining Commitments
Effective Advance Rate

Tranche B

Tranche B Excluded LPs
Total Eligible Remaining Commitments
Tranche B Advance Rate
Tranche A Maximum Commitments
Tranche B Borrowing Base


Followed by columns in Excel

Grouped by (separate row)

Rated Investors
Unrated Investors
Eligible Investors
Excluded Investors

Investor
Parent / Sponsor / Manager
S&P 
Moody's
Net Assets(range)
Individual Original Commitment 
Original Commitment 
Individual Unfunded Commitment 
Unfunded Capital Commitment 
% Called
% Total Unfunded Commitment
% Eligible Unfunded Commitment
Concentration Limit
Excess Concentration
Eligible Commitment
Advance Rate
Borrowing Base Contribution
% of Borrowing Base
S&P (numerical ratings scale, 0-9)
Moody's (numerical ratings scale, 0-9)
Applicable Rating (numerical ratings scale, 0-9)

Subtotal
Total 

Pink rows highlighted for Reclassified
Blue rows highlighted for Transferee



Template #2 -- Proforma AF BB by Silicon Valley Bank

Arctos American Footbal Fund (all entities) - Investor List
Reporting Date

Columns in Excel (shifted)

Investor Name
Committed Capital
Called Capital
Recallable Distributions
Excess Concentration
Remaining Callable Capital
Remaining Callable Capital Adjusted for Concentration Limit

Total included investors

Excluded Investors

None listed in a sample from 2/21/2025



Template #3 -- Petershill IV BB by Wells Fargo

Summary table:
Borrowing Base
Eligible Remaining Commitments
Total Remaining Commitments
Total Original Commitments
Effective Advance Rate

Unnamed column with identifier
Investor
Investor Category
S & P's Rating
Moody's Rating
Net Assets (range)
Individual Original Commitment
Original Commitment
Individual Unfunded Commitment
Unfunded Capital Commitment
% Called
% Total Unfunded Commitment
% Eligible Unfunded Commitment
Concentration Limit
Excess Concentration
Eligible Commitment
Advance Rate
Borrowing Base Contribution
% of Borrowing Base
Eligibility