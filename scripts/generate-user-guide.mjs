// Generates ../PE-Sub-Platform-User-Guide.docx (in this pe-sub-docs project)
// Run from the pe-sub-docs root: npm run build:guide
// (or directly: node scripts/generate-user-guide.mjs)
//
// Audience: business users — PE Sub Analysts and Account/Transaction Managers.
// Deliberately non-technical: no API routes, table names, or service internals.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '../PE-Sub-Platform-User-Guide.docx')

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

const tip = (text) => new Paragraph({
  spacing: { after: 100, before: 60 },
  shading: { type: ShadingType.CLEAR, fill: GREY },
  border: { left: { style: BorderStyle.THICK, size: 12, color: BLUE } },
  children: [new TextRun({ text: `💡  ${text}`, size: 20, italics: true, color: '444444' })],
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

// ── Sections ──────────────────────────────────────────────────────────────────

const coverPage = [
  new Paragraph({ spacing: { before: 2000, after: 200 }, children: [
    new TextRun({ text: 'PE Sub Platform', bold: true, size: 56, color: NAVY }),
  ]}),
  new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: 'User Guide for Business Users', size: 36, color: BLUE }),
  ]}),
  new Paragraph({ spacing: { after: 400 }, children: [
    new TextRun({ text: 'Version 1.0  ·  July 2026  ·  INTERNAL', size: 22, color: '666666' }),
  ]}),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Audience:'), run('  PE Sub Analysts and Account/Transaction Managers')] }),
  new Paragraph({ spacing: { after: 60 }, children: [bold('Covers:'), run('  Dashboard · LP Master · Agent BB upload wizard · Match review · Shadow BB · Reports · Audit Trail · Administration screens')] }),
  pageBreak(),
]

const intro = [
  h1('1. What the Platform Does'),
  p('The PE Sub Platform replaces the manual monthly routine of downloading agent Borrowing Base certificates, matching investor names in Excel, and rebuilding the Shadow Borrowing Base by hand. You upload the agent\'s file; the platform reads it, matches the investors against the LP Master, lets you review anything uncertain, and calculates UBS\'s own Shadow BB — with every decision recorded in the audit trail.'),
  h2('1.1 Your role'),
  tbl(
    ['Role', 'What you do in the platform'],
    [
      ['Analyst', 'Day-to-day work: upload Agent BBs, review extractions, resolve the match queue, assign LP classifications and rates, run the Shadow BB, maintain the LP Master, and manage configuration (rates, rules, mappings, thresholds, templates)'],
      ['Account/Transaction Manager', 'Review authority: the accuracy (4-eye) check on completed Shadow BBs, ability to act on any submission, and full cross-facility audit visibility. Configuration screens are view-only for this role'],
    ]
  ),
  p('You sign in with your UBS credentials; your role determines what you can edit. If a button or screen appears disabled, it is outside your role\'s permissions.'),
  h2('1.2 The three classification concepts — keep them apart'),
  tbl(
    ['Concept', 'What it is', 'Example values'],
    [
      ['Agent LP Classification', 'The agent bank\'s own category label, read straight from their certificate', 'Rated Included · Non-Rated Included · Designated PWM'],
      ['UBS LP Classification', 'UBS\'s advance-rate tier, set by you or derived by the platform', 'Rated · Unrated >2bn · Unrated 1–2bn · Eligible · Excluded'],
      ['Investor Type', 'The investor\'s industry profile', 'Pension · Sovereign Wealth Fund · Endowment · HNW'],
    ]
  ),
  pageBreak(),
]

