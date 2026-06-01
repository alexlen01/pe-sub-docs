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
| `pe-sub-api` | Spring Boot 3.3 / Java 21 REST API — business logic, route handlers, JPA / DB access |
| `pe-sub-docs` | Solution design, OpenAPI specification, and architecture documentation |
| `pe-sub-platform` | Working prototype only — used to gather and refine requirements; not deployed to production |

### Decision: four flat repos, not a monorepo

Rejected: Turborepo / pnpm workspaces monorepo with nested `apps/` and `packages/`.

Chosen: four flat repos.

**Rationale:** Simpler to navigate and own. Monorepo tooling overhead is not justified for a focused internal tool where API and UI are always deployed together. The original `pe-sub-common` shared-TypeScript package was dissolved (see §7, Decision 11) so there is no longer a code-sharing reason to use workspace tooling.

### Deferred: `pe-sub-infra`

Terraform for Azure cloud resources will be managed in a dedicated `pe-sub-infra` repo. Deferred until the cloud architecture is confirmed. Target resources include Azure Container Apps (or App Service), Azure Database for PostgreSQL Flexible Server, Azure Key Vault, and networking / DNS. See §6 for current state.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend language | TypeScript 5.x | `pe-sub-ui` only |
| Frontend runtime | React 18, Vite 5 | `pe-sub-ui` |
| Dev server proxy | Vite `server.proxy` | `/api` → `localhost:3001`; avoids CORS config in development |
| Backend language | Java 21 (LTS) | `pe-sub-api` |
| Backend runtime | Spring Boot 3.3 | `pe-sub-api` |
| Build tool | Maven 3.9 | `pe-sub-api` |
| ORM / persistence | Spring Data JPA (Hibernate 6) | `pe-sub-api` runtime |
| Schema / migrations | Flyway | SQL migrations in `pe-sub-api/src/main/resources/db/migration/`; applied automatically on startup |
| Database | PostgreSQL 16 | Azure Database for PostgreSQL Flexible Server in production; Docker locally |
| Validation | Jakarta Validation (`@Valid`) | `pe-sub-api` |
| JSON / JSONB | Jackson 2, `PGobject` | `bb_snapshots.result` column via `AttributeConverter` |

---

## 3. Architecture

```
pe-sub-ui  ──── /api (Vite proxy) ────▶  pe-sub-api (Spring Boot)  ────▶  PostgreSQL
                                               │
                                         Spring Data JPA
```

- `pe-sub-ui` calls the API exclusively via the Vite dev proxy. Domain types (`LP`, `Facility`, `BBResult`, etc.) live in `pe-sub-ui/src/types/` — **no shared package**.
- `pe-sub-api` owns all business logic: LP management, BB calculation (Java port of the engine), submission ingestion, name matching. It connects directly to PostgreSQL via Spring Data JPA.
- Database schema is defined by Flyway SQL migrations in `pe-sub-api/src/main/resources/db/migration/` (V1–V6). Write new migrations there as plain SQL.
- The BB calculation engine is implemented twice — as a Java `@Service` in `pe-sub-api` (authoritative, persists snapshots) and as a TypeScript function in `pe-sub-ui/src/services/bbCalculationService.ts` (client-side live preview in the Shadow BB screen). Both must produce identical results.

---

## 4. Database Schema

Defined by Flyway SQL migrations in `pe-sub-api/src/main/resources/db/migration/`:

| File | Contents |
|------|----------|
| `V1_1__schema.sql` | All DDL — every `CREATE TABLE` and index |
| `V1_2__seed.sql` | Config reference data — advance rates, eligibility rules, concentration limits, matching config |
| `V1_3__field_mapping.sql` | Field Mapping Dictionary — `fm_canonical_fields`, `fm_aliases`, `fm_blocklist`, `fm_suggestions` tables and full seed data |

To make a schema change: add a new `V1_4__description.sql` (or `V2_1__` for the next major release) and restart `pe-sub-api`.

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
| Identifier | lei (varchar 50) |
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

