# PE Subscription Borrowing Base — Platform Process Flow

This document describes the borrowing base process **as implemented in the PE Sub platform**:
`pe-sub-ui` (React/TypeScript SPA), `pe-sub-api` (Spring Boot REST API and calculation engine),
`pe-sub-extraction` (Agent BB workbook parsing) and `pe-sub-jobs` (CSV seed ingestion).
It is updated continuously as features are added.
For the confirmed as-is manual process this replaces, see `BB_PROCESS_FLOW.md`.

---

## Actors and roles

Identity arrives from the UBS SSO proxy as `X-Auth-*` headers and is fixed for the session — there
is no in-app user or role switcher. Capability roles mirror `RBAC_ROLES.md`:

| Role | In this flow |
|---|---|
| **Analyst** (`APP_ANALYST`) | Runs the wizard end to end, curates LP Master, edits configuration. The **maker**. |
| **Account/Transaction Manager** (`APP_MANAGER`) | Independent review authority — the only role that may accept or reject a Shadow BB. The **checker**. |
| **Viewer** (`APP_VIEWER`) | Read-only across every screen; all mutating verbs return `403`. |
| **Service** (`SERVICE`) | `pe-sub-jobs` only — bulk seed ingest endpoints, never reachable by a person. |

**Ownership.** Upload stamps the submission with the uploader's uuName. Only the owner or a Manager
may edit an in-flight submission; another analyst must explicitly **take over** (`POST
/api/submissions/{id}/take-over`), after which the previous owner becomes read-only and is notified.
Every write carries an optimistic-concurrency version, so a stale second tab is rejected with `409`
rather than silently overwriting newer work.

---

## Wizard Flow (Steps 1–5)

Wizard step labels come from configuration (`ui_config.WIZARD_STEPS`), and the submission's
`wizard_step` column mirrors them 1-indexed, so a part-finished submission reopens where it was left.

### Step 1 — Select Facility

**Screen:** Dashboard → Upload  ·  **Actor:** Analyst

The Analyst picks the target facility. The Dashboard's Agent Bank Summary table drives entry, and
the call to action is facility-status-aware: **Start Submission** (Not Started), **View Submission**
(In Progress / Needs Review — routing straight to the step the submission stopped at), **Review
Shadow BB** (Pending Review, Managers only; everyone else sees "Awaiting approval") or **View Shadow
BB** (Active). Facilities themselves are seeded from the Agent Bank Summary CSV by `pe-sub-jobs`
(`POST /api/facilities/ingest`, upsert by name) and edited in the Facility Edit overlay.

---

### Step 2 — Upload Agent BB

**Screen:** Upload  ·  **Actor:** Analyst

The Analyst supplies facility, agent bank, period and the Agent BB file (drag-and-drop or file
picker), plus optional notes. The file is stored and forwarded to `pe-sub-extraction`, which parses
XLSX / XLS / CSV with Apache POI / Commons CSV. Extraction runs inline, so a submission moves
straight from `Processing` to step 3 (`Review`); a parse failure leaves it at step 1 with status
`Error`. The original workbook is retained and downloadable.

---

### Step 3 — Review Extraction

**Screen:** ExtractionPreview  ·  **Actor:** Analyst

**3a — Document Recognition**
Identifies the workbook format, agent bank and extraction confidence. Recognition scores a candidate
against the **BB Template Registry** (filename, title, detect keys, named tabs, agent bank); below
the minimum score the engine falls back to auto-detecting sheet and header row. The Analyst can
**override the recognised format** and **Re-extract** against a different registered template.

**3b — Canonical Field Mapping**
Maps extracted column headers to canonical LP Master fields using the alias groups of the Field
Mapping Dictionary. Header scoring is exact-alias `1.00`, ≥80% word overlap `0.75`, ≥70% `0.60`;
anything scoring zero lands in **unmatched columns**. Unmatched columns must be mapped or discarded
before the step can be confirmed, and a manual mapping is written back to the dictionary for future
submissions.

The engine also **derives** canonical fields the workbook has no column for, but only from other
mapped fields on the same row — currently just **Called Capital** (`Commitment − Uncalled`) — shown
with a `Derived: ` source marker so it reads as a cross-check, not an agent figure. Derived values
never overwrite an agent-reported column. Percentage fields that would need a facility-wide total
(% of Capital Commitments, Concentration (%), Excess Concentration, Excess Concentration (%)) are
deliberately **not** computed and are left blank for the Analyst; the borrowing-base engine derives
its own concentration figures from the full facility LP set (see `EXTRACTION_CONTRACT.md`).

