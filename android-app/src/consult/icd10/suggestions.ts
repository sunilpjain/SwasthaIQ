import type { Diagnosis, EyeSide, PatientCondition, Specialty, VisitSummary } from '@swasthyaiq/shared';
import { shortDate } from '../../patient/summary-view';
import type { DraftField } from '../draft-store';
import { eyeKey } from '@swasthyaiq/shared';
import { findCode } from './search';

/**
 * Suggested ICD-10 codes (DIG-100). Deterministic rules only, no AI: nothing is added to the
 * diagnosis list until the doctor taps a suggestion. Rule table drafted 27 Nov 2026 for the
 * doctors to review; keep every rule in this file with a test.
 */

export interface Suggestion {
  code: string;
  label: string;
  /** Why it's offered, shown under the code: "Open condition", "From exam: NS2 OS". */
  reason: string;
  eye: EyeSide | null;
}

export interface SuggestionInput {
  specialty: Specialty;
  fields: Record<string, DraftField>;
  conditions: PatientCondition[];
  visits: VisitSummary[];
  chosen: Diagnosis[];
  myUserId: string | null;
}

const MAX = 6;

const text = (f: Record<string, DraftField>, keys: string[]) =>
  keys
    .map((k) => f[k]?.value ?? '')
    .join(' \n ')
    .toLowerCase();

/** Gastro: words in complaint & history, assessment and per-abdomen findings. */
const GASTRO_TEXT = ['complaint.chief_complaint', 'assessment.assessment', 'gastro.per_abdomen'];

interface TextRule {
  code: string;
  reason: string;
  /** Every group needs at least one of its words present. */
  all: string[][];
}

export const GASTRO_RULES: TextRule[] = [
  {
    code: 'K21.9',
    reason: 'Epigastric burning / reflux',
    all: [
      ['epigastric', 'heartburn', 'retrosternal'],
      ['burning', 'reflux', 'heartburn', 'acid'],
    ],
  },
  { code: 'R10.13', reason: 'Epigastric pain', all: [['epigastric pain', 'epigastric tenderness']] },
  {
    code: 'K80.20',
    reason: 'Gallstones mentioned',
    all: [['gallstone', 'cholelithiasis', 'gall bladder stone', 'gallbladder stone']],
  },
  { code: 'K76.0', reason: 'Fatty liver mentioned', all: [['fatty liver', 'nafld']] },
  { code: 'K59.00', reason: 'Constipation mentioned', all: [['constipation']] },
  { code: 'R19.7', reason: 'Diarrhoea mentioned', all: [['diarrhoea', 'diarrhea', 'loose stools']] },
  { code: 'R13.10', reason: 'Difficulty swallowing', all: [['dysphagia', 'difficulty swallowing']] },
  { code: 'R17', reason: 'Jaundice mentioned', all: [['jaundice', 'icterus']] },
  { code: 'K40.90', reason: 'Inguinal hernia mentioned', all: [['inguinal hernia']] },
];

const EYE_CODE: Record<EyeSide, number> = { OD: 1, OS: 2, OU: 3 };

/** Per-eye code from a stem: H25.1 + OD → H25.11; H40.05 + OU → H40.053. */
const perEye = (stem: string, eye: EyeSide) => `${stem}${EYE_CODE[eye]}`;

function bothOrOne(od: boolean, os: boolean): EyeSide | null {
  if (od && os) return 'OU';
  if (od) return 'OD';
  if (os) return 'OS';
  return null;
}

/** Eye: findings already picked in the per-eye examination and IOP. */
function eyeRuleSuggestions(f: Record<string, DraftField>): Suggestion[] {
  const val = (side: 'OD' | 'OS', key: string) => (f[eyeKey(side, key)]?.value ?? '').trim();
  const out: Suggestion[] = [];

  const ns = (side: 'OD' | 'OS') => /\bNS\s?[1-4]\b/i.test(val(side, 'lens'));
  const nsEye = bothOrOne(ns('OD'), ns('OS'));
  if (nsEye)
    out.push({
      code: perEye('H25.1', nsEye),
      label: '',
      reason: `From exam: nuclear sclerosis ${nsEye}`,
      eye: nsEye,
    });

  const psc = (side: 'OD' | 'OS') => /\bPSC\b/i.test(val(side, 'lens'));
  const pscEye = bothOrOne(psc('OD'), psc('OS'));
  if (pscEye)
    out.push({ code: perEye('H25.04', pscEye), label: '', reason: `From exam: PSC ${pscEye}`, eye: pscEye });

  const high = (side: 'OD' | 'OS') => {
    const n = Number(val(side, 'iop'));
    return Number.isFinite(n) && n > 21 && n <= 80;
  };
  const iopEye = bothOrOne(high('OD'), high('OS'));
  if (iopEye)
    out.push({
      code: perEye('H40.05', iopEye),
      label: '',
      reason: `IOP above 21 mmHg ${iopEye}`,
      eye: iopEye,
    });

  return out;
}

export function suggestDiagnoses(input: SuggestionInput): Suggestion[] {
  const candidates: Suggestion[] = [];

  // 1. What's in this consult.
  if (input.specialty === 'eye') {
    candidates.push(...eyeRuleSuggestions(input.fields));
  } else {
    const t = text(input.fields, GASTRO_TEXT);
    for (const r of GASTRO_RULES) {
      if (r.all.every((group) => group.some((w) => t.includes(w)))) {
        candidates.push({ code: r.code, label: '', reason: r.reason, eye: null });
      }
    }
  }

  // 2. The patient's open conditions that carry a code.
  for (const c of input.conditions) {
    if (c.status !== 'resolved' && c.icd10Code) {
      candidates.push({ code: c.icd10Code, label: '', reason: `Open condition (${c.status})`, eye: null });
    }
  }

  // 3. This doctor's earlier coded diagnoses for the patient, newest first.
  for (const v of input.visits) {
    if (v.doctorId === input.myUserId && v.status === 'signed' && v.diagnosisCode) {
      candidates.push({
        code: v.diagnosisCode,
        label: '',
        reason: `Your diagnosis on ${shortDate(v.visitDate)}`,
        eye: null,
      });
    }
  }

  // Only valid codes from the bundled list, not already chosen, each once.
  const chosen = new Set(input.chosen.map((d) => d.icd10Code).filter(Boolean));
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const c of candidates) {
    const code = findCode(c.code);
    if (!code || chosen.has(code.code) || seen.has(code.code)) continue;
    seen.add(code.code);
    out.push({ ...c, code: code.code, label: code.title });
    if (out.length === MAX) break;
  }
  return out;
}
