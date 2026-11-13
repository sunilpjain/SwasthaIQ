import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  sortQueue,
  type ConsultField,
  type LabReport,
  type Patient,
  type PatientDetail,
  type QueueEntry,
  type RxLine,
  type UserSummary,
  type VisitDetail,
  type VisitSummary,
} from '@swasthyaiq/shared';
import { DB, type Db } from '../db/database';
import type { AuthUser } from '../auth/auth.decorators';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id: string, what: string): void {
  if (!UUID_RE.test(id)) throw new NotFoundException({ code: 'not_found', message: `${what} not found` });
}

type PatientRow = {
  id: string;
  token: string;
  full_name: string;
  age_years: number;
  sex: 'M' | 'F';
  guardian_name: string | null;
  phone: string | null;
  primary_doctor_id: string;
  allergies: string[];
  conditions: string[];
};

function toPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    token: r.token,
    fullName: r.full_name,
    ageYears: r.age_years,
    sex: r.sex,
    guardianName: r.guardian_name,
    phone: r.phone,
    primaryDoctorId: r.primary_doctor_id,
    allergies: r.allergies,
    conditions: r.conditions,
  };
}

const PATIENT_COLS = [
  'patients.id',
  'patients.token',
  'patients.full_name',
  'patients.age_years',
  'patients.sex',
  'patients.guardian_name',
  'patients.phone',
  'patients.primary_doctor_id',
  'patients.allergies',
  'patients.conditions',
] as const;

