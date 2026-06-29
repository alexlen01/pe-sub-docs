# BB Template Changes — June 28, 2026

## Purpose

Full audit of all 7 Agent BB workbook samples in `pe-sub-platform/public` against the existing
WORKBOOK_XXX.md docs, `templateProfiles.ts`, and Flyway seed migrations. Corrections tracked here
before implementation. All row numbers are **1-based Excel rows** unless noted as `0-based index`.

---

## Ground-Truth Extraction (parsed from actual .xlsx files)

Each file was parsed using the `xlsx` Node library to read cell values across all columns and rows.

---

## Template-by-Template Findings

### 1. AEP VII — `Agent-BB-AEP-VII.xlsx`

**Sheet:** `BB` (single tab ✓)

**Confirmed structure from Excel:**
- R2: `AURORA EQUITY PARTNERS VII LP` — title anchor ✓
- R3: `Agent Bank | JPMorgan Chase Bank, N.A.` — **agent bank confirmed**
- R4–R9: Summary block (As Of Date, Currency, Total Investors, Total Commitment, Funded/Unfunded)
- **R10: Column header row** — `Investor | Moody's | S&P | Net Worth | Total Commitment | Funded Commitment | Unfunded Commitment | % Total Unfunded Commitment | Concentration Limit | Excess Concentration | Eligible Unfunded Commitment | Advance Rate`
- R11: `Rated Included Investors` (first group header)
- R23: `Non-Rated Included Investors`
- R35: `Designated Investors`
- R47: `Excluded Investors`
- R60–R64: Legend block (Green/Yellow shading, Blue text, Underlined text)

**Bugs found:**

| Item | Current Doc | Current Migration (V1_6) | Actual Excel | Fix |
|------|-------------|--------------------------|--------------|-----|
| Header row | 11 (1-based) | index 10 (0-based → Excel row 11) | **Row 10** (1-based) | header_row = 10, index = **9** |
| summary_rows_above_header | 9 | 9 | Rows 2–9 = **8 rows** | → **8** |
| Agent bank | TBD | `JP Morgan (AEP VII)` | JPMorgan Chase Bank, N.A. | ✓ close enough; confirm naming |

**Columns (12, no Borrowing Base column — confirmed):** ✓ all match WORKBOOK

---

### 2. Audax Fund VII — `Agent-BB-Audax-Fund-VII.xlsx`

**Sheets:** `Nerdio`, `Apptio`, `Marlin` ← **actual tab names, NOT "Investor List"**

**Confirmed structure (each tab):**
- R4: `Deal Name:` (col A) | `<borrower name>` (col B)
- R9: `Borrowers:`
- R10: Borrower entity name
- **R13: Column header row** — `Transferred From | Investor | Borrowing Partnership | GA ID | Included/Excluded Investor | Capital Commitments | Unfunded Commitment | % Included Unfunded Commitment | Concentration Limit | Excess Concentration | Post-CL Unfunded Commitment | Pre-Adjustment Borrowing Base Contribution | Borrowing Base Adjustment`
- R14: First LP

**Bugs found:**

| Item | Current Doc | Actual Excel | Fix |
|------|-------------|--------------|-----|
| Tab names | "Investor List" (generic pattern) | **Nerdio, Apptio, Marlin** (exact names) | Update WORKBOOK + profiles |
| V1_12 migration | Uses Nerdio/Apptio/Marlin ✓ | Matches | Migration is correct |
| templateProfiles.ts | `tabLabel: 'Investor List'` | Actual tabs are `Nerdio`, `Apptio`, `Marlin` | Update profiles |

**Header row 13 (1-based) = index 12 (0-based) — migration V1_4 has 12 ✓**

---

### 3. CCP VII Lev M & M — `Agent-BB-CCP-VII-Lev-M-and-M.xlsx`

**Sheets:** `Levered (DE) Feeder` | `(Cayman) Feeder, L.P.` | `(Delaware) Feeder, L.P.` | `Lux Intermediate` | `Lux Non-Treaty Feeder`

**Critical finding:** The tabs ARE the feeder groups — there are NO in-tab group header rows.

**Confirmed structure (each tab):**
- R3: `Comvest Credit Partners VII, LP.` — title anchor ✓
- R4–R6: blank
- **R7: Column header** — `Investor Name | Excluded | Defaulting? | Claimed/Exercised Rights? | Committed Capital | Recallable Distribution | Remaining Callable Capital | Concentration Limit`
- R8: First LP
- Last row: `Total — <tab name>` (subtotal)

