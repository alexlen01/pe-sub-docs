// Generates ../PE-Sub-Platform-Solution-Design.docx (in this pe-sub-docs project)
// Run from the pe-sub-docs root: npm run build:docx
// (or directly: node scripts/generate-solution-design.mjs)

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  TableOfContents, StyleLevel, PageBreak, HorizontalPositionAlign,
  VerticalPositionAlign, PageOrientation,
} from 'docx'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '../PE-Sub-Platform-Solution-Design.docx')

// ── Colour palette ────────────────────────────────────────────────────────────
const NAVY   = '1C2D5A'
const BLUE   = '2E75B6'
const LTBLUE = 'D6E4F0'
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
const code = (text) => new TextRun({ text, font: 'Courier New', size: 20, color: '444444' })

const mixed = (...children) => new Paragraph({ spacing: { after: 100 }, children })

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
    new TextRun({ text: 'Version 1.0  ·  June 2026  ·  CONFIDENTIAL', size: 22, color: '666666' }),
  ]}),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Prepared by:'), run('  UBS Credit Technology — PE Sub Finance Team')] }),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Status:'), run('  Draft — For Review')] }),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Audience:'), run('  UBS Technology Leadership, Credit Risk, Compliance')] }),
  pageBreak(),
]

const execSummary = [
  h1('1. Executive Summary'),
  p('This document describes the production solution design for the PE Sub Platform — a purpose-built system for UBS Bank\'s participation in private equity subscription credit facilities. It covers the target architecture, data model, API specification, matching algorithms, real-time calculation strategy, caching, access control, and phased delivery plan.'),
  p('The immediate predecessor of this document is a fully functional React 18 prototype (developed May 2026) that demonstrates the complete analyst workflow — from Agent BB upload through LP name matching to Shadow BB calculation and certification — using a simulated data layer. The production system replaces that simulated layer with persistent services, a PostgreSQL database, and real-time APIs while preserving the validated UX and business logic.'),
  h2('1.1 Scope'),
  bullet('Ingestion of Agent Borrowing Base certificates via manual upload; Analysts download from deal site portals (SyndTrak, Intralinks, Debt Domain) and upload to the platform'),
  bullet('LP name disambiguation using Jaro-Winkler and Levenshtein similarity with configurable confidence thresholds'),
  bullet('Shadow Borrowing Base calculation applying UBS credit agreement rules (advance rates, concentration limits, eligibility)'),
  bullet('Analyst build and Account/Transaction Manager 4-eye review workflow with audit trail and version history'),
  bullet('Integration with UBS Azure Active Directory (SSO) and Master Access Control (MAC) entitlements system'),
  bullet('Certificate generation, reporting, and 7-year audit retention'),
  h2('1.2 Out of Scope (v1)'),
  bullet('CMS / credit system drawdown integration (Phase 2)'),
  bullet('Multi-tranche facility support (future consideration — not required by current facilities)'),
  bullet('Any workflows beyond Analyst → Account/Transaction Manager review'),
  pageBreak(),
]

const context = [
  h1('2. Business Context'),
  p('A subscription credit facility (sub line) is a revolving credit line extended to a private equity fund, secured by the unfunded capital commitments of the fund\'s Limited Partners (LPs). UBS participates as a lender across approximately 71 facility positions administered by 17 agent banks (Wells Fargo, JPMorgan, Citibank, Bank of America, Morgan Stanley, etc.), representing roughly USD 10.6 billion of committed loan volume.'),
  p('Each month-end, the agent bank calculates and posts a Borrowing Base Certificate to the deal site. UBS Analysts download each certificate, reconcile it against UBS\'s own LP Master database, apply UBS-specific advance rates and concentration limits, and produce a Shadow Borrowing Base — UBS\'s independent view of availability. The completed analysis is reviewed by an Account/Transaction Manager (4-eye check) before it is finalised.'),
  p('The delta between the agent\'s BB and UBS\'s Shadow BB drives analyst conversations with the agent and, where material, escalation to credit risk management.'),
  h2('2.1 Monthly Cycle'),
  tbl(
    ['Phase', 'Timing', 'Actor', 'Action'],
    [
      ['Month-end close', 'Last business day', 'System', 'As-of date established for all facilities'],
      ['Certificate preparation', 'Days 1–10', 'Agent bank', 'BB certificate prepared; posted to deal site (SyndTrak / Intralinks / Debt Domain)'],
      ['Certificate ingestion', 'Days 3–12', 'Analyst', 'Analyst downloads certificate from deal site; uploads to platform via manual file upload; ingestion pipeline triggered'],
      ['LP name matching', 'Days 3–12', 'Platform + Analyst', 'Algorithm scores all LP names; high-confidence matches auto-accepted; review queue resolved by the owning Analyst'],
      ['Shadow BB calculation', 'Days 3–12', 'Platform', 'Full portfolio BB computed; breaches flagged; delta surfaced'],
      ['Review and certification', 'Days 5–20', 'Analyst + Account/Transaction Manager', 'Classification disputes resolved by Analyst; Account/Transaction Manager performs 4-eye review; Shadow BB certified; certificate generated'],
      ['Cycle complete', 'By day 20–25', 'Analyst', 'All facilities certified for the month'],
    ]
  ),
  pageBreak(),
]

