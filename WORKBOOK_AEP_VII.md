# Agent BB Workbook Structure: AEP VII (Aurora Equity Partners VII)

**Template ID:** `aep-vii`
**Template Class:** A — Full BB Schedule, group-header classification, numerical ratings, advance rates. Cell-format legend encodes LP-level delta flags.
**Agent Bank:** JPMorgan Chase Bank, N.A.

---

## Workbook Layout

### Tabs

Single-tab workbook.

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `BB` | 10 | 1 | Single-tab workbook |

### Preamble / Summary Block

Rows 2–9 (8 rows) above the header row at row 10.

- **Row 2:** `AURORA EQUITY PARTNERS VII LP` — fund identity anchor.
- **Row 3:** `Agent Bank | JPMorgan Chase Bank, N.A.`
- **Rows 4–9:** As Of Date, Currency, Total Investors, Total Commitment, Total Funded/Unfunded Commitment.

`summary_rows_above_header = 8`

### LP Category Group Sections *(LP_GRID tab)*

| Sort | Section Header Text (verbatim) | Canonical LP Classification |
|------|--------------------------------|-----------------------------|
| 1 | `Rated Included Investors` | Rated Included |
| 2 | `Non-Rated Included Investors` | Non-Rated Included |
| 3 | `Designated Investors` | Designated Institutional |
| 4 | `Excluded Investors` | Ineligible Investors |

Each section header row is followed by LP rows, then a subtotal row.

### Column Headers *(LP_GRID tab, row 10)*

| # | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|---|-------------------------|---------------------------|-------|
| 1 | `Investor` | Investor Name | Primary LP identifier |
| 2 | `Moody's` | Moody's Rating | Agency rating |
| 3 | `S&P` | S&P Rating | Agency rating |
| 4 | `Net Worth` | AUM | Scale qualifier; may be AUM or NAV depending on LP type |
| 5 | `Total Commitment` | Capital Commitments | Total committed capital |
| 6 | `Funded Commitment` | Called Capital | Capital drawn to date |
| 7 | `Unfunded Commitment` | Uncalled Capital | Remaining callable capital |
| 8 | `% Total Unfunded Commitment` | % of Uncalled Capital | LP's share of total fund uncalled |
| 9 | `Concentration Limit` | Concentration Limit | Per-LP concentration cap |
| 10 | `Excess Concentration` | Excess Concentration | Dollar overage above per-LP cap |
| 11 | `Eligible Unfunded Commitment` | Eligible Commitment | Uncalled after concentration haircut (derived) |
| 12 | `Advance Rate` | Advance Rate | Agent advance rate (decimal) |

> **No `Borrowing Base` column** — LP BB contribution is `Eligible Unfunded Commitment × Advance Rate`, computed externally.

---

## Legend

Cell formatting encodes LP-level delta flags. **Capture during extraction alongside cell value** — not just the numeric data.

| Style | Meaning |
|-------|---------|
| Green cell shading | LP is new to the BB, added organically (not via LP Transfer) |
| Yellow cell shading | LP is new to the BB via LP Transfer |
| Blue text (font color) | LP has a change in Commitment Amount since the prior certificate |
| Underlined text | LP has a change in LP Category since the prior certificate |

Legend block appears at rows 60–64 (below last LP section).

`has_color_flags = true` — the extraction engine must capture fill-color and font-color metadata for each LP row.

---

## Recognition Signatures

- **Title anchor:** Row 2, contains `"AURORA EQUITY PARTNERS VII"`.
- **Sheet name:** `BB`
- **Agent bank:** Row 3, col B = `JPMorgan Chase Bank, N.A.`
- **Detection strategy:** Match fund name in title cell at row 2 of the `BB` sheet.
- **Detection keys:** `aurora equity`, `aep vii`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | A |
| `has_grouping_rows` | true |
| `has_color_flags` | true |
| `tranche_count` | 1 |
| `summary_rows_above_header` | 8 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| JPMorgan Chase Bank, N.A. | A | BB | 9 | false | 1 | true | true | 8 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | BB | 9 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row + one row per group section)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
| LP_GRID | 1 | Rated Included Investors | Rated Included |
| LP_GRID | 2 | Non-Rated Included Investors | Non-Rated Included |
| LP_GRID | 3 | Designated Investors | Designated Institutional |
| LP_GRID | 4 | Excluded Investors | Ineligible Investors |