**Bugs found:**

| Item | Current Doc | Actual Excel | Fix |
|------|-------------|--------------|-----|
| Tab names | "Investor List" (each tab) | 5 named feeder tabs | Update WORKBOOK + profiles |
| Group headers (in-tab) | 5 feeder group headers per tab | **NONE** — no in-tab group rows | `has_grouping_rows = false` |
| Tab name #1 | "Levered (Delaware) Feeder" | **"Levered (DE) Feeder"** | Fix in WORKBOOK |
| auto_discover_tabs | Not in original WORKBOOK | V1_12 sets TRUE ✓ | Add to WORKBOOK |

**Header row 7 (1-based) = index 6 (0-based) — need to verify V1_5 migration.**

---

### 4. CP VII (Carlyle Partners VII) — `Agent-BB-CP-VII.xlsx`

**Sheets:** `BB - Onshore`, `BB - Offshore` ← **actual tab names, NOT "BB"**

**Confirmed structure:**
- **R1:** `Carlyle Partners VII — Borrowing Base Certificate` (col A) — early title at top
- **R2:** `Agent Bank | Bank of America, N.A.` — **agent bank confirmed**
- R3: `As Of Date | 31 May 2026`
- R5: `Series / Sleeve | BB - Onshore`
- R83: `Carlyle Partners VII` — secondary section title (deep-sheet anchor)
- **R84:** Stacked header row 1 (contains partial labels: "of Eligible", "of All", etc. in cols C–D)
- **R85:** Stacked header row 2 (main labels): `Investor | Total Capital Commitments | % of Eligible Commitments | % of All Commitments | Contributions Called to Date | Unfunded Commitment | Excess Concentration % | Excess Concentration | Eligible Contribution | Advance Rate | Availability`
- R86: First LP

**Bugs found:**

| Item | Current Doc | Current Migration (V1_7) | Actual Excel | Fix |
|------|-------------|--------------------------|--------------|-----|
| Tab names | "BB" | `sheet_name = 'BB'` | **"BB - Onshore", "BB - Offshore"** | Fix tab names |
| Agent bank | TBD | **`Silicon Valley Bank (CP VII)`** — WRONG | **Bank of America, N.A.** | Fix template_name → `Bank of America (CP VII)` |
| Header row span | rows 84–85 | index 83, span=2 ✓ | Rows 84–85 confirmed ✓ | No change needed |

**Note:** Early title at R1 should be added as alternative recognition anchor in WORKBOOK.

---

### 5. Blue Owl GP Stakes V (GS Format) — `Agent-BB-Blue-Owl-GP-Stakes-V.xlsx`

**Sheet:** `Borrowing Base` (single tab ✓)

**Confirmed structure:**
- R1: `Blue Owl GP Stakes V — Agent Borrowing Base Certificate` ✓
- R3: `Facility | Blue Owl GP Stakes V`
- R4: `As Of Date | 31 May 2026`
- R5: `Currency | USD`
- R6: blank
- **R7: Column header** — `Investor Name (Agent Records) | Investor Type | Commitment (USD) | Uncalled Capital (USD) | AUM | S&P | Moody's | Fitch | Advance Rate | Borrowing Base Contribution | Concentration Limit | % Called | % of Borrowing Base`
- R8: First LP (flat list, ~900 LPs, **NO group header rows**)

**Bugs found:**

| Item | Current Doc | templateProfiles.ts | Actual Excel | Fix |
|------|-------------|---------------------|--------------|-----|
| LP category column | "LP Classification" | — | **"Investor Type"** | Fix WORKBOOK + profiles |
| Group headers | `has_grouping_rows = false` ✓ | **5 group headers listed** ← WRONG | Flat list, zero group headers | Remove group headers from profiles |
| Missing column | "Fitch" not listed | Not in columns list | **Fitch (col 7)** between Moody's and Advance Rate | Add Fitch to WORKBOOK + profiles |

**GS Blue Owl migration (V1_9) correctly has `has_grouping_rows = FALSE` and no group sections.
The templateProfiles.ts has incorrect group headers — must be removed.**

---

### 6. KKR Ascendant Fund — `Agent-BB-KKR-Ascendant-Fund.xlsx`

**Sheet:** `Borrowing Base` (single tab ✓)

