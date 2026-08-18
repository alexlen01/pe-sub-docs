# LP Mapping & Parent-Child Resolution — As Built

How an LP named on an uploaded agent borrowing base is matched to the bank's LP Master record, and
how a feeder/SPV routes up to the sponsor whose credit profile the borrowing base actually uses.

This document describes the **implemented** behaviour of `pe-sub-ui`, `pe-sub-api` and the shared
PostgreSQL schema as of 2026-08-18. It supersedes the original proposal of the same name.

> **Part 1** is written for credit officers and is the section handed to users.
> **Part 2** is the engineering reference — schema, endpoints, algorithm internals, and open gaps.

---
---

# PART 1 — For Credit Officers

## 1.1 What LP mapping does

An agent bank's borrowing base names investors in its own house style. The bank's own LP Master
holds one curated record per investor, carrying the ratings, LP Category, default advance rate and
default concentration limit that drive the Shadow Borrowing Base.

Mapping ties the two together. It answers two questions for every line of the uploaded document:

1. **Which LP Master record is this?**
2. **Whose credit profile does it carry?** — because a feeder fund or SPV is assessed on its
   sponsor's standing, not its own.

## 1.2 Where it sits in the process

Mapping is **step 4 of the 5-step ingestion wizard**:

| Step | Screen |
|---|---|
| 1 | Select Facility |
| 2 | Upload Document |
| 3 | Review Extraction |
| **4** | **Review Matches** — the LP Match Queue |
| 5 | LP Category & Rate Assignment (Run Shadow BB) |

The queue is built the moment you confirm the extraction on step 3. Nothing is written to the
facility's LP records until you press **Commit Decisions** to move to step 5.

There is also a **Match Thresholds** admin screen (§1.10) for tuning how the matcher behaves.

## 1.3 What the system does before you see the queue

For each extracted investor name:

**a. Name clean-up.** Both the uploaded name and every LP Master name are put through the same
clean-up so cosmetic differences do not cost a match:

| Step | Example |
|---|---|
| Expand known acronyms | `CalPERS` → california public employees retirement system |
| Normalise retirement wording | `Texas Teachers Ret. Sys.` → texas teachers retirement system |
| Lower-case everything | `Apollo GRE IV` → apollo gre iv |
| Strip trailing legal suffixes | `Monarch Capital, L.P.` → monarch capital |
| Remove punctuation, collapse spaces | `Blue-Ridge  (Cayman)` → blue ridge cayman |

The acronym list and the suffix list are both editable on the Match Thresholds screen.

**b. Known-name shortcut.** If this exact uploaded string has been accepted before — by you or a
colleague, on any facility — it resolves straight to the same LP Master record at **score 100**,
with no fuzzy scoring. The queue row says so in its reason line.

**c. Scoring.** Otherwise the cleaned name is scored against every LP Master name using two
string-similarity measures — **Jaro-Winkler** (rewards matching beginnings) and **Levenshtein**
(counts edits) — blended into one combined score out of 100. Default weighting is 60% Jaro-Winkler,
40% Levenshtein.

**d. Banding.** The combined score of the best candidate decides how the row arrives:

| Combined score | Band | How the row arrives |
|---|---|---|
| **95 – 100** | Auto-accept | Already marked **Accepted**. Shown for visibility; you can still undo it. |
| **80 – 94** | High-confidence review | **Pending**, with one proposed LP Master record to confirm. |
| **50 – 79** | Low-confidence review | **Pending**, with a ranked candidate list to judge. |
| **below 50** | No match | **Pending**, flagged as a **new LP** — no candidate proposed. |

Those are the configured defaults and can be changed (§1.10).

**Nothing is auto-rejected.** Only the top band resolves itself; every other row reaches you.

## 1.4 Reading the LP Match Queue

