import type {
  CaptureSource,
  Diagnosis,
  InvestigationOrder,
  RxLineInput,
  Specialty,
} from '@swasthyaiq/shared';
import { shortDate } from '../patient/summary-view';
import { FIELD, followUpLabel, VITALS, vitalWarning } from './consult-fields';
import type { DraftField } from './draft-store';
import { EXAM_ROWS, EYE_FIELD, eyeKey, iopWarning, VISION_ROWS } from './eye-fields';
import { GASTRO_FIELD } from './gastro-fields';
import { lineSig, lineTitle } from './rx/rx-lines';

/**
 * The on-phone review before signing (DIG-95), in the DIG-29 summary order. Built from the draft
 * as plain data so it can be tested; the A4 PDF with the prescription is DIG-73.
 */

export interface ReviewLine {
  text: string;
  /** Shown as a badge when not typed (dictated / scanned values must be confirmed to sign). */
  source?: CaptureSource;
}

export interface ReviewSection {
  title: string;
  lines: ReviewLine[];
}

export interface ReviewInput {
  specialty: Specialty;
  fields: Record<string, DraftField>;
  diagnoses: Diagnosis[];
  investigations: InvestigationOrder[];
  /** The prescription (DIG-70). */
  rxLines?: RxLineInput[];
  followUp: string | null;
  knownAllergies: string[];
  now: Date;
}

export interface Review {
  sections: ReviewSection[];
  /** Stop signing until fixed (the API refuses too). */
  blocking: string[];
  /** Shown, never block: the doctor decides. */
  warnings: string[];
}

const ROLE = { primary: 'Primary', comorbidity: 'Co-morbidity' } as const;
const CERTAINTY = { provisional: 'Provisional', final: 'Final' } as const;

function line(fields: Record<string, DraftField>, key: string, label?: string): ReviewLine | null {
  const f = fields[key];
  const v = f?.value.trim();
  if (!f || !v) return null;
  return { text: label ? `${label}: ${v}` : v, ...(f.source !== 'typed' ? { source: f.source } : {}) };
}

function lines(...items: (ReviewLine | null)[]): ReviewLine[] {
  return items.filter((x): x is ReviewLine => x !== null);
}

export function diagnosisLine(d: Diagnosis): string {
  const code = d.kind === 'icd10' ? d.icd10Code : 'Misc';
  const tags = [d.eye, ROLE[d.role ?? 'comorbidity'], CERTAINTY[d.certainty ?? 'final']]
    .filter(Boolean)
    .join(' · ');
  return `${code} ${d.label} — ${tags}`;
}

function vitalsLine(fields: Record<string, DraftField>): ReviewLine | null {
  const parts = VITALS.map((v) => {
    const value = fields[v.key]?.value.trim();
    return value ? `${v.label} ${value} ${v.unit}` : null;
  }).filter(Boolean);
  return parts.length ? { text: parts.join(' · ') } : null;
}

function pair(fields: Record<string, DraftField>, key: string, label: string, unit = ''): ReviewLine | null {
  const od = fields[eyeKey('OD', key)]?.value.trim();
  const os = fields[eyeKey('OS', key)]?.value.trim();
  if (!od && !os) return null;
  return { text: `${label}: OD ${od || '—'}${unit} · OS ${os || '—'}${unit}` };
}

