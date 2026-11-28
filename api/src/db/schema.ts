/** Kysely table types. Keep in step with migrations/*.sql. */
import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type DateCol = ColumnType<string, string, string>;
type Numeric = ColumnType<string | null, number | string | null | undefined, number | string | null>;

export interface UsersTable {
  id: Generated<string>;
  username: string;
  cognito_sub: string | null;
  display_name: string;
  role: 'doctor' | 'admin';
  specialty: 'gastro' | 'eye' | null;
  qualifications: string | null;
  registration_no: string | null;
  enabled: Generated<boolean>;
  created_at: Timestamp;
}

export interface SessionRevocationsTable {
  user_id: string;
  revoked_at: Timestamp;
  revoked_by: string | null;
}

export interface PatientsTable {
  id: Generated<string>;
  token: string;
  full_name: string;
  age_years: number;
  sex: 'M' | 'F';
  guardian_name: string | null;
  phone: string | null;
  primary_doctor_id: string;
  allergies: Generated<string[]>;
  is_seed: Generated<boolean>;
  created_at: Timestamp;
}

export type ConditionStatusCol = 'active' | 'controlled' | 'resolved';

export interface PatientConditionsTable {
  id: Generated<string>;
  patient_id: string;
  name: string;
  icd10_code: string | null;
  status: ConditionStatusCol;
  since: DateCol | null;
  is_seed: Generated<boolean>;
  updated_by: string | null;
  updated_at: Timestamp;
  created_at: Timestamp;
}

export interface PatientConditionHistoryTable {
  id: Generated<string>;
  condition_id: string;
  status: ConditionStatusCol;
  changed_by: string | null;
  changed_at: Timestamp;
}

export interface InvestigationOrdersTable {
  id: Generated<string>;
  visit_id: string;
  position: number;
  test_name: string;
  test_code: string | null;
}

export interface QueueEntriesTable {
  patient_id: string;
  reason: string;
  status: Generated<'not_arrived' | 'waiting' | 'in_consult' | 'done'>;
  in_consult_with: string | null;
  status_changed_at: Timestamp;
  appointment_at: ColumnType<Date, Date | string, Date | string>;
  checked_in_at: Timestamp | null;
}

export interface VisitsTable {
  id: Generated<string>;
  patient_id: string;
  doctor_id: string;
  visit_date: DateCol;
  status: Generated<'draft' | 'signed'>;
  version: Generated<number>;
  diagnosis: string | null;
  icd10_code: string | null;
  follow_up: DateCol | null;
  is_seed: Generated<boolean>;
  signed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  diagnoses_client_updated_at: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >;
  rx_client_updated_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  investigations_client_updated_at: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >;
}

export interface VisitDiagnosesTable {
  id: Generated<string>;
  visit_id: string;
  position: number;
  kind: 'icd10' | 'misc';
  icd10_code: string | null;
  label: string;
  role: Generated<'primary' | 'comorbidity'>;
  certainty: Generated<'provisional' | 'final'>;
  eye: 'OD' | 'OS' | 'OU' | null;
  diagnosed_on: DateCol | null;
}

export interface VisitAmendmentsTable {
  id: Generated<string>;
  visit_id: string;
  version: number;
  amended_by: string;
  reason: string;
  changes: unknown;
  created_at: Timestamp;
}

export interface ConsultFieldsTable {
  id: Generated<string>;
  visit_id: string;
  section: string;
  key: string;
  value: string;
  source: 'dictated' | 'scanned' | 'typed';
  confirmed: Generated<boolean>;
  confidence: Numeric;
  original_language: 'en' | 'mr' | 'hi' | 'gu' | null;
  original_transcript: string | null;
  updated_at: Timestamp;
  client_updated_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}

export interface PrescriptionsTable {
  id: Generated<string>;
  visit_id: string;
  advice: string | null;
  pdf_s3_key: string | null;
  created_at: Timestamp;
}

export interface RxLinesTable {
  id: Generated<string>;
  prescription_id: string;
  position: number;
  medicine_brand: string | null;
  medicine_id: string | null;
  route: 'oral' | 'eye' | null;
  medicine_generic: string;
  form: string;
  eye: 'RE' | 'LE' | 'BE' | null;
  dose: string;
  frequency: string;
  timing: string | null;
  duration: string;
  taper: string | null;
  instructions_en: string | null;
  instructions_local: string | null;
  instructions_language: 'mr' | 'hi' | 'gu' | null;
  source: Generated<'dictated' | 'scanned' | 'typed'>;
}

export interface VisitDocumentsTable {
  visit_id: string;
  version: number;
  s3_key: string;
  bytes: number;
  created_at: Generated<Date>;
}

export interface RxOverridesTable {
  id: Generated<string>;
  visit_id: string;
  rx_line_id: string;
  kind: 'allergy' | 'duplicate';
  rule: string;
  overridden_by: string;
  created_at: Generated<Date>;
}

export interface AttachmentsTable {
  id: Generated<string>;
  patient_id: string;
  visit_id: string | null;
  kind: 'photo' | 'scan' | 'lab_report' | 'narrative_report' | 'rx_pdf' | 'audio';
  s3_key: string;
  mime_type: string;
  bytes: number;
  summary: string | null;
  created_by: string;
  created_at: Timestamp;
}

export interface LabReportsTable {
  id: Generated<string>;
  patient_id: string;
  visit_id: string | null;
  attachment_id: string | null;
  report_date: DateCol;
  lab_name: string | null;
  confirmed: Generated<boolean>;
  is_seed: Generated<boolean>;
  created_at: Timestamp;
}

export interface LabValuesTable {
  id: Generated<string>;
  lab_report_id: string;
  test_code: string;
  test_name: string;
  value_text: string;
  value_num: Numeric;
  unit: string | null;
  ref_range: string | null;
  flag: 'H' | 'L' | null;
  confidence: Numeric;
}

export interface AuditLogTable {
  id: Generated<string>;
  user_id: string | null;
  username: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  http_method: string | null;
  path: string | null;
  status_code: number | null;
  at: Timestamp;
}

export interface UsageEventsTable {
  id: Generated<string>;
  user_id: string | null;
  event_type: string;
  units: Generated<string>;
  unit_type: string | null;
  cost_inr: Numeric;
  meta: Generated<unknown>;
  at: Timestamp;
}

export interface Database {
  users: UsersTable;
  session_revocations: SessionRevocationsTable;
  patients: PatientsTable;
  patient_conditions: PatientConditionsTable;
  patient_condition_history: PatientConditionHistoryTable;
  queue_entries: QueueEntriesTable;
  visits: VisitsTable;
  visit_diagnoses: VisitDiagnosesTable;
  investigation_orders: InvestigationOrdersTable;
  visit_amendments: VisitAmendmentsTable;
  consult_fields: ConsultFieldsTable;
  prescriptions: PrescriptionsTable;
  rx_lines: RxLinesTable;
  rx_overrides: RxOverridesTable;
  visit_documents: VisitDocumentsTable;
  attachments: AttachmentsTable;
  lab_reports: LabReportsTable;
  lab_values: LabValuesTable;
  audit_log: AuditLogTable;
  usage_events: UsageEventsTable;
}