const architecture = [
  h1('3. Target Architecture'),
  h2('3.1 Architecture Overview'),
  p('The production system is a three-tier web application deployed on Azure Kubernetes Service (AKS):'),
  bullet('Presentation tier: React 18 SPA with Redux state management, served from Azure CDN'),
  bullet('Application tier: Spring Boot 3.5 microservices on AKS; API Gateway handles routing, JWT validation, and rate limiting'),
  bullet('Data tier: PostgreSQL Flexible Server (primary); Azure Blob Storage for documents and generated certificates; Azure Cache for Redis for service-layer caching'),
  h2('3.2 Component Map'),
  tbl(
    ['Component', 'Technology', 'Role'],
    [
      ['React SPA', 'React 18 · Redux Toolkit · Vite', 'Analyst workspace; all user interaction'],
      ['API Gateway', 'Azure API Management', 'JWT validation, rate limiting, routing, response caching'],
      ['Ingestion Service', 'Spring Boot 3.5 · Apache POI', 'Multipart file upload; virus scan; Excel parsing; column recognition; normalization'],
      ['LP Matching Service', 'Spring Boot 3.5 · Apache Commons Text', 'Jaro-Winkler + Levenshtein scoring; match queue management; LP Master deduplication'],
      ['BB Calculation Service', 'Spring Boot 3.5', 'Shadow BB engine; tiered BUSA rate application; concentration breach detection; snapshot persistence'],
      ['Configuration Service', 'Spring Boot 3.5', 'Advance rates, eligibility rules, concentration limits, field mapping dictionary'],
      ['Reporting Service', 'Spring Boot 3.5 · iText 8', 'BB certificate PDF generation; CSV export; scheduled report delivery'],
      ['Audit Service', 'Spring Boot 3.5', 'Append-only audit log; 7-year retention; tamper-evidence via record hashing'],
      ['PostgreSQL', 'Azure PostgreSQL Flexible Server 16', 'Primary persistent store for all structured data'],
      ['Blob Storage', 'Azure Blob Storage', 'Raw Agent BB files; generated certificates; export archives'],
      ['Redis Cache', 'Azure Cache for Redis', 'LP Master search results; facility list; credit agreement rules'],
      ['Identity', 'Azure Active Directory (Entra ID)', 'SSO; JWT issuance; group-to-role mapping for MAC entitlements'],
      ['Key Vault', 'Azure Key Vault', 'Connection strings; API keys; encryption key rotation'],
    ]
  ),
  h2('3.3 Real-time vs. Batch Strategy'),
  h3('What "batch" means'),
  p('A batch run calculates the Shadow BB for every LP in a submission in a single pass. For a 900-LP facility this is 900 sequential computations — classification lookup, rate application, concentration cap, delta — executed server-side in one transaction. At target scale (2,200 LPs) the full pass completes in under 30 seconds, making it synchronous from the analyst\'s perspective. "Batch" means all LPs at once, not a long-running overnight job.'),
  h3('What triggers a batch run'),
  p('The batch trigger is always a submission event — a specific Agent BB file being ready for calculation. There is no standalone monthly scheduled trigger. The Analyst manually downloads the certificate from the deal site, uploads it to the platform, and the system processes it. Calculation is triggered when the upload is processed and auto-accepted matches are confirmed.'),
  tbl(
    ['Event', 'Trigger type', 'Who initiates'],
    [
      ['Analyst uploads Agent BB file and upload is processed', 'Immediate full batch', 'System, after file is parsed and auto-accepted matches are applied'],
      ['Analyst clicks Run Shadow BB in the upload wizard', 'Immediate full batch', 'Analyst'],
      ['Analyst resolves the last pending item in the match queue', 'Optional auto-trigger (configurable per facility)', 'System'],
    ]
  ),
  h3('Calculation modes'),
  tbl(
    ['Mode', 'Trigger', 'Scope', 'Expected Latency'],
    [
      ['Full batch', 'New submission uploaded; Analyst clicks Run Shadow BB', 'All LPs in facility (up to 2,200)', '< 30 seconds for 2,200 LPs'],
      ['Incremental real-time', 'Single LP reclassified, included/excluded, or match decision confirmed', 'One LP + portfolio aggregates recalculated', '< 500 ms; result pushed to client via SSE'],
    ]
  ),
  h3('The one valid scheduled job'),
  p('A nightly background job checks whether any LP Master records have been updated since the last Shadow BB run for each active facility. If a rating change, reclassification, or AUM update affects an LP that appears in a recently certified submission, the platform flags that submission for re-review and notifies the owning Analyst. This is a staleness notification, not a monthly batch recalculation — the Analyst decides whether to re-run the Shadow BB based on the materiality of the change.'),
  h3('Real-time incremental detail'),
  p('When an Analyst reclassifies a single LP during review, the BB Calculation Service receives a delta event containing the LP ID and new classification. It recomputes only that LP\'s contribution, updates the bb_snapshot record in place, recalculates the portfolio-level aggregates (total UBS BB, EAR, delta, breach checks), and emits a Server-Sent Event to all connected clients viewing that submission. The React client patches the Redux store — no full page reload or re-fetch required.'),
  h2('3.4 Caching Strategy'),
  tbl(
    ['Layer', 'What is Cached', 'TTL / Invalidation', 'Technology'],
    [
      ['Browser (Redux)', 'Current submission state; LP Master current page; facility list; user preferences', 'Invalidated on write; cleared on logout', 'Redux Toolkit + RTK Query'],
      ['API Gateway', 'Facility list; credit agreement rule sets; field mapping dictionary', '15-minute TTL; invalidated on Config Service write', 'Azure API Management response cache'],
      ['Service (Redis)', 'LP Master search result pages; LP classification lookups by name hash', '60-minute TTL; invalidated on LP Master write', 'Azure Cache for Redis'],
      ['Database', 'BB calculation snapshot (versioned); audit log; match queue decisions', 'Permanent; persisted to PostgreSQL', 'PostgreSQL read replicas for reporting queries'],
    ]
  ),
  p('LP Master (20k+ records) is never held in full in the browser. The client requests paginated, filtered slices from the API. Redis caches the most recently accessed pages. A full LP Master load (for export) is a server-side streaming operation — never loaded into browser memory.'),
  pageBreak(),
]

