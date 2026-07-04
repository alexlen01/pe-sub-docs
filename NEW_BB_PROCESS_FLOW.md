# PE Subscription Borrowing Base — Prototype Process Flow

This document describes the process as implemented in the current React prototype (`pe-sub-platform`).  
It is updated continuously as new features are added. Where the live platform (`pe-sub-ui` +
`pe-sub-api`) has since implemented or extended a step, the section notes the live behaviour.  
For the confirmed as-is manual process, see `BB_PROCESS_FLOW.md`.

---

## Wizard Flow (Steps 1–5)

### Step 1 — Select Facility

**Screen:** Dashboard → Upload wizard entry  
**Actor:** Analyst (J. Smith)

The Analyst selects the target facility from the Dashboard. Facilities with a pending submission show a **View Extraction** button. The Analyst clicks into the 5-step wizard for that facility.

---

### Step 2 — Upload Agent BB

**Screen:** Upload  
**Actor:** Analyst

Analyst uploads the Agent BB file via drag-and-drop or file picker. The system simulates parsing and routes to Step 3 (Extraction Preview).

---

### Step 3 — Review Extraction

**Screen:** ExtractionPreview  
**Actor:** Analyst

Three collapsible panels are shown:

**3a — Document Recognition**  
Identifies the document structure, agent bank, and extraction confidence. Columns are auto-mapped using the Field Mapping Dictionary (alias groups). Unrecognised columns can be manually mapped by the CO; mappings are saved to the Field Mapping Dictionary automatically for future submissions.

**3b — Canonical Field Mapping**  
Shows the mapping of extracted column headers to canonical LP Master fields. The Analyst can review disambiguation results. Extraction confidence (%) is shown per column.

**3c — Extracted LP Data (34 Records)**  
LP-level table showing extracted values. Clicking a row opens a detail panel showing extracted fields and their canonical mappings. LPs with extraction confidence ≥ 95% are flagged for auto-matching in Step 4.

---

### Step 4 — Review LP Matches

**Screen:** MatchQueue  
**Actor:** Analyst

LPs extracted from the Agent BB are matched against LP Master records using name-matching algorithms (Jaro-Winkler + Levenshtein, simulated with pre-scored data).

**Match Quality bands:**
- **Auto-match (≥ 95%)** — pre-committed without Analyst review; shown in the blue banner at the top of the queue
- **Review (80–94%)** — Analyst must Accept or Reject each proposed match
- **No Match (< 80%)** — no LP Master record found; Analyst can search manually

**Accept behaviour:** Links the Agent BB LP to the existing LP Master record.  
**Reject behaviour:** A new LP Master record will be created for this LP when matches are committed.

A status filter defaults to "Pending" so auto-matched records are not shown in the main queue. Analyst can switch to "Accepted" to review auto-matched records.

Right panel shows Algorithm Decision, match score, and field-level comparison between the Agent name and LP Master name.

---

### Step 5 — Run Shadow BB

**Screen:** RunShadowBB  
**Actor:** Analyst

This step covers Steps 3a–3d from the original manual process (`BB_PROCESS_FLOW.md`).

**5a — Submission Summary**  
Read-only summary showing facility, as-of date, agent bank, total LP count, accepted matches, and new LP records to be created.

**5b — LP Classification & Rate Assignment (Step 3b–3c)**  
A scrollable review table shows every LP with:
- **UBS Classification** — editable dropdown (Rated / Unrated >2bn / Unrated 1–2bn / Eligible / Excluded). Pre-populated from LP Master. Analyst can override per LP.
- **BUSA Rate** — auto-derived from classification (90/75/65/50/0%). Updates live when classification changes.
- **Agent Rate** — the advance rate the agent assigned to this LP (from the Agent BB submission, read-only, for comparison).
- **Conc. Limit** — per-LP dollar concentration limit ($M). Defaults to facility-level parameter ($25M). Analyst can adjust per LP.
- **Uncalled Capital** — from the Agent BB submission (read-only, for sizing context).
- **Included** — live preview of whether this LP will be included in the UBS BB given current classification.

Changed rows are highlighted amber. A "Reset overrides" button restores all rows to LP Master defaults. Override count is shown in the action bar.

**5c — Run Shadow BB (Step 3d)**  
Analyst clicks **Run Shadow BB**. The calculation engine applies the Analyst's classification and CL assignments. Classification overrides apply to this calculation only and do not update LP Master records.

**5d — Calculation Results**  
Summary KPIs displayed after calculation completes:
- UBS Borrowing Base
- Agent Borrowing Base
- BB Delta
- Effective Advance Rate (UBS and Agent)
- EAR Delta
- Included / Excluded / Reclassified LP counts
- UBS Eligible Uncalled
- Concentration Excess (total)

**5e — Concentration Breach & Warning Alerts**  
Four concentration rules are checked after each calculation. In the live platform the
thresholds are **not fixed**: the engine (`pe-sub-api`) reads them from the **Concentration
Limits** card on the Configuration screen (config key `conc_limits`, matched by row label) on
every Shadow BB run, and persists the verdict with the snapshot. The seeded defaults:

| Rule | Config row | Default threshold | Status |
|---|---|---|---|
| Single LP Concentration | Single LP max | > 15% of Total UBS BB | Breach |
| Top-10 LP Concentration | Top-10 LP max | > 60% of Total UBS BB | Breach |
| Top-10 LP Concentration | 10 pp below the Top-10 limit | 50–60% of Total UBS BB | Warning |
| Unrated Aggregate Concentration | Unrated max (aggregate) | > 50% of Total UBS BB | Breach |
| Non-US LP Concentration | Non-US LP max | > 30% of Total UBS BB | Breach |

