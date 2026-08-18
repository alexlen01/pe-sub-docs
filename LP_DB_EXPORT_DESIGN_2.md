# LP DB Export → Seed Extract

Reference for the two Python utilities in `pe-sub-jobs/scripts/`:

| Script | Reads | Writes |
|---|---|---|
| `lp_db_generate.py` | `data/mock/facilities.csv`, `data/reference/` vocabularies | one simulated **LP DB Export** XLSX into `data/import/` |
| `lp_db_extract.py` | an **LP DB Export** XLSX + `AgentBankSummaryRpt.xlsx` from `data/import/`, lists from `data/reference/` | exactly three ingestion CSVs into `data/out/` |

No Java service and no batch job is part of the extract — the three CSVs are picked up by the
existing `facilityIngestJob`, `lpMasterIngestJob` and `lpRecordsSeedJob` (pe-sub-jobs reads
`data/out/` on startup; restart it or trigger its `/jobs` endpoints after a re-run).

```
LP DB Export.xlsx ────┐
AgentBankSummaryRpt ──┴──▶ lp_db_extract.py ──▶ facilities.csv · lp_master.csv · lp_facility_seeds.csv
```

## Running

Neither script takes command-line arguments; the inputs and tunables are constants at the top of
each file. For the extract, set `EXPORT_FILE` to the export to process. Wrappers resolve the
interpreter and check `openpyxl`: `lp_db_extract.ps1` / `.sh`, `lp_db_generate.ps1` / `.sh`.
Every path is anchored to the pe-sub-jobs root, so either script runs from any working directory
and never touches the app tree.

`data/out/` is emptied at the start of each write (after all inputs parse, so a failed read leaves
the previous outputs intact) and holds only the three CSVs — no report or log files.

---

## 1. Source contract and how portable it is

**LP DB Export** — one row per (facility account, investor), 32 columns (Appendix A).

- Columns are addressed **by header name, not position**, so column order is irrelevant.
- **Unknown columns are ignored**, so an export carrying extra columns reads fine.
- Any of the 32 required names **missing** aborts the run with the list of what is missing and the
  header that was found. This is the only hard failure in the script.
- Two header vocabularies are accepted: the LP DB Export's own names (`SRC_COLS`) and the readable
  headers the platform's own LP Records export writes (`PLATFORM_HEADERS`, matching
  `pe-sub-ui/src/services/lpExportService.ts`), so a workbook exported from the UI can be fed
  straight back in. Platform columns are also **de-formatted** on the way in — percents under a
  `(%)` header (`94` → `0.94`), money display strings (`$428,800,000` → `428800000`), and
  concentration limits that are a percent or an absolute cap in the same column.
- **Adapting to a foreign export** is therefore a header-alias exercise: add its names to
  `PLATFORM_HEADERS` (plus the column to `PLATFORM_PERCENT_COLS` / `PLATFORM_MONEY_COLS` /
  `PLATFORM_LIMIT_COLS` if its values are display-formatted). Only a genuinely absent field
  requires more than that.
- Sheet: the first sheet, whatever it is named.

**Agent Bank Summary** (`AgentBankSummaryRpt.xlsx`) — this is the brittle input. It is a banded
print layout, not a table, and its header **must match `ABS_COLS` positionally**
(`Agent, Borrower, AccountNumber, LoanAmount, <unnamed spacer>, MaturityDate, FacilityStatus,
FacilityStatusDate`) or the run aborts. The agent bank sits alone on a group-header row and is
carried down onto the facility rows below it; `AccessTotalsLoanAmount:` subtotal rows and the sheet
grand total carry no facility and are skipped.

## 2. Dirty input is expected

Real and simulated exports both carry manual-entry damage, so every parser is tolerant and
**no row aborts the run and no record is rejected**:

- ratings arrive as `A minus`, `NR`, case noise → unified S&P/Moody's/Fitch notch scale;
- sizes arrive as `240B`, `1.33. tn`, `$21 bn+`, `500M - 2Bn`, `>5B` → `parse_money_low` (used for
  thresholds only; the seed stores the value as given);
- Investor Type and Agent LP Category arrive misspelled or non-canonical → normalized against the
  reference lists, **unmatched values pass through unchanged**;
- an export account absent from the Agent Bank Summary → a manufactured placeholder facility, not a
  dropped LP.

The run prints only a retention check: export rows, seed rows written, dropped (duplicate
(facility, investor) pair / blank investor name / unresolvable facility), and the retained
percentage — expected to be 100%.

## 3. Outputs

### `facilities.csv` — `FACILITY_COLS`
`agent_bank, name, account_number, loan_amount, maturity_date, bank_status, bank_status_date,
ubs_participation, collateral_date`

- Rows come from the un-banded Agent Bank Summary; `Borrower` is the authoritative facility name and
  is written through unchanged, warts included. The export's `FndName` never overwrites it.
