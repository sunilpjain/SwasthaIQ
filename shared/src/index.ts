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
  conditions: string[];
}

export interface QueueEntry {
  patient: Patient;
  reason: string;
  status: QueueStatus;
  inConsultWithUserId: string | null;
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
  isSeed: boolean;
}

export interface VisitDetail extends VisitSummary {
  /** ISO 8601; null while the visit is a draft. */
  signedAt: string | null;
  diagnoses: Diagnosis[];
  fields: ConsultField[];
  rxLines: RxLine[];
  labReports: LabReport[];
  /** Additions made after signing, oldest first. The signed note itself never changes. */
  amendments: VisitAmendment[];
}

/** ICD-10 coded, or "Misc" free text (21 Nov: ICD-10 only, Misc allowed). */
export const DIAGNOSIS_KINDS = ['icd10', 'misc'] as const;
export type DiagnosisKind = (typeof DIAGNOSIS_KINDS)[number];

export interface Diagnosis {
  kind: DiagnosisKind;
  /** e.g. "K21.0"; null for Misc. */
  icd10Code: string | null;
  label: string;
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

export interface PatientDetail {
  patient: Patient;
  visits: VisitSummary[];
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
