# Outstanding Workstreams — AI Agent Execution Handoff

**Status:** Ready for agent pickup, with the external dependency and decision gates called out below  
**Prepared:** 2026-07-18  
**Scope:** `pe-sub-jobs`, `pe-sub-api`, `pe-sub-ui`, and `pe-sub-docs`

## 1. Purpose and execution order

This document consolidates the four outstanding workstreams into one implementation runbook. Each
workstream should be delivered and committed separately so it can be reviewed or reverted without
pulling unrelated changes with it.

Recommended order:

1. **Task 2 — UBS LP Classification reverse lookup.** Do this before Task 1 because both change
   `pe-sub-jobs/scripts/lp_db_extract.py`, and the chaos tests must exercise the final lookup behavior.
2. **Task 1 — AI Chaos Monkey.** Integration is blocked until the Claude/Fable AI artifact is
   available, but an agent may inspect and test the existing work while waiting.
3. **Task 3 — LP Master golden-record UI and CRUD.** Independent of Tasks 1–2 after the existing
   `lp_master` load path is treated as the baseline.
4. **Task 4 — Subscription Line Facility Structure.** Start with the contract/design gate, then
   implement persistence and UI before adding fee or collateral-waterfall calculations.

Tasks 3 and 4 can be developed independently. Tasks 1 and 2 must not be assigned to agents editing
the same Python file concurrently.

## 2. Rules every agent must follow

1. Read the workspace `CLAUDE.md` and the target repository's `CLAUDE.md` before editing.
2. Run `git status --short` and `git diff` in every repository being touched. The workspace may
   contain uncommitted user or agent work. Preserve it; never reset or overwrite it.
3. The active UI is **`pe-sub-ui`**. Never implement in the archived `pe-sub-platform` prototype.
4. Use existing service and repository layers. Do not put database access in controllers or API
   calls directly in React components.
5. Treat input/output contracts, null handling, RBAC, audit events, and error states as part of the
   implementation—not follow-up polish.
6. For API changes, update `pe-sub-api/README.md`, `pe-sub-docs/openapi.yaml`, and the Postman
   collection. For a new or changed UI data source, update `pe-sub-ui/README.md`.
7. Add tests at the same time as code. API endpoint tests must use the real integration-test
   database; UI service tests must use responses that mirror the real API contract.
8. Before handoff, report the changed files, exact test commands/results, unresolved decisions, and
   any generated files intentionally left uncommitted.

## 3. Baseline and collision warnings

- `pe-sub-jobs/scripts/lp_db_extract.py` already has substantial in-progress changes related to a
  chaos mode and classification-matrix logic. Inspect the diff and build on it; do not replace the
  file with a generated answer.
- `pe-sub-docs/AI Chaos Monkey for Data Quality.md` is exploratory AI output, not accepted
  production requirements.
- `LP_DB_EXTRACT_DESIGN.md` currently contains contradictory statements: D8 says to leave UBS
  classification blank, other sections describe deriving it from `UBSAR`, and the in-progress
  Python script derives it from LP attributes using the BB criteria matrix. For this workstream,
  the user's requested **reverse lookup from exported UBS values** is authoritative. Task 2 must
  reconcile the code and documentation.
- `LP_MASTER_UI_CRUD_DESIGN.md` is a draft with open product decisions. The defaults in Task 3 below
  allow implementation to proceed unless the product owner overrides them.
- `NEXT_TASKS.md` describes facility concepts but not a complete calculation contract. Task 4 must
  not invent fee accrual or junior collateral-waterfall formulas.

---

## Task 2 — UBS LP Classification reverse lookup for the LP Data Export script

### Outcome

Populate `ubs_classification` in `lp_master.csv` and `ubs_cls` in
`lp_facility_seeds.csv` by reverse-looking up the exported UBS advance rate and concentration limit,
without confusing the export's `Classification` column (the **Agent LP Category**) with the UBS
classification.

### Source files

- `pe-sub-jobs/scripts/lp_db_extract.py`
- `pe-sub-jobs/data/reference/bb_criteria_matrix.csv`
- `pe-sub-jobs/data/reference/ubs_rate_tiers.csv` (legacy behavior to retire or clearly demote)
- `pe-sub-docs/LP_DB_EXTRACT_DESIGN.md`
- `pe-sub-docs/BB_CRITERIA_DESIGN.md`

