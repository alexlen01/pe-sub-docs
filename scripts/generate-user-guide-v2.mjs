// Business-user guide aligned to Solution Design v3. Generates DOCX only.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, PageBreak,
  PageNumber, Packer, Paragraph, ShadingType, Table, TableCell, TableOfContents,
  TableRow, TextRun, WidthType,
} from 'docx'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'PE-Sub-Platform-User-Guide-v2.docx')
const C = { charcoal:'292929', dark:'454545', gray:'E7E6E6', pale:'F5F5F5', red:'C00000', paleRed:'FCE8E6', green:'2E7D32', paleGreen:'E8F3E8', amber:'9C6500', paleAmber:'FFF2CC', white:'FFFFFF', border:'B7B7B7' }

const tr = (text, opts={}) => new TextRun({ text, font:'Aptos', size:21, color:C.charcoal, ...opts })
const p = (text, opts={}) => new Paragraph({ spacing:{ after:105, line:285 }, ...opts, children:[tr(text)] })
const h1 = text => new Paragraph({ heading:HeadingLevel.HEADING_1, pageBreakBefore:true, keepNext:true, spacing:{ after:120 }, border:{ bottom:{ style:BorderStyle.SINGLE, size:10, color:C.red } }, children:[tr(text,{ size:31, bold:true })] })
const h2 = text => new Paragraph({ heading:HeadingLevel.HEADING_2, keepNext:true, spacing:{ before:220, after:80 }, children:[tr(text,{ size:25, bold:true, color:C.red })] })
const h3 = text => new Paragraph({ heading:HeadingLevel.HEADING_3, keepNext:true, spacing:{ before:160, after:60 }, children:[tr(text,{ size:22, bold:true, color:C.dark })] })
const bullet = text => new Paragraph({ bullet:{ level:0 }, spacing:{ after:60 }, children:[tr(text)] })
const step = text => new Paragraph({ numbering:{ reference:'steps', level:0 }, spacing:{ after:70 }, children:[tr(text)] })
const pageBreak = () => new Paragraph({ children:[new PageBreak()] })

function callout(label, text, kind='tip') {
  const palette = kind === 'warning' ? [C.paleAmber,C.amber] : kind === 'error' ? [C.paleRed,C.red] : [C.paleGreen,C.green]
  return new Paragraph({ shading:{ type:ShadingType.CLEAR, fill:palette[0] }, border:{ left:{ style:BorderStyle.THICK, size:14, color:palette[1] } }, indent:{ left:180 }, spacing:{ before:80, after:120 }, children:[tr(`${label}: `,{ bold:true, color:palette[1] }),tr(text,{ color:C.dark })] })
}
function cell(text, header=false, shade=false) {
  const upper=String(text).toUpperCase(); const status=upper.includes('BREACH')||upper.includes('DENIED')?C.paleRed:upper.includes('ACCEPTED')||upper.includes('ACTIVE')?C.paleGreen:upper.includes('WARNING')||upper.includes('REVIEW')?C.paleAmber:null
  return new TableCell({ shading:{ type:ShadingType.CLEAR, fill:header?C.charcoal:(status??(shade?C.pale:C.white)) }, margins:{ top:80,bottom:80,left:100,right:100 }, children:[new Paragraph({ spacing:{ after:0 }, children:[tr(String(text),{ size:18, bold:header, color:header?C.white:C.charcoal })] })] })
}
function table(headers, rows) {
  return new Table({ width:{ size:100,type:WidthType.PERCENTAGE }, borders:{ top:{style:BorderStyle.SINGLE,size:4,color:C.border},bottom:{style:BorderStyle.SINGLE,size:4,color:C.border},left:{style:BorderStyle.SINGLE,size:4,color:C.border},right:{style:BorderStyle.SINGLE,size:4,color:C.border},insideHorizontal:{style:BorderStyle.SINGLE,size:2,color:C.border},insideVertical:{style:BorderStyle.SINGLE,size:2,color:C.border} }, rows:[new TableRow({ tableHeader:true, children:headers.map(x=>cell(x,true)) }),...rows.map((row,i)=>new TableRow({ cantSplit:true, children:row.map(x=>cell(x,false,i%2===1)) }))] })
}