**3c — Extracted LP Data**
LP-level table of extracted values: investor name, Agent LP Classification, commitment, uncalled
capital, AUM, S&P / Moody's, advance rate, BB contribution, % of BB and concentration limit.
Clicking a row opens a detail panel with the full field set (NAV, Fitch, Transferee, Parent /
Sponsor) and each field's canonical mapping. Where the workbook carries a **Borrowing Base** column
but no **% of Borrowing Base** column, the percentage is calculated per LP as `BB ÷ total BB`; those
cells are flagged with a **Calc** badge and a notice reports how many were calculated. Individual
rows can be **discarded**, and the whole submission can be **aborted**.

Agent LP Classification is lifted either from a per-row column or from **group-header section rows**
— a section header fills its classification down onto every following LP row until the next header.
Rows are filtered before they reach the LP set: blank investor names, summary/total rows, and null
markers (`N/A`, `N/R`, `NA`, `NR`) are all skipped. Investor Type is auto-derived from the investor
name at ingestion where LP Master has none.

**Confirm & Run LP Matching** advances the submission to step 4.

---

### Step 4 — Review LP Matches

**Screen:** MatchQueue  ·  **Actor:** Analyst

Extracted LPs are matched against LP Master using a weighted Jaro-Winkler + Levenshtein score, after
legal-entity suffix stripping and abbreviation expansion. Bands come from the Match Thresholds
configuration (seeded defaults shown):

- **Auto-accept (≥ 95%)** — pre-accepted without Analyst review
- **Review (80–94%)** — Analyst must Accept or Reject each proposed match
- **No Match (< 80%)** — no LP Master record found; the Analyst can search and override manually

**Accept** links the Agent BB row to the existing LP Master record. **Reject** means a new LP Master
record is created for that LP on commit. A confidence filter narrows the grid to Review or No Match
so auto-accepted rows stay out of the way. The right-hand Match Analysis panel shows the algorithm
decision, score and field-level comparison between the agent name and the LP Master name.

**Parent routing.** The grid's **Ultimate Parent (To Be Applied)** column shows whose credit profile
an Accept would actually apply: a matched feeder or SPV routes up to its sponsor, so ratings, LP
category and default rates come from that entity rather than the row matched. It reads **Self** when
the match is already the ultimate entity and `—` when there is no match. Server-side the rule is
**child-first, ancestors fill gaps** — the matched record's own values always win and the sponsor
supplies only what the feeder leaves blank. Two exceptions: **SPV** is read from the matched record
only, and the boolean credit flags (`investment_grade`, `high_quality`) are true if the matched
record *or* any ancestor asserts them. `lp_records.lp_master_id` always points at the matched child,
so the audit trail keeps naming the entity the agent listed.

**Commit Decisions** persists the accepted rows into the facility's LP records — creating new or
updating matched — deduped on `(facility, investor name)` and carrying each row's source position
(`source_seq`) so downstream screens preserve Agent BB file order. Accepting a match also records
the uploaded spelling as a **known alias**, so the next upload of that exact string resolves in O(1)
at score 100 without fuzzy scoring (still running the same parent routing).

---

### Step 5 — LP Category & Rate Assignment

**Screen:** RunShadowBB  ·  **Actor:** Analyst

This step covers Steps 3a–3d of the as-is manual process (`BB_PROCESS_FLOW.md`). It edits the
**persisted** LP records created at commit, not the match queue.

**5a — Submission Summary**
Read-only summary: facility, as-of date, agent bank, total LP count, accepted matches and new LP
records created.

**5b — LP Category & Rate Assignment**
A dense, sortable, resizable review table covering the full LP profile — identity and hierarchy
(Investor Name, Parent, SPV), Region / Location, Investor Type, Institutional vs HNW, Agent and UBS
LP Classification, Eligible, Investment Grade, S&P / Moody's / Fitch, LP Size and Size Measure, the
commitment and uncalled columns, both advance rates, both concentration limits, both excess
concentration figures, both borrowing bases with their % shares, and Notes. The decision columns:

- **UBS LP Classification** — editable dropdown over the 9 UBS classes (Rated Investor /
  Corp Pension > $5Bn Assets / Corp Pension > $1Bn Assets / Unrated NAV > $1Bn /
  FoF & Other > $10Bn AUM / Other Institutional / HNW Feeder (acceptable) / HNW (acceptable) /
  Excluded). Auto-populated where the record has none — derived from Agent LP Category, investor
  profile and agent rate — then **upgraded from LP Master data** where that strictly improves the
  BUSA rate (investment-grade rating → `Rated`; AUM thresholds → the unrated tiers). `Excluded` is
  never overridden. An upgrade also resets the LP's UBS Advance Rate to its tier default. An amber
  notice reports how many classifications were derived or upgraded.
