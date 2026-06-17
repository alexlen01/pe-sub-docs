# PE Subscription Borrowing Base and Collateral Analysis — Process Flow

Transcribed from the process flow diagram (source: `PE Subscription Borrowing Base and Collateral Analysis Process.jpeg`).

---

## End-to-End Flow

### Step 1 — Agent Bank Submission

**Actor:** Agent Bank / Borrower

Agent banks typically upload borrowing bases to deal sites (SyndTrak, Intralinks, Debt Domain, etc.).

---

### Step 2 — BUSA Download

**Actor:** BUSA (UBS PE Sub Finance)

BUSA downloads each borrowing base, saves to internal shared folders.

---

### Step 3 — Manual Shadow BB Construction

Each BB is manually analyzed to create a Shadow BB.

**3a — LP Population**
LPs are populated in the Shadow BB.

**3b — LP Classification**
Classify each LP type, including AUM and Rating.

**3c — Rate and Concentration Limit Assignment**
BUSA advance rate and concentration limits (CLs) assigned to each LP.

**3d — BB Calculation**
BUSA BB vs Agent BB calculated.

---

### Step 4 — Final Shadow Borrowing Base

The Shadow BB captures the following fields for each LP:

**Identity & Classification**
- Rank
- Investor Name
- Parent
- SPV
- Investor Type
- Region / Location
- HQ
- Institutional vs HNW
- Investment Grade?
- LP Classification
- Notes

**Ratings**
- S&P, Moody's, Fitch

**Financial Scale**
- AUM
- NAV
- Pension Assets
- Pension Funded %

**Borrowing Base Inputs**
- UBS Advance Rate
- Agent Advance Rate

**Commitment Data**
- Capital Commitments
- % of Capital Commitments
- Called Capital

**Uncalled / Eligible Capital**
- Uncalled Capital
- % of Uncalled Capital
- % of LP Called

**Concentration & BB**
- Agent Concentration Limit
- UBS Concentration Limit
- Agent Borrowing Base
- UBS Borrowing Base

---

### Step 5 — Portfolio Aggregation

**Manual Aggregation of all (+20k) LPs in BUSA portfolio**

Feeds into:
- Portfolio Management
- Underwriting
- Reporting purposes

---

### Step 6 — Portfolio-Level Reporting / Monitoring

Outputs produced:

| Output | Description |
|---|---|
| Collateral Market Value & Coverage | Overall collateral quality and coverage ratios |
| Effective Advance Rates | Blended UBS advance rate across the portfolio |
| Agent Bank Exposure | UBS exposure by agent bank |
| Concentration Exposures | LP-level and category-level concentration limits |
| Ad Hoc Reporting | On-demand analysis and credit officer requests |

---

## Key Observations (as-is process)

- The entire process from Step 2 through Step 5 is **manual** — BUSA staff download files, open them in Excel, manually classify LPs, assign rates, and calculate BB figures
- Agent BBs arrive in **non-standardised formats** across deal sites and agent banks, requiring manual interpretation each time
- Portfolio aggregation across 20k+ LPs is performed manually, creating significant operational risk and limiting update frequency
- There is **no system of record** for the Shadow BB — results live in shared folders as Excel files
- The platform being prototyped automates Steps 2–5, with the agent bank upload replacing the manual download and the Shadow BB engine replacing the manual spreadsheet work
