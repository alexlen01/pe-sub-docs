# PE Sub Platform — Solution Design

---


## Business Context — Private Equity Subscription Finance

### What Is a Subscription Credit Facility?

A **subscription credit facility** (commonly called a "sub line" or "capital call facility") is a revolving credit line extended to a private equity fund. Unlike a conventional loan secured by real assets, a sub line is secured entirely by the **unfunded capital commitments** of the fund's limited partners. The lender is not lending against the portfolio — it is lending against the legal obligation of sophisticated investors to fund capital when called.

Sub lines exist because PE funds need to move faster than their investors can. Wiring $50 million to close an acquisition takes a business day from a bank; collecting that same amount from 200 pension funds and endowments takes two to three weeks. A sub line bridges that gap. The fund draws on the line, closes the deal, then issues a capital call to LPs to repay the bank. The cycle repeats throughout the fund's investment period, typically four to six years.

### Who Is Who

**General Partner (GP)** — the fund manager. BlackRock, KKR, Blue Owl, Apollo. The GP makes investment decisions, manages the fund, and is the **borrower** on the subscription facility. The GP controls when and how much to draw, and when to call capital from LPs to repay.

**Limited Partners (LPs)** — the investors. Pension funds, sovereign wealth funds, endowments, insurance companies, family offices. LPs sign a subscription agreement committing to contribute a fixed amount of capital over the fund's life. That **unfunded commitment** — the portion not yet called — is the collateral that backs the sub line. LPs never sign the loan documents; their commitment letters and the fund's partnership agreement give the bank the right to call capital directly if the GP defaults.

**Agent Bank** — the lead lender that originates and administers the facility. Goldman Sachs, JPMorgan, Subscription Finance Ltd., Cadence Bank. The agent coordinates the syndicate, receives the monthly borrowing base certificate from the GP, calculates availability, and manages draws and repayments. In a syndicated facility, the agent does this on behalf of all participating lenders.

**Participating Lenders** — banks that take a share of the facility alongside the agent. A $500M facility might have five banks each holding $100M of exposure. Each participant earns interest on its share but relies on the agent for administration. A lender like UBS may participate in dozens of sub lines across many GPs.

**Credit Officer (CO)** — the person at the lending institution responsible for underwriting and ongoing monitoring of the facility. They review the borrowing base, assess LP credit quality, flag eligibility concerns, and approve draws. In larger banks this role is supported by analysts and a supervisory layer.

### The Borrowing Base

The **borrowing base** is the calculation that determines how much the fund may have outstanding at any time. It is not the total LP commitments — it is a risk-adjusted, eligibility-filtered subset of unfunded commitments.

The mechanics:

```
For each eligible LP:
  Eligible Uncalled Capital  = Unfunded Commitment  (subject to concentration cap)
  LP Contribution to BB      = Eligible Uncalled × Advance Rate

Borrowing Base  = Sum of all LP Contributions
Availability    = Borrowing Base  –  Current Drawings
```

**Advance Rate** reflects the credit quality of each LP and how confident the lender is that the LP will honor its commitment if called. Higher quality, higher rate:

| UBS LP Classification | Advance Rate (≥40% funded) | Rationale |
|---|---|---|
| Rated Investor | 90% | S&P/Moody's/Fitch rated; highest payment certainty (concentration limit steps by rating band: AAA 25% / AA 20% / A 15% / BBB 10%) |
| Corp Pension > $5Bn Assets | 90% | Corporate pension with total assets above USD 5bn |
| Corp Pension > $1Bn Assets | 90% | Corporate pension with total assets USD 1–5bn |
| Unrated NAV > $1Bn | 90% | Large unrated investor; NAV above USD 1bn |
| FoF & Other > $10Bn AUM | 75% | Fund of funds or other asset manager with AUM above USD 10bn |
| Other Institutional | 65% | Other institutional investor; higher uncertainty |
| HNW Feeder (acceptable) | 65% | High-net-worth feeder meeting acceptable criteria |
| HNW (acceptable) | 50% | Acceptable family office / HNW investor |
| Excluded | 0% | Does not meet eligibility criteria; not counted |

**Advance Rate** is not a single flat per-class figure: it is a function of **(classification, % funded)** with a break at **40% funded**. The figures above are the ≥40%-funded "mature" rates; weaker credits step down below the threshold — e.g. Rated BBB 65%, FoF 65%, Other Inst / HNW Feeder 50%, HNW 0% — until the LP has demonstrated funding. For Rated Investor, both the advance rate and the concentration limit resolve by agency rating band. This is the **Borrowing Base Criteria Matrix**; see `BB_CRITERIA_DESIGN.md`.

**Concentration Limits** cap how much any single LP can contribute to the borrowing base. A $500M fund with a 10% concentration limit means no LP can contribute more than $50M to availability, even if their unfunded commitment is $200M. This prevents the borrowing base from being dominated by one investor whose default would cause a facility breach.

**Eligibility Criteria** exclude LPs that pose legal or structural risk: foreign governmental entities subject to sanctions, ERISA plans in excess of the 25% "plan asset" threshold, LPs in default on their capital call obligations, LPs whose commitments are subject to legal challenge.

### The Agent Borrowing Base Certificate

Each month (or more frequently near fund-level covenants), the GP submits a **Borrowing Base Certificate** to the agent. The agent reviews it, applies their own eligibility determinations, and certifies the availability. This certificate drives how much the fund can draw.

The certificate lists every LP in the fund with:
- Investor name (as recorded by the agent)
- Total commitment and amount called to date
- Unfunded (uncalled) commitment
- LP classification as the agent sees it
- Applied advance rate
- LP-level borrowing base contribution (Uncalled Capital × Advance Rate)
- Concentration limit and any excess excluded
- Total facility availability

This is the Excel file that arrives from Agent Banks formatted by their prime services team, using their internal naming conventions, sometimes combining or splitting LP records in ways that don't perfectly match the lender's own LP Master database.

#### Multi-Tab Workbook Structure

Agent BB workbooks are typically multi-tab Excel files following a four-tab industry standard:

| Tab | Role | Contents |
|---|---|---|
| Master Certificate | `TOP_SHEET` | Executed cover page: borrowing base totals, availability calculation, officer sign-offs |
| LP Grid & Advance Rate Calculator | `LP_GRID` | One row per LP — commitment, uncalled capital, LP classification, advance rate, BB contribution, concentration limit |
| Concentration Caps & Haircuts | `CONCENTRATION` | Aggregate concentration tests by LP type, geography, and fund; haircut computations |
| Capital Call & Roll-Forward Log | `CAPITAL_CALL` | History of capital calls drawn and repaid; reconciles outstanding balance |