const dataModel = [
  h1('4. Data Model'),
  h2('4.1 Entity Overview'),
  tbl(
    ['Entity', 'Description', 'Key Relationships'],
    [
      ['lp_master', 'Bank-wide canonical LP record; one row per unique LP entity', 'Referenced by lp_facility_record and match_queue_item'],
      ['facility', 'Sub line facility record; one per fund', 'Has many submission; has one credit_agreement_rule'],
      ['credit_agreement_rule', 'Advance rates, concentration limits, eligibility parameters for a facility', 'Belongs to facility; versioned with effective_date'],
      ['submission', 'One Agent BB file ingested for one facility', 'Belongs to facility; has many match_queue_item; has one bb_snapshot'],
      ['lp_submission_record', 'Per-LP computed eligibility, classification, and BB contribution for one submission', 'Belongs to submission and lp_master'],
      ['match_queue_item', 'One LP name matching decision per submission', 'Belongs to submission; resolved to lp_master or new_lp_pending'],
      ['bb_snapshot', 'Immutable persisted result of one Shadow BB calculation run', 'Belongs to submission; referenced by audit entries'],
      ['audit_log', 'Append-only event log for every user and system action', 'References facility, submission, lp_master, user by FK'],
      ['app_user', 'Platform user account; role derived from MAC entitlement group', 'References role; owns submissions'],
    ]
  ),
  h2('4.2 Core Table Definitions'),
  h3('lp_master'),
  tbl(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
      ['lp_id', 'UUID PK', 'N', 'Surrogate primary key'],
      ['canonical_name', 'VARCHAR(255)', 'N', 'Authoritative LP name in UBS records'],
      ['parent_lp_id', 'UUID FK', 'Y', 'Self-referential; parent entity for subsidiaries/SPVs'],
      ['investor_type', 'VARCHAR(60)', 'N', 'Pension, Endowment, Sovereign Wealth, Insurance, Family Office, etc.'],
      ['region', 'VARCHAR(60)', 'N', 'North America, EMEA, Asia Pacific, Latin America'],
      ['hq_us', 'BOOLEAN', 'N', 'Headquartered in United States'],
      ['is_spv', 'BOOLEAN', 'N', 'Special Purpose Vehicle flag'],
      ['erisa_subject', 'BOOLEAN', 'N', 'Subject to ERISA plan asset rules'],
      ['sp_rating', 'VARCHAR(10)', 'Y', "S&P long-term issuer credit rating"],
      ['moodys_rating', 'VARCHAR(10)', 'Y', "Moody's long-term rating"],
      ['fitch_rating', 'VARCHAR(10)', 'Y', 'Fitch long-term rating'],
      ['applicable_rating', 'VARCHAR(10)', 'Y', 'Normalized rating per hierarchy in credit_agreement_rule'],
      ['aum_usd', 'BIGINT', 'Y', 'Assets under management in USD (normalized from agent text ranges)'],
      ['nav_usd', 'BIGINT', 'Y', 'Net asset value in USD'],
      ['classification', 'VARCHAR(30)', 'N', 'Rated | Unrated >2bn | Unrated 1–2bn | Eligible | Excluded'],
      ['reclassified', 'BOOLEAN', 'N', 'Manual override applied by an Analyst'],
      ['is_transferee', 'BOOLEAN', 'N', 'LP position acquired by transfer; affects eligibility'],
      ['is_investment_grade', 'BOOLEAN', 'N', 'Derived: applicable_rating meets investment-grade threshold'],
      ['notes', 'TEXT', 'Y', 'Free-form analyst annotations'],
      ['created_at', 'TIMESTAMPTZ', 'N', 'Record creation timestamp'],
      ['updated_at', 'TIMESTAMPTZ', 'N', 'Last modification timestamp'],
      ['created_by', 'UUID FK → app_user', 'N', 'User who created the record'],
      ['updated_by', 'UUID FK → app_user', 'N', 'User who last modified the record'],
    ]
  ),
  h3('facility'),
  tbl(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
      ['facility_id', 'UUID PK', 'N', 'Surrogate primary key'],
      ['facility_name', 'VARCHAR(255)', 'N', 'Fund name (e.g. Blue Owl GP Stakes V)'],
      ['agent_bank', 'VARCHAR(100)', 'N', 'Agent bank name'],
      ['agent_deal_site', 'VARCHAR(30)', 'Y', 'Deal site where the Analyst downloads the certificate (SyndTrak, Intralinks, Debt Domain, Other); informational only'],
      ['facility_size_usd', 'BIGINT', 'N', 'Total facility commitment in USD'],
      ['ubs_participation_usd', 'BIGINT', 'N', 'UBS funded participation amount'],
      ['credit_agreement_ref', 'VARCHAR(50)', 'N', 'Internal credit agreement reference'],
      ['status', 'VARCHAR(20)', 'N', 'Active | Review | Pending | Closed'],
      ['created_at', 'TIMESTAMPTZ', 'N', ''],
    ]
  ),
  h3('submission'),
  tbl(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
      ['submission_id', 'UUID PK', 'N', 'Surrogate primary key'],
      ['facility_id', 'UUID FK', 'N', 'Parent facility'],
      ['as_of_date', 'DATE', 'N', 'BB certificate as-of date (typically month-end)'],
      ['agent_bank', 'VARCHAR(100)', 'N', 'Agent bank for this submission'],
      ['blob_path', 'VARCHAR(500)', 'N', 'Azure Blob Storage path for original Agent BB file'],
      ['ingestion_mode', 'VARCHAR(20)', 'N', 'Automated | Manual'],
      ['status', 'VARCHAR(20)', 'N', 'Ingesting | Extracting | Matching | Calculating | Review | Active'],
      ['lp_count', 'INTEGER', 'Y', 'Total LP rows in Agent BB file'],
      ['submitted_by', 'UUID FK → app_user', 'N', 'Analyst who owns the workflow'],
      ['certified_by', 'UUID FK → app_user', 'Y', 'Analyst or Account/Transaction Manager who certified the final Shadow BB'],
      ['certified_at', 'TIMESTAMPTZ', 'Y', 'Certification timestamp'],
      ['created_at', 'TIMESTAMPTZ', 'N', ''],
    ]
  ),
  h3('lp_submission_record'),
  tbl(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
      ['record_id', 'UUID PK', 'N', 'Surrogate primary key'],
      ['submission_id', 'UUID FK', 'N', 'Parent submission'],
      ['lp_id', 'UUID FK → lp_master', 'N', 'Matched LP'],
      ['agent_name', 'VARCHAR(255)', 'N', 'LP name as written by agent in this submission'],
      ['agent_classification', 'VARCHAR(30)', 'Y', 'Classification as stated by agent'],
      ['agent_rate', 'NUMERIC(5,4)', 'Y', 'Advance rate as stated by agent'],
      ['agent_conc_limit_usd', 'BIGINT', 'Y', 'Concentration limit as stated by agent'],
      ['agent_bb_usd', 'BIGINT', 'Y', 'Agent BB contribution for this LP'],
      ['commitment_usd', 'BIGINT', 'Y', 'Total LP commitment'],
      ['uncalled_usd', 'BIGINT', 'Y', 'Unfunded/uncalled capital'],
      ['ubs_classification', 'VARCHAR(30)', 'N', 'UBS-assigned classification (from lp_master or Analyst override)'],
      ['ubs_rate', 'NUMERIC(5,4)', 'N', 'BUSA advance rate applied'],
      ['ubs_conc_limit_usd', 'BIGINT', 'N', 'UBS per-LP concentration cap'],
      ['ubs_eligible_uncalled_usd', 'BIGINT', 'N', 'MIN(uncalled_usd, ubs_conc_limit_usd)'],
      ['conc_excess_usd', 'BIGINT', 'N', 'MAX(0, uncalled_usd – ubs_conc_limit_usd)'],
      ['ubs_bb_usd', 'BIGINT', 'N', 'UBS BB = ubs_eligible_uncalled × ubs_rate'],
      ['ubs_bb_delta_usd', 'BIGINT', 'N', 'ubs_bb_usd – agent_bb_usd'],
      ['ubs_included', 'BOOLEAN', 'N', 'Y = counted in UBS BB aggregates; N = excluded'],
      ['reclassified', 'BOOLEAN', 'N', 'Analyst applied a manual classification override'],
      ['reclassify_reason', 'TEXT', 'Y', 'Mandatory rationale when reclassified = true'],
      ['is_transferee', 'BOOLEAN', 'N', 'Transferee flag for this position'],
    ]
  ),
  h3('match_queue_item'),
  tbl(
    ['Column', 'Type', 'Nullable', 'Description'],
    [
      ['item_id', 'UUID PK', 'N', 'Surrogate primary key'],
      ['submission_id', 'UUID FK', 'N', 'Parent submission'],
      ['agent_name', 'VARCHAR(255)', 'N', 'Raw LP name from agent BB file'],
      ['matched_lp_id', 'UUID FK → lp_master', 'Y', 'Best candidate match from LP Master (null if no match found)'],
      ['match_score', 'NUMERIC(5,2)', 'Y', 'Combined Jaro-Winkler + Levenshtein similarity score (0–100)'],
      ['match_details', 'JSONB', 'Y', 'Full scoring breakdown: normalization steps, JW score, Lev score, candidate list'],
      ['status', 'VARCHAR(20)', 'N', 'Pending | AutoAccepted | Accepted | Rejected | NewLP'],
      ['resolved_by', 'UUID FK → app_user', 'Y', 'User who confirmed or rejected the match'],
      ['resolved_at', 'TIMESTAMPTZ', 'Y', 'Resolution timestamp'],
    ]
  ),
  pageBreak(),
]

