# Agent BB Workbook Structure: Blue Owl GP Stakes V (Goldman Sachs — Legacy)

**Template ID:** `gs-blue-owl`
**Template Class:** B — Full BB Schedule with per-row `Investor Type` column. Flat LP list (~900 LPs). No group-header sections. Single `Borrowing Base` tab.
**Agent Bank:** Goldman Sachs Bank USA *(prior administrative agent for Blue Owl GP Stakes V; replaced by Wells Fargo)*

---

## Workbook Layout

### Tabs

Single-tab workbook.

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `Borrowing Base` | 7 | 1 | Flat LP list, ~900 LPs; no LP category sections |

### Preamble / Summary Block

Rows 1–6 above the header row at row 7.
- **Row 1:** `Blue Owl GP Stakes V — Agent Borrowing Base Certificate` — fund/facility title anchor.
- **Row 3:** `Facility | Blue Owl GP Stakes V`
- **Rows 4–5:** As Of Date, Currency.

`summary_rows_above_header = 6`

### LP Category Group Sections *(LP_GRID tab)*

**None.** LP category is provided in the per-row **`Investor Type`** column (col B). There are no group-header banner rows.

`has_grouping_rows = false`

### Column Headers *(LP_GRID tab, row 7)*

| # | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|---|-------------------------|---------------------------|-------|
| 1 | `Investor Name (Agent Records)` | Investor Name | Primary LP identifier; "(Agent Records)" suffix differentiates from UBS master name |
| 2 | `Investor Type` | Agent LP Classification | Per-row LP category (Class B per-row logic) |
| 3 | `Commitment (USD)` | Capital Commitments | Total committed capital |
| 4 | `Uncalled Capital (USD)` | Uncalled Capital | Remaining callable capital |
| 5 | `AUM` | AUM | Assets under management (numeric or range) |
| 6 | `S&P` | S&P Rating | Agency rating |
| 7 | `Moody's` | Moody's Rating | Agency rating |
| 8 | `Fitch` | Fitch Rating | Agency rating |
| 9 | `Advance Rate` | Advance Rate | Agent advance rate (decimal) |
| 10 | `Borrowing Base Contribution` | Borrowing Base | LP BB contribution = Uncalled × Advance Rate |
| 11 | `Concentration Limit` | Concentration Limit | Per-LP concentration cap |
| 12 | `% Called` | % of LP Called | LP percentage called to date |
| 13 | `% of Borrowing Base` | % of Borrowing Base | LP's share of total facility BB |

> **Footer row:** A grand-total row appears at the end of the LP list. Detected and excluded by the `skip_row_keywords` filter (`Total`).

---

## Legend

No cell-format legend defined for this template. No delta-flag encoding.

---

## Recognition Signatures

- **Title anchor:** Row 1, contains `"Blue Owl GP Stakes V"` and `"Agent Borrowing Base Certificate"`.
- **Sheet name:** `Borrowing Base`
- **Agent bank detection:** `detectKeys` includes `"goldman sachs"` to distinguish this legacy GS format from the Wells Fargo format when the fund name alone is ambiguous.
- **Detection keys:** `goldman sachs`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | B |
| `has_grouping_rows` | false |
| `has_color_flags` | false |
| `tranche_count` | 1 |
| `summary_rows_above_header` | 6 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Goldman Sachs Bank USA | B | Borrowing Base | 6 | false | 1 | false | false | 6 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | Borrowing Base | 6 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row — no data rows)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
*(empty — no LP category group sections; Investor Type column drives categorisation)*
