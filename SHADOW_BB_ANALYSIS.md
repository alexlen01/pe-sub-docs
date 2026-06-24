# Shadow Borrowing Base Analysis

This document defines the data model, column semantics, and summary table structures for the Shadow Borrowing Base (BB) Analysis worksheet.

---

## 1. LP Record Columns

28 columns (A–AB), ordered as they appear in the spreadsheet.

| Col | Column | Source | Description |
|-----|--------|--------|-------------|
| A | **Rank** | Calculated | Ordinal rank of the LP by uncalled capital (descending) |
| B | **Investor Name** | Manual Input | Full legal name of the LP |
| C | **Parent** | Manual Input | Parent organization, manager, or sponsor |
| D | **SPV** | Manual Input | Special Purpose Vehicle flag — `Y` or `N` |
| E | **UBS LP Classification** | Manual Input | UBS eligibility tier — one of: `Rated Investor`, `Unrated NAV > $1Bn`, `FoF & Other > $10Bn AUM`, `Corp Pension > $5Bn Assets`, `Other Institutional`, `Excluded` |
| F | **Institutional vs HNW** | Manual Input | `Institutional` or `HNW` |
| G | **Investment Grade?** | Manual Input | `Yes` or `No` |
| H | **Agent LP Classification** | Manual Input | Agent eligibility bucket — one of: `Rated Included`, `Non-Rated Included`, `Designated Institutional`, `Designated PWM`, `Ineligible Investors` |
| I | **S&P** | Manual Input | S&P credit rating string (e.g., `AA+`, `A-`) |
| J | **Moody's** | Manual Input | Moody's credit rating string (e.g., `Aa1`, `A3`) |
| K | **Fitch** | Manual Input | Fitch credit rating string (e.g., `AA-`) |
| L | **LP Size ($ Bil)** | Manual Input | Numeric size of the LP in billions USD — AUM, Pension Assets, or NAV depending on LP type (see col M) |
| M | **LP Size Criteria** | Manual Input | Which size metric LP Size represents — one of: `AUM`, `Assets`, `NAV` |
| N | **Capital Commitments** | Manual Input | Total original LP commitment (USD) |
| O | **Uncalled Capital** | Manual Input | Remaining uncalled commitment (USD) |
| P | **UBS Advance Rate** | Manual Input | UBS-assigned advance rate (decimal: `0.90`, `0.75`, `0.65`, `0.00`) |
| Q | **Agent Advance Rate** | Manual Input | Agent-assigned advance rate (decimal: `0.90`, `0.75`, `0.00`) |
| R | **Agent Concentration Limit** | Manual Input | Agent-set concentration limit (decimal, e.g., `0.20`, `0.05`) |
| S | **UBS Concentration Limit** | Manual Input | UBS-set concentration limit (decimal, e.g., `0.15`, `0.10`) |
| T | **% of Capital Committed** | Calculated | Capital Commitments ÷ Total Fund Capital Commitments |
| U | **Called Capital** | Calculated | Capital Commitments − Uncalled Capital |
| V | **% of Uncalled Capital** | Calculated | LP Uncalled Capital ÷ Total Fund Uncalled Capital |
| W | **% of LP Called** | Calculated | Called Capital ÷ Capital Commitments |
| X | **Agent Excess Concentration Base** | Calculated | Excess of LP uncalled above Agent Concentration Limit applied to total fund uncalled; zero if within limit |
| Y | **UBS Excess Concentration Base** | Calculated | Excess of LP uncalled above UBS Concentration Limit applied to total fund uncalled; zero if within limit |
| Z | **Agent Borrowing Base** | Calculated | Uncalled Capital × Agent Advance Rate (capped to Agent Concentration Limit) |
| AA | **UBS Borrowing Base** | Calculated | Uncalled Capital × UBS Advance Rate (capped to UBS Concentration Limit) |
| AB | **Notes** | Manual Input | Free-text analyst notes |

---

## 2. Columns Mirrored Directly from Agent BB

