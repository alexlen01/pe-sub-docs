# LP DB Export → Seed Extract — Solution Design

**Status:** Draft for review · **Author:** Solution Architect · **Date:** 2026-07-16
**Source artifact:** `pe-sub-docs/Seed LP DB Export 2026.06.25.xlsx` (sheet `_BBs20260625`, 32 cols, 20,000 rows)

Turns the periodic **LP DB Export** (XLSX) into the platform's seed data. **Day 1 is a one-off
(possibly twice) generation** driven by a **Python script** — no new Java service, no batch job.
The script regenerates three CSVs consumed by the *existing* ingest/seed jobs.

> **The current export is a synthetic simulation.** It has data-quality defects that a **real** LP
> DB will not have (see §3.1). The design keeps the *transform rules* clean and does the best it can
> with the defects — **every record is inserted (no rejects)**; whatever needs an analyst's eye is
> normalized where possible and dumped to a review report. The same script works unchanged on a clean
> real export (the reports then come back empty).

---

## 1. Decisions locked with the product owner

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D1 | Extract mechanism | **One-off Python script** | No `LpDbExportExtractService`, no batch job, no new endpoint. Script reads the XLSX + `facilities.csv` and writes CSVs; existing jobs load them. |
| D2 | Seed contract | **REVISED 2026-07-18: full-column seed** — `lp_facility_seeds.csv` carries **every per-LP export column** (facility-level `AccountID`/`FndName`/`BBDate` excluded), matching the full `lp_records` insert | Row values are authoritative on seed; the LP Master golden profile only fills fields a row left blank (a legacy 7-column file still parses — the reader is non-strict and pads blanks — and keeps the old merge behavior). `ubs_cls` is derived **per row** from that row's attributes via `reference/bb_criteria_matrix.csv` (§6.3.2 revised). |
| D3 | Facilities | **Upsert; `bank_status` = Active/Inactive** | Match-derived status goes on `bank_status` (not the Shadow-BB workflow `status`). Set via merged `facilities.csv` + existing facility ingest. |
| D4 | Match grain | **AccountID** (real data is 1:1 with fund name) | Facility identity stays `name`; an orphan export account is manufactured as an Inactive placeholder, and a duplicate FndName is disambiguated with the AccountID (§4). |
| D5 | Delivery mode | **One-off (day 1, maybe twice)** | Generated CSVs are committed artifacts, re-run by hand when a fresh export lands. |
| D6 | LP Master | **Truncate + repopulate with distinct LPs; re-evaluate the table** | See §6 — golden-record purpose, key, and what may/may not be seeded from the export. |
| D7 | Dates | **Keep the "Collateral Date" field & label; wire it as Last BB Run Date** | `collateral_date := BBDate`. No relabeling. Consolidating the other date columns is out of scope for now. |
| D8 | UBS credit profile on bootstrap | **Seed `ubs_default_adv_rate` from `UBSAR` and `ubs_default_conc_limit` from `UBSCL`; leave `ubs_classification` blank** | Agent LP category/classification comes **only** from Agent BB (mapped via Config), never from the export's `Classification` column. |
| D9 | `lp_rates` | **Drop (not needed now)** | Out of scope for the extract — the script never writes it. Removal is a separate Flyway + code-removal refactor (entity/controller/service/repo/tests), tracked as a follow-up. |
| D10 | Failure mode | **No hard-fail; no rejects; report + counts** | Every record is inserted (orphan accounts get placeholder facilities; unmatched lookups pass through + are dumped for review). A dirty file never aborts the run. |

---

## 2. Pipeline