The LP Grid tab is the primary extraction target. The platform identifies the correct tab by role, locates the header row, and skips summary/subtotal rows automatically.

#### LP Grid Format Diversity

Different agent banks use different column headers, row structures, and classification schemes for the same underlying data. Key variations:

- **Column naming** — Goldman Sachs uses "Borrowing Base Contribution"; SVB uses "Remaining Callable Capital" for uncalled capital; BNY uses "Individual Unfunded Commitment"
- **Group-header rows** — Goldman-style workbooks interleave classification headers (Rated Investors, Unrated Investors, Included Investors, Excluded Investors) between LP data rows rather than providing a classification column. The extraction engine uses these as sticky context — when a group-header row is encountered, subsequent LP rows inherit its classification until the next header
- **LP Classification column** — Wells Fargo and some other banks provide LP classification as a dedicated column; no group-header rows needed
- **Summary rows** — SVB workbooks place two summary rows above the column header row; Goldman workbooks place subtotal rows between classification groups. These are identified by keyword matching (Total, Subtotal, Grand Total, etc.) and discarded
- **Tranche structure** — facilities with Tranche A / Tranche B structures may carry separate advance rate and concentration columns per tranche

### The Shadow Borrowing Base

A participating lender does not simply accept the agent's certificate. They calculate their own **Shadow Borrowing Base** independently. The shadow BB uses the lender's own:

- **LP Master database** — their authoritative record of LP identity, classification, and credit quality
- **Eligibility rules** — which may differ from the agent's on certain LP types
- **Advance rates** — the agent's rates and the lender's rates often diverge, especially for unrated LPs
- **Concentration limits** — the lender may apply tighter per-LP caps than the agent

The **delta** (agent BB minus shadow BB) tells the lender whether the agent is overstating or understating availability. Persistent positive delta — agent claiming more availability than the lender calculates — is a credit concern. It may indicate the agent is using looser eligibility standards, classifying LPs more favorably, or applying higher advance rates than the lender's credit agreement permits.

Monitoring the delta across monthly submissions, tracking which LPs are classified differently and why, is a core part of credit officer work on sub line portfolios.

### The LP Name Matching Problem

The delta often begins with a naming problem. The agent records an LP as **"CalPERS"**. The lender's LP Master has **"California Public Employees Retirement System"**. If the credit officer cannot link those two records, the LP may be treated as unknown — excluded from the shadow BB by default — creating an artificial delta that suggests a problem where none exists.

At scale this is not trivial. A fund with 900 LPs submitting monthly means 900 name-matching decisions, every month, against a master database of thousands of LPs across dozens of funds. The names arrive from banks that have their own abbreviation standards, OCR-processed from scanned documents, or typed by operations staff. Variations are not exceptions — they are the norm:

- "Teachers' Retirement System of Texas" vs "Texas Teachers Ret. Sys."
- "Abu Dhabi Investment Authority" vs "ADIA"
- "Canada Pension Plan Investment Board" vs "CPPIB"
- "Trustees of Princeton University" vs "Princeton University Endowment"

Manual matching at this scale is slow and error-prone. A missed match means an LP gets excluded from the shadow BB, understating availability and potentially triggering unnecessary credit reviews. An incorrect match — linking the wrong LP records — means the shadow BB is calculated against the wrong credit profile, potentially with the wrong advance rate applied.

### Why It Matters: Risk and Revenue

From a **risk perspective**, the sub line is unusual collateral. If the GP defaults, the lender must issue a capital call directly to LPs. Whether LPs fund that call — and how quickly — depends entirely on the quality and legal standing of each LP's commitment. A borrowing base filled with ERISA-challenged pension funds, foreign entities under sanctions review, or LPs that have historically been slow to fund is materially riskier than a BB dominated by AAA-rated sovereign wealth funds. Getting classification right is a credit underwriting question, not just an administrative one.

From a **revenue perspective**, sub lines are attractive bank business: short-duration, self-liquidating, relationship-sticky. A bank that administers the facility earns agent fees on top of spread. Participating lenders earn clean interest income with minimal credit losses historically — LP defaults on sub line capital calls are extremely rare. But the margins are thin, which means the operational cost of monitoring matters. Credit officers manually reconciling BB certificates against LP Master records every month is expensive. Automating that process — the core proposition of the PE Sub Platform — directly improves the economics.

### How the PE Sub Platform Fits

The platform addresses the three highest-friction points in the monthly sub line monitoring cycle:

**1. Extraction** — The agent's Excel arrives in whatever format Goldman Sachs, JPMorgan, or Cadence Bank uses this month. The platform identifies the LP Grid tab, locates the header row, resolves group-header rows (Rated / Unrated / Included / Excluded) to LP classifications, skips subtotal rows, and maps each column to a canonical field name via the Field Mapping Dictionary. Fields the workbook omits (Called Capital, % of Capital Commitments, Concentration %, Excess Concentration %) are computed per sleeve and marked `Derived:` for cross-check — never treated as agent-reported inputs.

**2. LP Name Matching** — Jaro-Winkler and Levenshtein similarity algorithms score each agent LP name against the LP Master. High-confidence matches (≥95%) are auto-accepted without credit officer intervention. The remaining matches go to a review queue where the CO sees the algorithm's reasoning — which name normalization steps were applied, what the competing candidates scored, why the top match was selected — and accepts or rejects with one click.

**3. Shadow BB Calculation** — Once LPs are matched and classified, the platform applies the lender's own advance rates, concentration limits, and eligibility rules to produce the shadow BB. The delta against the agent's numbers is immediately visible at both the portfolio level and per-LP level, with classification differences highlighted.

What previously took a credit officer two to three days per submission — downloading the Excel, running VLOOKUP matching, manually reviewing unmatched names, rebuilding the BB model — becomes an afternoon workflow, with an audit trail of every decision made along the way.

---

## 1. Repositories