### Required lookup contract

1. Normalize `UBSAR`, `UBSCL`, and `FundingRatio` into numeric percentages. Accept existing input
   forms such as `0.9`, `90`, and `90%` according to the script's established percent parser.
2. Select the applicable matrix advance-rate column using `FundingRatio`: below 40% uses
   `adv_rate_lt40_pct`; 40% or above uses `adv_rate_gte40_pct`.
3. Find matrix rows whose applicable advance rate equals `UBSAR` and whose concentration limit
   equals `UBSCL`. Comparisons must use an explicit small decimal tolerance, not string equality.
4. Collapse multiple rating-band rows that resolve to the same UBS classification into one
   classification candidate.
5. If exactly one distinct classification remains, return it.
6. If no classification or more than one distinct classification remains, **do not guess**. Leave
   the classification blank and add the row to a review report with the reason `UNMATCHED` or
   `AMBIGUOUS`, the source values, and all candidate classes.
7. Missing `UBSAR`, `UBSCL`, or a required funded percentage is reportable and non-fatal. The source
   record must still be written; the extract's no-drop rule remains in force.
8. Apply the lookup per source row for facility seeds. For the golden LP record, use the existing
   best-record consolidation independently for `UBSAR`, `UBSCL`, and `FundingRatio`, then run the
   same lookup function once. Do not maintain separate lookup implementations.
9. Keep `Classification` mapped only to `agent_cls`. Never use it as a UBS-class fallback.

If product later wants a deterministic tie-break for ambiguous rate/limit combinations, add it as
an explicit reference-data priority column and test it. Do not encode an undocumented ordering in
Python.

### Agent steps

1. Inspect the current Python diff and identify `classify_ubs`, matrix loaders, seed/master builders,
   report writers, and summary counters.
2. Write focused unit tests for the lookup contract before replacing the current classification
   call sites.
3. Implement one pure reverse-lookup function returning a structured result: mapped class, status,
   candidate classes, and normalized inputs.
4. Use it in both `build_master` and the per-facility seed builder.
5. Add `unmatched_ubs_classifications.csv` (or an equivalently explicit name), written only when
   non-empty and removed when stale. Include a leading summary comment consistent with existing
   review reports.
6. Update `EXTRACT_SUMMARY.txt` counters to report mapped, unmatched, ambiguous, and missing-input
   totals for both master and seed outputs.
7. Remove or isolate stale threshold-only behavior so `ubs_rate_tiers.csv` cannot silently override
   the matrix reverse lookup.
8. Reconcile all D8, §6.3, §6.4, test-plan, sign-off, and appendix statements in
   `LP_DB_EXTRACT_DESIGN.md` with the final behavior.

### Required tests

- Exact unique rate/limit match.
- Equivalent percent formats (`0.9`, `90`, `90%`).
- Both sides of the 40% funded boundary, including exactly 40%.
- Several rating bands collapsing to the same classification.
- Multiple distinct classes producing `AMBIGUOUS`, not a guessed class.
- No candidate producing `UNMATCHED`.
- Missing rate, limit, or funded input leaving the class blank without dropping the row.
- Agent classification remaining unchanged.
- Golden-record lookup using consolidated best values and seed lookup using row values.
- Review report and summary counts, including stale-report removal.

### Definition of done

- Both generated CSVs follow the same reverse-lookup contract.
- Every unresolved classification is visible in a report; no source row is lost.
- The Python tests pass, a representative extract run completes, and the design doc contains no
  remaining conflicting claims about classification provenance.

---

## Task 1 — AI Chaos Monkey for Data Quality

### Status and dependency

**Pending external input from Claude/Fable AI.** Do not mark this task complete until that artifact
has been received, reviewed, and either integrated or explicitly rejected with reasons. The local
script already contains in-progress chaos-related code, so the incoming artifact is a review input,
not permission to overwrite current work.

### Outcome

Provide a deterministic, opt-in local test mode that degrades a clean LP Data Export with realistic
analyst-entry defects, while preserving legal/cash-critical fields and emitting a complete mutation
audit. No AI model or network service may run in the production extraction path.

### Source files