```
Seed LP DB Export.xlsx ─┐
facilities.csv ─────────┤   pe-sub-jobs/scripts/lp_db_extract.py   (one-off, D1)
                        └──▶  parse 32 cols (header-addressed, replaceable map)
                             match AccountID → facilities.csv.account_number
                             pre-flight validation → rejects report (§3.1)
                             emit ▼
        ┌────────────────────────┬───────────────────────────┬──────────────────────────┐
        ▼                        ▼                           ▼
  facilities.csv          lp_master.csv                lp_facility_seeds.csv
  (merged: bank_status,   (REPLACED: distinct LPs,     (per (facility=FndName, LP):
   collateral_date=BBDate) golden fields only, §6)      full per-LP column set, D2 revised)
        │                        │                           │
        ▼                        ▼ (truncate lp_master first) ▼
  facilityIngestJob        lpMasterIngestJob            lpRecordsSeedJob   ── all EXISTING ──
        │                        │                           │
        └── upsert facilities    └── upsert LP Master         └── POST /lpRecords/seed
                                       (golden reference)          server merges LP Master
                                                                   core values into LP record
                                                                        │
                                                                        ▼
                                            LP Size (AUM/NAV/Pension) + credit defaults on LP record
```

Only **existing** Java runs; the sole new artifact is the Python script. The three CSVs stay
reviewable in `pe-sub-jobs/data/out/`, which pe-sub-jobs reads directly on startup (`ingest.*`
defaults in `application.yml`); `data/mock/` is untouched dev fixture data.

---

## 3. Source contract (`_BBs20260625`)

Columns 1–2 (`AccountID`, `FndName`) drive facility match/identity. The full per-column target is
in Appendix A. Seed-relevant subset:

- **Facility:** `FndName` → facility name; `AccountID` → `account_number` (match key); `BBDate` → `collateral_date`.
- **Seed row (D2 revised — full per-LP column set, 31 CSV columns):** the legacy 7 first
  (`FndName`, `InvestorName`, `Commitments`→`capCommit`, `Uncalled`→`uncalled`,
  `Classification`→`agentCls` (agent LP Category), `AgentAR`→`agentRate`, `AgentCL`→`agentConc`),
  then `Parent`, `SPV`, `HQ`→`high_qty`, `InvestorType` (normalized), `InstitutionalHNW`→`inst_vs_hnw`,
  `Region`→`region_location`, `InvestmentGrade`, `ubs_cls` (**derived per row** from the row's
  attributes via `bb_criteria_matrix.csv`, §6.3.2 revised), `SP`/`Moodys`/`Fitch`, `AUM`/`NAV`/`PensionAssets`,
  `FundingRatio`→`pension_funded`, `PercentOfCommitments`→`pct_cap_commit`, `Called`→`called_cap`,
  `PercentOfUncalled`→`pct_uncalled`, `CalledPercent`→`pct_called`, `UBSCL`→`ubs_conc`,
  `UBSAR`→`ubs_rate`, `AgentBB`→`agent_bb`, `UBSBB`→`ubs_bb`, `Notes`.
- **LP Master (golden):** `InvestorName`, `Parent`, `SPV`, `InvestorType`, `Region`, `HQ`,
  `InstitutionalHNW`, `InvestmentGrade`, `SP`, `Moodys`, `Fitch`, `AUM`, `NAV`, `PensionAssets`, `FundingRatio`.

### 3.1 Simulation data-quality defects (tolerate → report; never drop a record)

Measured in this file; a real export must not exhibit these. The script **never rejects a record** —
it does the best it can and dumps what needs analyst attention to a review report:

| Defect | Evidence | Handling |
|---|---|---|
| Export account not in `facilities.csv` | `5VZ9001`, `5VZ9002` (the sim's `TPG AG` extra accounts) | **Manufacture** an Inactive `"Unknown"`-bank placeholder facility so the LPs still seed (§4). |
| Fund name shared by many AccountIDs | `TPG AG Asset Based Credit Fund` → 3 AccountIDs | Disambiguate the placeholder name with the AccountID to keep `Facility.name` unique. |
| **Same LP, contradictory attributes** | All **300** investor names disagree across their ~67 rows (type/region/AUM all randomized) | See §6.2 — per-field majority vote ("best record"); no conflict report. |
| Free-text Investor Type / Agent LP Category | mis-spellings, non-canonical labels | Normalise to reference lists; pass unmatched through unchanged + dump for review (§6.4). |
| Dirty size values | `110`, `240B`, `1.33. tn`, `$21 bn+`, `394.6667`, `2T` | Tolerant parse; store as-is; normalize only clean numerics (§7). |

---

## 4. Facilities (D3, D4) — as built

- **Existing facilities (facilities.csv-driven).** The script walks the base `facilities.csv` and
  sets `bank_status = (account_number ∈ export.AccountID) ? "Active" : "Inactive"`. **This export →
  63 Active / 5 Inactive** existing. The 5 Inactive are facilities absent from the export
  (`5VW9761`, `5VY4577`, `5VY5270`, `5VY8943`, `5VZ8895`).
- **Orphan export accounts → manufactured, not rejected (100% insertion).** The 2 export AccountIDs
  missing from `facilities.csv` (`5VZ9001`, `5VZ9002`) each become a **new Inactive placeholder
  facility**: `agent_bank = "Unknown"`, `name = FndName`, `account_number = AccountID`,
  `collateral_date = BBDate`. `"Unknown"` satisfies `FacilityRowProcessor`'s non-blank agent-bank
  rule, and blank loan/date/participation ingest as null — so the placeholder loads and its LP
  records seed. The two share a FndName (a sim artifact), so the second is disambiguated to
  `TPG AG Asset Based Credit Fund (5VZ9002)` to keep `Facility.name` unique. **Net: 70 facilities
  (63 Active + 5 Inactive + 2 placeholder Inactive); no LP record is rejected.** On clean 1:1 data
  no placeholders are needed. Analysts fix the `"Unknown"` bank/name post-load.
- **Identity stays `name` (D4).** Facility names in `facilities.csv` are authoritative and left
  unchanged; the messy `FndName` is **not** written over them (18/63 differ in the sim: casing,
  typos, an encoding artifact). The seed resolves `facility_name` from `AccountID → facilities.name`,
  so seed rows link by the canonical name via the API's `findByName`.
- **Status field:** written to **`bank_status`**; the Shadow-BB workflow `status`
  (`Not Started → Active` on accepted run) is untouched (`project_shadow_bb_trigger`).
- **Date (D7):** for **Active** facilities `collateral_date := BBDate` (first BBDate for the account,
  ISO). The field keeps its **"Collateral Date"** label, wired as the Last BB Run Date. Inactive
  facilities (no export BBDate) keep their existing `collateral_date`. No relabeling.

---

## 5. LP Size display (D2)

> **D2 revision note (2026-07-18):** on the *seed* path LP Size now arrives on the row itself
> (`aum`/`nav`/`pension` passthrough); the LP Master merge below remains the fallback for blank
> row values and stays authoritative on the *wizard* (Agent BB upload) path.

LP Size reaches the LP record only via the LP Master merge (`applyLpMasterBaseline`,
[LpIngestService.java:407-409](../pe-sub-api/src/main/java/com/ubs/pesubapi/service/LpIngestService.java#L407-L409)),
so the values must live in LP Master (§6).

- **Display as-is** for already-abbreviated strings (`$700Mn`, `$4.8 bn`, `2T`).
- **Numeric → short currency form** (`1_000_000_000 → 1bn`): `≥1e12→"tn"`, `≥1e9→"bn"`, `≥1e6→"mn"`,
  `≥1e3→"k"`, up to two decimals, trailing zeros trimmed. "Numeric" = digits/`,`/`.` with an optional
  leading `$` and no unit letters; anything bearing a unit or other text is shown verbatim.
- **UI (as built):** the shared **`lpSizeFormat`** helper (`pe-sub-ui/src/utils/lpSize.ts`) replaces
  the expanding `tableMoney`/`fmtBillionDisplay` for the LP Size cell in **LP Master**, **RunShadowBB**
  and **ShadowBB** tables. In the **LP Record edit form** (`LPRecordPanel`) it drives the **read-only**
  display (extracted value as-is / short-form); when the panel is **editable** the existing `$ billions`
  field is kept so the edit→save→BB-calc round-trip (`moneyToBillion`/`billionToMoney`) is unchanged.
  `sizeMeasure` (AUM/NAV/Assets) logic unchanged.
- Note: `fmtBillionDisplay` treated a plain number as **billions** (`n×1e9`) — wrong for the new raw
  extracted values (`7650000000`) — which is exactly why the LP Size cells moved to `lpSizeFormat`.

### 5.1 Precision guard-rail
Short-form applies **only** to the LP Size scale indicator, whose source is already abbreviated and
which never feeds the BB math. All BB money (commitment, called, uncalled, BB, excess conc) stays at
full precision per `project_precision_no_rounding`; the `*_num` companion columns are untouched.

---

## 6. LP Master — repopulate & re-evaluate (D6)

**Purpose (confirmed in code):** `lp_master` is the bank-wide **canonical "good-quality" LP profile**,
one row per LP. On Agent BB upload (wizard match step), a matched LP's **core values auto-populate**
the incoming Run-Shadow-BB LP record via `applyLpMasterBaseline`. The **core values** are:

| Group | Fields auto-populated on match |
|---|---|
| Identity | `investorType`, `instVsHnw`, `region`, `spv`, `highQty`, `ig`, `parent` |
| Ratings | `sp`, `mdy`, `fitch` |
| Financial scale (LP Size) | `aum`, `nav`, `pension`, `pensionFunded` |
| UBS credit profile | `cls` (`ubsClassification`), `ubsRate` (`ubsDefaultAdvRate`), `ubsConc` (`ubsDefaultConcLimit`) |

### 6.1 Repopulation
Day-1: **clear then reload** `lp_master` with the script's `lp_master.csv` of **distinct LPs**
(dedup by normalized `investor_name`; unique key already enforced by the entity).

**FK finding (item resolved):** one FK references the table — `lp_records.lp_master_id`
(nullable, default `ON DELETE RESTRICT`). A blind `TRUNCATE` is therefore **not** safe when LP
records exist.

**As built (clear-then-load):** rather than raw SQL (the jobs app is DB-less and Flyway owns the
schema), the clear is a new **SERVICE-gated `POST /api/lp-master/clear`** endpoint →
`LpMasterService.clearAll()`, which **nulls all `lp_records.lp_master_id`** (new repo method
`clearAllLpMasterRefs()`, mirroring the per-row `clearLpMasterRef`) → **`deleteAllInBatch()`** the
master rows, audited (`"LP Master Cleared"`). The **`lpMasterIngestJob`** runs a **`lpMasterClearStep`
tasklet** that calls it **once** before the chunked (50/chunk) upsert step — so a re-run leaves no
stale rows, and per-chunk replace (which would wipe prior chunks) is avoided. Kept SERVICE-only (not
ANALYST like the per-id `DELETE`) so a human curation token can never trigger a table-wide wipe.
`lp_master` is **not** Flyway-seeded, so on a fresh day-1 DB the clear is a no-op and the upsert
alone yields exactly the distinct set; the write-back re-links by `investor_name` on the next
accepted Shadow BB regardless.

### 6.2 The golden-record selection ("best record")
An investor appears on **many rows** (one per facility — ~15 on average) whose attributes may
disagree. The script builds one golden LP per `investor_name` by **best-record consolidation**
(`build_master` / `_best`): **each field is chosen independently by majority vote over that
investor's non-blank values** — not one arbitrary row. Ties (and all-equal frequencies) fall back to
the first occurrence; blanks do not vote, so a value present in only some rows still fills the gaps.
Investor Type is voted on its *canonical* mapping (so spelling variants that normalise the same count
together); UBS classification is derived from the **best `UBSAR`** so rate/limit/class stay
consistent.

This yields the most-agreed value per field. On the **synthetic** export the attributes are
randomized per row, so the vote is only as meaningful as the source — but on a **clean LP DB** (one
consistent profile per LP) the winning value is authoritative. There is **no conflict report**;
ongoing quality is maintained via the LP Master screen + `LpMasterWriteBackService` accumulation.

### 6.3 Re-evaluation recommendations
1. **Seed only stable golden fields** from the export (Identity, Ratings, Financial scale). The
   current schema already excludes per-facility/per-cycle values (commitments, uncalled, agent rate/CL,
   BB) — keep it that way; those belong on `lp_records`, not the golden profile.
2. **UBS credit profile on bootstrap (D8, re-revised 2026-07-18).** Seed `ubs_default_adv_rate`
   from **`UBSAR`** (Floor-Mapped, below) and `ubs_default_conc_limit` from **`UBSCL`**.
   `ubs_classification` is now derived from the **LP's own attributes via the Borrowing Base
   Criteria Matrix** (`pe-sub-jobs/data/reference/bb_criteria_matrix.csv`, transcribed from
   `BB_CRITERIA_DESIGN.md`) — **not** from `UBSAR`: under the funded-split matrix a rate no longer
   identifies a class (90% maps to six classes). The `classify_ubs` waterfall: agent `Ineligible
   Investor` → `Excluded`; any usable agency rating → `Rated Investor` (band via the Q2
   median/lower-of-two waterfall, sub-IG clamps to BBB); HNW flag or agent `Designated PWM` →
   `HNW Feeder (acceptable)` (SPV) / `HNW (acceptable)`; pension assets > $5Bn / > $1Bn → the Corp
   Pension classes; NAV > $1Bn → `Unrated NAV > $1Bn`; FoF/asset-manager type with AUM > $10Bn →
   `FoF & Other > $10Bn AUM`; else `Other Institutional` (catch-all — the mapping is **total**, no
   unmatched report). The row's `UBSAR`/`UBSCL` are instead **cross-checked** against the matrix's
   expected AR (funded-split on `CalledPercent`, ≥ 40% inclusive) / CL and deviations beyond
   ±2.5pp aggregated into `ubs_class_matrix_variance.csv`. The export's `Classification` remains
   the **agent LP Category**, never UBS classification (`project_agent_cls_vs_invtype`).

   **The Floor Map.** Raw `UBSAR` **and** `AgentAR` are slotted into the platform's discrete
   advance-rate groups via `pe-sub-jobs/data/reference/rate_floor_map.csv` before seeding
   (`agent_rate`, `ubs_rate`, `ubs_default_adv_rate`) and before the matrix cross-check:
   ≥ 90% → 90 · 75–89.9% → 75 · 65–74.9% → 65 · 50–64.9% → 50 · < 50% → 0 (the BUSA bucket set).

### 6.4 Reference-list normalization (new)
The export's free-text fields are normalised against **editable reference lists in `pe-sub-jobs/data/reference/`**
(seeded from `classification_config`; keep in sync with Config):
- **Investor Type** → `INVESTOR_TYPE_OPTS` via `investor_types.csv` + `investor_type_aliases.csv`.
  Case/punctuation-insensitive + alias match; **unmatched values are passed through unchanged** (record
  always kept) and dumped to `unmatched_investor_types.csv` with a fuzzy suggestion.
- **Agent LP Category** (`Classification`) → `AGENT_CLS_OPTS` via `agent_lp_categories.csv`; unmatched
  passed through and dumped to `unmatched_agent_categories.csv`.
- **UBS classification** ← the LP's attributes via the BB Criteria Matrix (`bb_criteria_matrix.csv`,
  §6.3.2 revised); always resolves (Other Institutional catch-all), so there is no UBS unmatched
  report — off-matrix `UBSAR`/`UBSCL` values are aggregated into `ubs_class_matrix_variance.csv`.
- **Advance rates** (`UBSAR`, `AgentAR`) ← the Floor Map (`rate_floor_map.csv`): slotted into the
  discrete 90/75/65/50/0 rate groups (§6.3.2).
- Nothing is auto-corrected by fuzzy match — suggestions are advisory; analysts curate the reference
  files. On the current sim: 1 unmatched Investor Type (`Corporate Pension`), 0 unmatched Agent
  Categories, all 300 UBS classes mapped from UBSAR.
3. **Identity key.** `investor_name` UNIQUE is fragile (real LPs can share names across parents). Keep
   it for day 1, but add a normalized match key and consider `(investor_name, parent)` or an explicit
   LP id as a follow-up. No provenance/"source" columns in the DB (`feedback_no_provenance_in_db_config`).
4. **Financial scale storage.** Values are inconsistent free strings. Store the **normalized
   short-currency string** (§5) for display consistency; an optional numeric companion for sorting can
   follow if needed — display stays as-is.

---

## 7. Impacted components — as built (all four units shipped & green)

**New — standalone extract utility (lives inside `pe-sub-jobs/data/`)**
- `pe-sub-jobs/scripts/lp_db_extract.py` — parse, AccountID match, validate, **normalise** (§6.4).
  **No CLI args**: the export to process is the **`EXPORT_FILE` variable at the top of the script**
  (edit + re-run), defaulting to `pe-sub-jobs/data/import/`. Base `facilities.csv` and the
  `pe-sub-jobs/data/reference/` lists are fixed project paths — every path is anchored to the
  pe-sub-jobs project root, so the tool is fully self-contained and reaches nothing outside it.
  **Writes every output into `pe-sub-jobs/data/out/`** and **never touches the app tree**. Runs from
  any working directory. Reads 20,000 rows → **300 distinct LPs, 1,518 seed rows, 70 facilities
  (63 Active / 5 Inactive / 2 placeholder)**.
- `pe-sub-jobs/data/reference/` — editable, Config-seeded lists: `investor_types.csv`,
  `investor_type_aliases.csv`, `agent_lp_categories.csv`, `bb_criteria_matrix.csv` (Borrowing Base
  Criteria Matrix, replaces the retired `ubs_rate_tiers.csv`), `rate_floor_map.csv` (the Floor Map).
- `pe-sub-jobs/scripts/lp_db_extract.ps1` — Windows PowerShell wrapper; `lp_db_extract.sh` — Linux/macOS
  wrapper (each resolves its own dir, picks a Python interpreter, checks `openpyxl`; no args).
  `lp_db_generate.ps1` / `lp_db_generate.sh` — same pair for the generator.
- **App CSVs in `pe-sub-jobs/data/out/`** — clean N-column (lenient tokenizer): `lp_master.csv`,
  `lp_facility_seeds.csv`, `facilities.csv` (base + `bank_status` + Active `collateral_date=BBDate`
  + manufactured Inactive placeholders for orphan accounts).
- **Review reports in `pe-sub-jobs/data/out/`** (each with a `#` summary, written only when non-empty,
  stale copies purged each run): `unmatched_investor_types.csv`, `unmatched_agent_categories.csv`,
  `ubs_class_matrix_variance.csv` (off-matrix UBSAR/UBSCL, aggregated per (cls, band, funded));
  plus `EXTRACT_SUMMARY.txt`. There is
  **no `seed_rejects.csv`** (every record is inserted), **no `lp_master_conflicts.csv`** (best-record
  consolidation, §6.2), and **no UBS unmatched report** (the matrix waterfall is total, §6.3.2).

**Chaos monkey (2026-07-18, relocated same day; see `pe-sub-docs/"AI Chaos Monkey for Data Quality.md"`)**
- A clean simulated export is "too clean" to verify the extract's assumptions/formats/conversions,
  so the chaos monkey lives in the **generator** (`pe-sub-jobs/scripts/lp_db_generate.py`,
  `CHAOS_ENABLED` / `CHAOS_SEED` tunables): the degradation is applied to the values **written to
  the XLSX**, so the date-stamped `LP DB Export *.xlsx` itself has realistic manual-entry quality.
  Chaos uses its own rng, so the underlying clean dataset is identical with chaos on or off. An
  earlier iteration degraded rows in memory inside `lp_db_extract.py`; that was wrong — the extract
  must treat whatever file it is given as source truth, exactly as it would a real LP DB export,
  and now reads the file as-is with **no chaos flags of its own**.
- Mutations follow the analyst **"hierarchy of care"**: sacred cash/identity columns (`AccountID`,
  `FndName`, `Commitments`, `Called`, `Uncalled`, `BBDate`, raw rates, BB values, percentages) are
  never touched; decision fields get systematic formatting drift (ratings `A-` → `A minus` / NR
  variants / case noise; Investor Type and agent Classification categorical drift — a mix of
  alias-resolvable spellings and genuinely unknown labels); afterthought fields get real noise
  (investor-name suffix drops / ` - Tranche A` / case flips; AUM & PensionAssets unit mix-ups and
  style drift; NAV range/threshold strings like `500M - 2Bn`, `>5B`; nulled UBSCL/FundingRatio).
- Every mutation lands in the generator's ground-truth log `data/import/<export name>.chaos_log.csv`
  (`export_row, column, pattern, original, corrupted`) — beside the XLSX, never read by the extract —
  so what the normalizers absorbed can be verified against what was actually degraded. The
  name variants intentionally multiply distinct LP Master rows (the entity-resolution problem the
  chaos doc predicts); the rating/size mess exercises the Q2 rating normalizer and the tolerant
  `parse_money_low` parser feeding the matrix waterfall. The extract's `chaos_report.csv` is
  retired (stale copies are purged on each run).
- **Loading:** pe-sub-jobs reads `lp_master.csv`, `lp_facility_seeds.csv` and `facilities.csv`
  directly from `pe-sub-jobs/data/out/` on startup — restart it (or trigger its `/jobs`
  endpoints) after a re-run. No copy into `data/mock/` is needed or wanted.

**pe-sub-api**
- `collateral_date`: **no code change** — the extract writes it into `facilities.csv`; the existing
  `FacilityRow` ingest already maps it. Locked with a round-trip assertion in `SeedIngestEndpointsIntegrationTest`.
- **`POST /api/lp-master/clear`** (SERVICE-gated) → `LpMasterService.clearAll()` (new
  `LpRecordRepository.clearAllLpMasterRefs()` + `deleteAllInBatch`), audited. `SecurityConfig` gates it
  SERVICE-only. New `LpMasterClearIntegrationTest` (wipe+detach, empty no-op, non-SERVICE 403).
- `lp_rates` removal is **not** part of this change — tracked separately (D9).

**pe-sub-jobs**
- `PeSubApiClient.clearLpMaster()` + a **`lpMasterClearStep`** tasklet run before the chunked ingest in
  `lpMasterIngestJob` (clear-then-load). Context-load + job tests green.

**pe-sub-ui**
- `src/utils/lpSize.ts` (`lpSizeFormat`) + `src/__tests__/lpSize.test.ts`; wired into LP Master,
  RunShadowBB, ShadowBB tables and the read-only `LPRecordPanel` LP Size. No relabeling.

---

## 8. Test plan
- **Python:** unit tests over a small fixture — AccountID match → `bank_status`; full-column seed shape (D2 revised);
  best-record consolidation (per-field majority vote); dirty-size tolerance (`parse_money_low` incl.
  chaos range/threshold forms); orphan account → manufactured Inactive placeholder + seeds (no
  rejects); reference normalization + matrix classification waterfall (rated band Q2 cases, pension/
  NAV/AUM thresholds, HNW split, Excluded) + Floor-Map boundaries (90/75/65/50/0, inclusive mins) +
  investor-type/agent unmatched dumps; generator chaos determinism (same `CHAOS_SEED` → same XLSX
  and chaos log; chaos off → identical clean base dataset).
- **api (done):** `collateral_date` round-trips from a facility ingest (`SeedIngestEndpointsIntegrationTest`);
  `POST /api/lp-master/clear` wipes masters + detaches records, is a no-op when empty, and 403s for a
  non-SERVICE caller (`LpMasterClearIntegrationTest`, 3/3).
- **ui:** `lpSizeFormat` units (`$700Mn`→as-is, `4.8 bn`→as-is, `1000000000`→`1bn`, `""`→`—`); LP Master
  / Shadow BB render LP Size from a mocked fixture (no hardcoded strings).

---

## 9. Sign-off status — **all items resolved**
1. **§6.2** — ✅ LP Master built by **best-record consolidation** (per-field majority vote across an investor's rows); no conflict report; clean LP DB makes the vote authoritative later.
2. **§6.3.2 / D8** — ✅ (re-revised 2026-07-18) seed `ubs_default_adv_rate` from `UBSAR` (Floor-Mapped)
   **and** `ubs_default_conc_limit` from `UBSCL`; `ubs_classification` derived from LP attributes via
   the BB Criteria Matrix waterfall (total — never blank); `UBSAR`/`UBSCL` cross-checked against the
   matrix into `ubs_class_matrix_variance.csv`.
3. **§6.1** — ✅ one FK exists (`lp_records.lp_master_id`, nullable/RESTRICT); use null-refs→delete→reload,
   not a blind truncate.
4. **§3.1 / §4** — ✅ **100% insertion**: orphan export accounts are manufactured as Inactive `"Unknown"`
   placeholder facilities so every LP record seeds; **no `seed_rejects.csv`**. Analysts clean up post-load.
5. **D9** — ✅ drop `lp_rates` (separate follow-up refactor; not touched by the extract).

_Also resolved earlier: Python one-off (D1/D5); `bank_status` for match status (D3); Collateral Date
kept & wired as Last BB Run Date, no relabel (D7); LP Master clear+repopulate with distinct LPs (D6)._

---

## Appendix A — full column map
`AccountID`→match·`FndName`→facility name·`InvestorName`→`investor_name`·`Parent`→`parent`·`SPV`→`spv`·
`InvestorType`→`inv_type`·`Region`→`region`·`HQ`→`high_qty`·`InstitutionalHNW`→`inst_vs_hnw`·
`InvestmentGrade`→`investment_grade`·`Classification`→`agent_cls`·`Notes`→`notes`·`SP`/`Moodys`/`Fitch`→`sp`/`mdy`/`fitch`·
`AUM`/`NAV`/`PensionAssets`→`aum`/`nav`/`pension`·`FundingRatio`→`pension_funded`·`UBSAR`→`ubs_default_adv_rate`(optional)·
`AgentAR`→`agent_rate`·`Commitments`→`cap_commit`·`Uncalled`→`uncalled`·`AgentCL`→`agent_conc`·
`BBDate`→`collateral_date`. Since the D2 revision the previously-unseeded columns also land on
`lp_records`: `PercentOfCommitments`→`pct_cap_commit`·`Called`→`called_cap`·`PercentOfUncalled`→`pct_uncalled`·
`CalledPercent`→`pct_called`·`UBSCL`→`ubs_conc`·`UBSAR`→`ubs_rate`·`AgentBB`→`agent_bb`·`UBSBB`→`ubs_bb`;
UBS classification is derived per row from the row's attributes via the BB Criteria Matrix
(`ubs_cls`, §6.3.2), and `AgentAR`/`UBSAR` are Floor-Mapped to the 90/75/65/50/0 rate groups. Only
the facility-level `AccountID`/`FndName`/`BBDate` never appear on the seed row.
