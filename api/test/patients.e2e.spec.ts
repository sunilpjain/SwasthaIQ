import { readdir, mkdtemp, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { sql } from 'kysely';
import type { PatientCondition, PatientDetail } from '@swasthyaiq/shared';
import { startApp, TEST_DB_URL, type TestApp } from './helpers';
import { seedUuid } from '../src/seed/seed';
import { createDb } from '../src/db/database';
import { migrate, MIGRATIONS_DIR } from '../src/db/migrate';

describe('patient summary, history and conditions (DIG-40)', () => {
  let t: TestApp;
  let saiyam: string;
  let samradnyee: string;
  let admin: string;
  const http = () => request(t.app.getHttpServer());
  const SAIYAM = seedUuid('user:saiyam');
  const SAMRADNYEE = seedUuid('user:samradnyee');
  const pid = (token: string) => seedUuid(`patient:${token}`);
  const summary = async (token: string, tok = saiyam, query = ''): Promise<PatientDetail> =>
    (
      await http()
        .get(`/patients/${pid(token)}${query}`)
        .set('Authorization', `Bearer ${tok}`)
        .expect(200)
    ).body as PatientDetail;

  beforeAll(async () => {
    t = await startApp();
    saiyam = await t.tokenFor('saiyam');
    samradnyee = await t.tokenFor('samradnyee');
    admin = await t.tokenFor('admin');
  });

  afterAll(async () => {
    await t.app.close();
    await t.db.destroy();
  });

  describe('summary', () => {
    it('gives last visit, last Rx, latest labs per test and no pending tests once results are in', async () => {
      const s = await summary('G3');
      expect(s.lastVisit).toMatchObject({ visitDate: '2026-09-18', doctorName: 'Dr. Saiyam Shah' });
      expect(s.lastRx).toMatchObject({ visitDate: '2026-09-18', doctorId: SAIYAM });
      expect(s.lastRx?.lines.length).toBeGreaterThan(0);
      const labs = Object.fromEntries(s.latestLabs.map((l) => [l.testCode, [l.value, l.reportDate]]));
      expect(labs).toEqual({
        ALT: ['94', '2026-09-16'],
        AST: ['55', '2026-09-16'],
        ALP: ['98', '2026-07-08'],
      });
      // LFT ordered on 10 Jul, result on 16 Sep: done.
      expect(s.pendingTests).toEqual([]);
    });

    it('lists pending tests: labs with no later result, and imaging until the doctor’s next visit', async () => {
      const g2 = await summary('G2');
      expect(g2.pendingTests.map((p) => [p.testName, p.testCode])).toEqual([
        ['Complete blood count', 'HB'],
        ['Liver function tests', 'ALT'],
        ['ECG', null],
      ]);
      expect(g2.pendingTests[0]).toMatchObject({ visitDate: '2026-10-23', doctorId: SAIYAM });

      const g6 = await summary('G6'); // HbA1c ordered 11 Sep; the last result is from 9 Sep
      expect(g6.pendingTests.map((p) => p.testCode)).toEqual(['HBA1C']);

      const e2 = await summary('E2', samradnyee); // OCT ordered at Dr. Samradnyee's last visit
      expect(e2.pendingTests).toEqual([
        expect.objectContaining({ testName: 'OCT macula', doctorId: SAMRADNYEE }),
      ]);
    });

    it('returns an empty summary for a new patient', async () => {
      const s = await summary('G5');
      expect(s).toMatchObject({
        visits: [],
        conditions: [],
        lastVisit: null,
        lastRx: null,
        currentMedicines: [],
        latestLabs: [],
        pendingTests: [],
      });
    });

    it('labels every visit with the doctor and filters the list by doctor', async () => {
      const all = await summary('E2');
      expect(all.visits.map((v) => [v.visitDate, v.doctorName, v.doctorSpecialty])).toEqual([
        ['2026-10-16', 'Dr. Samradnyee Shah', 'eye'],
        ['2026-08-28', 'Dr. Saiyam Shah', 'gastro'],
      ]);
      const mine = await summary('E2', saiyam, `?doctorId=${SAIYAM}`);
      expect(mine.visits.map((v) => v.visitDate)).toEqual(['2026-08-28']);
      expect(mine.lastVisit?.visitDate).toBe('2026-10-16'); // the summary is never filtered
      await http()
        .get(`/patients/${pid('E2')}?doctorId=saiyam`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(400);
    });

    it('shows each doctor’s latest signed Rx as current medicines; drafts never count', async () => {
      // Dr. Samradnyee prescribes for E2 in a new visit: a draft first, then signed.
      const V = 'b1b2c3d4-0000-4000-8000-000000000001';
      await http()
        .put(`/visits/${V}`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .send({
          patientId: pid('E2'),
          diagnoses: [{ kind: 'icd10', icd10Code: 'E11.329', label: 'Moderate NPDR' }],
          diagnosesClientUpdatedAt: new Date().toISOString(),
        })
        .expect(200);
      const rx = await t.db
        .insertInto('prescriptions')
        .values({ visit_id: V, advice: null, pdf_s3_key: null })
        .returning('id')
        .executeTakeFirstOrThrow();
      await t.db
        .insertInto('rx_lines')
        .values({
          prescription_id: rx.id,
          position: 1,
          medicine_brand: 'Nepafenac (sample brand)',
          medicine_generic: 'Nepafenac 0.1%',
          form: 'Eye drops',
          eye: 'BE',
          dose: '1 drop',
          frequency: 'TDS',
          timing: null,
          duration: '4 weeks',
          taper: null,
          instructions_en: null,
          instructions_local: null,
          instructions_language: null,
        })
        .execute();

      const draft = await summary('E2');
      expect(draft.currentMedicines.map((m) => m.doctorId)).toEqual([SAIYAM]);
      expect(draft.lastVisit?.visitDate).toBe('2026-10-16');

      await http().post(`/visits/${V}/sign`).set('Authorization', `Bearer ${samradnyee}`).expect(200);
      const signed = await summary('E2');
      expect(signed.currentMedicines.map((m) => [m.doctorId, m.doctorSpecialty])).toEqual([
        [SAMRADNYEE, 'eye'],
        [SAIYAM, 'gastro'],
      ]);
      expect(signed.lastRx?.visitId).toBe(V);
      expect(signed.lastVisit?.id).toBe(V);
    });
  });

  describe('conditions', () => {
    it('lists seed conditions with status; "(past)" ones are resolved and not on the patient card', async () => {
      const e5 = await summary('E5', samradnyee);
      expect(e5.conditions).toEqual([
        expect.objectContaining({ name: 'Allergic conjunctivitis', status: 'resolved', icd10Code: null }),
      ]);
      expect(e5.conditions[0]!.history).toEqual([
        { status: 'resolved', changedByName: null, changedAt: expect.any(String) },
      ]);
      expect(e5.patient.conditions).toEqual([]);
      const g6 = await summary('G6');
      expect(g6.patient.conditions).toEqual(['Chronic pancreatitis', 'Type 2 diabetes', 'Mild NPDR']);
    });

    it('changes a status, keeps the history and is a no-op when repeated', async () => {
      const g1 = await summary('G1');
      const gerd = g1.conditions.find((c) => c.name === 'GERD')!;
      const url = `/patients/${pid('G1')}/conditions/${gerd.id}`;
      const res = await http()
        .patch(url)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ status: 'controlled' })
        .expect(200);
      const c = res.body as PatientCondition;
      expect(c.status).toBe('controlled');
      expect(c.history.map((h) => [h.status, h.changedByName])).toEqual([
        ['active', null],
        ['controlled', 'Dr. Saiyam Shah'],
      ]);
      const again = await http()
        .patch(url)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ status: 'controlled' });
      expect(again.body.history).toHaveLength(2);
      // Both doctors may update (prototype rule).
      const resolved = await http()
        .patch(url)
        .set('Authorization', `Bearer ${samradnyee}`)
        .send({ status: 'resolved' })
        .expect(200);
      expect(resolved.body.history.map((h: { status: string }) => h.status)).toEqual([
        'active',
        'controlled',
        'resolved',
      ]);
      const after = await summary('G1');
      expect(after.conditions.map((x) => [x.name, x.status])).toEqual([
        ['Grade B oesophagitis', 'active'],
        ['GERD', 'resolved'],
      ]);
      expect(after.patient.conditions).toEqual(['Grade B oesophagitis']);
    });

    it('adds a condition and refuses a duplicate', async () => {
      const url = `/patients/${pid('G5')}/conditions`;
      const res = await http()
        .post(url)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ name: 'Hypothyroidism', icd10Code: 'E03.9', status: 'controlled', since: '2024-01-15' })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Hypothyroidism',
        icd10Code: 'E03.9',
        status: 'controlled',
        since: '2024-01-15',
      });
      expect(res.body.history).toHaveLength(1);
      const dup = await http()
        .post(url)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ name: 'Hypothyroidism', status: 'active' })
        .expect(409);
      expect(dup.body.code).toBe('condition_exists');
    });

    it('404s unknown patients and conditions, 400s bad bodies, and is doctor-only', async () => {
      const ghost = '00000000-0000-4000-8000-000000000000';
      await http()
        .post(`/patients/${ghost}/conditions`)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ name: 'X', status: 'active' })
        .expect(404);
      await http()
        .patch(`/patients/${pid('G1')}/conditions/${ghost}`)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ status: 'active' })
        .expect(404);
      // A condition of another patient is not found under this one.
      const e4 = await summary('E4', samradnyee);
      await http()
        .patch(`/patients/${pid('G1')}/conditions/${e4.conditions[0]!.id}`)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ status: 'resolved' })
        .expect(404);
      const bad = await http()
        .post(`/patients/${pid('G1')}/conditions`)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ name: 'X', status: 'gone' })
        .expect(400);
      expect(bad.body.code).toBe('invalid_body');
      await http()
        .patch(`/patients/${pid('G1')}/conditions/${e4.conditions[0]!.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ status: 'active' })
        .expect(403);
    });

    it('keeps the status history append-only at the database level', async () => {
      await expect(sql`UPDATE patient_condition_history SET status = 'active'`.execute(t.db)).rejects.toThrow(
        /append-only/,
      );
      await expect(sql`DELETE FROM patient_condition_history`.execute(t.db)).rejects.toThrow(/append-only/);
    });
  });

  describe('audit', () => {
    it('audits opening the other doctor’s visit, not your own', async () => {
      const eye = seedUuid('visit:E2-v2');
      const gastro = seedUuid('visit:E2-v1');
      await http().get(`/visits/${eye}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      await http().get(`/visits/${gastro}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      const rows = await t.db
        .selectFrom('audit_log')
        .select(['username', 'entity_id', 'entity_type', 'http_method', 'status_code'])
        .where('action', '=', 'visit.read_other_doctor')
        .execute();
      expect(rows).toEqual([
        { username: 'saiyam', entity_id: eye, entity_type: 'visit', http_method: 'GET', status_code: 200 },
      ]);
    });

    it('audits condition changes against the condition id', async () => {
      const rows = await t.db
        .selectFrom('audit_log')
        .select(['action', 'entity_id', 'status_code'])
        .where('action', 'like', 'condition.%')
        .execute();
      expect(rows.some((r) => r.action === 'condition.update_status' && r.status_code === 200)).toBe(true);
      expect(rows.some((r) => r.action === 'condition.add' && r.status_code === 201)).toBe(true);
      expect(rows.some((r) => r.action === 'condition.add' && r.status_code === 409)).toBe(true);
    });

    it('returns investigations on the visit record', async () => {
      const res = await http()
        .get(`/visits/${seedUuid('visit:G2-v1')}`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(res.body.investigations).toEqual([
        { testName: 'Complete blood count', testCode: 'HB' },
        { testName: 'Liver function tests', testCode: 'ALT' },
        { testName: 'ECG', testCode: null },
      ]);
    });
  });
});

describe('migration 004 on a database that already has data', () => {
  it('moves the old conditions list across and adds orders to signed seed visits', async () => {
    const db = createDb({ connectionString: TEST_DB_URL, max: 2 });
    try {
      await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(db);
      await sql`CREATE SCHEMA public`.execute(db);
      const upTo003 = await mkdtemp(join(tmpdir(), 'swasthyaiq-mig-'));
      for (const f of (await readdir(MIGRATIONS_DIR)).filter((f) => f < '004')) {
        await copyFile(join(MIGRATIONS_DIR, f), join(upTo003, f));
      }
      await migrate(db, upTo003);

      await sql`INSERT INTO users (id, username, display_name, role, specialty) VALUES
        (${seedUuid('user:saiyam')}, 'saiyam', 'Dr. Saiyam Shah', 'doctor', 'gastro')`.execute(db);
      await sql`INSERT INTO patients (id, token, full_name, age_years, sex, primary_doctor_id, conditions, is_seed)
        VALUES (${pid('G2')}, 'G2', 'Test Patient', 40, 'F', ${seedUuid('user:saiyam')},
                ARRAY['Cholelithiasis', 'Allergic conjunctivitis (past)'], true)`.execute(db);
      await sql`INSERT INTO visits (id, patient_id, doctor_id, visit_date, is_seed, status, signed_at)
        VALUES (${seedUuid('visit:G2-v1')}, ${pid('G2')}, ${seedUuid('user:saiyam')}, '2026-10-23', true, 'signed', now())`.execute(
        db,
      );

      expect(await migrate(db)).toEqual(['004_patient_history.sql']);

      const conditions = await sql<{ name: string; status: string; is_seed: boolean }>`
        SELECT name, status, is_seed FROM patient_conditions ORDER BY name`.execute(db);
      expect(conditions.rows).toEqual([
        { name: 'Allergic conjunctivitis', status: 'resolved', is_seed: true },
        { name: 'Cholelithiasis', status: 'active', is_seed: true },
      ]);
      const history = await sql<{ n: string }>`SELECT count(*) AS n FROM patient_condition_history`.execute(
        db,
      );
      expect(Number(history.rows[0]!.n)).toBe(2);
      const orders = await sql<{
        test_name: string;
      }>`SELECT test_name FROM investigation_orders ORDER BY position`.execute(db);
      expect(orders.rows.map((r) => r.test_name)).toEqual([
        'Complete blood count',
        'Liver function tests',
        'ECG',
      ]);
      // From now on the guard trigger keeps them read-only.
      await expect(sql`DELETE FROM investigation_orders`.execute(db)).rejects.toThrow(/read-only/);
    } finally {
      await db.destroy();
    }
  });
});

function pid(token: string): string {
  return seedUuid(`patient:${token}`);
}
