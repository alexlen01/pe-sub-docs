# Agent BB Workbook Structure: Audax Fund VII

**Template ID:** `audax-vii`
**Template Class:** B — Full BB Schedule with per-row `Included/Excluded Investor` column; no group-header classification rows. Multiple named tabs, one per borrower entity.
**Agent Bank:** Silicon Valley Bank

---

## Workbook Layout

### Tabs

This is a **multi-tab workbook**. One tab exists per borrower entity. Each tab is **named after the borrower company**, not a generic label.

| Role | Sort | Sheet Name (verbatim) | Sleeve Name | Header Row | Header Span | Notes |
|------|------|----------------------|-------------|------------|-------------|-------|
| LP_GRID | 1 | `Nerdio` | Nerdio | 13 | 1 | Borrower: Audax DL VII (Cayman), L.P. |
| LP_GRID | 2 | `Apptio` | Apptio | 13 | 1 | Borrower: Audax DL VII (Levered), L.P. |
| LP_GRID | 3 | `Marlin` | Marlin | 13 | 1 | Borrower entity varies per workbook |

> **Tab naming convention:** Tabs are named for the borrower company (Nerdio, Apptio, Marlin), not with a generic "Investor List" label. The V1_12 migration seeds exactly these three named sleeves.

### Preamble Block

Rows 1–12 precede the header row on each tab:
- **Row 4:** `Deal Name:` (col A) / `<company name>` (col B) — identifies the borrower for this tab.
- **Row 9:** `Borrowers:` label
- **Row 10:** Borrower entity name (e.g. `Audax DL VII (Cayman), L.P.`)

`summary_rows_above_header = 0`

### LP Category Group Sections *(LP_GRID tab)*

None. LP inclusion/exclusion is determined by the per-row **`Included/Excluded Investor`** column, not by group-header rows. `has_grouping_rows = false`.

### Column Headers *(LP_GRID tab, row 13)*

| # | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|---|-------------------------|---------------------------|-------|
| 1 | `Transferred From` | — | Transfer origin LP name; no canonical home |
| 2 | `Investor` | Investor Name | Primary LP identifier |
| 3 | `Borrowing Partnership` | — | Structural entity; no canonical home |
| 4 | `GA ID` | — | Internal reference code (like OX code); no canonical home |
| 5 | `Included/Excluded Investor` | Eligibility Flag | `Included` / `Excluded` determines LP eligibility (Class B per-row logic) |
| 6 | `Capital Commitments` | Capital Commitments | Total committed capital |
| 7 | `Unfunded Commitment` | Uncalled Capital | Remaining callable capital |
| 8 | `% Included Unfunded Commitment` | % of Eligible Uncalled | LP share of eligible uncalled pool |
| 9 | `Concentration Limit` | Concentration Limit | Per-LP concentration cap |
| 10 | `Excess Concentration` | Excess Concentration | Dollar overage above per-LP cap |
| 11 | `Post-CL Unfunded Commitment` | Eligible Commitment | Uncalled after concentration haircut (derived) |
| 12 | `Pre-Adjustment Borrowing Base Contribution` | Borrowing Base | BB before adjustment |
| 13 | `Borrowing Base Adjustment` | — | Manual override/adjustment amount; no canonical home |

---

## Legend

No cell-format legend defined for this template.

---

## Recognition Signatures

- **Title anchor:** Row 4, col A = `"Deal Name:"` — pattern match; borrower name in col B.
- **Tab detection:** Any tab where row 4 col A contains "Deal Name:" is a valid LP_GRID sleeve.
- **Detection keys:** `audax`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | B |
| `has_grouping_rows` | false |
| `has_color_flags` | false |
| `tranche_count` | 3 *(Nerdio + Apptio + Marlin)* |
| `summary_rows_above_header` | 0 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Silicon Valley Bank (Audax Fund VII) | B | Nerdio | 12 | false | 3 | false | false | 0 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | sleeve_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|---|
| LP_GRID | 1 | Nerdio | Nerdio | 12 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 2 | Apptio | Apptio | 12 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 3 | Marlin | Marlin | 12 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row — no data rows; no group sections)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
*(empty — no LP category group sections)*