Defined in `V1_1__schema.sql`.

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
| created_at / updated_at | timestamp | |

### `audit_log`

Defined in `V1_1__schema.sql`.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| event | varchar(100) | Not null. One of: `BB Recalculated`, `LP Reclassified`, `Upload`, `Export`, `Config Change`, `Login`, `Field Mapping Change` |
| detail | text nullable | Human-readable event detail; format varies by event type (see §5 Audit) |
| facility_id | integer FK → facilities nullable | Null for non-facility-scoped events (e.g. Login) |
| user_id | integer FK → users nullable | Reserved for auth integration; not yet populated |
| user_name | varchar(100) nullable | Display name of the actor stored at write time; decoupled from users FK |
| ip | varchar(45) nullable | Client IP — resolved from `X-Forwarded-For` header if present, else `remoteAddr` |
| created_at | timestamp | Set by `@PrePersist`; not updatable |

A descending index on `created_at` (`idx_audit_log_created_at`) supports the default sort on `GET /api/audit`.

Writers:
- **BbController** — inserts `BB Recalculated` on every `POST /api/bb/run/:facilityId`
- **LpController** — inserts `LP Reclassified` when `cls` changes on `PATCH /api/lps/:id`
- **SubmissionController** — inserts `Upload` on every `POST /api/submissions`
- **AuditController** — inserts `Login` on `POST /api/audit/login` (called by UI on app mount)
- **ConfigController** — inserts `Config Change` on every `PUT /api/config/matching`; detail names the specific section (e.g. `Confidence Thresholds updated`)
- **FieldMappingController** — inserts `Field Mapping Change` on alias mutations; detail format: `FM Alias Added: "<text>" → <canonical>` / `FM Alias Removed: "<text>"` / `FM Alias Updated: "<old>" → "<new>"`

All writers record `user_name = "J. Smith"` (hardcoded pending auth) and resolve IP via `X-Forwarded-For` → `remoteAddr`. The Vite dev proxy sets `X-Forwarded-For` to the browser's socket address so the actual workstation IP is captured even in development.

### `fm_canonical_fields`

Field Mapping Dictionary — one row per canonical LP Master field. Seeded by `V1_3__field_mapping.sql`.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| group_name | varchar(100) | Section header e.g. `Identity & Classification` |
| group_sort | integer | Display order of the group |
| field_sort | integer | Display order within the group |
| canonical | varchar(200) unique | Canonical field name e.g. `Investor Name` |
| lp_master_field | varchar(300) | Full LP Master path e.g. `Identity & Classification - Investor Name` |
| disambiguation | text nullable | Extraction hint shown in the UI |

### `fm_aliases`

Agent column-header aliases for each canonical field. 20 fields × ~5 aliases each (97 rows in seed).

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| canonical_field_id | integer FK → fm_canonical_fields | |
| alias_sort | integer | Display order |
| alias_text | varchar(200) | Column header text as it appears in agent documents |
| tier | varchar(20) | `Core` (universal) \| `Bank` (bank-specific) \| `User` (user-added) |
| bank | varchar(100) nullable | Agent bank name for Bank-tier aliases |

### `fm_blocklist`

Column-header qualifiers that indicate a column must never be extracted (e.g. `Adjusted`, `Capped`).

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| qualifier | varchar(100) unique | Keyword to match against column headers |
| reason | text | Human-readable explanation |

### `fm_suggestions`

User- and AI-submitted alias suggestions pending review.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| extracted_header | varchar(200) | Column header text from the submission |
| canonical_field | varchar(200) | Suggested canonical field |
| suggested_by | varchar(100) nullable | Actor name (user or `AI Engine`) |
| source | varchar(20) | `User` \| `AI` |
| confidence | integer nullable | AI confidence score (0–100); null for user suggestions |
| created_at | timestamp | |

### `config`

Platform configuration — advance rates, eligibility rules, concentration limits, and global settings. Seeded by `V1_2__seed.sql`; read-only at runtime.

