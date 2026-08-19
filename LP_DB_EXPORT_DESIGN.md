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

**LP DB Export** — one row per (facility account, investor), **30 columns** as of the
**2026-08-18** format (Appendix A).

- Columns are addressed **by header name, not position**, so column order is irrelevant. The
  2026-08-18 reshuffle therefore cost no code change; only the added and removed columns did.
- **Unknown columns are ignored**, so an export carrying extra columns reads fine.
- Any of the 30 required names **missing** aborts the run with the list of what is missing and the
  header that was found. This is the only hard failure in the script. A stale pre-2026-08-18
  workbook is additionally diagnosed as such, by name.
- Header matching runs through `_norm()` (lowercase, runs of non-alphanumerics collapsed to one
  space), which is what absorbs the format's own quirks without an alias per quirk: the **embedded
  CRLF** in `LP Size\r\n($ Bil)`, the misspelt `Insitutional vs HNW`, the `Moody'S` capitalisation
  and the trailing `?` on `Investment Grade?`.
- `SRC_HEADERS` accepts three vocabularies at once: the current export's headers, the pre-2026-08-18
  terse ones (`FndName`, `InvestorName`, `UBSAR`, …) so an archived workbook still parses for the
  columns it has, and the readable headers the platform's own LP Records export writes (matching
  `pe-sub-ui/src/services/lpExportService.ts`), so a workbook exported from the UI can be fed
  straight back in.
- **The UI exporter tracks this format.** `lpExportService.ts` writes the same 30 columns in source
  order, with two deliberate departures that `_norm()` treats as equivalent: it spells
  `Institutional vs HNW` correctly (the source misspells it "Insitutional") and writes
  `LP Size ($ Bil)` flat rather than with the source's embedded line break. It also writes rates and
  shares as **fractions** rather than percent numbers — the export's headers carry no `(%)` marker,
  and a fraction is unambiguous on the way back in, whereas a 1% share written as `1` would be
  indistinguishable from 100%. Consequently the file now carries excess concentration, a *computed*
  column, because the export itself does; rank, eligibility, delta and the shadow-BB outcome still
  belong to the Shadow BB export, not here.
- **Numeric normalization is value-driven, not header-driven** (`normalize_numeric`). Four headers
  are identical across the export and the platform's export — `% of Uncalled Capital`,
  `% of LP Called`, `Agent Concentration Limit`, `UBS Concentration Limit` — but the values are
  shaped differently (the export writes fractions, the platform writes percents and money display
  strings). The header cannot tell them apart, so the shape of the value decides: a share or rate is
  a fraction by definition, so anything carrying a `%` or exceeding 1 is scaled down, and `0.154` is
  left alone. This is idempotent, so re-reading a normalized value is safe.
- **Adapting to a foreign export** is therefore a header-alias exercise: add its names to
  `SRC_HEADERS`. Only a genuinely absent field requires more than that.
- Sheet: the first sheet, whatever it is named.

### What changed on 2026-08-18

| Change | Columns |
|---|---|
| **Added** | `UBS LP Classification` (previously derived), `LP Size ($ Bil)` + `LP Size Criteria`, `Agent Excess Concentration`, `UBS Excess Concentration` |
| **Removed** | `HQ` (High Quality), `InvestorType`, `Region`, `AUM` / `NAV` / `PensionAssets`, `FundingRatio` |

32 − 7 + 5 = 30. The three consequences that reach beyond the reader:

- **`classify_ubs` is gone from the extract.** The export states the UBS classification outright,
  and four of the attributes the waterfall keyed on are no longer carried, so deriving it is neither
  possible nor wanted — the LP DB is the system of record for this field. The extract only
  *normalizes* the fed label now (`ubs_lp_categories.csv`), reporting what it cannot match.