- `bank_status` = `Active` when the row's `account_number` appears in the export, else `Inactive` —
  it **overrides** the report's own `FacilityStatus` column. It is written to `bank_status`, never to
  the Shadow-BB workflow `status`.
- `collateral_date := BBDate` (first BBDate for that account) for Active facilities. The field keeps
  its "Collateral Date" label and is wired as the Last BB Run Date.
- `ubs_participation` is blank — UBS's own figure is never reported by the agent bank; it ingests as
  null.
- Report defects handled: a reprinted (`AccountNumber`, `Borrower`) pair is dropped; one account
  with two borrowers yields two facilities and the first row owns the `AccountID → name` join; a
  borrower name reused by another account is suffixed with its `AccountNumber` to keep the name
  unique.
- **Orphan export accounts** (in the export, not in the report) become `agent_bank = "Unknown"`,
  Inactive placeholder facilities named after `FndName` (disambiguated with the AccountID when the
  name repeats), so their LP records still seed. Analysts fix the bank/name post-load.

### `lp_master.csv` — `MASTER_COLS`
One golden row per `investor_name`. An LP appears on many rows whose attributes may disagree, so
**each field is chosen independently by majority vote** over that investor's non-blank values
(`build_master` / `_best`); ties fall back to first occurrence and blanks do not vote. Investor Type
is voted on its *canonical* mapping so spelling variants count together. Only stable golden fields
are seeded — identity, ratings, financial scale, UBS credit defaults; nothing per-facility or
per-cycle. `ubs_default_advance_rate` is written as a **fraction** (`0.9`).

The job clears the table before loading (`lpMasterClearStep` → SERVICE-gated
`POST /api/lp-master/clear`, which nulls `lp_records.lp_master_id` then deletes in batch), so a
re-run leaves no stale rows.

### `lp_facility_seeds.csv` — `SEED_COLS`
One row per (facility, investor), carrying **every per-LP export column**; only the facility-level
`AccountID`/`FndName`/`BBDate` are excluded. Row values are authoritative on seed — the LP Master
profile only fills fields a row left blank. `agent_advance_rate` / `ubs_advance_rate` are written as
**percent strings** (`90%`), money as exact short currency (`$484M`, `$314.6M` — no rounding).

`lp_rates` is out of scope; the script never writes it.

## 4. Derived values

**UBS LP Category** (`ubs_lp_category`, on both master and seed rows) is derived per row from the
row's own attributes by the `classify_ubs` waterfall — never from the export's `Classification`
column, which is the **agent** LP Category:

1. agent category `Ineligible Investor` → `Excluded`
2. any usable agency rating → `Rated Investor` (band via `eligible_band`: three ratings → median,
   two → the lower, one → as-is; sub-BBB− clamps to BBB)
3. HNW flag or agent `Designated PWM` → `HNW Feeder (acceptable)` if SPV, else `HNW (acceptable)`
4. pension assets > $5Bn / > $1Bn → the two Corp Pension classes
5. NAV > $1Bn → `Unrated NAV > $1Bn`
6. Fund of Funds / Hedge Fund with AUM > $10Bn → `FoF & Other > $10Bn AUM`
7. catch-all → `Other Institutional`

The waterfall is total, so the value is never blank and there is no unmatched list.

**Advance rates.** `UBSAR` and `AgentAR` are slotted into the discrete rate groups by the Floor Map
(`rate_floor_map.csv`): ≥ 90 → 90 · 75–89.9 → 75 · 65–74.9 → 65 · 50–64.9 → 50 · < 50 → 0.

## 5. Reference lists (`pe-sub-jobs/data/reference/`)

Editable CSVs seeded from `classification_config`; keep them in sync with Config.

| File | Used for |
|---|---|
| `investor_types.csv` + `investor_type_aliases.csv` | Investor Type → `INVESTOR_TYPE_OPTS` (case/punctuation-insensitive + aliases) |
| `agent_lp_categories.csv` | export `Classification` → `AGENT_CLS_OPTS` |
| `rate_floor_map.csv` | the Floor Map rate groups |
| `bb_criteria_matrix.csv` | **not read by either script** — the class thresholds live in `classify_ubs`; the file documents the taxonomy the labels come from |

Nothing is auto-corrected by fuzzy match; unmatched values are written through as given and analysts
curate the reference files.

## 6. The generator (`lp_db_generate.py`)

A dev utility that produces the export the extract reads, so the pipeline can be exercised without a
real LP DB file. Constants at the top: `EXPORT_OUT`, `SHEET_NAME`, `SEED`, `TARGET_ROWS`,
`REPEAT_MIN`/`REPEAT_MAX` (facilities per LP), `ORPHAN_ACCOUNTS`, `CHAOS_ENABLED`, `CHAOS_SEED`.

