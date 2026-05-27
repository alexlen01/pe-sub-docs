# PE Sub Platform — Solution Design

> **Living document.** Updated continuously as architecture and implementation decisions are made.  
> Business context: `pe-sub-platform/docs/PE_SUB_SOLUTION.md`  
> As-is process: `pe-sub-platform/docs/BB_PROCESS_FLOW.md`  
> Prototype process: `pe-sub-platform/docs/NEW_BB_PROCESS_FLOW.md`

---

## 1. Repositories

| Repo | Purpose |
|------|---------|
| `pe-sub-common` | Shared TypeScript types, constants, Zod schemas, and the BB calculation engine |
| `pe-sub-db` | Drizzle ORM schema, migrations, and seed scripts — the authoritative database definition |
| `pe-sub-api` | Node.js / Express REST API — business logic, route handlers, DB access |
| `pe-sub-ui` | React / TypeScript / Vite frontend |
| `pe-sub-platform` | Working prototype only — used to gather and refine requirements; not deployed to production |

### Decision: four separate repos, not a monorepo

Rejected: Turborepo / pnpm workspaces monorepo with nested `apps/` and `packages/`.

Chosen: four flat repos.

**Rationale:** Simpler to navigate and own. Monorepo tooling overhead (workspace linking, shared tsconfig inheritance, Turborepo pipelines) is not justified for a focused internal tool where api and ui are always deployed together. The only practical downside — `pe-sub-common` version bumps must be propagated manually — is acceptable at this team size.

### Deferred: `pe-sub-infra`

Terraform for Azure cloud resources will be managed in a dedicated `pe-sub-infra` repo. Deferred until the cloud architecture is confirmed. Target resources include Azure Container Apps (or App Service), Azure Database for PostgreSQL Flexible Server, Azure Key Vault, and networking / DNS. See §6 for current state.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript 5.x | Used across all four repos |
| Frontend runtime | React 18, Vite 5 | `pe-sub-ui` |
| Backend runtime | Node.js 20 LTS, Express 4 | `pe-sub-api` |
| ORM | Drizzle ORM | SQL-first, fully typed, lightweight |
| Database | PostgreSQL | Azure Database for PostgreSQL Flexible Server in production |
| Validation | Zod 3 | Schemas defined in `pe-sub-common`, consumed by both API middleware and UI forms |
| Dev server proxy | Vite `server.proxy` | `/api` → `localhost:3001` in development; avoids CORS config locally |

---

## 3. Architecture

```
pe-sub-ui  ──── /api (proxy) ────▶  pe-sub-api  ────▶  PostgreSQL
    │                                    │
    └── imports ──▶  pe-sub-common  ◀── ┘
                          │
                     pe-sub-db (schema + migrations)
                          │
                     pe-sub-api (runtime DB client)
```

- `pe-sub-ui` imports types and the BB engine from `pe-sub-common`. It does **not** import from `pe-sub-db` or `pe-sub-api`.
- `pe-sub-api` imports from both `pe-sub-common` (types, engine) and `pe-sub-db` (schema, Drizzle types).
- `pe-sub-db` is standalone. It is consumed by `pe-sub-api` at runtime and run directly for migrations (`npm run migrate`) and seeding (`npm run seed`).
- The BB calculation engine lives in `pe-sub-common/src/engine/` with no framework dependencies — it takes plain LP arrays and returns typed results. This makes it independently unit-testable and portable (could run as an Azure Function if batch processing demands it later).

---

## 4. Database Schema

Defined in `pe-sub-db/src/schema.ts` using Drizzle's `pgTable`.

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

Stores the LP Master — one record per LP per facility. Fields align exactly with **BB_PROCESS_FLOW Step 4 — Final Shadow BB**:

| Group | Columns |
|-------|---------|
| Identity & Classification | rank, name, parent, spv, hq, type, region, ig, cls, cls_tag |
| Ratings | sp, mdy, fitch |
| Financial Scale | aum, nav, pension, pension_funded |
| Commitment Data | cap_commit, pct_cap_commit, called_cap |
| Uncalled / Eligible Capital | uc, pct_uncalled, pct_called |
| Concentration & BB | agent_conc, ubs_conc, agent_rate, abb |
| Status | inc, rcl, tf |
| Meta | notes, facility_id (FK), created_at, updated_at |