A missing config row (or key) falls back to its seeded default, so detection never silently
switches off. A fifth config row — **Pension fund max** (basis: Total eligible uncalled) —
exists in `conc_limits` but has no engine rule yet; it is display-only.

Breaches appear in a red alert box under Calculation Results ("must resolve before submitting
BB certificate to agent"). Warnings appear in an amber alert box ("approaching limit, monitor
closely"). When breaches are detected, the primary action button relabels to
**Review Breaches in BB Results**.

---

## Step 6 — Shadow BB Results

**Screen:** ShadowBB  
**Actor:** Analyst / Analyst

Full LP-level Shadow BB table showing all 14 computed fields per LP:
- Investor Name, Classification, Uncalled Capital
- UBS Eligible Uncalled Cap (MIN(Uncalled, Conc. Limit))
- Concentration Excess (Uncalled above the per-LP cap)
- BUSA Advance Rate
- UBS Borrowing Base
- Agent Borrowing Base
- BB Delta
- Included flag (Y/N)

Clicking a row opens a detail modal with Identity, Ratings, LP Capital, and UBS BB Calculation sections.

The concentration breach table is shown above the LP table when the latest snapshot carries
breaches: collapsible red (breach) and amber (warning) panels listing Rule, Detail, Current,
and Limit, sourced from the verdict persisted with the snapshot. The panels hide while local
overrides are active, since the stored verdict no longer matches the recomputed table below.

**Controls:**
- Facility and Snapshot selectors
- Recalculate button (re-runs computation for selected facility)
- Stale warning banner when facility has changed since last run
- Classification filter
- Export (summary + LP-level detail; Excel/XLSX in the live platform, CSV in the prototype)

---

## Supporting Screens (outside the wizard)

### LP Master

Full register of all LP records across all facilities. Filterable by facility, classification, rating, region. Row click opens LP detail panel with 9 field groups (Identity, Classification, Location, Investor Profile, Ratings, Financial Scale, Commitment Data, Uncalled Data, Borrowing Base).

### Field Mapping Dictionary

Admin-managed dictionary mapping extracted column headers to canonical LP Master fields. Organized by group (Identity, Commitment Data, Uncalled Data, Financial Scale, Borrowing Base, Ratings, Classification). Three alias tiers: Core (read-only), Bank (agent-bank-specific), User (Analyst-added). Pending suggestions from COs and AI engine are shown for review.

### Match Thresholds

Configuration screen for name-matching algorithm thresholds (auto-accept ≥ 95, manual review 80–94, no-match < 80). Also configures extraction confidence thresholds.

### Configuration

Facility-level parameters: advance rate schedules, eligibility rules, concentration limits, and
global settings. In the live platform these persist in the `config` table (`pe-sub-api`) and are
edited on the Configuration screen; the **Concentration Limits** card (`conc_limits`) directly
drives breach detection on every Shadow BB run (see 5e). In the prototype this state was
in-memory and lost on refresh.

### Audit Trail

Append-only log of all system events (ingestion, extraction, matching, calculation, exports). Filterable by event type and date range.

### Reports

Fully implemented in the live platform — six tabs, all reading persisted data via
`/api/reports/*` (no client-side recomputation):

- **Collateral & Coverage** — BB certificate built from the selected facility's snapshot
  (latest, or an earlier one via the snapshot selector): summary figures plus per-LP-category
  breakdown, with watermark/detail options and export
- **Effective Advance Rates** — EAR trend, one point per persisted snapshot
- **Agent Bank Exposure** — UBS vs Agent BB aggregated by agent bank across every facility's
  latest snapshot
- **Concentration Exposures** — the breach verdict persisted with each facility's latest
  snapshot (see 5e), filterable by concentration test
- **Ad Hoc Reporting** — LP-level query by facility / LP category / sort, exportable to XLSX
- **Scheduled Reports** — system-managed batch jobs listed from `report_config`
  (display-only; no user configuration)

Generated reports are recorded in report history (`POST /api/reports/history`; the 50 most
recent entries are shown).

---

## Key Differences from As-Is Manual Process

| As-Is (BB_PROCESS_FLOW.md) | Prototype |
|---|---|
| Agent BB downloaded manually from deal sites | Manual file upload (DropZone); Analyst downloads from deal site (SyndTrak, Intralinks, Debt Domain) and uploads to platform |
| LP classified manually in Excel, one by one | LP Classification & Rate Assignment table (Step 5b) — LP Master defaults pre-populate; Analyst reviews and overrides before running |
| BUSA rate entered manually per LP | Auto-derived from classification in real time; Analyst can override classification to change rate |
| Concentration limits entered manually per LP | Per-LP CL editable in Step 5b table; defaults to facility-level parameter ($25M) |
| BB calculated in Excel | Calculation engine runs on demand — server-side in `pe-sub-api` (`BbCalculationService`), which persists each run as a snapshot; the UI keeps a mirrored TS engine (`bbCalculationService.ts`) for live preview |
| Results in shared-folder Excel files | Persisted BB snapshots (PostgreSQL) displayed on the Shadow BB Results screen; exportable to Excel |
| No breach detection | Four concentration rules checked automatically on every run against the configurable Concentration Limits (Config screen); breach/warning alerts at run time and on the Shadow BB Results screen |
| LP name matching done manually | Automated name-matching with confidence scoring; Analyst reviews only borderline cases |
| No LP Master system of record | LP Master register — static seed in the prototype; persistent PostgreSQL store in the live platform (`pe-sub-api`) |
