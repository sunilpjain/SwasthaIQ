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

export const QUEUE_STATUSES = ['waiting', 'in_consult', 'done'] as const;
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
  /** Doctor-facing order: own patients first, then the rest by token. */
  isMine: boolean;
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
  fields: ConsultField[];
  rxLines: RxLine[];
  labReports: LabReport[];
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

/** Sort a queue so the signed-in doctor's own patients come first, then by token. */
export function sortQueue<T extends { isMine: boolean; patient: { token: string } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    return a.patient.token.localeCompare(b.patient.token, 'en', { numeric: true });
  });
}
