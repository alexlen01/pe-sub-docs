# PE Sub Platform — Demo Scenario
**Audience:** Business stakeholders  
**Duration:** ~30 minutes  
**Persona:** J. Smith, Analyst, UBS Bank  
**Demo date:** May 27, 2026

---

## Business Context — When Does This Work Happen?

Sub line borrowing bases are calculated as of the last day of each month. For April 2026, the as-of date is April 30.

After month-end, each agent bank prepares its Borrowing Base Certificate and posts it to the deal site — Goldman Sachs uses SyndTrak, JPMorgan uses Intralinks, others use Debt Domain. This typically takes 5–10 business days, so certificates for April start appearing the week of May 6.

UBS Analysts monitor the deal sites, download the certificates as they arrive, and begin processing. Most April Shadow BBs are certified by the third week of May. By May 27, the team is at the tail end of the month's work — 77 of 82 facilities are already certified. **Blue Owl GP Stakes V is one of the last outstanding.** Goldman posted the certificate to SyndTrak on May 8. J. Smith downloaded it and is starting the submission today.

This is the context when J. Smith logs in.

---

## Setup

Before the demo, make sure the app is running and the user switcher in the top bar is set to **JS · J. Smith (Analyst)**.

---

## Scene 1 — Dashboard (5 min)

> *"It's the morning of May 27th. J. Smith logs in to check the state of the April cycle."*

1. Open the Dashboard. Point to the KPI cards:
   - **82 Active Facilities** — UBS participates in 82 sub lines across the platform.
   - **Pending LP Reviews** — Shows pending items for the selected facility. Click a Needs Review row (e.g. Ares Capital IX) to see the LP review queue count for that submission.
   - **Last BB Run** — The most recent Shadow BB calculation for the selected facility. Certified facilities show the date of their certified run.

2. Point to the status filter and status counts in the Facility Summary header. The sort order reflects priority:
   - **1 Not Started** — Blue Owl GP Stakes V. Goldman posted the certificate; J. Smith is processing it today.
   - **1 In Progress** — Advent Global IX. A colleague is actively working through LP matching.
   - **3 Needs Review** — Apollo Natural Resources III, Ares Capital IX, Carlyle Partners VIII. Each is at a different step in the upload process and has flagged items requiring credit officer action.
   - **77 Certified** — Shadow BB signed off; certificate submitted to agent.

3. Scroll to the Activity Feed. Walk through the recent events (most recent first):
   - *"Yesterday afternoon, M. Chen uploaded the Citibank BB for Apollo Natural Resources III. The platform flagged a template change — Citibank reformatted their column layout this cycle, so a handful of field mappings need confirmation."*
   - *"Also yesterday, L. Torres uploaded the Ares Capital IX borrowing base. 248 LP names came in with updates — new fund names, entity restructurings, abbreviation changes. Those are queued for review."*
   - *"The day before, M. Chen uploaded Carlyle Partners VIII — 1,208 LP records. The platform flagged 2 classification overrides for review before the Shadow BB can run."*
   - *"Last Thursday, L. Torres ran the Shadow BB for KKR North America Fund XIV — 1,492 included LPs, UBS BB $183.9M."*
   - *"The week before that, M. Chen exported the Blackstone CRE VII certificate — already certified for April."*

4. Point to the Executive Summary panel. Select a certified facility (e.g. Blackstone CRE VII) and show the delta row:
   - *"For certified facilities, the delta is already resolved and documented. The credit officer reconciled the gap before sign-off."*

---

## Scene 2 — Upload a New Submission (5 min)

> *"Let's show how a submission starts. J. Smith is about to process Blue Owl GP Stakes V — Goldman Sachs posted the certificate two weeks ago and J. Smith downloaded it. Time to run it through the platform."*

1. Click **Upload Agent BB** (or New Submission).

2. **Step 1 — Select Facility.** Choose *Blue Owl GP Stakes V*. The facility's credit agreement reference (CA-2023-BOGS-V-001) is pre-populated — the platform already knows which advance rates and concentration limits apply to this fund.

3. **Step 2 — Upload File.** Drop in `Agent-BB-Blue-Owl-GP-Stakes-V-Apr-2026.xlsx`. This is the actual file Goldman Sachs Prime Services posted to SyndTrak — J. Smith downloaded it and dropped it here. No reformatting, no copy-paste.

4. **Step 3 — Review Extraction.** The platform has parsed the file and mapped the columns automatically.
   - *"Goldman's format has 11 columns across a header block and a data table. The platform identified the LP name column, commitment amounts, uncalled balances, AUM, ratings, and Goldman's own advance rates — without any manual field mapping."*
   - Point to the confidence badge. *"94% overall confidence. The handful of rows flagged for review are cases where a value was ambiguous or a column header didn't match any known alias. J. Smith can correct those inline before proceeding."*

5. Confirm and advance to Step 4.

---

## Scene 3 — LP Name Matching (10 min)

> *"This is the step that used to take two to three days. Goldman's LP names don't always match UBS's LP Master exactly — different abbreviations, different legal entity formats, sometimes just different conventions. The platform scores every name automatically."*

1. **Step 4 — Review Matches.** 900 LP records loaded.

2. Point to the score distribution:
   - *"About 617 rows scored 95 or above and were auto-accepted. J. Smith didn't need to look at those."*
   - *"The remaining 283 are in the review queue — 148 are LP Master matches with moderate confidence (scores in the 70–94 range), and 135 are names with no LP Master match at all: first-time investors in this fund."*