- **The agent advance rate is read from the export**, as it always was: `Agent Advance Rate`
  survived the reshuffle (it moved to sit directly after `UBS Advance Rate`) and the fed value is
  used as written. `agent_rate_map.csv` — mirroring `classification_config.AGENT_RATE_MAP` — is now
  only the fallback for a row whose rate cell is blank, resolved from that row's Agent LP Category.
- **`high_quality` left the feed entirely.** Nothing supplies it, so pe-sub-api keeps its column on
  the schema default (`TRUE`) rather than being fed a fabricated value. `LpMasterIngestRow.highQuality`
  is boxed for exactly this reason: as a primitive an absent field would deserialise to `false`,
  quietly flipping every LP out of the high-quality tier and firing the aggregate breach checks in
  `BbCalculationService` that key off it.

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
**each field is chosen independently by recency** (`build_master` / `_recent_first` / `_latest`):
the value from the most recent BB run that actually reported it. A blank on a newer row means "not
resubmitted this cycle", not "cleared", so the search falls through to the next-most-recent non-blank
value rather than letting a blank erase a known one. LP Size and its criteria are taken as a **pair**
from the same submission — a figure from one run with a measure label from another would mislabel the
number. Only stable golden fields are seeded — identity, ratings, financial scale, UBS credit
defaults; nothing per-facility or per-cycle. `ubs_default_advance_rate` is written as a **fraction**
(`0.9`). `high_quality` is not written at all, and `investor_type` / `region_location` /
`funding_ratio` go out blank (see §1).

The job clears the table before loading (`lpMasterClearStep` → SERVICE-gated
`POST /api/lp-master/clear`, which nulls `lp_records.lp_master_id` then deletes in batch), so a
re-run leaves no stale rows.

### `lp_facility_seeds.csv` — `SEED_COLS`
One row per (facility, investor), 32 columns, carrying **every per-LP export column**; only the
facility-level `AccountID`/`FndName`/`BBDate` are excluded. Row values are authoritative on seed —
the LP Master profile only fills fields a row left blank. `agent_advance_rate` / `ubs_advance_rate`
are written as **percent strings** (`90%`), money as exact short currency (`$484M`, `$314.6M` — no
rounding). `high_quality` is no longer a column; `agent_excess_concentration` /
`ubs_excess_concentration` were added with the 2026-08-18 format.

`lp_rates` is out of scope; the script never writes it.

## 4. Derived values

**UBS LP Category** (`ubs_lp_category`, on both master and seed rows) is **read from the export's
own `UBS LP Classification` column** and normalized against `ubs_lp_categories.csv` — still never
from `Agent LP Classification`, which is the **agent** LP Category. Unmatched labels are written
through as given and counted in the run's normalization report; blank stays blank. Before
2026-08-18 this was derived by a `classify_ubs` waterfall over ratings / pension assets / NAV / AUM /
HNW / SPV — that logic now lives in `lp_db_generate.py`, which needs it to emit a coherent sample,
and nowhere in the reader.

**LP Size.** `LP Size ($ Bil)` is a figure in **billions** (a bare `13.5` means $13.5bn — unlike the
old free-text AUM/NAV columns, where a bare number meant absolute dollars), and `LP Size Criteria`
names which measure it is. The extract routes the figure back into whichever of
`aum` / `nav` / `pension_assets` the criteria names (`AUM` → `aum`, `NAV` → `nav`,
`Assets` → `pension_assets`) and formats it as a display string (`$13.5B`). That keeps pe-sub-api's
contract and the UI's Size Measure derivation
(`aum ? 'AUM' : nav ? 'NAV' : pension_assets ? 'Assets'`) working unchanged. An unrecognised
criteria leaves all three blank rather than guessing a measure — the figure has no meaning without a
basis. When consolidating LP Master, the pair is taken from the most recent submission that actually
*resolves*, so one drifted criteria label does not blank an LP whose older rows state its size fine.