| Repo | Purpose |
|------|---------|
| `pe-sub-ui` | React / TypeScript / Vite frontend. Domain types (`LP`, `Facility`, `BBResult`, etc.) live in `src/types/` |
| `pe-sub-api` | Spring Boot 4.1 / Java 21 REST API — business logic, route handlers, JPA / DB access |
| `pe-sub-extraction` | Spring Boot 4.1 / Java 21 document extraction service — parses XLSX/CSV agent schedules, returns structured LP records to `pe-sub-api`; maintains BB template registry |
| `pe-sub-jobs` | Spring Boot 4.1 / Java 21 / Spring Batch 6 ingestion jobs service — CSV upserts (`facility-ingest`, `lp-master-ingest`) into the shared PostgreSQL |
| `pe-sub-docs` | Solution design, OpenAPI specification (`openapi.yaml` v0.8.0), and Postman/Talend API collection |

---

## 2. Tech Stack

### Core services (pe-sub-api, pe-sub-extraction, pe-sub-jobs)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Java 21 (LTS) | All three backend services. |
| Runtime | Spring Boot 4.1 | All three backend services (upgraded from Boot 3.5, July 2026). Modularized auto-configuration: Flyway needs `spring-boot-starter-flyway`; MockMvc tests need `spring-boot-starter-webmvc-test`; `@WithMockUser` needs `spring-boot-starter-security-test` |
| Build tool | Maven 3.9 | Builds require a local Maven install |
| ORM / persistence | Spring Data JPA (Hibernate 7) | `pe-sub-api` and `pe-sub-extraction` |
| Schema / migrations | Flyway (`spring-boot-starter-flyway`) | SQL migrations in `pe-sub-api/src/main/resources/db/migration/`; applied automatically on startup |
| Database | PostgreSQL 16 | Azure Database for PostgreSQL Flexible Server in production; Docker locally |
| JSON / JSONB | Jackson 3 (`tools.jackson.*`), `PGobject` | `bb_snapshots.result` column via `AttributeConverter`. Jackson 2 fully removed; annotations remain `com.fasterxml.jackson.annotation`. Jackson 2 null-to-primitive parity kept via `spring.jackson.deserialization.fail-on-null-for-primitives: false` in `pe-sub-api` |
| HTTP client | Spring `RestClient` | `pe-sub-api` → `pe-sub-extraction` calls |
| XLSX / XLS parsing | Apache POI 5.5.1 (`poi-ooxml`) | `pe-sub-extraction` |
| CSV parsing | Apache Commons CSV 1.14.1 | `pe-sub-extraction` |
| Logging | Logback via `logback-spring.xml` | Rolling daily log, gzip archive, 30-day retention, 2 GB cap; both `pe-sub-api` and `pe-sub-extraction` |

### Frontend (pe-sub-ui)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript 5.x | |
| Runtime | React 18, Vite 5 | |
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
- `pe-sub-extraction` parses uploaded spreadsheets, scores fields by confidence, and returns structured results. When `forward=true` it can also POST to `pe-sub-api/lpRecords/ingest` directly (used for standalone testing only).
- `pe-sub-jobs` is intended to run scheduled tasks (e.g. automatic monthly BB recalculation) against `pe-sub-api`. No jobs are implemented yet.
- In Kubernetes, `pe-sub-extraction` and `pe-sub-jobs` are `ClusterIP` (internal only). Only `pe-sub-api` has a `NodePort` (30001) accessible outside the cluster.

---

## 4. Database Schema

Defined by Flyway SQL migrations in `pe-sub-api/src/main/resources/db/migration/`:

| File | Contents |
|------|----------|
| `V1_1__schema.sql` | All DDL — `users`, `facilities` (incl. operational metadata: `account_number`, `loan_amount`, `maturity_date`, `collateral_date`, `bank_status`, `bank_status_date`), **`lp_master`** (the bank-wide LP profile store), `lp_records` (incl. the precise-money `NUMERIC` columns, the `*_concentration_limit` pair and the `lp_master_id` link), `bb_snapshots`, `report_history`, `config`, `submissions` (incl. `wizard_step` / `shadow_bb_overrides`), `audit_log`, `lp_rates`, `submission_extractions`, `match_queue_entries`, FM Dictionary tables, BB template registry tables (`bb_templates` / `bb_template_tabs` / `bb_template_groups`, slug- and class-keyed) |
| `V1_2__seed.sql` | Config seed (`busa_tiers`, `agent_tiers`, `agent_rate_params`, `elig_rules`, `conc_limits`, `global_settings`, `matching_config`; the `classification_config` and per-LP `cls_conc_limit_defaults`/`cls_conc_limit_bounds` are seeded in `V1_3__config.sql`); FM Dictionary — canonical fields (incl. **Agent LP Classification** + derived **UBS LP Classification**), aliases, blocklist, suggestions; LP rates feed (`source='SIMULATED'`). Template registry rows are **not** seeded — templates enter exclusively via `POST /api/bb-templates/import` (BB template `*.xlsx` workbooks) |
| `V1_3__config.sql` | Database-owned UI/domain configuration: `classification_config` (CLS/Agent CLS/UBS CLS option lists, UBS default rates, agent-rate→UBS-tier mapping, Agent→UBS CLS map) and further config keys; `matching_config` regex expansion patch |
| `V1_4__lp_parent_child.sql` | LP Master parent/child resolution and the alias feedback loop — `lp_master.parent_id` (self-reference) + `is_ultimate_parent` with a backfill from the existing `parent` display string, the `lp_aliases` table, and `match_queue_entries.matched_lp_master_id` |

To make a schema change: add a new `V1_N__description.sql` (or `V2_1__` for the next major release) and restart `pe-sub-api`. V1_1 and V1_2 are the consolidated base — do **not** modify them once a production DB has been initialised; use new numbered files instead (see Decision 44).

### `users`

Directory of people who have authenticated, mirrored from the gateway's `X-Auth-*` headers on
each authenticated request (`UserDirectoryService`). Not a credential store — no password column,
and the API never authenticates anyone itself. Exists so screens can turn a stored uuName into a
person without a corporate-directory lookup.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| uu_name | varchar(50) unique | Stable authentication identity (e.g. `le05751`) — the natural key; email and surname both change over time. A real uuName is 7 alphanumeric chars; the width is headroom for system/override identities |
| first_name | varchar(255) | Empty when the gateway sent no header; a blank never overwrites a known value |
| last_name | varchar(255) | Same |
| email | varchar(255) | Same |
| role | varchar(50) | Highest-privilege human role asserted: `Manager` \| `Analyst` \| `Viewer`. SERVICE principals are never stored |
| created_at | timestamp | |
| updated_at | timestamp | Bumped only when an attribute actually changed |
| last_seen_at | timestamp | Refreshed on a 10-minute throttle, not on every request |

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