These Shadow BB columns contain the same values as their Agent BB equivalents — either via formula mirror or identical manual input.

| Shadow BB Header | Agent BB Header |
|------------------|-----------------|
| **Investor Name** | Investor |
| **Parent** | Parent / Sponsor / Manager |
| **S&P** | S&P |
| **Moody's** | Moody's |
| **Fitch** | Fitch |
| **LP Size ($ Bil)** | Net Assets / AUM (numeric) |
| **Agent LP Classification** | LP Classification |
| **Agent Advance Rate** | Advance Rate |
| **Capital Commitments** | Original Commitment |
| **Uncalled Capital** | Unfunded Capital Commitment |
| **Agent Concentration Limit** | Concentration Limit |
| **Agent Borrowing Base** | Borrowing Base Contribution |

---

## 3. UBS-Only Fields

These columns are UBS Shadow BB additions with no direct Agent BB equivalent.

| Column | Purpose |
|--------|---------|
| **Rank** | LP ordering by uncalled capital size |
| **UBS LP Classification** | UBS eligibility tier (differs from Agent classification) |
| **Investment Grade?** | UBS credit quality flag |
| **LP Size Criteria** | Clarifies which size metric (`AUM`, `Assets`, `NAV`) col L represents |
| **UBS Advance Rate** | UBS-assigned advance rate (may differ from Agent rate) |
| **UBS Concentration Limit** | UBS-specific concentration cap |
| **UBS Excess Concentration Base** | Excess uncalled above UBS concentration cap |
| **UBS Borrowing Base** | UBS-computed borrowing base contribution |

---

## 4. Summary Tables

### Table 1 — Fund Portfolio Statistics

Portfolio-level metrics across the full LP population.

| Metric | Formula / Notes |
|--------|-----------------|
| **Total Capital Commitments** | `SUM(Capital Commitments)` across all LPs |
| **Total Called Capital** | `SUM(Called Capital)` across all LPs |
| **% of Called Capital** | Total Called Capital ÷ Total Capital Commitments |
| **Total Uncalled Capital** | `SUM(Uncalled Capital)` across all LPs |
| **# of Limited Partners** | `COUNT` of LP records |
| **% Institutional** | Uncalled Capital of Institutional LPs ÷ Total Uncalled Capital |
| **% HNW** | Uncalled Capital of HNW LPs ÷ Total Uncalled Capital |
| **% Top 3 LPs** | Uncalled Capital of top 3 ranked LPs ÷ Total Uncalled Capital |
| **% Top 10 LPs** | Uncalled Capital of top 10 ranked LPs ÷ Total Uncalled Capital |
| **% Top 20 LPs** | Uncalled Capital of top 20 ranked LPs ÷ Total Uncalled Capital |
| **% Investment Grade** | Uncalled Capital of Investment Grade LPs ÷ Total Uncalled Capital |
| **% of Uncalled Capital from LPs > $25bn AUM** | Uncalled Capital where LP AUM > $25bn ÷ Total Uncalled Capital |

---

### Table 2 — Facility Summary

Facility size, participation, borrowing bases, and derived ratios.

| Metric | Formula / Notes |
|--------|-----------------|
| **Total Facility Size** | Stated facility commitment (USD) |
| **UBS Participation** | UBS share of the facility (USD) |
| **UBS Participation Rate** | UBS Participation ÷ Total Facility Size |
| **Facility LTV** | Total Facility Size ÷ Total Uncalled Capital |
| **Available Commitment** | `MIN(Total Facility Size, Agent Borrowing Base)` |
| **Current Facility Advance Rate** | Agent Borrowing Base ÷ Total Uncalled Capital |
| **Agent Borrowing Base** | `SUM(Agent Borrowing Base)` across all LPs |
| **UBS Borrowing Base** | `SUM(UBS Borrowing Base)` across all LPs |
| **UBS Advance Rate** | UBS Borrowing Base ÷ Total Uncalled Capital |
| **EAR Differential** | UBS Advance Rate − Agent Advance Rate (positive = UBS tighter) |
| **Uncalled to Facility** | Total Uncalled Capital ÷ Total Facility Size |
| **BB to Facility** | Agent Borrowing Base ÷ Total Facility Size |
| **Facility to Fund Size** | Total Facility Size ÷ Total Capital Commitments |