**Advance rates.** `UBSAR` is slotted into the discrete rate groups by the Floor Map
(`rate_floor_map.csv`): ≥ 90 → 90 · 75–89.9 → 75 · 65–74.9 → 65 · 50–64.9 → 50 · < 50 → 0.

The **agent** advance rate is read from the export's `Agent Advance Rate` column and used **as
written** — deliberately *not* floor-mapped. The Floor Map slots a rate into the *bank's* own
90/75/65/50/0 groups; the agent's schedule is not those groups, so flooring it would silently turn a
Designated Institutional 60% into 50%. Only a blank or unparseable cell falls back to the rate the
row's canonical Agent LP Category implies (`agent_rate_map.csv`); when the category is unrecognised
too, the row gets no rate at all (counted in the report) rather than a fabricated one.

**Excess concentration.** `Agent Excess Concentration` and `UBS Excess Concentration` are carried
through to the matching `lp_records` columns, the same way the two borrowing bases already are. The
Shadow BB engine remains server-authoritative; these are the agent-reported figures.

## 5. Reference lists (`pe-sub-jobs/data/reference/`)

Editable CSVs seeded from `classification_config`; keep them in sync with Config.

| File | Used for |
|---|---|
| `agent_lp_categories.csv` | export `Agent LP Classification` → `AGENT_CLS_OPTS` |
| `ubs_lp_categories.csv` | export `UBS LP Classification` → `UBS_CLS_OPTS` (**added 2026-08-18**, now that the column is fed rather than derived) |
| `agent_rate_map.csv` | Agent LP Category → agent advance rate, mirroring `AGENT_RATE_MAP`. The **fallback** for a row whose `Agent Advance Rate` cell is blank. Used as written, not floor-mapped |
| `rate_floor_map.csv` | the Floor Map rate groups (applied to `UBSAR`) |
| `bb_criteria_matrix.csv` | **not read by either script** — documents the taxonomy the labels come from |
| `investor_types.csv` + `investor_type_aliases.csv` | **no longer read by either script** — the Investor Type column left the export on 2026-08-18. Kept because they mirror `INVESTOR_TYPE_OPTS` for the platform |

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
- Rating presence follows the Agent LP Category, keeping the UBS mix near the real book's ~40%
  Rated and leaving unrated LPs to exercise the other branches.
- **`classify_ubs` lives here now**, not in the extract. The export states the UBS classification, so
  the generator has to produce one that is consistent with the row's other attributes — and it is the
  right place for the waterfall, because the generator knows the LP's truth while the reader only
  knows what it is told. It runs on the clean values, before chaos.
- **Excess concentration and the borrowing bases are computed together, after the per-facility
  totals are known**: a concentration limit is a fraction of the facility's *total* uncalled, so an
  LP's cap is `limit x total`, its excess is whatever its own uncalled exceeds that cap by, and each
  BB advances only on the uncalled that stays within the cap. The agent and UBS sides carry their own
  limits and so cut at different points on the same LP.
- Its `AGENT_CATEGORIES` rate is written to the export's `Agent Advance Rate` column *and* is what
  the generated Agent BB is computed with, so the file reconciles on its own terms. Keep the rates
  **in step with `data/reference/agent_rate_map.csv`** anyway: that map is the extract's fallback
  for a row whose rate cell is blank.
- `SRC_HEADERS` reproduces the real file's header spellings **including their quirks** (the CRLF
  inside `LP Size

($ Bil)`, the misspelt `Insitutional`, `Moody'S`), which is much of the point:
  a cleaned-up sample would not prove the reader copes. `SRC_COLS` (internal keys) must stay in step
  with the extract's — the extract requires all 29.

