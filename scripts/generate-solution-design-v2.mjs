// Generates ../PE-Sub-Platform-Solution-Design-v2.docx (in this pe-sub-docs project)
// Run from the pe-sub-docs root: npm run build:docx:v2
// (or directly: node scripts/generate-solution-design-v2.mjs)
//
// v2 is the consolidated as-built document (July 2026). It supersedes the v1 docx
// (June 2026 target-architecture draft) and reconciles: SOLUTION_DESIGN.md (which now
// incorporates the former PE_SUB_SOLUTION.md business context), GAP_ANALYSIS.md
// (as-built section), EXTRACTION_CONTRACT.md, MASTER_DB_MAPPING.md, and
// OPEN_QUESTIONS.md against the deployed services.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '../PE-Sub-Platform-Solution-Design-v2.docx')

// ── Colour palette ────────────────────────────────────────────────────────────
const NAVY   = '1C2D5A'
const BLUE   = '2E75B6'
const GREY   = 'F2F4F8'
const WHITE  = 'FFFFFF'

// ── Helpers ───────────────────────────────────────────────────────────────────

const h1 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 120 },
})

const h2 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 80 },
})

const h3 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 60 },
})

const p = (text, opts = {}) => new Paragraph({
  spacing: { after: 100 },
  children: [new TextRun({ text, size: 22, ...opts })],
})

const bullet = (text, level = 0) => new Paragraph({
  bullet: { level },
  spacing: { after: 60 },
  children: [new TextRun({ text, size: 22 })],
})

const bold = (text) => new TextRun({ text, bold: true, size: 22 })
const run  = (text) => new TextRun({ text, size: 22 })

const pageBreak = () => new Paragraph({ children: [new TextRun({ break: 1 })] })

const note = (text) => new Paragraph({
  spacing: { after: 100, before: 60 },
  shading: { type: ShadingType.CLEAR, fill: GREY },
  border: { left: { style: BorderStyle.THICK, size: 12, color: BLUE } },
  children: [new TextRun({ text: `📌  ${text}`, size: 20, italics: true, color: '444444' })],
})

// ── Table helpers ─────────────────────────────────────────────────────────────

function headerCell(text, width) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.CLEAR, fill: NAVY },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, color: WHITE, size: 20 })],
    })],
  })
}

function cell(text, shade = false) {
  return new TableCell({
    shading: shade ? { type: ShadingType.CLEAR, fill: GREY } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text: text ?? '', size: 20 })],
    })],
  })
}

function boldCell(text, shade = false) {
  return new TableCell({
    shading: shade ? { type: ShadingType.CLEAR, fill: GREY } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20 })],
    })],
  })
}

function tbl(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => headerCell(h, widths?.[i])),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell_, ci) =>
          ci === 0
            ? boldCell(cell_, ri % 2 === 0)
            : cell(cell_, ri % 2 === 0)
        ),
      })),
    ],
  })
}

// ── Document sections ─────────────────────────────────────────────────────────

const coverPage = [
  new Paragraph({ spacing: { before: 2000, after: 200 }, children: [
    new TextRun({ text: 'PE Sub Platform', bold: true, size: 56, color: NAVY }),
  ]}),
  new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: 'Solution Design Document', size: 36, color: BLUE }),
  ]}),
  new Paragraph({ spacing: { after: 400 }, children: [
    new TextRun({ text: 'Version 2.0  ·  July 2026  ·  CONFIDENTIAL', size: 22, color: '666666' }),
  ]}),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Prepared by:'), run('  UBS Credit Technology — PE Sub Finance Team')] }),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Status:'), run('  Final — As-Built Consolidation')] }),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Audience:'), run('  UBS Technology Leadership, Credit Risk, Compliance, PE Sub Management Team')] }),
  new Paragraph({ spacing: { after: 60, before: 300 }, children: [bold('Supersedes:'), run('  Solution Design v1.0 (June 2026). v1 described the proposed target architecture; v2 documents the system as built and deployed, plus the remaining roadmap.')] }),
  pageBreak(),
]