const apiSpec = [
  h1('5. API Specification'),
  p('All endpoints are RESTful JSON over HTTPS. Authentication via Bearer JWT (Azure AD). Base path: /api/v1.'),
  h2('5.1 Facilities'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['GET', '/facilities', 'List all facilities accessible to the current user', 'All roles'],
      ['GET', '/facilities/{id}', 'Facility detail including current status and latest submission summary', 'All roles'],
      ['POST', '/facilities', 'Create new facility record', 'Analyst'],
      ['PATCH', '/facilities/{id}', 'Update facility metadata or status', 'Analyst'],
    ]
  ),
  h2('5.2 Submissions'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['GET', '/submissions?facility={id}', 'List submissions for a facility', 'All roles'],
      ['POST', '/submissions/upload', 'Upload Agent BB file (multipart/form-data); triggers ingestion pipeline', 'All roles'],
      ['GET', '/submissions/{id}', 'Submission detail and current status', 'All roles'],
      ['POST', '/submissions/{id}/run-bb', 'Trigger full Shadow BB calculation for this submission', 'Owner Analyst, A/T Manager'],
      ['POST', '/submissions/{id}/certify', 'Certify the Shadow BB; locks the snapshot', 'Owner Analyst, A/T Manager'],
      ['GET', '/submissions/{id}/events', 'Server-Sent Events stream for real-time status updates', 'All roles'],
    ]
  ),
  h2('5.3 LP Master'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['GET', '/lp-master', 'Paginated, filtered LP list; supports q, classification, region, facility filters', 'All roles'],
      ['GET', '/lp-master/{id}', 'Full LP record with version history', 'All roles'],
      ['PATCH', '/lp-master/{id}', 'Update classification, ratings, AUM, notes; triggers reclassification audit entry', 'Owner Analyst, A/T Manager'],
      ['POST', '/lp-master/{id}/reclassify', 'Override classification with mandatory reason; logged; triggers incremental BB recalc', 'Owner Analyst, A/T Manager'],
      ['GET', '/lp-master/export', 'Streaming CSV export of full LP Master (35 fields); server-side generation', 'All roles'],
    ]
  ),
  h2('5.4 Match Queue'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['GET', '/submissions/{id}/match-queue', 'Match queue for a submission; filterable by status and score range', 'All roles'],
      ['GET', '/submissions/{id}/match-queue/{itemId}', 'Single match item with full scoring breakdown', 'All roles'],
      ['POST', '/submissions/{id}/match-queue/{itemId}/resolve', 'Accept or reject a match; body: {action: "accept"|"reject"|"new_lp", lp_id?, reason?}', 'Owner Analyst, A/T Manager'],
      ['POST', '/submissions/{id}/match-queue/resolve-bulk', 'Batch accept all auto-accept threshold items', 'Owner Analyst, A/T Manager'],
    ]
  ),
  h2('5.5 Shadow BB'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['GET', '/submissions/{id}/shadow-bb', 'Full LP-level Shadow BB results for a submission (paginated)', 'All roles'],
      ['GET', '/submissions/{id}/shadow-bb/summary', 'Portfolio summary: UBS BB, Agent BB, delta, EAR, breach list', 'All roles'],
      ['PATCH', '/submissions/{id}/shadow-bb/lp/{lpId}', 'Toggle ubs_included for one LP; triggers incremental recalc', 'Owner Analyst, A/T Manager'],
      ['GET', '/submissions/{id}/shadow-bb/export', 'Export Shadow BB as Excel; streamed server-side', 'All roles'],
    ]
  ),
  h2('5.6 Configuration'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['GET', '/config/rates', 'Current BUSA and Agent advance rate schedules', 'All roles'],
      ['PUT', '/config/rates', 'Update rate schedule; creates new versioned record with effective_date', 'Analyst'],
      ['GET', '/config/eligibility-rules', 'Active eligibility rules', 'All roles'],
      ['PATCH', '/config/eligibility-rules/{id}', 'Toggle rule active/inactive', 'Analyst'],
      ['GET', '/config/field-mapping', 'Canonical field alias dictionary', 'All roles'],
      ['POST', '/config/field-mapping', 'Add custom alias entry', 'Analyst'],
      ['DELETE', '/config/field-mapping/{id}', 'Remove custom alias', 'Analyst'],
      ['GET', '/config/match-thresholds', 'Current auto-accept and review thresholds', 'All roles'],
      ['PUT', '/config/match-thresholds', 'Update thresholds; retroactively re-scores pending queue items', 'Analyst'],
    ]
  ),
  h2('5.7 Reports and Audit'),
  tbl(
    ['Method', 'Path', 'Description', 'Auth'],
    [
      ['POST', '/reports/bb-certificate', 'Generate BB certificate PDF or XLSX; body specifies facility, snapshot, format, watermark', 'All roles'],
      ['GET', '/audit-log', 'Query audit log; filters: facility, user, event_type, date range; paginated', 'Analyst (own facilities), A/T Manager (all)'],
      ['GET', '/audit-log/export', 'Export audit log as signed PDF; server-side generation', 'A/T Manager'],
    ]
  ),
  pageBreak(),
]