const cover = [
  new Paragraph({ spacing:{ before:1700,after:180 }, children:[tr('PE SUB PLATFORM',{ size:58,bold:true })] }),
  new Paragraph({ border:{ bottom:{ style:BorderStyle.THICK,size:24,color:C.red } }, spacing:{ after:220 }, children:[tr('Business User Guide',{ size:42,bold:true,color:C.red })] }),
  p('Version 2.0  ·  July 2026  ·  UBS Confidential'),
  p('For PE Sub Analysts and Account/Transaction Managers'),
  new Paragraph({ spacing:{ before:450,after:80 }, children:[tr('What this guide covers',{ size:24,bold:true,color:C.dark })] }),
  table(['Area','Coverage'],[
    ['Daily navigation','Dashboard, facility selection and workflow status'],
    ['Credit workflow','Upload, extraction review, LP matching, criteria assignment, Shadow BB and independent review'],
    ['Reference data','LP Master, field mappings, criteria and templates'],
    ['Outputs','Shadow BB results, concentration alerts, reports and audit trail'],
    ['Access','Analyst/Manager permissions and access-denied behavior'],
  ]),
  new Paragraph({ alignment:AlignmentType.CENTER, spacing:{ before:650 }, children:[tr('UBS CONFIDENTIAL',{ bold:true,color:C.red,size:17 })] }),
  pageBreak(),
  new Paragraph({ heading:HeadingLevel.HEADING_1, border:{ bottom:{style:BorderStyle.SINGLE,size:10,color:C.red} }, children:[tr('Contents',{size:31,bold:true})] }),
  new TableOfContents('Table of Contents',{ hyperlink:true,headingStyleRange:'1-3' }),
]