const docControl = [
  h1('Document Control'),
  tbl(
    ['Version', 'Date', 'Change'],
    [
      ['1.0', 'June 2026', 'Initial formal solution design — proposed target architecture (Azure AKS, Redux, Redis, JWT gateway), phased delivery plan'],
      ['2.0', 'July 2026', 'As-built consolidation. Reflects the deployed four-service architecture, actual data model (Flyway V1_1–V1_4), implemented header/gateway security, precise numeric money columns, import-driven template registry, async ingestion pipeline, and the reconciled gap/roadmap list'],
    ],
    [1200, 1600]
  ),
  p(''),
  note('Where v1 and the running system disagree, this document is authoritative. The canonical living reference remains SOLUTION_DESIGN.md in pe-sub-docs; this Word deliverable is its formal point-in-time consolidation.'),
  pageBreak(),
]

const execSummary = [
  h1('1. Executive Summary'),
  p('The PE Sub Platform automates UBS\'s monthly monitoring of private equity subscription credit facilities: ingesting agent bank Borrowing Base certificates, matching Limited Partner names against the UBS LP Master, and independently computing a Shadow Borrowing Base under UBS\'s own advance rates, eligibility rules and concentration limits.'),
  p('As of July 2026 the platform is no longer a prototype. It runs as four deployed services — a React/TypeScript frontend, a Spring Boot REST API with PostgreSQL persistence, a stateless document-extraction service, and a background-jobs service — with real file ingestion, a registry-driven template recognition pipeline, persisted Shadow BB snapshots, role-based security, and a full audit trail attributed to the authenticated user.'),
  h2('1.1 Delivered (as-built)'),
  bullet('End-to-end ingestion: multipart upload → async extraction (Apache POI) → template recognition → field mapping via the live Field Mapping Dictionary → LP name matching → credit-officer review wizard'),
  bullet('Shadow BB calculation engine (Java, authoritative; TypeScript twin for live preview) with five-tier BUSA advance rates, per-LP concentration caps, breach detection, and append-only JSONB snapshots'),
  bullet('Precise money handling: exact-dollar NUMERIC columns dual-written with display strings; the engine computes from exact values, not re-parsed labels'),
  bullet('Header/gateway security: dev and gateway modes, ANALYST / ATM / SERVICE roles, service-only ingest, analyst-only configuration surfaces; audit trail records the authenticated principal'),
  bullet('Import-driven BB template registry (three template classes; no hardcoded agent names anywhere in code), multi-tab and feeder-sleeve support'),
  bullet('Self-service configuration: advance rates, eligibility rules, concentration limits, matching thresholds and field-mapping aliases are all DB-backed and editable at runtime with audit logging'),
  bullet('OpenAPI 3.0 specification v0.8.0 (with security schemes) and a maintained Postman/Talend collection'),
  h2('1.2 Remaining scope (roadmap)'),
  bullet('Entra ID (Azure AD) SSO wiring at the reverse proxy — the platform consumes gateway identity headers today; the IdP decision is infrastructure-only'),
  bullet('4-eye approval workflow on submission completion (Phase 2); per-submission ownership enforcement'),
  bullet('Immutable/tamper-evident audit store with 7-year retention; pagination on large collection reads; horizontally scalable SSE'),
  bullet('AUM text-range normalization queue; data-migration ETL for the remaining facility back-book; scheduled jobs (monthly cycle reset, staleness checks)'),
  bullet('Azure hosting decision (Container Apps vs App Service) and Terraform scaffolding'),
  pageBreak(),
]