Note: `rate` (BUSA advance rate) and computed fields (`ubb`, `delta`, `uec`) are **not stored** — they are derived at runtime by the BB engine from `cls` and `uc`. Only `abb` (agent's submitted BB value) is stored as a source field.

### `bb_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| facility_id | integer FK → facilities | |
| calculated_by | integer FK → users nullable | |
| calculated_at | timestamp | |
| result | jsonb | Full `BBResult` (typed in `pe-sub-common`) — lps[], summary, breaches[] |

Snapshots are append-only. The latest snapshot per facility is the current Shadow BB. Historical snapshots provide the audit trail and support trend reporting (Effective Advance Rates, Collateral & Coverage history).

---

## 5. API Routes

Base path: `/api`. Served by `pe-sub-api` on port 3001.

### Facilities

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/facilities` | List all facilities |
| GET | `/api/facilities/:id` | Single facility |
| PATCH | `/api/facilities/:id/status` | Update facility status |

### LPs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lps` | List LPs — query params: `facilityId`, `cls`, `search` |
| GET | `/api/lps/:id` | Single LP record |
| PATCH | `/api/lps/:id` | Update LP fields (classification override, reclassify, etc.) |

### Borrowing Base

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bb/run/:facilityId` | Compute Shadow BB, persist snapshot, update facility `last_run_at` |
| GET | `/api/bb/snapshots/:facilityId` | All snapshots for a facility (ordered by date) |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/collateral/:facilityId` | Latest snapshot summary (Collateral & Coverage) |
| GET | `/api/reports/concentration/:facilityId` | Latest breach list (Concentration Exposures) |

---

## 6. Process Flow Alignment

### Step 4 — Final Shadow BB (LP record fields)

LP record fields in both the Shadow BB detail panel (`pe-sub-platform/src/screens/ShadowBB`) and the LP Master overlay (`pe-sub-platform/src/screens/LPMaster`) show **exactly** the fields from BB_PROCESS_FLOW Step 4. Non-Step-4 fields removed: Transfer Flag, Reclassified, High Quality, NAV/AUM, Applicable Rating, UBS BB Delta, UBS BB Calculation section.

The production `lps` table schema mirrors this field set. `type` (`Institutional` | `HNW`) covers both "Investor Type" and "Institutional vs HNW" from the spec — a single field with those two values.

### Step 6 — Portfolio-Level Reporting

Reports screen tabs correspond 1:1 to Step 6 outputs:

| Step 6 Output | Tab ID | API endpoint |
|---------------|--------|--------------|
| Collateral Market Value & Coverage | `collateral` | `/api/reports/collateral/:id` |
| Effective Advance Rates | `ear` | (from snapshot summary) |
| Agent Bank Exposure | `agent-bank` | TBD |
| Concentration Exposures | `concentration` | `/api/reports/concentration/:id` |
| Ad Hoc Reporting | `adhoc` | TBD |

### Scheduled Batch Job

One system-managed job: runs on the 1st of each month at 00:00, resets all active facility statuses to `Not Started`. No user-configurable schedules. To be implemented as a cron trigger in `pe-sub-api` (or Azure Function / Container App job).

---

## 7. Key Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Four flat repos, not a monorepo | Simpler ownership and navigation; monorepo tooling overhead unjustified at this scale |
| 2 | `pe-sub-infra` deferred | No Terraform needed until cloud architecture is confirmed; Azure resources TBD |
| 3 | BB engine in `pe-sub-common`, no framework deps | Independently unit-testable; portable to Azure Function if needed |
| 4 | Drizzle over Prisma | SQL-first, lighter runtime, better fit for financial schemas where query control matters |
| 5 | Computed BB fields not stored in `lps` | `rate`, `ubb`, `delta`, `uec` are derived — storing them would create drift risk. Only source fields and `abb` (agent-submitted) are persisted |
| 6 | `bb_snapshots.result` as jsonb | Full `BBResult` stored as typed JSON; enables historical reporting without denormalising 900-LP arrays into rows |
| 7 | Vite dev proxy for `/api` | Avoids CORS config in development; prod will route through Azure Front Door or API Management |
| 8 | Zod schemas in `pe-sub-common` | Single definition used by both Express `validate` middleware and React form validation — no duplication |
| 9 | Prototype (`pe-sub-platform`) retained as-is | Continues as the requirements reference; changes to the prototype inform production implementation, not the other way around |
| 10 | Terraform target: Azure | Cloud provider confirmed; infra repo (`pe-sub-infra`) to be scaffolded when Azure architecture is designed |

---

## 8. Open Questions / TBD

- Azure architecture: Container Apps vs App Service, region, networking, Key Vault integration
- Authentication: Azure AD (Entra ID) SSO vs internal auth — to be confirmed
- Extraction engine: OCR / Excel parsing service — in-platform or external (Azure Document Intelligence?)
- Name-matching service: runs in `pe-sub-api` or separate Azure Function?
- `pe-sub-infra` scaffold: after Azure architecture is confirmed
