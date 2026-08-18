# Borrowing Base Criteria — Advance Rate & Concentration Limit

## 1. Purpose

Every LP in a facility contributes to the Shadow Borrowing Base through two per-LP inputs:

- **Concentration Limit (CL)** — the maximum share of the base a single LP's uncalled capital may
  represent. It caps exposure to any one investor.
- **Advance Rate (AR)** — the fraction of that LP's eligible uncalled capital that actually counts
  toward the base. It discounts the collateral for credit risk.

Both are assigned per LP, per facility, and both are driven by the LP's **UBS LP Classification**.
Together they are the credit-risk dials of the borrowing base: classification determines how much of
an LP the bank is willing to lend against (CL) and how much of that it will actually advance (AR).

These two values are **inputs** to the borrowing-base calculation. They do not change the arithmetic
itself — `UEC = min(UC, CL)`, `UBB = UEC × advance rate`, EAR, and the portfolio-level breach tests
are all unaffected by how AR and CL are resolved.

---

## 2. The Criteria Matrix

The criteria are held as a single governable matrix keyed on classification, with two additional
dimensions: **agency rating band** (for rated investors) and **funding level** (for advance rate).

### 2.1 Rated Investors — resolved by rating band

| Rating band (S&P / Moody's) | Conc. Limit | AR < 40% Funded | AR ≥ 40% Funded |
|---|---:|---:|---:|
| AAA / Aaa | 25% | 90% | 90% |
| AA+ / Aa1 … AA− / Aa3 | 20% | 90% | 90% |
| A+ / A1 … A− / A3 | 15% | 90% | 90% |
| BBB+ / Baa1 … BBB− / Baa3 | 10% | 65% | 90% |

### 2.2 Unrated Investors

| Classification | Conc. Limit | AR < 40% | AR ≥ 40% |
|---|---:|---:|---:|
| Corp Pension > $5Bn Assets | 25% | 90% | 90% |
| Corp Pension > $1Bn Assets | 20% | 90% | 90% |
| Unrated NAV > $1Bn | 15% | 90% | 90% |

### 2.3 Designated Investors

| Classification | Conc. Limit | AR < 40% | AR ≥ 40% |
|---|---:|---:|---:|
| FoF & Other > $10Bn AUM | 10% | 65% | 75% |
| Other Institutional | 5% | 50% | 65% |
| HNW Feeder (acceptable) | 5% | 50% | 65% |
| HNW (acceptable) | 1% | 0% | 50% |

### 2.4 Excluded

Concentration Limit 0%, Advance Rate 0% at both funding levels. Excluded LPs contribute nothing to
the base.

---

## 3. The Two Resolution Dimensions

### 3.1 Advance rate is a function of funding level

Advance rate depends on **(classification, % Funded)** with a single break at **40%**.

- **Strong credits** — Rated AAA/AA/A, all Corporate Pensions, Unrated NAV > $1Bn — sit at **90% at
  both funding levels**; funding level is irrelevant because they already earn the maximum rate.
- **Weaker credits** — Rated BBB, FoF, Other Institutional, HNW Feeder, HNW — **step up** once the LP
  crosses 40% funded: BBB 65% → 90%, FoF 65% → 75%, Other Inst / HNW Feeder 50% → 65%, HNW 0% → 50%
  (contributing nothing to the base until the threshold is crossed).

The rationale is that uncalled capital from an LP that has already honoured a large share of its
capital calls is lower-risk collateral, so the advance rate rises once demonstrated funding passes
the threshold.

**Boundary rule:** "40% or more" is inclusive — an LP at exactly 40% uses the ≥40% column.

**Funded input:** the per-LP `pctCalled = Called Capital ÷ Capital Commitments`, evaluated per LP row
(not a fund- or facility-level funded percentage).

### 3.2 Concentration limit for Rated Investors is a function of rating band

Rated Investors do not take one flat limit; the limit steps by agency rating band — AAA 25% / AA 20% /
A 15% / BBB 10% — resolved from the LP's S&P, Moody's and Fitch ratings. Concentration limit is
**funded-independent**: a single value per row for every classification.

### 3.3 Rating-band selection (tri-party waterfall)

Each present agency rating (S&P / Moody's / Fitch) is converted to a unified notch on one ordinal
scale, then the **eligible rating** is picked:

- **three ratings → the middle (median)**
- **two ratings → the lower** (conservative convention)
- **one rating → that rating**

The eligible rating maps to a band. **Below BBB− clamps to the BBB row** (CL 10%, AR 65% / 90%), so a
rated LP is never reclassified out of the Rated bucket. Selection and tie-break behaviour are
config-driven (`ratingBandSelection`, `ratingBandTieBreak`) rather than hardcoded.

### 3.4 Two-level taxonomy

**LP Category** (Rated / Unrated / Designated / Excluded) is the risk bucket used for display and
rollup. **UBS LP Classification** is the granular 9-value list that is the actual resolution key:

```
1. Rated Investor
2. Corp Pension > $5Bn Assets
3. Corp Pension > $1Bn Assets
4. Unrated NAV > $1Bn
5. FoF & Other > $10Bn AUM
6. Other Institutional
7. HNW Feeder (acceptable)
8. HNW (acceptable)
9. Excluded
```

Corporate Pension bucketing: `> $5Bn` takes precedence; `> $1Bn` means $1B ≤ assets ≤ $5B. This is an
upstream classification concern, not a matrix concern.

---

## 4. Configuration

The matrix lives in one JSONB config key, **`bb_criteria_matrix`**, so the (band, funded split, CL, AR)
tuples are a single governable artifact:

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
  "classes": [                       // all non-rated classes, resolved by cls label
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

Each rated band carries its agency rating range verbatim as a `label` (e.g. `"AA+ / Aa1 to AA- / Aa3"`)
for display.

Related config keys:

| Key | Role |
|---|---|
| `bb_criteria_matrix` | **Authoritative** source of AR and CL for the borrowing-base engine |
| `classification_config` | The 9-class option list, tags, criteria text and category labels; its `BUSA_RATE_MAP` / `UBS_CLS_DEFAULT_RATE` serve agent-side rate seeding and the LP-Master entry form, not the BB engine |
| `cls_conc_limit_defaults` / `cls_conc_limit_bounds` | Per-class CL defaults and editable ranges used for UI pre-fill and agent-side seeding |
| `conc_limits` | Portfolio-level breach thresholds (Single-LP, Top-10, Unrated, Non-US) — separate from the per-LP CL |

---

## 5. Database

| Store | Role |
|---|---|
| `config` table | Holds `bb_criteria_matrix` and the related keys above as JSONB, reloadable without redeploy |
| `lp_records.ubs_rate` / `lp_records.ubs_conc_limit` | Per-LP manual overrides — when present they win over the resolved default |
| `lp_rates` | Persisted per-LP rate and limit values behind those overrides |
| `bb_snapshots` | Immutable results of a Shadow BB run; a criteria change never restates a committed snapshot |

---

## 6. API

| Endpoint | Role |
|---|---|
| `GET /api/config/eligibility` | Returns `bb_criteria_matrix` alongside the other eligibility config sections |
| `PUT /api/config/eligibility?section=bb_criteria_matrix` | Edits the matrix |
| `GET /api/config/classification` | Returns the classification config (class list, labels, criteria) |
| `POST /api/config/reload` | Refreshes the cached config so ingestion feeds pick up changes |
| `POST /api/bb/run/{facilityId}` | Runs (or re-runs) the Shadow BB, resolving AR and CL per LP and producing a new snapshot |

The borrowing-base engine is server-authoritative: the API resolves AR and CL and computes the base.
The UI's own resolution is a preview of unsaved edits only.

---

## 7. Resolution Order

For each LP row, in order:

1. **Excluded** → `{ AR 0%, CL 0% }`, ahead of everything else.
2. **Per-LP override** — a stored UBS rate or UBS concentration limit wins over any resolved default.
3. **`bb_criteria_matrix`**:
   - `Rated Investor` → resolve the band from the LP's ratings via the tri-party waterfall, then take
     that band's row.
   - Otherwise → look up the row by classification label.
   - `funded = pctFunded ≥ fundedThresholdPct / 100` selects `gte40` or `lt40` for the advance rate.
   - Concentration limit is taken directly from the row.
4. **Fallback** — a classification the matrix does not carry, with no per-LP value, contributes **0%**
   advance rate and falls back to the **facility-level** concentration limit. There is no flat
   legacy-schedule fallback.

The matrix makes the *default* deterministic; it does not hard-lock the values. Analysts retain the
per-LP manual override, which is what produces legitimate LP-level borrowing-base variance.

---

## 8. UI

**Configuration screen** — a *Borrowing Base Criteria Matrix* editor exposes the rating bands, the
funded split and the per-class CL/AR values for governance, alongside the BUSA schedule and the per-LP
concentration-limit defaults.

**Run Shadow BB screen** — each LP row shows **UBS Advance Rate** and **UBS Concentration Limit**
columns, seeded from the resolver using the row's **% of LP Called** and its S&P/Moody's/Fitch ratings.
Both remain editable per LP; an edit becomes the stored override. A classification outside the matrix
keeps the LP's stored value rather than being reseeded.

---

## 9. Effect on the Borrowing Base

- Changing the criteria changes **only the inputs**: per-LP UEC and UBB, the facility UBS BB, and EAR.
- Existing snapshots are **immutable** — new values apply only on the next run or re-run. Re-running an
  already-Active facility is expected to yield different numbers for affected classes.
- Portfolio-level breach tests are unchanged in definition but recompute against the new UBB.
- The advance-rate value set is **90 / 75 / 65 / 50 / 0**, so the summary BUSA rate buckets remain
  valid — only which LPs land in each bucket changes.