const workflow = [
  h1('2. The Monthly Workflow at a Glance'),
  tbl(
    ['Step', 'Screen', 'What happens'],
    [
      ['1. Certificate arrives', '—', 'You download the agent\'s BB certificate from the deal site (SyndTrak, Intralinks, Debt Domain) as today'],
      ['2. Upload', 'Upload wizard', 'Select the facility, drop the file in. The platform reads it in the background — you can keep working'],
      ['3. Review extraction', 'Upload wizard — step 3', 'Check the recognised columns and extracted rows; map any unrecognised column with two clicks'],
      ['4. Review matches', 'Upload wizard — step 4', 'Confirm how extracted investor names line up with the LP Master; accept, reject or manually name each queued match'],
      ['5. Classify & commit', 'Upload wizard — step 5', 'Assign or confirm each LP\'s UBS classification and rate; commit your decisions to the LP Master'],
      ['6. Run Shadow BB', 'Run Shadow BB', 'When a credit decision requires it, run the calculation. The facility moves to Active once the run is accepted'],
      ['7. Report & review', 'Reports / Shadow BB', 'Generate outputs; the Account/Transaction Manager performs the accuracy review'],
    ]
  ),
  tip('A Shadow BB run is only needed when a credit decision is required — renewal, amendment, or new origination. For a routine monthly receipt, committing your decisions at step 5 updates the LP Master and you can stop there.'),
  h2('2.1 Facility statuses'),
  tbl(
    ['Status', 'Meaning'],
    [
      ['Not Started', 'No submission processed for this cycle'],
      ['In Progress', 'An Agent BB is uploaded and being worked through the wizard'],
      ['Needs Review', 'Unresolved matches or eligibility issues need your attention'],
      ['Active', 'The Shadow BB has been completed and accepted for this cycle'],
    ]
  ),
  pageBreak(),
]

const dashboard = [
  h1('3. Dashboard'),
  p('The Dashboard is your landing page: portfolio KPI cards, the facility list with status chips, and the recent-activity feed. Each facility row carries a shortcut button that takes you to the right place for its current state — resume an in-progress wizard, open the match queue, or view the latest Shadow BB.'),
  bullet('Use the status chips to see at a glance which facilities still need work this cycle'),
  bullet('The activity feed mirrors the audit trail\'s most recent events — uploads, runs, reclassifications'),
  pageBreak(),
]

const lpMaster = [
  h1('4. LP Master'),
  p('The LP Master is UBS\'s authoritative record of every Limited Partner, per facility: identity, classification, ratings, financial scale, commitment and uncalled figures, and borrowing-base values. It is the yardstick every agent certificate is matched against, so its quality drives everything downstream.'),
  h2('4.1 Finding and reading records'),
  bullet('Search by investor name; filter by facility or classification; results are paginated'),
  bullet('Click a row to open the detail overlay — field groups for Identity, Classification, Ratings, Financial Scale, Commitments, Uncalled and Borrowing Base, plus the record\'s change history'),
  h2('4.2 Editing'),
  bullet('Editable fields include UBS classification (with a mandatory rationale — this is a reclassification and is audit-logged), classification tag, Agent BB value, the Included flag, the recallable-distribution flag, and notes'),
  bullet('Financial figures (commitments, uncalled) normally update through certificate ingestion, not by hand'),
  bullet('AUM and ratings are researched manually (Pitchbook, rating-agency sites) and entered by the LP Master maintainers'),
  h2('4.3 Including and excluding LPs'),
  p('The Included flag controls whether an LP counts in UBS BB aggregates. Excluding an LP does not delete anything — the record and its history stay in place, so the audit trail is preserved. There is no delete button; exclusion is the correct way to retire an LP from calculations.'),
  tip('New LPs are not typed in by hand. They enter the LP Master through the upload wizard when you accept a "new LP" match — this keeps every record traceable to an agent certificate.'),
  pageBreak(),
]