export function buildReview(input: ReviewInput): Review {
  const f = input.fields;
  const eye = input.specialty === 'eye';
  const allergy = [
    input.knownAllergies.length ? `Known: ${input.knownAllergies.join(', ')}` : 'No known allergies',
    f[FIELD.allergies]?.value.trim(),
  ].filter(Boolean) as string[];

  const sections: ReviewSection[] = [];
  const add = (title: string, l: ReviewLine[]) => {
    if (l.length) sections.push({ title, lines: l });
  };

  if (eye) add('Purpose of visit', lines(line(f, EYE_FIELD.purpose)));
  add(
    eye ? 'Main complaints & history' : 'Chief complaints & history of present illness',
    (f[FIELD.complaint]?.value ?? '')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({
        text,
        ...(f[FIELD.complaint]?.source !== 'typed' ? { source: f[FIELD.complaint]!.source } : {}),
      })),
  );
  add(
    'Health history',
    lines(line(f, FIELD.pastMedical, 'Past medical history'), line(f, FIELD.procedures, 'Procedures')),
  );
  add(
    'Allergy',
    allergy.map((text) => ({ text })),
  );
  add('Family & social history', lines(line(f, FIELD.familySocial)));

  if (eye) {
    add('Vision & refraction', lines(...VISION_ROWS.map((r) => pair(f, r.key, r.label))));
    const iop = pair(f, 'iop', 'IOP', ' mmHg');
    const how = [f[EYE_FIELD.iopMethod]?.value, f[EYE_FIELD.iopTime]?.value]
      .filter((x) => x?.trim())
      .join(', ');
    add('IOP', iop ? [{ text: how ? `${iop.text} (${how})` : iop.text }] : []);
    add(
      'Examination',
      lines(
        ...EXAM_ROWS.slice(0, 2).map((r) => pair(f, r.key, r.label)),
        line(f, EYE_FIELD.coverTest, 'Cover test'),
        ...EXAM_ROWS.slice(2).map((r) => pair(f, r.key, r.label)),
        line(f, EYE_FIELD.examNotes, 'Notes'),
      ),
    );
    const dil = f[EYE_FIELD.dilatation]?.value.trim();
    add(
      'Dilatation',
      dil ? [{ text: [dil, f[EYE_FIELD.dilatationDrug]?.value.trim()].filter(Boolean).join(' · ') }] : [],
    );
    add('Physical evaluation', lines(vitalsLine(f)));
  } else {
    add('Physical evaluation', lines(vitalsLine(f), line(f, FIELD.generalExam, 'General')));
    add(
      'Systemic examination',
      lines(
        line(f, GASTRO_FIELD.perAbdomen, 'Per abdomen'),
        line(f, GASTRO_FIELD.otherSystems, 'Other systems'),
        line(f, GASTRO_FIELD.alarmFeatures, 'Alarm features'),
      ),
    );
  }

  add(
    'Diagnosis (ICD-10)',
    input.diagnoses.map((d) => ({ text: diagnosisLine(d) })),
  );
  add('Assessment', lines(line(f, FIELD.assessment)));
  if (eye) {
    const surgery = [f[EYE_FIELD.surgeryEye]?.value.trim(), f[EYE_FIELD.surgeryIol]?.value.trim()].filter(
      Boolean,
    );
    add('Surgery plan', surgery.length ? [{ text: surgery.join(' · IOL: ') }] : []);
  }
  add(
    'Investigation order',
    input.investigations.map((t) => ({ text: t.testName })),
  );
  add(
    'Medication order',
    (input.rxLines ?? []).map((l) => ({ text: `${lineTitle(l)} — ${lineSig(l)}` })),
  );
  add(eye ? 'Action plan' : 'Plan', lines(line(f, GASTRO_FIELD.planType), line(f, FIELD.plan)));
  add('Advice', lines(line(f, FIELD.advice)));
  if (input.followUp) {
    add(eye ? 'Review after' : 'Follow-up', [
      { text: `${followUpLabel(input.followUp, input.now)} (${shortDate(input.followUp, true)})` },
    ]);
  }

  const blocking: string[] = [];
  if (input.diagnoses.length === 0) blocking.push('Add at least one diagnosis (ICD-10 or Misc).');
  const unconfirmed = Object.entries(f).filter(
    ([, v]) => v.source !== 'typed' && !v.confirmed && v.value.trim(),
  );
  if (unconfirmed.length)
    blocking.push(
      `Confirm ${unconfirmed.length} dictated or scanned value${unconfirmed.length === 1 ? '' : 's'}.`,
    );

  const warnings: string[] = [];
  if (!f[FIELD.complaint]?.value.trim()) warnings.push('No complaint or history written.');
  for (const v of VITALS) {
    const w = vitalWarning(v.key, f[v.key]?.value ?? '');
    if (w) warnings.push(`${v.label}: ${w}.`);
  }
  if (eye) {
    for (const side of ['OD', 'OS'] as const) {
      const w = iopWarning(f[eyeKey(side, 'iop')]?.value ?? '');
      if (w) warnings.push(`IOP ${side}: ${w}.`);
    }
  }
  if (!input.followUp) warnings.push(eye ? 'No review date set.' : 'No follow-up set.');

  return { sections, blocking, warnings };
}

/** "SIGN-NET" offline, "SIGN-503" from the server: a short code, never raw error text (state S9). */
export function signErrorCode(status: number, code: string): string {
  if (code === 'not_saved') return 'SIGN-SAVE';
  if (code === 'network' || status === 0) return 'SIGN-NET';
  return `SIGN-${status}`;
}