| Column | What it shows |
|---|---|
| **Agent BB Name** | The investor name exactly as the uploaded document wrote it. Never altered. |
| **Matched LP Master Record** | The proposed record — or *"No match found — new LP record will be created"*. |
| **Ultimate Parent (To Be Applied)** | The entity whose credit profile an Accept would apply. Reads **Self** when the matched record is already the ultimate entity. |
| **Score** | The combined score, colour-coded by band. |
| **Status** | Pending / Accepted / Rejected. |
| **Action** | Accept, Reject, or Undo. |

Filters are available on status and on confidence band, and the header shows a count of auto-matched
rows. Clicking any row opens the Match Analysis panel.

## 1.5 The Match Analysis panel

The panel exists so a match is never a black box. It shows three things:

- **Normalisation trace** — each clean-up step applied to the agent name, before and after, with the
  rule that fired. This is what the algorithm compared.
- **Parent / Sponsor signal** — the sponsor the *agent document* named, next to the sponsor the *LP
  Master* holds, and how closely the two agree. Corroboration only.
- **Candidate matches** — the top five LP Master records, each with its Jaro-Winkler score,
  Levenshtein score, combined score and verdict.

If the LP Master holds no plausible candidate, the panel says so. It never invents one.

## 1.6 Ultimate parent — whose profile is applied

When the matched record is a feeder or SPV, the system walks up the LP Master hierarchy to the
ultimate entity and applies **that** entity's credit profile. The panel states this in words on the
row you are looking at.

Two rules matter when you review:

- **Child first, parent fills the gaps.** A value the matched record itself carries always wins. The
  parent only supplies fields the child leaves blank. Investment-grade standing is the exception:
  it rides up from the sponsor, because the rating that confers it sits there.
- **The record stays linked to the child.** The facility LP record points at the entity the agent
  actually listed, so the audit trail keeps naming it. Only the *profile* comes from the parent.

If the LP Master names a sponsor that is not itself an LP Master record, nothing is inherited from
it — the LP Master Records screen marks those rows with a ⚠.

## 1.7 Your actions

| Action | Effect |
|---|---|
| **✓ Accept** | The row is committed under the LP Master name, carrying the resolved credit profile. |
| **✕ Reject** | The row is still committed, but under the **agent's** name, as a facility LP record with no LP Master link. Use this when the proposed match is wrong but the line is real. |
| **⊘ Discard Row** | The line is removed from the queue entirely and never becomes an LP record. Use it for lines the document parsed badly — headers, subtotals, artefacts. |
| **Undo** | Returns a decided row to Pending. |

Rows can be selected with the checkboxes and accepted or rejected in bulk.

**Every non-discarded line is committed**, accepted or not. A rejected match does not drop the LP
from the borrowing base — it only means the line stands on its own rather than under a curated
LP Master record.

## 1.8 What Commit Decisions writes

Pressing **Commit Decisions** advances to step 5 and, on that first transition:

- Every existing LP record for the facility is **replaced** — this submission is authoritative.
- One LP record is created per extracted line, in the document's own order. Two lines naming the
  same investor stay as two records; collapsing them would understate uncalled capital.
- For accepted rows the LP Master baseline is pre-populated first — identity, region, ratings,
  LP Category, default advance rate, default concentration limit — and extracted values from the
  document then win over it wherever the document actually stated one.
- The accepted agent string is remembered against that LP Master record (§1.9).

## 1.9 The system learns

Every accepted match teaches the matcher. The agent's exact spelling is stored against the LP Master
record it resolved to, so the next upload carrying that string matches at 100 with no fuzzy scoring —
while still running the same parent routing.

Learned spellings for a record are listed on its LP Master detail panel.

## 1.10 Tuning — the Match Thresholds screen

| Section | What it controls |
|---|---|
| Confidence Thresholds | The auto-accept / review / no-match cut-offs. |
| Algorithm Weights | The Jaro-Winkler vs Levenshtein balance, and which clean-up steps are on. |
| Legal Entity Suffix Rules | Which suffixes are stripped before comparison. |
| Abbreviation Expansion Dictionary | Known acronyms and their expansions. |
| Match Test Tool | Type any name and see how it would score against the LP Master today. |