@Injectable()
export class ClinicService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async me(user: AuthUser): Promise<UserSummary> {
    const u = await this.db
      .selectFrom('users')
      .select(['id', 'username', 'display_name', 'role', 'specialty', 'qualifications'])
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    return {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      specialty: u.specialty,
      qualifications: u.qualifications,
    };
  }

  /** Today's queue: all 12 patients, the signed-in doctor's own first. */
  async queue(user: AuthUser): Promise<QueueEntry[]> {
    const rows = await this.db
      .selectFrom('queue_entries')
      .innerJoin('patients', 'patients.id', 'queue_entries.patient_id')
      .select([
        ...PATIENT_COLS,
        'queue_entries.reason',
        'queue_entries.status',
        'queue_entries.in_consult_with',
      ])
      .execute();
    return sortQueue(
      rows.map((r) => ({
        patient: toPatient(r),
        reason: r.reason,
        status: r.status,
        inConsultWithUserId: r.in_consult_with,
        isMine: r.primary_doctor_id === user.id,
      })),
    );
  }

  /**
   * Marks a patient as "In consult" with this doctor. A second doctor opening the
   * same patient gets a warning (409 with details) unless they pass force=true — never a lock.
   */
  async openConsult(user: AuthUser, patientId: string, force: boolean): Promise<QueueEntry> {
    assertUuid(patientId, 'Patient');
    const entry = await this.db
      .selectFrom('queue_entries')
      .select(['status', 'in_consult_with'])
      .where('patient_id', '=', patientId)
      .executeTakeFirst();
    if (!entry) throw new NotFoundException({ code: 'not_found', message: 'Patient not in queue' });
    if (entry.status === 'in_consult' && entry.in_consult_with !== user.id && !force) {
      throw new ConflictException({
        code: 'in_consult_with_other_doctor',
        message: 'Another doctor has this patient open',
        inConsultWithUserId: entry.in_consult_with,
      });
    }
    await this.db
      .updateTable('queue_entries')
      .set({ status: 'in_consult', in_consult_with: user.id, status_changed_at: new Date() })
      .where('patient_id', '=', patientId)
      .execute();
    const all = await this.queue(user);
    const found = all.find((q) => q.patient.id === patientId);
    if (!found) throw new NotFoundException({ code: 'not_found', message: 'Patient not in queue' });
    return found;
  }

  async patient(patientId: string): Promise<PatientDetail> {
    assertUuid(patientId, 'Patient');
    const p = await this.db
      .selectFrom('patients')
      .select(PATIENT_COLS)
      .where('id', '=', patientId)
      .executeTakeFirst();
    if (!p) throw new NotFoundException({ code: 'not_found', message: 'Patient not found' });
    const visits = await this.visitSummaries(patientId);
    return { patient: toPatient(p), visits };
  }

  async searchPatients(q: string): Promise<Patient[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const like = `%${term.toLowerCase()}%`;
    const rows = await this.db
      .selectFrom('patients')
      .select(PATIENT_COLS)
      .where((eb) =>
        eb.or([
          eb(eb.fn('lower', ['patients.full_name']), 'like', like),
          eb('patients.phone', 'like', `%${term}%`),
          eb(eb.fn('lower', ['patients.token']), '=', term.toLowerCase()),
        ]),
      )
      .orderBy('patients.token')
      .limit(25)
      .execute();
    return rows.map(toPatient);
  }

  private async visitSummaries(patientId: string): Promise<VisitSummary[]> {
    const rows = await this.db
      .selectFrom('visits')
      .innerJoin('users', 'users.id', 'visits.doctor_id')
      .select([
        'visits.id',
        'visits.patient_id',
        'visits.doctor_id',
        'users.display_name',
        'users.specialty',
        'visits.visit_date',
        'visits.status',
        'visits.version',
        'visits.diagnosis',
        'visits.is_seed',
      ])
      .where('visits.patient_id', '=', patientId)
      .orderBy('visits.visit_date', 'desc')
      .execute();
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      doctorId: r.doctor_id,
      doctorName: r.display_name,
      doctorSpecialty: r.specialty,
      visitDate: r.visit_date,
      status: r.status,
      version: r.version,
      diagnosis: r.diagnosis,
      isSeed: r.is_seed,
    }));
  }

  async visit(visitId: string): Promise<VisitDetail> {
    assertUuid(visitId, 'Visit');
    const v = await this.db
      .selectFrom('visits')
      .innerJoin('users', 'users.id', 'visits.doctor_id')
      .select([
        'visits.id',
        'visits.patient_id',
        'visits.doctor_id',
        'users.display_name',
        'users.specialty',
        'visits.visit_date',
        'visits.status',
        'visits.version',
        'visits.diagnosis',
        'visits.is_seed',
      ])
      .where('visits.id', '=', visitId)
      .executeTakeFirst();
    if (!v) throw new NotFoundException({ code: 'not_found', message: 'Visit not found' });

    const fields = await this.db
      .selectFrom('consult_fields')
      .select(['section', 'key', 'value', 'source', 'confirmed'])
      .where('visit_id', '=', visitId)
      .orderBy('section')
      .orderBy('key')
      .execute();

    const rx = await this.db
      .selectFrom('rx_lines')
      .innerJoin('prescriptions', 'prescriptions.id', 'rx_lines.prescription_id')
      .selectAll('rx_lines')
      .where('prescriptions.visit_id', '=', visitId)
      .orderBy('rx_lines.position')
      .execute();

    const reports = await this.db
      .selectFrom('lab_reports')
      .select(['id', 'report_date', 'lab_name'])
      .where('visit_id', '=', visitId)
      .orderBy('report_date', 'desc')
      .execute();
    const values = reports.length
      ? await this.db
          .selectFrom('lab_values')
          .select(['lab_report_id', 'test_code', 'test_name', 'value_text', 'unit', 'ref_range', 'flag'])
          .where(
            'lab_report_id',
            'in',
            reports.map((r) => r.id),
          )
          .orderBy('test_code')
          .execute()
      : [];

    const labReports: LabReport[] = reports.map((r) => ({
      id: r.id,
      reportDate: r.report_date,
      labName: r.lab_name,
      values: values
        .filter((lv) => lv.lab_report_id === r.id)
        .map((lv) => ({
          testCode: lv.test_code,
          testName: lv.test_name,
          value: lv.value_text,
          unit: lv.unit,
          refRange: lv.ref_range,
          flag: lv.flag,
        })),
    }));

    const rxLines: RxLine[] = rx.map((l) => ({
      id: l.id,
      medicineBrand: l.medicine_brand,
      medicineGeneric: l.medicine_generic,
      form: l.form,
      eye: l.eye,
      dose: l.dose,
      frequency: l.frequency,
      timing: l.timing,
      duration: l.duration,
      taper: l.taper,
      instructionsEn: l.instructions_en,
      instructionsLocal: l.instructions_local,
      instructionsLanguage: l.instructions_language,
    }));

    const consultFields: ConsultField[] = fields.map((f) => ({ ...f }));

    return {
      id: v.id,
      patientId: v.patient_id,
      doctorId: v.doctor_id,
      doctorName: v.display_name,
      doctorSpecialty: v.specialty,
      visitDate: v.visit_date,
      status: v.status,
      version: v.version,
      diagnosis: v.diagnosis,
      isSeed: v.is_seed,
      fields: consultFields,
      rxLines,
      labReports,
    };
  }

  /** Values of one lab test across all of a patient's reports, oldest first (for trend lines). */
  async labTrend(
    patientId: string,
    testCode: string,
  ): Promise<{ date: string; value: string; unit: string | null }[]> {
    assertUuid(patientId, 'Patient');
    const rows = await this.db
      .selectFrom('lab_values')
      .innerJoin('lab_reports', 'lab_reports.id', 'lab_values.lab_report_id')
      .select(['lab_reports.report_date', 'lab_values.value_text', 'lab_values.unit'])
      .where('lab_reports.patient_id', '=', patientId)
      .where('lab_values.test_code', '=', testCode.toUpperCase())
      .orderBy('lab_reports.report_date', 'asc')
      .execute();
    return rows.map((r) => ({ date: r.report_date, value: r.value_text, unit: r.unit }));
  }
}
