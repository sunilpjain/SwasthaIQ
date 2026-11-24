import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  ConsultField,
  Diagnosis,
  LabReport,
  RxLine,
  SignProblem,
  VisitAmendment,
  VisitAmendmentInput,
  VisitDetail,
  VisitDraftInput,
} from '@swasthyaiq/shared';
import { sql, type Transaction } from 'kysely';
import type { AuthUser } from '../auth/auth.decorators';
import { IST_OFFSET_MS } from '../clinic/queue-schedule';
import { DB, type Db } from '../db/database';
import type { Database } from '../db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id: string, what: string): void {
  if (!UUID_RE.test(id)) throw new NotFoundException({ code: 'not_found', message: `${what} not found` });
}

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Device clocks can run ahead; an edit is never treated as newer than the moment it reached us. */
export function clampToNow(clientTime: string, now: Date): Date {
  const t = new Date(clientTime);
  return t.getTime() > now.getTime() ? now : t;
}

/** The signed note is version 1; each amendment adds one. */
export const currentVersion = sql<number>`coalesce((SELECT max(a.version) FROM visit_amendments a WHERE a.visit_id = visits.id), visits.version)`;

interface AmendmentChanges {
  fields?: VisitAmendmentInput['fields'];
  diagnoses?: Diagnosis[];
}

type Trx = Transaction<Database>;

/** Postgres raised by the signed-visit triggers (another request signed in between). */
function isSignedGuard(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '23514' && /read-only/.test(e.message ?? '');
}

const signedConflict = () =>
  new ConflictException({ code: 'visit_signed', message: 'Visit is signed; add an amendment instead' });

