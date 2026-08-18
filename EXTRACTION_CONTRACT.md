# Contract: `pe-sub-api` ⇄ `pe-sub-extraction`

**Stack:** Spring Boot 4.1, both services compiled at **Java 21**
(`<java.version>21</java.version>` in both `pom.xml`) though the local toolchain runs a JDK 25 JVM —
raising the language level is still pending · React + Vite + TypeScript (`pe-sub-ui`).
**Principle:** recognition + orchestration live in `pe-sub-api`; `pe-sub-extraction` is a stateless,
deterministic parser. No agent-bank/fund names are hardcoded in any layer — they come only from
template contents (the imported registry) or user entry.

---

## 1. Topology & async handoff

```
pe-sub-ui ──(1) POST /api/submissions (multipart)──▶ pe-sub-api
   ▲                                                  │ persist Submission(status=Processing)
   │ (2) 202 Accepted + SubmissionDto                 │ hand to extractionExecutor (bounded), return now
   │                                                  ▼  [background thread]
   │                              (3) POST /api/inspect ──▶ pe-sub-extraction ──▶ WorkbookSignals
   │                              (4) TemplateRecognitionService → ResolvedTemplate
   │                              (5) POST /api/extract(resolved) ──▶ ExtractionResponse
   │                              (6) ingest + Submission.status → Review | Error
   └──(7) poll GET /api/submissions/{id} until status ≠ 'Processing' ◀──────────────

   then, synchronously, through the wizard:
   (8) confirm (step 4) → shadow-bb-state (step 5) → complete (Pending Review)
   (9) Manager accept → Processed / facility Active   ·   reject → back to step 5
```

- [x] Upload never blocks the UI thread — heavy POI parsing runs on `extractionExecutor`.
- [x] Backpressure: bounded pool (defaults `core 2 / max 4 / queue 50`, CallerRuns fallback) caps
  heap pressure; sizing is configuration (`app.extraction-executor.*`), not code.
- [x] Status is the polling contract; no websocket required (add SSE later if desired — see §6).

---

## 2. `pe-sub-extraction` API (stateless parser)

### `POST /api/inspect` — raw signals for recognition
- **Request** `multipart/form-data`: `file` (required), `rows?: number` (default `15`).
- **Response** `200` `WorkbookSignals`.
- Pure parse: returns sheet names + first `rows` raw rows/sheet. **No** recognition.
- `pe-sub-api` calls it twice with different depths: `rows=15` (default) for the upload pipeline,
  `rows=200` for template profiling (`POST /api/bb-templates/profile`), which needs enough of the
  sheet to find a header row and the LP-category banners below it.

### `POST /api/extract?forward=false` — deterministic extraction
- **Request** `multipart/form-data`:
  - [x] `facilityId: string` (required), `file` (required)
  - [x] `aliasConfig?: string` (JSON: `Record<ExtractionKey, string[]>`)
  - [x] `sheetNameHint?: string`, `headerRowHint?: number` (0-based), `headerRowSpan?: number`
  - [x] `classificationConfig?: string` (JSON: `Record<GroupHeaderText, Classification>`)
  - [x] `agentBank?: string` (passthrough tag only — not used for recognition)
  - [x] `sheetNames?: string[]`, `autoDiscoverTabs?: boolean` (default `false`), `skipRowKeywords?: string[]`
  - [x] `forward?: boolean` — **defaults to `true`**, which makes the engine *push* the result to
    `pe-sub-api` itself (`ApiForwarder`, the legacy fire-and-forget path). `ExtractionClientService`
    always sends `forward=false` and consumes the response synchronously, so the push is dead in
    the current pipeline — but the default still bites any caller (curl, a test) that omits it.
  - [x] `forceTemplate?: string` (legacy; recognition is resolved upstream — see §7)
- **Response** `200` `ExtractionResponse`. `template.version` is **null** here; the recognised
  template name is set by `pe-sub-api` (it owns recognition).

### Post-extraction derivation (`DerivedFieldCalculator`) — July 2026, narrowed August 2026
After the sparse-row filter, the engine supplements a record with canonical fields the workbook has
**no column for**, computed from other mapped fields **on the same row**:

| Canonical field | Formula |
|---|---|
| `Called Capital` | `Commitment − Uncalled Capital` |