| Column | Type | Notes |
|--------|------|-------|
| key | varchar(100) PK | e.g. `busa_tiers`, `elig_rules`, `conc_limits`, `global_settings` |
| value | jsonb | JSON array or object; shape varies by key |
| updated_at | timestamp | Set on upsert |

**Seeded rows (7):** `busa_tiers`, `agent_tiers`, `agent_rate_params`, `elig_rules`, `conc_limits`, `global_settings`, `matching_config`.

**Runtime access:** `ConfigService.load()` (`@PostConstruct`) reads all rows into a `ConcurrentHashMap<String, JsonNode>` on every API startup. All reads hit the cache; no per-request DB queries. JSONB ↔ `JsonNode` handled via `@JdbcTypeCode(SqlTypes.JSON)` on `ConfigEntry.value` (Hibernate 6 native JSON binding — replaces the earlier `@Convert` + `PGobject` approach which failed on UPDATE).

---

## 5. API Routes

Base path: `/api`. Served by `pe-sub-api` (Spring Boot) on port 3001 (dev).  
Full OpenAPI 3.0 specification: `pe-sub-docs/openapi.yaml`.

**Status legend:** ✅ implemented · 🔲 planned

### Facilities

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/facilities` | ✅ | List all facilities ordered by name |
| GET | `/api/facilities/:id` | ✅ | Single facility |
| PATCH | `/api/facilities/:id/status` | ✅ | Update facility status |

### LPs

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/lps` | ✅ | List LPs — query params: `facilityId`, `cls`, `search` |
| GET | `/api/lps/:id` | ✅ | Single LP record |
| PATCH | `/api/lps/:id` | ✅ | Update LP fields (classification override, notes, etc.) |

### Borrowing Base

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/bb/run/:facilityId` | ✅ | Compute Shadow BB (Java engine), persist snapshot, update `last_run_at` |
| GET | `/api/bb/snapshots/:facilityId` | ✅ | All snapshots for a facility ordered by `calculatedAt` |
| GET | `/api/bb/snapshots/:facilityId/latest` | ✅ | Latest snapshot; **204 No Content** when no snapshot exists (not 404) |
| GET | `/api/bb/summary-ext/:facilityId` | ✅ | Extended portfolio summary — LP totals, IG ratio, top-10/20 concentration, classification breakdown, and latest snapshot BB figures |

### Reports

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/reports/collateral/:facilityId` | ✅ | Latest snapshot summary (Collateral & Coverage) |
| GET | `/api/reports/concentration/:facilityId` | ✅ | Latest breach list (Concentration Exposures) |
| GET | `/api/reports/ear/:facilityId` | 🔲 | Effective Advance Rate history across all snapshots |

### Submissions

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/submissions` | ✅ | List all submissions; filter by `?facilityId=`; ordered newest first. Returns `SubmissionDto` which includes `facilityName` (batch-resolved from `facilities` table) in addition to all `Submission` fields |
| POST | `/api/submissions` | ✅ | Create submission — multipart: `facilityId`, `agentBank`, `periodMonth`, `file`; saves file to `${app.uploads.path}`, returns 201 + Submission JSON |
| GET | `/api/submissions/:id` | ✅ | Single submission record or 404 |

### Audit

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/audit` | ✅ | All audit log entries, newest first. Returns `AuditRow[]` with denormalized facility name and stored user_name |
| POST | `/api/audit/login` | ✅ | Record a Login event for the current session. IP resolved server-side from `X-Forwarded-For` / `remoteAddr`. User hardcoded to `J. Smith` pending auth |

**Response shape (AuditRow):** `{ ts, event, detail, facility, user, ip }` — all strings. `ts` is `yyyy-MM-dd'T'HH:mm:ss`. Facility names are resolved in-memory from a `findAllById` batch lookup to avoid N+1 queries. `user` is `"J. Smith"` (hardcoded pending auth).