const matching = [
  h1('6. LP Name Matching Algorithm'),
  h2('6.1 Overview'),
  p('Every Agent BB submission contains LP names formatted according to the agent bank\'s internal conventions. These names frequently differ from the canonical names in UBS\'s LP Master. The matching engine scores each agent name against LP Master candidates and assigns a confidence score that determines whether the match is auto-accepted or queued for Analyst review.'),
  h2('6.2 Normalization Pipeline'),
  p('Before scoring, both the agent name and each LP Master candidate pass through the same normalization pipeline:'),
  tbl(
    ['Step', 'Operation', 'Example'],
    [
      ['1. Case fold', 'Lowercase all characters', 'CalPERS → calpers'],
      ['2. Punctuation strip', 'Remove . , - ( )', '"J.P. Morgan" → "j p morgan"'],
      ['3. Whitespace collapse', 'Replace multiple spaces with single space', '"  " → " "'],
      ['4. Legal suffix strip', 'Remove LLC, LP, Ltd, Corp, Inc, Co., et al.', '"Apex Capital LLC" → "apex capital"'],
      ['5. Abbreviation expansion', 'Known abbreviation map: CPPIB → canada pension plan investment board', '"CPPIB" → "canada pension plan investment board"'],
      ['6. Retirement suffix normalize', 'Ret. Sys. → retirement system; Ret. → retirement', '"Texas Teachers Ret. Sys." → "texas teachers retirement system"'],
    ]
  ),
  h2('6.3 Similarity Scoring'),
  p('The combined confidence score is a weighted average of two string similarity metrics, each computed on the normalized forms:'),
  tbl(
    ['Metric', 'Weight', 'Strengths', 'Implementation'],
    [
      ['Jaro-Winkler', '60%', 'Favours prefix agreement; handles transpositions; robust on short strings', 'Apache Commons Text JaroWinklerSimilarity'],
      ['Levenshtein (normalized)', '40%', 'Counts character-level edit operations; handles insertions and deletions well', 'Apache Commons Text LevenshteinDistance; normalized by max(len_a, len_b)'],
    ]
  ),
  p('Combined Score = (JW × 0.60) + ((1 – Lev_normalized) × 0.40) × 100'),
  p('The score is computed against the top-5 LP Master candidates returned by a PostgreSQL pg_trgm trigram similarity pre-filter. The pre-filter limits full scoring to a manageable candidate set without sacrificing recall.'),
  h2('6.4 Confidence Thresholds'),
  tbl(
    ['Threshold', 'Default Value', 'Outcome', 'Configurable?'],
    [
      ['Auto-accept', '≥ 95', 'Match confirmed automatically; no analyst action required; logged as AutoAccepted', 'Yes — Analyst via Match Thresholds screen'],
      ['Manual review (high)', '80 – 94', 'Queued for Analyst review; algorithm\'s top candidate displayed with full scoring breakdown', 'Yes'],
      ['Manual review (low)', '50 – 79', 'Queued for Analyst review; multiple candidates shown; the Analyst must select or create new LP', 'Yes'],
      ['No match', '< 50', 'Queued as potential new LP; the Analyst confirms whether to create a new LP Master record', 'Yes'],
    ]
  ),
  note('Threshold changes take effect immediately and retroactively re-score all Pending items in the active match queue. Items already resolved (Accepted/Rejected) are not affected.'),
  h2('6.5 Match Analysis Output'),
  p('For every queued item, the service persists a match_details JSONB payload containing:'),
  bullet('Normalization steps applied to both the agent name and each candidate, with before/after values'),
  bullet('JW score, Lev score, and combined score for each candidate'),
  bullet('Ranked candidate list (top 5)'),
  bullet('Threshold band the winning score falls into'),
  p('This payload drives the Match Analysis panel in the UI, allowing the Analyst to see exactly why the algorithm ranked candidates as it did.'),
  pageBreak(),
]

const bbEngine = [
  h1('7. Shadow BB Calculation Engine'),
  h2('7.1 Shadow BB Calculation — Tiered Rate'),
  p('The UBS Shadow BB is calculated per LP as follows:'),
  tbl(
    ['Step', 'Formula', 'Notes'],
    [
      ['1. Uncalled capital', 'uncalled_usd (from submission)', 'Agent-reported unfunded commitment'],
      ['2. UBS Eligible Uncalled Cap', 'MIN(uncalled_usd, ubs_conc_limit_usd)', 'Concentration cap from credit agreement'],
      ['3. Concentration excess', 'MAX(0, uncalled_usd – ubs_conc_limit_usd)', 'Excluded from BB; reported separately'],
      ['4. BUSA advance rate', 'Lookup by ubs_classification (table below)', 'Applied to UBS Eligible Uncalled Cap'],
      ['5. UBS BB contribution', 'ubs_eligible_uncalled_usd × ubs_rate', 'LP\'s contribution to portfolio BB'],
      ['6. UBS BB delta', 'ubs_bb_usd – agent_bb_usd', 'Positive = UBS claims more; negative = UBS is more conservative'],
    ]
  ),
  h2('7.2 BUSA Advance Rate Schedule'),
  tbl(
    ['LP Classification', 'BUSA Rate', 'Eligibility Criterion'],
    [
      ['Rated', '90%', 'Investment-grade rating from S&P, Moody\'s, or Fitch per applicable rating hierarchy'],
      ['Unrated >$2B AUM', '75%', 'No investment-grade rating; AUM > USD 2 billion'],
      ['Unrated $1–2B AUM', '65%', 'No investment-grade rating; AUM USD 1–2 billion'],
      ['Eligible', '50%', 'No rating; AUM < USD 1 billion; meets all other eligibility criteria'],
      ['Excluded', '0%', 'Fails eligibility: ERISA >25%, sanctions, defaulted commitment, or Analyst-designated'],
    ]
  ),
  note('Multi-tranche support (e.g. a flat-rate second tranche alongside the tiered rate) is not required by current facilities and is a future consideration only.'),
  h2('7.3 Portfolio Aggregates'),
  tbl(
    ['Metric', 'Formula'],
    [
      ['Total UBS BB', 'SUM(ubs_bb_usd) WHERE ubs_included = true AND ubs_classification ≠ Excluded'],
      ['Total Agent BB', 'SUM(agent_bb_usd) for all LPs in submission'],
      ['BB Delta', 'Total UBS BB – Total Agent BB'],
      ['Total UBS Eligible Uncalled', 'SUM(ubs_eligible_uncalled_usd) WHERE ubs_included = true'],
      ['Effective Advance Rate (EAR)', 'Total UBS BB / Total UBS Eligible Uncalled'],
      ['Concentration Excess', 'SUM(conc_excess_usd) for all LPs'],
    ]
  ),
  h2('7.4 Concentration Breach Rules'),
  tbl(
    ['Rule', 'Threshold', 'Severity'],
    [
      ['Single LP concentration', 'Any LP\'s UBS BB > 15% of Total UBS BB', 'Breach'],
      ['Top-10 LP concentration (breach)', 'Top-10 LPs aggregate UBS BB > 60% of Total UBS BB', 'Breach'],
      ['Top-10 LP concentration (warning)', 'Top-10 LPs aggregate UBS BB > 50% of Total UBS BB', 'Warning'],
      ['Unrated aggregate', 'Unrated LPs aggregate UBS BB > 50% of Total UBS BB', 'Breach'],
      ['Non-US LP aggregate', 'Non-US LPs aggregate UBS BB > 30% of Total UBS BB', 'Breach'],
    ]
  ),
  note('Breach thresholds are configurable per facility in the Configuration Studio. The defaults above apply where no facility-specific override is set.'),
  pageBreak(),
]