- Incoming Claude/Fable AI artifact
- `pe-sub-docs/AI Chaos Monkey for Data Quality.md`
- `pe-sub-jobs/scripts/lp_db_extract.py`
- Task 2's finalized reverse-lookup tests and review-report behavior

### Agent steps

1. Obtain and save the Claude/Fable output outside production source until it has been reviewed.
2. Compare its proposed mutations with the existing Python diff and the hierarchy below. Record
   which ideas are accepted, modified, or rejected; never paste generated code wholesale.
3. Keep chaos disabled by default with an obvious top-of-script setting. Require a fixed/default
   random seed and record the seed in `EXTRACT_SUMMARY.txt` for reproducibility.
4. Apply mutations to an in-memory copy after source reading and before normalization/lookup. Never
   modify the source XLSX or base `facilities.csv`.
5. Preserve sacred fields: facility/join keys, dates used for identity, commitments, called,
   uncalled, and other fields explicitly used as legal/cash controls. If the final policy changes
   this list, document and test every exception.
6. Add controlled mutation families for:
   - investor-name casing, suffix, spacing, and benign typographical drift;
   - ratings formatting and stale/not-rated variants;
   - investor-type and Agent-category aliases or misspellings;
   - AUM, NAV, and pension-asset scale/range/free-text forms, including mixed units;
   - nullable non-critical fields such as selected concentration or funding inputs.
7. Bound mutation rates per family. A row may receive more than one mutation, but the mutation log
   must make this visible.
8. Write `chaos_report.csv` only when chaos is enabled and mutations occurred. Include source row,
   investor/facility identifiers, field, original value, mutated value, mutation type, and seed.
9. Verify the corrupted data exercises Task 2's mapped/unmatched/ambiguous paths and the existing
   investor-type/Agent-category review reports.
10. Update `pe-sub-jobs/README.md` with enable/disable, seed, outputs, and the statement that this is
    a local test utility only. Replace the exploratory chaos document's code fragments with a link
    to the canonical implementation or clearly mark them non-canonical.

### Required tests

- Same seed and input produce byte-for-byte identical mutations.
- Different seeds produce different mutations.
- Disabled mode produces no mutations or chaos report.
- Source rows and source files remain unchanged.
- Sacred fields never change.
- Each mutation family has a focused fixture test, including NAV ranges such as `1-5M`, `$2-6Bn`,
  `500M - 2Bn`, and `1t`.
- Mutation report contains exact before/after values.
- No record is dropped even when chaos creates an unmatched classification or reference value.

### Definition of done

- Claude/Fable output has been dispositioned.
- Chaos is deterministic, off by default, auditable, and local-only.
- Unit tests and a representative end-to-end extract run pass with chaos both off and on.

---

## Task 3 — LP Master: expose golden records in the UI and add CRUD

### Outcome

Expose the bank-wide `lp_master` golden records on the active LP Master screen and support
authorized create, update, and existing delete operations without mixing golden profiles with
per-facility `lp_records`.

### Canonical design and implementation defaults

Use `pe-sub-docs/LP_MASTER_UI_CRUD_DESIGN.md` as the detailed field/layout reference, with these
defaults unless product directs otherwise:

- Use a sectioned modal editor.
- Allow manual create for off-export LPs.
- Allow investor-name rename, returning 409 on collision.
- Preserve current Phase 1 write-back behavior: a later Shadow BB settle may overwrite curated UBS
  credit-profile fields. Show a concise warning in the editor and document it.
- Follow the current RBAC matrix and server rules. Resolve the draft's ANALYST-only wording versus
  the UI `editLp` capability before coding; the API and UI must enforce the same role set. Reads stay
  available to authenticated viewers.

### Agent steps — API

1. Inspect `LpMasterController`, `LpMasterService`, `LpMasterRepository`, `LpMasterDto`, global
   exception handling, `SecurityConfig`, audit conventions, and existing integration-test fixtures.
2. Add a validated Java record request DTO matching the editable `LpMasterDto` fields. Never expose
   the entity as the request/response contract.
3. Add `POST /api/lp-master` returning 201 and `PUT /api/lp-master/{id}` returning 200.
4. Put create/update mapping and uniqueness checks in `LpMasterService`. Return 404 for a missing id
   and RFC 9457/`ProblemDetail` 409 for duplicate name or rename collision.
