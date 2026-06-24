# Agent BB Workbook Structure: CCP VII Lev M & M

**Template ID:** `ccp-vii-lev`
**Template Class:** C — Simplified Callable Capital. No ratings columns; no advance-rate columns. Binary `Included/Excluded` eligibility logic. Group-header rows identify feeder vehicle structures, not credit tiers.
**Agent Bank (placeholder):** CCP VII Lev M & M *(update to real agent bank when facility is onboarded)*

---

## Workbook Layout

### Tabs

Multi-tab workbook. One `Investor List` tab per borrower entity. Each tab carries the same column structure.

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `Investor List` | 7 | 1 | Repeat pattern — one tab per borrower |

### Preamble Block

Rows 1–6 precede the header row at row 7.
- **Row 3:** `Comvest Credit Partners VII, LP.` — fund identity anchor.

`summary_rows_above_header = 0`

### LP Category Group Sections *(LP_GRID tab)*

Group-header rows in this template identify **feeder vehicle structures**, not credit-tier LP categories. The per-row `Excluded` column (col 2) determines eligibility. Group classification is set to `Included` as a structural placeholder.

| Sort | Section Header Text (verbatim) | Canonical LP Classification |
|------|--------------------------------|-----------------------------|
| 1 | `Levered (Delaware) Feeder` | Included |
| 2 | `(Cayman) Feeder, L.P.` | Included |
| 3 | `(Delaware) Feeder, L.P.` | Included |
| 4 | `Lux Intermediate` | Included |
| 5 | `Lux Non-Treaty Feeder` | Included |

> **Important:** These group headers are structural feeder-vehicle names, not credit tiers. Each feeder group is followed by a total row. The actual LP eligibility is determined by the per-row `Excluded` column value (`TRUE` / `FALSE`). `has_grouping_rows = true` because the engine needs to detect and skip the feeder header rows and their totals.

### Column Headers *(LP_GRID tab, row 7)*

| # | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|---|-------------------------|---------------------------|-------|
| 1 | `Investor Name` | Investor Name | Primary LP identifier |
| 2 | `Excluded` | Eligibility Flag | `TRUE`/`FALSE`; Class C primary eligibility flag |
| 3 | `Defaulting?` | — | Default flag; no canonical home |
| 4 | `Claimed/Exercised Rights?` | — | Rights flag; no canonical home |
| 5 | `Committed Capital` | Capital Commitments | Total committed capital |
| 6 | `Recallable Distribution` | Recallable Distributions | Previously distributed capital that may be recalled |
| 7 | `Remaining Callable Capital` | Uncalled Capital | Uncalled + recallable = total callable base |
| 8 | `Concentration Limit` | Concentration Limit | Per-LP concentration cap |

> **No advance-rate column** — Class C template uses a flat advance rate or binary eligible/excluded logic rather than per-LP advance rates.

---

## Legend

No cell-format legend defined for this template.

---

## Recognition Signatures

- **Title anchor:** Row 3, contains `"Comvest Credit Partners"`.
- **Detection strategy:** Match title text at row 3 of any `Investor List` sheet.
- **Detection keys:** `comvest`, `ccp vii`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | C |
| `has_grouping_rows` | true |
| `has_color_flags` | false |
| `tranche_count` | 1 *(set to number of active tabs at ingest time)* |
| `summary_rows_above_header` | 0 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| CCP VII Lev M & M | C | Investor List | 7 | false | 1 | true | false | 0 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | Investor List | 7 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row + one row per feeder group)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
| LP_GRID | 1 | Levered (Delaware) Feeder | Included |
| LP_GRID | 2 | (Cayman) Feeder, L.P. | Included |
| LP_GRID | 3 | (Delaware) Feeder, L.P. | Included |
| LP_GRID | 4 | Lux Intermediate | Included |
| LP_GRID | 5 | Lux Non-Treaty Feeder | Included |