- Facilities are the accounts in `data/mock/facilities.csv` plus `ORPHAN_ACCOUNTS`, which exercise
  the placeholder path.
- An LP's identity, classification, ratings, scale and UBS profile are constant across its rows;
  only per-facility financials vary. Base values use the canonical vocabularies, so with chaos off
  the extract's unmatched counts are zero.
- Rating presence follows the Agent LP Category, keeping the derived UBS mix near the real book's
  ~40% Rated and leaving unrated LPs to exercise the other branches.
- Its `SRC_COLS` must stay in step with the extract's — the extract requires all 32 names.

**Chaos monkey.** A clean simulated export is too clean to verify the extract's parsers, so the
degradation is applied to the values **written to the XLSX** — the extract never degrades anything
and treats whatever file it is given as source truth. Mutations follow the analyst "hierarchy of
care": sacred cash/identity columns (`CHAOS_SACRED`: AccountID, FndName, Commitments, Called,
Uncalled, BBDate, raw rates, BB values, percentages) are never touched; decision fields get
formatting and categorical drift (`A minus`, `SWF`, `PWM`); afterthought fields get name suffix
drops, ` - Tranche A`, case flips, M↔B unit mix-ups and range strings. Chaos draws from its own rng,
so the clean base dataset is identical with chaos on or off and the same `CHAOS_SEED` reproduces the
same degradation. Mutation counts print per column and per pattern; no ground-truth log file is
written. See `pe-sub-docs/AI Chaos Monkey for Data Quality.md`.

## 7. Tests

- **Python:** AccountID match → `bank_status`; full seed row shape; best-record consolidation;
  dirty-size tolerance including chaos range/threshold forms; orphan account → placeholder + seeds
  with no rejects; reference normalization and the `classify_ubs` branches (rated bands, pension/NAV/
  AUM thresholds, HNW split, Excluded); Floor Map boundaries (inclusive mins); generator chaos
  determinism; and that a run leaves `data/out/` holding exactly the three CSVs.
- **pe-sub-api:** `collateral_date` round-trips through facility ingest
  (`SeedIngestEndpointsIntegrationTest`); `POST /api/lp-master/clear` wipes masters, detaches
  records, no-ops when empty, 403s for a non-SERVICE caller (`LpMasterClearIntegrationTest`).
- **pe-sub-ui:** `lpSizeFormat` units; LP Master / Shadow BB render LP Size from a mocked fixture.

## 8. LP Size display

`pe-sub-ui/src/utils/lpSize.ts` (`lpSizeFormat`) drives the LP Size cell in LP Master, RunShadowBB
and ShadowBB, and the read-only LP Size in `LPRecordPanel`. Already-abbreviated strings (`$700Mn`,
`2T`) display as-is; plain numerics become short currency (`1000000000` → `1bn`). Short form applies
**only** to the LP Size scale indicator — it never feeds BB math. All BB money stays at full
precision in the `NUMERIC(20,2)` columns on `lp_records`. When the panel is editable the existing
`$ billions` field is kept, so the edit → save → BB-calc round-trip is unchanged.

---

## Appendix A — column map

Export column → seed row field (`lp_facility_seeds.csv`); LP Master reuses the same field names for
the golden subset.

| Export | Seed field | Export | Seed field |
|---|---|---|---|
| `AccountID` | *(facility match only)* | `FundingRatio` | `funding_ratio` |
| `FndName` | *(facility name lookup)* | `UBSAR` | `ubs_advance_rate` (Floor-Mapped) |
| `BBDate` | *(facility `collateral_date`)* | `AgentAR` | `agent_advance_rate` (Floor-Mapped) |
| `InvestorName` | `investor_name` | `Commitments` | `capital_commitment` |
| `Parent` | `parent` | `PercentOfCommitments` | `pct_of_fund_commitments` |
| `SPV` | `spv` | `Called` | `called_capital` |
| `InvestorType` | `investor_type` (normalized) | `Uncalled` | `uncalled_capital` |
| `Region` | `region_location` | `PercentOfUncalled` | `pct_of_fund_uncalled` |
| `HQ` | `high_quality` | `CalledPercent` | `pct_lp_called` |
| `InstitutionalHNW` | `institutional_or_hnw` | `AgentCL` | `agent_concentration_limit` |
| `InvestmentGrade` | `investment_grade` | `UBSCL` | `ubs_concentration_limit` |
| `Classification` | `agent_lp_category` (normalized) | `AgentBB` | `agent_borrowing_base` |
| `SP` / `Moodys` / `Fitch` | `sp_rating` / `moodys_rating` / `fitch_rating` | `UBSBB` | `ubs_borrowing_base` |
| `AUM` / `NAV` / `PensionAssets` | `aum` / `nav` / `pension_assets` | `Notes` | `notes` |
| *(derived)* | `ubs_lp_category` | | |
