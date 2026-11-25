import type { Eye, EyeSide } from '@swasthyaiq/shared';

/**
 * Eye section for Dr. Samradnyee (DIG-52), following her clinic's EMR order:
 * vision → IOP → examination. Screens always say OD / OS / OU.
 *
 * Storage keys keep the seed's convention (eye.re_iop, eye.le_fundus, eye.re_va_glasses…) so new
 * and old visits line up for trends; "re"/"le" never appear on screen.
 */

export type Side = 'OD' | 'OS';
const KEY_PREFIX: Record<Side, string> = { OD: 're', OS: 'le' };

/** Consult field key for one eye: eyeKey('OD', 'iop') → "eye.re_iop". */
export function eyeKey(side: Side, key: string): string {
  return `eye.${KEY_PREFIX[side]}_${key}`;
}

/** Fields that are not per eye. */
export const EYE_FIELD = {
  purpose: 'eye.purpose',
  iopMethod: 'eye.iop_method',
  iopTime: 'eye.iop_time',
  coverTest: 'eye.cover_test',
  examNotes: 'eye.exam_notes',
  dilatation: 'eye.dilatation',
  dilatationDrug: 'eye.dilatation_drug',
  surgeryEye: 'eye.surgery_eye',
  surgeryIol: 'eye.surgery_iol',
} as const;

export const PURPOSES = ['Consultation', 'Review', 'Pre-op', 'Post-op', 'Surgery'] as const;
export const IOP_METHODS = ['Applanation', 'NCT', 'iCare'] as const;
export const DILATATION = ['Not required', 'OD', 'OS', 'OU'] as const;
export const SIDES: Side[] = ['OD', 'OS'];

export interface TableRow {
  key: string;
  label: string;
  placeholder?: string;
  /** Quick options shown when a cell in this row is selected ("tap a cell, then an option"). */
  options?: string[];
}

/** Vision & refraction, OD and OS side by side. */
export const VISION_ROWS: TableRow[] = [
  { key: 'va_unaided', label: 'Unaided', placeholder: '6/12' },
  { key: 'va_glasses', label: 'With glasses', placeholder: '6/6' },
  { key: 'va_pinhole', label: 'Pinhole', placeholder: '6/6' },
  { key: 'near', label: 'Near', placeholder: 'N6' },
  { key: 'refraction', label: 'Refraction', placeholder: '−1.00 / −0.50 × 90' },
  { key: 'add', label: 'Add', placeholder: '+2.00' },
  { key: 'bcva', label: 'BCVA', placeholder: '6/6' },
];

/** Examination per eye, in the clinic's order. Cover test is one value for both eyes. */
export const EXAM_ROWS: TableRow[] = [
  { key: 'pupil', label: 'Pupil', options: ['RRR', 'Sluggish', 'Fixed', 'RAPD'] },
  { key: 'eye_movements', label: 'Eye movements', options: ['Full', 'Restricted'] },
  { key: 'lids', label: 'Lids', options: ['Normal', 'Ptosis', 'Swelling', 'Chalazion'] },
  { key: 'conjunctiva', label: 'Conjunctiva', options: ['Quiet', 'Congested', 'Pterygium'] },
  { key: 'cornea', label: 'Cornea', options: ['Clear', 'Haze', 'Opacity', 'Edema'] },
  { key: 'ac', label: 'AC', options: ['Normal depth', 'Shallow', 'Cells +', 'Flare +'] },
  { key: 'iris', label: 'Iris', options: ['Normal', 'Neovascularisation', 'Atrophy'] },
  { key: 'lens', label: 'Lens', options: ['Clear', 'NS1', 'NS2', 'NS3', 'PSC', 'Pseudophakia', 'Aphakia'] },
  {
    key: 'fundus',
    label: 'Fundus',
    options: ['Normal', 'CDR 0.3', 'CDR 0.4', 'CDR 0.6', 'CDR 0.8', 'DR changes'],
  },
];

export const COVER_TEST_OPTIONS = ['Ortho', 'Esophoria', 'Exophoria', 'Esotropia', 'Exotropia'];

/**
 * Eye tag chips above "Complaint and history": each tap starts a new complaint line tagged with
 * the eye ("OD: "), so every complaint says which eye it is about.
 */
export function addEyeTag(text: string, eye: EyeSide): string {
  const t = text.replace(/\s+$/, '');
  return t ? `${t}\n${eye}: ` : `${eye}: `;
}

/** Prescriptions are stored as RE / LE / BE; the doctor's view always shows OD / OS / OU. */
export function eyeLabel(eye: Eye | null): EyeSide | null {
  if (eye === 'RE') return 'OD';
  if (eye === 'LE') return 'OS';
  if (eye === 'BE') return 'OU';
  return null;
}

/** A per-eye IOP above this is flagged on screen (warning only, never blocks). */
export const IOP_HIGH_MMHG = 21;

export function iopWarning(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 'Numbers only';
  if (n < 3 || n > 80) return 'Check this value';
  return n > IOP_HIGH_MMHG ? 'Above 21 mmHg' : null;
}