- **% of LP Called** — the LP's Called ÷ Committed ratio (read-only). Drives the advance rate via
  the funded split below.
- **UBS (BUSA) Advance Rate** — the suggested default resolves from the **Borrowing Base Criteria
  Matrix** (`bb_criteria_matrix`), not a flat per-class schedule. It is a function of
  **(classification, % funded)** with a single break at **40% funded**, and — for Rated Investor — of
  the LP's agency **rating band** (AAA/AA/A/BBB, resolved via the tri-party S&P/Moody's/Fitch middle-
  rating waterfall). The ≥40%-funded ("mature") defaults are Rated 90% / Corp Pension > $5Bn 90% /
  Corp Pension > $1Bn 90% / Unrated NAV > $1Bn 90% / FoF & Other 75% / Other Institutional 65% /
  HNW Feeder 65% / HNW 50% / Excluded 0%; several classes step **down** below 40% funded (Rated BBB
  65%, FoF 65%, Other Inst / HNW Feeder 50%, HNW 0%). It updates live when classification, % funded
  or ratings change, and an Analyst override wins over the matrix default.
- **Agent Advance Rate** — the rate the agent assigned to this LP, from the Agent BB (read-only,
  for comparison).
- **UBS Concentration Limit** — per-LP limit as a **percent of total uncalled capital**. The
  suggested default comes from the same matrix — rating-band-specific for Rated Investor
  (AAA 25% / AA 20% / A 15% / BBB 10%) and one value per non-rated class (Corp Pension > $5Bn 25% /
  Corp Pension > $1Bn 20% / Unrated NAV 15% / FoF 10% / Other Inst 5% / HNW Feeder 5% / HNW 1% /
  Excluded 0%); it is funded-independent. The Analyst can adjust per LP. *(The legacy
  `cls_conc_limit_defaults` / `cls_conc_limit_bounds` config keys no longer feed the BB engine —
  the matrix supersedes them — but still seed and range-check the LP Master record entry form.)*
- **Eligible** — live preview of whether the LP will be included in the UBS BB under the current
  classification.

Changed rows are highlighted; an override count is shown in the action bar. **Save** writes the
category and rate edits back through `PATCH /api/lpRecords/classification`. An erroneous row can be
deleted here, which detaches its match-queue entries and recomputes the facility's ranks.

**5c — Run Shadow BB**
**Run Shadow BB** (`POST /api/bb/run/{facilityId}`) is **server-authoritative**: the payload carries
LP *inputs* only, and the engine (`BbCalculationService`) computes every output, persists a snapshot
in `bb_snapshots`, and writes `ubb` / `ubs_excess_conc` / `agent_excess_conc` and ranks back onto the
LP records in the same transaction. `agent_bb` is never touched by a run. **Rank** is competition
ranking over *every* LP record in the facility — Excluded LPs included — by uncalled capital
descending, name as tie-break.

**5d — Calculation Results**
Summary KPIs after the run: UBS Borrowing Base, Agent Borrowing Base, BB Delta, Effective Advance
Rate (UBS and Agent), EAR Delta, Included / Excluded / Reclassified LP counts, UBS Eligible Uncalled
and total Concentration Excess.

**5e — Concentration Breach & Warning Alerts**
Four concentration rules are evaluated server-side on every run and the verdict is persisted with
the snapshot. The thresholds are **not fixed**: the engine reads them from the **Concentration
Limits** card on the Configuration screen (config key `conc_limits`, matched by row label). Seeded
defaults:

| Rule | Config row | Default threshold | Status |
|---|---|---|---|
| Single LP Concentration | Single LP max | > 15% of Total UBS BB | Breach |
| Top-10 LP Concentration | Top-10 LP max | > 60% of Total UBS BB | Breach |
| Top-10 LP Concentration | 10 pp below the Top-10 limit | 50–60% of Total UBS BB | Warning |
| Unrated Aggregate Concentration | Unrated max (aggregate) | > 50% of Total UBS BB | Breach |
| Non-US LP Concentration | Non-US LP max | > 30% of Total UBS BB | Breach |

