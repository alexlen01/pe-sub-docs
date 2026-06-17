# PE Subscription Borrowing Base — Prototype Process Flow

This document describes the process as implemented in the current React prototype (`pe-sub-platform`).  
It is updated continuously as new features are added.  
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
Four concentration rules are checked after each calculation:

| Rule | Threshold | Status |
|---|---|---|
| Single LP Concentration | > 15% of Total UBS BB | Breach |
| Top-10 LP Concentration | > 60% of Total UBS BB | Breach |
| Top-10 LP Concentration | 50–60% of Total UBS BB | Warning |
| Unrated Aggregate Concentration | > 50% of Total UBS BB | Breach |
| Non-US LP Concentration | > 30% of Total UBS BB | Breach |

Breaches appear in a red alert box with a **Review in BB Results →** button.  
Warnings appear in an amber alert box with a **View in BB Results →** button.  
When breaches are detected, the primary action button relabels to **Review Breaches in BB Results**.

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

Concentration breach table is shown above the LP table when breaches exist.

**Controls:**
- Facility and Snapshot selectors
- Recalculate button (re-runs computation for selected facility)
- Stale warning banner when facility has changed since last run
- Classification filter
- Export Certificate (CSV download: summary + LP-level detail)

---

## Supporting Screens (outside the wizard)

### LP Master

Full register of all LP records across all facilities. Filterable by facility, classification, rating, region. Row click opens LP detail panel with 9 field groups (Identity, Classification, Location, Investor Profile, Ratings, Financial Scale, Commitment Data, Uncalled Data, Borrowing Base).

### Field Mapping Dictionary

Admin-managed dictionary mapping extracted column headers to canonical LP Master fields. Organized by group (Identity, Commitment Data, Uncalled Data, Financial Scale, Borrowing Base, Ratings, Classification). Three alias tiers: Core (read-only), Bank (agent-bank-specific), User (Analyst-added). Pending suggestions from COs and AI engine are shown for review.

### Match Thresholds

Configuration screen for name-matching algorithm thresholds (auto-accept ≥ 95, manual review 80–94, no-match < 80). Also configures extraction confidence thresholds.

### Configuration

Facility-level parameters: advance rate schedule, concentration limit per LP ($M), eligibility rules. State is in-memory (lost on refresh in the prototype).

### Audit Trail

Append-only log of all system events (ingestion, extraction, matching, calculation, exports). Filterable by event type and date range.

### Reports

Placeholder for scheduled and ad-hoc reports (not yet implemented beyond the Shadow BB CSV export).

---

## Key Differences from As-Is Manual Process

| As-Is (BB_PROCESS_FLOW.md) | Prototype |
|---|---|
| Agent BB downloaded manually from deal sites | Manual file upload (DropZone); Analyst downloads from deal site (SyndTrak, Intralinks, Debt Domain) and uploads to platform |
| LP classified manually in Excel, one by one | LP Classification & Rate Assignment table (Step 5b) — LP Master defaults pre-populate; Analyst reviews and overrides before running |
| BUSA rate entered manually per LP | Auto-derived from classification in real time; Analyst can override classification to change rate |
| Concentration limits entered manually per LP | Per-LP CL editable in Step 5b table; defaults to facility-level parameter ($25M) |
| BB calculated in Excel | Client-side calculation engine (`bbCalculationService.js`) runs on demand |
| Results in shared-folder Excel files | In-memory results displayed in ShadowBB screen; exportable as CSV |
| No breach detection | Four concentration rules checked automatically; breach/warning alerts with navigation to resolution |
| LP name matching done manually | Automated name-matching with confidence scoring; Analyst reviews only borderline cases |
| No LP Master system of record | LP Master register maintained in prototype (static seed; production will use persistent DB) |
