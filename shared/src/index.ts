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
  medicineBrand: string;
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
  /** Additions made after signing, oldest first. The signed note itself never changes. */
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
  /** ISO date, or null to clear. */
  followUp?: string | null;
}

/** Body of POST /visits/:id/amendments. `id` is picked by the app so a retried call is idempotent. */
export interface VisitAmendmentInput {
  id: string;
  reason: string;
  fields?: Omit<ConsultFieldInput, 'clientUpdatedAt'>[];
  diagnoses?: Diagnosis[];
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
  createdAt: string;
}

/** Why a sign was refused (422 `sign_blocked`). */
export interface SignProblem {
  code: 'no_diagnosis' | 'unconfirmed_fields';
  /** For unconfirmed_fields: "section.key" of each field still waiting for the doctor. */
  fields?: string[];
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
