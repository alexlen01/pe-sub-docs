# UI Conventions — Visual Markers & Indicators

Reference for all semantic visual markers used in the prototype.  
Update this file whenever a new marker is introduced or an existing one changes meaning.

---

## Badges

| Badge | Where used | Meaning |
|---|---|---|
| **R** (rcl-badge) | ShadowBB table, RunShadowBB Step 5b review table | LP classification was previously overridden by a credit officer and differs from what the algorithm would assign based on ratings/AUM. Flags the row for conscious review. |
| **NEW** (blue pill) | RunShadowBB Step 5b review table | LP has no LP Master record — it is being created for the first time from this submission. CO must manually enter all classification and rate fields. LP will be added to LP Master after commit. |

---

## Tag Colors (Tag component)

| Variant | Color | Used for |
|---|---|---|
| `active` | Green | Accepted match · Included LP (Y) · Calculation complete (no breaches) |
| `pending` | Amber | Review match quality band (score 80–94%) |
| `excl` | Red | No Match band (score < 80%) · Excluded LP · Calculation complete with breaches |
| _(default)_ | Neutral grey | Classification labels (Rated, Unrated >2bn, Unrated 1–2bn, Eligible, Excluded) |

---

## Table Cell Colors

| Class | Color | Used for |
|---|---|---|
| `neg` | Red | Negative delta values (UBS BB below Agent BB) · Concentration excess |
| _(positive)_ | Green | Positive delta values (UBS BB above Agent BB) |
| `zero` | Muted grey | Zero delta · No concentration excess |

---

## Row Highlights

| Highlight | Where used | Meaning |
|---|---|---|
| Amber background (`var(--amber-lt)`) | RunShadowBB Step 5b review table | CO has overridden this LP's classification from its LP Master default. Accompanied by "was: [original]" inline label. |
| Blue background (`var(--blue-lt)`) | ShadowBB table, MatchQueue table, ExtractionPreview table | Row is currently selected; detail panel is showing this record. |

---

## Alert Boxes

| Color | Severity | Meaning | Action |
|---|---|---|---|
| Red box (`var(--red-lt)`) | Breach | Hard concentration limit exceeded. Must resolve before submitting BB certificate to agent. | "Review in BB Results →" button navigates to ShadowBB screen. |
| Amber box (`var(--amber-lt)`) | Warning | Concentration approaching limit (50–60% for Top-10 rule). Monitor closely; not blocking. | "View in BB Results →" button navigates to ShadowBB screen. |

---

## Banners

| Banner | Color | Where | Meaning |
|---|---|---|---|
| Auto-matched banner | Blue (`var(--blue-lt)`) | MatchQueue top | N records were auto-matched (extraction confidence ≥ 95%) and committed without CO review. Includes a "View" link to see them. |
| Stale results banner | Amber | ShadowBB top | Facility selector has changed since the last calculation run. Results shown are from a previous run. Prompts CO to recalculate. |

---

## Concentration Breach Rules (for reference)

| Rule | Threshold | Status |
|---|---|---|
| Single LP Concentration | > 15% of Total UBS BB | Breach |
| Top-10 LP Concentration | > 60% of Total UBS BB | Breach |
| Top-10 LP Concentration | 50–60% of Total UBS BB | Warning |
| Unrated Aggregate Concentration | > 50% of Total UBS BB | Breach |
| Non-US LP Concentration | > 30% of Total UBS BB | Breach |