---

### Table 3 — BUSA (UBS) Advance Rate Distribution

Breaks down the LP population by UBS advance rate bucket.

| BUSA Rate | # of LPs | $ Uncalled Capital | % of Total Uncalled |
|-----------|----------|--------------------|---------------------|
| **0.90** | `COUNTIF(UBS Advance Rate = 0.90)` | `SUMIF(UBS Advance Rate = 0.90, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **0.75** | `COUNTIF(UBS Advance Rate = 0.75)` | `SUMIF(UBS Advance Rate = 0.75, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **0.65** | `COUNTIF(UBS Advance Rate = 0.65)` | `SUMIF(UBS Advance Rate = 0.65, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **0.50** | `COUNTIF(UBS Advance Rate = 0.50)` | `SUMIF(UBS Advance Rate = 0.50, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **0.00** | `COUNTIF(UBS Advance Rate = 0.00)` | `SUMIF(UBS Advance Rate = 0.00, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Totals** | `SUM(# column)` | `SUM(Total Uncalled Capital)` | `100%` |

---

### Table 4 — Agent Advance Rate Distribution

Breaks down the LP population by Agent advance rate bucket.

| Agent Rate | # of LPs | $ Uncalled Capital | % of Total Uncalled |
|------------|----------|--------------------|---------------------|
| **90%** | `COUNTIF(Agent Advance Rate = 0.90)` | `SUMIF(Agent Advance Rate = 0.90, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **75%** | `COUNTIF(Agent Advance Rate = 0.75)` | `SUMIF(Agent Advance Rate = 0.75, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **50%** | `COUNTIF(Agent Advance Rate = 0.50)` | `SUMIF(Agent Advance Rate = 0.50, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **0%** | `COUNTIF(Agent Advance Rate = 0.00)` | `SUMIF(Agent Advance Rate = 0.00, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Totals** | `SUM(# column)` | `SUM(Total Uncalled Capital)` | `100%` |

---

## 5. Key Model Differences from Previous Version

| Area | Previous | Current |
|------|----------|---------|
| LP Classification | Single `Investor Type` column; buckets: Rated, Unrated, HNW Feeder, Eligible, Excluded | Split into `UBS LP Classification` (6 tiers) and `Agent LP Classification` (5 tiers) |
| LP Size | `AUM` (USD) + `NAV` (text range label) as separate columns | `LP Size ($ Bil)` (numeric) + `LP Size Criteria` (`AUM` / `Assets` / `NAV`) |
| Excess Concentration | Single `Included Uncalled Concentration Excess` | Split: `Agent Excess Concentration Base` (col X) and `UBS Excess Concentration Base` (col Y) |
| UBS Advance Rates | 0.90 / 0.75 / 0.65 / 0.50 / 0.00 | 0.90 / 0.75 / 0.65 / 0.50 / 0.00 (unchanged) |
| Agent Advance Rates | 0.90 / 0.75 / 0.65 / 0.50 / 0.00 | 0.90 / 0.75 / 0.50 / 0.00 (0.65 bucket removed) |
| Columns removed | — | `Region / Location`, `Pension Assets`, `Pension Funded %`, `High Quality`, `UBS Included`, `UBS Eligible Uncalled Capital` |
| Columns added | — | `Rank`, `LP Size Criteria`, `Agent LP Classification`, `Agent Excess Concentration Base`, `UBS Excess Concentration Base` |
| Facility Summary | 9 metrics | 13 metrics — added `EAR Differential`, `Uncalled to Facility`, `BB to Facility`, `Facility to Fund Size` |
| Top LP concentration stats | `% Top 10`, `% Top 20` | `% Top 3 LPs`, `% Top 10 LPs`, `% Top 20 LPs` |
