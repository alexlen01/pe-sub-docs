# Agent BB Format Analysis 2 — `Agent_BB.xlsx` (Petershill IV, GS format)

Analysis of the second Agent Borrowing Base workbook against the field-mapping dictionaries in the
**prototype** (`pe-sub-platform/src/data/fieldMappingData.js`) and the **active UI**
(`pe-sub-ui/src/data/fieldMappingData.ts`).

- **Workbook**: `pe-sub-docs/Agent_BB.xlsx`
- **Sheet**: `Borrowing Base` (single sheet)
- **Fund**: Petershill IV and Petershill IV Offshore SCSp — Subscription Facility Borrowing Base (Proposed)
- **Agent bank**: Goldman Sachs
- **Shape**: 15 columns (B–P), header at row 11, **56 included LP records** across 4 investor tiers + **20 excluded LP records** (OX codes only). Multiple section-header and subtotal rows interspersed.

> **How matches were determined.** The extraction pipeline matches headers with `HeaderMatcher`
> (`pe-sub-extraction`): each header is `normalize()`d (lower-cased, all non-alphanumerics → spaces,
> whitespace collapsed) and scored against every alias with **Jaro-Winkler**; a column is mapped
> only when the best alias scores **≥ 0.95**, otherwise it lands in `unrecognizedColumns`.
> `normalize()` strips `($)` / `(%)` / `&` / `/`, so suffix-only differences do **not** break a
> match. A separate `GLOBAL_BLOCKLIST` blocks any header containing the qualifier terms (e.g.
> "Eligible") from mapping to raw-input canonical fields. All scores below were computed with the
> same algorithm applied to both dictionaries.

---

## 1. Workbook Structure

This file differs fundamentally from the prior analysed Agent BB (West Street Mezzanine Partners
VIII) — it is a **multi-section, structured layout**, not a flat table.

### 1.1 Preamble block (rows 2–9)

Facility-level summary metrics above the LP table, in cols B–C:

| Row | Label | Value |
|-----|-------|-------|
| 2 | *(title)* | Petershill IV … Borrowing Base (Proposed) |
| 4 | Borrowing Base | $10,764,017,102 |
| 5 | Eligible Remaining Commitments | $12,420,230,396 |
| 6 | Total Remaining Commitments | $12,491,495,101 |
| 7 | Total Original Commitments | $22,919,734,325 |
| 8 | Effective Advance Rate | 0.8617 (86.17%) |
| 9 | Apply Individual Concentration Limits | `True` |

Col E rows 3–6 carry a **Legend** (`Reclassified` / `Transferor` / `Transferee`) that encodes row
colour-codes; these values are visual metadata and not carried in cell values for LP rows.

### 1.2 Header row (row 11)

Fifteen columns across cols B–P. No column A data.

### 1.3 LP sections (rows 13–103)

Four included-investor tiers, each with a section-header row and a subtotal row, plus one
excluded-investor section:

| Section | Header row | Data rows | LP count | Advance Rate |
|---------|------------|-----------|----------|--------------|
| Included Investors (Rated) | 13 | 14–41 | 28 | 0.90 |
| Included Investors (Non-Rated) | 44 | 45–56 | 12 | 0.90 |
| Institutional Designated Investors | 59 | 60–73 | 14 | 0.75 |
| PWM Designated Investors | 76 | 77–78 | 2 | 0.75 |
| **Eligible Commitments aggregate** | — | 81 | — | — |
| Excluded Investors | 83 | 84–103 | 20 | n/a |

Section-header rows (single populated col-B cell, rest empty) and subtotal rows (col-B starts
"Subtotal —") must be detected and excluded from LP extraction. The section name provides the
`LP Category` value and must be filled down onto every LP beneath it.

**Excluded Investors** show only OX reference codes in col B (no investor names).

---

## 2. Column Inventory