const rbac = [
  h1('8. Role-Based Access Control'),
  p('The platform operates with two roles: Analyst and Account/Transaction Manager. The Analyst is the day-to-day operator who performs Shadow BB construction and inputs, owns submissions, and manages system configuration. The Account/Transaction Manager holds operational ownership and 4-eye review authority. Workflow ownership is per-submission: the Analyst who uploads an Agent BB owns all active steps for that submission until it is certified or reassigned by an Account/Transaction Manager.'),
  h2('8.1 Roles'),
  tbl(
    ['Role', 'Description'],
    [
      ['Analyst', 'Day-to-day operator and system configurator. Uploads Agent BBs, resolves LP match queues, runs Shadow BB calculations, edits LP Master classifications, and manages credit agreement configuration. Owns submissions they upload and can act on all active steps within their submissions. Can view any submission owned by a colleague in read-only mode.'],
      ['Account/Transaction Manager', 'Operational ownership and 4-eye review authority. Performs the 4-eye check on completed Shadow BB analyses before submission to the agent. Can act on any submission regardless of ownership — used when the owning Analyst is unavailable or an escalated decision is required. Can reassign workflow ownership and has full cross-facility read and audit-trail visibility. Does not perform day-to-day configuration changes.'],
    ]
  ),
  h2('8.2 Permission Matrix'),
  tbl(
    ['Capability', 'Analyst (owner)', 'Analyst (other)', 'Account/Transaction Manager'],
    [
      ['Upload Agent BB', '✓', '✓', '✓'],
      ['Review Extraction', '✓', 'View', '✓'],
      ['Resolve LP Match Queue', '✓', 'View', '✓'],
      ['Run Shadow BB', '✓', 'View', '✓'],
      ['View Shadow BB / Reports', '✓', '✓', '✓'],
      ['Export BB Certificate', '✓', '✓', '✓'],
      ['Reassign workflow ownership', '—', '—', '✓'],
      ['Override any active workflow step', '—', '—', '✓'],
      ['LP Master (edit classification)', '✓', '—', '✓'],
      ['Configuration Studio (edit)', '✓', '✓', '—'],
      ['Configuration Studio (view)', '✓', '✓', '✓'],
      ['Match Thresholds (edit)', '✓', '✓', '—'],
      ['Field Mapping (edit)', '✓', '✓', '—'],
      ['Audit Trail (own facilities)', '✓', '—', '—'],
      ['Audit Trail (all facilities)', '—', '—', '✓'],
      ['User management', '✓', '✓', '—'],
    ]
  ),
  h2('8.3 Account/Transaction Manager — Exclusive Actions'),
  p('Four actions are exclusively available to Account/Transaction Managers and are not available to any Analyst regardless of ownership:'),
  bullet('Override any active workflow step — step into the Extraction Review, LP Match Queue, or Shadow BB Run for any submission, whether or not they uploaded it. Used when the owning Analyst is unavailable or an escalated review is required.'),
  bullet('Reassign workflow ownership — transfer submission ownership from one Analyst to another. Ownership determines who holds the active Resume CTA on the Dashboard for Review and Pending facilities.'),
  bullet('Cross-facility Audit Trail — an unrestricted audit view across all facilities, all users, full history. An Analyst\'s audit trail is scoped to their own submission events only.'),
  bullet('LP classification override on non-owned submissions — reclassify any LP in LP Master regardless of which Analyst owns the associated submission; the escalation path when a classification dispute requires senior sign-off.'),
  h2('8.4 Workflow Ownership Rules'),
  bullet('Ownership is established at upload. The Analyst who submits an Agent BB owns the resulting workflow (Extraction → Match Queue → Shadow BB) until the submission is certified or reassigned.'),
  bullet('Pending facilities require configuration. A facility in Pending status cannot have a Shadow BB run until an Analyst configures its credit agreement rules. Any Analyst can unblock a Pending facility — ownership is not required for configuration.'),
  bullet('Review facilities retain a valid certified BB. A submission in Review status means the previous certified BB remains live. Only the owning Analyst (or an Account/Transaction Manager) can resolve the match queue and certify the new submission.'),
  bullet('Account/Transaction Managers can override and reassign. If an owning Analyst is unavailable, an Account/Transaction Manager can step into any active workflow step or transfer ownership to another Analyst.'),
  bullet('Read access is unrestricted within the team. Any Analyst can view any facility\'s Shadow BB, match queue, extraction, or report — they simply cannot take action on submissions they do not own.'),
  h2('8.5 Dashboard Resume CTAs'),
  p('The Executive Summary panel on the Dashboard surfaces a context-aware action for each facility status. The submitting Analyst\'s name is displayed alongside the CTA for Review and Pending facilities so any user can immediately identify who owns the open item.'),
  tbl(
    ['Facility Status', 'Current User', 'CTA Shown'],
    [
      ['Active', 'Any', 'View Shadow BB →'],
      ['Review', 'Owner / Account/Transaction Manager', 'Resolve Match Queue →'],
      ['Review', 'Other Analyst', 'View Match Queue (read-only)'],
      ['Pending', 'Analyst', 'Configure Rules →'],
      ['Pending', 'Account/Transaction Manager', 'Pending analyst configuration'],
    ]
  ),
  h2('8.6 API-Level Enforcement'),
  p('UI permission gates are a UX aid only, not a security boundary. Every API endpoint enforces role and ownership checks server-side via Spring Security:'),
  bullet('JWT claims include sub (user ID) and role (Analyst | Account/Transaction Manager)'),
  bullet('Ownership check: submission.submitted_by must equal JWT sub, or the role must be Account/Transaction Manager'),
  bullet('Configuration edits (rates, eligibility, field mapping, match thresholds, user management) require the Analyst role; the Account/Transaction Manager has view-only configuration access'),
  bullet('Cross-facility audit-trail and reassignment endpoints require the Account/Transaction Manager role'),
  bullet('Write endpoints (POST, PUT, PATCH, DELETE) additionally validate that the role and ownership permit the operation'),
  note('DB role values are stored verbatim as \'Analyst\' | \'Account/Transaction Manager\'. This two-role model was consolidated from three legacy roles (Credit Officer, Supervisor, Admin); see pe-sub-platform/docs/RBAC_ROLES.md for the authoritative matrix.'),
  pageBreak(),
]