Changes apply to the **next** queue built. They do not rescore a queue already on screen.

## 1.11 What the screen does not do yet

- **No in-screen search for a different LP Master record.** If the proposed match is wrong you can
  Reject or Discard, but you cannot yet browse the LP Master and pick the right record from the
  queue. The capability exists in the service layer and is pending a UI (§2.10).
- **The Parent / Sponsor signal's "+3 pts / −2 pts" wording is indicative only.** The combined score
  shown on the row is *not* adjusted by it (§2.10).
- **Aliases cannot be removed from the screen.** A learned spelling is repointed by accepting the
  same string against a different record; there is no delete.

---
---

# PART 2 — IT Reference

## 2.1 Components and call flow

```
pe-sub-ui  screens/Upload → ExtractionPreview → MatchQueue → RunShadowBB
                                   │
                                   ▼
POST /api/submissions/{id}/confirm ──► MatchingService.buildMatchQueueEntries
        (wizard step 3 → 4)               ├─ LpAliasService.lookupAll        (exact, learned)
                                          ├─ prepare() / analyze()           (normalise + score)
                                          └─ LpMasterResolutionService       (parent routing preview)
                                                       │
                                                       ▼
                                          match_queue_entries  (replaced per submission)
                                   │
   PATCH /api/matching/queue/{id}  │  PATCH /api/matching/queue/decisions  │  DELETE …/queue/{id}
                                   ▼
PATCH /api/submissions/{id}/shadow-bb-state ──► LpIngestService.commitMatchQueueDecisions
        (wizard step 4 → 5, first transition only)
                                          ├─ lp_records replaced for the facility
                                          ├─ applyLpMasterBaseline (child-first chain resolve)
                                          └─ LpAliasService.remember
```

Matching lives entirely in `pe-sub-api`. `pe-sub-extraction` produces the LP rows and does no LP
name matching. `pe-sub-jobs` feeds LP Master through `POST /api/lp-master/ingest`.

| Class | Role |
|---|---|
| `service/MatchingService` | Normalisation, scoring, banding, queue construction, match analysis |
| `service/LpMasterResolutionService` | Parent chain walk and child-first field resolution |
| `service/LpAliasService` | The learned-alias feedback loop |
| `service/LpIngestService` | Commit path — LP records plus baseline application |
| `service/LpMasterService` | LP Master CRUD, `parent` / `parent_id` consistency, `relinkParents` |
| `controller/MatchingController` | Queue read / decide / discard endpoints |

## 2.2 Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/submissions/{id}/confirm` | Builds (and replaces) the submission's match queue; sets wizard step 4 |
| GET | `/api/matching/queue?submissionId=` | Queue rows; parent routing resolved **on read**, not read back from the stored column |
| PATCH | `/api/matching/queue/{id}` | Single decision; `masterName` sets the override and forces `Accepted` |
| PATCH | `/api/matching/queue/decisions` | Batch decisions in one transaction (literal segment routes ahead of `{id}`) |
| DELETE | `/api/matching/queue/{id}` | Discard a row outright |
| POST | `/api/matching/test` | Match Test Tool — top 10 candidates for an arbitrary name |
| PATCH | `/api/submissions/{id}/shadow-bb-state` | Commits decisions on the first transition to step 5 |
| GET | `/api/lp-master/{id}/children` | Direct feeders/SPVs of a record |
| GET | `/api/lp-master/{id}/aliases` | Learned agent strings for a record |
| GET / PUT | `/api/config/matching` | `matching_config` read/write (Match Thresholds screen) |

Queue DTO fields: `agentName`, `masterName`, `masterLpId`, `agentParent`, `masterParent`, `score`,
`decision`, `status`, `isNew`, `reasons[]`, `matchDetails`.

## 2.3 Data model as built