| Col | Header (verbatim) | Kind | Observed values / sample |
|-----|-------------------|------|--------------------------|
| B | `Deal Investor Name` | Identity | Full legal name (included LPs); bare `OX#####` code (excluded LPs) |
| C | `Investor S&P` | Rating | Letter grade: `BBB+`, `A-`, `AA-`, `NR` |
| D | `Investor Moody` | Rating | Letter grade: `A3`, `Aa1`, `NR`, `Baa2` |
| E | `NAV Range (USD)` | Scale | Categorical bucket: `>=$20Bn`, `10-20 $Bn`, `1-5 $Bn`; blank for Rated section |
| F | `Original Commitment` | Commitment | USD integer, e.g. `2,500,000,000` |
| G | `Unfunded Capital Commitment` | Uncalled | USD integer — remaining uncalled |
| H | `% Called` | Uncalled | Decimal proportion: `0.4131`, `0.5408` |
| I | `% of Unfunded Commitment` | Uncalled | LP share of total fund uncalled (decimal) |
| J | `% of Eligible Unfunded Commitment` | Borrowing Base | LP share of eligible uncalled pool (decimal) |
| K | `Concentration Limit` | Concentration | Per-LP cap: `0.01`, `0.05`, `0.20`, `0.40` |
| L | `Excess Concentration` | Concentration | Dollar overage — `0` for every LP in this file |
| M | `Eligible Commitment` | Borrowing Base | USD — uncalled after per-LP concentration haircut |
| N | `Advance Rate` | Borrowing Base | Decimal: `0.90` (Rated/Non-Rated) or `0.75` (Institutional/PWM) |
| O | `Borrowing Base Contribution` | Borrowing Base | USD — `= M × N` |
| P | `% of Borrowing Base` | Borrowing Base | LP share of total facility BB (decimal) |

---

## 3. Mapping Results (header → canonical field)

Confidence is the best Jaro-Winkler score after normalization; **≥ 0.95 = auto-mapped**.
"BL" = caught by `GLOBAL_BLOCKLIST` before score check.

| Col | Header | UI canonical | Score | Proto canonical | Score | BL | Status |
|-----|--------|-------------|-------|----------------|-------|----|--------|
| B | Deal Investor Name | Investor Name | 0.741 | Investor Name | 0.741 | — | ❌ **Unmapped** — §4.1 |
| C | Investor S&P | *(Investor Name)* | 0.933 | *(Investor Name)* | 0.933 | — | ❌ **Unmapped** — §4.2 |
| D | Investor Moody | *(Investor Name)* | 0.914 | *(Investor Name)* | 0.914 | — | ❌ **Unmapped** — §4.2 |
| E | NAV Range (USD) | NAV | 0.821 | NAV | 0.821 | — | ❌ **Unmapped** — §4.4 |
| F | Original Commitment | Capital Commitments | 1.000 | Capital Commitments | 1.000 | — | ✅ Mapped (both) |
| G | Unfunded Capital Commitment | Uncalled Capital | 1.000 | Uncalled Capital | 1.000 | — | ✅ Mapped (both) |
| H | % Called | % of LP Called | 1.000 | % of LP Called | 1.000 | — | ✅ Mapped (both) |
| I | % of Unfunded Commitment | % of Uncalled Capital | 0.900 | Uncalled Capital | 0.884 | — | ❌ **Unmapped** — §4.3 |
| J | % of Eligible Unfunded Commitment | % of Eligible Uncalled | 0.867 | *(none)* | — | Eligible | ⛔ **Blocklisted** — §4.5 |
| K | Concentration Limit | Concentration Limit | 1.000 | Concentration Limit | 1.000 | — | ✅ Mapped (both) |
| L | Excess Concentration | Excess Concentration | 1.000 | Excess Concentration | 1.000 | — | ✅ Mapped (both) |
| M | Eligible Commitment | Eligible Commitment | 1.000 | *(none)* | — | Eligible | ⛔ **Blocklisted** — §4.5 |
| N | Advance Rate | Advance Rate | 1.000 | Advance Rate | 1.000 | — | ✅ Mapped (both) |
| O | Borrowing Base Contribution | Borrowing Base | 1.000 | Borrowing Base | 1.000 | — | ✅ Mapped (both) |
| P | % of Borrowing Base | % of Borrowing Base | 1.000 | % of Borrowing Base | 1.000 | — | ✅ Mapped (both) |

**Scorecard:** 8 clean auto-maps (F, G, H, K, L, N, O, P in both) · 2 blocklist false-positives
(J, M) · 4 below-threshold unmapped (B, C, D, I) · 1 no-canonical-home (E).

---

## 4. Gap Analysis

### 4.1 `Deal Investor Name` (Col B) — primary identifier lost 🔴

