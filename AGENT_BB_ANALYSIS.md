# Agent BB Format Analysis — `Agent_BB.xlsx`

Analysis of the new Agent Borrowing Base export (`Agent_BB.xlsx`) and the gaps between
its column layout and the existing Field Mapping (alias) dictionaries in the **prototype**
(`pe-sub-platform/src/data/fieldMappingData.js`) and the **active UI**
(`pe-sub-ui/src/data/fieldMappingData.ts`).

- **Workbook**: `pe-sub-docs/Agent_BB.xlsx`
- **Sheet**: `Borrowing Base` (single sheet)
- **Shape**: 19 columns (A–S), 1 header row + **338 LP records** (rows 2–339). No subtotal / grand-total rows.
- **Source format**: West Street Mezzanine Partners VIII — agent-produced BB, decimal rates, `NR` / `N/A` / `-` null markers.

> **How matches were determined.** The extraction pipeline matches headers with
> `HeaderMatcher` (`pe-sub-extraction`): each header is `normalize()`d (lower-cased,
> all non-alphanumerics → spaces, whitespace collapsed) and scored against every alias with
> **Jaro-Winkler**; a column is mapped only when the best alias scores **≥ 0.95**, otherwise it
> lands in `unrecognizedColumns`. Crucially, `normalize()` strips `($)` / `(%)` / `&` / `/`,
> so suffix-only differences do **not** break a match. Every result below was reproduced with
> [`scripts/agent_bb_match_check.py`](scripts/agent_bb_match_check.py), which replicates that exact algorithm against both dictionaries.

---

## 1. Column Inventory

| Col | Header (verbatim) | Kind | Observed values / sample |
|-----|-------------------|------|--------------------------|
| A | `Investors` | Identifier | LP reference code, e.g. `OX20878` (blank on the aggregate row) |
| B | `Investor Name` | Identity | Full legal name; **falls back to the `OX#####` code** when no name is held |
| C | `Vehicle` | Structure | Feeder / SLP vehicle, e.g. `West Street Mezzanine Partners VIII Offshore, L.P.` |
| D | `Borrower` | Structure | Borrower entity / holdings vehicle, or status text `Subscription Agreement Needed` |
| E | `Group Name` | Identity | LP grouping / aggregation label (sparsely populated) |
| F | `Investor Type` | Classification | `Designated PWM` (154), `Rated Included` (75), `Designated Institutional` (64), `Non-Rated Included` (45) |
| G | `Included in Calculation of Sponsor Commitment` | Flag | `Y` (313) / `N` (24) |
| H | `Total Capital Commitments ($)` | Commitment | USD numeric, e.g. `2,500,000,000` |
| I | `Unfunded Capital Commitments ($)` | Uncalled | USD numeric |
| J | `Advance Rate (%)` | Borrowing Base | Decimal: `0.75` (217), `0.90` (120) |
| K | `Concentration (%)` | Concentration | Decimal, e.g. `0.04`, `0` |
| L | `Concentration Limits (%)` | Concentration | Per-LP cap: `0.01`, `0.05`, `0.20`, `0.40`, `0.03` |
| M | `Borrowing Base UCC After Concentration Limit ($)` | Derived | USD — uncalled after per-LP concentration cap |
| N | `Aggregate Concentration Limit` | Concentration | `0.25` (217) or `N/A` (120) |
| O | `Aggregate Concentration` | Concentration | All `-` in this file (placeholder / not computed) |
| P | `Borrowing Base UCC After Aggregate Concentration Limit ($)` | Derived | USD — uncalled after aggregate cap |
| Q | `Borrowing Base ($)` | Borrowing Base | USD — `= M/P × Advance Rate` |
| R | `Rating If Applicable (Moody's/S&P/Fitch)` | Ratings | **One combined cell**, `Moody's / S&P / Fitch` order, e.g. `A3 / A- / A-`, `NR / NR / NR`, `/ A / A-` |
| S | `Notes` | Free text | Analyst commentary, e.g. `Ultimate Parent CNO Financial` |

---

## 2. Mapping Results (new header → canonical field)

Confidence is the best Jaro-Winkler score after normalization; **≥ 0.95 = auto-mapped**.

