# Agent BB Workbook Structure: KKR Ascendant Fund

**Template ID:** `kkr-ascendant`
**Template Class:** A — Full BB Schedule, group-header classification, numerical ratings, advance rates per LP section.
**Agent Bank (placeholder):** KKR Ascendant Fund *(update to real agent bank when facility is onboarded)*

---

## Workbook Layout

### Tabs

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `Borrowing Base` | 10 | 1 | Single-tab workbook |

### Preamble / Summary Block

Rows 2–9 (8 rows above the header) contain facility-level summary fields:
title, facility totals, advance-rate summaries. The extraction engine skips these rows before parsing LP records. `summary_rows_above_header = 8`.

### LP Category Group Sections *(LP_GRID tab)*

| Sort | Section Header Text (verbatim) | Canonical LP Classification |
|------|--------------------------------|-----------------------------|
| 1 | `Rated Included Investors` | Rated Included |
| 2 | `Non-Rated Included Investors` | Non-Rated Included |
| 3 | `Designated Investors` | Designated Institutional |
| 4 | `Borrowing Base Investors` | Non-Rated Included *(provisional — confirm with agent)* |
| 5 | `Hurdle Investors` | Non-Rated Included *(provisional — confirm with agent)* |
| 6 | `Excluded Investors` | Ineligible Investors |

Each group header row is followed by LP rows, then a subtotal row. Subtotal rows are caught by the default `skip_row_keywords` (`Total`, `Subtotal`, `Sub-Total`, etc.) and discarded.

### Column Headers *(LP_GRID tab, row 10)*

| # | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|---|-------------------------|---------------------------|-------|
| 1 | `Investor` | Investor Name | Primary LP identifier |
| 2 | `Fund Sleeve` | — | Structural — feeder/vehicle reference; no canonical home |
| 3 | `Moody's` | Moody's Rating | Agency rating |
| 4 | `S&P` | S&P Rating | Agency rating |
| 5 | `Net Worth` | AUM | Used as scale qualifier; may be AUM or NAV depending on LP type |
| 6 | `Total Commitment` | Capital Commitments | Total committed capital |
| 7 | `Funded Commitment` | Called Capital | Capital drawn to date |
| 8 | `Unfunded Commitment` | Uncalled Capital | Remaining callable capital |
| 9 | `% Total Unfunded Commitment` | % of Uncalled Capital | LP's share of total fund uncalled |
| 10 | `Concentration Limit` | Concentration Limit | Per-LP concentration cap |
| 11 | `Eligible Unfunded Commitment` | Eligible Commitment | Uncalled after concentration haircut (derived) |
| 12 | `Advance Rate` | Advance Rate | Agent advance rate (decimal, e.g. 0.90) |
| 13 | `Borrowing Base` | Borrowing Base | LP BB contribution = Eligible × Advance Rate |

---

## Legend

No cell-format legend defined for this template. Colour-coded rows are not documented in the sample.

---

## Recognition Signatures

- **Title anchor:** Row 2, contains `"KKR Ascendant"` and `"Borrowing Base"`
- **Detection strategy:** Match fund name in the title cell at row 2 of the `Borrowing Base` sheet.
- **Detection keys:** `kkr ascendant`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | A |
| `has_grouping_rows` | true |
| `has_color_flags` | false |
| `tranche_count` | 1 |
| `summary_rows_above_header` | 8 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| KKR Ascendant Fund | A | Borrowing Base | 10 | false | 1 | true | false | 8 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | Borrowing Base | 10 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row + one row per group section)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
| LP_GRID | 1 | Rated Included Investors | Rated Included |
| LP_GRID | 2 | Non-Rated Included Investors | Non-Rated Included |
| LP_GRID | 3 | Designated Investors | Designated Institutional |
| LP_GRID | 4 | Borrowing Base Investors | Non-Rated Included |
| LP_GRID | 5 | Hurdle Investors | Non-Rated Included |
| LP_GRID | 6 | Excluded Investors | Ineligible Investors |