JW score 0.741 — well below threshold. The `Deal` prefix is unfamiliar to both dictionaries, whose
`Investor Name` aliases (`Investor Name`, `LP Name`, `Investor`, `Limited Partner`, etc.) all lack
it. The column IS the LP identity field, carrying the full legal name for included investors and the
bare `OX#####` code for excluded investors. Without mapping, every LP name extraction fails — the
most critical column in the file.

Additionally, excluded-investor rows expose **only the OX code** in this column, with no separate
investor-name column. This is the same `Investor ID` gap noted in the prior analysis (§3.3 of
`AGENT_BB_ANALYSIS.md`) — there is no canonical field for the OX reference code.

**Fix:** Add `Deal Investor Name` alias on `Investor Name` in both dictionaries.

### 4.2 Separate ratings columns — near miss on identity field (Cols C, D) 🔴

Both `Investor S&P` and `Investor Moody` score highest against `Investor Name` (0.933 and 0.914)
because the shared "Investor" prefix dominates the JW comparison. Neither reaches the ratings
canonical fields (`S&P Rating`, `Moody's Rating`) because the "Investor" prefix shifts the score:

| Col | Normalized header | Best rating alias | JW vs alias |
|-----|-------------------|-------------------|-------------|
| C | `investor s p` | `s p rating` | ~0.72 |
| D | `investor moody` | `moodys` | ~0.76 |

The near-miss against `Investor Name` does **not** exceed 0.95, so the columns go to
`unrecognizedColumns` rather than mismapping — but both S&P and Moody's ratings are still lost.
This file has **no Fitch column** (neither combined nor separate).

**Fix:** Add `Investor S&P` alias on `S&P Rating` and `Investor Moody` (and `Investor Moodys`)
alias on `Moody's Rating` in both dictionaries.

### 4.3 `% of Unfunded Commitment` (Col I) — near miss at 0.900

`% of Unfunded Commitment` normalizes to `of unfunded commitment`. The closest alias is `% of
Uncalled Capital` (normalized `of uncalled capital`) at **0.900** — 5 points short of threshold.
Semantically these are the same concept: LP's share of total fund uncalled. The column is non-zero
for every LP and is the portfolio-concentration metric used in reporting.

Note: in the prototype dictionary the best hit is the raw `Uncalled Capital` canonical at 0.884
rather than `% of Uncalled Capital`, making this a **diverge** if the threshold were lowered — only
the UI would route it correctly.

**Fix:** Add `% of Unfunded Commitment` alias on `% of Uncalled Capital` in both dictionaries.

### 4.4 `NAV Range (USD)` (Col E) — no canonical home

Score 0.821 vs `NAV`. The values are **categorical AUM buckets** (`>=$20Bn`, `10-20 $Bn`,
`1-5 $Bn`), not a numeric NAV — they are present only for the Non-Rated section (rows 45–56) where
the agent uses AUM tier instead of a credit rating to qualify the LP. The `NAV` canonical expects a
numeric value; `AUM` canonical likewise. Neither is semantically correct.

The prior analysis noted no `NAV Range` or `AUM Tier` concept anywhere in the pipeline. The column
feeds the "Non-Rated Included" qualification logic (GS-specific) and is a **GS-bank-scoped** field.

**Fix:** Decide scope explicitly. Option A: add `NAV Range (USD)` as a Bank-scoped alias on `AUM`
(closest existing concept, with disambiguation noting the range/tier nature). Option B: add a new
`AUM Tier` canonical in the Financial Scale group for categorical bucket data. Option A is lower
footprint; Option B is more precise.

### 4.5 Blocklist false-positives — `Eligible` qualifier blocks two derived canonical fields 🔴

