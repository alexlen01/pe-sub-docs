# Borrowing Base Criteria — Advance Rate & Concentration Limit Design

**Status:** Design / analysis — **awaiting approval. No code changed.**
**Source:** `pe-sub-docs/Concentration_Limits.xlsx`, tabs **2 ("Borrowing Base Criteria")** and **3 ("UBS LP Classification")**.
**Author:** Solutions Architecture
**Date:** 2026-07-09

---

## 1. Purpose & Scope

The PE Sub business team maintains `Concentration_Limits.xlsx` as the authoritative rulebook the credit
team applies when assigning **per-LP concentration limits** and **UBS (BUSA) advance rates** in the Shadow
Borrowing Base. This document:

1. Transcribes tabs 2 and 3 exactly (Section 3).
2. States the domain semantics and the two **new** dimensions the workbook introduces (Section 4).
3. Compares the workbook to what the platform computes today, with exact deltas (Section 5).
4. Lists the open questions that require business confirmation before build (Section 6).
5. Proposes the change, **sequenced Configuration → Run/Re-run Shadow BB**, per the agreed rollout order
   (Sections 7–8).

The workbook changes only the **inputs to the existing calculation** (the per-LP advance rate and the
per-LP concentration limit). It does **not** change the borrowing-base arithmetic itself
(`UEC = min(UC, CL)`, `UBB = UEC × advance rate`, EAR, or the portfolio-level breach tests). Those remain
as implemented in `BbCalculationService` / `bbCalculationService.ts`.

---

## 2. Where This Sits Today (as-built anchors)

| Concern | Backend | Frontend / Config |
|---|---|---|
| Advance-rate default by class | `BbCalculationService.getRateForCls` (reads `classification_config.BUSA_RATE_MAP` / `UBS_CLS_DEFAULT_RATE`) | `bbCalculationService.ts:advanceRateFraction`; `RunShadowBB/index.tsx` `buildOverride` (`busaRatePctForCls`) |
| Per-LP concentration limit default | `BbCalculationService.perLpConc` + `loadClsConcDefaults` (reads `cls_conc_limit_defaults`) | `RunShadowBB` `buildOverride` (`clsConcLimitPctForCls`), Configuration §1b "Per-LP Concentration Limit Defaults" |
| Manual override (wins over default) | `LpRecord.ubsRate`, `LpRecord.ubsConc` → `lp_rates` | RunShadowBB "UBS Advance Rate" / "UBS Concentration Limit" columns |
| Config keys | `config` table: `classification_config`, `cls_conc_limit_defaults`, `cls_conc_limit_bounds`, `conc_limits` | `GET/PUT /api/config/eligibility`, `GET /api/config/classification`, `POST /api/config/reload` |
| Run / Re-run | `POST /api/bb/run/{facilityId}` → `ShadowBbService.runAndSnapshot` → `BbCalculationService.compute` | `RunShadowBB/index.tsx` |
| Funded % (already present) | `BbController.calledCapM/capCommitM` | RunShadowBB computes `pctCalled = calledCap ÷ capCommit` and renders it as **"% of LP Called"** |

**Key fact:** the current per-LP config was seeded from **tab 1 ("Standard Limits")** — its `cls_conc_limit_bounds`
ranges (`Rated 15–20`, `Unrated NAV 10–15`, `FoF 7.5–10`, `Corp Pension 10–12.5`, `Other Inst 5–7.5`, `Excluded 0`)
match tab 1 verbatim, and the stored `cls_conc_limit_defaults` are the upper bounds of those ranges. **Tabs 2–3
supersede tab 1** with rating-band-specific limits and a funded-percentage advance-rate split. The platform has
not yet adopted tabs 2–3.

---

## 3. Source Transcription (verbatim)

### 3.1 Tab 3 — "UBS LP Classification" (canonical class list, 9 values)

```
1. Rated Investor
2. Corp Pension > $5Bn Assets
3. Corp Pension > $1Bn Assets
4. Unrated NAV > $1Bn
5. FoF & Other > $10Bn AUM
6. Other Institutional
7. NHW Feeder (acceptable)      ← "NHW" is read as a typo for "HNW"; see Q3
8. NHW (acceptable)            ← "NHW" is read as a typo for "HNW"; see Q3
9. Excluded
```