3. Click a medium-confidence row (~85 score) to open the Match Analysis panel.
   - *"Goldman wrote 'CalPERS'. UBS's LP Master has 'California Public Employees Retirement System'. The algorithm scored this 88 — it walked through case folding, punctuation stripping, abbreviation expansion, and then ran Jaro-Winkler and Levenshtein similarity. High confidence but just under the auto-accept threshold."*
   - Show the normalization steps and component scores in the panel.
   - Click **Accept**.

4. Click a low-confidence row (~45 score).
   - *"This one isn't in the Master at all. It's a first-time investor in this fund. J. Smith reviews the name, confirms it's a real new LP, and the platform creates a new Master record."*
   - Click **Accept as New LP**.

5. Key message: *"The manual review still happens — but only for names that genuinely need a human. The obvious ones are handled automatically. A two-day spreadsheet exercise becomes an afternoon queue."*

---

## Scene 4 — Shadow BB and the Delta (7 min)

> *"Match queue cleared. J. Smith runs the Shadow BB. The platform applies UBS's own advance rates and concentration rules — which sometimes differ from Goldman's — and produces the comparison."*

1. On **Step 5 — LP Classification & Shadow BB**, click **Run Shadow BB**. The calculation takes a few seconds. When it completes, the summary panel shows the results. Click **View BB Results** to open the full Shadow BB view.

2. Show the side-by-side result (snapshot: *April 2026*):
   - Agent BB (Goldman): $142.3M
   - UBS Shadow BB: $138.6M
   - Delta: **–$3.7M**
   - Effective Advance Rate (UBS): **87.4%** vs. Goldman's 89.2%

3. Drill into the delta by LP.
   - *"Most LPs net to zero delta — same classification, same rate, same contribution. The $3.7M comes from a small number of LPs where UBS and Goldman disagree on classification."*
   - Point to an example LP Goldman classified as Rated (90% advance rate) that UBS classifies as Unrated >$2B (75%). *"On a $50M unfunded commitment, that's a $7.5M swing from one LP. Goldman may be carrying an outdated rating. This is the conversation J. Smith has with the agent — it's a credit question, not just a formatting discrepancy."*

4. Point to the two concentration breach alerts (red banner):
   - **Unrated Aggregate Concentration: 51.8% vs 50% limit** — combined unrated and eligible LPs exceed the aggregate cap.
   - **Non-US LP Concentration: 32.4% vs 30% limit** — non-US LPs as a share of the borrowing base is just over the limit.
   - *"The platform runs all four concentration checks automatically — single LP, top-10, unrated aggregate, and non-US aggregate. Any breach blocks certificate submission until documented."*

5. Click **Resolve** on the first breach (Unrated Aggregate). The resolution modal opens. Type a brief rationale — e.g. *"Three Eligible-tier LPs reclassified to Excluded per credit agreement §4.2(b). Aggregate concentration reduces to 48.6%."* Click **Confirm Resolution**. The breach disappears from the list.

6. Click **Resolve** on the second breach (Non-US). Enter rationale — e.g. *"Two Middle East SWFs reclassified to Excluded based on updated eligibility review. Non-US concentration reduces to 28.1%."* Click **Confirm Resolution**. The breach panel clears entirely.
   - *"Both resolutions are logged to the audit trail with J. Smith's rationale and timestamp. If a regulator asks why these LPs were excluded three months from now, the answer is in the platform."*

7. Navigate to the LP Master entry for the disputed LP. Show the Reclassify flow — J. Smith selects the corrected classification, records a rationale, and saves. The Shadow BB recalculates immediately.

---

## Scene 5 — LP Master and Audit Trail (3 min)

> *"Everything is logged. If a regulator or senior credit officer asks why an LP was classified a certain way three months ago, the answer is in the platform."*

1. Open **LP Master**. Show the 900-record database — searchable, filterable by classification, by facility, by eligibility status.

2. Open one LP record and show **Version History** — every classification change, who made it, when, and the rationale recorded at the time.

3. Show the **Export** button — 35 fields per LP, full details, downloads as CSV for offline review or regulatory reporting.

---

## Close (1 min)

> *"By the time J. Smith finishes this submission, April is fully wrapped up for Blue Owl. Next month the cycle starts again — the May 31 certificates will start appearing on SyndTrak around June 9.*
>
> *Before this platform, an Analyst spent two to three days per submission on name matching and Shadow BB reconciliation — every month, every facility. With the platform, the repetitive work is automated. The time goes to the decisions that require credit judgment: resolving classification disputes, documenting rationale, and certifying UBS's position."*

---

## Tips for Presenting

- **Set the calendar context early.** The May 27 date isn't arbitrary — it's the tail end of the April cycle and explains why 77 facilities are already certified and Blue Owl is the last one outstanding.
- **Pause on the delta.** Business stakeholders underestimate why –$3.7M matters. Explain that it directly affects how much the fund can draw, and that Goldman claiming more availability than UBS accepts is a credit concern — not just a number mismatch.
- **Name matching is the emotional hook.** Most people in the room have experienced mismatched names in Excel. That's your credibility moment.
- **Don't demo every screen.** The Upload wizard is illustrative; the Shadow BB delta is the point. Spend your time in Scenes 3 and 4.
- **If asked about the Needs Review facilities:** Apollo, Ares, and Carlyle are colleagues' submissions that got flagged mid-process — template changes, LP name updates, classification overrides. They're real workflow, not corner cases.
- **If asked about the source file:** the Excel in the demo is a faithful replica of the Goldman Sachs Prime Services format — same column layout, same header block, same number formatting. It was generated directly from the platform's own extraction data to ensure the demo loop is closed end-to-end.