const security = [
  h1('9. UBS Security Integration'),
  h2('9.1 Single Sign-On (Azure Active Directory)'),
  p('The platform integrates with UBS Azure Active Directory (Entra ID) for authentication. The standard OAuth 2.0 Authorization Code flow with PKCE is used for the SPA; Spring Boot services validate JWTs using the JWKS endpoint.'),
  tbl(
    ['Parameter', 'Value'],
    [
      ['Identity provider', 'Azure Active Directory (Entra ID) — UBS corporate tenant'],
      ['Protocol', 'OAuth 2.0 + OpenID Connect'],
      ['SPA flow', 'Authorization Code with PKCE (no client secret in browser)'],
      ['Token validation', 'Spring Boot Resource Server; JWKS endpoint auto-configured via spring.security.oauth2.resourceserver.jwt.jwk-set-uri'],
      ['Token lifetime', '1 hour access token; 8-hour refresh token (UBS AD policy)'],
      ['MFA', 'Enforced by UBS AD Conditional Access policy; transparent to the application'],
    ]
  ),
  h2('9.2 Master Access Control (MAC) Entitlements'),
  p('UBS\'s Master Access Control (MAC) system is the authoritative source of user entitlements. The two platform roles are derived from MAC entitlement groups rather than being managed in the platform database directly.'),
  tbl(
    ['MAC Entitlement Group', 'Platform Role', 'Notes'],
    [
      ['PE_SUB_ANALYST', 'Analyst', 'Day-to-day operator and configurator; assigned to PE Sub Finance team members'],
      ['PE_SUB_ACCT_TXN_MGR', 'Account/Transaction Manager', '4-eye review and operational ownership; assigned to account/transaction managers'],
    ]
  ),
  p('At login, Azure AD embeds the user\'s MAC group memberships in the ID token as custom claims (configured via Entra ID app manifest claim mappings). The Spring Boot API Gateway reads these claims and maps them to the platform role for authorization decisions. The decoded role is stored on the JWT and drives the currentUser context server-side; workflow ownership is held on the submission record (submitted_by).'),
  note('Facility-level scoping (which facilities an Analyst can access) is a Phase 2 enhancement. In Phase 1, all Analysts have read access to all facilities, consistent with the current team structure; write actions remain gated by per-submission ownership.'),
  h2('9.3 Data Security'),
  tbl(
    ['Control', 'Implementation'],
    [
      ['Encryption in transit', 'TLS 1.3 enforced; HSTS headers; certificate managed by Azure API Management'],
      ['Encryption at rest', 'PostgreSQL: pgcrypto for PII fields (LP names, ratings data); Azure Blob Storage with Microsoft-managed keys'],
      ['Secrets management', 'Azure Key Vault; connection strings, API keys, encryption keys stored in Vault; no secrets in source code or environment variables'],
      ['Key rotation', 'Automated; 90-day rotation for database credentials; 1-year for encryption keys'],
      ['Network isolation', 'All services on Azure private VNet; PostgreSQL accessible only from AKS pods via private endpoint; no public database endpoint'],
      ['Audit retention', '7-year immutable audit log; write-once Azure Blob Storage container for audit exports'],
    ]
  ),
  pageBreak(),
]

const modules = [
  h1('10. Module Breakdown and Delivery Timeline'),
  h2('10.1 Modules'),
  p('Each module maps directly to a functional area prototyped in the React SPA. Phase 1 delivers the full analyst workflow end-to-end for the pilot facility. Phase 2 scales to all facilities and automates data migration. Phase 3 adds analytics, integrations, and production hardening.'),
  tbl(
    ['Module', 'Prototype screen(s)', 'Phase'],
    [
      ['Infrastructure and database', 'None (foundation layer)', '1'],
      ['LP Master', 'LP Master — search, filter, detail overlay, reclassify, version history, export', '1'],
      ['Agent BB upload and extraction', 'Upload wizard: Select Facility, Upload, Review Extraction', '1'],
      ['LP name matching', 'Upload wizard: Review Matches; Match Analysis panel', '1'],
      ['Shadow BB calculation', 'Upload wizard: Run Shadow BB; Shadow BB screen', '1'],
      ['Configuration', 'Configuration screen: advance rates, eligibility rules, concentration limits, field mapping, match thresholds', '1'],
      ['Reports and certificates', 'Reports screen: BB certificate, compliance tests, export, report history', '1'],
      ['Audit Trail', 'Audit Trail screen', '1'],
      ['React SPA — production API wiring', 'All screens (replace simulated data layer with live API calls via RTK Query)', '1'],
      ['Data migration', 'None (back-office tooling)', '2'],
      ['Portfolio dashboard', 'Dashboard — cross-facility KPIs, facility list, activity feed', '2'],
      ['Rules builder', 'Configuration screen enhancements', '2'],
      ['Analytics and what-if', 'Shadow BB screen enhancements', '3'],
      ['CMS integration', 'None (server-side only)', '3'],
      ['Performance and security hardening', 'None (infrastructure)', '3'],
    ]
  ),
  h2('10.2 Data Migration'),
  h3('Source systems'),
  p('Two sources exist: a Microsoft Access database used by the PE Sub team as an LP master, and the library of Excel Shadow BB files produced for each facility each month. Both need to be assessed before committing to a migration strategy.'),
  h3('Option A — Access DB ETL'),
  p('The Access database is mapped to the PostgreSQL lp_master schema: tables are inspected, columns matched to canonical fields, and records loaded via a one-time ETL script. This approach is straightforward if the Access schema is clean and well-maintained, but Access databases often accumulate inconsistencies — duplicate records, freeform text in typed fields, stale data not purged after LP exits. A schema audit is required before committing to this path.'),
  tbl(
    ['Access table / field', 'Maps to PostgreSQL', 'Migration note'],
    [
      ['LP name', 'lp_master.canonical_name', 'Normalise and deduplicate across facilities before load'],
      ['Investor type', 'lp_master.investor_type', 'Map to canonical type list; flag unmapped values for review'],
      ['AUM', 'lp_master.aum_usd', 'Convert text ranges to numeric; manual review queue for ambiguous values'],
      ['Ratings (S&P, Moody\'s, Fitch)', 'lp_master.sp_rating / moodys_rating / fitch_rating', 'Validate against recognised rating scale; flag stale or withdrawn ratings'],
      ['Classification', 'lp_master.classification', 'Carry forward as-is; set reclassified = false; algorithm re-derives on next submission'],
      ['Region / HQ', 'lp_master.region / hq_us', 'Map to canonical region list'],
    ]
  ),
  h3('Option B — Shadow BB backfill (recommended)'),
  p('Rather than migrating the Access database directly, the platform\'s own ingestion pipeline is used to process 12–24 months of historical Shadow BB Excel files — one per facility per month. This is the preferred approach for three reasons:'),
  bullet('The Shadow BB files are the actual system of record. They were reviewed and certified by analysts. The data quality is production-grade.'),
  bullet('Each file contains LP names in both agent format and UBS master format, commitment and uncalled balances, UBS classifications, advance rates, and any manual overrides — everything needed to seed lp_master and lp_submission_record in one pass.'),
  bullet('Month-over-month classification changes across the file history provide a ready-made version history for each LP, including the rationale where it was recorded in notes columns.'),
  p('The ingestion pipeline already knows how to parse these files (it uses the same Apache POI column recognition and alias mapping). Backfill simply runs the pipeline in historical mode: for each facility, process files oldest-first, upsert LP Master records on each pass, and store each month\'s output as a historical bb_snapshot. After backfill, the LP Master reflects the most recently certified classification for every LP across all facilities.'),
  h3('Option C — Hybrid'),
  p('Use the Shadow BB backfill as the primary LP Master seed (Option B), then supplement with the Access database for fields that do not appear in the BB files: parent/subsidiary relationships, legal entity identifiers, contact information, ERISA subject flag, and any custom annotations. This avoids the Access schema audit risk while still capturing metadata that the Excel files do not carry.'),
  note('Recommendation: begin with a Shadow BB backfill for one facility as a proof of concept. Run the ingestion pipeline against 12 months of historical files and compare the resulting LP Master to the current Access records. The gap — records in Access that did not appear in the Shadow BBs, or fields that did not map cleanly — defines the scope of any supplemental Access ETL required.'),
  h2('10.3 Phased Delivery Schedule'),
  tbl(
    ['Phase', 'Months', 'Success Criterion'],
    [
      ['Phase 1 — Foundation and Pilot', '1–6', 'Shadow BB calculated from a live uploaded Agent BB for Blue Owl GP Stakes V. Output matches current Excel Shadow BB. Analyst and Account/Transaction Manager sign off on parallel run.'],
      ['Phase 2 — Scale and Migration', '7–10', 'All facilities migrated via Shadow BB backfill. Portfolio-level Shadow BB available in real time. PE Sub team can update rates and rules without engineering involvement.'],
      ['Phase 3 — Hardening and Integration', '11–12', 'Platform passes UBS security review and DR test. CMS integration live. Ready for production go-live across all facilities.'],
    ]
  ),
  pageBreak(),
]