const wizard = [
  h1('5. Uploading an Agent BB — the Wizard'),
  h2('5.1 Step 1–2 · Select facility and upload'),
  bullet('Pick the facility, the agent bank and the period, then drop the certificate file (Excel or CSV, up to 50 MB)'),
  bullet('The upload returns immediately; parsing happens in the background. The submission shows "Processing" until it is ready for review — typically seconds'),
  bullet('If the platform cannot process the file at all, the submission shows an error state instead; see §10 Troubleshooting'),
  h2('5.2 Step 3 · Review Extraction'),
  p('The platform shows which template it recognised, where it found the table (sheet and header row), the column-to-field mapping, and every extracted LP row with a per-row confidence score. Rows the engine is unsure about are flagged for review.'),
  bullet('Unrecognised columns are listed separately. To fix one, choose the matching canonical field — the mapping is remembered for every future upload from that bank, and the file re-reads immediately'),
  bullet('Columns you do not need can be discarded; totals and derived columns are shown for cross-checking but are never written to the LP Master'),
  bullet('If the wrong template was recognised, you can force a re-read against the correct one'),
  h2('5.3 Step 4 · Review Matches'),
  p('Every extracted investor name is scored against the LP Master. High-confidence matches are accepted automatically; the rest wait in the match queue for your decision.'),
  tbl(
    ['Queue decision', 'When to use it'],
    [
      ['Accept', 'The suggested LP Master record is the same investor'],
      ['Reject', 'The suggestion is wrong and no other record fits'],
      ['Manual', 'You know the right master name — type it to link the row yourself'],
      ['New LP', 'The investor genuinely is not in the LP Master yet; accepting creates it on commit'],
    ]
  ),
  bullet('The match analysis panel shows why the algorithm scored a pair the way it did — the name normalisation steps and the component scores — so you can decide quickly'),
  bullet('Match decisions are recorded with your name and timestamp'),
  h2('5.4 Step 5 · LP Classification & Rate Assignment'),
  p('The final step shows every LP with its Agent classification (as extracted) and its UBS classification and rate. Confirm or override classifications — the platform suggests UBS tiers from the agent\'s labels and rates where it can. Committing your decisions writes the records to the LP Master; re-committing the same facility and investor updates rather than duplicates.'),
  tip('Committing decisions and running the Shadow BB are separate actions. Commit updates the LP Master; the Shadow BB snapshot is only created when you run it (step 6) — so the Shadow BB screen stays empty until a run exists.'),
  h2('5.5 Aborting'),
  p('Abort a submission (before completion) to discard its file, extraction results and pending queue entries. The facility returns to its prior status if nothing else is active. Aborts are audit-logged.'),
  pageBreak(),
]

const shadowBb = [
  h1('6. Running and Reading the Shadow BB'),
  h2('6.1 Running'),
  bullet('From the wizard (or the facility), choose Run Shadow BB when a credit decision requires one'),
  bullet('The run applies UBS advance rates and concentration limits to every included LP, computes each LP\'s UBS BB contribution, portfolio totals, the effective advance rate, and the delta against the agent\'s figures'),
  bullet('A run either completes fully or not at all — you can never see a half-updated result. Accepted runs move the facility to Active and stamp the run time'),
  h2('6.2 The Shadow BB screen'),
  p('The screen shows the latest run as a full LP grid — the complete record per row: identity, both classifications, ratings, size, both rates, commitment and uncalled figures, both concentration limits, excess concentration, Agent BB and UBS BB. Rows keep the same order as the agent\'s original file, so you can reconcile side-by-side against the certificate.'),
  bullet('Toggle an LP\'s Included flag to see aggregates with and without it; every toggle is audit-logged'),
  bullet('The delta between Agent BB and UBS BB is visible at portfolio level and per LP; classification differences are the usual driver'),
  bullet('Historical runs are accessed from Reports, not from this screen — the Shadow BB screen always shows the latest position'),
  h2('6.3 Where the numbers come from'),
  p('Calculations use the exact dollar amounts read from the agent\'s certificate — not the rounded display labels you see on screen ("$12.3M"). What you see is a readable summary; what is computed is precise.'),
  pageBreak(),
]

const reports = [
  h1('7. Reports'),
  bullet('Collateral & Coverage — the BB certificate view of a Shadow BB run; you can report on the latest run or any historical snapshot'),
  bullet('Concentration Exposures — the breach list from the latest run'),
  bullet('Effective Advance Rate history — how the facility\'s EAR has moved across runs'),
  bullet('Agent Bank Exposure — UBS exposure aggregated by agent bank across the portfolio'),
  bullet('LP Master export — the full 35-field CSV, one row per LP'),
  p('Each generated report is recorded in the Report History table with the report type, facility, snapshot, format and who generated it — so a report can always be traced back to the exact run it came from.'),
  pageBreak(),
]

const audit = [
  h1('8. Audit Trail'),
  p('Every material action writes an audit entry under the name of the signed-in user: uploads, aborts, re-extractions, match confirmations, Shadow BB runs, LP reclassifications and data updates, configuration changes, field-mapping changes, exports and logins.'),
  bullet('Filter by event type or user, search free text, and page through history'),
  bullet('Analysts see their own facilities; Account/Transaction Managers see all facilities'),
  bullet('Reclassifications always carry the rationale you entered — write it for the reviewer, not for yourself'),
  pageBreak(),
]

