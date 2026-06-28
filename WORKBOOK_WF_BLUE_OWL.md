# Agent BB Workbook Structure: Blue Owl GP Stakes V (Wells Fargo)

**Template ID:** `wf-blue-owl`
**Template Class:** A — Full BB Schedule. Two tranches (Tranche A, Tranche B), each with its own `Agent BB` tab. Per-section LP category group headers. Cell-format legend encodes LP transfer and reclassification flags.
**Agent Bank:** Wells Fargo Bank *(current administrative agent for Blue Owl GP Stakes V)*

> **Note:** No sample Excel file exists in `pe-sub-platform/public` for this template. This WORKBOOK doc is
> based on prior agent-bank analysis. The Goldman Sachs legacy format (`gs-blue-owl`) has a sample file;
> this WF format does not. When a WF sample is received, re-parse and verify all row anchors below.

---

## Workbook Layout

### Tabs

Multi-tab workbook with one `Agent BB` tab per tranche.

| Role | Sort | Sheet Name | Sleeve Name | Header Row | Header Span | Notes |
|------|------|------------|-------------|------------|-------------|-------|
| LP_GRID | 1 | `Agent BB` | Tranche A | 18 | 1 | Tranche A — first `Agent BB` tab |
| LP_GRID | 2 | `Agent BB` | Tranche B | 18 | 1 | Tranche B — second `Agent BB` tab |

> **Multi-tab note:** Both tabs share the same sheet name `Agent BB`. The engine distinguishes them by
> tab order (sort 1 and sort 2). Full multi-tab aggregation across both tranches is required to produce
> the facility-level LP count and BB total.

`tranche_count = 2`

### Preamble / Summary Block

Rows 3–17 (15 rows) above the LP table header at row 18.
- **Row 2:** `Blue Owl GP Stakes V – Subscription Facility Borrowing Base` — fund/facility title anchor.
- **Rows 3–17:** Fund-level summary tables: borrowing base totals, eligibility summaries, tranche breakdown.

`summary_rows_above_header = 15`

### LP Category Group Sections *(LP_GRID tab)*

| Sort | Section Header Text (verbatim) | Canonical LP Classification |
|------|--------------------------------|-----------------------------|
| 1 | `A. Rated Investors` | Rated Included |
| 2 | `B. Unrated Investors` | Non-Rated Included |
| 3 | `C. Eligible Investors` | Designated Institutional |
| 4 | `D. Excluded Investors` | Ineligible Investors |

Each section header row is followed by LP rows, then a subtotal row.

### Column Headers *(LP_GRID tab, row 18)*

| # | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|---|-------------------------|---------------------------|-------|
| 1 | `Investor` | Investor Name | Primary LP identifier |
| 2 | `Parent / Sponsor / Manager` | Parent | Sponsor or manager entity |
| 3 | `S&P` | S&P Rating | Agency rating |
| 4 | `Moody's` | Moody's Rating | Agency rating |
| 5 | `Net Assets (range)` | AUM | Categorical AUM bucket (e.g. `>=$20Bn`, `10-20 $Bn`) |
| 6 | `Individual Original Commitment` | — | Per-LP original commitment in LP's own currency; no canonical home |
| 7 | `Original Commitment` | Capital Commitments | Total committed capital |
| 8 | `Individual Unfunded Commitment` | — | Per-LP unfunded in LP's own currency; no canonical home |
| 9 | `Unfunded Capital Commitment` | Uncalled Capital | Remaining callable capital |
| 10 | `% Called` | % of LP Called | LP percentage called to date |
| 11 | `% Total Unfunded Commitment` | % of Uncalled Capital | LP's share of total fund uncalled |
| 12 | `% Eligible Unfunded Commitment` | % of Eligible Uncalled | LP's share of eligible uncalled pool |
| 13 | `Concentration Limit` | Concentration Limit | Per-LP concentration cap |
| 14 | `Excess Concentration` | Excess Concentration | Dollar overage above per-LP cap |
| 15 | `Eligible Commitment` | Eligible Commitment | Uncalled after concentration haircut (derived) |
| 16 | `Advance Rate` | Advance Rate | Agent advance rate (decimal) |
| 17 | `Borrowing Base Contribution` | Borrowing Base | LP BB contribution = Eligible × Advance Rate |
| 18 | `% of Borrowing Base` | % of Borrowing Base | LP's share of total facility BB |

---

## Legend

Cell formatting encodes LP-level change flags. **Capture during extraction alongside cell value.**

| Style | Meaning |
|-------|---------|
| Rose / pink cell background | LP was reclassified since the prior certificate |
| Light turquoise cell background | LP was added to the BB via LP Transfer |

`has_color_flags = true` — the extraction engine must capture fill-color metadata for each LP row.

---

## Recognition Signatures

- **Title anchor:** Row 2, contains `"Blue Owl GP Stakes V"` and `"Borrowing Base"`.
- **Sheet name:** `Agent BB`
- **Detection strategy:** Match fund title text at row 2 of any `Agent BB` sheet. `detectKeys` also matches agent-bank fragments.
- **Detection keys:** `blue owl gp stakes`, `gp stakes v`, `wells fargo`

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | A |
| `has_grouping_rows` | true |
| `has_color_flags` | true |
| `tranche_count` | 2 |
| `summary_rows_above_header` | 15 |
| `header_row_span` | 1 |

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Wells Fargo (Blue Owl GP Stakes V) | A | Agent BB | 17 | false | 2 | true | true | 15 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | sleeve_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|---|
| LP_GRID | 1 | Agent BB | Tranche A | 17 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |
| LP_GRID | 2 | Agent BB | Tranche B | 17 | 1 | Total,Subtotal,Sub-Total,Grand Total,Sum,Net Total |

### Sheet 3: `Groups` *(one header row + one row per group section)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
| LP_GRID | 1 | A. Rated Investors | Rated Included |
| LP_GRID | 2 | B. Unrated Investors | Non-Rated Included |
| LP_GRID | 3 | C. Eligible Investors | Designated Institutional |
| LP_GRID | 4 | D. Excluded Investors | Ineligible Investors |