const context = [
  h1('2. Business Context'),
  p('A subscription credit facility ("sub line") is a revolving credit line to a private equity fund, secured not by portfolio assets but by the unfunded capital commitments of the fund\'s Limited Partners. If the fund defaults, the lender can call capital directly from the LPs — so the credit quality of the borrowing base depends on who those LPs are, how much of their commitment is uncalled, and how certain they are to fund a call.'),
  p('UBS participates as a lender across roughly 71 facility positions administered by 17 agent banks, representing about USD 10.6 billion of committed loan volume. Each cycle, the agent posts a Borrowing Base Certificate listing every LP with its commitment, uncalled capital, classification, advance rate and BB contribution. UBS does not simply accept the agent\'s numbers: analysts rebuild the calculation under UBS\'s own rules — the Shadow Borrowing Base — and monitor the delta against the agent\'s certificate.'),
  h2('2.1 The three friction points the platform removes'),
  tbl(
    ['Friction', 'Manual reality', 'Platform answer'],
    [
      ['Extraction', 'Every agent bank formats its Excel differently: different column names, group-header rows, summary rows, multi-tab workbooks', 'Registry-driven template recognition + Field Mapping Dictionary; deterministic extraction engine parses any registered variant; unrecognised columns are remappable in-flight'],
      ['LP name matching', 'The agent writes "CalPERS"; the LP Master holds "California Public Employees Retirement System". At 900 LPs per facility, manual VLOOKUP matching takes days', 'Jaro-Winkler + Levenshtein scoring with a normalization pipeline; high-confidence matches auto-accepted; the rest resolved one-click in a review queue'],
      ['Shadow BB', 'Excel models rebuilt per facility per cycle; no audit trail of decisions', 'Server-side calculation engine; append-only snapshots; every override and decision audit-logged'],
    ]
  ),
  h2('2.2 Key business rules'),
  bullet('Shadow BB is prepared only when a credit decision is required (renewal, amendment, new origination) — not for every monthly agent BB receipt'),
  bullet('Advance rates are five-tier by UBS LP Classification: Rated 90% · Unrated AUM >$2bn 75% · Unrated $1–2bn 65% · Eligible <$1bn 50% · Excluded 0% (BUSA schedule; the agent applies its own schedule, so LP-level rate variance drives the BB delta)'),
  bullet('Concentration limits apply at the individual-LP level, always against total uncalled capital (not facility size); some facilities add a class-level cap on top'),
  bullet('Agent LP Classification (the agent\'s own label, extracted verbatim), UBS LP Classification (the computed rate tier), and Investor Type (industry profile) are three distinct concepts and are never conflated'),
  bullet('The agent BB file\'s own row order is the single ordering key through the wizard and Shadow BB screens'),
  pageBreak(),
]

const architecture = [
  h1('3. System Architecture (As-Built)'),
  h2('3.1 Services'),
  tbl(
    ['Service', 'Stack', 'Port', 'Role'],
    [
      ['pe-sub-ui', 'React 18 · TypeScript 5 · Vite (Context API — no Redux)', '3000', 'Analyst workspace; 13 screens; calls pe-sub-api exclusively via the dev proxy'],
      ['pe-sub-api', 'Spring Boot 4.1 · Java 25 · PostgreSQL 16 · Flyway', '3001', 'All business logic: LP Master, BB engine, submissions, matching, configuration, audit, security'],
      ['pe-sub-extraction', 'Spring Boot 4.1 · Java 25 · Apache POI / Commons CSV', '3002', 'Stateless, deterministic document parser: /api/inspect (raw signals) and /api/extract (structured records). No recognition logic and no persistence'],
      ['pe-sub-jobs', 'Spring Boot 4.1 · Java 25 · Spring Batch 6', '3003', 'CSV ingestion jobs (facility-ingest, lp-master-ingest) upserting into the shared PostgreSQL; scheduled recalculation planned'],
      ['PostgreSQL 16', 'Azure Database for PostgreSQL Flexible Server (target); Docker locally', '5432', 'Single persistent store; schema owned by Flyway migrations in pe-sub-api'],
    ]
  ),
  p('Virtual threads are enabled on all backend services; code is imperative and blocking by design (no WebFlux). Both directions of inter-service HTTP carry connect/read timeouts, uploads are capped at 50 MB, and upload filenames are sanitised.'),
  h2('3.2 Ingestion pipeline (async handoff)'),
  p('Upload never blocks the UI. POST /api/submissions persists the submission with status Processing, saves the file to disk, and returns 202 Accepted immediately. A bounded executor then runs the pipeline in the background: inspect → recognise template → extract → ingest, finishing at status Review (or Error). The UI polls the submission until the status changes; Server-Sent Events push status updates as they happen.'),
  tbl(
    ['Step', 'Component', 'What happens'],
    [
      ['1. Inspect', 'pe-sub-extraction POST /api/inspect', 'Pure parse: sheet names + first rows returned as WorkbookSignals. No recognition'],
      ['2. Recognise', 'pe-sub-api TemplateRecognitionService', 'Signals scored against every registry template (filename/slug → title text → detect keys → named tab → agent bank); operator forceTemplate overrides'],
      ['3. Extract', 'pe-sub-extraction POST /api/extract?forward=false', 'Deterministic parse driven entirely by the resolved template: sheet(s), header row/span, group map, skip keywords, alias config from the live FM Dictionary'],
      ['4. Ingest', 'pe-sub-api LpIngestService', 'Fuzzy match against the facility\'s LPs; high-confidence rows update LP Master (exact numeric + display string); medium rows queue for review; submission → Review'],
    ]
  ),
  h2('3.3 Deployment'),
  bullet('pe-sub-infra holds Kubernetes manifests for a local cluster (Docker Desktop / Rancher Desktop); pe-sub-extraction and pe-sub-jobs are ClusterIP-internal, only pe-sub-api is exposed'),
  bullet('Azure is the confirmed cloud target; Container Apps vs App Service, networking, and Key Vault integration are the open infrastructure decisions (Terraform deferred until confirmed)'),
  bullet('In production the UI is fronted by an SSO reverse proxy which injects the identity headers consumed in gateway security mode (see §5.2)'),
  pageBreak(),
]