**UI polling:** `AuditTrail` screen calls `GET /api/audit` on mount and every 10 seconds via `setInterval`, with cleanup on unmount. Falls back to an empty array (not mock data) when the API is unreachable — see Decision 8.

**Event detail formats by type:**

| Event | Detail format |
|-------|---------------|
| BB Recalculated | `N LPs · UBS BB $X.XM` |
| LP Reclassified | `LP Name → NewCls (was OldCls)` |
| Upload | `periodMonth · fileName · agentBank` |
| Login | `User login` |
| Config Change | `<Section> updated` — section is one of: `Confidence Thresholds`, `Algorithm Weights`, `Legal Entity Suffix Rules`, `Abbreviation Expansion Dictionary` |
| Field Mapping Change | `FM Alias Added: "<text>" → <canonical>` / `FM Alias Removed: "<text>"` / `FM Alias Updated: "<old>" → "<new>"` |

### Extraction

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/submissions/:id/extracted-lps` | 🔲 | Extracted LP rows with confidence scores |
| GET | `/api/submissions/:id/field-map` | 🔲 | Column → canonical field mapping for this submission |
| GET | `/api/submissions/:id/doc-recognition` | 🔲 | Document recognition metadata (agent bank, sheet names, etc.) |
| GET | `/api/submissions/:id/unrecognized-columns` | 🔲 | Column headers that could not be mapped |

### Field Mapping

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/field-mapping/alias-groups` | ✅ | Alias-group dictionary grouped by LP Master section; each field includes its `id`, canonical name, disambiguation hint, and ordered aliases (Core / Bank / User tiers) |
| GET | `/api/field-mapping/canonical-fields` | ✅ | All canonical fields as `{ value, label }[]` — `label` includes the group prefix e.g. `Identity & Classification › Investor Name` |
| GET | `/api/field-mapping/blocklist` | ✅ | Global blocklist entries as `{ id, qualifier, reason }[]` |
| GET | `/api/field-mapping/suggestions` | ✅ | Pending alias suggestions — `{ id, extractedHeader, canonicalField, suggestedBy, source, confidence, createdAt }[]` |
| POST | `/api/field-mapping/suggestions` | ✅ | Submit a new alias suggestion; body: `{ extractedHeader, canonicalField, suggestedBy? }` |
| POST | `/api/field-mapping/aliases` | ✅ | Add an alias to a canonical field; body: `{ canonicalFieldId, text, tier?, bank? }`; appends at end of sort order; writes `Field Mapping Change` audit event |
| DELETE | `/api/field-mapping/aliases/:id` | ✅ | Remove an alias; writes `Field Mapping Change` audit event with the removed text |
| PATCH | `/api/field-mapping/aliases/:id` | ✅ | Update alias `text` and/or `bank`; writes `Field Mapping Change` audit event with old → new text |

### Matching

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/matching/test` | ✅ | Test a name against LP Master. Body: `{ "name": "..." }`. Returns `{ input, normalised, matches[] }` — top 10 LP names scored by Jaro-Winkler + Levenshtein using live config; each match includes `score` (0–100) and `action` (`Accept` / `Queue` / `Reject`) |
| GET | `/api/matching/queue` | 🔲 | Name-matching queue for a submission (`?submissionId=`) |
| PATCH | `/api/matching/queue/:id` | 🔲 | Accept / reject / manual-override a single match decision |
| GET | `/api/matching/thresholds` | 🔲 | Current auto-accept and review-queue score thresholds |
| PATCH | `/api/matching/thresholds` | 🔲 | Update thresholds |

**Matching algorithm (`MatchingService`):** Jaro-Winkler + Levenshtein, combined as `jwWeight × JW + levWeight × Lev`. Both the test input and each LP name are normalised before scoring: abbreviation expansion → case fold → legal suffix stripping → punctuation removal. All parameters (weights, flags, suffix list, abbreviation dictionary) are read from the live `matching_config` row in the database, so changes saved via the Match Thresholds screen take effect immediately.

### Configuration

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/config/eligibility` | ✅ | Returns all 6 seeded keys (`BUSA_TIERS`, `AGENT_TIERS`, `AGENT_RATE_PARAMS`, `ELIG_RULES`, `CONC_LIMITS`, `GLOBAL_SETTINGS`) assembled from the in-memory cache |
| GET | `/api/config/wizard` | 🔲 | No `wizard_config` row seeded yet — returns 404; UI falls back to `pe-sub-ui/src/config/wizardConfig.ts` |
| GET | `/api/config/audit` | 🔲 | No `audit_config` row seeded yet — returns 404; UI falls back to `pe-sub-ui/src/config/auditConfig.ts` |
| GET | `/api/config/matching` | ✅ | Returns `matching_config` from cache; seeded by `V1_2__seed.sql` |
| PUT | `/api/config/matching` | ✅ | Upserts `matching_config`; accepts `?section=` param for audit log detail; records `Config Change` audit event |
| GET | `/api/config/reports` | 🔲 | No `report_config` row seeded yet — returns 404; UI falls back to `pe-sub-ui/src/config/reportConfig.ts` |

