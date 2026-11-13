import request from 'supertest';
import { sql } from 'kysely';
import type { QueueEntry } from '@swasthyaiq/shared';
import { startApp, type TestApp } from './helpers';
import { seed, seedUuid } from '../src/seed/seed';

describe('API integration (real PostgreSQL)', () => {
  let t: TestApp;
  let saiyam: string;
  let samradnyee: string;
  let admin: string;
  const http = () => request(t.app.getHttpServer());
  const G3 = seedUuid('patient:G3');
  const E2 = seedUuid('patient:E2');

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

  describe('GET /health', () => {
    it('is public and reports the database up', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', db: 'up', version: 'test' });
    });
  });

  describe('GET /me', () => {
    it('returns the doctor profile', async () => {
      const res = await http().get('/me').set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(res.body).toMatchObject({ username: 'saiyam', role: 'doctor', specialty: 'gastro' });
    });
    it('works for admin too', async () => {
      const res = await http().get('/me').set('Authorization', `Bearer ${admin}`).expect(200);
      expect(res.body.role).toBe('admin');
    });
    it('rejects a request with no token', async () => {
      const res = await http().get('/me').expect(401);
      expect(res.body.code).toBe('token_missing');
    });
  });

  describe('auth (DIG-37)', () => {
    it('rejects an expired token', async () => {
      const old = await t.tokenFor('saiyam', { iat: Math.floor(Date.now() / 1000) - 7200, expiresIn: 60 });
      const res = await http().get('/queue').set('Authorization', `Bearer ${old}`).expect(401);
      expect(res.body.code).toBe('token_expired');
    });
    it('rejects an ID token, a foreign client and a foreign issuer', async () => {
      for (const extra of [{ tokenUse: 'id' }, { clientId: 'other' }, { issuer: 'https://evil.example' }]) {
        const bad = await t.tokenFor('saiyam', extra);
        const res = await http().get('/queue').set('Authorization', `Bearer ${bad}`).expect(401);
        expect(res.body.code).toBe('token_invalid');
      }
    });
    it('rejects a malformed Authorization header', async () => {
      await http().get('/queue').set('Authorization', 'Basic abc').expect(401);
      await http().get('/queue').set('Authorization', 'Bearer not.a.jwt').expect(401);
    });
    it('rejects an unknown user', async () => {
      const ghost = await t.tokenFor('ghost', { groups: ['doctor'] });
      const res = await http().get('/me').set('Authorization', `Bearer ${ghost}`).expect(401);
      expect(res.body.code).toBe('unknown_user');
    });
    it('rejects a token whose Cognito group does not match the DB role', async () => {
      const t2 = await t.tokenFor('saiyam', { groups: ['admin'] });
      const res = await http().get('/me').set('Authorization', `Bearer ${t2}`).expect(403);
      expect(res.body.code).toBe('role_mismatch');
    });
    it('keeps admin out of doctor endpoints and doctors out of admin endpoints', async () => {
      const a = await http().get('/queue').set('Authorization', `Bearer ${admin}`).expect(403);
      expect(a.body.code).toBe('wrong_role');
      await http().get('/admin/users').set('Authorization', `Bearer ${saiyam}`).expect(403);
      await http().post('/admin/queue/reset').set('Authorization', `Bearer ${samradnyee}`).expect(403);
    });
  });

  describe('queue', () => {
    it('lists all 12 patients with the doctor’s own first', async () => {
      const res = await http().get('/queue').set('Authorization', `Bearer ${samradnyee}`).expect(200);
      const q = res.body as QueueEntry[];
      expect(q).toHaveLength(12);
      expect(q.slice(0, 6).every((e) => e.isMine)).toBe(true);
      expect(q.map((e) => e.patient.token)).toEqual([
        'E1',
        'E2',
        'E3',
        'E4',
        'E5',
        'E6',
        'G1',
        'G2',
        'G3',
        'G4',
        'G5',
        'G6',
      ]);
      expect(q.every((e) => e.status === 'waiting')).toBe(true);
    });

    it('opening a patient sets In consult; a second doctor gets a warning, not a lock', async () => {
      const r1 = await http().post(`/queue/${G3}/open`).set('Authorization', `Bearer ${saiyam}`).expect(201);
      expect(r1.body.status).toBe('in_consult');
      const r2 = await http()
        .post(`/queue/${G3}/open`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(409);
      expect(r2.body.code).toBe('in_consult_with_other_doctor');
      const r3 = await http()
        .post(`/queue/${G3}/open?force=true`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(201);
      expect(r3.body.status).toBe('in_consult');
    });

    it('404s an unknown patient and 400s a non-UUID', async () => {
      await http()
        .post(`/queue/${seedUuid('nobody')}/open`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(404);
      await http().post('/queue/not-a-uuid/open').set('Authorization', `Bearer ${saiyam}`).expect(400);
    });
  });

  describe('patients and visits', () => {
    it('shows a shared patient’s visits by both doctors, newest first', async () => {
      const res = await http().get(`/patients/${E2}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(res.body.patient.fullName).toBe('Nilesh Rana');
      const doctors = res.body.visits.map((v: { doctorName: string }) => v.doctorName);
      expect(doctors).toEqual(['Dr. Samradnyee Shah', 'Dr. Saiyam Shah']);
      expect(res.body.visits.every((v: { status: string }) => v.status === 'signed')).toBe(true);
    });

    it('returns visit detail with fields, Rx lines and labs', async () => {
      const res = await http()
        .get(`/visits/${seedUuid('visit:E6-v1')}`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(200);
      expect(res.body.rxLines).toHaveLength(2);
      expect(res.body.rxLines[0]).toMatchObject({ medicineBrand: 'Pred Forte', eye: 'RE' });
      expect(res.body.rxLines[0].taper).toContain('week 4');
      const labs = await http()
        .get(`/visits/${seedUuid('visit:G3-v2')}`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(
        labs.body.labReports[0].values.find((v: { testCode: string }) => v.testCode === 'ALT').value,
      ).toBe('94');
    });

    it('gives trend data: Imran’s ALT and Nilesh’s HbA1c', async () => {
      const alt = await http()
        .get(`/patients/${G3}/labs/alt/trend`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(alt.body.map((p: { value: string }) => p.value)).toEqual(['112', '94']);
      const a1c = await http()
        .get(`/patients/${E2}/labs/HBA1C/trend`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(a1c.body.map((p: { value: string }) => p.value)).toEqual(['9.2', '8.4']);
    });

    it('searches by name, phone and token', async () => {
      const byName = await http()
        .get('/patients?q=kanta')
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(byName.body[0].token).toBe('E1');
      const byPhone = await http()
        .get('/patients?q=10004')
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(byPhone.body[0].token).toBe('G4');
      const byToken = await http().get('/patients?q=g6').set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(byToken.body[0].fullName).toBe('Harish Mehta');
      const short = await http().get('/patients?q=a').set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(short.body).toEqual([]);
    });

    it('404s unknown patients and visits', async () => {
      await http()
        .get(`/patients/${seedUuid('none')}`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(404);
      await http()
        .get(`/visits/${seedUuid('none')}`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(404);
    });
  });

  describe('data model rules (DIG-2)', () => {
    it('signed visits are read-only at the database level', async () => {
      const id = seedUuid('visit:G1-v1');
      await expect(
        sql`UPDATE visits SET diagnosis = 'changed' WHERE id = ${id}`.execute(t.db),
      ).rejects.toThrow(/read-only/);
      await expect(sql`DELETE FROM visits WHERE id = ${id}`.execute(t.db)).rejects.toThrow(
        /cannot be deleted/,
      );
      await expect(
        sql`UPDATE consult_fields SET value = 'x' WHERE visit_id = ${id}`.execute(t.db),
      ).rejects.toThrow(/read-only/);
      await expect(
        sql`UPDATE rx_lines SET dose = '2' WHERE prescription_id = ${seedUuid('rx:G1-v1')}`.execute(t.db),
      ).rejects.toThrow(/read-only/);
    });

    it('amendments are stored separately', async () => {
      const id = seedUuid('visit:G1-v1');
      await t.db
        .insertInto('visit_amendments')
        .values({
          visit_id: id,
          version: 2,
          amended_by: seedUuid('user:saiyam'),
          reason: 'typo',
          changes: JSON.stringify({ diagnosis: 'GERD' }),
        })
        .execute();
      const n = await t.db
        .selectFrom('visit_amendments')
        .select(t.db.fn.countAll().as('n'))
        .executeTakeFirstOrThrow();
      expect(Number(n.n)).toBe(1);
    });
  });

  describe('admin (DIG-36 seed actions)', () => {
    it('Clear test visits removes only visits made during testing', async () => {
      const before = await http().get('/admin/stats').set('Authorization', `Bearer ${admin}`).expect(200);
      expect(before.body).toMatchObject({ patients: 12, visits: 16, testVisits: 0 });

      // A doctor's test visit, signed.
      const v = await t.db
        .insertInto('visits')
        .values({
          patient_id: G3,
          doctor_id: seedUuid('user:saiyam'),
          visit_date: '2026-11-20',
          diagnosis: 'test',
          icd10_code: null,
          follow_up: null,
          signed_at: null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await t.db
        .insertInto('consult_fields')
        .values({
          visit_id: v.id,
          section: 'complaint',
          key: 'chief_complaint',
          value: 'x',
          source: 'dictated',
          confidence: 0.9,
          original_language: 'gu',
          original_transcript: null,
        })
        .execute();
      await t.db
        .updateTable('visits')
        .set({ status: 'signed', signed_at: new Date() })
        .where('id', '=', v.id)
        .execute();

      const res = await http()
        .post('/admin/test-visits/clear')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body).toEqual({ deleted: 1 });
      const after = await http().get('/admin/stats').set('Authorization', `Bearer ${admin}`).expect(200);
      expect(after.body).toMatchObject({ visits: 16, testVisits: 0 });
    });

    it('Reset queue puts everyone back to Waiting and keeps history', async () => {
      await http().post(`/queue/${E2}/open`).set('Authorization', `Bearer ${samradnyee}`).expect(201);
      const res = await http().post('/admin/queue/reset').set('Authorization', `Bearer ${admin}`).expect(200);
      expect(res.body).toEqual({ reset: 12 });
      const q = await http().get('/queue').set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect((q.body as QueueEntry[]).every((e) => e.status === 'waiting')).toBe(true);
      const p = await http().get(`/patients/${E2}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(p.body.visits).toHaveLength(2);
    });

    it('seed is idempotent', async () => {
      const again = await seed(t.db);
      expect(again).toEqual({ users: 3, patients: 12, visitsCreated: 0 });
    });

    it('records every write in the audit log with user and time', async () => {
      const res = await http()
        .get('/admin/audit?limit=50')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      const actions = res.body.map((r: { action: string }) => r.action);
      expect(actions).toEqual(
        expect.arrayContaining(['queue.reset', 'visits.clear_test', 'POST /queue/:patientId/open']),
      );
      const conflict = res.body.find((r: { status_code: number }) => r.status_code === 409);
      expect(conflict).toMatchObject({ username: 'samradnyee', entity_id: G3 });
      expect(res.body.every((r: { at: string }) => Boolean(r.at))).toBe(true);
    });

    it('lists users', async () => {
      const res = await http().get('/admin/users').set('Authorization', `Bearer ${admin}`).expect(200);
      expect(res.body.map((u: { username: string }) => u.username)).toEqual([
        'admin',
        'saiyam',
        'samradnyee',
      ]);
    });
  });

  describe('remote sign-out and disable (DIG-32 / DIG-37)', () => {
    it('a token issued before remote sign-out is rejected; a fresh login works', async () => {
      const oldToken = await t.tokenFor('samradnyee', { iat: Math.floor(Date.now() / 1000) - 10 });
      await http().get('/me').set('Authorization', `Bearer ${oldToken}`).expect(200);
      await http()
        .post('/admin/users/Samradnyee/sign-out')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(t.cognito.calls).toContain('signOut:samradnyee');
      const res = await http().get('/me').set('Authorization', `Bearer ${oldToken}`).expect(401);
      expect(res.body.code).toBe('session_revoked');
      const fresh = await t.tokenFor('samradnyee', { iat: Math.floor(Date.now() / 1000) + 1 });
      await http().get('/me').set('Authorization', `Bearer ${fresh}`).expect(200);
    });

    it('a disabled user is rejected, and can be re-enabled', async () => {
      await http()
        .put('/admin/users/saiyam/enabled')
        .send({ enabled: false })
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      const res = await http().get('/me').set('Authorization', `Bearer ${saiyam}`).expect(401);
      expect(res.body.code).toBe('user_disabled');
      await http()
        .put('/admin/users/saiyam/enabled')
        .send({ enabled: true })
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(t.cognito.calls).toEqual(
        expect.arrayContaining(['setEnabled:saiyam:false', 'setEnabled:saiyam:true']),
      );
    });

    it('404s an unknown user', async () => {
      await http().post('/admin/users/nobody/sign-out').set('Authorization', `Bearer ${admin}`).expect(404);
    });
  });
});