const dataModel = [
  h1('4. Data Model'),
  p('The schema is owned by four Flyway migrations in pe-sub-api (V1_1 schema, V1_2 seed, V1_3 database-owned UI/domain configuration, V1_4 report history). Once applied to a production database, base files are never modified — subsequent changes are new numbered migrations.'),
  h2('4.1 Core tables'),
  tbl(
    ['Table', 'Purpose'],
    [
      ['facilities', 'Facility registry incl. UBS operational metadata: account_number (5Vxxxxx loan ref), loan_amount, maturity_date, collateral_date, bank_status — distinct from the workflow status (Not Started / In Progress / Needs Review / Active / Pending)'],
      ['lp_records', 'LP Master — one row per LP per facility; ~40 columns across Identity, Classification, Ratings, Financial Scale, Commitment, Uncalled, Concentration/BB, and Status groups (see MASTER_DB_MAPPING.md)'],
      ['lp_rates', 'Rates feed — one row per LP per effective period; the Shadow BB uses the latest row on or before the submission date'],
      ['bb_snapshots', 'Append-only Shadow BB results; full BBResult (lps, summary, breaches) as JSONB; latest snapshot = current Shadow BB'],
      ['submissions / submission_extractions', 'Upload lifecycle (Processing → Review → … / Error), wizard step, shadow-BB overrides; extraction payload, field mappings and unrecognised columns as JSONB'],
      ['match_queue_entries', 'Per-row match decisions: extracted name, best candidate, score, accept/reject/manual, new-LP flag, reasons'],
      ['bb_templates / bb_template_tabs / bb_template_groups', 'Import-driven template registry: structure (sheets, header rows, tranches, tab roles, sleeves), skip keywords, and group-header → classification maps. Templates enter via POST /api/bb-templates/import; duplicates auto-version by slug'],
      ['fm_* (Field Mapping Dictionary)', 'Canonical fields, bank-scoped aliases, blocklist and pending suggestions; drives column recognition at parse time and is editable live in the Field Mapping screen'],
      ['config', 'Key/value JSONB configuration: busa_tiers, agent_tiers, agent_rate_params, elig_rules, conc_limits, global_settings, matching_config, classification_config; cached in-memory, upserted via PUT /api/config/*'],
      ['audit_log', 'Every material event (uploads, BB runs, reclassifications, config and mapping changes, logins) with actor, IP, facility and detail'],
      ['report_history', 'One row per generated report from the Reports screen; facility name denormalised so history survives facility deletion'],
      ['users', 'Operator registry (Analyst | Account/Transaction Manager)'],
    ]
  ),
  h2('4.2 Precise money storage (dual-write)'),
  p('LP money fields are dual-stored. The formatted display string (e.g. "$12.3M") remains the API and UI contract; four NUMERIC(20,2) companion columns — uncalled_capital_num, cap_commit_num, aum_num, agent_bb_num — hold exact absolute dollars for calculation.'),
  bullet('Extraction ingest writes the exact extracted decimal and the rounded display string together'),
  bullet('A Shadow BB commit re-derives the numerics from the committed strings and clears stale values, so a fresh string always wins over an old numeric'),
  bullet('The BB engine computes from the numeric column when present and falls back to parsing the display string otherwise'),
  bullet('The *_num columns are internal — never exposed on a DTO — so no API consumer changed'),
  h2('4.3 Derived fields are never stored'),
  p('The BUSA advance rate and computed BB fields (UBS BB, delta, eligible uncalled) are derived at runtime from classification and uncalled capital. Storing them would create drift risk; only the agent\'s own submitted values are persisted as source data. Snapshots capture the computed result as an immutable JSONB document instead.'),
  pageBreak(),
]