**Confirmed structure:**
- R2: `KKR Ascendant – Borrowing Base` ✓
- R3: `Agent Bank | KKR Capital Markets` — **agent bank confirmed**
- R4: `Facility | KKR Ascendant Fund`
- R5–R8: Total Investors, Total Unfunded, Eligibility Basis, Prepared By
- R9: blank
- **R10: Column header** — `Investor | Fund Sleeve | Moody's | S&P | Net Worth | Total Commitment | Funded Commitment | Unfunded Commitment | % Total Unfunded Commitment | Concentration Limit | Eligible Unfunded Commitment | Advance Rate | Borrowing Base` (13 cols)
- R11: `Rated Included Investors` (first group header)
- Group headers confirmed: Rated Included (R11), Non-Rated Included (R21), Designated (R31), Borrowing Base Investors (R41), Hurdle Investors (R51), Excluded (R61) ✓

**Bugs found:**

| Item | Current Doc / profiles.ts | Actual Excel | Fix |
|------|--------------------------|--------------|-----|
| Agent bank | `fund: 'JP Morgan'` — WRONG | **KKR Capital Markets** | Fix template_name + profiles |
| Header row | 10 (1-based) ✓ | index 9 (0-based) ✓ | Row 10 confirmed ✓ | No change |

---

### 7. Petershill IV — `Agent-BB-Petershill IV.xlsx`

**Sheet:** `Borrowing Base` (single tab ✓)

**Confirmed structure:**
- **R2:** `Petershill IV and Petershill IV Offshore SCSp – Subscription Facility Borrowing Base` — **DIFFERENT from all docs!**
- R4–R9: Summary block (Borrowing Base, Eligible/Total Remaining Commitments, Total Original Commitments, Effective Advance Rate, Apply Concentration Limits)
- **R11: Column header** — `Deal Investor Name | Investor S&P | Investor Moody | NAV Range (USD) | Original Commitment | Unfunded Capital Commitment | % Called | % of Unfunded Commitment | % of Eligible Unfunded Commitment | Concentration Limit | Excess Concentration | Eligible Commitment | Advance Rate | Borrowing Base Contribution | % of Borrowing Base` ✓
- R13: `Included Investors (Rated)` (first group header)
- R44: `Included Investors (Non-Rated)` ← **NO TYPO — "Included" is spelled correctly!**
- R59: `Institutional Designated Investors` ✓
- R76: `PWM Designated Investors` ✓
- R81: `Eligible Commitments` ← separator subtotal (must be in skip_row_keywords!)
- R83: `Excluded Investors` ✓

**Bugs found:**

| Item | Current Doc / profiles.ts | Actual Excel | Fix |
|------|--------------------------|--------------|-----|
| Title anchor | "Petershill Partners IV – Borrowing Base" / "Petershill IV … Borrowing Base (Proposed)" | **"Petershill IV and Petershill IV Offshore SCSp – Subscription Facility Borrowing Base"** | Fix detection text |
| Group 2 header | `"Included Investors (Non-Rated)"` (typo annotated) | **"Included Investors (Non-Rated)"** — NO TYPO | Fix; remove typo annotation |
| Skip keywords | Not including "Eligible Commitments" | R81 is a mid-table separator subtotal | Add `Eligible Commitments` to skip_row_keywords |
| fund field | `fund: 'Petershill IV'` in profiles | Agent bank = Goldman Sachs Bank USA | Fix to `fund: 'Goldman Sachs Bank USA'` |

---

### 8. Wells Fargo Blue Owl — No Sample File

**No `Agent-BB-WF-Blue-Owl-*.xlsx` file exists in `pe-sub-platform/public`.**

The WORKBOOK_WF_BLUE_OWL.md and V1_8 migration are based on prior analysis only (not a direct
parse of a current sample). Verified from migration:
- Classification for `D. Excluded Investors` → migration uses `'Excluded'` but WORKBOOK says `Ineligible Investors`
- Need to standardize: **`Ineligible Investors`** aligns with other templates' classification for excluded sections

---

## Migration Cleanup — 2026-06-28

All BB template seed data removed from migration files as part of the June 28 overhaul:

| Migration | Action | Reason |
|-----------|--------|--------|
| V1_3 through V1_10 | **Cleared** (stub comment only) | Wrong agent banks, wrong tab names, wrong header rows, schema gaps |
| V1_12 | **Cleared** (stub comment only) | Multi-tab data dependent on cleared V1_3–V1_10 rows |
| V1_1, V1_2, V1_11, V1_13 | **Untouched** | DDL schema, field mapping seed, schema ALTER TABLE, UI config |