A missing config row (or key) falls back to its seeded default, so detection never silently switches
off. A fifth row — **Pension fund max** (basis: total eligible uncalled) — exists in `conc_limits`
but has no engine rule yet and is display-only.

Breaches render in a red alert box under Calculation Results ("must resolve before submitting BB
certificate to agent"); warnings render in amber ("approaching limit, monitor closely"). While
breaches exist the secondary action relabels to **Review Breaches in BB Results**.

---

## Step 6 — Independent Review (maker–checker)

**Screen:** RunShadowBB (submit) → ShadowBB (review)  ·  **Actors:** Analyst → Manager

A completed Shadow BB does **not** activate the facility by itself.

- **Submit for Review** (`POST /api/submissions/{id}/complete`) — the Analyst hands the run to
  independent review. Submission → `Pending Review` (wizard step 6), facility → `Pending Review`,
  and the maker's uuName is recorded in `submitted_by`. Any prior rejection note and checker are
  cleared so the item is not shown as "Changes Requested" while awaiting a fresh review.
- **Approve** (`POST /api/submissions/{id}/accept`, **Manager only**) — submission → `Processed`,
  facility → `Active` with `lastRunAt` stamped, and the finalised UBS classification / rate /
  concentration decisions are **written back to LP Master** so later submissions for any facility
  inherit this cycle's credit profile. The live reclassification flags are cleared (the approved
  snapshot keeps `rcl=true` as historical evidence). A notification is broadcast to the maker.
- **Reject** (`POST /api/submissions/{id}/reject`, **Manager only**) — a `reason` is required. The
  submission returns to step 5 as actionable, the facility is left unchanged, and the reason is
  broadcast to the maker as "Changes requested".

A Manager may review their own submission, so a facility is never locked when no second reviewer is
available. Maker and checker are stored as stable uuName identities, never as foreign keys into the
user directory, so attribution survives a directory row being removed.

A re-run started from the Shadow BB Results screen (`POST
/api/submissions/facilities/{facilityId}/rerun-for-review`) calculates and creates the review item
atomically — seeded facilities have no upload-backed submission, so this is how every successful
re-run still reaches a Manager.

**Reclassification.** `lp_records.reclassified` means "this facility's Shadow BB is stale because an
LP's Agent/UBS LP category moved after the run"; it drives the **R** badge, the re-run banner and the
reclassified reports. `ReclassificationPolicy` only lets a category change set it once the current
submission has produced a snapshot — throughout the wizard the Analyst is assigning categories for
the first time, so nothing is marked. The flag is sticky across runs and is cleared only on Manager
acceptance.

---

## Step 7 — Shadow BB Results

**Screen:** ShadowBB  ·  **Actors:** Analyst (review), Manager (approve/reject)

The full LP-level Shadow BB grid — Rank, identity and hierarchy, region, investor type,
Institutional vs HNW, Agent and UBS LP Classification, Eligible, Investment Grade, the three agency
ratings, LP Size and Size Measure, Capital Commitments and % of Capital Commitments, Called and
Uncalled Capital, % of Uncalled Capital, % of LP Called, both advance rates, both concentration
limits, both excess concentration figures, Agent and UBS Borrowing Base with their % shares, and
Notes. Above it sits the five-table summary panel (LP Portfolio, Borrowing Base, BUSA, Agent, LP
Classification) from `GET /api/bb/summary-ext/{facilityId}`. Clicking a row opens a detail modal with
Identity, Ratings, LP Capital and UBS BB Calculation sections.

The screen is **server-rendered**: every BB figure — per-row Agent/UBS BB, excess concentrations,
%-of-BB shares, footer totals, the summary tables and the breach verdict — comes from the persisted
snapshot, frozen at the last run. The UI computes nothing authoritative; `calcRow` and
`computeLPRecord` survive only as instant previews of *unsaved* edits, and an "Unsaved changes"
banner explains that totals, summary and breaches stay frozen until **Re-run Shadow BB**.

The concentration breach tables appear above the LP grid when the latest snapshot carries breaches:
collapsible red (breach) and amber (warning) panels listing Rule, Detail, Current and Limit, sourced
from the verdict persisted with the snapshot. They hide while local overrides are active, since the
stored verdict no longer matches the recomputed preview below.

**Controls:**
- Facility and snapshot selectors
- **Re-run Shadow BB** — recomputes, persists a new snapshot, and submits it for Manager review
- Stale-run banner when the facility has changed since the last run (reclassification)
- Classification filter, column sort and resize, pagination
- **Approve / Reject…** while the submission is `Pending Review` — rendered for Managers only;
  every other role sees a read-only "awaiting review" status
