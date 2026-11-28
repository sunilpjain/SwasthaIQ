import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { IST_OFFSET_MS, shortDate, type SummaryDocument, type SummarySection } from '@swasthyaiq/shared';

/**
 * A4 consultation summary with the prescription (DIG-72, layout DIG-29). Server-rendered with
 * embedded, subset fonts: Noto Sans (Latin), Noto Sans Gujarati and Noto Sans Devanagari for the
 * instruction lines, Dancing Script for the auto-generated signature.
 */

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');
const FONTS = {
  Sans: 'NotoSans-Regular.ttf',
  SansBold: 'NotoSans-Bold.ttf',
  Guj: 'NotoSansGujarati-Regular.ttf',
  Deva: 'NotoSansDevanagari-Regular.ttf',
  Sign: 'DancingScript-Bold.ttf',
} as const;
type FontName = keyof typeof FONTS;

const COLOR = {
  primary: '#0A4F96',
  primaryContainer: '#DCEAF9',
  text: '#1A1C20',
  muted: '#44474F',
  line: '#C4C6D0',
  watermark: '#9AA0AC',
};

const PAGE = { width: 595.28, height: 841.89, margin: 40, footer: 36 };
const BODY = 11.5;

export const WATERMARK = 'SAMPLE — not a valid prescription';
export const PROTOTYPE_NOTE = 'Prototype · synthetic data · not for clinical use';

export interface RenderOptions {
  /** DIG-73: the doctor reworded text for this printout only. */
  printCopyEdited?: boolean;
}

type Pdf = InstanceType<typeof PDFDocument>;

/** Characters Noto Sans has no glyph for, swapped for ones it has. */
export function pdfSafe(text: string): string {
  return text.replace(/→/g, '–');
}

/** Splits text into runs by script, so Gujarati and Devanagari get their own fonts. */
export function scriptRuns(text: string, base: FontName): { font: FontName; text: string }[] {
  const out: { font: FontName; text: string }[] = [];
  for (const m of text.matchAll(/[઀-૿]+|[ऀ-ॿ]+|[^ऀ-ॿ઀-૿]+/g)) {
    const t = m[0];
    const font: FontName = /[઀-૿]/.test(t) ? 'Guj' : /[ऀ-ॿ]/.test(t) ? 'Deva' : base;
    out.push({ font, text: t });
  }
  return out;
}

function write(
  pdf: Pdf,
  text: string,
  o: { font?: FontName; size?: number; color?: string; x?: number; width?: number; gap?: number } = {},
): void {
  const runs = scriptRuns(pdfSafe(text), o.font ?? 'Sans');
  const x = o.x ?? PAGE.margin;
  const width = o.width ?? PAGE.width - PAGE.margin - x;
  pdf.fillColor(o.color ?? COLOR.text).fontSize(o.size ?? BODY);
  runs.forEach((r, i) => {
    pdf.font(r.font);
    const continued = i < runs.length - 1;
    if (i === 0) pdf.text(r.text, x, pdf.y, { width, continued, lineGap: 1.5 });
    else pdf.text(r.text, { continued, lineGap: 1.5 });
  });
  if (o.gap) pdf.moveDown(o.gap);
}

function measure(pdf: Pdf, text: string, width: number, font: FontName = 'Sans', size = BODY): number {
  pdf.font(font).fontSize(size);
  return pdf.heightOfString(text, { width, lineGap: 1.5 });
}

const bottom = () => PAGE.height - PAGE.margin - PAGE.footer;

function ensureRoom(pdf: Pdf, needed: number): void {
  if (pdf.y + needed > bottom()) pdf.addPage();
}