const content = [
  h1('1. Purpose of the Platform'),
  p('The PE Sub Platform helps UBS prepare and review an independent Shadow Borrowing Base for Private Equity subscription credit facilities. You upload an Agent Bank workbook, verify what was extracted, resolve investor identities, review UBS Lending criteria, run the calculation and complete an independent review. The platform retains the calculation snapshot and a record of material user actions.'),
  callout('Important','A Shadow BB is prepared when a credit decision is required—for example a renewal, amendment or new origination. It is not automatically required for every Agent BB received. There is no internally produced Shadow BB certificate artifact.'),
  h2('1.1 The three LP concepts'),
  table(['Concept','Meaning','Typical source'],[
    ['Agent LP Classification','The Agent Bank’s own category; preserved for comparison','Workbook column or section heading'],
    ['UBS LP Classification','The UBS Lending category that drives suggested advance rate and concentration limit','LP Master, criteria resolver and authorized override'],
    ['Investor Type','The LP’s business profile, such as pension, sovereign wealth or fund of funds','LP Master research and controlled derivation'],
  ]),
  callout('Do not combine them','These fields answer different questions. Never overwrite the Agent classification with the UBS classification.' ,'warning'),

  h1('2. Signing In and Access'),
  p('The target production service uses your UBS Intra ID identity. Your access is assigned outside the application through UBS onboarding and entitlement governance. The platform does not contain user or role administration.'),
  table(['Role','Primary responsibilities'],[
    ['Analyst (APP_ANALYST)','Upload and prepare owned submissions; maintain LP Master and global configuration; read colleagues’ work'],
    ['Account/Transaction Manager (APP_MANAGER)','Review across facilities; accept/reject completed work; reasoned overrides and ownership reassignment; full audit access; configuration is read-only'],
  ]),
  h2('2.1 What access messages mean'),
  table(['Message','Meaning','What to do'],[
    ['Sign-in required / 401','Your session or authentication is missing or expired','Use the approved sign-in/session recovery path'],
    ['Access denied / 403','You are signed in but your role, ownership or workflow state does not permit the action','Check submission owner/state; contact the Manager or entitlement support if unexpected'],
    ['Control disabled','The same permission is unavailable in the current UI context','Hover/read the guidance; do not attempt to bypass with another route'],
  ]),
  callout('Security','Buttons and menus help you understand access, but the server makes the final authorization decision.'),

  h1('3. End-to-End Workflow'),
  table(['Stage','Your action','System result'],[
    ['1. Select','Choose facility and credit period','Creates working context'],
    ['2. Upload','Add Agent BB and optional notes','Submission becomes Processing; work continues in background'],
    ['3. Review Extraction','Confirm template, mappings and extracted LP rows','Validated structured submission'],
    ['4. Review Matches','Accept/reject suggestions or select the correct LP','LP identities linked or approved as new'],
    ['5. Assign Criteria','Review classification, funding/rating basis, rates and limits','Submission-specific UBS decisions'],
    ['6. Run Shadow BB','Calculate and review KPIs and breaches','Append-only snapshot'],
    ['7. Submit for Review','Freeze the reviewed calculation version','Manager work item'],
    ['8. Accept or Reject','Manager records independent decision and rationale','Accepted → Active; rejected → actionable state'],
    ['9. Report','Open/export accepted reporting views','Report history entry'],
  ]),
  h2('3.1 Ownership'),
  p('The uploading user becomes the submission owner. Another Analyst may view the work but cannot change its workflow steps. A Manager may override or reassign ownership, but must provide a reason. Ownership is based on stable UBS identity, not the displayed name.'),

  h1('4. Dashboard and Facilities'),
  p('The Dashboard gives a portfolio view of facilities, status, latest Shadow BB measures and recent activity. Select a facility row to load its current context. Executive figures come from the latest persisted Shadow BB snapshot; a facility without a run displays an empty state rather than invented values.'),
  table(['Status','Interpretation','Typical action'],[
    ['Processing','Background inspection/extraction is running','Wait for completion; monitor unusually old processing'],
    ['Review','Operator review is required','Owner resumes extraction or matches'],
    ['Submitted for Review','Calculation awaits Manager decision','Manager opens review'],
    ['Rejected','Manager requested correction','Owner addresses rationale and resubmits'],
    ['Active / Accepted','Independent review completed for the accepted version','View reports or begin a later credit cycle'],
    ['Error / Aborted','Processing failed or authorized cancellation completed','Review error/correlation ID or start a new submission'],
  ]),
  callout('Facility administration','Production create/update/delete permissions remain deny-by-default until the business approves them. Facility status should normally change through the controlled workflow.','warning'),

  h1('5. Upload and Review Extraction'),
  h2('5.1 Upload'),
  step('Select the facility, Agent Bank and period.'),
  step('Drop or select the Agent BB workbook and add useful notes.'),
  step('Submit. The API returns immediately and displays Processing while parsing continues.'),
  p('The platform sanitizes the filename and uses a controlled template registry to interpret the workbook. Agent Bank and fund names are not hardcoded into extraction logic.'),
  h2('5.2 Document Recognition'),
  p('Review the recognized template, sheet/tab, header location and confidence. Recognition uses filename/title signals, structural keys and registered tab patterns. If recognition is ambiguous, an authorized operator can explicitly choose the correct template and re-extract.'),
  h2('5.3 Canonical Field Mapping'),
  table(['Indicator','Meaning'],[
    ['Mapped','Workbook heading is linked to a canonical LP field'],
    ['Unrecognized','Choose the correct canonical field or discard if irrelevant'],
    ['Derived','The workbook omitted the field; the parser calculated a cross-check from extracted inputs'],
    ['Confidence','Strength of extraction/mapping evidence; low confidence requires attention'],
  ]),
  p('Derived examples include Called Capital, percentage of commitments, concentration percentage and excess concentration. Derived values are clearly marked and never overwrite an Agent-supplied mapped value.'),
  h2('5.4 Extracted LP Rows'),
  bullet('Confirm LP row count and compare totals to the workbook.'),
  bullet('Check that group headings and total rows were not treated as LPs.'),
  bullet('For multi-tab workbooks, review each fund sleeve independently.'),
  bullet('Confirm commitments, uncalled capital, ratings, Agent rate and Agent concentration values.'),
  callout('Stop and correct','Do not continue to matching if the wrong template, tab, header or numeric scale was selected. Re-extract or remap first.','warning'),

  h1('6. Review LP Matches'),
  p('The system normalizes each extracted investor name and compares it with LP Master. High-confidence matches may be accepted automatically; borderline and missing matches appear in the queue.'),
  table(['Decision','Use when','Effect on commit'],[
    ['Accept suggested match','The extracted and master names identify the same LP','Links to existing LP Master identity'],
    ['Select another match','Search reveals a better existing LP','Links to the selected identity'],
    ['Reject / New LP','No existing LP represents this investor and source figures are verified','Creates a new LP Master identity through ingestion'],
  ]),
  bullet('Use comparison details and algorithm explanation; do not decide from score alone.'),
  bullet('Preserve the Agent workbook’s row order for reconciliation.'),
  bullet('A new LP must appear in the Agent BB and its figures must be verified. There is no separate local role-approval workflow for creation.'),
  callout('Avoid duplicates','Search spelling variants, abbreviations, parent organizations and prior names before approving a new LP.','warning'),

  h1('7. Classification, Rates and Limits'),
  p('The assignment screen shows each LP’s Agent values beside suggested UBS values. Suggested UBS defaults come from the Borrowing Base Criteria Matrix, not from a simple flat rate list.'),
  h2('7.1 What drives the suggestion'),
  table(['Input','How it is used'],[
    ['UBS LP Classification','Selects the criteria row'],
    ['Funding level','Below 40% or at least 40% funded selects the stage-specific advance rate'],
    ['Rating band','AAA, AA, A or BBB refines Rated Investor rate and concentration limit'],
    ['Total uncalled capital','Basis for the per-LP concentration cap'],
  ]),
  h2('7.2 Criteria quick reference'),
  table(['Classification','≥40% funded','<40% funded','LP concentration limit'],[
    ['Rated Investor','90% subject to rating band','Rating-band specific; BBB 65%','AAA 25% · AA 20% · A 15% · BBB 10%'],
    ['Corporate Pension >$5bn','90%','90%','25%'],
    ['Corporate Pension >$1bn','90%','90%','20%'],
    ['Unrated NAV >$1bn','90%','90%','15%'],
    ['FoF / Other >$10bn AUM','75%','65%','10%'],
    ['Other Institutional','65%','50%','5%'],
    ['HNW Feeder — acceptable','65%','50%','5%'],
    ['HNW — acceptable','50%','0%','1%'],
    ['Excluded','0%','0%','0%'],
  ]),
  p('You may override a suggested value when authorized. The override applies to the reviewed calculation version and must remain visibly distinct from the default. Finalized classification, UBS rate and concentration limit settle together into the LP Master through controlled write-back.'),
  callout('Evidence','Use notes/rationale for exceptions. Do not change a value simply to force an expected total.','warning'),

  h1('8. Run and Review the Shadow BB'),
  h2('8.1 Run'),
  step('Confirm all matches and UBS decisions are complete.'),
  step('Select Run Shadow BB.'),
  step('Review UBS BB, Agent BB, BB delta, eligible uncalled, concentration excess and effective advance rates.'),
  step('Review LP-level rows and all alert panels.'),
  step('Submit the exact calculation version for independent review.'),
  p('Calculations use exact stored decimal amounts, not rounded display labels such as “$12.3M”. Each successful run creates a new persisted snapshot; prior snapshots remain available to reporting.'),
  h2('8.2 Concentration alerts'),
  table(['Alert','Meaning','Required response'],[
    ['Breach — red','A configured limit was exceeded','Investigate and resolve or document/escalate before acceptance'],
    ['Warning — amber','Exposure is approaching a configured limit','Review and monitor; document material concerns'],
    ['No alert / accepted — green','No configured active rule breached','Continue normal review; this is not a substitute for judgment'],
  ]),
  bullet('Single LP, Top-10, unrated aggregate and non-US rules are calculated by the engine.'),
  bullet('The Pension Fund maximum is currently displayed/configured but is not yet an engine rule.'),
  callout('Unsaved changes','Persisted breach panels hide while local overrides are active because the stored verdict no longer matches the visible preview. Run again before relying on alerts.','warning'),

  h1('9. Manager Review'),
  p('The Manager reviews the submitted snapshot, source reconciliation, overrides, alerts and audit evidence. When no second reviewer is available, a Manager may approve or reject a Shadow BB they submitted themselves.'),
  table(['Decision','Manager action','Outcome'],[
    ['Accept','Confirm the reviewed version and record required rationale/evidence','Facility becomes Active; accepted reports are available'],
    ['Reject','Record clear correction rationale','Submission returns to an actionable state for the owner'],
    ['Override','Act on a non-owned workflow step with a reason','Action is applied and fully audited'],
    ['Reassign','Select a new Analyst owner and provide reason','Previous/new owner and Manager are audited'],
  ]),
  callout('Version control','If the Analyst changes inputs after review, a new calculation must be submitted. Do not accept a snapshot that is different from the one reviewed.','error'),

  h1('10. Shadow BB Results and Reports'),
  h2('10.1 Shadow BB Results'),
  p('Use facility and snapshot selectors to review the persisted result. LP rows show classification, uncalled capital, eligible uncalled, concentration excess, UBS and Agent rates, UBS and Agent BB and delta. The screen preserves Agent source ordering.'),
  h2('10.2 Reports'),
  table(['Report','Use'],[
    ['Collateral & Coverage','Accepted snapshot summary and optional LP detail'],
    ['Effective Advance Rates','Trend across persisted runs'],
    ['Agent Bank Exposure','UBS vs Agent BB aggregated by Agent Bank'],
    ['Concentration Exposures','Persisted breach verdict by facility and test'],
    ['Ad Hoc Reporting','Filtered LP-level analysis and XLSX export'],
    ['Scheduled Reports','Read-only view of system-managed report schedules'],
  ]),
  p('Successful generation is recorded in Report History. Verify facility, snapshot, as-of period and report options before distributing an export.'),

  h1('11. LP Master and Reference Data'),
  p('LP Master is the bank-wide reference for investor identity and finalized UBS credit profile. Facility LP records add facility-specific commitment, rank, rates, limits and BB outcomes.'),
  bullet('Search for an LP before treating an extracted name as new.'),
  bullet('Review Identity, Classification, Location, Ratings, Financial Scale, Commitment, Uncalled and Borrowing Base field groups.'),
  bullet('AUM and ratings may be researched through approved sources such as PitchBook and rating-agency sites; verify accuracy before saving.'),
  bullet('Excluding an LP preserves the record and history; deletion is not a substitute for a controlled status.'),
  callout('Precision','Readable money labels are summaries. Exact numeric values drive calculations.'),

  h1('12. Configuration, Mappings and Templates'),
  p('Analysts maintain global Lending configuration; Managers can view it. Every material configuration change is auditable.'),
  table(['Area','Purpose','Key caution'],[
    ['Borrowing Base Criteria Matrix','Suggested advance rates and per-LP concentration limits','Treat as controlled Lending policy; overrides do not redefine the matrix'],
    ['Concentration Limits','Portfolio breach/warning thresholds','Confirm labels/basis; missing rows fall back to defaults'],
    ['Field Mapping Dictionary','Workbook header aliases to canonical fields','Core aliases are read-only; Bank/User aliases use inline editing'],
    ['Match Thresholds','Auto-match/review/no-match bands','Changing thresholds changes review workload and risk'],
    ['BB Templates','Workbook structure and recognition signals','Import/profile representative workbook; never encode names in application logic'],
  ]),
  h2('12.1 Inline editing'),
  p('Click an editable Bank/User item to expand it in place. Enter or Save commits; cancel restores. Only one edit/add form opens at a time. Tooltips carry secondary provenance. Configuration JSON shown to users must contain only runtime fields—source attribution belongs in documentation.'),

  h1('13. Audit Trail'),
  p('Audit records answer who did what, to which facility/submission, when, with what outcome and—where required—why. Managers can view the complete trail; Analysts are scoped to events for owned submissions.'),
  bullet('Use event, user, facility and date filters to investigate a decision.'),
  bullet('Use correlation/transaction ID when working with support on a technical failure.'),
  bullet('Expect uploads, remaps, match commits, classifications, runs, overrides, reassignments, acceptance/rejection, configuration changes and exports to be represented.'),
  callout('Identity','Display names are for readability. Stable UBS identity is the audit and ownership key.'),

  h1('14. Visual Conventions'),
  table(['Visual','Meaning'],[
    ['Red','Breach, error, destructive action or denied access requiring attention'],
    ['Amber','Warning, pending review, derived or overridden value'],
    ['Green','Successful, accepted, active or included state'],
    ['Gray','Neutral, read-only/reference content and table structure'],
    ['Badge','Compact status or provenance: Derived, Calc, Core, Bank, User'],
  ]),
  p('The live application follows the approved prototype for visual presentation. The prototype is not a source of business logic or fallback production data.'),

  h1('15. Troubleshooting'),
  table(['Problem','Likely cause','Action'],[
    ['Submission remains Processing','Large workbook, queue pressure or downstream extraction problem','Wait briefly; refresh status; if unusually old, capture submission and correlation ID for support'],
    ['Wrong template recognized','Ambiguous workbook signals or unregistered variant','Choose correct registered template and re-extract; escalate repeat cases for registry improvement'],
    ['Missing/unrecognized column','New Agent heading or alias','Map to canonical field or discard only when genuinely irrelevant'],
    ['Unexpected LP match','Name variant, parent/sponsor ambiguity or duplicate candidate','Inspect comparison; search manually; do not accept score blindly'],
    ['Rate/limit differs from expectation','Funding band, rating band, classification or override differs','Review criteria basis and stored LP attributes before overriding'],
    ['Breach panel disappeared','Unsaved local override makes stored snapshot verdict stale','Save/run again before relying on the verdict'],
    ['No report data','No accepted/persisted snapshot for selected facility/period','Confirm run and Manager acceptance'],
    ['Access denied','Role, ownership or state does not permit action','Use Manager override/reassignment where appropriate or contact entitlement support'],
    ['Upload lost after environment restart','Current non-production pod-local upload limitation','Contact support; production durable-storage remediation is required'],
  ]),
  h2('15.1 Information to give support'),
  bullet('Facility, submission ID and effective period'),
  bullet('Screen and action attempted'),
  bullet('Displayed status/error and correlation/transaction ID'),
  bullet('Workbook/template name without sending sensitive data through an unapproved channel'),
  bullet('Whether the issue reproduces after refresh/sign-in recovery'),

  h1('Appendix A. Quick Checklist'),
  table(['Before submission for review','Manager review'],[
    ['Correct facility, Agent and period','Maker and checker are distinct'],
    ['Correct template/tab/header recognized','Exact submitted snapshot/version reviewed'],
    ['LP row count and totals reconciled','Overrides and reasons reviewed'],
    ['Unrecognized fields mapped/discarded appropriately','Red/amber alerts resolved or documented'],
    ['Matches reviewed; duplicates avoided','Agent vs UBS deltas understood'],
    ['UBS classification/rate/limit basis verified','Accept or reject with clear evidence'],
  ]),

  h1('Appendix B. Glossary'),
  table(['Term','Meaning'],[
    ['Agent BB','Agent Bank Borrowing Base workbook received from the facility agent'],
    ['BB','Borrowing Base'],
    ['EAR','Effective Advance Rate'],
    ['LP','Limited Partner whose uncalled commitment supports the facility'],
    ['LP Master','Bank-wide standardized LP identity and credit-profile reference'],
    ['Shadow BB','UBS independent Borrowing Base calculation'],
    ['Sleeve','Fund/tranche grouping calculated independently within some workbooks'],
    ['Override','Authorized departure from a suggested/default value; reason and audit evidence required'],
    ['Snapshot','Persisted version of a completed Shadow BB calculation'],
  ]),
]

