# Agent BB Workbook Structure: CP VII (Carlyle Partners VII)

**Template ID:** `cp-vii`
**Template Class:** A — Full BB Schedule with advance rates and concentration metrics. Deep-sheet title (row 83). Stacked two-row column header (rows 84–85). No LP category group sections (flat LP list).
**Agent Bank (placeholder):** CP VII *(update to real agent bank when facility is onboarded)*

---

## Workbook Layout

### Tabs

Multi-tab workbook. One `BB` tab per tranche/borrower. The `BB` sheet name is shared across tabs.

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `BB` | 84 | 2 | Stacked header: rows 84 AND 85 joined into one logical header |

> **Critical:** The LP table does not begin at row 1. Rows 1–82 are blank or contain unrelated content. The title anchor sits at row 83 and the two-row stacked header occupies rows 84–85. The extraction engine must:
> 1. Search beyond the default 10-row window (use 100-row search depth) to find the title at row 83.
> 2. Set `header_row_index = 84` and `header_row_span = 2` so rows 84 and 85 are joined into a single logical header before alias matching.

### Preamble Block

No structured preamble block. The sheet is largely blank until row 83.
- **Row 83:** `Carlyle Partners VII` — fund identity anchor.
- **Rows 84–85:** Stacked column headers (two physical rows = one logical header).

`summary_rows_above_header = 0`

### LP Category Group Sections *(LP_GRID tab)*

None. All LPs appear in a flat list below the stacked header. `has_grouping_rows = false`.

### Column Headers *(LP_GRID tab, rows 84–85 joined)*

Stacked headers across two rows. The full logical header for each column is the concatenation of the row-84 and row-85 cell values for that column (separated by a space; blank cells in either row are omitted).

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

> **Stacked header note:** The exact row-84/row-85 split varies column-by-column in the real workbook. The engine's `joinHeaderRows` logic handles this by scanning the two rows in order and concatenating non-blank values.

---

## Legend

No cell-format legend defined for this template.

---

## Recognition Signatures

- **Title anchor:** Row 83, contains `"Carlyle Partners VII"`.
- **Sheet name:** `BB`
- **Detection strategy:** Search down to row 100 within the `BB` sheet; match `"Carlyle"` or `"CP VII"` in any cell.
- **Detection keys:** `carlyle`, `cp vii`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | A |
| `has_grouping_rows` | false |
| `has_color_flags` | false |
| `tranche_count` | 1 *(set to number of active BB tabs at ingest time)* |
| `summary_rows_above_header` | 0 |
| `header_row_span` | **2** ← critical; rows 84 and 85 must be joined |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| CP VII | A | BB | 84 | false | 1 | false | false | 0 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | BB | 84 | **2** | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row — no data rows)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
*(empty — no LP category group sections)*