function istStamp(iso: string): string {
  const d = new Date(Date.parse(iso) + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  return `${shortDate(d.toISOString(), true)}, ${time}`;
}

const SPECIALTY = { gastro: 'Surgical Gastroenterology', eye: 'Ophthalmology' } as const;

function header(pdf: Pdf, doc: SummaryDocument): void {
  const m = PAGE.margin;
  // Placeholder logo: a filled circle with the initial.
  pdf.circle(m + 18, m + 18, 18).fill(COLOR.primary);
  pdf
    .font('SansBold')
    .fontSize(18)
    .fillColor('#FFFFFF')
    .text('A', m, m + 5, { width: 36, align: 'center' });
  pdf
    .font('SansBold')
    .fontSize(18)
    .fillColor(COLOR.primary)
    .text(doc.clinic, m + 46, m + 6);

  const right = PAGE.width - m - 260;
  pdf
    .font('SansBold')
    .fontSize(13)
    .fillColor(COLOR.text)
    .text(doc.doctor.name, right, m, { width: 260, align: 'right' });
  const sub = [doc.doctor.qualifications, doc.doctor.specialty ? SPECIALTY[doc.doctor.specialty] : null]
    .filter(Boolean)
    .join(' · ');
  if (sub)
    pdf
      .font('Sans')
      .fontSize(10)
      .fillColor(COLOR.muted)
      .text(sub, right, pdf.y, { width: 260, align: 'right' });
  pdf.font('Sans').fontSize(8.5).fillColor(COLOR.muted).text(doc.doctor.registration, right, pdf.y, {
    width: 260,
    align: 'right',
  });

  const y = Math.max(pdf.y, m + 40) + 10;
  pdf
    .moveTo(m, y)
    .lineTo(PAGE.width - m, y)
    .lineWidth(1)
    .strokeColor(COLOR.primary)
    .stroke();

  // Patient row: name, age/sex, date. No token number (DIG-29).
  const barY = y + 8;
  pdf.roundedRect(m, barY, PAGE.width - 2 * m, 26, 4).fill(COLOR.primaryContainer);
  pdf.font('SansBold').fontSize(12).fillColor(COLOR.text);
  pdf.text(`${doc.patient.name} · ${doc.patient.ageSex} · ${doc.patient.date}`, m + 10, barY + 6, {
    width: PAGE.width - 2 * m - 20,
  });
  pdf
    .font('SansBold')
    .fontSize(10)
    .fillColor(COLOR.primary)
    .text('CONSULTATION SUMMARY', m + 10, barY + 8, {
      width: PAGE.width - 2 * m - 20,
      align: 'right',
    });
  pdf.y = barY + 40;
}

function sectionTitle(pdf: Pdf, title: string): void {
  ensureRoom(pdf, 44);
  pdf.font('SansBold').fontSize(10).fillColor(COLOR.primary).text(title.toUpperCase(), PAGE.margin, pdf.y, {
    characterSpacing: 0.4,
  });
  pdf.moveDown(0.2);
}

function textSection(pdf: Pdf, s: SummarySection): void {
  if (!s.lines.length) return;
  sectionTitle(pdf, s.title);
  for (const line of s.lines) {
    ensureRoom(pdf, measure(pdf, line, PAGE.width - 2 * PAGE.margin - 12) + 2);
    pdf.font('Sans').fontSize(BODY).fillColor(COLOR.text).text('•', PAGE.margin, pdf.y, { continued: false });
    pdf.moveUp();
    write(pdf, line, { x: PAGE.margin + 12 });
  }
  pdf.moveDown(0.6);
}

function medicationSection(pdf: Pdf, s: SummarySection): void {
  const meds = s.medicines ?? [];
  if (!meds.length) return;
  sectionTitle(pdf, s.title);
  const m = PAGE.margin;
  const drugW = 205;
  const instX = m + drugW + 14;
  const instW = PAGE.width - m - instX;
  pdf.font('SansBold').fontSize(8.5).fillColor(COLOR.muted);
  pdf.text('DRUG (GENERIC · STRENGTH · FORM)', m, pdf.y, { width: drugW });
  pdf.moveUp();
  pdf.text('PATIENT INSTRUCTION', instX, pdf.y, { width: instW });
  pdf.moveDown(0.2);

  meds.forEach((med, i) => {
    const drug = `${i + 1}. ${med.drug}`;
    const extra = [med.taper ? `Taper: ${med.taper}` : null, med.local].filter(Boolean) as string[];
    const hDrug = measure(pdf, drug, drugW, 'SansBold', 12);
    const hInst =
      measure(pdf, med.instruction, instW) +
      extra.reduce((h, t) => h + measure(pdf, t, instW, scriptRuns(t, 'Sans')[0]?.font ?? 'Sans'), 0);
    ensureRoom(pdf, Math.max(hDrug, hInst) + 10);
    const top = pdf.y;
    pdf
      .moveTo(m, top)
      .lineTo(PAGE.width - m, top)
      .lineWidth(0.5)
      .strokeColor(COLOR.line)
      .stroke();
    pdf.y = top + 4;
    write(pdf, drug, { font: 'SansBold', size: 12, x: m, width: drugW });
    const afterDrug = pdf.y;
    pdf.y = top + 4;
    write(pdf, med.instruction, { x: instX, width: instW });
    for (const t of extra) write(pdf, t, { x: instX, width: instW, color: COLOR.muted });
    pdf.y = Math.max(afterDrug, pdf.y) + 4;
  });
  pdf
    .font('Sans')
    .fontSize(8.5)
    .fillColor(COLOR.muted)
    .text('Generic names only. Frequency is morning-noon-evening-night.', m, pdf.y);
  pdf.moveDown(0.8);
}

function signature(pdf: Pdf, doc: SummaryDocument): void {
  ensureRoom(pdf, 110);
  sectionTitle(pdf, 'Consultant');
  const x = PAGE.width - PAGE.margin - 240;
  const y = pdf.y;
  pdf
    .font('Sign')
    .fontSize(26)
    .fillColor(COLOR.primary)
    .text(doc.doctor.name, x, y, { width: 240, align: 'center' });
  pdf
    .moveTo(x + 20, pdf.y + 2)
    .lineTo(x + 220, pdf.y + 2)
    .lineWidth(0.5)
    .strokeColor(COLOR.line)
    .stroke();
  pdf.moveDown(0.3);
  const lines = [
    doc.doctor.name,
    doc.doctor.qualifications,
    doc.doctor.registration,
    doc.signedAt ? `Signed ${istStamp(doc.signedAt)}` : 'Draft — not signed',
  ].filter(Boolean) as string[];
  for (const l of lines) {
    pdf.font('Sans').fontSize(9).fillColor(COLOR.muted).text(l, x, pdf.y, { width: 240, align: 'center' });
  }
  pdf
    .font('Sans')
    .fontSize(8)
    .fillColor(COLOR.muted)
    .text('Auto-generated signature for the prototype.', PAGE.margin, y + 10, {
      width: x - PAGE.margin - 10,
    });
}

function decoratePages(pdf: Pdf, doc: SummaryDocument, o: RenderOptions): void {
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i);
    // Drawing below the bottom margin must not start a new page.
    const margins = { ...pdf.page.margins };
    pdf.page.margins = { ...margins, bottom: 0 };
    // Watermark on every page.
    pdf.save();
    pdf.rotate(-35, { origin: [PAGE.width / 2, PAGE.height / 2] });
    pdf.font('SansBold').fontSize(34).fillColor(COLOR.watermark).fillOpacity(0.18);
    pdf.text(WATERMARK, -150, PAGE.height / 2 - 20, {
      width: PAGE.width + 300,
      align: 'center',
      lineBreak: false,
    });
    pdf.restore();
    pdf.fillOpacity(1);

    const y = PAGE.height - PAGE.margin - 14;
    const left = [
      doc.status === 'signed' ? `Version ${doc.version}` : 'Draft — not signed',
      o.printCopyEdited ? 'print copy edited' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const w = PAGE.width - 2 * PAGE.margin;
    pdf
      .moveTo(PAGE.margin, y - 6)
      .lineTo(PAGE.width - PAGE.margin, y - 6)
      .lineWidth(0.5)
      .strokeColor(COLOR.line)
      .stroke();
    pdf.font('Sans').fontSize(8).fillColor(COLOR.muted);
    pdf.text(left, PAGE.margin, y, { width: w, align: 'left', lineBreak: false });
    pdf.text(PROTOTYPE_NOTE, PAGE.margin, y, { width: w, align: 'center', lineBreak: false });
    pdf.text(`Page ${i - range.start + 1} of ${range.count}`, PAGE.margin, y, {
      width: w,
      align: 'right',
      lineBreak: false,
    });
    pdf.page.margins = margins;
  }
}

/** Renders the summary to a PDF buffer. */
export function renderSummaryPdf(doc: SummaryDocument, o: RenderOptions = {}): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.margin, bottom: PAGE.margin + PAGE.footer, left: PAGE.margin, right: PAGE.margin },
    bufferPages: true,
    info: { Title: 'Consultation summary (sample)', Author: doc.clinic, Producer: 'SwasthyaIQ prototype' },
  });
  for (const [name, file] of Object.entries(FONTS)) pdf.registerFont(name, join(FONT_DIR, file));
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });

  header(pdf, doc);
  for (const s of doc.sections) {
    if (s.medicines) medicationSection(pdf, s);
    else textSection(pdf, s);
  }
  signature(pdf, doc);
  decoratePages(pdf, doc, o);
  pdf.end();
  return done;
}