All endpoints are served from the `ConcurrentHashMap` cache loaded at startup — no per-request DB reads. The UI `configService.ts` wraps every call in `try/catch`; a 404 or network error falls back to the local TypeScript constants transparently.

**UI-side caching (`configService.ts`):** `getEligibilityConfig()` stores the in-flight promise in a module-level variable (`_eligCache`). The first call fires the fetch; all subsequent calls — including re-navigating to the Configuration screen — return the same promise with no additional network request. If the API is unreachable the `.catch()` resolves to the local TypeScript fallback, and that resolved value is what gets cached for the session. Other config functions (`getAuditConfig`, `getWizardConfig`, `getReportConfig`) are called infrequently enough that no session cache is needed.

---

## 6. Process Flow Alignment

### Step 4 — Final Shadow BB (LP record fields)

The production `lps` table schema mirrors the BB_PROCESS_FLOW Step 4 field set. `type` (`Institutional` | `HNW`) covers both "Investor Type" and "Institutional vs HNW". The `lei` field stores the LP identifier (LEI or internal counterparty ID — see §7, Decision 12).

### Step 6 — Portfolio-Level Reporting

Reports screen tabs correspond 1:1 to Step 6 outputs:

| Step 6 Output | Tab ID | API endpoint |
|---------------|--------|--------------|
| Collateral Market Value & Coverage | `collateral` | `/api/reports/collateral/:id` |
| Effective Advance Rates | `ear` | `/api/reports/ear/:id` (planned) |
| Agent Bank Exposure | `agent-bank` | TBD |
| Concentration Exposures | `concentration` | `/api/reports/concentration/:id` |
| Ad Hoc Reporting | `adhoc` | TBD |

### Scheduled Batch Job

One system-managed job: runs on the 1st of each month at 00:00, resets all active facility statuses to `Not Started`. No user-configurable schedules. To be implemented as a Spring `@Scheduled` task in `pe-sub-api` (or Azure Function / Container App job).

---