const apiSecurity = [
  h1('5. API Surface and Security'),
  h2('5.1 API'),
  p('All endpoints are RESTful JSON under /api on pe-sub-api (port 3001). The full contract is OpenAPI 3.0 (openapi.yaml v0.8.0, including security schemes); the Postman/Talend collection mirrors it with auth headers pre-configured. Route families:'),
  tbl(
    ['Family', 'Highlights'],
    [
      ['Facilities', 'CRUD + workflow status transitions'],
      ['LPs', 'List/search/patch LP Master; POST /api/lps/ingest is the service-to-service extraction sink (SERVICE role only)'],
      ['Borrowing Base', 'POST /api/bb/run/{facilityId} (atomic run + snapshot), snapshot history, extended portfolio summary'],
      ['Submissions', 'Multipart upload (202 + polling), abort/confirm/re-extract/remap, extracted LPs, field map, doc recognition, unrecognised columns'],
      ['Matching', 'Match queue list + decisions, ad-hoc name test endpoint'],
      ['Configuration', 'GET/PUT eligibility (six sections), matching config, wizard/audit/report config'],
      ['Field Mapping', 'Alias groups, canonical fields, blocklist, suggestions, alias CRUD'],
      ['BB Templates', 'Registry CRUD + XLSX import with slug auto-versioning'],
      ['Reports & Audit', 'Collateral and concentration reports, report history, audit trail, login event'],
      ['Notifications', 'Server-Sent Events stream for facility/BB/upload events'],
    ]
  ),
  p('Errors follow Spring ProblemDetail via a global RestControllerAdvice; database integrity violations are sanitised before leaving the API. DTOs are Java records; JPA entities never cross the API boundary.'),
  h2('5.2 Security model'),
  p('Security is stateless and header/token based — no sessions, no CSRF cookies. Identity is established by a servlet filter ahead of the authorization chain, in one of two modes controlled by APP_SECURITY_MODE:'),
  tbl(
    ['Mode', 'Identity source', 'Use'],
    [
      ['dev (default)', 'Fixed identity local.analyst@ubs.dev, role ANALYST (overridable via APP_SECURITY_DEV_USER)', 'Local development — the header-less UI works unchanged'],
      ['gateway', 'X-Auth-User / X-Auth-Roles headers injected by the SSO reverse proxy', 'Deployed environments — turning on enforcement is one config flag; no code change'],
    ]
  ),
  h3('Roles and authorization'),
  tbl(
    ['Surface', 'Rule'],
    [
      ['OPTIONS, /api/ping, /health, actuator health, /api/notifications/** (SSE)', 'Public — preflight carries no identity; EventSource cannot send headers'],
      ['POST /api/lps/ingest', 'SERVICE only — service-to-service, never user-facing'],
      ['PUT /api/config/**, field-mapping mutations, /api/bb-templates/**', 'ANALYST only — per the RBAC matrix, the Account/Transaction Manager does not configure'],
      ['All other /api/**', 'Any authenticated operator (ANALYST or ATM)'],
    ]
  ),
  bullet('Unauthenticated requests receive 401; authenticated-but-unauthorised receive 403'),
  bullet('The audit trail records the authenticated principal on every event; X-Forwarded-For is only trusted when set by the gateway, so client IPs cannot be spoofed'),
  bullet('The 4-eye separation on submission completion is a Phase-2 workflow control and is intentionally not enforced in the security chain yet'),
  h2('5.3 RBAC summary'),
  p('Two operating roles, consolidated from three legacy roles. The Analyst is the day-to-day operator and configurator; the Account/Transaction Manager holds review authority and cross-facility visibility but does not configure. (The business calls its own team members "Administrators" — in platform terms these are Credit Administrators, distinct from any system-administration role.)'),
  tbl(
    ['Capability', 'Analyst', 'Account/Transaction Manager'],
    [
      ['Upload Agent BB, resolve match queue, run Shadow BB', '✓ (own submissions; view others)', '✓ (any submission)'],
      ['Edit LP Master classification', '✓', '✓'],
      ['Configuration, Field Mapping, Match Thresholds, BB Templates', '✓', 'view only'],
      ['Reassign ownership / act on any submission', '—', '✓'],
      ['Audit trail', 'own facilities', 'all facilities'],
    ]
  ),
  pageBreak(),
]