Templates will be re-seeded one at a time via `V1_14+` after schema extension (see Phase 2 below).

---

## Solution Design — Template Recognition Overhaul

### Background: Prototype vs. DB Schema Gap

The `pe-sub-platform` prototype (`BBTemplates/index.jsx` + `data/templateProfiles.ts`) was built
after re-evaluation of the 7 Agent BB workbook samples. It uses a **significantly richer data model**
than what the DB schema currently stores. The prototype treats `TemplateProfile` as the source of truth
for both recognition and display. The DB schema must be extended to match before re-seeding.

### Prototype TemplateProfile Fields vs. Current DB Schema

| TemplateProfile field | Type | In `bb_templates` table? | In `bb_template_tabs` table? | Action |
|-----------------------|------|--------------------------|------------------------------|--------|
| `id` (kebab slug) | `string` | ✗ — only numeric `id` | — | Add `template_slug VARCHAR(50) UNIQUE` to `bb_templates` |
| `fund` (agent bank name) | `string` | ✓ via `template_name` | — | Map `template_name` → rename to `agent_name`; or add `agent_name` column |
| `workbook.tabs` | `'single'`\|`'multiple'` | Derivable from tab count | — | Derive; no column needed |
| `workbook.tabLabel` | `string` | ✗ | ✓ via `sheet_name` | Map to `bb_template_tabs.sheet_name`; update prototype to use array |
| `title.row` | `number` | ✗ | — | Add `title_row INTEGER` to `bb_templates` |
| `title.text` | `string` | ✗ | — | Add `title_text TEXT` to `bb_templates` |
| `summaryRows` | `string` (e.g. `"2-9"`) | Partial: `summary_rows_above_header INTEGER` | — | Replace with `summary_row_range VARCHAR(20)` |
| `headerRow` | `number`\|`string` (e.g. `"84-85"`) | ✓ via `header_row_index` | ✓ via `header_row_index` + `header_row_span` | Existing fields are sufficient; stacked = index + span > 1 |
| `groupHeaders[]` | `string[]` | ✗ direct | ✓ via `bb_template_groups.header_text` | Existing join covers this |
| `columns[]` | `string[]` — ordered column names | ✗ | ✗ | Add `columns JSONB` to `bb_template_tabs` |
| `legend[]` | `{style, meaning}[]` | ✗ | ✗ | Add `legend JSONB` to `bb_templates` |
| `notes[]` | `string[]` | ✗ | ✗ | Add `notes JSONB` to `bb_templates` |
| `detectKeys[]` | `string[]` | ✗ | ✗ | Add `detect_keys JSONB` to `bb_templates` |

### Phase 1 — Schema Extension (V1_14)

```sql
-- New recognition and display fields on bb_templates
ALTER TABLE bb_templates
    ADD COLUMN IF NOT EXISTS template_slug    VARCHAR(50)  UNIQUE,
    ADD COLUMN IF NOT EXISTS agent_name       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS title_row        INTEGER,
    ADD COLUMN IF NOT EXISTS title_text       TEXT,
    ADD COLUMN IF NOT EXISTS summary_row_range VARCHAR(20),
    ADD COLUMN IF NOT EXISTS detect_keys      JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS legend           JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS notes            JSONB NOT NULL DEFAULT '[]';

-- Ordered column names per tab (drives ExtractionPreview column list)
ALTER TABLE bb_template_tabs
    ADD COLUMN IF NOT EXISTS columns JSONB NOT NULL DEFAULT '[]';
```

### Phase 2 — Template Re-seeding (V1_15 through V1_22, one per template)

One migration per template, authored after confirming ground-truth from the WORKBOOK file.
Each migration must set ALL new fields added in V1_14.

Order: KKR Ascendant → AEP VII → GS Blue Owl → Petershill IV → Audax Fund VII → CCP VII Lev → CP VII → WF Blue Owl

---

## Template Recognition Design

### Recognition Signal Hierarchy

The extraction engine evaluates signals in priority order, stopping at the first confident match:

| Priority | Signal Type | Confidence | Notes |
|----------|-------------|------------|-------|
| 1 | **Filename keyword match** | Very High | Most reliable when files follow naming convention |
| 2 | **Exact named tab presence** | Very High | Unique tab names (Nerdio/Apptio/Marlin) are fund-specific |
| 3 | **Title anchor text** at known row | High | Fund name in cell R1–R4 is unique per template |
| 4 | **Agent bank cell** (R2–R3 typically) | High | Disambiguates same-fund / different-agent scenarios |
| 5 | **Column header profile match** | Medium | Jaro-Winkler ≥ 0.95 against known column sets; use as tiebreaker |

