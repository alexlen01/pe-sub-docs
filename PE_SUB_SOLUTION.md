# Private Equity Subscription Finance — Business Context

## What Is a Subscription Credit Facility?

A **subscription credit facility** (commonly called a "sub line" or "capital call facility") is a revolving credit line extended to a private equity fund. Unlike a conventional loan secured by real assets, a sub line is secured entirely by the **unfunded capital commitments** of the fund's limited partners. The lender is not lending against the portfolio — it is lending against the legal obligation of sophisticated investors to fund capital when called.

Sub lines exist because PE funds need to move faster than their investors can. Wiring $50 million to close an acquisition takes a business day from a bank; collecting that same amount from 200 pension funds and endowments takes two to three weeks. A sub line bridges that gap. The fund draws on the line, closes the deal, then issues a capital call to LPs to repay the bank. The cycle repeats throughout the fund's investment period, typically four to six years.

---

## Who Is Who

**General Partner (GP)** — the fund manager. BlackRock, KKR, Blue Owl, Apollo. The GP makes investment decisions, manages the fund, and is the **borrower** on the subscription facility. The GP controls when and how much to draw, and when to call capital from LPs to repay.

**Limited Partners (LPs)** — the investors. Pension funds, sovereign wealth funds, endowments, insurance companies, family offices. LPs sign a subscription agreement committing to contribute a fixed amount of capital over the fund's life. That **unfunded commitment** — the portion not yet called — is the collateral that backs the sub line. LPs never sign the loan documents; their commitment letters and the fund's partnership agreement give the bank the right to call capital directly if the GP defaults.

**Agent Bank** — the lead lender that originates and administers the facility. Goldman Sachs, JPMorgan, Subscription Finance Ltd., Cadence Bank. The agent coordinates the syndicate, receives the monthly borrowing base certificate from the GP, calculates availability, and manages draws and repayments. In a syndicated facility, the agent does this on behalf of all participating lenders.

**Participating Lenders** — banks that take a share of the facility alongside the agent. A $500M facility might have five banks each holding $100M of exposure. Each participant earns interest on its share but relies on the agent for administration. A lender like UBS may participate in dozens of sub lines across many GPs.

**Credit Officer (CO)** — the person at the lending institution responsible for underwriting and ongoing monitoring of the facility. They review the borrowing base, assess LP credit quality, flag eligibility concerns, and approve draws. In larger banks this role is supported by analysts and a supervisory layer.

---

## The Borrowing Base

The **borrowing base** is the calculation that determines how much the fund may have outstanding at any time. It is not the total LP commitments — it is a risk-adjusted, eligibility-filtered subset of unfunded commitments.

The mechanics:

```
For each eligible LP:
  Eligible Uncalled Capital  = Unfunded Commitment  (subject to concentration cap)
  LP Contribution to BB      = Eligible Uncalled × Advance Rate

Borrowing Base  = Sum of all LP Contributions
Availability    = Borrowing Base  –  Current Drawings
```

**Advance Rate** reflects the credit quality of each LP and how confident the lender is that the LP will honor its commitment if called. Higher quality, higher rate:

| LP Classification | BUSA Advance Rate | Rationale |
|---|---|---|
| Rated Investor | 90% | S&P/Moody's/Fitch rated; highest payment certainty |
| Unrated NAV > $1Bn | 75% | Large unrated investor; NAV above USD 1bn |
| FoF & Other > $10Bn AUM | 75% | Fund of funds or other investor with AUM above USD 10bn |
| Corp Pension > $5Bn Assets | 65% | Corporate pension with assets above USD 5bn |
| Other Institutional | 50% | Other institutional investor; higher uncertainty |
| Excluded | 0% | Does not meet eligibility criteria; not counted |

