# Agent BB Workbook Structure: CCP VII Lev M & M

**Template ID:** `ccp-vii-lev`
**Template Class:** C — Simplified Callable Capital. No ratings columns; no advance-rate columns. Binary `Included/Excluded` eligibility logic. Each feeder vehicle is its own named Excel tab.
**Agent Bank:** Silicon Valley Bank

---

## Workbook Layout

### Tabs

Multi-tab workbook. **One tab per feeder vehicle.** Tab names reflect the feeder entity name directly; they do NOT use a generic "Investor List" label.

| Role | Sort | Sheet Name (verbatim) | Sleeve Name | Header Row | Header Span | Notes |
|------|------|----------------------|-------------|------------|-------------|-------|
| LP_GRID | 1 | `Levered (DE) Feeder` | Levered (DE) Feeder | 7 | 1 | Delaware levered feeder vehicle |
| LP_GRID | 2 | `(Cayman) Feeder, L.P.` | (Cayman) Feeder, L.P. | 7 | 1 | Cayman feeder vehicle |
| LP_GRID | 3 | `(Delaware) Feeder, L.P.` | (Delaware) Feeder, L.P. | 7 | 1 | Delaware feeder vehicle |
| LP_GRID | 4 | `Lux Intermediate` | Lux Intermediate | 7 | 1 | Luxembourg intermediate vehicle |
| LP_GRID | 5 | `Lux Non-Treaty Feeder` | Lux Non-Treaty Feeder | 7 | 1 | Luxembourg non-treaty feeder |

> **Auto-discover:** Because tab names may change between workbook versions (new feeder vehicles added,
> names adjusted), `auto_discover_tabs = true` is set in the DB. The extraction engine scans all sheets,
> detects the LP table structure, and extracts from any sheet that passes header detection at row 7.

### Preamble Block

Each tab has rows 1–6 above the header:
- **Row 3:** `Comvest Credit Partners VII, LP.` — fund identity anchor on every tab.

`summary_rows_above_header = 0`

### LP Category Group Sections *(within each tab)*

**None.** There are **no in-tab group header rows**. The feeder vehicle identity is encoded in the tab name itself (= the sleeve name). The per-row `Excluded` column (col 2) determines eligibility. `has_grouping_rows = false`.

> **Note:** Each tab ends with a single total row `Total — <tab name>` caught by `skip_row_keywords`.

### Column Headers *(each LP_GRID tab, row 7)*

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

> **No advance-rate column** — Class C template uses binary eligible/excluded logic rather than per-LP advance rates.

---

## Legend

No cell-format legend defined for this template.

---

## Recognition Signatures

- **Title anchor:** Row 3, contains `"Comvest Credit Partners"`.
- **Detection strategy:** Match title text at row 3 of any discovered sheet; header at row 7.
- **Detection keys:** `comvest`, `ccp vii`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | C |
| `has_grouping_rows` | false |
| `has_color_flags` | false |
| `tranche_count` | 5 *(one per named feeder tab)* |
| `summary_rows_above_header` | 0 |
| `header_row_span` | 1 |
| `auto_discover_tabs` | true |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Silicon Valley Bank (CCP VII Lev M & M) | C | Levered (DE) Feeder | 6 | false | 5 | false | false | 0 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | sleeve_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|---|
| LP_GRID | 1 | Levered (DE) Feeder | Levered (DE) Feeder | 6 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 2 | (Cayman) Feeder, L.P. | (Cayman) Feeder, L.P. | 6 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 3 | (Delaware) Feeder, L.P. | (Delaware) Feeder, L.P. | 6 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 4 | Lux Intermediate | Lux Intermediate | 6 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 5 | Lux Non-Treaty Feeder | Lux Non-Treaty Feeder | 6 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row — no data rows)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
*(empty — no in-tab LP category group sections; feeder identity = tab name)*