### Per-Template Recognition Specification

| Template ID | Filename Signal | Named Tab Signal | Title Anchor | Agent Bank Cell | Column Fingerprint | Skip Row Keywords |
|-------------|----------------|-----------------|--------------|-----------------|-------------------|-------------------|
| `kkr-ascendant` | `*KKR*Ascendant*` | Single: `Borrowing Base` | R2: `KKR Ascendant – Borrowing Base` | R3 col B: `KKR Capital Markets` | `Fund Sleeve` col unique to this template | `Rated Included Investors`, `Non-Rated Included Investors`, `Designated Investors`, `Borrowing Base Investors`, `Hurdle Investors`, `Excluded Investors`, `Total`, `Subtotal` |
| `aep-vii` | `*AEP*VII*` | Single: `BB` | R2: `AURORA EQUITY PARTNERS VII LP` | R3 col B: `JPMorgan Chase Bank, N.A.` | No `Fund Sleeve` col; has `Eligible Unfunded Commitment` | `Rated Included Investors`, `Non-Rated Included Investors`, `Designated Investors`, `Excluded Investors`, `Total`, `Subtotal` |
| `audax-vii` | `*Audax*Fund*VII*` | Multiple — any tab named exactly `Nerdio`, `Apptio`, or `Marlin` | R4 col A: `Deal Name:` (label); R4 col B: borrower name | — not present | `GA ID`, `Borrowing Partnership`, `Included/Excluded Investor` columns | `Total`, `Subtotal`, `Grand Total` |
| `ccp-vii-lev` | `*CCP*VII*Lev*` | Multiple — tab names contain `Feeder` or `Lux`; auto-discover mode | R3 col A: `Comvest Credit Partners VII` | — not present | `Defaulting?`, `Claimed/Exercised Rights?`, `Recallable Distribution` columns | `Total`, `Subtotal`, `Total —` |
| `cp-vii` | `*CP*VII*` | Multiple — tabs named exactly `BB - Onshore` and `BB - Offshore` | R1 col A: `Carlyle Partners VII` (early) + R83: `Carlyle Partners VII` (deep) | R2 col B: `Bank of America, N.A.` | Stacked header (rows 84–85); `Availability` column unique | `Total`, `Subtotal`, `Grand Total` |
| `gs-blue-owl` | `*Blue*Owl*GP*Stakes*` or `*Blue*Owl*GP*V*` | Single: `Borrowing Base` | R1 col A: `Blue Owl GP Stakes V` | — not explicit in title row | `Investor Type`, `Fitch` columns; ~900 LP flat list | `Total`, `Subtotal` |
| `petershill-iv` | `*Petershill*IV*` | Single: `Borrowing Base` | R2 col A: `Petershill IV and Petershill IV Offshore SCSp` | — not in title; GS is agent but not identified in header cells | `Deal Investor Name`, `NAV Range (USD)`, `% of Borrowing Base` columns | `Included Investors (Rated)`, `Included Investors (Non-Rated)`, `Institutional Designated Investors`, `PWM Designated Investors`, `Excluded Investors`, `Eligible Commitments`, `Total`, `Subtotal` |
| `wf-blue-owl` | `*WF*Blue*Owl*` or `*Wells*Fargo*Blue*Owl*` | TBD — no sample file | TBD | Wells Fargo | TBD | TBD |

### Disambiguation: GS Blue Owl vs. Petershill IV vs. KKR Ascendant

All three use a single tab named `Borrowing Base`. Disambiguation sequence:
1. Filename keyword → fastest, most reliable
2. R1/R2 title text → fund name is unique per template
3. Column presence: `Deal Investor Name` = Petershill; `Fund Sleeve` = KKR; `Investor Type` + `Fitch` = GS Blue Owl

### Disambiguation: Audax Fund VII tabs vs. CCP VII tabs (both multi-tab)

| Signal | Audax Fund VII | CCP VII Lev |
|--------|---------------|-------------|
| Tab names | Exact: Nerdio, Apptio, Marlin | Contain "Feeder" or "Lux" |
| Title cell | R4 col A: `Deal Name:` | R3 col A: `Comvest Credit Partners VII` |
| Column: R7/R13 | `GA ID`, `Borrowing Partnership` | `Defaulting?`, `Claimed/Exercised Rights?` |
| Auto-discover | FALSE (tabs named exactly) | TRUE (tab names vary per workbook) |

