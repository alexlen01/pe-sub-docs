# Shadow Borrowing Base Analysis

This document defines the data model, column semantics, and summary table structures for the Shadow Borrowing Base (BB) Analysis worksheet.

---

## LP Record Columns

| Column | Source | Description |
|--------|--------|-------------|
| **Rank** | Calculated | Ranks investors by Uncalled Capital descending (1 = largest uncalled) |
| **Investor Name** | Manual Input | Full legal name of the LP |
| **Parent** | Manual Input | Parent organization, manager, or sponsor |
| **SPV?** | Manual Input | Special Purpose Vehicle flag — `Y` or `N` |
| **Investor Type** | Manual Input | Classification bucket (e.g., Rated Investor, Unrated Investor (NAV > $18bn), HNW Feeder, Eligible Investors) |
| **Region / Location** | Manual Input | Geographic region of the investor |
| **HQ** | Calculated | Mirrors the High Quality flag |
| **Institutional vs HNW** | Manual Input | `Institutional` or `HNW` |
| **Investment Grade?** | Manual Input | `Yes` or `No` |
| **LP Classification** | Manual Input | One of: Rated Investors, Unrated Investors, Eligible Investors, Excluded Investors |
| **S&P** | Manual Input | S&P credit rating string (e.g., `AA+`, `A-`) |
| **Moody's** | Manual Input | Moody's credit rating string (e.g., `Aa1`, `A3`) |
| **Fitch** | Manual Input | Fitch credit rating string (e.g., `AA-`) |
| **AUM** | Manual Input | Assets Under Management (numeric, USD) |
| **NAV** | Manual Input | Net Asset Value range label (e.g., `$1bn – $5bn`) — aligned to Agent BB tiers |
| **Pension Assets** | Manual Input | Dollar value of pension assets (not always populated) |
| **Pension Funded %** | Manual Input | Pension funding ratio (not always populated) |
| **UBS Advance Rate** | Manual Input | UBS-assigned advance rate (decimal: `0.90`, `0.75`, `0.65`, `0.50`, `0.00`) |
| **Agent Advance Rate** | Manual Input | Agent-assigned advance rate (decimal: `0.90`, `0.75`, `0.65`, `0.50`, `0.00`) |
| **Capital Commitments** | Manual Input | Total original LP commitment (USD) |
| **% of Capital Commitments** | Calculated | LP commitment ÷ total fund commitments |
| **Called Capital** | Calculated | Capital Commitments − Uncalled Capital |
| **Uncalled Capital** | Manual Input | Remaining uncalled commitment (USD) — primary sort / rank field |
| **% of Uncalled Capital** | Calculated | LP uncalled ÷ total fund uncalled |
| **% of LP Called** | Calculated | Called Capital ÷ Capital Commitments |
| **Agent Concentration Limit** | Manual Input | Agent-set concentration limit (decimal, e.g., `0.12`) |
| **UBS Concentration Limit** | Manual Input | UBS-set concentration limit (decimal, e.g., `0.05`) |
| **Agent Borrowing Base** | Calculated | Uncalled Capital × Agent Advance Rate |
| **UBS Borrowing Base** | Calculated | UBS Advance Rate × UBS Eligible Uncalled Capital |
| **High Quality** | Calculated | Flagged `Yes` when UBS Advance Rate = `0.90` |
| **UBS Included** | Calculated | `Included` if UBS BB > 0 |
| **Cmt. %** | Calculated | LP commitment ÷ total commitment |
| **UBS Eligible Uncalled Cap** | Calculated | Lesser of: Uncalled Capital or (Total Uncalled × UBS Concentration Limit) |
| **Included UnCalled Conc. Excess** | Calculated | Excess uncalled above concentration limit, for included LPs only |
| **Notes** | Manual Input | Free-text analyst notes |

---

## 2. Columns Mirrored Directly from Agent BB

These Shadow BB columns contain the same values as their Agent BB equivalents — either via formula mirror or identical manual input. No derivation or adjustment is applied.

