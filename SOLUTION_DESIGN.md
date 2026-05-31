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
| `pe-sub-db` | Drizzle ORM schema, Flyway SQL migrations, and seed scripts — the authoritative database definition |
| `pe-sub-docs` | Solution design, OpenAPI specification, and architecture documentation |
| `pe-sub-platform` | Working prototype only — used to gather and refine requirements; not deployed to production |

### Decision: five flat repos, not a monorepo

Rejected: Turborepo / pnpm workspaces monorepo with nested `apps/` and `packages/`.

Chosen: five flat repos.

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
| Schema / migrations | Drizzle ORM + Flyway | Drizzle defines schema in `pe-sub-db`; Flyway SQL migrations run from `pe-sub-api` on startup |
| Database | PostgreSQL 16 | Azure Database for PostgreSQL Flexible Server in production; Docker locally |
| Validation | Jakarta Validation (`@Valid`) | `pe-sub-api` |
| JSON / JSONB | Jackson 2, `PGobject` | `bb_snapshots.result` column via `AttributeConverter` |

---

## 3. Architecture

```
pe-sub-ui  ──── /api (Vite proxy) ────▶  pe-sub-api (Spring Boot)  ────▶  PostgreSQL
                                               │
                                         Spring Data JPA
                                               │
                                         pe-sub-db (Flyway SQL migrations)
```

- `pe-sub-ui` calls the API exclusively via the Vite dev proxy. Domain types (`LP`, `Facility`, `BBResult`, etc.) live in `pe-sub-ui/src/types/` — **no shared package**.
- `pe-sub-api` owns all business logic: LP management, BB calculation (Java port of the engine), submission ingestion, name matching. It connects directly to PostgreSQL via Spring Data JPA.
- `pe-sub-db` is the schema source of truth. Its Drizzle TypeScript schema is the human-readable definition; its `drizzle/` output is the reference for writing Flyway SQL migrations. It is **not** a runtime dependency of `pe-sub-api`.
- The BB calculation engine is implemented twice — as a Java `@Service` in `pe-sub-api` (authoritative, persists snapshots) and as a TypeScript function in `pe-sub-ui/src/services/bbCalculationService.ts` (client-side live preview in the Shadow BB screen). Both must produce identical results.

---

## 4. Database Schema

Defined in `pe-sub-db/src/schema.ts` (Drizzle). SQL DDL applied via Flyway migration `V1__init.sql` in `pe-sub-api/src/main/resources/db/migration/`.

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

Added by Flyway migration `V3__submissions.sql`.

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

### `config`

Platform configuration — advance rates, eligibility rules, concentration limits, and global settings. Seeded by `V2__config.sql`; read-only at runtime.

| Column | Type | Notes |
|--------|------|-------|
| key | varchar(100) PK | e.g. `busa_tiers`, `elig_rules`, `conc_limits`, `global_settings` |
| value | jsonb | JSON array or object; shape varies by key |
| updated_at | timestamp | Set on upsert |

**Seeded rows (6):** `busa_tiers`, `agent_tiers`, `agent_rate_params`, `elig_rules`, `conc_limits`, `global_settings`.

**Runtime access:** `ConfigService.load()` (`@PostConstruct`) reads all rows into a `ConcurrentHashMap<String, JsonNode>` on every API startup. All reads hit the cache; no per-request DB queries. JSONB ↔ `JsonNode` conversion handled by `JsonNodeConverter` (same `PGobject` pattern as `BbResultConverter`).

**Drizzle schema gap:** the `config` table is not yet defined in `pe-sub-db/src/schema.ts`. It exists only in the Flyway migration. To close: add a `config` pgTable definition to `pe-sub-db/src/schema.ts`.

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
| GET | `/api/submissions` | ✅ | List all submissions; filter by `?facilityId=`; ordered newest first |
| POST | `/api/submissions` | ✅ | Create submission — multipart: `facilityId`, `agentBank`, `periodMonth`, `file`; saves file to `${app.uploads.path}`, returns 201 + Submission JSON |
| GET | `/api/submissions/:id` | ✅ | Single submission record or 404 |

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
| GET | `/api/field-mapping/alias-groups` | 🔲 | Alias-group dictionary (Core / Bank / User tiers) |
| GET | `/api/field-mapping/canonical-fields` | 🔲 | All canonical LP Master field names |
| GET | `/api/field-mapping/blocklist` | 🔲 | Column names that must never be mapped |
| GET | `/api/field-mapping/suggestions` | 🔲 | Pending user-submitted alias suggestions |
| POST | `/api/field-mapping/suggestions` | 🔲 | Submit a new alias suggestion |