const adminScreens = [
  h1('9. Administration Screens (Analyst-Only)'),
  p('Four screens control how the platform behaves. All changes take effect immediately, apply platform-wide, and are audit-logged. Account/Transaction Managers can view these screens but not edit them.'),
  h2('9.1 Configuration'),
  bullet('BUSA and Agent advance-rate schedules by classification tier'),
  bullet('Eligibility rules (toggle active/inactive) and concentration limits'),
  bullet('Global settings (e.g. snapshot frequency, audit retention)'),
  h2('9.2 Field Mapping'),
  bullet('The dictionary that turns agent column headers into platform fields — core aliases are read-only; custom aliases can be added, edited, or removed, optionally scoped to one bank'),
  bullet('Mappings you create inline during upload (step 3) appear here too'),
  h2('9.3 Match Thresholds'),
  bullet('The auto-accept threshold, review band and reject threshold for name matching, plus algorithm weights, legal-suffix rules and the abbreviation dictionary'),
  bullet('Raising the auto-accept threshold sends more matches to the queue (safer, slower); lowering it auto-accepts more (faster, riskier). Change deliberately'),
  h2('9.4 BB Templates'),
  bullet('The registry of known agent certificate layouts. New templates are onboarded by importing a completed template-import workbook — no IT release required'),
  bullet('A template records which sheet and header row to read, rows to skip, classification group headers, and tab layout for multi-tab workbooks'),
  tip('If uploads from a bank keep producing unrecognised columns or wrong tables, the fix is almost always here: correct the template entry or add the missing aliases, then re-extract the submission.'),
  pageBreak(),
]

const troubleshooting = [
  h1('10. Troubleshooting & FAQ'),
  tbl(
    ['Symptom', 'What it means / what to do'],
    [
      ['Upload shows "Error" instead of moving to review', 'The document reader could not process the file. Check it is a genuine XLSX/XLS/CSV under 50 MB and try again; if it persists, contact support — the platform logs the reason'],
      ['Template not recognised', 'The certificate layout is not in the template registry. Force the correct template on re-extract, or onboard the layout via BB Templates'],
      ['Column shows as unrecognised', 'The agent used a header the dictionary hasn\'t seen. Map it once in step 3 — future uploads from that bank map automatically'],
      ['An investor matched to the wrong LP', 'Reject the match in the queue and use Manual to point it at the right master record. If it auto-accepted wrongly, correct the LP record and consider raising the auto-accept threshold'],
      ['Shadow BB screen is empty', 'No run exists yet for this facility. Committing wizard decisions updates the LP Master but does not create a snapshot — run the Shadow BB'],
      ['My numbers differ from the agent\'s', 'That is the point — the delta reflects UBS\'s own rates, limits and eligibility. Check per-LP classification differences first; they drive most variance'],
      ['I can\'t edit a configuration screen', 'Configuration is Analyst-only; Account/Transaction Managers have view-only access'],
      ['An LP should no longer count', 'Set its Included flag off. Do not look for a delete — exclusion preserves the audit history'],
    ]
  ),
  h2('10.1 Glossary (quick reference)'),
  tbl(
    ['Term', 'Meaning'],
    [
      ['Agent BB / certificate', 'The agent bank\'s monthly borrowing base spreadsheet'],
      ['Shadow BB', 'UBS\'s independent recalculation under its own rules'],
      ['Delta', 'Agent BB minus UBS Shadow BB'],
      ['Uncalled capital', 'The portion of an LP\'s commitment not yet called — the collateral'],
      ['Advance rate', 'The percentage of eligible uncalled capital counted in the BB, by tier'],
      ['Concentration limit', 'Cap on one LP\'s contribution, measured against total uncalled capital'],
      ['Match queue', 'Extracted names awaiting your accept/reject/manual decision'],
      ['Included flag', 'Whether an LP counts in UBS aggregates; the soft alternative to deletion'],
      ['Snapshot', 'A saved, unchangeable record of one Shadow BB run'],
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
      ...intro,
      ...workflow,
      ...dashboard,
      ...lpMaster,
      ...wizard,
      ...shadowBb,
      ...reports,
      ...audit,
      ...adminScreens,
      ...troubleshooting,
    ],
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync(OUT, buffer)
console.log(`Written: ${OUT}`)
console.log('  Sections: Cover, What the Platform Does, Monthly Workflow, Dashboard, LP Master, Upload Wizard, Shadow BB, Reports, Audit Trail, Administration, Troubleshooting & FAQ')
