import {
  buildReview,
  dateRange,
  eyeLabel,
  lineSig,
  lineTitle,
  shortDate,
  type NoteField,
  type PrintCopyInput,
  type Sex,
  type Specialty,
  type SummaryDocument,
  type SummaryMedicine,
  type SummarySection,
  type VisitDetail,
} from '@swasthyaiq/shared';

export const CLINIC_NAME = 'Arihant Clinic';
export const MEDICATION_SECTION = 'medication-order';

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface SummaryPatient {
  fullName: string;
  ageYears: number;
  sex: Sex;
  allergies: string[];
}

export interface SummaryDoctor {
  displayName: string;
  specialty: Specialty | null;
  qualifications: string | null;
  registrationNo: string | null;
}

/**
 * The A4 consultation summary (DIG-29 layout) from the latest version of a visit. The sections
 * come from the same builder as the on-phone review, so both always agree.
 */
export function buildSummaryDocument(
  visit: VisitDetail,
  patient: SummaryPatient,
  doctor: SummaryDoctor,
): SummaryDocument {
  const fields: Record<string, NoteField> = {};
  for (const f of visit.fields) fields[`${f.section}.${f.key}`] = f;
  const review = buildReview({
    specialty: doctor.specialty ?? 'gastro',
    fields,
    diagnoses: visit.diagnoses,
    investigations: visit.investigations,
    followUp: visit.followUp,
    knownAllergies: patient.allergies,
    now: new Date(`${visit.visitDate}T06:30:00Z`), // noon IST on the visit day
  });

  const medicines: SummaryMedicine[] = visit.rxLines.map((l) => {
    const eye = eyeLabel(l.eye);
    const dates = dateRange(l.duration, visit.visitDate);
    return {
      id: l.id,
      drug: `${lineTitle(l)}${eye ? ` · ${eye}` : ''}`,
      instruction: [
        lineSig({ ...l, eye: null, route: l.route === 'eye' ? null : l.route }),
        dates,
        l.instructionsEn,
      ]
        .filter(Boolean)
        .join(' · '),
      taper: l.taper,
      local: l.instructionsLocal,
      localLanguage: l.instructionsLocal
        ? (l.instructionsLanguage as SummaryMedicine['localLanguage'])
        : null,
    };
  });

  const sections: SummarySection[] = [];
  for (const s of review.sections) {
    const id = slug(s.title);
    sections.push({ id, title: s.title, lines: s.lines.map((l) => l.text) });
    // DIG-29 order: … diagnosis → investigation order → medication order → plan, advice, follow-up.
    if (id === 'investigation-order') sections.push(medication(medicines));
  }
  if (medicines.length && !sections.some((s) => s.id === MEDICATION_SECTION)) {
    const at = sections.findIndex((s) => /plan|advice|follow-up|review-after/.test(s.id));
    sections.splice(at === -1 ? sections.length : at, 0, medication(medicines));
  }
  if (!medicines.length) {
    const i = sections.findIndex((s) => s.id === MEDICATION_SECTION);
    if (i !== -1) sections.splice(i, 1);
  }

  return {
    visitId: visit.id,
    version: visit.version,
    status: visit.status,
    clinic: CLINIC_NAME,
    doctor: {
      name: doctor.displayName,
      qualifications: doctor.qualifications,
      specialty: doctor.specialty,
      registration: `Reg. No. ${doctor.registrationNo ?? '00000'} (sample — not a real registration number)`,
    },
    patient: {
      name: patient.fullName,
      ageSex: `${patient.ageYears} ${patient.sex}`,
      date: shortDate(visit.visitDate, true),
    },
    sections,
    signedAt: visit.editedAt ?? visit.signedAt,
  };
}

function medication(medicines: SummaryMedicine[]): SummarySection {
  return { id: MEDICATION_SECTION, title: 'Medication order', lines: [], medicines };
}

export class PrintCopyMismatch extends Error {}

/**
 * Applies the doctor's print-copy edits (DIG-73) to a copy of the document. Only existing
 * sections and medicines can be reworded; nothing is added, and the visit is not changed.
 */
export function applyPrintCopy(doc: SummaryDocument, edits: PrintCopyInput): SummaryDocument {
  if (edits.version !== doc.version) throw new PrintCopyMismatch('version');
  const sections = doc.sections.map((s) => ({ ...s, medicines: s.medicines?.map((m) => ({ ...m })) }));
  for (const e of edits.sections) {
    const s = sections.find((x) => x.id === e.id);
    if (!s) throw new PrintCopyMismatch(`section ${e.id}`);
    s.lines = e.lines.map((l) => l.trim()).filter(Boolean);
  }
  const meds = sections.find((s) => s.id === MEDICATION_SECTION)?.medicines ?? [];
  for (const e of edits.medicines ?? []) {
    const m = meds.find((x) => x.id === e.id);
    if (!m) throw new PrintCopyMismatch(`medicine ${e.id}`);
    m.instruction = e.instruction.trim();
    m.local = e.local?.trim() || null;
    if (!m.local) m.localLanguage = null;
  }
  return { ...doc, sections };
}
