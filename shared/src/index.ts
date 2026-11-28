/**
 * Shared domain types for SwasthyaIQ (स्वास्थIQ) — Arihant prototype.
 * The API returns these shapes; the Android app and admin web consume them.
 * Keep this file free of runtime dependencies so it works in Node and React Native.
 */

export const PRODUCT_NAME = 'SwasthyaIQ';
export const PRODUCT_NAME_DEVANAGARI = 'स्वास्थIQ';
export const APP_DISPLAY_NAME = 'SwasthyaIQ · Arihant';
export const PROTOTYPE_BANNER = 'Prototype — not for clinical use';
export const RX_WATERMARK = 'SAMPLE — not a valid prescription';
export const SAMPLE_REG_NO_NOTE = 'sample — not a real registration number';

export const ROLES = ['doctor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const SPECIALTIES = ['gastro', 'eye'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

/** Where a consult-note field value came from (shown as a badge on every field). */
export const CAPTURE_SOURCES = ['dictated', 'scanned', 'typed'] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

/** not_arrived: appointment booked but not checked in. Doctors never see the token. */
export const QUEUE_STATUSES = ['not_arrived', 'waiting', 'in_consult', 'done'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const VISIT_STATUSES = ['draft', 'signed'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const LANGUAGES = ['en', 'mr', 'hi', 'gu'] as const;
export type Language = (typeof LANGUAGES)[number];

export const EYES = ['RE', 'LE', 'BE'] as const;
export type Eye = (typeof EYES)[number];

export type Sex = 'M' | 'F';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  specialty: Specialty | null;
  qualifications: string | null;
}

export interface Patient {
  id: string;
  token: string; // G1–G6, E1–E6
  fullName: string;
  ageYears: number;
  sex: Sex;
  guardianName: string | null;
  phone: string | null;
  primaryDoctorId: string;
  allergies: string[];
  /** Names of conditions that are not resolved (full detail is in PatientDetail.conditions). */
  conditions: string[];
}

export interface QueueEntry {
  patient: Patient;
  reason: string;
  status: QueueStatus;
  inConsultWithUserId: string | null;
  /** Display name of the doctor who has the patient open, e.g. "Dr. Saiyam Shah". */
  inConsultWithName: string | null;
  /** The patient's own doctor (whose queue they are booked in). */
  doctorName: string;
  /** Fictitious appointment time for today (ISO 8601), regenerated on every reset. */
  appointmentAt: string;
  /** Fictitious check-in time (ISO 8601); null while the patient has not arrived. */
  checkedInAt: string | null;
  /** Doctor-facing order: own patients first, then by appointment time. */
  isMine: boolean;
}

/** Response of "Reset queue" (doctor button, admin button, 2 am job). */
export interface QueueResetResult {
  reset: number;
}

export interface ConsultField {
  section: string; // e.g. "complaint", "vitals", "gastro", "eye"
  key: string; // e.g. "chief_complaint", "re_iop"
  value: string;
  source: CaptureSource;
  confirmed: boolean;
}

export interface RxLine {
  id: string;
  /** Seed data only; new lines are generic-only (decision 20 Nov). */
  medicineBrand: string | null;
  /** Catalogue item the line came from (DIG-69), or null when typed freely. */
  medicineId: string | null;
  /** "eye" lines need OD / OS / OU (RE / LE / BE on the wire) before signing (DIG-71). */
  route: 'oral' | 'eye' | null;
  /** Generic and strength, e.g. "pantoprazole 40 mg". */
  medicineGeneric: string;
  form: string;
  eye: Eye | null;
  dose: string;
  frequency: string;
  timing: string | null;
  duration: string;
  taper: string | null;
  instructionsEn: string | null;
  instructionsLocal: string | null;
  instructionsLanguage: Language | null;
}

export interface LabValue {
  testCode: string;
  testName: string;
  value: string;
  unit: string | null;
  refRange: string | null;
  flag: 'H' | 'L' | null;
}

export interface LabReport {
  id: string;
  reportDate: string; // ISO date
  labName: string | null;
  values: LabValue[];
}

export interface VisitSummary {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: Specialty | null;
  visitDate: string; // ISO date
  status: VisitStatus;
  version: number;
  diagnosis: string | null;
  /** ICD-10 code of the primary diagnosis, when coded (DIG-100). */
  diagnosisCode: string | null;
  /** When the latest version was saved, if the signed note was edited (DIG-97); else null. */
  editedAt: string | null;
  isSeed: boolean;
}

export interface VisitDetail extends VisitSummary {
  /** ISO 8601; null while the visit is a draft. */
  signedAt: string | null;
  /** ISO date of the planned follow-up, if set. */
  followUp: string | null;
  diagnoses: RecordedDiagnosis[];
  investigations: InvestigationOrder[];
  fields: ConsultField[];
  rxLines: RxLine[];
  labReports: LabReport[];
  /**
   * Edits made after signing, oldest first (DIG-97). The signed rows never change; the fields,
   * diagnoses, investigations and follow-up above are the latest version (amendments applied).
   */
  amendments: VisitAmendment[];
}

/** ICD-10 coded, or "Misc" free text (21 Nov: ICD-10 only, Misc allowed). */
export const DIAGNOSIS_KINDS = ['icd10', 'misc'] as const;
export type DiagnosisKind = (typeof DIAGNOSIS_KINDS)[number];

export const DIAGNOSIS_ROLES = ['primary', 'comorbidity'] as const;
export type DiagnosisRole = (typeof DIAGNOSIS_ROLES)[number];

export const DIAGNOSIS_CERTAINTIES = ['provisional', 'final'] as const;
export type DiagnosisCertainty = (typeof DIAGNOSIS_CERTAINTIES)[number];

/** Eyes are always OD / OS / OU in the doctor's view (DIG-52), never RE / LE / BE. */
export const EYE_SIDES = ['OD', 'OS', 'OU'] as const;
export type EyeSide = (typeof EYE_SIDES)[number];

/** A diagnosis as sent by the app. The tags are optional (DIG-53); see RecordedDiagnosis for defaults. */
export interface Diagnosis {
  kind: DiagnosisKind;
  /** e.g. "K21.9"; null for Misc. */
  icd10Code: string | null;
  label: string;
  /** Default: the first diagnosis is Primary, the rest Co-morbidity. */
  role?: DiagnosisRole;
  /** Default: Final. */
  certainty?: DiagnosisCertainty;
  /** Eye diagnoses only. */
  eye?: EyeSide | null;
  /** ISO date; default: the visit date. */
  diagnosedOn?: string | null;
}

/** A diagnosis as stored and returned, with every tag filled in. */
export interface RecordedDiagnosis extends Diagnosis {
  role: DiagnosisRole;
  certainty: DiagnosisCertainty;
  eye: EyeSide | null;
  diagnosedOn: string;
}

/** A doctor's most-used diagnosis from their own visits (GET /diagnoses/favourites). */
export interface DiagnosisFavourite {
  icd10Code: string;
  label: string;
  uses: number;
}

/** ICD-10 code shape: letter, two digits, optional dot and 1–4 characters (e.g. K21.0, H40.1131). */
export const ICD10_CODE_RE = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;

export interface ConsultFieldInput {
  section: string;
  key: string;
  value: string;
  source: CaptureSource;
  confirmed: boolean;
  /** Device time of the edit (ISO 8601). An older edit never overwrites a newer one. */
  clientUpdatedAt: string;
}

/** An Rx line as sent by the app (DIG-70). `id` is picked by the app (a UUID). */
export type RxLineInput = Omit<RxLine, 'medicineBrand'>;

/**
 * Body of PUT /visits/:id (draft save). The app picks the visit id (a UUID) itself, so a save
 * queued offline and retried is idempotent: the first call creates the draft, later calls update it.
 * Fields are upserted by section + key; fields not sent are left as they are.
 */
export interface VisitDraftInput {
  patientId: string;
  fields?: ConsultFieldInput[];
  /** Replaces the whole list when sent, unless an edit with a newer clientUpdatedAt is already stored. */
  diagnoses?: Diagnosis[];
  diagnosesClientUpdatedAt?: string;
  /** Tests ordered at this visit (DIG-50). Replaces the whole list, same rule as diagnoses. */
  investigations?: InvestigationOrder[];
  investigationsClientUpdatedAt?: string;
  /** The prescription (DIG-70). Replaces the whole list, same rule as diagnoses. */
  rxLines?: RxLineInput[];
  rxClientUpdatedAt?: string;
  /** ISO date, or null to clear. */
  followUp?: string | null;
}

/**
 * Body of POST /visits/:id/amendments. `id` is picked by the app so a retried call is idempotent.
 * Only what changed is sent; lists (diagnoses, investigations) replace the whole list.
 */
export interface VisitAmendmentInput {
  id: string;
  /** Optional on the day the visit was signed (IST): recorded as "Same-day edit". Required after. */
  reason?: string;
  fields?: Omit<ConsultFieldInput, 'clientUpdatedAt'>[];
  diagnoses?: Diagnosis[];
  investigations?: InvestigationOrder[];
  /** The whole prescription after the edit (DIG-70). */
  rxLines?: RxLineInput[];
  /** Rx warnings the doctor saved past (DIG-71). */
  overrides?: RxOverride[];
  /** ISO date, or null to clear. */
  followUp?: string | null;
}

export interface VisitAmendment {
  id: string;
  /** The signed note is version 1; each amendment adds one. */
  version: number;
  amendedBy: string;
  amendedByName: string;
  reason: string;
  fields: Omit<ConsultFieldInput, 'clientUpdatedAt'>[];
  diagnoses: Diagnosis[] | null;
  investigations: InvestigationOrder[] | null;
  rxLines: RxLineInput[] | null;
  /** Absent when the follow-up was not changed. */
  followUp?: string | null;
  createdAt: string;
}

/** Why a sign was refused (422 `sign_blocked`). */
export interface SignProblem {
  code: 'no_diagnosis' | 'unconfirmed_fields' | 'rx_eye_missing';
  /** For unconfirmed_fields: "section.key" of each field still waiting for the doctor. */
  fields?: string[];
  /** For rx_eye_missing (DIG-71): ids of eye-medicine lines with no OD / OS / OU. */
  rxLines?: string[];
}

/** Advisory Rx warnings (DIG-71). They never block; signing past one is logged as an override. */
export const RX_WARNING_KINDS = ['allergy', 'duplicate'] as const;
export type RxWarningKind = (typeof RX_WARNING_KINDS)[number];

/**
 * A warning the doctor signed past. `rule` names the rule, never clinical text, e.g.
 * "allergy:penicillin", "duplicate:class:ppi", "duplicate:other-doctor".
 */
export interface RxOverride {
  rxLineId: string;
  kind: RxWarningKind;
  rule: string;
}

/** Body of POST /visits/:id/sign (optional). */
export interface SignInput {
  overrides?: RxOverride[];
}

export const CONDITION_STATUSES = ['active', 'controlled', 'resolved'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export interface ConditionStatusChange {
  status: ConditionStatus;
  /** null for conditions loaded with the seed or migrated from the old list. */
  changedByName: string | null;
  changedAt: string;
}

export interface PatientCondition {
  id: string;
  name: string;
  icd10Code: string | null;
  status: ConditionStatus;
  /** ISO date the condition started, if known. */
  since: string | null;
  updatedAt: string;
  /** Every status the condition has had, oldest first. */
  history: ConditionStatusChange[];
}

/** Body of POST /patients/:id/conditions. */
export interface PatientConditionInput {
  name: string;
  icd10Code?: string | null;
  status: ConditionStatus;
  since?: string | null;
}

/** Body of POST /patients/:id/allergies (DIG-99): adds one allergy to the patient's list. */
export interface AllergyInput {
  name: string;
}

/** The patient's allergy list after the change. */
export interface AllergyList {
  allergies: string[];
}

/** Body of PATCH /patients/:id/conditions/:conditionId. */
export interface PatientConditionUpdate {
  status: ConditionStatus;
}

/** A test ordered at a visit. `testCode` matches LabValue.testCode when the test has a lab result. */
export interface InvestigationOrder {
  testName: string;
  testCode: string | null;
}

/**
 * Ordered on a signed visit and still waiting: a lab test with no result on or after the visit
 * date, or a test without a lab code (imaging, OCT…) until the ordering doctor's next visit.
 */
export interface PendingTest extends InvestigationOrder {
  visitId: string;
  visitDate: string;
  doctorId: string;
  doctorName: string;
}

/** The prescription from one signed visit, with who wrote it. */
export interface PrescriptionSummary {
  visitId: string;
  visitDate: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: Specialty | null;
  advice: string | null;
  lines: RxLine[];
}

/** The most recent confirmed result of one test. */
export interface LatestLab extends LabValue {
  reportDate: string;
}

export interface PatientDetail {
  patient: Patient;
  conditions: PatientCondition[];
  /** Newest first. Filtered when GET /patients/:id is called with ?doctorId=. */
  visits: VisitSummary[];
  /** Most recent signed visit by either doctor (never filtered). */
  lastVisit: VisitSummary | null;
  /** Most recent signed prescription by either doctor. */
  lastRx: PrescriptionSummary | null;
  /** Each doctor's latest signed prescription: what the patient should be taking now. */
  currentMedicines: PrescriptionSummary[];
  /** Latest confirmed value of each lab test, by test code. */
  latestLabs: LatestLab[];
  pendingTests: PendingTest[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  db: 'up' | 'down';
  time: string;
}

/** Case-insensitive user-ID normalisation (Cognito usernames are stored lower-case). */
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Sort a queue so the signed-in doctor's own patients come first, then by appointment time
 * (ISO strings in the same time zone sort correctly as text), then by token as a tie-break.
 */
export function sortQueue<T extends { isMine: boolean; appointmentAt: string; patient: { token: string } }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    if (a.appointmentAt !== b.appointmentAt) return a.appointmentAt < b.appointmentAt ? -1 : 1;
    return a.patient.token.localeCompare(b.patient.token, 'en', { numeric: true });
  });
}

// ---------------------------------------------------------------- medicines (DIG-69)

/** Where a medicine goes. Eye routes need OD / OS / OU on every Rx line (DIG-70/71). */
export const MEDICINE_ROUTES = ['oral', 'eye'] as const;
export type MedicineRoute = (typeof MEDICINE_ROUTES)[number];

/**
 * Drug classes the allergy check matches against the patient's allergies (DIG-71). A patient
 * allergic to a class is warned about every medicine in it.
 */
export const ALLERGY_CLASSES = [
  'penicillin',
  'cephalosporin',
  'sulfonamide',
  'nsaid',
  'fluoroquinolone',
  'aminoglycoside',
  'nitroimidazole',
  'tetracycline',
  'opioid',
] as const;
export type AllergyClass = (typeof ALLERGY_CLASSES)[number];

/** Usual sig for a medicine, used to pre-fill a new Rx line. Frequency is 4-slot (1-0-0-1). */
export interface MedicineDefaults {
  dose: string;
  frequency: string;
  timing: string | null;
  duration: string;
  /** e.g. "6× a day for 1 week, then 4×, 3×, 2×, 1× a day, one week each". */
  taper?: string | null;
}

/**
 * One catalogue item. Generic names only (decision 20 Nov): no brands. Indicative, not a
 * validated formulary.
 */
export interface Medicine {
  /** Stable slug, e.g. "pantoprazole-40-tab". */
  id: string;
  specialty: Specialty;
  /** Lower-case generic, e.g. "pantoprazole". */
  generic: string;
  /** e.g. "40 mg", "0.5%". */
  strength: string;
  /** e.g. "Tablet", "Eye drops". */
  form: string;
  route: MedicineRoute;
  /** Therapeutic class, used by the duplicate check, e.g. "ppi", "prostaglandin". */
  therapeuticClass: string;
  allergyClasses: AllergyClass[];
  defaults: MedicineDefaults;
}

/** A line of an order set: a catalogue medicine with the set's own sig where it differs. */
export interface OrderSetLine extends Partial<MedicineDefaults> {
  medicineId: string;
}

export interface OrderSet {
  id: string;
  specialty: Specialty;
  name: string;
  lines: OrderSetLine[];
}

/** GET /medicines: the catalogue and order sets for the doctor's specialty. */
export interface MedicineCatalogue {
  /** Shown in the picker: the list is indicative, not a validated formulary. */
  note: string;
  medicines: Medicine[];
  orderSets: OrderSet[];
}

/** GET /medicines/favourites: the doctor's most-prescribed catalogue items. */
export interface MedicineFavourite {
  medicineId: string;
  uses: number;
}

// ---------------------------------------------------------------- consult note helpers
// Field definitions and the summary builder, shared by the app (review, print-copy editor) and
// the API (A4 PDF, DIG-72), so both lay out the same DIG-29 sections from the same note.
export * from './note/time';
export * from './note/fields';
export * from './note/consult-fields';
export * from './note/eye-fields';
export * from './note/gastro-fields';
export * from './note/rx-lines';
export * from './note/rx-checks';
export * from './note/summary';

// ---------------------------------------------------------------- A4 summary (DIG-72/73)

/** One Rx line on the A4: drug column and patient-instruction column (DIG-29 page 2). */
export interface SummaryMedicine {
  /** The Rx line id. */
  id: string;
  /** "Pantoprazole 40 mg · Tablet · OU". */
  drug: string;
  /** "1 · 1-0-0-0 · oral · before food · 14 days · Qty 14 · 28 Nov → 11 Dec 2026". */
  instruction: string;
  taper: string | null;
  /** The Gujarati / Hindi / Marathi line, if any. */
  local: string | null;
  localLanguage: 'mr' | 'hi' | 'gu' | null;
}

export interface SummarySection {
  /** Stable id from the title, e.g. "advice". The print-copy editor replaces lines by id. */
  id: string;
  title: string;
  lines: string[];
  /** Only on the "medication-order" section. */
  medicines?: SummaryMedicine[];
}

/**
 * The consultation summary with the prescription, as laid out on the A4 (DIG-29). Built by the
 * API from the latest version of the visit; GET /visits/:id/summary.
 */
export interface SummaryDocument {
  visitId: string;
  version: number;
  status: VisitStatus;
  clinic: string;
  doctor: {
    name: string;
    qualifications: string | null;
    specialty: Specialty | null;
    /** "Reg. No. 00000 (sample — not a real registration number)". */
    registration: string;
  };
  patient: { name: string; ageSex: string; date: string };
  sections: SummarySection[];
  /** ISO time of signing (or of the latest edit); null for a draft. */
  signedAt: string | null;
}

/**
 * Body of POST /visits/:id/print-copy (DIG-73): reworded text for this printout only. Never
 * written back to the visit; the PDF footer says "print copy edited".
 */
export interface PrintCopyInput {
  version: number;
  sections: { id: string; lines: string[] }[];
  medicines?: { id: string; instruction: string; local: string | null }[];
}