const extraction = [
  h1('6. Ingestion and Template Recognition'),
  h2('6.1 Principles'),
  bullet('Recognition and orchestration live in pe-sub-api; pe-sub-extraction is a stateless, deterministic parser'),
  bullet('No agent-bank or fund names are hardcoded in any service — they come only from imported template registry contents or user entry'),
  bullet('Onboarding a new agent template variant is configuration (sheet, header row, skip keywords, aliases, classification sections), not code'),
  h2('6.2 Template classes'),
  tbl(
    ['Class', 'Classification source', 'Structure', 'Example'],
    [
      ['A — Full BB schedule, group headers', 'Section rows between LP rows ("Rated Investors", "Designated PWM", …) filled down onto LPs beneath', 'Tranche A/B summary sub-tables; colour-coded rows (pink = reclassified, blue = transferee)', 'Blue Owl GP Stakes V'],
      ['B — Full BB schedule, column-based', 'Per-row "Investor Category" column', 'Single summary table; explicit Eligibility column', 'Petershill IV'],
      ['C — Simplified callable capital', 'None in the file — credit officer assigns at wizard step 5', 'Header block + flat LP table; no ratings, advance rate or BB columns', 'Arctos American Football Fund'],
    ]
  ),
  p('A single agent bank can use more than one class across facilities, so class is a property of the template, never inferred from the bank. Multi-tab workbooks (Master Certificate / LP Grid / Concentration / Capital Call) and multi-fund sleeves (feeder tabs, auto-discovered tabs) are modelled as registry data; each LP row carries its source-sleeve provenance.'),
  h2('6.3 Field Mapping Dictionary'),
  p('Column headers map to canonical fields through the live, bank-scopable alias dictionary (e.g. "Remaining Callable Capital" → Uncalled). Unrecognised columns surface in the wizard, where the analyst can map them on the spot — the new alias is written back to the dictionary and the file re-extracts immediately. Derived columns present in agent files (BB contribution percentages, eligible-commitment computations, aggregates) are extracted for cross-check display but never persisted.'),
  h2('6.4 Wizard'),
  p('The credit-officer flow is a five-step wizard: Select Facility → Upload Document → Review Extraction → Review Matches → LP Classification & Rate Assignment. Committing decisions at step 5 persists LP records (deduplicated on facility + investor); the Shadow BB snapshot itself is only created when the officer runs the Shadow BB. Aborting a submission cleans up its file, extraction rows and queue entries.'),
  pageBreak(),
]

const matching = [
  h1('7. LP Name Matching'),
  p('Matching scores each extracted investor name against LP Master names using Jaro-Winkler and Levenshtein similarity, combined by configurable weights. Both sides pass through a normalization pipeline first: abbreviation expansion → case folding → legal-suffix stripping → punctuation removal. Thresholds (auto-accept, review band, reject) live in matching_config and are editable in the Match Thresholds screen.'),
  h2('7.1 Decisions'),
  tbl(
    ['Outcome', 'Condition', 'Effect'],
    [
      ['Auto-accepted', 'Score at or above the auto-accept threshold with confident field extraction', 'LP Master financial fields updated directly (exact numeric + display string)'],
      ['Queued', 'Medium-confidence match or low-confidence fields', 'Row parked in the match queue for one-click accept / reject / manual naming'],
      ['New LP', 'No candidate reaches the review threshold', 'Flagged as new; enters LP Master through the wizard commit'],
    ]
  ),
  h2('7.2 Performance'),
  p('Matching an upload against the bank-wide LP Master is optimised by an immutable prepared index built once per upload: pre-compiled normalization regexes, an exact-match fast path (a re-uploaded identical certificate resolves in O(1) per row), a decision-safe length-band prefilter that skips candidates which provably cannot reach the review threshold, and parallel scoring of independent rows. Every existing LP remains a candidate — only provably useless comparisons are skipped, so accept/queue/reject decisions are identical to an exhaustive scan.'),
  pageBreak(),
]

