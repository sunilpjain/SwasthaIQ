import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sortQueue, type QueueEntry, type QueueResetResult, type UserSummary } from '@swasthyaiq/shared';
import { sql } from 'kysely';
import { DB, type Db } from '../db/database';
import { resetQueue } from '../seed/seed';
import type { AuthUser } from '../auth/auth.decorators';
import { assertUuid, PATIENT_COLS, toPatient } from '../patients/patient-row';

/** DIG-96: a doctor may read every patient but consult only their own. */
export const notYourPatient = () =>
  new ForbiddenException({ code: 'not_your_patient', message: 'This patient is booked with another doctor' });

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
      .innerJoin('users as primary_doctor', 'primary_doctor.id', 'patients.primary_doctor_id')
      .leftJoin('users as consult_doctor', 'consult_doctor.id', 'queue_entries.in_consult_with')
      .select([
        ...PATIENT_COLS,
        'queue_entries.reason',
        'queue_entries.status',
        'queue_entries.in_consult_with',
        'queue_entries.appointment_at',
        'queue_entries.checked_in_at',
        'primary_doctor.display_name as doctor_name',
        'consult_doctor.display_name as in_consult_with_name',
      ])
      .execute();
    return sortQueue(
      rows.map((r) => ({
        patient: toPatient(r),
        reason: r.reason,
        status: r.status,
        inConsultWithUserId: r.in_consult_with,
        inConsultWithName: r.in_consult_with_name,
        doctorName: r.doctor_name,
        appointmentAt: r.appointment_at.toISOString(),
        checkedInAt: r.checked_in_at?.toISOString() ?? null,
        isMine: r.primary_doctor_id === user.id,
      })),
    );
  }

  /**
   * Marks a patient as "In consult" with this doctor. Only the patient's own doctor may consult
   * them (DIG-96): the other doctor can read the summary and history but gets 403 here.
   * Opening a patient who has not arrived checks them in now.
   */
  async openConsult(user: AuthUser, patientId: string): Promise<QueueEntry> {
    assertUuid(patientId, 'Patient');
    const entry = await this.db
      .selectFrom('queue_entries')
      .innerJoin('patients', 'patients.id', 'queue_entries.patient_id')
      .select(['queue_entries.status', 'patients.primary_doctor_id'])
      .where('queue_entries.patient_id', '=', patientId)
      .executeTakeFirst();
    if (!entry) throw new NotFoundException({ code: 'not_found', message: 'Patient not in queue' });
    if (entry.primary_doctor_id !== user.id) throw notYourPatient();
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
}
