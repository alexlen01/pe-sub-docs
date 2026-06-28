# BB Template Changes — June 28, 2026

## Purpose

Full audit of all 7 Agent BB workbook samples in `pe-sub-platform/public` against the existing
WORKBOOK_XXX.md docs, `templateProfiles.js`, and Flyway seed migrations. Corrections tracked here
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
| templateProfiles.js | `tabLabel: 'Investor List'` | Actual tabs are `Nerdio`, `Apptio`, `Marlin` | Update profiles |

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

| Item | Current Doc | templateProfiles.js | Actual Excel | Fix |
|------|-------------|---------------------|--------------|-----|
| LP category column | "LP Classification" | — | **"Investor Type"** | Fix WORKBOOK + profiles |
| Group headers | `has_grouping_rows = false` ✓ | **5 group headers listed** ← WRONG | Flat list, zero group headers | Remove group headers from profiles |
| Missing column | "Fitch" not listed | Not in columns list | **Fitch (col 7)** between Moody's and Advance Rate | Add Fitch to WORKBOOK + profiles |

**GS Blue Owl migration (V1_9) correctly has `has_grouping_rows = FALSE` and no group sections.
The templateProfiles.js has incorrect group headers — must be removed.**

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

| Item | Current Doc | templateProfiles.js | Current Migration (V1_3) | Actual Excel | Fix |
|------|-------------|---------------------|--------------------------|--------------|-----|
| Agent bank | TBD | `fund: 'JP Morgan'` — WRONG | `JP Morgan (KKR Ascendant Fund)` — WRONG | **KKR Capital Markets** | Fix template_name + profiles |
| Header row | 10 (1-based) ✓ | 10 ✓ | index 9 (0-based) ✓ | Row 10 confirmed ✓ | No change |

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

| Item | Current Doc / profiles.js | Actual Excel | Fix |
|------|--------------------------|--------------|-----|
| Title anchor | "Petershill Partners IV – Borrowing Base" / "Petershill IV … Borrowing Base (Proposed)" | **"Petershill IV and Petershill IV Offshore SCSp – Subscription Facility Borrowing Base"** | Fix detection text |
| Group 2 header | `"Inlcuded Investors (Non-Rated)"` (typo annotated) | **"Included Investors (Non-Rated)"** — NO TYPO | Fix; remove typo annotation |
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

## Implementation Plan

### Phase 1: WORKBOOK Docs
Update all 8 `WORKBOOK_XXX.md` files with ground-truth data.

### Phase 2: templateProfiles.js
- Fix `kkr-ascendant`: `fund` → `'KKR Capital Markets'`
- Fix `aep-vii`: `headerRow` → `10`
- Fix `gs-blue-owl`: remove group headers; fix column name; add Fitch
- Fix `petershill-iv`: title text; fix group 2 spelling; add `fund: 'Goldman Sachs Bank USA'`; add `Eligible Commitments` to skip keywords
- Fix `audax-vii`: tab info (Nerdio/Apptio/Marlin)
- Fix `ccp-vii-lev`: tab info (5 named feeder tabs); no in-tab group headers
- Fix `cp-vii`: tab label → `['BB - Onshore', 'BB - Offshore']`
- **Add `wf-blue-owl`** profile (currently missing entirely)

### Phase 3: Flyway Migration V1_13
Fix seeded data errors that affect runtime extraction:
1. AEP VII: `header_row_index` 10 → **9**; `summary_rows_above_header` 9 → **8**
2. KKR Ascendant: template_name `JP Morgan (KKR Ascendant Fund)` → **`KKR Capital Markets (KKR Ascendant Fund)`**
3. CP VII: template_name → **`Bank of America (CP VII)`**; tab `sheet_name` → **`BB - Onshore`**; add second tab **`BB - Offshore`**
4. WF Blue Owl: `D. Excluded Investors` classification → **`Ineligible Investors`**

### Phase 4: BBTemplates/index.jsx — Edit Template + Tab Management
- Add **Edit Template** panel (slide-in or inline expansion)
- Tab grid: add/remove/reorder tabs, edit `sheet_name`, `sleeve_name`, `header_row_index`, `header_row_span`, `skip_row_keywords`
- Group headers grid per tab: add/remove groups with `header_text` + `classification` dropdowns
- **Fund Sleeve mapping** panel: visual mapping of tab → sleeve name
- Wire to existing `PUT /api/bb-templates/{id}` endpoint

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `pe-sub-docs/WORKBOOK_AEP_VII.md` | Doc | Header row 10; summary 8; agent bank |
| `pe-sub-docs/WORKBOOK_AUDAX_VII.md` | Doc | Named tabs (Nerdio/Apptio/Marlin) |
| `pe-sub-docs/WORKBOOK_CCP_VII_LEV.md` | Doc | Named feeder tabs; no in-tab groups |
| `pe-sub-docs/WORKBOOK_CP_VII.md` | Doc | Agent bank BofA; tab names BB-Onshore/Offshore |
| `pe-sub-docs/WORKBOOK_GS_BLUE_OWL.md` | Doc | "Investor Type" col; no group headers; add Fitch |
| `pe-sub-docs/WORKBOOK_KKR_ASCENDANT.md` | Doc | Agent bank KKR Capital Markets |
| `pe-sub-docs/WORKBOOK_PETERSHILL.md` | Doc | Title text; no typo in group 2; Eligible Commitments skip |
| `pe-sub-docs/WORKBOOK_WF_BLUE_OWL.md` | Doc | Note no sample file; fix classification |
| `pe-sub-platform/src/data/templateProfiles.js` | Frontend | All template fixes + wf-blue-owl added |
| `pe-sub-api/.../V1_13__bb_template_corrections.sql` | Migration | AEP VII, KKR, CP VII, WF Blue Owl data fixes |
| `pe-sub-platform/src/screens/BBTemplates/index.jsx` | Frontend | Edit Template + tab/sleeve management UI |
