import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  sortQueue,
  type Patient,
  type PatientDetail,
  type QueueEntry,
  type QueueResetResult,
  type UserSummary,
  type VisitSummary,
} from '@swasthyaiq/shared';
import { sql } from 'kysely';
import { DB, type Db } from '../db/database';
import { resetQueue } from '../seed/seed';
import type { AuthUser } from '../auth/auth.decorators';
import { currentVersion } from '../visits/visits.service';

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

  /** Today's queue: all 12 patients, the signed-in doctor's own first, then by appointment time. */
  async queue(user: AuthUser): Promise<QueueEntry[]> {
    const rows = await this.db
      .selectFrom('queue_entries')
      .innerJoin('patients', 'patients.id', 'queue_entries.patient_id')
      .select([
        ...PATIENT_COLS,
        'queue_entries.reason',
        'queue_entries.status',
        'queue_entries.in_consult_with',
        'queue_entries.appointment_at',
        'queue_entries.checked_in_at',
      ])
      .execute();
    return sortQueue(
      rows.map((r) => ({
        patient: toPatient(r),
        reason: r.reason,
        status: r.status,
        inConsultWithUserId: r.in_consult_with,
        appointmentAt: r.appointment_at.toISOString(),
        checkedInAt: r.checked_in_at?.toISOString() ?? null,
        isMine: r.primary_doctor_id === user.id,
      })),
    );
  }

  /**
   * Marks a patient as "In consult" with this doctor. A second doctor opening the
   * same patient gets a warning (409 with details) unless they pass force=true — never a lock.
   * Opening a patient who has not arrived checks them in now (doctors may test any case).
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
      .set({
        status: 'in_consult',
        in_consult_with: user.id,
        status_changed_at: new Date(),
        checked_in_at: sql<Date>`coalesce(checked_in_at, now())`,
      })
      .where('patient_id', '=', patientId)
      .execute();
    const all = await this.queue(user);
    const found = all.find((q) => q.patient.id === patientId);
    if (!found) throw new NotFoundException({ code: 'not_found', message: 'Patient not in queue' });
    return found;
  }

  /** Doctor's "Reset queue" button: same as the admin action and the 2 am job. */
  async resetQueue(): Promise<QueueResetResult> {
    return { reset: await resetQueue(this.db) };
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
        currentVersion.as('version'),
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
      version: Number(r.version),
      diagnosis: r.diagnosis,
      isSeed: r.is_seed,
    }));
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
