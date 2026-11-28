import type { InvestigationOrder, Specialty } from '../index';
import { IST_OFFSET_MS } from './time';

/**
 * Consult note fields (DIG-50). Each field is one consult_fields row, "section.key".
 * Keys match the seed visits where they overlap (complaint.chief_complaint, vitals.weight_kg,
 * plan.advice) so old and new visits read the same.
 */
export const FIELD = {
  complaint: 'complaint.chief_complaint', // chief complaint and history, one combined field
  pastMedical: 'history.past_medical',
  procedures: 'history.procedures',
  allergies: 'history.allergies',
  familySocial: 'history.family_social',
  bp: 'vitals.bp',
  pulse: 'vitals.pulse',
  temperature: 'vitals.temperature_f',
  weight: 'vitals.weight_kg',
  spo2: 'vitals.spo2',
  rbs: 'vitals.rbs',
  generalExam: 'exam.general',
  assessment: 'assessment.assessment',
  plan: 'plan.plan',
  advice: 'plan.advice',
} as const;

export type FieldKey = (typeof FIELD)[keyof typeof FIELD];

export function splitKey(key: string): { section: string; key: string } {
  const [section, k] = key.split('.') as [string, string];
  return { section, key: k };
}

/** Tap-to-add phrases above the general examination box ("NAD" = no abnormality detected). */
export const GENERAL_EXAM_CHIPS = [
  'Conscious, oriented',
  'Pallor',
  'Icterus',
  'Clubbing',
  'Cyanosis',
  'Lymphadenopathy',
  'Oedema',
  'NAD',
] as const;

/**
 * Appends a chip's phrase to free text ("Conscious, oriented" + "Pallor" →
 * "Conscious, oriented, pallor"). The doctor can edit the text freely afterwards.
 */
export function appendPhrase(text: string, phrase: string): string {
  const t = text.trimEnd();
  if (!t) return phrase;
  if (hasPhrase(t, phrase)) return text;
  const sep = /[.;:]$/.test(t) ? ' ' : ', ';
  const next =
    sep === ' ' ? phrase : phrase === 'NAD' ? phrase : phrase.charAt(0).toLowerCase() + phrase.slice(1);
  return `${t}${sep}${next}`;
}

/** True when the phrase is already in the text (whole words, any case). */
export function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(text);
}

/**
 * Common tests per specialty for the Plan → Investigations chips. A code means the result comes
 * back as a lab value with that code (so the patient summary can tell when it has arrived).
 */
export const INVESTIGATION_CHIPS: Record<Specialty, InvestigationOrder[]> = {
  gastro: [
    { testName: 'USG abdomen', testCode: null },
    { testName: 'LFT', testCode: 'ALT' },
    { testName: 'CBC', testCode: 'HB' },
    { testName: 'HbA1c', testCode: 'HBA1C' },
    { testName: 'Serum amylase', testCode: 'AMYLASE' },
    { testName: 'Serum lipase', testCode: 'LIPASE' },
    { testName: 'CECT abdomen', testCode: null },
  ],
  eye: [
    { testName: 'OCT macula', testCode: null },
    { testName: 'Fundus photo', testCode: null },
    { testName: 'Visual field', testCode: null },
    { testName: 'B-scan', testCode: null },
    { testName: 'HbA1c', testCode: 'HBA1C' },
    { testName: 'FBS', testCode: 'FBS' },
  ],
};

export function toggleInvestigation(
  list: InvestigationOrder[],
  test: InvestigationOrder,
): InvestigationOrder[] {
  const has = list.some((t) => t.testName.toLowerCase() === test.testName.toLowerCase());
  return has ? list.filter((t) => t.testName.toLowerCase() !== test.testName.toLowerCase()) : [...list, test];
}

export const FOLLOW_UP_OPTIONS = [
  { id: '1w', label: '1 week', days: 7 },
  { id: '2w', label: '2 weeks', days: 14 },
  { id: '1m', label: '1 month', days: 30 },
  { id: '3m', label: '3 months', days: 91 },
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function istDate(now: Date): Date {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Follow-up date (ISO) that many days after today in IST. */
export function followUpDate(days: number, now: Date): string {
  const d = istDate(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "In 2 weeks · Wed 9 Dec" (or "In 10 days · …" for a date picked another way). */
export function followUpLabel(iso: string, now: Date): string {
  const target = new Date(`${iso}T00:00:00Z`);
  const days = Math.round((target.getTime() - istDate(now).getTime()) / 86_400_000);
  const option = FOLLOW_UP_OPTIONS.find((o) => o.days === days);
  const when = option ? `In ${option.label}` : days === 1 ? 'Tomorrow' : `In ${days} days`;
  return `${when} · ${DAYS[target.getUTCDay()]} ${target.getUTCDate()} ${MONTHS[target.getUTCMonth()]}`;
}

export interface VitalSpec {
  key: FieldKey;
  label: string;
  unit: string;
  /** BP needs "/", so it gets the numbers-and-punctuation pad; the rest a plain number pad. */
  keyboard: 'number-pad' | 'decimal-pad' | 'numbers-and-punctuation';
  maxLength: number;
  placeholder: string;
}

export const VITALS: VitalSpec[] = [
  {
    key: FIELD.bp,
    label: 'BP',
    unit: 'mmHg',
    keyboard: 'numbers-and-punctuation',
    maxLength: 7,
    placeholder: '120/80',
  },
  { key: FIELD.pulse, label: 'Pulse', unit: '/min', keyboard: 'number-pad', maxLength: 3, placeholder: '—' },
  {
    key: FIELD.temperature,
    label: 'Temp',
    unit: '°F',
    keyboard: 'decimal-pad',
    maxLength: 5,
    placeholder: '—',
  },
  { key: FIELD.weight, label: 'Weight', unit: 'kg', keyboard: 'decimal-pad', maxLength: 5, placeholder: '—' },
  { key: FIELD.spo2, label: 'SpO₂', unit: '%', keyboard: 'number-pad', maxLength: 3, placeholder: '—' },
  { key: FIELD.rbs, label: 'RBS', unit: 'mg/dL', keyboard: 'number-pad', maxLength: 3, placeholder: '—' },
];

const RANGES: Partial<Record<FieldKey, [number, number]>> = {
  [FIELD.pulse]: [20, 250],
  [FIELD.temperature]: [90, 110],
  [FIELD.weight]: [1, 300],
  [FIELD.spo2]: [50, 100],
  [FIELD.rbs]: [20, 800],
};

/**
 * A gentle "check this value" for typos (e.g. pulse 820). Deterministic, warns only, never
 * blocks saving: the doctor decides.
 */
export function vitalWarning(key: FieldKey, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (key === FIELD.bp) {
    const m = /^(\d{2,3})\/(\d{2,3})$/.exec(v);
    if (!m) return 'Use systolic/diastolic, e.g. 120/80';
    const [sys, dia] = [Number(m[1]), Number(m[2])];
    if (sys < 50 || sys > 260 || dia < 20 || dia > 160 || dia >= sys) return 'Check this value';
    return null;
  }
  const range = RANGES[key];
  if (!range) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 'Numbers only';
  return n < range[0] || n > range[1] ? 'Check this value' : null;
}