- **↓ Export** — a single-sheet XLSX (`exceljs`) laid out like the screen: the four summary tables
  side by side across the top in their on-screen colours, then the LP grid with every visible column
  in screen order, for the rows currently sorted and filtered. Money is written in full dollars and
  percentages as fractions with Excel number formats, so the sheet stays sortable and summable.

---

## Supporting Screens (outside the wizard)

### LP Master

The facility-scoped view of LP **records** — the per-facility outcomes carrying commitments,
uncalled capital and borrowing base. Pick a facility, or **View All N LPs** for every facility's
records. The facility picker is itself a table carrying the Agent Bank Summary columns plus **Last BB
Run**. A row click drills into that facility's LP records; the pencil column (editors only) opens the
**Facility Edit** overlay, where all facility fields are editable (Borrower, Agent Bank, Account
Number, Loan Amount, Maturity Date, Collateral Date, facility size, UBS participation) and a facility
holding **no LP records** can be deactivated or deleted. Both are blocked with `409` while LP records
exist — committed LP data is never silently destroyed.

Row click opens the LP record panel with the 9 field groups (Identity, Classification, Location,
Investor Profile, Ratings, Financial Scale, Commitment Data, Uncalled Data, Borrowing Base) and the
delete action for an erroneous row. **Rank** is displayed only when a single facility is selected —
it is facility-specific, so the All Facilities view omits it.

### LP Master Records

The bank-wide curated LP store those facility records are seeded from — a sibling screen, not a mode
of LP Master. Columns cover the subset that applies ratings and classifications to a matched row:
Investor Name, Parent, Children, SPV, Region, Investor Type, Institutional vs HNW, UBS LP
Classification, Investment Grade, S&P / Moody's / Fitch, LP Size + Size Measure, Funded Ratio, UBS
Default Advance Rate, UBS Default Concentration Limit, Notes. A **Hierarchy** filter narrows to
ultimate entities, feeders & SPVs, or sponsors with children.

`lp_master` is self-referencing: `parent_id` resolves the sponsor row and `is_ultimate_parent`
mirrors `parent_id IS NULL`. The `parent` **string** is retained as the display and ingest field, and
both halves are written together so they cannot drift — renaming a sponsor repoints its children,
and creating a sponsor adopts rows that already named it. A `parent` naming a row not in LP Master
stays unresolved and is flagged **⚠ Unlinked sponsor**, because nothing is inherited from it. The
panel's Hierarchy section offers a sponsor picker (excluding the record itself and every descendant —
the API rejects cycles with `400`), the resolved ultimate parent, the list of feeders routing here,
and the read-only list of known aliases. Rows are seeded from the LP Master CSV by `pe-sub-jobs`
(`POST /api/lp-master/ingest`, upsert by investor name, with a batch-wide parent relink once the feed
has landed) and curated by Analysts (`PUT /api/lp-master/{id}`).

### Field Mapping Dictionary

Admin-managed dictionary mapping extracted column headers to canonical LP Master fields, organised by
group (Identity, Commitment Data, Uncalled Data, Financial Scale, Borrowing Base, Ratings,
Classification). Three alias tiers: Core (read-only), Bank (agent-bank-specific) and User
(Analyst-added), plus a qualifier blocklist. Pending suggestions raised during extraction are shown
for review. This dictionary is what the extraction engine's `aliasConfig` is built from.

### BB Template Registry

One row per Agent BB workbook format registered for extraction (`bb_templates` →
`bb_template_tabs` → `bb_template_groups`). A template declares which tabs to read, the header row
index and how many physical rows a stacked header occupies, and the Agent LP Classification group
sections used to fill classification down onto section rows. Templates can be created by hand or
imported from a structured XLSX, which persists both the parsed definition and the original workbook
(downloadable from `GET /api/bb-templates/{id}/download`). Create / update / delete / import are
Analyst-gated.

### Match Thresholds

Configuration for the name-matching algorithm: confidence thresholds (auto-accept ≥ 95, manual review
80–94, no match < 80), the Jaro-Winkler / Levenshtein weighting, legal-entity suffix stripping rules,
the abbreviation expansion dictionary, and a **Match Test Tool** that previews how a given name would
score against LP Master.

### Configuration

Four cards, persisted in the `config` table and edited by Analysts:

- **Borrowing Base Criteria Matrix** (`bb_criteria_matrix`) — the primary editor for UBS advance
  rates and per-LP concentration limits across rating bands × funded split × classification, and the
  source of the Step 5 defaults. It replaced the former flat "BUSA Advance Rate Schedule" and "Per-LP
  Concentration Limit Defaults" cards.