const bbEngine = [
  h1('8. Shadow BB Calculation Engine'),
  h2('8.1 Formula'),
  p('For each included LP: Eligible Uncalled Capital = MIN(uncalled capital, per-LP concentration limit); UBS BB contribution = Eligible Uncalled × BUSA advance rate for the LP\'s classification tier. Portfolio totals, effective advance rate, agent-vs-UBS delta and breach checks are computed across the included set.'),
  tbl(
    ['UBS LP Classification', 'BUSA rate', 'Agent rate (typical)'],
    [
      ['Rated (investment grade)', '90%', '95%'],
      ['Unrated, AUM > $2bn', '75%', '75%'],
      ['Unrated, AUM $1–2bn', '65%', '75%'],
      ['Eligible, AUM < $1bn', '50%', 'n/a'],
      ['Excluded', '0%', '0%'],
    ]
  ),
  p('Rate schedules are DB-backed configuration, editable in the Configuration screen. Concentration breach rules (single-LP share, top-10 share, unrated aggregate, non-US aggregate) run on every calculation.'),
  h2('8.2 Engine properties'),
  bullet('Authoritative engine is Java (pe-sub-api); a TypeScript twin powers the client-side live preview — both must produce identical numbers'),
  bullet('Money is computed from exact dollars: the engine reads the NUMERIC companion columns first and falls back to parsing display strings only when no numeric exists'),
  bullet('A run is one atomic transaction: LP upserts, the snapshot insert, the facility timestamp/status update and the audit entry commit or roll back together'),
  bullet('Snapshots are append-only JSONB and leave the service as DTOs; historical snapshots feed Reports, not the Shadow BB screen (which is latest-only)'),
  bullet('Committed decisions and BB runs are separate acts: committing the wizard persists LP records; only Run Shadow BB creates a snapshot and moves the facility to Active'),
  pageBreak(),
]

const reportingAudit = [
  h1('9. Reporting and Audit'),
  h2('9.1 Reports'),
  p('The Reports screen generates collateral/coverage (BB certificate payload, targetable at any historical snapshot), concentration-exposure, Effective-Advance-Rate history, and agent-bank exposure outputs, plus the 35-field LP Master CSV export. Every generated report is recorded in report_history (report type, facility, snapshot label, format, user, timestamp). Ad-hoc reporting remains on the roadmap.'),
  h2('9.2 Audit trail'),
  p('Every material event writes an audit row: uploads, aborts, re-extractions, extraction confirmations, BB runs, LP reclassifications and data updates, configuration and matching-config changes, field-mapping alias changes, logins and exports. Each entry carries the authenticated principal, resolved client IP, facility linkage and a typed human-readable detail line. The Audit Trail screen provides filtering, search and pagination.'),
  note('Roadmap: immutable/tamper-evident storage with 7-year retention is a compliance requirement tracked for a later phase; the current store is a standard append-pattern PostgreSQL table.'),
  pageBreak(),
]

const gapsRoadmap = [
  h1('10. Gaps and Roadmap'),
  h2('10.1 Genuine open gaps (as of July 2026)'),
  tbl(
    ['Gap', 'Notes'],
    [
      ['4-eye approval workflow', 'Submission completion currently has no enforced Account/Transaction Manager sign-off; Phase 2 workflow control'],
      ['Immutable audit store, 7-year retention', 'Regulatory requirement; current audit_log is standard PostgreSQL'],
      ['AUM text-range normalization queue', 'Agent-supplied ranges ("1bn–5bn") are stored as labels; numeric normalization + review queue planned'],
      ['Pagination on large collection reads', 'LP and audit lists are currently unpaginated server-side'],
      ['Horizontal-scale SSE', 'Event stream is in-process; needs a shared broker before multi-replica deployment'],
      ['Scheduled jobs', 'Monthly cycle reset and staleness notifications designed but not implemented in pe-sub-jobs'],
      ['Template coverage', 'Templates registered for a subset of the 17 portfolio agents; remaining templates to be solicited (priority by committed volume)'],
      ['Ad-hoc reporting', 'The last unimplemented Step 6 report type (collateral, concentration, EAR history and agent-bank exposure are built)'],
    ]
  ),
  h2('10.2 Key open decisions'),
  tbl(
    ['Decision', 'Status'],
    [
      ['Identity provider (Entra ID SSO vs internal) fronting the gateway', 'Infrastructure-only decision; platform consumes gateway headers either way'],
      ['Azure hosting model (Container Apps vs App Service), networking, Key Vault', 'Blocks Terraform scaffolding'],
      ['LP identifier: LEI vs internal UBS counterparty ID', 'Affects cross-facility dedup and future rating feeds'],
      ['Advance-rate schedule tier values and per-tier concentration limits', 'Awaiting PE Sub Management confirmation before correcting seed data'],
      ['Class-level concentration limit configuration (per facility vs global)', 'Affects config schema and breach logic'],
      ['Feeder-tab investor-type mapping (manual vs suggested vs excluded)', 'Raised from CCP-VII; fundSleeve provenance already captured'],
    ]
  ),
  p('The complete tracked list, with impact analysis and resolution history, lives in OPEN_QUESTIONS.md and the gap analysis in GAP_ANALYSIS.md.'),
  pageBreak(),
]