### Matching

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/matching/queue` | 🔲 | Name-matching queue for a submission (`?submissionId=`) |
| PATCH | `/api/matching/queue/:id` | 🔲 | Accept / reject / manual-override a single match decision |
| GET | `/api/matching/thresholds` | 🔲 | Current auto-accept and review-queue score thresholds |
| PATCH | `/api/matching/thresholds` | 🔲 | Update thresholds |

### Configuration

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/config/eligibility` | ✅ | Returns all 6 seeded keys (`BUSA_TIERS`, `AGENT_TIERS`, `AGENT_RATE_PARAMS`, `ELIG_RULES`, `CONC_LIMITS`, `GLOBAL_SETTINGS`) assembled from the in-memory cache |
| GET | `/api/config/wizard` | 🔲 | No `wizard_config` row seeded yet — returns 404; UI falls back to `pe-sub-ui/src/config/wizardConfig.ts` |
| GET | `/api/config/audit` | 🔲 | No `audit_config` row seeded yet — returns 404; UI falls back to `pe-sub-ui/src/config/auditConfig.ts` |
| GET | `/api/config/matching` | 🔲 | No `matching_config` row seeded yet — returns 404; UI falls back to `pe-sub-ui/src/config/matchingConfig.ts` |
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
| 4 | `pe-sub-db` uses Drizzle; `pe-sub-api` uses Spring Data JPA | Drizzle remains the schema source of truth (human-readable, SQL-first). Flyway SQL migrations are derived from it and applied by Spring Boot on startup. No Drizzle runtime dependency in the Java API |
| 5 | Computed BB fields not stored in `lps` | `rate`, `ubb`, `delta`, `uec` are derived — storing them would create drift risk. Only source fields and `abb` (agent-submitted) are persisted |
| 6 | `bb_snapshots.result` as jsonb | Full `BBResult` stored as typed JSON via `AttributeConverter` + `PGobject`; enables historical reporting without denormalising LP arrays into rows |
| 7 | Vite dev proxy for `/api` | Avoids CORS config in development; prod will route through Azure Front Door or API Management |
| 8 | No mock data fallbacks in production services | Service layer (`facilityService.ts`, `lpService.ts`, etc.) returns empty arrays on API failure. No fake data leaks into production UI |
| 9 | Prototype (`pe-sub-platform`) retained as-is | Continues as the requirements reference; changes to the prototype inform production implementation, not the other way around |
| 10 | Terraform target: Azure | Cloud provider confirmed; `pe-sub-infra` to be scaffolded when Azure architecture is designed |
| 11 | `pe-sub-common` dissolved into `pe-sub-ui/src/types/` | The original rationale for a shared TypeScript package was to share types and the BB engine between the Node.js API and the UI. Once the API moved to Spring Boot (Java), the shared-TypeScript premise broke. Only two files in `pe-sub-ui` imported from `pe-sub-common`, both type-only imports. The package was merged into `pe-sub-ui/src/types/` and the repo deleted |
| 12 | Configuration persisted to database; TypeScript files are fallbacks | Advance rates, eligibility rules, and concentration limits are seeded via `V2__config.sql` and served from a startup-loaded cache (`ConfigService`). The TypeScript constants in `pe-sub-ui/src/config/` remain as offline fallbacks — `configService.ts` catches API errors and returns them transparently. This lets config change via DB upsert without a deployment, while keeping the UI functional if the API is unreachable |
| 13 | `lei` field on LP records | LP identity field for LEI or internal counterparty ID. Decision pending (week of 2026-06-02): whether to use LEI or internal UBS counterparty ID as the canonical identifier for REST-based classification auto-population |

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
