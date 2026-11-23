import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  LatestLab,
  Patient,
  PatientCondition,
  PatientConditionInput,
  PatientConditionUpdate,
  PatientDetail,
  PendingTest,
  PrescriptionSummary,
  RxLine,
  VisitSummary,
} from '@swasthyaiq/shared';
import { sql } from 'kysely';
import type { AuthUser } from '../auth/auth.decorators';
import { DB, type Db } from '../db/database';
import { currentVersion } from '../visits/visits.service';
import { assertUuid, isUuid, PATIENT_COLS, toPatient } from './patient-row';

type RxRow = {
  id: string;
  prescription_id: string;
  medicine_brand: string;
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
};

export function toRxLine(l: RxRow): RxLine {
  return {
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
  };
}

/** Postgres unique_violation. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}

@Injectable()
export class PatientsService {
  constructor(@Inject(DB) private readonly db: Db) {}

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

  /**
   * Patient summary: conditions, visits (optionally one doctor's), and what the doctor needs at a
   * glance from both doctors' records: last visit, last Rx, current medicines, latest labs and
   * pending tests.
   */
  async patient(patientId: string, doctorId?: string): Promise<PatientDetail> {
    assertUuid(patientId, 'Patient');
    if (doctorId !== undefined && !isUuid(doctorId)) {
      throw new BadRequestException({ code: 'invalid_query', message: 'doctorId must be a UUID' });
    }
    const p = await this.db
      .selectFrom('patients')
      .select(PATIENT_COLS)
      .where('id', '=', patientId)
      .executeTakeFirst();
    if (!p) throw new NotFoundException({ code: 'not_found', message: 'Patient not found' });

    const [allVisits, conditions, prescriptions, latestLabs, pendingTests] = await Promise.all([
      this.visitSummaries(patientId),
      this.conditions(patientId),
      this.signedPrescriptions(patientId),
      this.latestLabs(patientId),
      this.pendingTests(patientId),
    ]);

    // One per doctor: the newest signed prescription each has written (list is newest first).
    const currentMedicines: PrescriptionSummary[] = [];
    for (const rx of prescriptions) {
      if (!currentMedicines.some((c) => c.doctorId === rx.doctorId)) currentMedicines.push(rx);
    }

    return {
      patient: toPatient(p),
      conditions,
      visits: doctorId ? allVisits.filter((v) => v.doctorId === doctorId) : allVisits,
      lastVisit: allVisits.find((v) => v.status === 'signed') ?? null,
      lastRx: prescriptions[0] ?? null,
      currentMedicines,
      latestLabs,
      pendingTests,
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

  /** Adds a condition (status history starts with its first status). */
  async addCondition(
    user: AuthUser,
    patientId: string,
    input: PatientConditionInput,
  ): Promise<PatientCondition> {
    assertUuid(patientId, 'Patient');
    const id = await this.db.transaction().execute(async (trx) => {
      const p = await trx.selectFrom('patients').select('id').where('id', '=', patientId).executeTakeFirst();
      if (!p) throw new NotFoundException({ code: 'not_found', message: 'Patient not found' });
      try {
        const row = await trx
          .insertInto('patient_conditions')
          .values({
            patient_id: patientId,
            name: input.name,
            icd10_code: input.icd10Code ?? null,
            status: input.status,
            since: input.since ?? null,
            updated_by: user.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('patient_condition_history')
          .values({ condition_id: row.id, status: input.status, changed_by: user.id })
          .execute();
        return row.id;
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictException({
            code: 'condition_exists',
            message: 'Patient already has this condition; change its status instead',
          });
        }
        throw err;
      }
    });
    return this.condition(patientId, id);
  }

  /** Changes a condition's status (Active / Controlled / Resolved) and records the change. */
  async updateCondition(
    user: AuthUser,
    patientId: string,
    conditionId: string,
    input: PatientConditionUpdate,
  ): Promise<PatientCondition> {
    assertUuid(patientId, 'Patient');
    assertUuid(conditionId, 'Condition');
    await this.db.transaction().execute(async (trx) => {
      const c = await trx
        .selectFrom('patient_conditions')
        .select('status')
        .where('id', '=', conditionId)
        .where('patient_id', '=', patientId)
        .forUpdate()
        .executeTakeFirst();
      if (!c) throw new NotFoundException({ code: 'not_found', message: 'Condition not found' });
      if (c.status === input.status) return; // a retried change adds nothing
      await trx
        .updateTable('patient_conditions')
        .set({ status: input.status, updated_by: user.id, updated_at: new Date() })
        .where('id', '=', conditionId)
        .execute();
      await trx
        .insertInto('patient_condition_history')
        .values({ condition_id: conditionId, status: input.status, changed_by: user.id })
        .execute();
    });
    return this.condition(patientId, conditionId);
  }

  private async condition(patientId: string, conditionId: string): Promise<PatientCondition> {
    const found = (await this.conditions(patientId)).find((c) => c.id === conditionId);
    if (!found) throw new NotFoundException({ code: 'not_found', message: 'Condition not found' });
    return found;
  }

  /** Open conditions first (active, then controlled), then resolved; oldest first within each. */
  private async conditions(patientId: string): Promise<PatientCondition[]> {
    const rows = await this.db
      .selectFrom('patient_conditions')
      .select(['id', 'name', 'icd10_code', 'status', 'since', 'updated_at'])
      .where('patient_id', '=', patientId)
      .orderBy(sql`array_position(ARRAY['active', 'controlled', 'resolved'], status)`)
      .orderBy('created_at')
      .orderBy('name')
      .execute();
    const history = rows.length
      ? await this.db
          .selectFrom('patient_condition_history')
          .leftJoin('users', 'users.id', 'patient_condition_history.changed_by')
          .select([
            'patient_condition_history.condition_id',
            'patient_condition_history.status',
            'users.display_name',
            'patient_condition_history.changed_at',
          ])
          .where(
            'patient_condition_history.condition_id',
            'in',
            rows.map((r) => r.id),
          )
          .orderBy('patient_condition_history.changed_at')
          .orderBy('patient_condition_history.id')
          .execute()
      : [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      icd10Code: r.icd10_code,
      status: r.status,
      since: r.since,
      updatedAt: r.updated_at.toISOString(),
      history: history
        .filter((h) => h.condition_id === r.id)
        .map((h) => ({
          status: h.status,
          changedByName: h.display_name,
          changedAt: h.changed_at.toISOString(),
        })),
    }));
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
      .orderBy('visits.created_at', 'desc')
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

  /** Every signed visit's prescription that has at least one line, newest first. */
  private async signedPrescriptions(patientId: string): Promise<PrescriptionSummary[]> {
    const heads = await this.db
      .selectFrom('prescriptions')
      .innerJoin('visits', 'visits.id', 'prescriptions.visit_id')
      .innerJoin('users', 'users.id', 'visits.doctor_id')
      .select([
        'prescriptions.id',
        'prescriptions.advice',
        'visits.id as visit_id',
        'visits.visit_date',
        'visits.doctor_id',
        'users.display_name',
        'users.specialty',
      ])
      .where('visits.patient_id', '=', patientId)
      .where('visits.status', '=', 'signed')
      .orderBy('visits.visit_date', 'desc')
      .orderBy('visits.signed_at', 'desc')
      .execute();
    if (!heads.length) return [];
    const lines = await this.db
      .selectFrom('rx_lines')
      .selectAll()
      .where(
        'prescription_id',
        'in',
        heads.map((h) => h.id),
      )
      .orderBy('position')
      .execute();
    return heads
      .map((h) => ({
        visitId: h.visit_id,
        visitDate: h.visit_date,
        doctorId: h.doctor_id,
        doctorName: h.display_name,
        doctorSpecialty: h.specialty,
        advice: h.advice,
        lines: lines.filter((l) => l.prescription_id === h.id).map(toRxLine),
      }))
      .filter((rx) => rx.lines.length > 0);
  }

  /** Latest confirmed value per test code. */
  private async latestLabs(patientId: string): Promise<LatestLab[]> {
    const rows = await this.db
      .selectFrom('lab_values')
      .innerJoin('lab_reports', 'lab_reports.id', 'lab_values.lab_report_id')
      .select([
        'lab_values.test_code',
        'lab_values.test_name',
        'lab_values.value_text',
        'lab_values.unit',
        'lab_values.ref_range',
        'lab_values.flag',
        'lab_reports.report_date',
      ])
      .distinctOn('lab_values.test_code')
      .where('lab_reports.patient_id', '=', patientId)
      .where('lab_reports.confirmed', '=', true)
      .orderBy('lab_values.test_code')
      .orderBy('lab_reports.report_date', 'desc')
      .orderBy('lab_reports.created_at', 'desc')
      .execute();
    return rows.map((r) => ({
      testCode: r.test_code,
      testName: r.test_name,
      value: r.value_text,
      unit: r.unit,
      refRange: r.ref_range,
      flag: r.flag,
      reportDate: r.report_date,
    }));
  }

  /**
   * Tests ordered on signed visits that are still waiting. A lab test is done once a confirmed
   * result for its code is dated on or after the visit. A test without a code (imaging, OCT…)
   * counts as pending until the ordering doctor's next signed visit for this patient.
   */
  private async pendingTests(patientId: string): Promise<PendingTest[]> {
    const orders = await this.db
      .selectFrom('investigation_orders')
      .innerJoin('visits', 'visits.id', 'investigation_orders.visit_id')
      .innerJoin('users', 'users.id', 'visits.doctor_id')
      .select([
        'investigation_orders.test_name',
        'investigation_orders.test_code',
        'visits.id as visit_id',
        'visits.visit_date',
        'visits.doctor_id',
        'users.display_name',
      ])
      .where('visits.patient_id', '=', patientId)
      .where('visits.status', '=', 'signed')
      .orderBy('visits.visit_date', 'desc')
      .orderBy('investigation_orders.position')
      .execute();
    if (!orders.length) return [];

    const [results, signed] = await Promise.all([
      this.db
        .selectFrom('lab_values')
        .innerJoin('lab_reports', 'lab_reports.id', 'lab_values.lab_report_id')
        .select(['lab_values.test_code', 'lab_reports.report_date'])
        .where('lab_reports.patient_id', '=', patientId)
        .where('lab_reports.confirmed', '=', true)
        .execute(),
      this.db
        .selectFrom('visits')
        .select(['doctor_id', 'visit_date'])
        .where('patient_id', '=', patientId)
        .where('status', '=', 'signed')
        .execute(),
    ]);

    return orders
      .filter((o) =>
        o.test_code
          ? !results.some((r) => r.test_code === o.test_code && r.report_date >= o.visit_date)
          : !signed.some((v) => v.doctor_id === o.doctor_id && v.visit_date > o.visit_date),
      )
      .map((o) => ({
        testName: o.test_name,
        testCode: o.test_code,
        visitId: o.visit_id,
        visitDate: o.visit_date,
        doctorId: o.doctor_id,
        doctorName: o.display_name,
      }));
  }
}
