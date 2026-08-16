# Contract: `pe-sub-api` ⇄ `pe-sub-extraction`

**Stack:** Spring Boot 4.1 / OpenJDK 25 (both services) · React + Vite + TypeScript (`pe-sub-ui`).
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
```

- [x] Upload never blocks the UI thread — heavy POI parsing runs on `extractionExecutor`.
- [x] Backpressure: bounded pool (`core 2 / max 4 / queue 50`, CallerRuns fallback) caps heap pressure.
- [x] Status is the polling contract; no websocket required (add SSE later if desired — see §6).

---

## 2. `pe-sub-extraction` API (stateless parser)

### `POST /api/inspect` — raw signals for recognition
- **Request** `multipart/form-data`: `file` (required).
- **Response** `200` `WorkbookSignals`.
- Pure parse: returns sheet names + first 15 rows/sheet. **No** recognition.

### `POST /api/extract?forward=false` — deterministic extraction
- **Request** `multipart/form-data`:
  - [x] `facilityId: string` (required), `file` (required)
  - [x] `aliasConfig?: string` (JSON: `Record<ExtractionKey, string[]>`)
  - [x] `sheetNameHint?: string`, `headerRowHint?: number` (0-based), `headerRowSpan?: number`
  - [x] `classificationConfig?: string` (JSON: `Record<GroupHeaderText, Classification>`)
  - [x] `agentBank?: string` (passthrough tag only — not used for recognition)
  - [x] `sheetNames?: string[]`, `autoDiscoverTabs?: boolean`, `skipRowKeywords?: string[]`
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
- **Agent-supplied columns are never overwritten or back-filled** — a field is derived only when no
  workbook column mapped to it.
- Derived values carry the sourceHeader prefix **`Derived: `** and a confidence equal to the minimum
  confidence of their inputs, so the Review Extraction screen can distinguish computed from
  agent-reported values. Derived cross-check inputs — **not** agent figures.
- The engine adds the corresponding `FieldMappingEntry`s for any field it derived.

---

## 3. `pe-sub-api` submission lifecycle API

- [x] `POST /api/submissions` — `multipart`: `facilityId, agentBank, periodMonth, file, notes?, forceTemplate?`
  → **`202 Accepted`** + `SubmissionDto` (`status: 'Processing'`). *Async.*
- [x] `GET /api/submissions?facilityId=` → `SubmissionDto[]` (excludes `Processing`).
- [x] `GET /api/submissions/{id}` → `SubmissionDto` *(poll target)*.
- [x] `POST /api/submissions/{id}/reextract` — body `{ templateName?: string }` → `204`.
- [x] `POST /api/submissions/{id}/remap` — body `{ extractedHeader, canonical }` → `200`.
- [x] `GET /api/submissions/{id}/unrecognized-columns` → `string[]`.

### Registry (Upload Template) — `POST /api/bb-templates/import`
- [x] `multipart`: `file` (a BB template `*.xlsx`) → `201` `BbTemplateDto`.
- [x] Template ID (`template_slug`) is the identity; duplicates auto-version (`gs-blue-owl-1`, …).
- [x] `GET/POST/PUT/DELETE /api/bb-templates` for registry CRUD.

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
export type SubmissionStatus = 'Processing' | 'Review' | 'Error';
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
  readonly shadowBbOverrides: unknown | null;
  readonly createdAt: string;                // ISO-8601
  readonly updatedAt: string;
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
```

---

## 5. Submission state machine

```
            POST /api/submissions
                    │
                    ▼
             ┌─────────────┐  inspect→recognize→extract→ingest ok   ┌──────────┐
             │ Processing  │ ─────────────────────────────────────▶ │  Review  │
             └─────────────┘                                        └──────────┘
                    │ engine unreachable / pipeline throws               │ wizardStep 3→4→5
                    ▼                                                     ▼
                ┌────────┐                                       (matches → LP category/rate)
                │ Error  │
                └────────┘
```

`wizardStep` (1-indexed, mirrors UI `WIZARD_STEPS`):

```ts
export type WizardStep = 1 | 2 | 3 | 4 | 5;
// 1 Select Facility / Upload   2 Upload Document (transient)
// 3 Review Extraction          4 Review Matches            5 LP Category & Rate Assignment
```

- [x] `Processing → Review` on successful pipeline; `Processing → Error` on failure.
- [x] List endpoint hides `Processing`; detail endpoint is the poll target.

---

## 6. Async design notes

- [x] `@EnableAsync` + `extractionExecutor` (`AsyncConfig`); pipeline dispatched via `AsyncTaskRunner` (separate bean so the `@Async` proxy applies).
- [x] File is persisted to disk before dispatch; the background task reads from the path (multipart is gone post-response).
- [x] Failure in the background task sets `status = Error` (no silent loss).
- [ ] *Optional next:* `GET /api/submissions/{id}/events` (SSE) to push `Processing→Review` instead of polling.
- [ ] *Optional next:* idempotency key on upload to dedupe retries.

---

## 7. Recognition signal hierarchy (in `pe-sub-api`)

Scored against every registry template (highest wins; operator `forceTemplate` overrides):

1. [x] filename ⊃ `detect_keys` **or** filename ⊃ `template_slug` (`kkr-ascendant` ⊂ `Agent-BB-KKR-Ascendant-Fund`)
2. [x] `title_text` found in sheet body
3. [x] `detect_keys` found in any cell
4. [x] exact named tab present
5. [x] `agent_bank` match (weak fallback)

---

## 8. Status checklist

**Done**
- [x] Engine = stateless parser; `/api/inspect` + deterministic `/api/extract`.
- [x] Recognition centralised in `pe-sub-api` (`TemplateRecognitionService`), registry-driven.
- [x] Async upload handoff (202 + bounded executor + polling).
- [x] Import-driven registry (BB template workbook, 6 sheets) + Template ID auto-versioning.
- [x] No hardcoded agent/fund names in code (engine/api/ui purged); Flyway template seeds removed.
- [x] Post-extraction derivation (`DerivedFieldCalculator`): row-local only — fills Called Capital
  and marks it `Derived: `. Total-dependent percentage fields are left to the analyst.

**Pending**
- [ ] Correct the 7 BB template `*.xlsx` cell content (data only) — e.g. `gs-blue-owl` flat list + `Investor Type`/`Fitch`; `kkr-ascendant` agent/`detect_keys`.
- [ ] Per-template `@SpringBootTest` (import → recognise sample → assert slug) in `pe-sub-api`.
- [ ] Reconcile remaining api integration tests for the async 202 + `friendlyFormat` label change.
- [ ] Optional: retire dead `ClassificationConfigBuilder` + legacy `ExtractionClientService.extract` overloads.