5. Audit and broadcast successful creates and updates. Do not emit success notifications before a
   transaction commits.
6. Add explicit `SecurityConfig` matchers for the agreed curator roles. Keep `/ingest` and `/clear`
   SERVICE-only.
7. Add integration tests for all-field create→GET round trip, list visibility, update and
   `updatedAt`, duplicate create, rename collision, missing id, authorized roles, and 403 for every
   unauthorized role.
8. Update the API README, OpenAPI specification, and Postman collection.

### Agent steps — UI

1. Inspect `pe-sub-ui/src/screens/LPMaster/index.tsx`, its component tree, shared modal/table hooks,
   API types/normalizers, `roles.ts`, and existing LP Master screen/service tests.
2. Add typed `api.lpMaster.create` and `update` methods with mocked service tests for exact URL,
   method, request, and response contracts.
3. Extend the existing screen view state with `master`. Load `count`, golden rows, and filters from
   `api.lpMaster`; do not reconstruct golden rows from facility positions.
4. Add the **View Master {count} LP records** entry point next to the existing all-positions view.
5. Render only golden fields listed in §5.2 of `LP_MASTER_UI_CRUD_DESIGN.md`. Reuse sorting,
   pagination, resizing, `Tag`, and `lpSizeFormat`.
6. Build the Add/Edit modal with Identity, Classification, Ratings, Financial Scale, and UBS Credit
   Profile sections. Validate required investor name and preserve free-text financial scale values.
7. Gate Add/Edit/Delete using the RBAC decision from the API step. Client gating is usability only;
   server enforcement remains authoritative.
8. Refresh the master list/count after successful mutations and preserve the user's active filters
   where possible. Surface loading, empty, validation, conflict, not-found, and network-error states.
9. Add component tests for view switching, real golden fixture fields, create/edit/delete, read-only
   viewer behavior, empty state, loading state, and API error state.
10. Update `pe-sub-ui/README.md` and mark resolved decisions/status in
    `LP_MASTER_UI_CRUD_DESIGN.md`.

### Definition of done

- Users can distinguish facility positions from golden LPs.
- Authorized curators can create, edit, and delete; viewers cannot mutate.
- API/UI contracts and RBAC agree, all required integration/component/service tests pass, and all
  API documentation is current.

---

## Task 4 — Subscription Line Facility Structure changes

### Outcome

Represent committed/uncommitted availability, facility tranches, and senior/junior priority without
overloading Agent BB template metadata or prematurely inventing legal/financial calculations.

### Source files

- `pe-sub-docs/NEXT_TASKS.md`
- `pe-sub-api/src/main/resources/db/migration/V1_1__schema.sql`
- `pe-sub-api` Facility entity/DTO/controller/service and BB calculation services
- `pe-sub-jobs` facility CSV model/processor/config
- `pe-sub-ui` facility types, API client, LP Master facility grid/detail editor, and Shadow BB views

### Step 0 — required design gate

Before changing schema, append an implementation section to `NEXT_TASKS.md` and obtain or record
answers for:

1. Are committed/uncommitted and senior/junior attributes facility-level, tranche-level, or both?
2. What are the authoritative enum labels and null/default behavior for existing facilities?
3. What units and precision apply to unused commitment fee rate, pricing spread, intercreditor
   limit, and exposure amounts?
4. Does the first release only store/display the unused fee, or calculate accrual? If calculating,
   define day-count convention, dates, balance source, currency, and rounding.
5. How is an LP position assigned to a tranche: explicit `tranche_id`, source worksheet/tab,
   classification rule, or manual assignment?
6. Can one collateral pool support multiple tranches? If yes, define allocation order and whether an
   LP may support more than one tranche.
7. How is a junior facility linked to its senior facility, and which exposure amount consumes
   collateral first? Define the exact waterfall and behavior when senior data is absent or stale.
8. Are these fields included in facility CSV ingest/export, manually curated in the UI, or both?

Do not implement fee accrual or junior headroom until those formulas are answered and expressed as
golden-table tests.

### Recommended Phase 1 model

Use this as the design starting point, not as permission to bypass Step 0:

- Add constrained facility attributes for `commitment_type` (`COMMITTED`/`UNCOMMITTED`) and, if the
  business confirms it is facility-level, `lien_priority` (`SENIOR`/`JUNIOR`).