`lp_master` is **self-referencing** — a sponsor and a feeder carry identical attributes, so one table
avoids duplicate schemas and UNION reads. Both the display string and the resolved link are kept.

```sql
-- V1_1__schema.sql
CREATE TABLE lp_master (
    id                              SERIAL       PRIMARY KEY,
    investor_name                   VARCHAR(255) NOT NULL UNIQUE,
    parent                          VARCHAR(255),          -- display + ingest field (name)
    spv                             BOOLEAN      NOT NULL DEFAULT FALSE,
    high_quality                    BOOLEAN      NOT NULL DEFAULT TRUE,
    investor_type                   VARCHAR(255),
    institutional_or_hnw            VARCHAR(255),
    region_location                 VARCHAR(255),
    investment_grade                BOOLEAN      NOT NULL DEFAULT FALSE,
    sp_rating                       VARCHAR(50)  NOT NULL DEFAULT '',
    moodys_rating                   VARCHAR(50)  NOT NULL DEFAULT '',
    fitch_rating                    VARCHAR(50)  NOT NULL DEFAULT '',
    aum                             VARCHAR(50),           -- agent-reported display text
    nav                             VARCHAR(50),
    pension_assets                  VARCHAR(50),
    funding_ratio                   NUMERIC(7, 4),
    ubs_lp_category                 VARCHAR(255),
    ubs_default_advance_rate        NUMERIC(7, 4),         -- fraction
    ubs_default_concentration_limit NUMERIC(20, 2),        -- percent-or-dollars, split by magnitude
    notes                           TEXT,
    created_at                      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- V1_4__lp_parent_child.sql
ALTER TABLE lp_master
    ADD COLUMN parent_id          INTEGER REFERENCES lp_master(id) ON DELETE SET NULL,
    ADD COLUMN is_ultimate_parent BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_lp_master_parent_id ON lp_master(parent_id);

CREATE TABLE lp_aliases (
    id            SERIAL       PRIMARY KEY,
    lp_master_id  INTEGER      NOT NULL REFERENCES lp_master(id) ON DELETE CASCADE,
    uploaded_name VARCHAR(255) NOT NULL UNIQUE,   -- canonical key: trimmed, collapsed, UPPER
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

ALTER TABLE match_queue_entries
    ADD COLUMN matched_lp_master_id INTEGER REFERENCES lp_master(id) ON DELETE SET NULL;
```

**`parent` vs `parent_id`.** The string is retained, not replaced: `pe-sub-jobs`, the agent BB
extraction rows and `lp_records` all speak the *name*. `parent_id` is the resolved link the matcher
traverses. `LpMasterService.applyParentLink` writes both together on every save, and
`is_ultimate_parent` is derived inside `LpMaster.setParentId` (`ultimateParent = (parentId == null)`).

**The feed's self-name convention.** The LP Master feed writes a row's own `investor_name` into
`parent` to mean *no parent* — roughly 2,500 of about 6,000 rows. The V1_4 backfill excludes it
(`p.id <> c.id`), `applyParentLink` short-circuits on it, and `relinkParents` skips it. Such a row is
its own ultimate entity, **not** an unlinked-sponsor data error.

**Two match ids on `match_queue_entries`.** `matched_lp_id` → `lp_records` (facility-scoped, cleared
whenever a facility's records are replaced); `matched_lp_master_id` → `lp_master` (survives that,
`ON DELETE SET NULL` so curating LP Master does not delete queue history). Mixing them 409s on
confirm.

**`match_details` JSONB** holds the persisted Match Analysis payload: normalised agent name, winning
band, and the ranked top-5 candidates with jw / lev / combined / band.

## 2.4 `matching_config`

Seeded by `V1_3__config.sql` under `config.key = 'matching_config'`, served and written through
`/api/config/matching`.

