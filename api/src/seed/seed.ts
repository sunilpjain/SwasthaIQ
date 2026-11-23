import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { dailySchedule } from '../clinic/queue-schedule';
import type { Db } from '../db/database';
import { SEED_PATIENTS, SEED_USERS, SEED_VISITS } from './seed-data';

/** Deterministic UUID (v5-style, SHA-1) so the seed is idempotent across runs and environments. */
export function seedUuid(name: string): string {
  const h = createHash('sha1').update(`swasthyaiq-seed:${name}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export interface SeedResult {
  users: number;
  patients: number;
  visitsCreated: number;
}

/**
 * Loads the 3 users, 12 patients, today's queue and the pre-loaded visit history.
 * Idempotent: running it again creates nothing new and never touches visits made during testing.
 */
export async function seed(db: Db): Promise<SeedResult> {
  return db.transaction().execute(async (trx) => {
    const userIds = new Map<string, string>();
    for (const u of SEED_USERS) {
      const row = await trx
        .insertInto('users')
        .values({
          id: seedUuid(`user:${u.username}`),
          username: u.username,
          display_name: u.displayName,
          role: u.role,
          specialty: u.specialty,
          qualifications: u.qualifications,
          registration_no: u.registrationNo,
          cognito_sub: null,
        })
        .onConflict((oc) =>
          oc.column('username').doUpdateSet({
            display_name: u.displayName,
            role: u.role,
            specialty: u.specialty,
            qualifications: u.qualifications,
            registration_no: u.registrationNo,
          }),
        )
        .returning('id')
        .executeTakeFirstOrThrow();
      userIds.set(u.username, row.id);
    }

    const patientIds = new Map<string, string>();
    for (const p of SEED_PATIENTS) {
      const row = await trx
        .insertInto('patients')
        .values({
          id: seedUuid(`patient:${p.token}`),
          token: p.token,
          full_name: p.fullName,
          age_years: p.ageYears,
          sex: p.sex,
          guardian_name: p.guardianName ?? null,
          phone: p.phone,
          primary_doctor_id: userIds.get(p.doctor)!,
          allergies: p.allergies ?? [],
          conditions: p.conditions ?? [],
          is_seed: true,
        })
        .onConflict((oc) => oc.column('token').doNothing())
        .returning('id')
        .executeTakeFirst();
      const id =
        row?.id ??
        (await trx.selectFrom('patients').select('id').where('token', '=', p.token).executeTakeFirstOrThrow())
          .id;
      patientIds.set(p.token, id);
    }

    // Today's queue with fictitious times. Re-running the seed only refreshes the reason, so a
    // queue in use keeps its statuses and times (reset regenerates them).
    const slots = dailySchedule(
      SEED_PATIENTS.map((p) => ({ id: patientIds.get(p.token)!, token: p.token, doctorId: p.doctor })),
      new Date(),
    );
    for (const p of SEED_PATIENTS) {
      const slot = slots.find((s) => s.patientId === patientIds.get(p.token))!;
      await trx
        .insertInto('queue_entries')
        .values({
          patient_id: slot.patientId,
          reason: p.reason,
          status: slot.checkedInAt ? 'waiting' : 'not_arrived',
          in_consult_with: null,
          appointment_at: slot.appointmentAt,
          checked_in_at: slot.checkedInAt,
        })
        .onConflict((oc) => oc.column('patient_id').doUpdateSet({ reason: p.reason }))
        .execute();
    }

    let visitsCreated = 0;
    for (const v of SEED_VISITS) {
      const visitId = seedUuid(`visit:${v.key}`);
      const patientId = patientIds.get(v.patient)!;
      const doctorId = userIds.get(v.doctor)!;
      const inserted = await trx
        .insertInto('visits')
        .values({
          id: visitId,
          patient_id: patientId,
          doctor_id: doctorId,
          visit_date: v.date,
          diagnosis: v.diagnosis,
          icd10_code: v.icd10 ?? null,
          follow_up: null,
          is_seed: true,
          signed_at: null,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!inserted) continue; // already seeded (and signed) — leave it alone
      visitsCreated++;

      for (const f of v.fields) {
        await trx
          .insertInto('consult_fields')
          .values({
            visit_id: visitId,
            section: f.section,
            key: f.key,
            value: f.value,
            source: f.source ?? 'typed',
            confirmed: true,
            confidence: null,
            original_language: null,
            original_transcript: null,
          })
          .execute();
      }

      if (v.rx?.length) {
        const rxId = seedUuid(`rx:${v.key}`);
        await trx
          .insertInto('prescriptions')
          .values({ id: rxId, visit_id: visitId, advice: v.advice ?? null, pdf_s3_key: null })
          .execute();
        let pos = 1;
        for (const r of v.rx) {
          await trx
            .insertInto('rx_lines')
            .values({
              prescription_id: rxId,
              position: pos++,
              medicine_brand: r.brand,
              medicine_generic: r.generic,
              form: r.form,
              eye: r.eye ?? null,
              dose: r.dose,
              frequency: r.frequency,
              timing: r.timing ?? null,
              duration: r.duration,
              taper: r.taper ?? null,
              instructions_en: r.instructionsEn ?? null,
              instructions_local: null,
              instructions_language: null,
            })
            .execute();
        }
      }

      if (v.labs) {
        const reportId = seedUuid(`lab:${v.key}`);
        await trx
          .insertInto('lab_reports')
          .values({
            id: reportId,
            patient_id: patientId,
            visit_id: visitId,
            attachment_id: null,
            report_date: v.labs.date,
            lab_name: v.labs.labName,
            confirmed: true,
            is_seed: true,
          })
          .execute();
        for (const lv of v.labs.values) {
          const num = Number(lv.value);
          await trx
            .insertInto('lab_values')
            .values({
              lab_report_id: reportId,
              test_code: lv.code,
              test_name: lv.name,
              value_text: lv.value,
              value_num: Number.isFinite(num) ? num : null,
              unit: lv.unit ?? null,
              ref_range: lv.ref ?? null,
              flag: lv.flag ?? null,
              confidence: null,
            })
            .execute();
        }
      }

      // Sign last: from here on the visit and its children are read-only.
      await trx
        .updateTable('visits')
        .set({ status: 'signed', signed_at: new Date(`${v.date}T12:00:00+05:30`) })
        .where('id', '=', visitId)
        .execute();
    }

    return { users: userIds.size, patients: patientIds.size, visitsCreated };
  });
}

/**
 * "Reset queue": fresh fictitious appointment and check-in times for today, everyone back to
 * Waiting (or Not arrived for each doctor's last appointment). Never deletes saved consults.
 */
export async function resetQueue(db: Db, now = new Date()): Promise<number> {
  return db.transaction().execute(async (trx) => {
    const patients = await trx
      .selectFrom('queue_entries')
      .innerJoin('patients', 'patients.id', 'queue_entries.patient_id')
      .select(['patients.id', 'patients.token', 'patients.primary_doctor_id as doctorId'])
      .execute();
    for (const slot of dailySchedule(patients, now)) {
      await trx
        .updateTable('queue_entries')
        .set({
          status: slot.checkedInAt ? 'waiting' : 'not_arrived',
          in_consult_with: null,
          appointment_at: slot.appointmentAt,
          checked_in_at: slot.checkedInAt,
          status_changed_at: now,
        })
        .where('patient_id', '=', slot.patientId)
        .execute();
    }
    return patients.length;
  });
}

/** "Clear test visits": deletes visits and lab reports made during testing; keeps seed history. */
export async function clearTestVisits(db: Db): Promise<number> {
  return db.transaction().execute(async (trx) => {
    await sql`SET LOCAL swasthyaiq.allow_test_clear = 'on'`.execute(trx);
    await trx.deleteFrom('lab_reports').where('is_seed', '=', false).execute();
    // The seed writes no amendments, so any amendment (even on a seed visit) was made in testing.
    await trx.deleteFrom('visit_amendments').execute();
    const res = await trx.deleteFrom('visits').where('is_seed', '=', false).executeTakeFirst();
    return Number(res.numDeletedRows);
  });
}