- Add nullable rate/limit fields only after units are fixed in their names and API descriptions.
- Create a real `facility_tranches` table with a facility FK, stable tranche code/name, display
  order, investor-pool description, and confirmed tranche-specific economics.
- Add a nullable `tranche_id` FK to `lp_records` only if LP-to-tranche assignment is confirmed.
- Model a senior/junior relationship with an explicit FK or relationship table; never infer it from
  names or display order.
- Do not reuse `bb_templates.tranche_count`; that describes workbook recognition, not legal facility
  structure.

### Agent steps — persistence and API

1. Inventory all current facility fields and every DTO/CSV/UI consumer. Produce a field-impact table
   in `NEXT_TASKS.md` before editing.
2. Add a new forward-only Flyway migration if the baseline has been applied anywhere shared. Do not
   rewrite an applied migration. Use backward-compatible defaults for existing rows.
3. Add entities and repositories for tranches/relationships and extend facility DTO/request records.
4. Keep database mutations in services and validate enums, rates, unique tranche codes per facility,
   FK ownership, and delete behavior.
5. Add noun-based REST resources, preferably nested reads/writes such as
   `/api/facilities/{facilityId}/tranches`, with correct 201/200/204/400/404/409 behavior.
6. Extend facility ingest only for fields confirmed as source-owned. Preserve compatibility with
   existing CSV files by making new columns optional and testing older rows.
7. Add integration tests for defaults, field round trips, multi-tranche facilities, invalid enums,
   duplicate tranche code, cross-facility FK misuse, deletion/reassignment rules, and RBAC.
8. Update API README, OpenAPI, Postman, and the solution design.

### Agent steps — UI

1. Extend typed facility/tranche contracts and API methods; add service tests first.
2. Add facility-structure fields to the established facility detail editor. Show conditional inputs:
   unused fee only for committed structures, senior relationship/intercreditor data only where the
   approved model requires it.
3. Add a tranche table/editor under the facility, with clear empty/loading/error states and
   authorized mutation controls.
4. Show tranche identity on LP positions only after a real `tranche_id` contract exists. Do not
   derive it client-side from investor classification.
5. Update any Shadow BB summary labels or grouping only after the backend returns authoritative
   tranche calculations.
6. Add UI tests for existing facilities with defaults, committed/uncommitted conditional fields,
   multi-tranche rendering, read-only roles, validation, and API failures.
7. Update `pe-sub-ui/README.md`.

### Agent steps — calculations (Phase 2, gated)

1. Encode approved fee and waterfall examples as golden-table tests before production code.
2. Implement calculations server-side in dedicated services using exact decimal arithmetic.
3. Define missing/stale senior exposure behavior explicitly; never treat absent data as zero unless
   the approved contract says so.
4. Return calculation inputs and results in DTOs so the UI displays authoritative values rather than
   reproducing the engine.
5. Add end-to-end integration tests for tranche-independent BBs, senior collateral consumption,
   junior residual headroom, limits, boundary values, and rounding.

### Definition of done

- Phase 1 is complete when the approved structure can be persisted, ingested where applicable,
  edited, read, audited, and round-tripped without breaking legacy facilities.
- Phase 2 is complete only when approved fee/waterfall golden cases pass in the backend and the UI
  displays those authoritative results.

---

## 4. Final integration checklist

After all four tasks are complete:

1. Run the LP export with chaos off, then on with a fixed seed; review every generated report.
2. Load the generated facility, LP Master, and LP seed CSVs through `pe-sub-jobs` into a clean test
   database.
3. Confirm golden LP counts, facility-position counts, classification mapped/unresolved totals, and
   no-drop guarantees against `EXTRACT_SUMMARY.txt`.
4. Verify the LP Master golden view and CRUD with each supported role.
5. Verify legacy and newly structured facilities through ingest, facility editing, Run Shadow BB,
   review, and reporting.
6. Run the full test suites for every changed repository plus UI typecheck and production build.
7. Run `git diff --check` in every repository and inspect documentation/spec diffs for stale field
   names or contradictory behavior.

The work is not complete merely because individual unit tests pass. Completion requires compatible
contracts across Python output, Spring Batch ingest, the API/database, the active UI, and the
published API documentation.