| Shadow BB Header | Source / Agent BB Header |
|------------------|--------------------------|
| **Investor Name** | Agent BB: Investor |
| **Parent** | Agent BB: Parent / Sponsor / Manager |
| **S&P** | Agent BB: S&P |
| **Moody's** | Agent BB: Moody's |
| **Fitch** | Agent BB: Fitch |
| **AUM** | Agent BB: AUM |
| **NAV** | Agent BB: Net Assets (range) — display label only |
| **Agent Advance Rate** | Agent BB: Advance Rate |
| **Capital Commitments** | Agent BB: Original Commitment |
| **Uncalled Capital** | Agent BB: Unfunded Capital Commitment |
| **Agent Concentration Limit** | Agent BB: Concentration Limit |
| **Agent Borrowing Base** | Agent BB: Borrowing Base Contribution |

---

## Summary Tables

### Table 1 — Fund Portfolio Statistics

Provides key portfolio-level metrics across the full LP population.

| Metric | Formula / Notes |
|--------|-----------------|
| **Total Capital Commitments** | `SUM(Capital Commitments)` across all LPs |
| **Total Called Capital** | `SUM(Called Capital)` across all LPs |
| **% of Called Capital** | Total Called Capital ÷ Total Capital Commitments |
| **Total Uncalled Capital** | `SUM(Uncalled Capital)` across all LPs |
| **# of Limited Partners** | `COUNT` of LP records |
| **% Institutional** | Uncalled Capital of Institutional LPs ÷ Total Uncalled Capital |
| **% HNW** | Uncalled Capital of HNW LPs ÷ Total Uncalled Capital |
| **% Top 10** | Uncalled Capital of top 10 ranked LPs ÷ Total Uncalled Capital |
| **% Top 20** | Uncalled Capital of top 20 ranked LPs ÷ Total Uncalled Capital |
| **Investment Grade** | Uncalled Capital of Investment Grade LPs ÷ Total Uncalled Capital |
| **% of Uncalled Capital from LPs > $25bn AUM** | Uncalled Capital where AUM > $25,000,000,000 ÷ Total Uncalled Capital |

---

### Table 2 — Facility Summary

Shows facility size, participation, and computed borrowing bases.

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

---

### Table 3 — BUSA Advance Rate Distribution

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

| AGENT Rate | # of LPs | $ Uncalled Capital | % of Total Uncalled |
|------------|----------|--------------------|---------------------|
| **90%** | `COUNTIF(Agent Advance Rate = 0.90)` | `SUMIF(Agent Advance Rate = 0.90, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **75%** | `COUNTIF(Agent Advance Rate = 0.75)` | `SUMIF(Agent Advance Rate = 0.75, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **65%** | `COUNTIF(Agent Advance Rate = 0.65)` | `SUMIF(Agent Advance Rate = 0.65, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **50%** | `COUNTIF(Agent Advance Rate = 0.50)` | `SUMIF(Agent Advance Rate = 0.50, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **0%** | `COUNTIF(Agent Advance Rate = 0.00)` | `SUMIF(Agent Advance Rate = 0.00, Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Totals** | `SUM(# column)` | `SUM(Total Uncalled Capital)` | `100%` |

---

### Table 5 — LP Classification Breakdown

Summarizes uncalled capital by LP eligibility classification.

| LP Classification | # of LPs | $ Uncalled Capital | % of Total Uncalled |
|-------------------|----------|--------------------|---------------------|
| **Rated Investors** | `COUNTIF(LP Classification = "Rated Investors")` | `SUMIF(LP Classification = "Rated Investors", Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Unrated Investors** | `COUNTIF(LP Classification = "Unrated Investors")` | `SUMIF(LP Classification = "Unrated Investors", Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Eligible Investors** | `COUNTIF(LP Classification = "Eligible Investors")` | `SUMIF(LP Classification = "Eligible Investors", Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Excluded Investors** | `COUNTIF(LP Classification = "Excluded Investors")` | `SUMIF(LP Classification = "Excluded Investors", Uncalled Capital)` | $ bucket ÷ Total Uncalled |
| **Totals** | `SUM(# column)` | `SUM(Total Uncalled Capital)` | `100%` |
