// Generates the formal v3 Word deliverable from the living v3 Markdown source.
// Palette intentionally excludes blue: charcoal/gray structure, UBS red accents,
// green implemented/approved states, and red production gaps.

import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel,
  PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell,
  TableOfContents, TableRow, TextRun, WidthType,
} from 'docx'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = join(here, '..', 'PE-Sub-Platform-Solution-Design-v3.md')
const OUTPUT = join(here, '..', 'PE-Sub-Platform-Solution-Design-v3.docx')

const C = {
  charcoal: '292929', darkGray: '454545', gray: 'E6E6E6', lightGray: 'F4F4F4',
  midGray: 'B7B7B7', white: 'FFFFFF', red: 'C00000', paleRed: 'FCE8E6',
  green: '2E7D32', paleGreen: 'E8F3E8', amber: '9C6500', paleAmber: 'FFF2CC',
}

const clean = (s) => s
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\\\|/g, '|')

function runs(text, options = {}) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map(part => {
    if (part.startsWith('`')) return new TextRun({ text: part.slice(1, -1), font: 'Consolas', color: C.darkGray, ...options })
    if (part.startsWith('**')) return new TextRun({ text: part.slice(2, -2), bold: true, ...options })
    return new TextRun({ text: part, ...options })
  })
}

function statusFill(text) {
  const t = text.toUpperCase()
  if (t.includes('RED') || t.includes('GAP') || t.includes('BLOCKER')) return C.paleRed
  if (t.includes('GREEN') || t.includes('IMPLEMENTED') || t.includes('DECIDED')) return C.paleGreen
  if (t.includes('WARNING') || t.includes('PENDING')) return C.paleAmber
  return undefined
}

function makeCell(text, header = false, rowShade = false) {
  const fill = header ? C.charcoal : (statusFill(text) ?? (rowShade ? C.lightGray : C.white))
  const color = header ? C.white : (text.toUpperCase().includes('RED') ? C.red : text.toUpperCase().includes('GREEN') ? C.green : C.charcoal)
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      spacing: { after: 0 },
      children: runs(clean(text), { size: header ? 18 : 17, bold: header, color }),
    })],
  })
}

function makeTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: C.midGray },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: C.midGray },
      left: { style: BorderStyle.SINGLE, size: 4, color: C.midGray },
      right: { style: BorderStyle.SINGLE, size: 4, color: C.midGray },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: C.midGray },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: C.midGray },
    },
    rows: rows.map((row, ri) => new TableRow({
      tableHeader: ri === 0,
      cantSplit: true,
      children: row.map(value => makeCell(value, ri === 0, ri % 2 === 0)),
    })),
  })
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const children = []
  let i = 0
  let firstH1 = true
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      children.push(new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: C.lightGray },
        border: { left: { style: BorderStyle.THICK, size: 10, color: C.darkGray } },
        spacing: { before: 80, after: 120 },
        children: [new TextRun({ text: code.join('\n'), font: 'Consolas', size: 16, color: C.charcoal })],
      }))
      continue
    }

    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|[-:| ]+\|$/.test(lines[i + 1])) {
      const tableRows = []
      const split = value => value.slice(1, -1).split('|').map(v => v.trim())
      tableRows.push(split(line)); i += 2
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) tableRows.push(split(lines[i++]))
      children.push(makeTable(tableRows), new Paragraph({ spacing: { after: 120 } }))
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      if (level === 1 && firstH1) { firstH1 = false; i++; continue }
      if (level === 2 && children.length) children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        spacing: { before: level === 3 ? 180 : 260, after: 100 },
        border: level <= 2 ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.red } } : undefined,
        children: runs(clean(heading[2]), { color: level <= 2 ? C.charcoal : C.darkGray }),
      }))
      i++; continue
    }

    if (line.startsWith('> ')) {
      children.push(new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: C.paleRed },
        border: { left: { style: BorderStyle.THICK, size: 14, color: C.red } },
        spacing: { before: 80, after: 120 },
        indent: { left: 180 },
        children: runs(clean(line.slice(2)), { size: 19, italics: true, color: C.darkGray }),
      }))
      i++; continue
    }

    if (/^\d+\.\s+/.test(line) || /^-\s+/.test(line)) {
      const numbered = /^\d+\./.test(line)
      const text = line.replace(/^(?:\d+\.|-)\s+/, '')
      children.push(new Paragraph({
        numbering: numbered ? { reference: 'numbered', level: 0 } : undefined,
        bullet: numbered ? undefined : { level: 0 },
        spacing: { after: 55 },
        children: runs(clean(text), { size: 20, color: C.charcoal }),
      }))
      i++; continue
    }

    const para = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s|^>|^```|^\|.*\|$|^-\s+|^\d+\.\s+/.test(lines[i])) para.push(lines[i++].trim())
    children.push(new Paragraph({
      spacing: { after: 105, line: 290 },
      children: runs(clean(para.join(' ').replace(/  +/g, ' ')), { size: 20, color: C.charcoal }),
    }))
  }
  return children
}

const markdown = readFileSync(SOURCE, 'utf8')
const body = parseMarkdown(markdown)

const cover = [
  new Paragraph({ spacing: { before: 1600, after: 200 }, children: [new TextRun({ text: 'PE SUB PLATFORM', bold: true, size: 58, color: C.charcoal })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.THICK, size: 24, color: C.red } }, spacing: { after: 220 }, children: [new TextRun({ text: 'Solution Design v3', bold: true, size: 42, color: C.red })] }),
  new Paragraph({ spacing: { after: 500 }, children: [new TextRun({ text: 'Consolidated Business, Application, Data, Security and Azure Design', size: 25, color: C.darkGray })] }),
  makeTable([
    ['Document attribute', 'Value'],
    ['Version', '3.0'],
    ['Date', '10 July 2026'],
    ['Status', 'Consolidated Technical Design'],
    ['Classification', 'UBS Confidential'],
    ['Audience', 'Lending Technology · PE Subscription Finance · Credit Risk · Operations · Architecture · Security'],
  ]),
  new Paragraph({ spacing: { before: 700 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'UBS CONFIDENTIAL', bold: true, color: C.red, size: 18 })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.red } }, children: [new TextRun({ text: 'Contents', color: C.charcoal })] }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
]

const doc = new Document({
  creator: 'UBS Credit Technology — PE Sub Finance',
  title: 'PE Sub Platform — Solution Design v3',
  description: 'Consolidated technical design for the PE Subscription Borrowing Base Platform',
  styles: {
    default: { document: { run: { font: 'Aptos', size: 20, color: C.charcoal }, paragraph: { spacing: { after: 100 } } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: 'Aptos Display', size: 52, bold: true, color: C.charcoal } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Aptos Display', size: 31, bold: true, color: C.charcoal }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Aptos Display', size: 25, bold: true, color: C.red }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'numbered', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 540, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { margin: { top: 900, right: 850, bottom: 850, left: 850 } } },
    headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.red } }, children: [new TextRun({ text: 'PE SUB PLATFORM  |  SOLUTION DESIGN v3', bold: true, size: 15, color: C.darkGray })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'UBS Confidential  ·  ', size: 15, color: C.darkGray }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: C.darkGray })] })] }) },
    children: [...cover, ...body],
  }],
})

writeFileSync(OUTPUT, await Packer.toBuffer(doc))
console.log(`Generated ${OUTPUT}`)