const appendix = [
  h1('11. Appendix — Key Terms'),
  tbl(
    ['Term', 'Definition'],
    [
      ['Subscription facility / sub line', 'Revolving credit line to a PE fund secured by LPs\' unfunded capital commitments'],
      ['Agent bank', 'Lead lender that administers the facility and issues the monthly Borrowing Base Certificate'],
      ['Borrowing Base (BB)', 'Risk-adjusted, eligibility-filtered sum of LP uncalled commitments × advance rates that caps fund drawings'],
      ['Shadow BB', 'UBS\'s independent recalculation of the BB under its own rates, limits and eligibility rules'],
      ['Delta', 'Agent BB minus Shadow BB; persistent positive delta is a credit concern'],
      ['LP Master', 'UBS\'s authoritative record of LP identity, classification and credit quality, maintained bank-wide'],
      ['Agent LP Classification', 'The agent\'s own category label, extracted verbatim from the certificate (column or group-header rows)'],
      ['UBS LP Classification', 'The platform-computed advance-rate tier (Rated / Unrated >2bn / Unrated 1–2bn / Eligible / Excluded)'],
      ['Advance rate', 'Percentage of eligible uncalled capital an LP contributes to the BB, by classification tier'],
      ['Concentration limit', 'Cap on a single LP\'s (or class\'s) BB contribution, measured against total uncalled capital'],
      ['UBS Included (inc)', 'Per-LP flag counting the LP in UBS BB aggregates; soft-exclude preserves the audit trail'],
      ['Transferee', 'LP whose position was acquired by transfer rather than original subscription; affects eligibility'],
      ['Fund sleeve', 'Source-tab provenance for LPs extracted from multi-tab / feeder workbooks'],
      ['Snapshot', 'Immutable JSONB record of one Shadow BB run (LPs, summary, breaches)'],
      ['FM Dictionary', 'Field Mapping Dictionary — canonical fields plus bank-scoped column-header aliases driving extraction'],
      ['ATM', 'Account/Transaction Manager — the review-authority role (4-eye check)'],
    ]
  ),
]

// ── Assemble document ─────────────────────────────────────────────────────────

const doc = new Document({
  numbering: { config: [] },
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: '222222' },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: 32, color: NAVY, font: 'Calibri' },
        paragraph: {
          spacing: { before: 400, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE } },
        },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: 26, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 280, after: 80 } },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: 22, color: '444444', font: 'Calibri' },
        paragraph: { spacing: { before: 200, after: 60 } },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
      },
    },
    children: [
      ...coverPage,
      ...docControl,
      ...execSummary,
      ...context,
      ...architecture,
      ...dataModel,
      ...apiSecurity,
      ...extraction,
      ...matching,
      ...bbEngine,
      ...reportingAudit,
      ...gapsRoadmap,
      ...appendix,
    ],
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync(OUT, buffer)
console.log(`Written: ${OUT}`)
console.log('  Sections: Cover, Document Control, Exec Summary, Business Context, Architecture, Data Model, API & Security, Ingestion & Templates, Matching, BB Engine, Reporting & Audit, Gaps & Roadmap, Appendix')