- **Concentration Limits** (`conc_limits`) — portfolio-level thresholds; directly drives breach
  detection on every Shadow BB run (see 5e).
- **Agent Advance Rate Schedule** — agent reference rates used for the BB delta.
- **Global Settings** — platform-wide defaults applied to all facilities, including snapshot
  frequency.

No tuning value is hardcoded: service-level configuration lives in `application.yml` with env-var
overrides, and business configuration lives in the `config` table.

### Audit Trail

Append-only log of platform events — ingestion, extraction, matching, calculation, submission
lifecycle (submitted / accepted / rejected / taken over / aborted), LP and facility deletions and
exports. Each row carries timestamp, event, detail, facility, the authenticated principal and source
IP; filterable by event, user and free text, and refreshed on a 10-second poll. Audit rows survive
facility deletion with their `facility_id` nulled.

### Reports

Six tabs, all reading persisted data via `/api/reports/*` — nothing is recomputed at report time:

- **Collateral & Coverage** — BB certificate built from the selected facility's snapshot (latest, or
  an earlier one via the snapshot selector): summary figures plus per-LP-category breakdown, with
  watermark and detail options, XLSX export and a styled PDF download
- **Effective Advance Rates** — EAR trend, one point per persisted snapshot
- **Agent Bank Exposure** — UBS vs Agent BB aggregated by agent bank across every facility's latest
  snapshot
- **Concentration Exposures** — the breach verdict persisted with each facility's latest snapshot
  (see 5e), filterable by concentration test
- **Ad Hoc Reporting** — LP-level query by facility / LP category / sort, exportable to XLSX
- **Scheduled Reports** — system-managed batch jobs listed from `report_config` (display-only)

Every generation is recorded in report history (`POST /api/reports/history`; the 50 most recent
entries are listed), with the facility name denormalised so entries survive facility deletion.

### Notifications

The TopBar carries a notifications panel fed by a server-sent event stream plus a review-item poll.
Managers see submissions awaiting review; makers are told when a run is approved, when changes are
requested and why, and when a submission is taken over from them. Reclassification notices flag
facilities whose Shadow BB has gone stale.

---

## Key Differences from the As-Is Manual Process

| As-Is (BB_PROCESS_FLOW.md) | Platform |
|---|---|
| Agent BB downloaded manually from deal sites | Analyst downloads from the deal site (SyndTrak, Intralinks, Debt Domain) and uploads to the platform; the workbook is parsed by `pe-sub-extraction` against a registered template and the original is retained |
| LP classified manually in Excel, one by one | LP Category & Rate Assignment table (Step 5b) — categories derived from the agent file and upgraded from LP Master, then reviewed and overridden before the run |
| BUSA rate entered manually per LP | Suggested from the Borrowing Base Criteria Matrix by (classification, % funded) and — for Rated Investor — agency rating band; updates live; Analyst can override per LP |
| Concentration limits entered manually per LP | Per-LP limit editable in Step 5b as a percent of total uncalled capital; default from the same matrix (rating-band-specific for Rated Investor), funded-independent |
| BB calculated in Excel | Server-side calculation engine (`BbCalculationService`) runs on demand and persists every run as a snapshot; the UI computes nothing authoritative |
| Results in shared-folder Excel files | Persisted BB snapshots (PostgreSQL) rendered on the Shadow BB Results screen; exportable to XLSX and PDF |
| No breach detection | Four concentration rules evaluated on every run against the configurable Concentration Limits; breach/warning alerts at run time, on the results screen and in the Concentration Exposures report |
| LP name matching done manually | Automated Jaro-Winkler + Levenshtein matching with confidence bands; the Analyst reviews only borderline cases, and accepted spellings become aliases that match exactly next time |
| No LP Master system of record | Bank-wide LP Master in PostgreSQL with parent/child hierarchy, alias history and child-first profile resolution, seeded by `pe-sub-jobs` and curated in the UI |
| No hierarchy view — feeders treated as standalone LPs | Feeders and SPVs route to their sponsor, so ratings and credit profile are inherited without overwriting what the feeder itself carries; shown before an Accept is committed |
| Approval by email / offline sign-off | Enforced maker–checker: only a Manager may accept or reject, rejection requires a written reason, and both identities are recorded against the run |
| No audit trail | Append-only audit log with 7-year retention, recording the authenticated principal and source IP for every event |