```json
{
  "thresholds": { "autoAccept": 95, "reviewQueue": 80, "noMatch": 50,
                  "jwWeight": 0.6, "levWeight": 0.4,
                  "caseFold": true, "punctuation": true, "stripSuffixes": true,
                  "abbrevExpand": true, "retirementNormalize": true },
  "legalSuffixes":      [ { "abbr": "LP", "full": "Limited Partnership", "strip": true } ],
  "knownAbbreviations": [ { "token": "CalPERS", "expansion": "California Public Employees Retirement System" } ],
  "abbrevRegexMap":     { "Inv\\.?": "Investment", "Mgmt": "Management" }
}
```

Config is read per `prepare()` call, so a threshold change takes effect on the next queue build; it
does not rescore an existing queue. `abbrevRegexMap` is **client-only** — see §2.10.

## 2.5 Matching engine internals (`MatchingService`)

**Normalisation order** (`normalize`), each step gated by its config flag:

1. `knownAbbreviations` token expansion — `Pattern.quote`d, case-insensitive, whole-word
2. Retirement rules — `\bret(irement)?\.?\s+sys(tem|\.)?` → `retirement system`, then bare `\bret\.` → `retirement` (order matters)
3. Case fold (`Locale.ROOT`)
4. Legal-suffix strip — anchored at end of string only: `(?i),?\s*\bABBR\b\.?\s*$`
5. Punctuation → space (`[^a-z0-9 ]`)
6. Whitespace collapse and trim

**Scoring.** `combined = round((jwWeight·JW + levWeight·LevSim) × 100)`, where
`LevSim = 1 − editDistance / maxLen`. Both algorithms are implemented in-class; no external string
library is used.

**Banding.** `AUTO_ACCEPT ≥ autoAccept > REVIEW_HIGH ≥ reviewQueue > REVIEW_LOW ≥ noMatch > NO_MATCH`.
`NO_MATCH` sets `is_new = true` and proposes no candidate; the other three all carry a candidate
name. Action labels are Accept / Review / Review / New.

**`Prepared` — the per-upload index.** Built once per submission, immutable, reused across rows:

- `exact` — normalised name → first original in list order. An identical name resolves in O(1) at
  score 100 with no fuzzy scoring.
- `lengthOrder` / `lengthOf` — candidate indices sorted by normalised length, supporting a
  **length-band prefilter**. With `levMin = (noMatch/100 − jwWeight) / levWeight` and
  `editDist ≥ |Δlen|`, a candidate outside `[(1−band)·len, len/(1−band)]` cannot reach the lowest
  threshold even with a perfect JW score, so pruning it cannot change any decision.
  `matchBestExhaustive` is retained as the reference implementation and test seam.

**Tie-break.** Highest combined score; ties go to the lowest candidate index — earliest in the sorted
master-name order. `analyze()` applies the same tie-break, so the panel's top candidate is always the
row's proposed match.

**Concurrency.** Rows are scored on `rows.parallelStream()`. `Prepared` and the master maps are
read-only from that point, and all persistence stays outside the parallel section.

**Per-row decision** in `buildMatchQueueEntries`:

| Condition | Band | matchedName | Score | Decision |
|---|---|---|---|---|
| Alias hit | `AUTO_ACCEPT` | alias target | 100 | `Accepted` |
| Top candidate ≥ autoAccept | `AUTO_ACCEPT` | top | combined | `Accepted` |
| Top candidate in a review band | `REVIEW_HIGH` / `REVIEW_LOW` | top | combined | `Pending` |
| Top candidate < noMatch | `NO_MATCH` | `null` (`isNew`) | combined | `Pending` |

`row_index` comes from the extraction row's `id`, falling back to `rowIndex` and then array position.
Multi-tab workbooks restart worksheet row numbers on each tab, so raw `rowIndex` is not unique and
cannot be the ordering key.

## 2.6 Parent/child resolution (`LpMasterResolutionService`)

`resolve` / `resolveIn` walk `parent_id` to the ultimate entity, returning
`Resolution(matched, chain, ultimateParent)`, where `chain` is matched-first and `ultimateParent` is
null when `matched` is itself ultimate.