| Col | Header | UI dictionary | Prototype dictionary | Status |
|-----|--------|---------------|----------------------|--------|
| A | Investors | Investor Name `0.978` | Investor Name `0.978` | ⚠️ **False positive** — see §3.3 |
| B | Investor Name | Investor Name `1.000` | Investor Name `1.000` | ✅ Mapped |
| C | Vehicle | — `0.690` | — `0.636` | ❌ **Unmapped** |
| D | Borrower | — `0.859` | — `0.859` | ❌ **Unmapped** |
| E | Group Name | — `0.819` | — `0.819` | ❌ **Unmapped** |
| F | Investor Type | Investor Type `1.000` | Investor Type `1.000` | ✅ Mapped |
| G | Included in Calculation of Sponsor Commitment | — `0.749` | — `0.749` | ❌ **Unmapped** |
| H | Total Capital Commitments ($) | Capital Commitments `1.000` | Capital Commitments `1.000` | ✅ Mapped |
| I | Unfunded Capital Commitments ($) | Uncalled Capital `1.000` | Uncalled Capital `1.000` | ✅ Mapped |
| J | Advance Rate (%) | Advance Rate `1.000` | Advance Rate `1.000` | ✅ Mapped |
| K | Concentration (%) | Concentration (%) `1.000` | Concentration (%) `1.000` | ✅ Mapped |
| L | Concentration Limits (%) | Concentration Limit `0.990` | Concentration Limit `0.990` | ✅ Mapped (fuzzy) |
| M | Borrowing Base UCC After Concentration Limit ($) | — `0.880` | — `0.880` | ❌ **Unmapped** — see §3.2 |
| N | Aggregate Concentration Limit | Concentration Limit `0.959` | Concentration Limit `0.959` | ⚠️ **Collision** — see §3.4 |
| O | Aggregate Concentration | Concentration Limit `1.000` | Concentration Limit `1.000` | ⚠️ **Collision + wrong field** — see §3.4 |
| P | Borrowing Base UCC After Aggregate Concentration Limit ($) | — `0.858` | — `0.858` | ❌ **Unmapped** — see §3.2 |
| Q | Borrowing Base ($) | Borrowing Base `1.000` | — `0.904` | ⚠️ **Prototype gap** — see §3.5 |
| R | Rating If Applicable (Moody's/S&P/Fitch) | — `0.791` | — `0.791` | ❌ **Unmapped** — see §3.1 |
| S | Notes | — `0.685` | — `0.685` | ❌ **Unmapped** |

**Scorecard:** 7 clean matches (B, F, H, I, J, K, + Q in UI only) · 1 fuzzy match (L) · 3 problematic auto-matches (A, N, O) · 8 unmapped (C, D, E, G, M, P, R, S) · 1 prototype-only gap (Q).

---

## 3. Gap Analysis

### 3.1 Structural gap — combined ratings column (Col R) 🔴 highest impact

Both dictionaries model ratings as **three separate canonical fields** — `S&P Rating`,
`Moody's Rating`, `Fitch Rating` — each expecting its own column. The new format packs all
three into a **single cell** in fixed `Moody's / S&P / Fitch` order:

| Cell value | Moody's | S&P | Fitch |
|------------|---------|-----|-------|
| `A3 / A- / A-` | A3 | A- | A- |
| `NR / NR / NR` | — (null) | — (null) | — (null) |
| `/ A / A-` | (blank) | A | A- |
| `A1 / NR / NR` | A1 | — (null) | — (null) |

There is no alias for the combined header and no split logic anywhere in the pipeline, so the
column is dropped to `unrecognizedColumns` and **all three ratings are lost**. This needs a
dedicated pre-processor that splits Col R on `/` into the three existing canonical fields,
applying the standard `NR` / `N/A` null-marker rules per token, and tolerating empty positions
(leading/trailing `/`).

### 3.2 Derived post-concentration columns (Cols M, P) — no canonical target

`Borrowing Base UCC After Concentration Limit` (M) and `… After Aggregate Concentration Limit`
(P) are the eligible uncalled amounts after the per-LP and aggregate caps respectively.

- **UI** has a semantically correct home: canonical **`Eligible Commitment`** (group *Borrowing Base*, `isDerived: true`, disambiguation: *"LP uncalled commitment after per-LP concentration haircut applied"*) — but no alias matches either header, so they stay unmapped. Note Col M's header contains `After Concentration`, which is a `GLOBAL_BLOCKLIST` qualifier; Col P (`After Aggregate Concentration`) is **not** caught by that term.
- **Prototype** has **no `Eligible Commitment` field at all** — there is neither an alias nor a target.

The aggregate variant (P) has no canonical equivalent in either dictionary (no
"Eligible Commitment after aggregate cap" concept exists).

### 3.3 False-positive auto-match (Col A `Investors`) ⚠️

`Investors` normalizes to `investors`, which scores **0.978** against the `Investor` alias of
`Investor Name` — above the 0.95 threshold. But Col A actually holds the **LP reference code**
(`OX#####`), not a name. Consequences:

1. Col A is silently mis-mapped to **Investor Name**, the same field as Col B (the real name).
2. The `OX#####` identifier — a genuinely useful primary key — has **no canonical field** and is discarded.

There is no `Investor ID` / `Reference Code` canonical field in either dictionary.

### 3.4 Concentration collision — three columns collapse to one field (Cols L, N, O) ⚠️

The new format distinguishes three concentration concepts; the dictionaries only have one cap field:

| Col | Header | Auto-maps to | Should be |
|-----|--------|--------------|-----------|
| K | Concentration (%) | `Concentration (%)` ✅ | the LP's actual concentration |
| L | Concentration Limits (%) | `Concentration Limit` (0.990) | **per-LP** cap |
| N | Aggregate Concentration Limit | `Concentration Limit` (0.959) | **aggregate/class** cap |
| O | Aggregate Concentration | `Concentration Limit` (1.000) | the actual aggregate concentration value |

Cols **L, N and O all resolve to the single `Concentration Limit` canonical** (the `Aggregate
Concentration` alias is, mis-categorised, parked under `Concentration Limit`). Whichever column
is processed last wins; the other two are overwritten/lost. Worse, Col O is a *measured value*
(aggregate concentration), not a *limit*, so even its match is semantically wrong. The model
needs separate `Aggregate Concentration Limit` and `Aggregate Concentration` canonical fields,
mirroring the existing per-LP `Concentration Limit` / `Concentration (%)` split.

### 3.5 Prototype-only gap — `Borrowing Base ($)` (Col Q)

The UI added a bare **`Borrowing Base`** alias (id 141) on the `Borrowing Base` field, so
`Borrowing Base ($)` → `borrowing base` matches exactly (1.000). The **prototype never received
this alias** — its closest entries are `Agent Borrowing Base` (0.904) and `Borrowing Base
Contribution`, both below threshold — so the prototype drops the headline BB column entirely
(0.904 < 0.95). This is the one column where prototype and UI behaviour diverge.

### 3.6 Genuinely new business columns with no canonical home

Beyond the cases above, these carry real data the platform cannot currently capture:

| Col | Header | Nature | Nearest existing concept |
|-----|--------|--------|--------------------------|
| A | Investors | LP reference code (`OX#####`) | none — needs `Investor ID` |
| C | Vehicle | Feeder / SLP vehicle name | none |
| D | Borrower | Borrower entity / subscription status | facility `Borrower` exists in UI as a *facility* attribute, not per-LP |
| E | Group Name | LP aggregation label | partially overlaps `Parent / Sponsor` but distinct |
| G | Included in Calculation of Sponsor Commitment | Y/N flag | not `Eligibility Flag` (UI) — that is a different concept |
| S | Notes | Free-text analyst note | rendered in ShadowBB UI as `lp.notes`, but not a mappable canonical field |

---

## 4. Prototype vs UI — dictionary coverage difference

Independent of this file, the prototype dictionary is a **subset** of the UI's (24 vs 31
canonical fields). Fields present in UI but **absent from the prototype** that are relevant to
the Agent BB format:

- `Eligible Commitment` *(Borrowing Base)* — the natural target for Cols M/P (§3.2)
- `Borrowing Base` plain alias *(id 141)* — the reason Col Q fails in the prototype (§3.5)
- `% of Eligible Uncalled`, `Eligibility Flag`, `Recallable Distributions`, and the GS numeric
  rating scores (`S&P / Moody's / Numeric Rating`) — not exercised by this file but part of the drift.

Any remediation should land in **both** dictionaries (and the `V1_2__seed.sql` seed the UI dictionary
mirrors) to keep prototype and live behaviour aligned.

---

## 5. Recommendations

1. **Split the combined ratings column (§3.1).** Add a pre-extraction transform that detects
   `Rating … (Moody's/S&P/Fitch)`-style headers and explodes the `/`-delimited cell into the
   existing `Moody's Rating`, `S&P Rating`, `Fitch Rating` fields, honouring `NR`/`N/A` null
   markers and empty positions. Highest priority — currently 100% of agent ratings are lost.
2. **Add an `Investor ID` canonical field** (Identity group) and alias `Investors`, so Col A
   stops colliding with `Investor Name` and the `OX#####` key is retained (§3.3). Optionally
   tighten the `Investor` alias to avoid the 0.978 false positive.
3. **Add `Aggregate Concentration Limit` and `Aggregate Concentration` canonical fields** and
   re-home the existing `Aggregate Concentration` alias off `Concentration Limit`, resolving the
   L/N/O collision (§3.4). Map Col L → `Concentration Limit`, N → `Aggregate Concentration
   Limit`, O → `Aggregate Concentration`.
4. **Add aliases for the post-concentration eligible amounts (§3.2):** map Col M → `Eligible
   Commitment` (UI) and add an aggregate counterpart; backfill `Eligible Commitment` into the
   prototype dictionary so both behave the same.
5. **Backfill the prototype `Borrowing Base` alias (§3.5)** so Col Q maps in prototype mode.
6. **Add canonical fields/aliases for `Vehicle`, `Borrower`, `Group Name`, the Sponsor-Commitment
   flag, and `Notes`** (§3.6), or explicitly decide they are out of scope so they are documented
   rather than silently unrecognised.
7. **Keep prototype and UI dictionaries in sync (§4)** — apply every change to both files and the
   `V1_2__seed.sql` seed.

---

## 6. Reproducing this analysis

```bash
cd pe-sub-docs
python scripts/agent_bb_match_check.py   # prints the §2 mapping table for both dictionaries
```

The script mirrors `HeaderMatcher.normalize()` + Jaro-Winkler at the 0.95 threshold. If the
dictionaries change, re-run it to refresh §2.