- **Derivation is strictly row-local.** Fields whose formula needs a facility-wide total —
  `% of Capital Commitments`, `Concentration (%)`, `Excess Concentration`,
  `Excess Concentration (%)` — are **not** derived. The only total available at this point is a sum
  over the rows that survived extraction, and the agent's own stated total is discarded by the
  summary-row filter; any dropped row, sparse-filtered row or unparseable amount silently shrinks
  that denominator and overstates every LP's percentage. These fields are left blank for the analyst
  to supply. The borrowing-base engine computes its own concentration figures from the full facility
  LP set (`pe-sub-api` `BbCalculationService`), so the BB is unaffected.
- **No program overwrites an agent-supplied value.** Derivation applies only where the workbook
  mapped no column to that field; a field already present in the extraction's mappings is
  agent-reported and is left exactly as the agent stated it. This is a constraint on the *software*,
  not on people — an analyst may correct any value where the UI allows it (discard a row or remap a
  header at Review Extraction; edit the committed record via `PATCH /api/lpRecords/{id}` thereafter).
- **Back-fill happens, but later and elsewhere.** Many Agent BBs deliberately carry only the bare
  minimum, so missing attributes are filled from LP Master — not by this engine, and not at
  extraction time. On Commit Decisions, an *accepted* match pre-populates the new `LpRecord` from
  the resolved LP Master chain (`pe-sub-api` `LpIngestService.applyLpMasterBaseline`):
  - identity and profile (`investorType`, `institutionalOrHnw`, `regionLocation`, `parent`),
    ratings (S&P / Moody's / Fitch) and financial scale (AUM, NAV, pension assets, funding ratio)
    are filled **only where the record is still blank or null** — an extracted agent value always wins;
  - the UBS credit profile (`ubsLpCategory`, default advance rate, default concentration limit) is
    **always** applied, because extraction never produces those fields — LP Master is their sole
    source ahead of the credit officer's review;
  - a matched child/feeder routes up its parent chain (`LpMasterResolutionService`), while the
    matched row itself stays the identity of record so the audit trail keeps naming the entity the
    agent listed.
  Within the extraction engine itself the rule still holds absolutely: it fills gaps, never overwrites.
- Derived values carry the sourceHeader prefix **`Derived: `** and a confidence equal to the minimum
  confidence of their inputs, so the Review Extraction screen can distinguish computed from
  agent-reported values. Derived cross-check inputs — **not** agent figures.
- The engine adds the corresponding `FieldMappingEntry`s for any field it derived. Those *mapping*
  entries carry `confidence: 1.0` (the derivation itself is certain); the min-of-inputs confidence
  applies to the derived **field value**.
- Input guards — the identity is only emitted when it demonstrably holds:
  - a value containing `%` is rejected outright (a `% Committed` column mis-mapped to `COMMITMENT`
    would otherwise poison the subtraction);
  - parsed amounts are taken as `abs()` — agent workbooks state uncalled both ways;
  - a negative result (uncalled > commitment: recallable distributions or bad data) emits **nothing**
    rather than a wrong number;
  - anything not cleanly numeric after stripping `$ , ( ) %` — e.g. `$1.1B` scale suffixes — is
    skipped rather than guessed.

---

## 3. `pe-sub-api` submission lifecycle API

### Upload & read
- [x] `POST /api/submissions` — `multipart`: `facilityId, agentBank, periodMonth, file, notes?, forceTemplate?`
  → **`202 Accepted`** + `SubmissionDto` (`status: 'Processing'`). *Async.*
- [x] `GET /api/submissions?facilityId=` → `SubmissionDto[]` (excludes `Processing`).
- [x] `GET /api/submissions/{id}` → `SubmissionDto` *(poll target)*.
- [x] `GET /api/submissions/{id}/extracted-lps` → stored extracted rows (JSON array; `[]` when none).
- [x] `GET /api/submissions/{id}/field-map` → stored `FieldMappingEntry[]`.
- [x] `GET /api/submissions/{id}/unrecognized-columns` → `string[]`.
- [x] `GET /api/submissions/{id}/doc-recognition` → `DocRecognitionDto` (Review Extraction header panel).

### Correct the extraction (wizard step 3)
- [x] `DELETE /api/submissions/{id}/extracted-lps/{rowId}` → `204` (discard one row).
- [x] `POST /api/submissions/{id}/reextract` — body `{ templateName?: string }` → `204`.
- [x] `POST /api/submissions/{id}/remap` — body `{ extractedHeader, canonical }` → `200`
  (saves the alias, then re-extracts; `502` if the engine is down — the alias is still saved).

### Advance the wizard
- [x] `POST /api/submissions/{id}/confirm` → `200 { templateSaved: false, templateName }`;
  builds the match queue and sets `wizardStep = 4`. **Never mutates the template registry** —
  templates are added only through the `/api/bb-templates` create/import/profile workflows.
- [x] `PATCH /api/submissions/{id}/shadow-bb-state?expectedVersion=` — body `{ overrides }` → `200`
  `SubmissionDto`; sets `wizardStep = 5` and, on the *first* transition to 5, commits accepted
  match-queue decisions into `lp_records`.

### Independent review (maker-checker)
- [x] `POST /api/submissions/{id}/complete?expectedVersion=` → status `Pending Review`, `wizardStep = 6`,
  `submittedBy` stamped, facility → `Pending Review`. Idempotent while pending.
- [x] `POST /api/submissions/{id}/accept` *(Manager only)* → status `Processed`, facility → `Active`,
  `lastRunAt` stamped, LP Master write-back, reclassified flags cleared. `409` unless `Pending Review`.
- [x] `POST /api/submissions/{id}/reject` — body `{ reason }` *(required)* → status back to `Review`,
  `wizardStep = 5`, `reviewNote` set, `submittedBy` cleared, facility → `Needs Review`.
  `400` on a blank reason; `409` unless `Pending Review`.
- [x] `POST /api/submissions/{id}/take-over` → reassigns `ownerUuName`/`ownerName` to the caller and
  notifies the previous owner. `409` on `Processed`/`Aborted`.
- [x] `POST /api/submissions/{id}/abort` → status `Aborted`; deletes the stored file, extraction row
  and match queue. `409` on `Processed`/already `Aborted`; `403` for a non-owner non-Manager.
- [x] `POST /api/submissions/facilities/{facilityId}/rerun-for-review` → `201`
  `{ snapshot, submission }` — re-opens a reviewed cycle from an existing BB snapshot.

### Write guards on every mutating endpoint
- [x] **Ownership** — `canModify` allows the owner, a Manager, or a legacy row with no owner;
  anyone else gets `403` as a `ProblemDetail` (`title: "Read-only"`).
- [x] **Optimistic concurrency** — `shadow-bb-state` and `complete` take `?expectedVersion=`; a
  mismatch against the JPA `@Version` returns `409` as a `ProblemDetail` (`title: "Conflict"`).

### Registry & self-adoption — `/api/bb-templates`
- [x] `GET/GET {id}/POST/PUT/DELETE /api/bb-templates` for registry CRUD (`POST` → `201`, `DELETE` → `204`).
- [x] `POST /api/bb-templates/import` — `multipart`: `file` (a BB template `*.xlsx` with `Template`,
  `Tabs`, `Groups` sheets), `mode=create|upsert` (default `create`) → `201` `BbTemplateDto`.
- [x] Template ID (`template_slug`) is the identity; duplicates auto-version (`gs-blue-owl-1`, …).
- [x] `POST /api/bb-templates/profile` — `multipart`: `file`, `agentBank?` → `200` `TemplateProposal`.
  **Self-adoption**: inspects the workbook at `rows=200` and pattern-matches it against the Field
  Mapping Dictionary to propose a template — header row, columns, tabs, agent/title clues,
  LP-category groups. Deterministic, no AI, no agent/fund names in code, and **persists nothing**:
  structural facts come back `high` confidence, semantic guesses `medium`/`low` for the operator to
  confirm and then save via `POST /api/bb-templates`. `502` if the engine is unreachable.

---

## 4. Strict TypeScript interfaces (no `any`)

```ts
// ── Engine signals (POST /api/inspect) ───────────────────────────────────────
export interface WorkbookSignals {
  readonly fileName: string;
  readonly sheets: ReadonlyArray<SheetSignals>;
}
export interface SheetSignals {
  readonly name: string;
  readonly rows: ReadonlyArray<ReadonlyArray<string>>; // first N raw rows
}

// ── Recognition output (pe-sub-api internal → pushed to /api/extract) ─────────
export interface ResolvedTemplate {
  readonly recognized: boolean;
  readonly slug: string | null;
  readonly templateName: string | null;     // == slug (identity is the Template ID)
  readonly agentName: string | null;
  readonly sheetName: string | null;
  readonly headerRowIndex: number | null;    // 0-based
  readonly headerRowSpan: number | null;
  readonly sheetNames: ReadonlyArray<string>;
  readonly autoDiscoverTabs: boolean;
  readonly groupMap: Readonly<Record<string, string>>; // headerText → classification
  readonly skipRowKeywords: ReadonlyArray<string>;
  readonly columns: ReadonlyArray<string>;
  readonly matchedBy: string;
}

// ── Extraction result (POST /api/extract) ────────────────────────────────────
export interface ExtractionResponse {
  readonly template: TemplateInfo;
  readonly records: ReadonlyArray<ExtractedRecord>;
  readonly totalFlagged: number;
  readonly fieldMappings: ReadonlyArray<FieldMappingEntry>;
  readonly unrecognizedColumns: ReadonlyArray<string>;
}
export interface TemplateInfo {
  readonly format: 'UNKNOWN';                // engine no longer names agents
  readonly version: string | null;           // recognised Template ID (set by pe-sub-api)
  readonly headerRowIndex: number;
  readonly sheetName: string | null;
}
export interface ExtractedRecord {
  readonly rowIndex: number;
  readonly fields: Readonly<Record<string, FieldValue>>;
  readonly requiresReview: boolean;
  readonly warnings: ReadonlyArray<Warning>;
  readonly fundSleeve: string | null;        // multi-tab provenance
}
export interface FieldValue {
  readonly value: string | null;
  readonly confidence: number;               // 0..1 (derived: min confidence of inputs)
  readonly sourceHeader: string | null;      // agent header, or "Derived: <inputs>" for computed fields
}
export interface Warning { readonly field: string; readonly message: string; readonly rowIndex: number; }
export interface FieldMappingEntry {
  readonly extractedHeader: string;
  readonly canonicalField: string;
  readonly confidence: number;
}

// ── Submission (poll target) ─────────────────────────────────────────────────
export type SubmissionStatus =
  | 'Processing'      // async pipeline in flight
  | 'Review'          // analyst is working it (wizard steps 3–5)
  | 'Pending Review'  // submitted for independent review (maker done, awaiting checker)
  | 'Processed'       // accepted by a Manager — terminal
  | 'Aborted'         // abandoned; file + extraction + match queue deleted — terminal
  | 'Error';          // pipeline failed
export interface SubmissionDto {
  readonly id: number;
  readonly facilityId: number;
  readonly facilityName: string | null;
  readonly agentBank: string;
  readonly periodMonth: string;              // stored as YYYY-MM-DD
  readonly status: SubmissionStatus;
  readonly fileName: string;
  readonly uploadedBy: number | null;
  readonly notes: string | null;
  readonly wizardStep: WizardStep;
  readonly version: number;                  // optimistic-concurrency token → ?expectedVersion=
  readonly shadowBbOverrides: unknown | null;
  readonly ownerUuName: string | null;       // ownership key (uuName, never a display name)
  readonly ownerName: string | null;         // display name, captured at upload
  readonly submittedBy: string | null;       // maker (uuName); cleared by reject()
  readonly reviewedBy: string | null;        // checker (uuName)
  readonly reviewNote: string | null;        // rejection rationale — "Changes Requested" signal
  readonly createdAt: string;                // ISO-8601
  readonly updatedAt: string;
}

// ── Review Extraction header panel (GET .../doc-recognition) ─────────────────
export interface DocRecognitionDto {
  readonly document: string;
  readonly format: string;                   // "Excel Workbook — <template> template" | "… — unrecognized template"
  readonly tablesIdentified: string;
  readonly tableLocation: string;
  readonly headerRow: number;                // 1-based, for display
  readonly totalRows: number;
  readonly mappedColumns: number;
  readonly unmatchedColumns: number;
  readonly headerInfo: string;
  readonly forcedTemplate: string;           // "" when not forced
}

// ── BB template registry ──────────────────────────────────────────────────────
export type TabRole = 'LP_GRID' | 'CONCENTRATION' | 'CAPITAL_CALL' | 'TOP_SHEET';
export interface BbTemplateDto {
  readonly id: number;
  readonly templateSlug: string | null;      // Template ID
  readonly templateName: string;
  readonly agentName: string | null;
  readonly templateClass: 'A' | 'B' | 'C';
  readonly sheetName: string | null;
  readonly headerRowIndex: number | null;
  readonly autoLearned: boolean;
  readonly trancheCount: number;
  readonly hasGroupingRows: boolean;
  readonly hasColorFlags: boolean;
  readonly autoDiscoverTabs: boolean;
  readonly summaryRowsAboveHeader: number;
  readonly summaryRowRange: string | null;
  readonly titleRow: number | null;
  readonly titleText: string | null;
  readonly detectKeys: ReadonlyArray<string>;
  readonly legend: ReadonlyArray<Readonly<Record<string, string>>>;
  readonly notes: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tabs: ReadonlyArray<BbTemplateTabDto>;
}
export interface BbTemplateTabDto {
  readonly id: number;
  readonly tabRole: TabRole;
  readonly tabSort: number;
  readonly sheetName: string | null;
  readonly sleeveName: string | null;
  readonly headerRowIndex: number | null;
  readonly headerRowSpan: number;
  readonly skipRowKeywords: ReadonlyArray<string>;
  readonly columns: ReadonlyArray<string>;
  readonly groups: ReadonlyArray<BbTemplateGroupDto>;
}
export interface BbTemplateGroupDto {
  readonly groupSort: number;
  readonly headerText: string;
  readonly classification: string;
}

// ── Self-adoption proposal (POST /api/bb-templates/profile) — persists nothing ─
export type ProfileConfidence = 'high' | 'medium' | 'low';
export interface ProfiledField<T> {
  readonly value: T;
  readonly confidence: ProfileConfidence;
  readonly evidence: string;                 // what in the workbook produced this guess
}
export interface TemplateProposal {
  readonly slug: ProfiledField<string>;
  readonly agentName: ProfiledField<string>;
  readonly titleText: ProfiledField<string>;
  readonly workbook: ProfiledField<'single' | 'multiple'>;
  readonly tabs: ReadonlyArray<ProfiledTab>;
  readonly autoDiscoverTabs: ProfiledField<boolean>;
  readonly detectKeys: ReadonlyArray<string>;
  readonly overallConfidence: ProfileConfidence;
}
export interface ProfiledTab {
  readonly sheetName: string;
  readonly headerRowIndex: ProfiledField<number>;  // 0-based
  readonly columns: ReadonlyArray<string>;
  readonly matchedCanonical: number;               // headers that mapped to a canonical field
  readonly groups: ReadonlyArray<ProposedGroup>;
}
export interface ProposedGroup {
  readonly headerText: string;
  readonly classification: string;
  readonly confidence: ProfileConfidence;
}
```

> **Java-side names.** The engine's records are `ExtractionResult` / `TemplateDetection` /
> `ExtractionWarning` / `FieldExtraction<T>`; the TS names above are the wire-contract view used by
> `pe-sub-ui`. `TemplateFormat` is an enum with the single value `UNKNOWN` — kept only as a legacy
> placeholder now that fund identity is resolved in `pe-sub-api`.

---

## 5. Submission state machine

```
  POST /api/submissions
          │
          ▼
   ┌────────────┐  inspect→recognize→extract→ingest ok   ┌──────────┐
   │ Processing │ ─────────────────────────────────────▶ │  Review  │ ◀──────┐
   └────────────┘                                        └──────────┘        │
          │ engine unreachable / pipeline throws               │             │
          ▼                                             step 3→4→5           │ reject
     ┌────────┐                                                │             │ (reason
     │ Error  │                                          /complete           │  required)
     └────────┘                                                ▼             │
                                                    ┌────────────────┐       │
                                                    │ Pending Review │ ──────┘
                                                    └────────────────┘
                                                             │ /accept (Manager only)
                                                             ▼
                                                       ┌───────────┐
                                                       │ Processed │ ── terminal
                                                       └───────────┘

  /abort — from any non-terminal state ──▶ ┌─────────┐
                                           │ Aborted │ ── terminal
                                           └─────────┘
```

Facility status rolls up alongside: `In Progress` while the owner works it → `Pending Review` on
`/complete` → `Active` on `/accept`, or `Needs Review` on `/reject`. `/abort` returns the facility to
`Active` when no other `Review`/`Processing` submission remains.

`wizardStep` is 1-indexed. Steps 1–5 mirror the UI's `WIZARD_STEPS`, which is **config-driven** —
`GET /api/config/wizard` (`config` table, key `wizard_config`), not a compile-time constant:

```ts
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
// 1 Select Facility            2 Upload Document
// 3 Review Extraction          4 Review Matches
// 5 LP Category & Rate Assignment
// 6 submitted for independent review — a lifecycle state past the last UI step, not a wizard screen
```

- [x] `Processing → Review` on successful pipeline; `Processing → Error` on failure.
- [x] List endpoint hides `Processing`; detail endpoint is the poll target.
- [x] `reject` returns the submission to step 5 so the analyst can revise and re-submit; the
      `reviewNote` (with the submission back at step 5) is the "Changes Requested" signal.

---

## 6. Async design notes

- [x] `@EnableAsync` + `extractionExecutor` (`AsyncConfig`); pipeline dispatched via `AsyncTaskRunner` (separate bean so the `@Async` proxy applies).
- [x] File is persisted to disk before dispatch; the background task reads from the path (multipart is gone post-response).
- [x] Failure in the background task sets `status = Error` (no silent loss).
- [x] `AsyncConfig` installs an MDC `TaskDecorator` so the caller's logging context follows the task
  onto the `extraction-*` thread (see `LOGGING_DESIGN.md`).
- [x] Pool sizing is externalised to `ExtractionExecutorProperties` (`app.extraction-executor.*` in
  `application.yml`, each with an `APP_EXTRACTION_EXECUTOR_*` env override):
  `core-pool-size: 2`, `max-pool-size: 4`, `queue-capacity: 50`, `await-termination-seconds: 60`.
  Each in-flight task holds a fully parsed POI workbook, so these track the container's heap and the
  file sizes an environment actually receives — raise them together, never in isolation.
- [x] The `SecurityContext` does **not** propagate: actor uuName, display name and client IP are
  resolved on the request thread and passed into the pipeline explicitly.
- [ ] *Optional next:* `GET /api/submissions/{id}/events` (SSE) to push `Processing→Review` instead of polling.
- [ ] *Optional next:* idempotency key on upload to dedupe retries.

---

## 7. Recognition signal hierarchy (in `pe-sub-api`)

Signals are **additive**: a candidate template accumulates points across every signal it hits, and
the highest total wins. An operator `forceTemplate` (matched on template name *or* slug) wins
outright; if the forced name is not in the registry, auto-detection proceeds.

| # | Signal | Weight | Property |
|---|---|---|---|
| 1 | filename ⊃ `detect_keys` **or** filename ⊃ `template_slug` (`kkr-ascendant` ⊂ `Agent-BB-KKR-Ascendant-Fund`) | 100 | `score-filename` |
| 2 | `title_text` found in sheet body | 50 | `score-title` |
| 3 | `detect_keys` found in any cell | 20 | `score-detect-key` |
| 4 | exact named `LP_GRID` tab present | 15 | `score-named-tab` |
| 5 | `agent_bank` match (weak fallback) | 10 | `score-agent-bank` |

- Weights and the **`min-score: 30`** floor are configuration, not code —
  `app.template-recognition.*` in `application.yml`, each with an `APP_TEMPLATE_RECOGNITION_*`
  env override.
- Below `min-score` nothing is recognised: `ResolvedTemplate.unknown()` is returned and the engine
  falls back to auto-detecting sheet and header row. An empty registry short-circuits to the same.
- Note the floor's effect: a lone agent-bank hit (10) or a lone named tab (15) cannot recognise a
  template on its own — filename or title, or a combination, is required.
- Profiling limits are likewise externalised under `app.template-profiler.*`
  (`min-header-matches: 3`, `header-scan-rows: 15`, `max-groups: 12`).

---

## 8. Status checklist

**Done**
- [x] Engine = stateless parser; `/api/inspect` + deterministic `/api/extract`.
- [x] Recognition centralised in `pe-sub-api` (`TemplateRecognitionService`), registry-driven, with
  configurable weights + `min-score` (`app.template-recognition.*`).
- [x] Async upload handoff (202 + bounded executor + polling).
- [x] Import-driven registry (BB template workbook, 6 sheets) + Template ID auto-versioning;
  `mode=upsert` for re-import.
- [x] No hardcoded agent/fund names in code (engine/api/ui purged); Flyway template seeds removed.
- [x] Post-extraction derivation (`DerivedFieldCalculator`): row-local only — fills Called Capital
  and marks it `Derived: `. Total-dependent percentage fields are left to the analyst.
- [x] Self-adoption profiler (`POST /api/bb-templates/profile`, `TemplateProfiler`) — deterministic,
  no AI, proposes a template for operator confirmation without persisting.
- [x] Maker-checker review lifecycle (`complete` → `accept`/`reject`), ownership + `take-over`,
  `abort`, and optimistic concurrency (`?expectedVersion=` → `409 ProblemDetail`).
- [x] `extractionExecutor` sizing externalised to `app.extraction-executor.*` (was hardcoded in
  `AsyncConfig`).
- [x] Legacy `ExtractionClientService.extract` overloads removed — only `inspect` (×2) and
  `extractResolved` remain.
- [x] Recognition/auto-learning integration tests exist: `TemplateRecognitionServiceIntegrationTest`,
  `SubmissionTemplateAutoLearningIntegrationTest`, `DocRecognitionFormatTest`.