- `MAX_DEPTH = 16` plus a `seen` set. Self-references and cycles **terminate the walk** rather than
  throw — corrupted data must not fail an upload, and the partial chain still resolves.
- `value(getter)` / `text(getter)` — first non-null (non-blank) walking child → ultimate. **Child
  wins, parent fills gaps.**
- `flag(getter)` — logical OR across the chain. Booleans have no "absent" state, so this is for flags
  a sponsor confers, such as investment grade. Flags describing the entity itself (SPV) read
  `matched` directly.
- `resolveAllByName` loads the table once and walks in memory — used by the queue read and the
  LP Master list, so there is no query per ancestor.

`MatchingController` resolves routing **on read** rather than trusting the stored `master_parent`
column: entries written before routing existed carry none, and the hierarchy may have been edited
since. A null answer therefore unambiguously means "the match is the ultimate entity", which the UI
renders as "Self".

`applyOverrideRouting` re-resolves from `master_name_override` when set, so the Ultimate Parent column
reflects an analyst's selection rather than the algorithm's original pick.

## 2.7 Alias feedback loop (`LpAliasService`)

- Canonical key: trim → collapse internal whitespace → `toUpperCase(Locale.ROOT)`. The unique index
  therefore means one string, one owner. The agent's original spelling is preserved on
  `match_queue_entries.extracted_name`.
- `lookupAll` — one query per upload, not one per row.
- `remember` — no-op when the string already points at the same record; **repoints** when it points
  elsewhere, because the analyst's latest decision is current truth. Aliases are stored against the
  **matched child**, never the parent.

## 2.8 Commit path (`LpIngestService.commitMatchQueueDecisions`)

1. Rows sorted by a **stable** sort on `extractionOrderKey` — preserves source order and, unlike the
   prior `HashMap` keying, drops nothing on duplicate or missing keys.
2. `clearMatchedLpIdsForFacility` + `deleteByFacilityId` + `flush` — the submission is authoritative.
3. One `LpRecord` per non-blank extracted line. Same-name lines stay **distinct** records; V1_4
   removed the `(facility_id, investor_name)` unique constraint for exactly this reason.
4. Accepted, non-new rows take the LP Master name (`master_name_override` before `matched_lp_name`);
   everything else keeps the agent name.
5. `applyLpMasterBaseline` writes the resolved chain's values into blank fields — investor type,
   institutional/HNW, region, ratings, AUM / NAV / pension assets / funding ratio — and **always**
   writes the UBS credit profile (`ubs_lp_category`, advance rate, concentration limit), which
   extraction never supplies. `spv` reads `matched`; `highQuality` and `investmentGrade` use `flag`.
   `lp_records.lp_master_id` is the **matched child's** id.
6. `applyExtractedJsonRow` then applies the document's own values over that baseline.
7. `aliasService.remember(extractedName, matchedId)`.
8. Reconciliation is logged: `extractedRows == persisted + skippedBlank` — this is what closed the
   "52 processed, 47 persisted" silent name-collapse.

## 2.9 Divergences from the original proposal

| Original proposal | As built | Why |
|---|---|---|
| Replace the `parent` string with `parent_id` | Both kept, written together | Jobs, extraction rows and `lp_records` all speak the name |
| `NULL` parent means ultimate | `parent_id IS NULL`; the feed's *self-name* string also means ultimate | Feed convention, roughly 2,500 rows |
| Jaro-Winkler alone at 0.85 | Weighted JW + Levenshtein, four bands (95 / 80 / 50) | Levenshtein catches mid-string edits JW under-penalises |
| Auto-match "optional" | Auto-accept at ≥ 95 is on by default | Volume; every other band still reaches the officer |
| `aum` / `nav` as `NUMERIC` | Still `VARCHAR` on `lp_master` | They carry the feed's display text; `lp_records` money moved to NUMERIC separately |
| Ratings `NULL` | `NOT NULL DEFAULT ''` | Resolution treats blank as absent via `text()` |
| Aliases keyed on the raw uploaded string | Keyed on the canonicalised (UPPER, collapsed) string | Otherwise a case variant creates a second owner |
| Grid with Accept / Search | Accept / Reject / Discard / Undo plus the Match Analysis panel | Search override is not yet surfaced (§2.10) |
| — | `match_details` JSONB, normalisation trace, candidate breakdown | Transparency requirement |