@Injectable()
export class VisitsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Creates or updates the doctor's draft. Idempotent: the app picks the visit id, and every
   * field carries the device time of its edit, so replaying an offline queue in any order
   * ends in the same note.
   */
  async saveDraft(
    user: AuthUser,
    visitId: string,
    input: VisitDraftInput,
    now = new Date(),
  ): Promise<VisitDetail> {
    assertUuid(visitId, 'Visit');
    try {
      await this.db.transaction().execute(async (trx) => {
        const patient = await trx
          .selectFrom('patients')
          .select('id')
          .where('id', '=', input.patientId)
          .executeTakeFirst();
        if (!patient) throw new NotFoundException({ code: 'not_found', message: 'Patient not found' });

        await trx
          .insertInto('visits')
          .values({
            id: visitId,
            patient_id: input.patientId,
            doctor_id: user.id,
            visit_date: istToday(now),
            diagnosis: null,
            icd10_code: null,
            follow_up: null,
            signed_at: null,
          })
          .onConflict((oc) => oc.column('id').doNothing())
          .execute();
        const v = await this.lockVisit(trx, visitId);
        if (v.doctor_id !== user.id) throw this.notYours();
        if (v.patient_id !== input.patientId) {
          throw new ConflictException({
            code: 'patient_mismatch',
            message: 'Visit belongs to another patient',
          });
        }
        if (v.status === 'signed') throw signedConflict();

        for (const f of input.fields ?? []) {
          const at = clampToNow(f.clientUpdatedAt, now);
          await trx
            .insertInto('consult_fields')
            .values({
              visit_id: visitId,
              section: f.section,
              key: f.key,
              value: f.value,
              source: f.source,
              confirmed: f.confirmed,
              confidence: null,
              original_language: null,
              original_transcript: null,
              client_updated_at: at,
            })
            .onConflict((oc) =>
              oc
                .columns(['visit_id', 'section', 'key'])
                .doUpdateSet({
                  value: (eb) => eb.ref('excluded.value'),
                  source: (eb) => eb.ref('excluded.source'),
                  confirmed: (eb) => eb.ref('excluded.confirmed'),
                  client_updated_at: (eb) => eb.ref('excluded.client_updated_at'),
                  updated_at: sql<Date>`now()`,
                })
                .where((eb) =>
                  eb.or([
                    eb('consult_fields.client_updated_at', 'is', null),
                    eb('consult_fields.client_updated_at', '<=', at),
                  ]),
                ),
            )
            .execute();
        }

        if (input.diagnoses && input.diagnosesClientUpdatedAt) {
          const at = clampToNow(input.diagnosesClientUpdatedAt, now);
          const stored = v.diagnoses_client_updated_at;
          if (!stored || stored.getTime() <= at.getTime()) {
            await trx.deleteFrom('visit_diagnoses').where('visit_id', '=', visitId).execute();
            if (input.diagnoses.length) {
              await trx
                .insertInto('visit_diagnoses')
                .values(
                  input.diagnoses.map((d, i) => ({
                    visit_id: visitId,
                    position: i + 1,
                    kind: d.kind,
                    icd10_code: d.icd10Code,
                    label: d.label,
                  })),
                )
                .execute();
            }
            await trx
              .updateTable('visits')
              .set({ diagnoses_client_updated_at: at })
              .where('id', '=', visitId)
              .execute();
          }
        }

        if (input.investigations && input.investigationsClientUpdatedAt) {
          const at = clampToNow(input.investigationsClientUpdatedAt, now);
          const stored = v.investigations_client_updated_at;
          if (!stored || stored.getTime() <= at.getTime()) {
            await trx.deleteFrom('investigation_orders').where('visit_id', '=', visitId).execute();
            if (input.investigations.length) {
              await trx
                .insertInto('investigation_orders')
                .values(
                  input.investigations.map((o, i) => ({
                    visit_id: visitId,
                    position: i + 1,
                    test_name: o.testName,
                    test_code: o.testCode,
                  })),
                )
                .execute();
            }
            await trx
              .updateTable('visits')
              .set({ investigations_client_updated_at: at })
              .where('id', '=', visitId)
              .execute();
          }
        }

        if (input.followUp !== undefined) {
          await trx
            .updateTable('visits')
            .set({ follow_up: input.followUp })
            .where('id', '=', visitId)
            .execute();
        }
      });
    } catch (err) {
      if (isSignedGuard(err)) throw signedConflict();
      throw err;
    }
    return this.detail(visitId);
  }

  /**
   * Signs the draft: checks it is complete, locks it (the triggers keep it read-only from now on)
   * and sets the patient's queue entry to Done, all in one transaction. Signing a visit that is
   * already signed returns it unchanged, so a retried call from the offline queue is safe.
   */
  async sign(user: AuthUser, visitId: string): Promise<VisitDetail> {
    assertUuid(visitId, 'Visit');
    await this.db.transaction().execute(async (trx) => {
      const v = await this.lockVisit(trx, visitId);
      if (v.doctor_id !== user.id) throw this.notYours();
      if (v.status === 'signed') return;

      const diagnoses = await trx
        .selectFrom('visit_diagnoses')
        .select(['kind', 'icd10_code', 'label'])
        .where('visit_id', '=', visitId)
        .orderBy('position')
        .execute();
      const unconfirmed = await trx
        .selectFrom('consult_fields')
        .select(['section', 'key'])
        .where('visit_id', '=', visitId)
        .where('confirmed', '=', false)
        .where('source', '!=', 'typed')
        .orderBy('section')
        .orderBy('key')
        .execute();
      const problems: SignProblem[] = [];
      if (diagnoses.length === 0) problems.push({ code: 'no_diagnosis' });
      if (unconfirmed.length) {
        problems.push({
          code: 'unconfirmed_fields',
          fields: unconfirmed.map((f) => `${f.section}.${f.key}`),
        });
      }
      if (problems.length) {
        throw new UnprocessableEntityException({
          code: 'sign_blocked',
          message: 'Visit cannot be signed yet',
          problems,
        });
      }

      const primary = diagnoses[0]!;
      await trx
        .updateTable('visits')
        .set({
          status: 'signed',
          signed_at: new Date(),
          diagnosis: primary.label,
          icd10_code: primary.icd10_code,
        })
        .where('id', '=', visitId)
        .execute();
      await trx
        .updateTable('queue_entries')
        .set({
          status: 'done',
          in_consult_with: null,
          status_changed_at: new Date(),
          checked_in_at: sql<Date>`coalesce(checked_in_at, now())`,
        })
        .where('patient_id', '=', v.patient_id)
        .execute();
    });
    return this.detail(visitId);
  }

  /**
   * Adds a dated amendment to a signed visit. The signed note is kept as it was; the amendment
   * records what changed and why. The app picks the amendment id, so a retry is idempotent.
   */
  async amend(user: AuthUser, visitId: string, input: VisitAmendmentInput): Promise<VisitDetail> {
    assertUuid(visitId, 'Visit');
    await this.db.transaction().execute(async (trx) => {
      const v = await this.lockVisit(trx, visitId);
      if (v.doctor_id !== user.id) throw this.notYours();
      if (v.status !== 'signed') {
        throw new ConflictException({
          code: 'visit_not_signed',
          message: 'Edit the draft instead of amending it',
        });
      }
      const existing = await trx
        .selectFrom('visit_amendments')
        .select('visit_id')
        .where('id', '=', input.id)
        .executeTakeFirst();
      if (existing) {
        if (existing.visit_id !== visitId) {
          throw new ConflictException({ code: 'amendment_id_taken', message: 'Amendment id already used' });
        }
        return;
      }
      const last = await trx
        .selectFrom('visit_amendments')
        .select((eb) => eb.fn.max('version').as('max'))
        .where('visit_id', '=', visitId)
        .executeTakeFirst();
      const changes: AmendmentChanges = {};
      if (input.fields?.length) changes.fields = input.fields;
      if (input.diagnoses) changes.diagnoses = input.diagnoses;
      await trx
        .insertInto('visit_amendments')
        .values({
          id: input.id,
          visit_id: visitId,
          version: (last?.max ?? v.version) + 1,
          amended_by: user.id,
          reason: input.reason,
          changes: JSON.stringify(changes),
        })
        .execute();
    });
    return this.detail(visitId);
  }

  async detail(visitId: string): Promise<VisitDetail> {
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
        'visits.diagnosis',
        'visits.icd10_code',
        'visits.is_seed',
        'visits.signed_at',
        'visits.follow_up',
        currentVersion.as('version'),
      ])
      .where('visits.id', '=', visitId)
      .executeTakeFirst();
    if (!v) throw new NotFoundException({ code: 'not_found', message: 'Visit not found' });

    const [investigations, diagRows, fields, rx, reports, amendments] = await Promise.all([
      this.db
        .selectFrom('investigation_orders')
        .select(['test_name', 'test_code'])
        .where('visit_id', '=', visitId)
        .orderBy('position')
        .execute(),
      this.db
        .selectFrom('visit_diagnoses')
        .select(['kind', 'icd10_code', 'label'])
        .where('visit_id', '=', visitId)
        .orderBy('position')
        .execute(),
      this.db
        .selectFrom('consult_fields')
        .select(['section', 'key', 'value', 'source', 'confirmed'])
        .where('visit_id', '=', visitId)
        .orderBy('section')
        .orderBy('key')
        .execute(),
      this.db
        .selectFrom('rx_lines')
        .innerJoin('prescriptions', 'prescriptions.id', 'rx_lines.prescription_id')
        .selectAll('rx_lines')
        .where('prescriptions.visit_id', '=', visitId)
        .orderBy('rx_lines.position')
        .execute(),
      this.db
        .selectFrom('lab_reports')
        .select(['id', 'report_date', 'lab_name'])
        .where('visit_id', '=', visitId)
        .orderBy('report_date', 'desc')
        .execute(),
      this.db
        .selectFrom('visit_amendments')
        .innerJoin('users', 'users.id', 'visit_amendments.amended_by')
        .select([
          'visit_amendments.id',
          'visit_amendments.version',
          'visit_amendments.amended_by',
          'users.display_name',
          'visit_amendments.reason',
          'visit_amendments.changes',
          'visit_amendments.created_at',
        ])
        .where('visit_amendments.visit_id', '=', visitId)
        .orderBy('visit_amendments.version')
        .execute(),
    ]);

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

    // Seed visits predate visit_diagnoses and carry their one diagnosis on the visit row.
    const diagnoses: Diagnosis[] = diagRows.length
      ? diagRows.map((d) => ({ kind: d.kind, icd10Code: d.icd10_code, label: d.label }))
      : v.diagnosis
        ? [{ kind: v.icd10_code ? 'icd10' : 'misc', icd10Code: v.icd10_code, label: v.diagnosis }]
        : [];

    const consultFields: ConsultField[] = fields.map((f) => ({ ...f }));

    const amendmentList: VisitAmendment[] = amendments.map((a) => {
      const c = (typeof a.changes === 'string' ? JSON.parse(a.changes) : a.changes) as AmendmentChanges;
      return {
        id: a.id,
        version: a.version,
        amendedBy: a.amended_by,
        amendedByName: a.display_name,
        reason: a.reason,
        fields: c.fields ?? [],
        diagnoses: c.diagnoses ?? null,
        createdAt: a.created_at.toISOString(),
      };
    });

    return {
      id: v.id,
      patientId: v.patient_id,
      doctorId: v.doctor_id,
      doctorName: v.display_name,
      doctorSpecialty: v.specialty,
      visitDate: v.visit_date,
      status: v.status,
      version: Number(v.version),
      diagnosis: v.diagnosis,
      isSeed: v.is_seed,
      signedAt: v.signed_at?.toISOString() ?? null,
      followUp: v.follow_up,
      diagnoses,
      investigations: investigations.map((o) => ({ testName: o.test_name, testCode: o.test_code })),
      fields: consultFields,
      rxLines,
      labReports,
      amendments: amendmentList,
    };
  }

  private async lockVisit(trx: Trx, visitId: string) {
    const v = await trx
      .selectFrom('visits')
      .select([
        'id',
        'patient_id',
        'doctor_id',
        'status',
        'version',
        'diagnoses_client_updated_at',
        'investigations_client_updated_at',
      ])
      .where('id', '=', visitId)
      .forUpdate()
      .executeTakeFirst();
    if (!v) throw new NotFoundException({ code: 'not_found', message: 'Visit not found' });
    return v;
  }

  private notYours(): ForbiddenException {
    return new ForbiddenException({
      code: 'not_your_visit',
      message: 'Only the visit’s doctor can change it',
    });
  }
}
