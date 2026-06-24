# Agent BB Workbook Structure: Audax Fund VII

**Template ID:** `audax-vii`
**Template Class:** B — Full BB Schedule with per-row `Included/Excluded Investor` column; no group-header classification rows. Multiple tabs, one per borrower entity.
**Agent Bank (placeholder):** Audax Fund VII *(update to real agent bank when facility is onboarded)*

---

## Workbook Layout

### Tabs

This is a **multi-tab workbook**. One `Investor List` sheet exists per borrower entity (e.g. one tab per deal/borrower). Each tab carries the same column structure.

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `Investor List` | 13 | 1 | Repeat pattern — one tab per borrower |

> **Note:** The sheet name `Investor List` is shared across tabs. The extraction engine should target the first matching tab or aggregate across all matching tabs depending on the multi-tab aggregation mode (deferred).

### Preamble Block

Rows 1–12 precede the header row. Key metadata rows:
- **Row 4:** `Deal Name: <borrower>` — identifies the borrower/deal for this tab.
- **Rows 9–10:** Borrower entity listing (two borrower rows).

`summary_rows_above_header = 0` *(preamble is dealt with by title anchor detection, not summary-row skipping)*

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

- **Title anchor:** Row 4, contains `"Deal Name:"` followed by the borrower name.
- **Detection strategy:** Match `"Deal Name:"` pattern in row 4 of any sheet named `Investor List`.
- **Detection keys:** `audax`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | B |
| `has_grouping_rows` | false |
| `has_color_flags` | false |
| `tranche_count` | 1 *(each borrower tab extracted independently; set to number of active tabs at ingest time)* |
| `summary_rows_above_header` | 0 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Audax Fund VII | B | Investor List | 13 | false | 1 | false | false | 0 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | Investor List | 13 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row — no data rows; no group sections)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
*(empty — no LP category group sections)*