## 2.10 Known gaps and follow-ups

1. **No Search/Override UI.** `PATCH /api/matching/queue/{id}` and the batch endpoint both accept
   `masterName`, `applyOverrideRouting` re-resolves the chain, and `master_name_override` is honoured
   at commit — but `screens/MatchQueue` never sends it. An LP Master picker is the missing piece.
2. **`abbrevRegexMap` is client-only.** `MatchingService.parseConfig` reads only
   `knownAbbreviations`. The UI's `buildNormSteps` and `utils/fuzzyMatch` also apply
   `abbrevRegexMap`, so the displayed normalisation trace can diverge from what the server actually
   compared. Either teach the server the regex map or drop it from the trace.
3. **The UI trace hardcodes rules the server owns.** Punctuation is `[.,\-()]` client-side versus all
   non-alphanumerics server-side; suffix stripping is unanchored client-side versus end-anchored
   server-side; the retirement rules are duplicated as literals. `analyze()` already returns
   `normalized` and the panel prefers it, but the step-by-step trace is still reconstructed locally.
4. **The Parent/Sponsor signal reports a score adjustment that is never applied.**
   `buildParentSignal` labels "+3 pts / +1 pt / −2 pts"; the server's combined score is unaffected.
   Either fold the signal into scoring or reword it as corroboration only.
5. **`status` duplicates `decision`** in `MatchQueueItemDto`. The UI's `row.status !== 'Auto-accept'`
   guards are therefore unreachable — the backend only ever sends Pending / Accepted / Rejected /
   Manual.
6. **Matching is not facility-scoped.** Every row scores against the entire LP Master. That is fine
   at about 6,000 rows with the length-band prefilter; revisit if the master grows an order of
   magnitude.
7. **No alias administration.** Aliases are read-only on the LP Master panel — no delete, and no bulk
   view of what has been learned.
8. **Stale doc references in code.** `MatchingService`, `LpAliasService`,
   `LpMasterResolutionService` and `V1_4__lp_parent_child.sql` all cite
   `pe-sub-docs/LP_Mapping_and_Database_Architecture.md`, which is this file's former name.

## 2.11 Test inventory

**`pe-sub-api`** (`src/test/java/com/ubs/pesubapi/`)

| Test | Covers |
|---|---|
| `MatchingServiceTest` | Normalisation steps, scoring, banding, exact and length-band paths against `matchBestExhaustive` |
| `MatchQueueIntegrationTest` | Queue build / read / decide / discard over a real database |
| `LpMasterParentChildIntegrationTest` | `parent` / `parent_id` consistency, rename repointing, adoption, cycle rejection |
| `ParentResolutionCommitIntegrationTest` | Chain walk and child-first field resolution through commit |
| `CommitAcceptedMatchesIntegrationTest` | Accepted / rejected / new commit outcomes and row-count reconciliation |
| `LpMasterWriteBackIntegrationTest`, `LpMasterClearIntegrationTest`, `LpMasterDeleteIntegrationTest` | LP Master lifecycle around the link |
| `AliasConfigBuilderTest` | Alias and config construction |

**`pe-sub-ui`** (`src/__tests__/`)

| Test | Covers |
|---|---|
| `matchAnalysis.test.ts` | Candidate rows come from the backend `matchDetails`, with an empty state when none — the panel never fabricates matches |
| `lpMasterRecords.test.ts` | Hierarchy rendering, Self versus sponsor, unlinked-sponsor ⚠ |