### `lp_master`

The **bank-wide** LP profile store — one row per legal entity, keyed by `investor_name`
(`NOT NULL UNIQUE`). It is an *upstream input* to facility work, not an output of it: an LP exists in
LP Master independently of any facility, and every facility that lists that LP inherits the same
identity, ratings, scale and UBS credit-profile defaults from it. Contrast `lp_records`, which holds
one row per LP **per facility** and carries the facility-specific computed figures.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| investor_name | varchar(255) **unique** | The natural key. Ingest, write-back and matching all resolve on it |
| parent | varchar(255) nullable | Sponsor/parent name **as displayed and ingested** — the string form every producer speaks |
| parent_id | integer FK → `lp_master(id)` nullable | *(V1_4)* Resolved self-reference the matching engine traverses. `ON DELETE SET NULL` |
| is_ultimate_parent | boolean not null | *(V1_4)* True when `parent_id IS NULL` — this row is the top of its chain |
| spv | boolean not null, default false | |
| high_quality | boolean not null, default true | The HQ flag |
| investor_type | varchar(255) nullable | Industry/sector profile — SWF, Public Pension, Family Office, … (9 values in the reference extract) |
| institutional_or_hnw | varchar(255) nullable | `Institutional` / `HNW` |
| region_location | varchar(255) nullable | |
| investment_grade | boolean not null, default false | |
| sp_rating / moodys_rating / fitch_rating | varchar(50) not null, default `''` | Agency grades incl. `NR`. Empty string, never null — see the empty-string contract below |
| aum / nav / pension_assets | varchar(50) nullable | LP-size **display** strings (`$700Mn`, `$4.8 bn`, `2T`). Never BB inputs; they stay VARCHAR on both `lp_master` and `lp_records`, so the copy across that boundary is a plain assignment |
| funding_ratio | numeric(7,4) nullable | Fraction — `1.9000` = 190% funded |
| ubs_lp_category | varchar(255) nullable | UBS LP Category — the bank's risk bucket. Distinct from the agent's category, which is facility-scoped and lives only on `lp_records` |
| ubs_default_advance_rate | numeric(7,4) nullable | Fraction — `0.9000` = 90% |
| ubs_default_concentration_limit | numeric(20,2) nullable | Mirrors `lp_records.ubs_concentration_limit` **exactly**, including the percent-or-dollars magnitude split, so a $25M cap round-trips — `NUMERIC(7,4)` could not hold it |
| notes | text nullable | |
| created_at / updated_at | timestamp | |

Index: `idx_lp_master_parent_id` on `parent_id`.

**What LP Master does and does not hold.** It carries the LP's stable identity, ratings, scale and
the **UBS** credit-profile defaults. It holds no commitment, uncalled, concentration-excess or
borrowing-base figures, and no agent-side fields — those are per-facility and belong to `lp_records`.
`ubs_default_advance_rate` and `ubs_default_concentration_limit` are *defaults*: a facility record
may diverge after a credit officer edits it, and the divergence is intentional.

**Parent / child hierarchy (V1_4).** `lp_master` is self-referencing rather than split into a
separate parent table: a parent/sponsor and a child/feeder carry identical attributes, so one table
avoids a duplicate schema and UNION reads. Both forms of the link are kept — `parent` is the display
and ingest string, `parent_id` the resolved link — and `LpMasterService` keeps them consistent on
every write.

- BB eligibility and concentration limits turn on the creditworthiness of the **ultimate entity**,
  which for a feeder or SPV sits at the sponsor level. `LpMasterResolutionService` walks `parent_id`
  to the top and resolves each field **child-first, ancestors filling gaps**: a value the matched
  record carries wins, and only where it is absent does a parent supply one. The walk is bounded
  (`MAX_DEPTH = 16`) with a cycle guard; real hierarchies are two or three deep.
- The **matched child stays the identity of record** — `lp_records.lp_master_id` points at it, not at
  the parent — so the audit trail keeps naming the entity the agent actually listed.
- A `parent` naming a row that is not in LP Master stays unresolved (`parent_id` NULL) and reads as
  its own ultimate entity, which is the fallback the resolution logic applies anyway.
- **Self-name convention:** the feed writes a row's own name into `parent` to mean "no parent" —
  roughly 2,500 of ~6,000 rows. The V1_4 backfill excludes that case (`AND p.id <> c.id`) and no
  consumer should report those rows as unlinked. Compare case-sensitively.

**Ingest — clear-then-load, with `pe-sub-api` owning every write.** `pe-sub-jobs` reads the LP Master
CSV feed (`ingest.lp-master-file`, default `data/out/lp_master.csv`) and posts it to the API; it does
**not** write the table directly. `lpMasterIngestJob` runs two steps: `lpMasterClearStep`
(`POST /api/lp-master/clear`) wipes the table wholesale — LP Master is repopulated from the extract
feed on an *override, do not preserve* basis — then `lpMasterIngestStep` chunk-posts rows to
`POST /api/lp-master/ingest`. `LpMasterIngestService` upserts by investor name and treats the feed as
authoritative for the **whole** profile: every field is overwritten, including with nulls. Rows with
a blank investor name are skipped and counted in the `IngestSummary`. The clear detaches facility LP
records (`lp_records.lp_master_id` → NULL); it never deletes them.

**Write-back — facility decisions flow up.** `LpMasterWriteBackService` is the single place UBS
credit-profile decisions (LP category, advance rate, concentration limit) and refreshed
identity/rating/scale fields propagate from a facility's settled `lp_records` back into LP Master, so
the next submission on *any* facility inherits them. It runs on a Shadow BB run or re-run
(`ShadowBbService.runAndSnapshot`), on submission acceptance (`POST /api/submissions/:id/complete`)
and on a manual LP Category & Rate save flush (`LpClassificationService`). Where no LP Master row
exists for the LP — it was new in this cycle — one is created. The operation is idempotent, so
callers need not track whether LP Master is already current.

**Empty-string contract.** `sp_rating` / `moodys_rating` / `fitch_rating` are `NOT NULL DEFAULT ''`,
and the API serves absent string fields as `""` rather than `null`. Consumers must detect "not
provided" with `trim() !== ''` — never `??` or `== null`.

