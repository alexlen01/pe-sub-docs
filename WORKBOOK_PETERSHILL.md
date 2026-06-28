# Agent BB Workbook Structure: Petershill IV (Goldman Sachs)

**Template ID:** `gs-petershill`
**Template Class:** A — Full BB Schedule, group-header classification, separate per-agency ratings columns, advance rates per LP section.
**Agent Bank:** Goldman Sachs Bank USA

---

## Workbook Layout

### Tabs

| Role | Sort | Sheet Name | Header Row | Header Span | Notes |
|------|------|------------|------------|-------------|-------|
| LP_GRID | 1 | `Borrowing Base` | 11 | 1 | Single-tab workbook; preamble rows 2–10 precede header |

### Preamble / Summary Block

Rows 2–10 (9 rows above the header) contain facility-level summary fields in cols A–B:

| Row | Field | Sample Value |
|-----|-------|--------------|
| 2 | *(title)* | Petershill IV and Petershill IV Offshore SCSp – Subscription Facility Borrowing Base |
| 4 | Borrowing Base | $10,764,017,102 |
| 5 | Eligible Remaining Commitments | $12,420,230,396 |
| 6 | Total Remaining Commitments | $12,491,495,101 |
| 7 | Total Original Commitments | $22,919,734,325 |
| 8 | Effective Advance Rate | 0.8617 |
| 9 | Apply Individual Concentration Limits | True |
| 10 | *(blank separator)* | — |

`summary_rows_above_header = 9`

### LP Category Group Sections *(LP_GRID tab)*

| Sort | Section Header Text (verbatim) | Canonical LP Classification |
|------|--------------------------------|-----------------------------|
| 1 | `Included Investors (Rated)` | Rated Included |
| 2 | `Included Investors (Non-Rated)` | Non-Rated Included |
| 3 | `Institutional Designated Investors` | Designated Institutional |
| 4 | `PWM Designated Investors` | Designated PWM |
| 5 | `Excluded Investors` | Ineligible Investors |

Each group header row (single populated col-A cell, all other columns empty) is followed by LP rows, then
a subtotal row whose col A starts `Subtotal –`. Subtotal rows and the facility-aggregate row
(`Eligible Commitments`, row 81) are caught by `skip_row_keywords` and discarded.

Excluded-investor rows (group 5, rows 83+) carry only OX reference codes in col A — no investor name.

> **Group 2 spelling:** The actual Excel file has **`Included Investors (Non-Rated)`** with correct spelling.
> No typo exists in the source workbook.

### Column Headers *(LP_GRID tab, row 11)*

Fifteen columns across cols A–O:

| Col | Agent Header (verbatim) | Canonical Field (nearest) | Notes |
|-----|-------------------------|---------------------------|-------|
| A | `Deal Investor Name` | Investor Name | Primary LP identifier; OX code only for excluded LPs |
| B | `Investor S&P` | S&P Rating | Per-agency; `NR` for non-rated |
| C | `Investor Moody` | Moody's Rating | Per-agency; `NR` for non-rated. Note: no apostrophe-s suffix |
| D | `NAV Range (USD)` | AUM | Categorical bucket (`>=$20Bn`, `10-20 $Bn`, `1-5 $Bn`); present for Non-Rated section only |
| E | `Original Commitment` | Capital Commitments | Total committed capital (USD) |
| F | `Unfunded Capital Commitment` | Uncalled Capital | Remaining callable capital (USD) |
| G | `% Called` | % of LP Called | Decimal proportion |
| H | `% of Unfunded Commitment` | % of Uncalled Capital | LP share of total fund uncalled; near-miss at JW 0.900 — requires alias |
| I | `% of Eligible Unfunded Commitment` | % of Eligible Uncalled | LP share of eligible uncalled pool (derived; blocklist-exempt) |
| J | `Concentration Limit` | Concentration Limit | Per-LP cap (decimal) |
| K | `Excess Concentration` | Excess Concentration | Dollar overage |
| L | `Eligible Commitment` | Eligible Commitment | Uncalled after concentration haircut (derived; blocklist-exempt) |
| M | `Advance Rate` | Advance Rate | 0.90 (Rated/Non-Rated) or 0.75 (Institutional/PWM Designated) |
| N | `Borrowing Base Contribution` | Borrowing Base | LP BB contribution = L x M |
| O | `% of Borrowing Base` | LP share of total facility BB |

---

## Legend

Col E, rows 3–6 in the preamble block carry row-colour codes used by the agent to annotate LP status.

| Colour Code | Meaning |
|-------------|---------|
| Reclassified | LP moved between investor tiers since prior period |
| Transferor | LP transferring its commitment to another party |
| Transferee | LP receiving a transferred commitment |

`has_color_flags = true`. The extraction engine should record flag presence per LP row.

---

## Recognition Signatures

- **Title anchor:** Row 2, col A contains `"Petershill IV"` and `"Borrowing Base"`.
- **Full title text:** `Petershill IV and Petershill IV Offshore SCSp – Subscription Facility Borrowing Base`
- **Sheet name:** `Borrowing Base` (exact match)
- **Detection strategy:** Match `Petershill` in the preamble title cell; agent bank confirmed by cross-referencing `Goldman Sachs` in the file metadata or cover-page header.
- **Detection keys:** `petershill`, `goldman sachs`

> **Disambiguation from `gs-blue-owl`:** Both templates share agent bank Goldman Sachs Bank USA. The title anchor (`Petershill` vs `Blue Owl`) is the differentiator. Template class also differs: Petershill IV is Class A (group headers); GS Blue Owl is Class B (per-row investor-type column).

---

## Extraction Engine Hints

| Flag | Value |
|------|-------|
| `template_class` | A |
| `has_grouping_rows` | true |
| `has_color_flags` | true |
| `tranche_count` | 1 |
| `summary_rows_above_header` | 9 |
| `header_row_span` | 1 |
| `agent_bank` | Goldman Sachs Bank USA |

**Skip row keywords:** `Subtotal`, `Total`, `Eligible Commitments` — covers `Subtotal – <section>` rows, `Total Commitments` grand total, and the mid-table facility aggregate at row 81.

---

## Excel Import Template

To register this template via the **BB Template Management** screen → **Upload Template**, create a workbook with three sheets:

### Sheet 1: `Template` *(one header row + one data row)*

| agent_bank | template_class | sheet_name | header_row_index | auto_learned | tranche_count | has_grouping_rows | has_color_flags | summary_rows_above_header |
|---|---|---|---|---|---|---|---|---|
| Goldman Sachs Bank USA | A | Borrowing Base | 10 | false | 1 | true | true | 9 |

### Sheet 2: `Tabs` *(one header row + one row per tab)*

| tab_role | tab_sort | sheet_name | header_row_index | header_row_span | skip_row_keywords |
|---|---|---|---|---|---|
| LP_GRID | 1 | Borrowing Base | 10 | 1 | Total,Subtotal,Sub-Total,Eligible Commitments,Grand Total |

### Sheet 3: `Groups` *(one header row + one row per group section)*

| tab_role | group_sort | header_text | classification |
|---|---|---|---|
| LP_GRID | 1 | Included Investors (Rated) | Rated Included |
| LP_GRID | 2 | Included Investors (Non-Rated) | Non-Rated Included |
| LP_GRID | 3 | Institutional Designated Investors | Designated Institutional |
| LP_GRID | 4 | PWM Designated Investors | Designated PWM |
| LP_GRID | 5 | Excluded Investors | Ineligible Investors |