const performance = [
  h1('11. Performance Considerations'),
  h2('11.1 Scale Targets'),
  tbl(
    ['Metric', 'Target', 'Notes'],
    [
      ['LP Master size', '25,000 LPs', 'Current: ~21,847 across 71 facility positions; growing ~10% annually'],
      ['Facility count', '100 facilities', 'Current: 71 positions across 17 agent banks; headroom for new mandates'],
      ['Largest single facility', '2,500 LPs', 'Current largest: Blackstone Infrastructure III (2,241 LPs)'],
      ['Full batch BB calculation', '< 30 seconds', 'For largest facility at 2,500 LPs; target for Phase 1'],
      ['Incremental real-time recalculation', '< 500 ms', 'Single LP reclassify → portfolio aggregates updated'],
      ['LP Master search response', '< 300 ms', 'Paginated query with filter; cache hit target < 50 ms'],
      ['API Gateway throughput', '200 req/sec', 'Concurrent Analysts across all facilities; peak month-end load'],
      ['Certificate PDF generation', '< 10 seconds', 'Full LP-level certificate for 2,500 LPs'],
    ]
  ),
  h2('11.2 Database Indexing'),
  tbl(
    ['Table', 'Index', 'Purpose'],
    [
      ['lp_master', 'GIN index on canonical_name using pg_trgm', 'Trigram pre-filter for LP name matching scoring'],
      ['lp_master', 'B-tree on classification, region, hq_us', 'LP Master search and filter queries'],
      ['lp_submission_record', 'Composite on (submission_id, lp_id)', 'Per-submission LP record lookups'],
      ['lp_submission_record', 'B-tree on ubs_included, ubs_classification', 'Portfolio aggregate queries'],
      ['match_queue_item', 'Composite on (submission_id, status)', 'Queue filtering by status'],
      ['audit_log', 'B-tree on (facility_id, created_at)', 'Audit Trail date-range queries'],
      ['submission', 'B-tree on (facility_id, as_of_date)', 'Submission history lookups per facility'],
    ]
  ),
  h2('11.3 AKS Autoscaling'),
  p('Each Spring Boot service is deployed as a separate Kubernetes Deployment with Horizontal Pod Autoscaler (HPA):'),
  bullet('BB Calculation Service: scales on CPU; min 2 pods, max 8; burst capacity for month-end parallel runs'),
  bullet('Ingestion Service: scales on queue depth (Azure Service Bus message count); min 1 pod, max 4'),
  bullet('LP Matching Service: scales on CPU; min 2 pods, max 6'),
  bullet('All other services: min 1 pod, max 3; baseline traffic only'),
  pageBreak(),
]

const appendix = [
  h1('12. Appendix — Key Terms'),
  tbl(
    ['Term', 'Definition'],
    [
      ['Agent BB', 'Borrowing Base Certificate prepared by the agent bank and posted to the deal site each month'],
      ['Borrowing Base (BB)', 'The calculation determining how much the fund may have outstanding; risk-adjusted, eligibility-filtered sum of LP contributions'],
      ['Shadow BB', 'UBS\'s independent recalculation of the BB using UBS\'s own LP Master, advance rates, concentration limits, and eligibility rules'],
      ['BB Delta', 'Shadow BB minus Agent BB; negative delta means UBS calculates lower availability than the agent claims'],
      ['EAR', 'Effective Advance Rate; Total UBS BB divided by Total UBS Eligible Uncalled Capital'],
      ['GP', 'General Partner; the fund manager; the borrower on the sub line'],
      ['LP', 'Limited Partner; the fund investor; their unfunded commitment is the collateral'],
      ['Uncalled Capital', 'The portion of an LP\'s total commitment that has not yet been called by the GP'],
      ['BUSA Rate', 'Bank USA advance rate; UBS\'s classification-based advance rate schedule (90/75/65/50/0%)'],
      ['Concentration Limit', 'Per-LP cap on how much uncalled capital can contribute to the borrowing base'],
      ['Reclassified', 'Flag indicating that an analyst has manually overridden the algorithmically-assigned LP classification'],
      ['UBS Included', 'Flag indicating an LP is counted in UBS BB aggregates (Y) or excluded by analyst decision (N)'],
      ['Transferee', 'An LP whose commitment position was acquired by transfer; affects eligibility'],
      ['MAC', 'Master Access Control; UBS\'s enterprise entitlement management system'],
      ['Deal site', 'Loan administration portal where agent banks post BB certificates for lender download. Common platforms: SyndTrak (Goldman Sachs), Intralinks (JPMorgan, Citibank), Debt Domain (Wells Fargo). Analysts download certificates manually and upload to the platform.'],
      ['pg_trgm', 'PostgreSQL trigram similarity extension; used as a pre-filter to reduce the LP Master candidate set before full Jaro-Winkler scoring'],
    ]
  ),
]

// ── Assemble document ─────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [],
  },
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
      ...execSummary,
      ...context,
      ...architecture,
      ...dataModel,
      ...apiSpec,
      ...matching,
      ...bbEngine,
      ...rbac,
      ...security,
      ...modules,
      ...performance,
      ...appendix,
    ],
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync(OUT, buffer)
console.log(`Written: ${OUT}`)
console.log(`  Sections: Cover, Exec Summary, Business Context, Architecture, Data Model, API Spec, LP Matching, BB Engine, RBAC, Security, Modules, Performance, Appendix`)