## 7. Key Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Five flat repos, not a monorepo | Simpler ownership and navigation; monorepo tooling overhead unjustified at this scale |
| 2 | `pe-sub-infra` deferred | No Terraform needed until cloud architecture is confirmed |
| 3 | BB engine implemented in both Java (`pe-sub-api`) and TypeScript (`pe-sub-ui`) | Java engine is authoritative and persists snapshots. TypeScript engine powers client-side live preview in Shadow BB screen. Both must produce identical numbers — the concentration cap, breach thresholds, and rate schedule are the critical test surface |
| 4 | `pe-sub-db` deleted (2026-05-31) | Was a Drizzle ORM schema/seed package, never a runtime dependency. Schema is now defined exclusively by Flyway SQL migrations in `pe-sub-api/src/main/resources/db/migration/` |
| 5 | Computed BB fields not stored in `lps` | `rate`, `ubb`, `delta`, `uec` are derived — storing them would create drift risk. Only source fields and `abb` (agent-submitted) are persisted |
| 6 | `bb_snapshots.result` as jsonb | Full `BBResult` stored as typed JSON via `AttributeConverter` + `PGobject`; enables historical reporting without denormalising LP arrays into rows |
| 7 | Vite dev proxy for `/api` | Avoids CORS config in development; prod will route through Azure Front Door or API Management |
| 8 | No mock data fallbacks in production services | Service layer (`facilityService.ts`, `lpService.ts`, etc.) returns empty arrays on API failure. No fake data leaks into production UI |
| 9 | Prototype (`pe-sub-platform`) retained as-is | Continues as the requirements reference; changes to the prototype inform production implementation, not the other way around |
| 10 | Terraform target: Azure | Cloud provider confirmed; `pe-sub-infra` to be scaffolded when Azure architecture is designed |
| 11 | `pe-sub-common` dissolved into `pe-sub-ui/src/types/` | The original rationale for a shared TypeScript package was to share types and the BB engine between the Node.js API and the UI. Once the API moved to Spring Boot (Java), the shared-TypeScript premise broke. Only two files in `pe-sub-ui` imported from `pe-sub-common`, both type-only imports. The package was merged into `pe-sub-ui/src/types/` and the repo deleted |
| 12 | Configuration persisted to database; TypeScript files are fallbacks | Advance rates, eligibility rules, and concentration limits are seeded via `V1_2__seed.sql` and served from a startup-loaded cache (`ConfigService`). The TypeScript constants in `pe-sub-ui/src/config/` remain as offline fallbacks — `configService.ts` catches API errors and returns them transparently. This lets config change via DB upsert without a deployment, while keeping the UI functional if the API is unreachable |
| 13 | `lei` field on LP records | LP identity field for LEI or internal counterparty ID. Decision pending (week of 2026-06-02): whether to use LEI or internal UBS counterparty ID as the canonical identifier for REST-based classification auto-population |
| 14 | Audit trail: `user_name` stored denormalized, not via FK | `audit_log.user_id` is reserved for future auth integration but not yet populated. A separate `user_name varchar(100)` column stores the display name at write time. This avoids JOIN complexity before authentication is in place and ensures audit entries remain interpretable even if the users table is modified. When auth is added, both columns will be populated |
| 15 | `ConfigEntry.value` uses `@JdbcTypeCode(SqlTypes.JSON)` not `@Convert` | Hibernate 6 routes UPDATE bindings through `ObjectJdbcType` which calls `setObject(..., Types.JAVA_OBJECT)` — the PostgreSQL JDBC driver rejects this. `@JdbcTypeCode(SqlTypes.JSON)` uses Hibernate 6's native JSON binding path, which works for both INSERT and UPDATE. `BbSnapshot` is unaffected as it is INSERT-only |
| 16 | Vite dev proxy sets `X-Forwarded-For` | Without this, Spring Boot sees `remoteAddr = 127.0.0.1` (the proxy itself) for all requests. The proxy now sets `X-Forwarded-For` to the browser's socket address before forwarding. `AuditLogService.extractIp()` already prefers this header, so workstation IPs are recorded correctly in development and production alike |

---

## 8. Open Questions / TBD

- Azure architecture: Container Apps vs App Service, region, networking, Key Vault integration
- Authentication: Azure AD (Entra ID) SSO vs internal auth — to be confirmed
- Extraction engine: OCR / Excel parsing service — in-platform or external (Azure Document Intelligence?)
- Name-matching service: runs in `pe-sub-api` or separate Azure Function / microservice?
- `pe-sub-infra` scaffold: after Azure architecture is confirmed
- LP identifier (Decision 13): LEI vs internal UBS counterparty ID — decision pending week of 2026-06-02

---

> **Note on `PE-Sub-Platform-Solution-Design.docx`:** The Word document is a point-in-time export and is no longer maintained in sync automatically. `SOLUTION_DESIGN.md` is the canonical reference.