**Known unit drift.** The extract path writes `ubs_default_concentration_limit` as a *fraction* where
the read path interprets a *percent*. `bb_criteria_matrix` is the authority for the UBS advance rate
and concentration limit; `cls_conc_limit_defaults` is retained only as a UI pre-fill key.

### `lp_aliases`

*(V1_4)* The matching feedback loop — an uploaded Agent BB name string that an analyst accepted
against an LP Master record. The next upload of that exact string resolves in O(1) at score 100 and
skips fuzzy scoring, while still running the same parent routing.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| lp_master_id | integer FK → `lp_master(id)` not null | `ON DELETE CASCADE` — an alias is meaningless without its record |
| uploaded_name | varchar(255) **unique** | The Agent BB string exactly as uploaded |
| created_at | timestamp | |

Indices on `uploaded_name` and `lp_master_id`. Served by `GET /api/lp-master/:id/aliases`.

### `lp_records`

One record per LP **per facility** — the facility-scoped working copy of an LP, carrying the agent's
submitted figures and the UBS computed result. The bank-wide profile it draws from lives in
`lp_master`; `lp_master_id` is the link (nullable — an LP record may be unmatched, and an LP Master
clear detaches rather than deletes).

API/DTO field names (e.g. `cls`, `uc`, `inc`) differ from DB column names — see MASTER_DB_MAPPING.md
for the full mapping. The DB columns below are the authoritative names.

| Group | DB columns |
|-------|---------|
| Keys & links | id, facility_id (FK → facilities), lp_master_id (FK → lp_master, nullable) |
| Identity | investor_name, parent, spv, high_quality, investor_type, institutional_or_hnw, region_location, investment_grade |
| Categorisation | ubs_lp_category, ubs_lp_category_tag, agent_lp_category, agent_lp_category_source |
| Ratings | sp_rating, moodys_rating, fitch_rating |
| Financial scale | aum, nav, pension_assets, funding_ratio |
| Commitment data | capital_commitment, pct_of_fund_commitments, called_capital |
| Uncalled / eligible capital | uncalled_capital, pct_of_fund_uncalled, pct_lp_called |
| Concentration & BB | agent_concentration_limit, ubs_concentration_limit, agent_excess_concentration, ubs_excess_concentration, agent_advance_rate, ubs_advance_rate, agent_borrowing_base, ubs_borrowing_base |
| Status & ordering | included, reclassified, recallable_distributions, transferee, lp_rank, source_seq |
| Meta | notes, created_at, updated_at |

`agent_lp_category_source` is constrained to `EXTRACTED` \| `DERIVED` \| `USER_EDITED`
(`ck_lp_records_agent_lp_category_source`). Indices: `idx_lp_records_lp_master` on `lp_master_id`,
`idx_lp_records_facility_investor` on `(facility_id, investor_name)`.

Multiple rows with the same `investor_name` may exist within one facility (sleeves, vintages, SPVs);
row identity is the surrogate `id`. `source_seq` is the LP's row position in the originating Agent BB
and is the single ordering key through the wizard and the Shadow BB — nullable, and legacy or
manually created LPs sort last (NULL LAST).