### 3.2 Tab 2 — "Borrowing Base Criteria" (the matrix)

Column layout: **Investor Classification | Concentration Limit | Advance Rate (Less than 40% Funded) | Advance Rate (40% or more Funded)**.
Section rows ("Rated Investors", "Unrated Investors", "Corporate Pension (Total Assets)", "Designated Investors")
are group headers, not data.

**Rated Investors** — resolved by agency rating band:

| Rating band (S&P / Moody's) | Conc. Limit | AR < 40% Funded | AR ≥ 40% Funded |
|---|---:|---:|---:|
| AAA / Aaa | 25% | 90% | 90% |
| AA+ / Aa1 … AA− / Aa3 | 20% | 90% | 90% |
| A+ / A1 … A− / A3 | 15% | 90% | 90% |
| BBB+ / Baa1 … BBB− / Baa3 | 10% | **65%** | 90% |

**Unrated Investors** — *Corporate Pension (Total Assets)*, then unrated NAV:

| Classification | Conc. Limit | AR < 40% | AR ≥ 40% |
|---|---:|---:|---:|
| More than USD 5B (→ `Corp Pension > $5Bn Assets`) | 25% | 90% | 90% |
| More than USD 1B (→ `Corp Pension > $1Bn Assets`) | 20% | 90% | 90% |
| Unrated Investors NAV more than USD 1B (→ `Unrated NAV > $1Bn`) | 15% | 90% | 90% |

**Designated Investors:**

| Classification | Conc. Limit | AR < 40% | AR ≥ 40% |
|---|---:|---:|---:|
| Funds of Funds & Other Asset Managers (above USD 10B AUM) (→ `FoF & Other > $10Bn AUM`) | 10% | 65% | 75% |
| Other Institutional Investors (→ `Other Institutional`) | 5% | 50% | 65% |
| High Net Worth (HNW) feeders with Acceptable Criteria (→ `NHW/HNW Feeder (acceptable)`) | 5% | 50% | 65% |
| Other Acceptable Family Offices & HNW Investors (→ `NHW/HNW (acceptable)`) | 1% | **0%** | 50% |

**Excluded** (implicit; consistent with tab 1 and current engine): Conc. Limit 0%, AR 0% / 0%.

> The full raw cell dump (addresses, values, merge ranges) is reproduced in Appendix A for audit.

---

## 4. Domain Semantics — the two new dimensions

The workbook adds structure the platform does not currently model:

### 4.1 Advance rate is a function of **funding level**, not just class

Advance rate now depends on **(classification, % Funded)** with a single break at **40%**:

- **Strong credits** — Rated AAA/AA/A, all Corporate Pensions, Unrated NAV > $1Bn — are **90% at both
  funding levels** (funded level is irrelevant).
- **Weaker credits** — Rated **BBB**, FoF, Other Institutional, HNW feeder, HNW/Family Office — **step up**
  once the LP crosses **40% funded**. Rated BBB: 65% → 90%. FoF: 65% → 75%. Other Inst / HNW feeder:
  50% → 65%. HNW/Family Office: **0% → 50%** (i.e. contributes nothing to the base until 40% funded).

Business rationale: uncalled capital from an LP that has already honoured a large share of its capital calls
is lower-risk collateral, so the advance rate rises once demonstrated funding passes the threshold. The
strongest credits already earn the maximum rate and do not step.

**Boundary rule:** "40% or more" is inclusive — an LP at exactly 40% uses the **≥40%** column.

**Funded input:** the platform already carries a per-LP `pctCalled = Called Capital ÷ Capital Commitments`
(`RunShadowBB` line ~188, displayed as "% of LP Called"; backend `BbController.calledCapM/capCommitM`). This is
the natural driver — **pending confirmation the business means the LP's own funded %, not a fund/facility-level
funded %** (see Q1).

### 4.2 Concentration limit for Rated Investors is a function of **rating band**

Rated Investors no longer take one flat limit; the limit steps by agency rating band: **AAA 25% / AA 20% /
A 15% / BBB 10%**. This requires resolving the LP's rating band from `sp` / `mdy` / `fitch`. Concentration
limit is **funded-independent** (single column) for every class.

### 4.3 Two-level taxonomy

Tab 2's section headers (Rated / Unrated / Designated / Excluded) are the **LP Category** risk buckets; tab 3's
9 values are the granular **UBS LP Classification**. This matches the platform's existing category-vs-class
split (`canonicalClassBucket` in `BbController` rolls classes up into "Rated / Unrated / Eligible / Excluded
Investors"). The 9-class list is the resolution key; the category is display/rollup only.

---

## 5. Gap Analysis — workbook vs. current platform config

Current runtime values are from `V1_3__config.sql` (`classification_config`, `cls_conc_limit_defaults`).

### 5.1 Advance rate

| UBS Classification | Current (flat) | Workbook < 40% | Workbook ≥ 40% | Change |
|---|---:|---:|---:|---|
| Rated Investor | 90% | 90% (AAA/AA/A) · **65% (BBB)** | 90% | Adds BBB-early carve-out + rating-band awareness |
| Corp Pension > $5Bn Assets | 65% | **90%** | **90%** | **+25 pp** |
| Corp Pension > $1Bn Assets | *(absent)* | 90% | 90% | **New class** |
| Unrated NAV > $1Bn | 75% | **90%** | **90%** | **+15 pp** |
| FoF & Other > $10Bn AUM | 75% | **65%** | 75% | −10 pp when < 40% funded |
| Other Institutional | 50% | 50% | **65%** | +15 pp when ≥ 40% funded |
| HNW Feeder (acceptable) | *(absent; ≈ "Included (PWM)" 50% in prototype)* | 50% | 65% | **New class** |
| HNW (acceptable) | *(absent)* | 0% | 50% | **New class** |
| Excluded | 0% | 0% | 0% | — |

The advance-rate value set is unchanged (**90/75/65/50/0**), so the `summaryExt` Table-3 BUSA buckets
(`BbController` lines ~159–168) remain valid — only which LPs land in each bucket changes.

### 5.2 Per-LP concentration limit

| UBS Classification | Current CL | Workbook CL | Change |
|---|---:|---:|---|
| Rated Investor | 20% (flat) | **25 / 20 / 15 / 10%** by band (AAA/AA/A/BBB) | Now rating-band-specific |
| Corp Pension > $5Bn Assets | 12.5% | **25%** | **+12.5 pp** |
| Corp Pension > $1Bn Assets | *(absent)* | 20% | **New class** |
| Unrated NAV > $1Bn | 15% | 15% | — (matches) |
| FoF & Other > $10Bn AUM | 10% | 10% | — (matches) |
| Other Institutional | 7.5% | **5%** | −2.5 pp |
| HNW Feeder (acceptable) | *(absent)* | 5% | **New class** |
| HNW (acceptable) | *(absent)* | 1% | **New class** |
| Excluded | 0% | 0% | — |

### 5.3 Net effect

- **Materially increases** the borrowing base for Corporate-Pension-heavy and large-unrated facilities
  (higher AR *and* higher CL).
- **Reduces** availability from early-life FoF positions and early-life BBB-rated LPs (lower AR while < 40% funded).
- Introduces three new eligible buckets (Corp Pension > $1Bn, HNW Feeder, HNW/Family Office) with an
  explicit ramp for HNW/Family Office (0% until 40% funded).

### 5.4 Taxonomy drift to reconcile

The three sources of the class list disagree and must be aligned to tab 3:

| Source | Classes |
|---|---|
| **Workbook tab 3 (target)** | Rated Investor · Corp Pension > $5Bn · Corp Pension > $1Bn · Unrated NAV > $1Bn · FoF & Other > $10Bn · Other Institutional · HNW Feeder · HNW · Excluded |
| DB `classification_config` (`V1_3`) | Rated Investor · Unrated NAV > $1Bn · FoF & Other > $10Bn · Corp Pension > $5Bn · Other Institutional · Excluded |
| Prototype `pe-sub-platform/.../classificationConfig.ts` | Rated Investor · FoF & Other > $10Bn · Unrated NAV > $1Bn · Corp Pension > $5Bn · Other Institutional · **Included (PWM)** · Excluded |

Note the prototype's `Included (PWM)` bucket has no direct workbook equivalent; the workbook's HNW Feeder / HNW
appear to be its successors (Q5). Since the UI must remain visually aligned to the prototype, the prototype's
`classificationConfig.ts` and the DB config must be updated **together**.

---

## 6. Decisions (resolved 2026-07-09)

Q1–Q3 and Q5 confirmed with product; Q4/Q6/Q7/Q8 adopt the documented default and remain
subject to business veto (reversible — the workbook adoption ships behind an "undo if business
disagrees" posture). All are now treated as **build inputs**.

| # | Question | Decision | Status |
|---|---|---|---|
| **Q1** | Grain of "% Funded" | **Per-LP `pctCalled`** (Called ÷ Commitment), evaluated per LP row. Reversible if the business means fund-level. | ✅ Confirmed |
| **Q2** | Rating-band selection / sub-IG handling | **Tri-party "eligible rating" waterfall** over S&P/Moody's/Fitch (all three fully integrated, Fitch included as determinant/tie-breaker): **three ratings → middle (median); two → the lower (conservative); one → that rating.** The resulting rating maps to a band; **below BBB− clamps to the BBB row** (CL 10%, AR 65% <40% / 90% ≥40%). Supersedes the earlier "highest wins". | ✅ Confirmed |
| **Q3** | "NHW" vs "HNW" | **Typo — canonical labels are `HNW Feeder (acceptable)` / `HNW (acceptable)`.** | ✅ Confirmed |
| **Q4** | Corp Pension bucket boundaries | `> $5Bn` takes precedence; `> $1Bn` = $1B ≤ assets ≤ $5B (upstream classification concern, not the matrix). | ⚙️ Default adopted |
| **Q5** | HNW vs prototype "Included (PWM)" | **Retire `Included (PWM)`.** Map agent `Designated PWM` → `HNW Feeder (acceptable)`; migrate existing `cls = 'Included (PWM)'` LP records → `HNW Feeder (acceptable)`. | ✅ Confirmed |
| **Q6** | Funded-split scope | Advance rate only; **concentration limit is funded-independent** (single column). | ⚙️ Default adopted |
| **Q7** | Default vs hard-lock | Deterministic **suggested default**; per-LP manual override preserved (Section 7.4). | ⚙️ Default adopted |
| **Q8** | Snapshot restatement | **No back-restatement** of committed snapshots; only new Run/Re-run picks up the new criteria. | ⚙️ Default adopted |

**Rating-band resolution (Q2) — implementation notes.** The Stage-2 resolver converts each present
agency rating (S&P/Moody's/Fitch) to a unified notch on a single ordinal scale, applies the split-rating
waterfall to pick the **eligible rating** — median of three, lower of two, or the single rating — then
maps that eligible rating to a band (`ratingBands`). Sub-BBB− clamps to the **BBB** row, so a rated LP is
never reclassified out of the Rated bucket. Config drives this via `ratingBandSelection: "middle"` +
`ratingBandTieBreak: { three:"middle", two:"lower", one:"asIs" }` in `bb_criteria_matrix`. The
**"lower of two"** rule for the two-rating case is the standard conservative convention and is an
assumption (the workbook's waterfall text covers the three-agency case explicitly); flag if the credit
agreements specify otherwise. The workbook's agency rating ranges are carried verbatim as the `label` on
each rated band (e.g. `"AA+ / Aa1 to AA- / Aa3"`).

---

## 7. Proposed Design

### 7.1 Data model for the criteria (new config key)

Encode tab 2 as one JSONB config key, **`bb_criteria_matrix`**, so the (band, funded-split, CL, AR) tuples
live together as a single governable artifact editable on the Configuration screen. Shape:

```jsonc
{
  "fundedThresholdPct": 40,          // the single break point; ">= this" uses the higher AR column
  "ratingBands": {                   // maps agency ratings → band, for Rated Investor CL/AR resolution
    "AAA": { "sp": ["AAA"],                 "moodys": ["Aaa"] },
    "AA":  { "sp": ["AA+","AA","AA-"],      "moodys": ["Aa1","Aa2","Aa3"] },
    "A":   { "sp": ["A+","A","A-"],         "moodys": ["A1","A2","A3"] },
    "BBB": { "sp": ["BBB+","BBB","BBB-"],   "moodys": ["Baa1","Baa2","Baa3"] }
  },
  "rated": [                         // Rated Investor, resolved by band
    { "band": "AAA", "concLimitPct": 25, "advanceRatePct": { "lt40": 90, "gte40": 90 } },
    { "band": "AA",  "concLimitPct": 20, "advanceRatePct": { "lt40": 90, "gte40": 90 } },
    { "band": "A",   "concLimitPct": 15, "advanceRatePct": { "lt40": 90, "gte40": 90 } },
    { "band": "BBB", "concLimitPct": 10, "advanceRatePct": { "lt40": 65, "gte40": 90 } }
  ],
  "classes": [                       // all non-rated classes, resolved by cls label (tab 3)
    { "cls": "Corp Pension > $5Bn Assets", "category": "Unrated",    "concLimitPct": 25, "advanceRatePct": { "lt40": 90, "gte40": 90 } },
    { "cls": "Corp Pension > $1Bn Assets", "category": "Unrated",    "concLimitPct": 20, "advanceRatePct": { "lt40": 90, "gte40": 90 } },
    { "cls": "Unrated NAV > $1Bn",         "category": "Unrated",    "concLimitPct": 15, "advanceRatePct": { "lt40": 90, "gte40": 90 } },
    { "cls": "FoF & Other > $10Bn AUM",    "category": "Designated", "concLimitPct": 10, "advanceRatePct": { "lt40": 65, "gte40": 75 } },
    { "cls": "Other Institutional",        "category": "Designated", "concLimitPct": 5,  "advanceRatePct": { "lt40": 50, "gte40": 65 } },
    { "cls": "HNW Feeder (acceptable)",    "category": "Designated", "concLimitPct": 5,  "advanceRatePct": { "lt40": 50, "gte40": 65 } },
    { "cls": "HNW (acceptable)",           "category": "Designated", "concLimitPct": 1,  "advanceRatePct": { "lt40": 0,  "gte40": 50 } },
    { "cls": "Excluded",                   "category": "Excluded",   "concLimitPct": 0,  "advanceRatePct": { "lt40": 0,  "gte40": 0 } }
  ]
}
```

The existing flat keys stay populated for backward compatibility and non-rated fallbacks:
- `classification_config.UBS_CLS_OPTS` / `BUSA_RATE_MAP` / `UBS_CLS_DEFAULT_RATE` → updated to the 9 classes.
  Because `BUSA_RATE_MAP` cannot express a funded split, its value should be the **≥40% (mature) rate** as the
  legacy fallback, with the matrix as the precise source.
- `cls_conc_limit_defaults` / `cls_conc_limit_bounds` → refreshed from the matrix (non-rated classes as single
  values; Rated as its own band table in the matrix). Keeps Configuration §1b and
  `BbCalculationService.loadClsConcDefaults` working while the matrix is the authority.
- `AGENT_CLS_UBS_MAP` → updated per Q5.

### 7.2 Resolver (single source of truth, shared contract)

A pure function, mirrored on both tiers (as `advanceRateFraction`/`perLpConc` already are), takes:

```
resolveBbCriteria(cls, ratings{sp,mdy,fitch}, pctFunded) -> { advanceRatePct, concLimitPct }
```

Logic:
1. `Excluded` → `{ 0, 0 }` (hard, ahead of everything — matches current `perLpConc` guard).
2. If `cls == "Rated Investor"`: resolve band from ratings via `ratingBands` (per Q2 tie-break); pick the
   `rated[band]` row. **Unresolvable/sub-IG → per Q2.**
3. Else: look up `classes[cls]`.
4. `funded = pctFunded >= fundedThresholdPct/100` → `advanceRatePct = row.advanceRatePct[funded ? "gte40" : "lt40"]`.
5. `concLimitPct = row.concLimitPct`.

### 7.3 Wiring (unchanged calculation, new inputs)

- **Backend** `BbCalculationService`:
  - `getRateForCls` / `advanceRateFraction` → default now comes from the resolver (funded/band aware). The
    stored per-LP `ubsRate` **still takes precedence** (per Q7) — the big comment at lines ~45–48 stays true;
    the workbook simply generates the correct default that produced that per-LP variance.
  - `perLpConc` → class default now comes from the resolver (band-aware for Rated) instead of the flat
    `clsConcDefaults` lookup.
- **Frontend** `RunShadowBB/index.tsx` `buildOverride` (lines ~449–475): replace the `busaRatePctForCls` /
  `clsConcLimitPctForCls` calls with the resolver, feeding `calc.pctCalled` and the row's `sp/mdy/fitch`. This
  changes only the **seeded suggestion** for `ubsAdvRatePct` / `concLimitPct`; the analyst can still edit.
- **Engine parity** `bbCalculationService.ts:advanceRateFraction` kept in lockstep with the backend resolver
  (existing "Mirrors the API's advanceRateFraction" contract).

### 7.4 Manual override preserved

No change to override precedence: `LpRecord.ubsRate` / `ubsConc` (and `lp_rates`) continue to win over the
computed default. The workbook makes the *default* deterministic and correct, reducing manual entry and drift.

---

## 8. Rollout Sequence (Configuration first, then Run/Re-run)

Per the agreed order, ship in two stages behind approval of Section 6.

**Stage 1 — Configuration (additive + taxonomy alignment; existing-class run numbers unchanged)**

Scope note: Stage 1 **adds** the authoritative `bb_criteria_matrix` and the three new classes, and aligns the
taxonomy (agent `Designated PWM` remap, PWM→HNW data migration). It deliberately **does not** change the
advance rate or concentration limit of the six *existing* classes in the flat legacy maps
(`BUSA_RATE_MAP`, `cls_conc_limit_defaults`). Those values only change in Stage 2, atomically with the resolver
that reads the matrix — so a run between the two stages behaves exactly as today for existing LPs, while the new
classes are already selectable. This keeps Stage 1 low-risk and independently shippable.

1. Config seed (consolidated into `V1_3__config.sql`; the DB is recreated fresh rather than
   incrementally migrated):
   - insert `bb_criteria_matrix` (full tab-2 target, incl. rating-range labels + middle-rating rule);
   - extend `classification_config`: add `Corp Pension > $1Bn Assets`, `HNW Feeder (acceptable)`, `HNW (acceptable)`
     to `CLS_OPTS`/`UBS_CLS_OPTS` with `BUSA_RATE_MAP`/`UBS_CLS_DEFAULT_RATE`/`CLS_TAG_MAP`/`CLS_CRITERIA`/
     `LP_CATEGORY_LABEL` entries (new classes seeded at their ≥40% mature values); remap
     `AGENT_CLS_UBS_MAP['Designated PWM'] → 'HNW Feeder (acceptable)'`; **existing six classes' values carried
     forward verbatim**;
   - extend `cls_conc_limit_defaults` / `cls_conc_limit_bounds` with the three new classes only;
   - data migration: `UPDATE lp_records SET cls='HNW Feeder (acceptable)' WHERE cls='Included (PWM)'` (safe no-op
     in the current DB — the class exists only in the prototype).
2. `ConfigController`: expose `bb_criteria_matrix` on `GET /api/config/eligibility`; register it in
   `ELIGIBILITY_LABELS` and accept it on `PUT /api/config/eligibility?section=bb_criteria_matrix`.
   `POST /api/config/reload` already refreshes the cache for pe-sub-jobs feeds.
3. Configuration screen: add a **"Borrowing Base Criteria Matrix"** editor (rating bands × funded split × class),
   alongside the existing §1 BUSA schedule / §1b per-LP CL defaults. Keep the prototype `classificationConfig.ts`
   in sync (visual parity requirement).
4. Config-shape tests + Configuration-screen render/save test.

**Stage 2 — Run / Re-run Shadow BB (behaviour switches on) — ✅ IMPLEMENTED**
5. Shared resolver: `BbCriteriaResolver` (backend) + `resolveBbCriteria` (`configService.ts`), kept in lockstep —
   funded split + tri-party middle-rating band. Wired into `BbCalculationService.advanceRateFraction` /
   `perLpConc`. **Resolution order (no legacy flat-map fallback):** per-LP `ubsRate`/`ubsConc` override →
   `bb_criteria_matrix` → (advance rate) **0%** / (conc limit) facility-level limit. The legacy paths were
   removed: `getRateForCls` and `loadClsConcDefaults` are deleted; a classification the matrix does not carry,
   with no explicit per-LP value, contributes 0% advance and falls to the facility conc limit. The
   `classification_config.BUSA_RATE_MAP` / `cls_conc_limit_defaults` keys remain in the DB only because the
   *agent-side* rate/limit seeding and the LP-Master entry form still read them — the borrowing-base engine does not.
6. `RunShadowBB` `buildOverride` (and the in-grid cls-change handler) seed `ubsAdvRatePct`/`concLimitPct` **solely**
   from the resolver using `pctFunded` (= called ÷ commitment) + ratings; a class outside the matrix keeps the
   LP's stored value (no flat-schedule fallback).
7. `POST /api/bb/run/{facilityId}` signature unchanged. **Re-run is the same endpoint invoked again**; a new
   snapshot is produced. Re-running an already-Active facility now yields different UBS BB numbers for affected
   classes — **expected** (Q8: prior snapshots are not restated).
8. Tests: `BbCriteriaResolverTest` — 20-case golden table straight from tab 2 (9 classes × funded states × 4
   bands + middle-rating tie-breaks); `resolveBbCriteria.test.ts` — matching frontend parity table;
   `ClsConcLimitDefaultIntegrationTest` reworked to the Stage-2 precedence chain; `BbRunIntegrationTest`
   updated (0%-funded FoF → 65%). **pe-sub-api 154 tests green · pe-sub-ui 178 tests green.**

### 8.1 Impact summary
- **Immutable:** existing `bb_snapshots`. **Changes on next run/re-run:** UBS BB, EAR, and the per-LP
  UEC/UBB for Corp Pension (↑), Unrated NAV (↑), FoF (↓ early-life), Other Inst (↑ mature), Rated BBB
  (↓ early-life), plus rating-band CLs.
- Portfolio breach tests (`conc_limits`: Single-LP 15%, Top-10 60%, Unrated 50%, Non-US 30%) are unchanged
  in definition but recompute against the new UBB.
- `summaryExt` BUSA buckets (90/75/65/50/0) remain valid.

---

## Appendix A — Raw cell dump (audit)

### Tab 2 "Borrowing Base Criteria" — range `A1:D37`
Merged: `A1:A2`, `B1:B2`, `C1:D1`, `A3:D3`, `A8:D8`, `B9:D9`, `A13:D13`.

```
A1 "Investor Classification" | B1 "Concentration Limit" | C1 "Advance Rate"
C2 "Less than 40% Funded" | D2 "40% or more Funded"
A3 [hdr] "Rated Investors"
A4 "AAA / Aaa"                            B4 25%  C4 90%  D4 90%
A5 "AA+ / Aa1 to AA- / Aa3"              B5 20%  C5 90%  D5 90%
A6 "A+ / A1 to A- / A3"                  B6 15%  C6 90%  D6 90%
A7 "BBB+ / Baa1 to BBB- / Baa3"          B7 10%  C7 65%  D7 90%
A8 [hdr] "Unrated Investors"
A9 [sub] "Corporate Pension (Total Assets)"
A10 "More than USD 5B"                    B10 25% C10 90% D10 90%
A11 "More than USD 1B"                    B11 20% C11 90% D11 90%
A12 "Unrated Investors NAV more than USD 1B" B12 15% C12 90% D12 90%
A13 [hdr] "Designated Investors"
A14 "Funds of Funds & Other Asset Managers (above USD 10B AUM)" B14 10% C14 65% D14 75%
A15 "Other Institutional Investors"       B15 5%  C15 50% D15 65%
A16 "High Net Worth (HNW) feeders with Acceptable Criteria" B16 5% C16 50% D16 65%
A17 "Other Acceptable Family Offices & HNW Investors"        B17 1% C17 0%  D17 50%
(rows 18–37 empty)
```

### Tab 3 "UBS LP Classification" — range `A1:A10`
```
A1 "UBS LP classification"        (header)
A2 "Rated Investor"
A3 "Corp Pension > $5Bn Assets"
A4 "Corp Pension > $1Bn Assets"
A5 "Unrated NAV > $1Bn "
A6 "FoF & Other > $10Bn AUM"
A7 "Other Institutional"
A8 "NHW Feeder (acceptable)"
A9 "NHW (acceptable)"
A10 "Excluded"
```

### Tab 1 "Standard Limits" (superseded reference — source of the *current* seed)
```
Rated Investor              15.0 – 20.0
Unrated NAV > $1Bn          10.0 – 15.0
FoF & Other > $10Bn AUM      7.5 – 10.0
Corp Pension > $5Bn Assets  10.0 – 12.5
Other Institutional          5.0 – 7.5
Excluded                     0
```