**Chaos monkey.** A clean simulated export is too clean to verify the extract's parsers, so the
degradation is applied to the values **written to the XLSX** — the extract never degrades anything
and treats whatever file it is given as source truth. Mutations follow the analyst "hierarchy of
care": sacred cash/identity columns (`CHAOS_SACRED`: AccountID, FndName, Commitments, Called,
Uncalled, BBDate, raw rates, BB values, percentages) are never touched; decision fields get
formatting and categorical drift (`A minus`, `Rated`, `PWM`, `Total AUM`); afterthought fields get
name suffix drops, ` - Tranche A`, case flips, and LP Size strings that argue with the column's $Bn
unit — ranges (`5 - 8`), thresholds (`>12`), spelled units (`13.5 bn`) and, the costly one, figures
typed in **millions** into a billions column. Chaos draws from its own rng,
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

The 30 columns of the 2026-08-18 format, in file order.

| # | Export header | Internal | Seed field |
|---|---|---|---|
| 1 | `AccountID` | `AccountID` | *(facility identity)* |
| 2 | `FndName` | `FndName` | *(facility name lookup)* |
| 3 | `Investor Name` | `InvestorName` | `investor_name` |
| 4 | `Parent` | `Parent` | `parent` |
| 5 | `SPV` | `SPV` | `spv` |
| 6 | `UBS LP Classification` | `UbsClassification` | `ubs_lp_category` (normalized) |
| 7 | `Insitutional vs HNW` *(sic)* | `InstitutionalHNW` | `institutional_or_hnw` |
| 8 | `Investment Grade?` | `InvestmentGrade` | `investment_grade` |
| 9 | `Agent LP Classification` | `Classification` | `agent_lp_category` (normalized) |
| 10–12 | `S&P` / `Moody'S` / `Fitch` | `SP` / `Moodys` / `Fitch` | `sp_rating` / `moodys_rating` / `fitch_rating` |
| 13 | `LP Size\r\n($ Bil)` *(embedded CRLF)* | `LpSizeBil` | `aum` **or** `nav` **or** `pension_assets`, per #14 |
| 14 | `LP Size Criteria` | `LpSizeCriteria` | *(routes #13)* |
| 15 | `Capital Commitments` | `Commitments` | `capital_commitment` |
| 16 | `Uncalled Capital` | `Uncalled` | `uncalled_capital` |
| 17 | `UBS Advance Rate` | `UBSAR` | `ubs_advance_rate` (Floor-Mapped) |
| 18 | `Agent Advance Rate` | `AgentAR` | `agent_advance_rate` (as fed; **not** floor-mapped) |
| 19 | `Agent Concentration Limit` | `AgentCL` | `agent_concentration_limit` |
| 20 | `UBS Concentration Limit` | `UBSCL` | `ubs_concentration_limit` |
| 21 | `% of Capital Commitments` | `PercentOfCommitments` | `pct_of_fund_commitments` |
| 22 | `Called Capital` | `Called` | `called_capital` |
| 23 | `% of Uncalled Capital` | `PercentOfUncalled` | `pct_of_fund_uncalled` |
| 24 | `% of LP Called` | `CalledPercent` | `pct_lp_called` |
| 25 | `Agent Excess Concentration` | `AgentExcessConc` | `agent_excess_concentration` |
| 26 | `UBS Excess Concentration` | `UBSExcessConc` | `ubs_excess_concentration` |
| 27 | `Agent Borrowing Base` | `AgentBB` | `agent_borrowing_base` |
| 28 | `UBS Borrowing Base` | `UBSBB` | `ubs_borrowing_base` |
| 29 | `Notes` | `Notes` | `notes` |
| 30 | `BBDate` | `BBDate` | *(facility `collateral_date`)* |

#18 is used as written: the floor map slots a UBS rate into the bank's own 90/75/65/50/0 groups, and
the agent's schedule is not those groups — flooring it would turn a Designated Institutional 60%
into 50%. A blank cell falls back to the rate #9's category implies (`agent_rate_map.csv`).

Seed fields with **no export column**: `investor_type` / `region_location` / `funding_ratio`, which
stay in the CSV header but are written blank — the API reads blank as "not resubmitted" and leaves any stored
value intact. `high_quality` is not a seed field at all any more.