### Operator Override

When auto-detection picks the wrong template (or detection confidence is below threshold),
the operator selects the correct template from a dropdown in the ExtractionPreview UI.
The selection is stored in `submission_extractions.forced_template` and applied on all
subsequent re-extractions of the same submission.

---

## Structural Changes Required in `bb_template_tabs`

The prototype treats **multiple LP_GRID tabs** (Audax Fund VII: Nerdio/Apptio/Marlin) as
**named sleeve tabs** — each has its own `sheet_name`, `sleeve_name`, and `columns`.

The current schema constraint `uq_template_tab_sort` (added V1_11) supports multiple LP_GRID rows
per template. V1_14 adds `columns JSONB` to each tab row, so column order is tab-specific.

For CCP VII with `auto_discover_tabs = TRUE`, the single LP_GRID tab row acts as a
**header template** — it supplies `header_row_index`, `header_row_span`, and `columns`
that the engine applies to every discovered sheet.

---

## BBTemplates Screen — Prototype vs. pe-sub-ui Comparison

The prototype `BBTemplates/index.jsx` renders a richer registry than `pe-sub-ui/src/screens/BBTemplates/index.tsx`:

| Feature | Prototype (pe-sub-platform) | pe-sub-ui |
|---------|-----------------------------|-----------|
| Table columns | Template ID, Agent/Fund, Workbook Tabs, Tab Label, Header Row, # Cols, # Groups, Notes | Fetches from `/api/bb-templates` — no dedicated columns list |
| Detail panel | Columns Extracted (numbered list), LP Category Group Headers, Cell Format Legend, Notes, Structure metadata | None |
| Edit button | **None** — read-only registry | None |
| Import button | Present (not wired) | None |
| Template ID display | kebab slug (`kkr-ascendant`) | Numeric DB id |

The prototype design is the **target state**. `pe-sub-ui/BBTemplates` needs a rebuild to match it
once the V1_14 schema is in place and `/api/bb-templates` returns the new fields.

---

## Files Changed — June 28 Session

| File | Change |
|------|--------|
| `pe-sub-api/.../V1_3` through `V1_10` | **Cleared** — BB template INSERTs removed |
| `pe-sub-api/.../V1_12` | **Cleared** — Multi-tab template INSERTs removed |
| `pe-sub-docs/BB_TEMPLATE_CHANGES_JUNE_28.md` | Added: Migration Cleanup section, Solution Design, Recognition Specification, Schema Gap analysis |

## Pending Work (next session)

| Step | Migration | Description |
|------|-----------|-------------|
| 1 | V1_14 | Schema extension: add `template_slug`, `agent_name`, `title_row`, `title_text`, `summary_row_range`, `detect_keys`, `legend`, `notes` to `bb_templates`; add `columns` to `bb_template_tabs` |
| 2 | V1_15 | Re-seed KKR Ascendant Fund (correct agent: KKR Capital Markets) |
| 3 | V1_16 | Re-seed AEP VII (correct header_row=9, summary_rows=8, agent: JPMorgan Chase Bank N.A.) |
| 4 | V1_17 | Re-seed GS Blue Owl (flat list, no group headers, add Fitch, Investor Type) |
| 5 | V1_18 | Re-seed Petershill IV (correct title, correct group header spellings, Eligible Commitments skip) |
| 6 | V1_19 | Re-seed Audax Fund VII (3 named sleeve tabs: Nerdio/Apptio/Marlin) |
| 7 | V1_20 | Re-seed CCP VII Lev M & M (5 named feeder tabs, auto_discover=TRUE, no in-tab groups) |
| 8 | V1_21 | Re-seed CP VII (correct agent: Bank of America, tabs: BB - Onshore / BB - Offshore) |
| 9 | V1_22 | Re-seed WF Blue Owl (pending sample file; use best-effort from WORKBOOK_WF_BLUE_OWL.md) |
| 10 | — | Update `pe-sub-platform/src/data/templateProfiles.ts` with all ground-truth fixes |
| 11 | — | Update `pe-sub-ui/src/screens/BBTemplates/index.tsx` to match prototype registry design |
| 12 | — | Update `pe-sub-extraction` TemplateDetector to use `detect_keys` + `title_text` from DB |