const doc = new Document({
  creator:'UBS Credit Technology — PE Sub Finance', title:'PE Sub Platform — Business User Guide v2', description:'Business user guide aligned to Solution Design v3',
  styles:{ default:{ document:{ run:{ font:'Aptos',size:21,color:C.charcoal }, paragraph:{ spacing:{after:100} } } }, paragraphStyles:[
    { id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos Display',size:31,bold:true,color:C.charcoal},paragraph:{spacing:{before:250,after:100},keepNext:true,outlineLevel:0} },
    { id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos Display',size:25,bold:true,color:C.red},paragraph:{spacing:{before:210,after:80},keepNext:true,outlineLevel:1} },
    { id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos Display',size:22,bold:true,color:C.dark},paragraph:{spacing:{before:160,after:60},keepNext:true,outlineLevel:2} },
  ] },
  numbering:{ config:[{ reference:'steps',levels:[{level:0,format:'decimal',text:'%1.',alignment:AlignmentType.START,style:{paragraph:{indent:{left:540,hanging:260}}}}] }] },
  sections:[{ properties:{ page:{ margin:{top:900,right:850,bottom:850,left:850} } }, headers:{ default:new Header({children:[new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:4,color:C.red}},children:[tr('PE SUB PLATFORM  |  BUSINESS USER GUIDE v2',{size:15,bold:true,color:C.dark})]})]}) }, footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[tr('UBS Confidential  ·  ',{size:15,color:C.dark}),new TextRun({children:[PageNumber.CURRENT],font:'Aptos',size:15,color:C.dark})]})]})}, children:[...cover,...content] }],
})

writeFileSync(OUT, await Packer.toBuffer(doc))
console.log(`Generated ${OUT}`)