Note: the BUSA advance rate and the computed fields (`ubb`, `delta`, `uec`) are **not stored** — the
BB engine derives them at runtime from the LP category and uncalled capital. Only
`agent_borrowing_base` (`abb`, the agent's submitted BB value) is stored as a source field, and it is
ingest-owned.

**Precise money columns.** The BB-driving money fields are single `NUMERIC(20,2)` columns holding
exact absolute dollars — `capital_commitment`, `called_capital`, `uncalled_capital`,
`agent_borrowing_base` — as are the computed `ubs_borrowing_base`, the two excess-concentration
columns and `recallable_distributions`. There is no formatted display-string sibling; the earlier
dual-write `*_num` companions were consolidated away (August 2026). Write paths parse inbound strings
to exact dollars (`MoneyValues.dollars`), the BB engine computes straight off the numeric
(`BbCalculationService.dollarM`), and DTOs format for display on the way out (`MoneyValues.display`)
at full precision — so an abbreviated input such as `"$4.2B"` is served back as `"$4,200,000,000"` and
never re-abbreviated. The API/UI contract for money stays string-typed.

`aum` / `nav` / `pension_assets` are the exception: they are LP-size **display** fields, never BB
inputs, and stay `VARCHAR(50)` here exactly as on `lp_master`, so the copy across that boundary is a
plain assignment. The one numeric consumer is the LP-size report aggregate, which parses on read.

**Percents and rates.** Every percent/rate column is `NUMERIC(7,4)` holding a **fraction** — `0.9100`
is 91% — never a percent-scaled number and never a formatted string. This matches the `lp_rates`
convention. Unlike money, the API wire format is numeric too: DTOs emit the raw fraction and
pe-sub-ui formats it for display (`formatPercent` in `utils/percent.ts`).

**Concentration limits.** `agent_concentration_limit` / `ubs_concentration_limit` (renamed from
`agent_conc` / `ubs_conc`, August 2026) are the one exception to the fraction scale. They are
`NUMERIC(20,2)` and hold either a percentage of total uncalled capital (`7.5` = 7.5%) or an absolute
dollar cap (`25000000` = $25M). The two are told apart by magnitude at
`BbCalculationService.ABSOLUTE_DOLLAR_MIN` (100,000) — the same threshold `parseMoney` applies to
suffix-less strings. `lp_master.ubs_default_concentration_limit` mirrors this encoding exactly.

### Reference Extract — `LP DB Export 2026.06.25.xlsx`

A flat export of the live LP-per-facility borrowing-base records, used as the **shape-of-data
reference** for `lp_records` (joined to `facilities`). Single sheet `_BBs20260625`,
**20,000 LP rows × 32 columns**, spanning **65 facilities** (`AccountID`) across **64 funds**
(`FndName`). One row = one LP, on one facility, as of one BB date.

> **Representative, not production truth.** The categorical columns are near-uniformly
> distributed (≈4,000 rows per Classification, ≈4,000 per Region), which is characteristic of a
> generated dataset. Treat it as an authoritative guide to **column set, value conventions, and
> formatting variance** — not as reconciled portfolio figures.

**Column → schema mapping (32 columns):**

| # | Export column | Maps to | Observed values / convention |
|---|---|---|---|
| 1 | `AccountID` | `facilities.account_number` | UBS loan reference, e.g. `5VZ9001`, `5VX1796` |
| 2 | `FndName` | `facilities.name` | Fund name; **umbrella facilities** bundle sub-funds with a `[U]` marker and comma-joined names — e.g. `CD&R X, VI, XII [U]`, `HIG LBO IV, BH III, GB&E III, IV [U]`, `Carlyle Buyout Umbrella` |
| 3 | `InvestorName` | `lp_records.investor_name` | |
| 4 | `Parent` | `parent` | |
| 5 | `SPV` | `spv` | `Y` / `N` |
| 6 | `InvestorType` | `investor_type` | 9 values: Other Institutional Investors, Sovereign Wealth Fund, Foundation, Insurance Company, Public Pension, Family Office, Corporate Pension, FOF & Other Asset Manager, Endowment |
| 7 | `Region` | `region_location` | Latin America, North America, Europe, Middle East, Asia Pacific |
| 8 | `HQ` | `high_quality` | `Yes` / `No` |
| 9 | `InstitutionalHNW` | `institutional_or_hnw` | Institutional (17,998) / HNW (2,002) |
| 10 | `InvestmentGrade` | `investment_grade` (`ig`) | `Yes` / `No` |
| 11 | `Classification` | `agent_lp_category` | 5 agent categories: Rated Included Investors, Non-Rated Included Investors, Included Investors, Fund-Of-Fund Designated Investors, Ineligible Investors |
| 12 | `Notes` | `notes` | Often blank |
| 13–15 | `SP` / `Moodys` / `Fitch` | `sp_rating` / `moodys_rating` / `fitch_rating` | Agency letter grades incl. `NR` (not rated) |
| 16 | `AUM` | `aum` | **Free-text strings, inconsistent units** — `$700Mn`, `$4.8 bn`, blank |
| 17 | `NAV` | `nav` | Same string variance as AUM |
| 18 | `PensionAssets` | `pension_assets` | e.g. `2T` |
| 19 | `FundingRatio` | `funding_ratio` | Decimal, e.g. `1.9` |
| 20 | `UBSAR` | `ubs_advance_rate` | **Decimal fraction** `0.41` = 41% — the same scale the column and the DTO use; only `config` carries whole-number `90` |
| 21 | `AgentAR` | `agent_advance_rate` | Decimal fraction |
| 22 | `Commitments` | `capital_commitment` | **Raw absolute dollars** `484000000` |
| 23 | `PercentOfCommitments` | `pct_of_fund_commitments` | Decimal fraction `0.09` |
| 24 | `Called` | `called_capital` | Raw absolute dollars |
| 25 | `Uncalled` | `uncalled_capital` | Raw absolute dollars |
| 26 | `PercentOfUncalled` | `pct_of_fund_uncalled` | Decimal fraction |
| 27 | `CalledPercent` | `pct_lp_called` | Decimal fraction |
| 28 | `AgentCL` | `agent_concentration_limit` | Concentration limit as decimal fraction `0.14` |
| 29 | `UBSCL` | `ubs_concentration_limit` | Concentration limit as decimal fraction |
| 30 | `AgentBB` | `agent_borrowing_base` (`abb`) | Raw absolute dollars |
| 31 | `UBSBB` | `ubs_borrowing_base` (`ubb`) | Raw absolute dollars |
| 32 | `BBDate` | snapshot / collateral as-of date | US-format string `M/D/YYYY`, varies per facility (e.g. `4/30/2026`, `11/26/2025`) |

**Conventions worth pinning down at ingest:**

- **Advance rates arrive as decimal fractions** here (`0.41`), matching the `NUMERIC(7,4)` columns
  and the DTO wire format; only `config` carries whole-number `90`. The **concentration limits**
  arrive as fractions too (`0.14`), which the stored percent-or-dollars encoding does *not* use —
  any importer must convert (`0.14` → `14`), and the known unit drift on
  `lp_master.ubs_default_concentration_limit` is exactly this conversion being missed.
- **`AUM` / `NAV` / `PensionAssets` are unnormalised free text** with mixed units
  (`$700Mn`, `$4.8 bn`, `2T`) — direct evidence for the extraction normalisation burden. All three
  stay `VARCHAR(50)` display fields on both `lp_master` and `lp_records`; they are never BB inputs,
  and the one numeric consumer (the LP-size report aggregate) parses on read.
- **Umbrella facilities** (`[U]`) confirm that one `AccountID` can span multiple sub-funds —
  relevant to the open multi-fund dedup question.
- **No `Committed` / `Uncommitted` column and no `Tranche` column exist in the export.** Any
  structural segmentation along those lines would be **net-new analyst-applied metadata**, not a
  field recoverable from this feed.

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

### `report_history`

One row per report generated from the Reports screen, written by `POST /api/reports/history` and read back by `GET /api/reports/history` (50 most recent, newest first).

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| report | varchar(100) | Report name, not null |
| facility_id | integer FK → facilities nullable | Soft link — `ON DELETE SET NULL`, so history survives a facility being removed |
| facility_name | varchar(255) nullable | Denormalised at write time for the same reason |
| snapshot_label | varchar(100) nullable | Which snapshot the report was run against |
| format | varchar(20) nullable | Export format |
| user_name | varchar(100) nullable | Actor at write time |
| created_at | timestamp | |

Descending index on `created_at` (`idx_report_history_created_at`) supports the default sort.

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
| matched_lp_id | integer FK → lp_records nullable | Best matching **facility LP record**, if any. Cleared whenever a facility's records are replaced |
| matched_lp_master_id | integer FK → lp_master nullable | *(V1_4)* The proposed **LP Master** record — a different thing from `matched_lp_id`. Routing needs the master id to survive a record replace, so it gets its own column; `ON DELETE SET NULL` keeps queue history when a curated LP Master row is removed. Mixing the two ids up is what makes `/confirm` return 409 |
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
| event | varchar(100) | Not null. Currently emitted: `Login`, `Upload`, `Abort`, `Submission Taken Over`, `Extraction Completed`, `Extraction Failed`, `Extraction Confirmed`, `Re-extraction`, `Re-extraction Failed`, `Field Mapping Change`, `LpRecord Reclassified`, `LP Data Updated`, `LP Record Deleted`, `LP Category Saved`, `LP Master Updated`, `LP Master Deleted`, `LP Master Cleared`, `BB Recalculated`, `Shadow BB Submitted`, `Shadow BB Accepted`, `Shadow BB Rejected`, `Config Change`, `Match Config Change` |
| detail | text nullable | Human-readable event detail; format varies by event type (see §5 Audit) |
| facility_id | integer FK → facilities nullable | Null for non-facility-scoped events (e.g. Login, Config Change) |
| user_id | integer FK → users nullable | Legacy; still not populated. Attribution is by `user_name`/`user_display` strings so an audit row never dangles or changes if a directory row is removed |
| user_name | varchar(100) nullable | Display name of the actor stored at write time; decoupled from users FK |
| ip | varchar(45) nullable | Client IP — resolved from `X-Forwarded-For` header if present, else `remoteAddr` |
| created_at | timestamp | Set by `@PrePersist`; not updatable |

A descending index on `created_at` (`idx_audit_log_created_at`) supports the default sort on `GET /api/audit`.

Writers:

- **BbController** — inserts `BB Recalculated` on every `POST /api/bb/run/:facilityId`
- **LpRecordController** — inserts `LP Reclassified` when `cls` changes on `PATCH /api/lpRecords/:id`; inserts `LP Data Updated` when `POST /api/lpRecords/ingest` updates at least one LP record
- **SubmissionController** — inserts `Upload` on every `POST /api/submissions`; `Abort` on `POST /:id/abort`; `Re-extraction` on `POST /:id/reextract`; `Extraction Confirmed` on `POST /:id/confirm`; `Field Mapping Change` on `POST /:id/remap` (when a new alias is created)
- **LpMasterController** — inserts `LP Master Updated` on `PUT /api/lp-master/:id`, `LP Master Deleted` on `DELETE /api/lp-master/:id`, and `LP Master Cleared` on `POST /api/lp-master/clear` (the ingest job's pre-step)
- **AuditController** — inserts `Login` on `POST /api/audit/login` (called by UI on app mount)
- **ConfigController** — inserts `Config Change` on `PUT /api/config/eligibility`; inserts `Match Config Change` on `PUT /api/config/matching`; detail names the specific section in both cases
- **FieldMappingController** — inserts `Field Mapping Change` on alias mutations

All writers record `user_name` from the **authenticated principal** (Spring Security context — the dev-mode fixed identity or the gateway-supplied `X-Auth-User`) and resolve IP via `X-Forwarded-For` → `remoteAddr`. The forwarded-for value is only trusted in gateway mode (where the reverse proxy sets it); direct client-supplied values cannot spoof it.

**Event detail formats by type:**

| Event | Detail format |
|-------|---------------|
| BB Recalculated | `N LPs · UBS BB $X.XM` |
| LP Reclassified | `LP Name → NewCls (was OldCls)` |
| LP Data Updated | `N LP records updated from <TEMPLATE_FORMAT> extraction` |
| Upload | `periodMonth · fileName · agentBank` |
| Login | `User login` |
| LP Master Updated | `'LP Name' updated — routes to <Ultimate Parent>` (the routing clause is omitted when the record is its own ultimate entity) |
| LP Master Deleted | `'LP Name' removed from LP Master (N facility LP record(s) detached)` |
| LP Master Cleared | `N LP Master row(s) removed ahead of repopulate (M facility LP record(s) detached)` |
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

**Seeded rows:** `busa_tiers`, `agent_tiers`, `agent_rate_params`, `elig_rules`, `conc_limits`, `cls_conc_limit_defaults`, `cls_conc_limit_bounds`, `global_settings`, `matching_config`, `classification_config`. Config is cached in-memory and hot-reloadable via `POST /api/config/reload`.

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

Base path: `/api`. Full OpenAPI 3.0 specification: `pe-sub-docs/openapi.yaml` v0.8.0 (includes security schemes).  
API test collection: `pe-sub-docs/pe-sub-platform.postman_collection.json` (Postman v2.1; imports into Talend API Tester; carries `X-Auth-User` / `X-Auth-Roles` headers on all protected requests).

**Status legend:** ✅ implemented · 🔲 planned

### Security model (implemented)

#### July 12, 2026 implementation update

The application now exposes `GET /api/users/me` so the UI can render the authenticated external identity and effective roles without maintaining a local user directory. The Spring role set is `ANALYST`, `MANAGER`, `VIEWER`, and `SERVICE`. `VIEWER` is read-only across `/api`: `GET` requests and approved downloads/exports are available, while every mutating HTTP method is denied server-side. The UI mirrors this policy by removing or disabling operational controls and displaying the signed-in identity and role.

Workflow records now retain external owner identity and audit events use the authenticated actor. Ownership is a domain control layered on top of role authorization: Analysts operate their own submissions, Managers can perform controlled cross-owner actions, and Viewers cannot mutate workflow state. No entitlement assignments are stored locally.

LP Master and facility-LP deletion paths now use explicit API operations with referential and audit safeguards. Deletion is destructive and therefore unavailable to Viewers; the UI requires deliberate confirmation and refreshes affected lists after completion. Historical audit evidence is retained even when the referenced business row is removed.

Percentage presentation has been standardized in the UI through shared formatting utilities. Advance rates are rounded to one decimal place at extraction/ingest boundaries and rendered consistently as percentages; exact monetary amounts continue to drive the Shadow BB calculation. The Shadow BB rate summary now buckets Agent rates only, avoiding a misleading mixture of Agent and UBS rate populations.

Stateless header/token security (`SecurityConfig` + `GatewayAuthenticationFilter`), controlled by `app.security.mode` (`APP_SECURITY_MODE` env var):

| Mode | Identity source | Use |
|------|-----------------|-----|
| `dev` (default) | Fixed identity `js25029` with role `ANALYST` (`app.security.dev-user` / `APP_SECURITY_DEV_USER`). A uuName rather than an email, so a local run produces a `users` directory row shaped like a real one | Local development — header-less UI works unchanged |
| `gateway` | `X-Auth-User` / `X-Auth-First-Name` / `X-Auth-Last-Name` / `X-Auth-Email` / `X-Auth-Roles` headers injected by the SSO reverse proxy (Entra ID at the gateway) | Deployed environments — enabling enforcement is one config flag |

Roles: `ANALYST` (operator + configurator), `MANAGER` (Account/Transaction Manager — review authority), `SERVICE` (service-to-service). Authorization rules:

| Surface | Rule |
|---------|------|
| `OPTIONS *`, `/api/ping`, `/health`, `/actuator/health`, `/api/notifications/**` (SSE — EventSource cannot send headers) | Public |
| `POST /api/lpRecords/ingest` | `SERVICE` only (pe-sub-extraction → pe-sub-api) |
| `PUT /api/config/**`; `POST/PUT/PATCH/DELETE /api/field-mapping/**`; `/api/bb-templates/**` | `ANALYST` only (RBAC matrix: MANAGER does not configure) |
| Everything else under `/api/**` | Any authenticated operator (`ANALYST` or `MANAGER`) |

Sessions and CSRF are disabled (stateless); unauthenticated requests receive `401`, role failures `403`. The 4-eye separation on submission completion remains a Phase-2 workflow control.

### Facilities

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/facilities` | ✅ | List all facilities ordered by name |
| GET | `/api/facilities/:id` | ✅ | Single facility |
| POST | `/api/facilities` | ✅ | Create facility; body: `{ name, agentBank }` |
| PATCH | `/api/facilities/:id/status` | ✅ | Update facility status |

### LP Master

The bank-wide LP profile store. `POST` routes are `SERVICE`-gated (the pe-sub-jobs feed, never a
human surface); `PUT` and `DELETE` are `ANALYST`-gated as curation surfaces.

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/lp-master` | ✅ | List all records, each with its resolved hierarchy — ultimate parent and direct-child count — so the screen can show what an Accept would apply without a per-row lookup |
| GET | `/api/lp-master/:id` | ✅ | Single record with its resolved hierarchy; 404 when unknown |
| GET | `/api/lp-master/:id/children` | ✅ | Direct children — the feeders/SPVs routing their profile to this record; 404 when unknown |
| GET | `/api/lp-master/:id/aliases` | ✅ | Agent BB strings previously accepted against this record (`lp_aliases`); 404 when unknown |
| GET | `/api/lp-master/count` | ✅ | `{ count }` — row total |
| GET | `/api/lp-master/investor-types` | ✅ | Distinct non-blank investor types, case-insensitively sorted; feeds the UI option list |
| PUT | `/api/lp-master/:id` | ✅ | Replace the editable subset. PUT rather than PATCH because the panel submits every field it renders, so an omitted value means *cleared* and there is no sparse-merge ambiguity. Parent linkage is re-resolved here. Returns the saved record with its re-resolved hierarchy; 404 when unknown |
| DELETE | `/api/lp-master/:id` | ✅ | Hard-delete — the correction path for LPs erroneously ingested past analyst checks. Facility LP records referencing the row are **detached, not deleted**. 204; 404 when unknown |
| POST | `/api/lp-master/ingest` | ✅ | Bulk upsert from the pe-sub-jobs feed, keyed by investor name. The feed is authoritative for the whole profile — every field is overwritten, including with nulls. Blank-name rows are skipped. Returns an `IngestSummary` (`created` / `updated` / `skipped`) |
| POST | `/api/lp-master/clear` | ✅ | Wipe the table ahead of a full repopulate (*override, do not preserve*). The ingest job's pre-step. Facility LP records are detached, not deleted. Idempotent |

### LPs

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/lpRecords` | ✅ | List LPs — query params: `facilityId`, `cls`, `search` |
| GET | `/api/lpRecords/:id` | ✅ | Single LP record |
| PATCH | `/api/lpRecords/:id` | ✅ | Update LP fields: `cls`, `clsTag`, `abb`, `inc`, `rcl`, `notes` |
| POST | `/api/lpRecords/ingest` | ✅ | Receive extraction payload from `pe-sub-extraction`; run fuzzy name matching; write financial fields or queue for credit officer review (see below) |

#### `POST /api/lpRecords/ingest` — actions

`LpIngestService` builds a `Prepared` index over the facility's LP names once (`prepare`), then for each extracted LP row runs `matchBest` against it (exact-match fast path + length-band pruning; see §5 Matching and Decision 46):

| Action | Condition | Effect |
|--------|-----------|--------|
| **Updated** | Score ≥ auto-accept threshold AND `!requiresReview` AND all fields ≥ 70% confidence | Writes `aum`, `capCommit`, `uc`, `agentRate`, `agentConcLimit` on the matched LP |
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
| GET | `/api/reports/collateral/:facilityId` | ✅ | Collateral & Coverage — BB certificate payload from a snapshot; `?snapshotId=` targets a specific snapshot (default latest) |
| GET | `/api/reports/concentration/:facilityId` | ✅ | Latest breach list (Concentration Exposures) |
| GET | `/api/reports/ear/:facilityId` | ✅ | Effective Advance Rate history across all snapshots |
| GET | `/api/reports/agent-banks` | ✅ | UBS exposure aggregated by agent bank from each facility's latest snapshot |
| GET | `/api/reports/history` | ✅ | Report generation history (50 most recent, newest first) |
| POST | `/api/reports/history` | ✅ | Record a generated report (`report_history` row) |

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
| `forward` | no | Forward result to `pe-sub-api/lpRecords/ingest` (default `true`; `pe-sub-api` always passes `false`) |
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
| Effective Advance Rates | `ear` | `/api/reports/ear/:id` | ✅ |
| Agent Bank Exposure | `agent-bank` | `/api/reports/agent-banks` | ✅ |
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
| 20 | Audit logging in `LpRecordController`, not `LpIngestService` | `HttpServletRequest` (needed for IP extraction) is available in the controller layer. Services should not depend on request context |
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
| 31 | Agent LP Classification section rows handled in extraction, configured via `bb_template_groups` | Agent templates frequently group LPs into classification sections using header rows (e.g. "Designated PWM") rather than a per-row column, interleaving sub/total rows. `ClassificationRowDetector` (pe-sub-extraction) recognises these via the standard values plus a per-agent `classificationConfig` JSON (`header_text → classification`) built by `ClassificationConfigBuilder` from `bb_template_groups`, fills the value down onto LPs beneath the header, and lets a populated per-row column override the inherited value. `bb_template_groups.header_text` stores the agent document's literal grouping text; `classification` stores the resolved canonical value. Onboarding a new template variant is configuration (sheet/header/skip-keywords/aliases/sections), not code |

---

## 8. Agent Bank Portfolio

### 8.1 Live Facility Registry

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

### 8.2 UBS Internal Account Numbers

Every facility row in the Agent Bank Summary carries a UBS loan reference in the format `5Vxxxxx` (e.g., `5VX1796`). This is the operational identifier used by UBS Credit for loan administration and must be stored in the `facilities` table as a first-class field. It is distinct from the agent bank's internal deal number.

### 8.3 Structural Patterns in the Portfolio

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