*(These are the platform's unified UBS classification tiers as of July 2026; `CLS_OPTS == UBS_CLS_OPTS` in `classification_config`. The agent-side category labels seen as group-header rows in workbooks — Rated / Unrated / Included / Excluded Investors — map into these via `AGENT_CLS_UBS_MAP`.)*

**Concentration Limits** cap how much any single LP can contribute to the borrowing base. A $500M fund with a 10% concentration limit means no LP can contribute more than $50M to availability, even if their unfunded commitment is $200M. This prevents the borrowing base from being dominated by one investor whose default would cause a facility breach.

**Eligibility Criteria** exclude LPs that pose legal or structural risk: foreign governmental entities subject to sanctions, ERISA plans in excess of the 25% "plan asset" threshold, LPs in default on their capital call obligations, LPs whose commitments are subject to legal challenge.

---

## The Agent Borrowing Base Certificate

Each month (or more frequently near fund-level covenants), the GP submits a **Borrowing Base Certificate** to the agent. The agent reviews it, applies their own eligibility determinations, and certifies the availability. This certificate drives how much the fund can draw.

The certificate lists every LP in the fund with:
- Investor name (as recorded by the agent)
- Total commitment and amount called to date
- Unfunded (uncalled) commitment
- LP classification as the agent sees it
- Applied advance rate
- LP-level borrowing base contribution (Uncalled Capital × Advance Rate)
- Concentration limit and any excess excluded
- Total facility availability

This is the Excel file that arrives from Goldman Sachs — formatted by their prime services team, using their internal naming conventions, sometimes combining or splitting LP records in ways that don't perfectly match the lender's own LP Master database.

### Multi-Tab Workbook Structure

Agent BB workbooks are typically multi-tab Excel files following a four-tab industry standard:

| Tab | Role | Contents |
|---|---|---|
| Master Certificate | `TOP_SHEET` | Executed cover page: borrowing base totals, availability calculation, officer sign-offs |
| LP Grid & Advance Rate Calculator | `LP_GRID` | One row per LP — commitment, uncalled capital, LP classification, advance rate, BB contribution, concentration limit |
| Concentration Caps & Haircuts | `CONCENTRATION` | Aggregate concentration tests by LP type, geography, and fund; haircut computations |
| Capital Call & Roll-Forward Log | `CAPITAL_CALL` | History of capital calls drawn and repaid; reconciles outstanding balance |

The LP Grid tab is the primary extraction target. The platform identifies the correct tab by role, locates the header row, and skips summary/subtotal rows automatically.

### LP Grid Format Diversity

Different agent banks use different column headers, row structures, and classification schemes for the same underlying data. Key variations:

- **Column naming** — Goldman Sachs uses "Borrowing Base Contribution"; SVB uses "Remaining Callable Capital" for uncalled capital; BNY uses "Individual Unfunded Commitment"
- **Group-header rows** — Goldman-style workbooks interleave classification headers (Rated Investors, Unrated Investors, Included Investors, Excluded Investors) between LP data rows rather than providing a classification column. The extraction engine uses these as sticky context — when a group-header row is encountered, subsequent LP rows inherit its classification until the next header
- **LP Classification column** — Wells Fargo and some other banks provide LP classification as a dedicated column; no group-header rows needed
- **Summary rows** — SVB workbooks place two summary rows above the column header row; Goldman workbooks place subtotal rows between classification groups. These are identified by keyword matching (Total, Subtotal, Grand Total, etc.) and discarded
- **Tranche structure** — facilities with Tranche A / Tranche B structures may carry separate advance rate and concentration columns per tranche

---

## The Shadow Borrowing Base

A participating lender does not simply accept the agent's certificate. They calculate their own **Shadow Borrowing Base** independently. The shadow BB uses the lender's own:

- **LP Master database** — their authoritative record of LP identity, classification, and credit quality
- **Eligibility rules** — which may differ from the agent's on certain LP types
- **Advance rates** — the agent's rates and the lender's rates often diverge, especially for unrated LPs
- **Concentration limits** — the lender may apply tighter per-LP caps than the agent

The **delta** (agent BB minus shadow BB) tells the lender whether the agent is overstating or understating availability. Persistent positive delta — agent claiming more availability than the lender calculates — is a credit concern. It may indicate the agent is using looser eligibility standards, classifying LPs more favorably, or applying higher advance rates than the lender's credit agreement permits.

Monitoring the delta across monthly submissions, tracking which LPs are classified differently and why, is a core part of credit officer work on sub line portfolios.

---

## The LP Name Matching Problem

The delta often begins with a naming problem. The agent records an LP as **"CalPERS"**. The lender's LP Master has **"California Public Employees Retirement System"**. If the credit officer cannot link those two records, the LP may be treated as unknown — excluded from the shadow BB by default — creating an artificial delta that suggests a problem where none exists.

At scale this is not trivial. A fund with 900 LPs submitting monthly means 900 name-matching decisions, every month, against a master database of thousands of LPs across dozens of funds. The names arrive from banks that have their own abbreviation standards, OCR-processed from scanned documents, or typed by operations staff. Variations are not exceptions — they are the norm:

- "Teachers' Retirement System of Texas" vs "Texas Teachers Ret. Sys."
- "Abu Dhabi Investment Authority" vs "ADIA"
- "Canada Pension Plan Investment Board" vs "CPPIB"
- "Trustees of Princeton University" vs "Princeton University Endowment"

Manual matching at this scale is slow and error-prone. A missed match means an LP gets excluded from the shadow BB, understating availability and potentially triggering unnecessary credit reviews. An incorrect match — linking the wrong LP records — means the shadow BB is calculated against the wrong credit profile, potentially with the wrong advance rate applied.

---

## Why It Matters: Risk and Revenue

From a **risk perspective**, the sub line is unusual collateral. If the GP defaults, the lender must issue a capital call directly to LPs. Whether LPs fund that call — and how quickly — depends entirely on the quality and legal standing of each LP's commitment. A borrowing base filled with ERISA-challenged pension funds, foreign entities under sanctions review, or LPs that have historically been slow to fund is materially riskier than a BB dominated by AAA-rated sovereign wealth funds. Getting classification right is a credit underwriting question, not just an administrative one.

From a **revenue perspective**, sub lines are attractive bank business: short-duration, self-liquidating, relationship-sticky. A bank that administers the facility earns agent fees on top of spread. Participating lenders earn clean interest income with minimal credit losses historically — LP defaults on sub line capital calls are extremely rare. But the margins are thin, which means the operational cost of monitoring matters. Credit officers manually reconciling BB certificates against LP Master records every month is expensive. Automating that process — the core proposition of the PE Sub Platform — directly improves the economics.

---

## How the PE Sub Platform Fits

The platform addresses the three highest-friction points in the monthly sub line monitoring cycle:

**1. Extraction** — The agent's Excel arrives in whatever format Goldman Sachs, JPMorgan, or Cadence Bank uses this month. The platform identifies the LP Grid tab, locates the header row, resolves group-header rows (Rated / Unrated / Included / Excluded) to LP classifications, skips subtotal rows, and maps each column to a canonical field name via the Field Mapping Dictionary. Fields the workbook omits (Called Capital, % of Capital Commitments, Concentration %, Excess Concentration %) are computed per sleeve and marked `Derived:` for cross-check — never treated as agent-reported inputs.

**2. LP Name Matching** — Jaro-Winkler and Levenshtein similarity algorithms score each agent LP name against the LP Master. High-confidence matches (≥95%) are auto-accepted without credit officer intervention. The remaining matches go to a review queue where the CO sees the algorithm's reasoning — which name normalization steps were applied, what the competing candidates scored, why the top match was selected — and accepts or rejects with one click.

**3. Shadow BB Calculation** — Once LPs are matched and classified, the platform applies the lender's own advance rates, concentration limits, and eligibility rules to produce the shadow BB. The delta against the agent's numbers is immediately visible at both the portfolio level and per-LP level, with classification differences highlighted.

What previously took a credit officer two to three days per submission — downloading the Excel, running VLOOKUP matching, manually reviewing unmatched names, rebuilding the BB model — becomes an afternoon workflow, with an audit trail of every decision made along the way.