The `GLOBAL_BLOCKLIST` entry `Eligible` (reason: *"Post-eligibility filter applied — not a raw
input field"*) was designed to prevent raw commitment columns from accidentally being tagged as
post-processed eligible amounts. It instead fires on **two columns that should be captured**:

**Col M — `Eligible Commitment`**

JW score against `Eligible Commitment` canonical (UI id 18) = **1.000 — exact match**, but the
blocklist fires first. This canonical is already `isDerived: true` in the UI, which is precisely
the right disposition — the engine should capture it as a derived field, not suppress it entirely.

The prototype has **no `Eligible Commitment` canonical at all**, so even if the blocklist were
lifted, the prototype would still drop Col M.

**Col J — `% of Eligible Unfunded Commitment`**

JW score against `% of Eligible Uncalled` (UI id 19, alias `% Eligible Unfunded Commitment`) =
**0.867** — below threshold even without the blocklist. However, the blocklist fires first, so the
column never reaches score evaluation. Even with the blocklist fixed, Col J would need a new alias
(`% of Eligible Unfunded Commitment`) to reach the 0.95 threshold.

The prototype has **no `% of Eligible Uncalled` canonical**, so Col J has nowhere to go in the
prototype regardless.

**Fix (blocklist):** Scope the `Eligible` blocklist to non-derived canonical fields only, or add
an explicit allowlist exemption for columns whose *best* match is a `isDerived: true` canonical.

**Fix (aliases):** Add `% of Eligible Unfunded Commitment` alias on `% of Eligible Uncalled` in
the UI dictionary.

**Fix (prototype):** Add `Eligible Commitment` and `% of Eligible Uncalled` canonicals + the
relevant aliases to the prototype dictionary to close the prototype gap.

---

## 5. Structural Parsing Requirements

The multi-section layout introduces parsing requirements absent from the flat-table format:

### 5.1 Section-header row detection

Rows 13, 44, 59, 76, 83 are section headers — a single string in col B with all other columns
empty. The extractor must:
1. Detect the pattern (one populated cell, all others null).
2. Record the section name as the `LP Category` value.
3. Fill it down onto every LP row until the next section header or subtotal.

Note the typo `Inlcuded` in row 44 (`Inlcuded Investors (Non-Rated)`) — the section name
must be captured verbatim, not corrected, to preserve agent intent.

### 5.2 Subtotal and aggregate row exclusion

Rows 42, 57, 74, 79, 81, 104, 106 are not LP records:

| Row | Col B value | Type |
|-----|-------------|------|
| 42 | `Subtotal — Included Investors (Rated)` | Section subtotal |
| 57 | `Subtotal — Included Investors (Non-Rated)` | Section subtotal |
| 74 | `Subtotal — Institutional Designated Investors` | Section subtotal |
| 79 | `Subtotal — PWM Designated Investors` | Section subtotal |
| 81 | `Eligible Commitments` | Facility aggregate |
| 104 | `Subtotal — Excluded Investors` | Section subtotal |
| 106 | `Total Commitments` | Grand total |

Detection heuristic: col B starts with `Subtotal` or `Total`, or col B contains `Eligible
Commitments` without a numeric rating in col C.

### 5.3 Preamble block

Rows 2–9 precede the header row (11) and contain facility-level metrics. The extractor must skip
forward to row 11 to find the actual column headers, not treat row 2 or 3 as headers. The header
row is identifiable by containing `Deal Investor Name` in col B.

### 5.4 Excluded Investors section — OX codes only

Rows 84–103 carry only OX reference codes in col B (no investor names). These LPs are excluded
from the Borrowing Base but should still be extracted with `LP Category = "Excluded Investors"`.
The missing name means LP matching against the LP Master table must fall back to the OX code key.

---

## 6. Comparison with Prior Agent BB Format (AGENT_BB_ANALYSIS.md)

The prior analysis covered West Street Mezzanine Partners VIII (19 columns, 338 LPs, flat table).
Key structural and content differences:

| Dimension | Old format (WSMF VIII) | New format (Petershill IV, GS) |
|-----------|------------------------|-------------------------------|
| LP count | 338 (flat) | 56 included + 20 excluded |
| Layout | Flat table, row 1 header | Multi-section, row 11 header + preamble |
| Ratings | One combined `Rating If Applicable (Moody's/S&P/Fitch)` cell | Separate `Investor S&P` + `Investor Moody` columns; no Fitch |
| Investor ID | `Investors` col (OX code) + `Investor Name` col | `Deal Investor Name` col only (OX code shown for excluded LPs) |
| Commitment | `Total Capital Commitments ($)` | `Original Commitment` |
| Uncalled | `Unfunded Capital Commitments ($)` | `Unfunded Capital Commitment` |
| Post-concentration intermediate cols | `Borrowing Base UCC After Concentration Limit`, `Aggregate Concentration Limit`, `Aggregate Concentration`, `Borrowing Base UCC After Aggregate Concentration Limit` | None — these collapse into `Eligible Commitment` directly |
| LP-level BB | `Borrowing Base ($)` | `Borrowing Base Contribution` |
| AUM/NAV info | None | `NAV Range (USD)` (categorical bucket, Non-Rated only) |
| LP percentage cols | None | `% Called`, `% of Unfunded Commitment`, `% of Eligible Unfunded Commitment`, `% of Borrowing Base` |
| Excess concentration | None | `Excess Concentration` (all zero in this file) |
| LP category | `Investor Type` column | Section-header rows filled down |
| Notes | `Notes` column | None |
| Vehicle/Borrower/Group | `Vehicle`, `Borrower`, `Group Name` columns | None |

Problems from the old analysis that are **resolved** in this format:
- §3.1 (combined ratings cell) — this file uses separate per-agency columns.
- §3.2 (no canonical for post-concentration amounts) — `Eligible Commitment` is a direct column.
- §3.4 (concentration collision) — no aggregate concentration columns; single `Concentration Limit` maps cleanly.

Problems from the old analysis that **persist or shift**:
- §3.3 (no Investor ID canonical) — still no OX code column; OX codes surface in excluded-LP rows.
- §3.5 (prototype `Borrowing Base` alias gap) — now resolved: `Borrowing Base Contribution` maps in both dicts.

---

## 7. Recommendations

1. **Add `Deal Investor Name` alias** on `Investor Name` in both dictionaries. (§4.1 — highest
   impact; primary identifier column currently lost.) ⚡ Quick win.

2. **Add `Investor S&P` (and `Investor Moodys`) aliases** on `S&P Rating` and `Moody's Rating`
   respectively in both dictionaries. (§4.2 — both rating columns lost.) ⚡ Quick win.

3. **Add `% of Unfunded Commitment` alias** on `% of Uncalled Capital` in both dictionaries.
   (§4.3 — near miss at 0.900, one alias closes it.) ⚡ Quick win.

4. **Fix the `Eligible` blocklist false-positive** (§4.5): scope it to non-derived canonicals, or
   exempt columns whose best JW match is a `isDerived: true` canonical. Without this, Col M
   (`Eligible Commitment`) silently disappears even though the exact canonical exists in the UI.

5. **Add `% of Eligible Unfunded Commitment` alias** on `% of Eligible Uncalled` in the UI
   dictionary (§4.5). Even after fixing the blocklist, Col J scores 0.867 — needs this alias to
   reach threshold.

6. **Backfill `Eligible Commitment` and `% of Eligible Uncalled` canonicals + aliases** into the
   prototype dictionary (§4.5 / §6). Currently both are UI-only; the prototype drops Cols J and M
   entirely.

7. **Implement section-aware LP extraction** (§5): detect section-header rows, fill LP Category
   down, skip subtotal/aggregate rows, handle the preamble block. This is a parser-level change in
   `pe-sub-extraction`, not a dictionary change.

8. **Decide canonical treatment for `NAV Range (USD)`** (§4.4): either add a Bank-scoped alias on
   `AUM` or introduce an `AUM Tier` canonical for categorical bucket data. Flag as GS-specific.

9. **Keep prototype and UI dictionaries in sync** (§6): every alias/canonical added above should
   land in both `fieldMappingData.js` (prototype) and `fieldMappingData.ts` (UI) plus the
   `V1_2__seed.sql` seed.

---

## 8. Facility-Level Data (Preamble)

The preamble block (rows 4–9) carries facility-level metrics not currently stored in the LP table.
These belong to the submission/facility record, not individual LPs:

| Field | Value | Suggested destination |
|-------|-------|----------------------|
| Borrowing Base | $10,764,017,102 | Submission `borrowingBase` |
| Eligible Remaining Commitments | $12,420,230,396 | Submission `eligibleCommitments` |
| Total Remaining Commitments | $12,491,495,101 | Submission `totalRemainingCommitments` |
| Total Original Commitments | $22,919,734,325 | Submission `totalOriginalCommitments` |
| Effective Advance Rate | 86.17% | Submission `effectiveAdvanceRate` |
| Apply Individual Concentration Limits | True | Submission `applyConcentrationLimits` (boolean) |

The extractor should parse this preamble separately and attach these values to the submission
record rather than any LP row.
