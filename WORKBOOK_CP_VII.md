# Agent BB Workbook Structure: CP VII (Carlyle Partners VII)

**Template ID:** `cp-vii`
**Template Class:** A — Full BB Schedule with advance rates and concentration metrics. Deep-sheet title (row 83). Stacked two-row column header (rows 84–85). No LP category group sections (flat LP list). Multi-tab (one `BB - Onshore` / `BB - Offshore` tab per tranche).
**Agent Bank:** Bank of America, N.A.

---

## Workbook Layout

### Tabs

Multi-tab workbook. One LP_GRID tab per tranche/series. Tab names follow the pattern `BB - <Series>`.

| Role | Sort | Sheet Name (verbatim) | Sleeve Name | Header Row | Header Span | Notes |
|------|------|----------------------|-------------|------------|-------------|-------|
| LP_GRID | 1 | `BB - Onshore` | BB - Onshore | 84 | 2 | Onshore tranche; stacked rows 84–85 |
| LP_GRID | 2 | `BB - Offshore` | BB - Offshore | 84 | 2 | Offshore tranche; same structure |

> **Critical:** The LP table does not begin at row 1. Rows 1–10 carry a top-of-workbook summary block.
> Rows 11–82 are blank. The section title sits at row 83 and the stacked column header occupies rows 84–85.
> The extraction engine must:
> 1. Search beyond the default 10-row window (use 100-row depth) to find the title at row 83.
> 2. Set `header_row_index = 83` (0-based) and `header_row_span = 2` so rows 84 and 85 are joined
>    into a single logical header before alias matching.

### Preamble Block

**Top-of-workbook summary (rows 1–10):**
- **Row 1:** `Carlyle Partners VII — Borrowing Base Certificate` (col A) — early title anchor.
- **Row 2:** `Agent Bank | Bank of America, N.A.`
- **Row 3:** `As Of Date`
- **Row 4:** `Currency`
- **Row 5:** `Series / Sleeve | BB - Onshore` (varies per tab)
- **Rows 7–10:** Totals (Total Capital Commitments, Total Eligible Commitments, Total Unfunded Commitment, Total Availability)

**Deep-sheet section title (row 83):**
- **Row 83:** `Carlyle Partners VII` — secondary anchor within the BB section.
- **Rows 84–85:** Stacked column headers (two physical rows = one logical header).

`summary_rows_above_header = 0` *(detection uses title anchor at row 83, not summary-row skipping)*

### LP Category Group Sections *(LP_GRID tab)*

None. All LPs appear in a flat list below the stacked header. `has_grouping_rows = false`.

### Column Headers *(LP_GRID tab, rows 84–85 joined)*

Stacked headers across two rows. The full logical header for each column is formed by joining the row-84 and row-85 cell values (space-separated; blank cells omitted).

| # | Agent Header (verbatim, joined) | Canonical Field (nearest) | Notes |
|---|--------------------------------|---------------------------|-------|
| 1 | `Investor` | Investor Name | Primary LP identifier |
| 2 | `Total Capital Commitments` | Capital Commitments | Total committed capital |
| 3 | `% of Eligible Commitments` | % of Eligible Uncalled | LP's share of eligible commitment pool |
| 4 | `% of All Commitments` | % of Uncalled Capital | LP's share of total commitment pool |
| 5 | `Contributions Called to Date` | Called Capital | Capital drawn to date |
| 6 | `Unfunded Commitment` | Uncalled Capital | Remaining callable capital |
| 7 | `Excess Concentration %` | Concentration (%) | LP's current concentration as a percentage |
| 8 | `Excess Concentration` | Excess Concentration | Dollar overage above per-LP cap |
| 9 | `Eligible Contribution` | Eligible Commitment | Commitment after excess concentration removed (derived) |
| 10 | `Advance Rate` | Advance Rate | Agent advance rate (decimal) |
| 11 | `Availability` | Borrowing Base | LP BB contribution = Eligible × Advance Rate |

> **Stacked header note:** Row 84 carries the top-row fragments ("of Eligible Commitments", "of All Commitments"
> etc.) across cols C–D; row 85 carries the primary labels. The engine's `joinHeaderRows` logic handles this
> by scanning the two rows in order and concatenating non-blank values per column.

---

## Legend

No cell-format legend defined for this template.

---

## Recognition Signatures

- **Primary title anchor:** Row 1, col A contains `"Carlyle Partners VII"`.
- **Secondary title anchor:** Row 83, contains `"Carlyle Partners VII"`.
- **Tab names:** `BB - Onshore`, `BB - Offshore`.
- **Agent bank:** Row 2, col B = `Bank of America, N.A.`
- **Detection strategy:** Match `"Carlyle"` or `"CP VII"` in any top-of-sheet or row-83 cell within a `BB - *` tab.
- **Detection keys:** `carlyle`, `cp vii`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | A |
| `has_grouping_rows` | false |
| `has_color_flags` | false |
| `tranche_count` | 2 *(BB - Onshore + BB - Offshore)* |
| `summary_rows_above_header` | 0 |
| `header_row_span` | **2** ← critical; rows 84 and 85 must be joined |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Bank of America (CP VII) | A | BB - Onshore | 83 | false | 2 | false | false | 0 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | sleeve_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|---|
| LP_GRID | 1 | BB - Onshore | BB - Onshore | 83 | 2 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 2 | BB - Offshore | BB - Offshore | 83 | 2 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row — no data rows)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
*(empty — no LP category group sections)*
