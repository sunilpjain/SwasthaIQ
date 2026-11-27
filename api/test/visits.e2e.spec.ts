import request from 'supertest';
import { sql } from 'kysely';
import type { QueueEntry, VisitDetail } from '@swasthyaiq/shared';
import { startApp, type TestApp } from './helpers';
import { seedUuid } from '../src/seed/seed';

describe('visits and consult note (DIG-41)', () => {
  let t: TestApp;
  let saiyam: string;
  let samradnyee: string;
  let admin: string;
  const http = () => request(t.app.getHttpServer());
  const G3 = seedUuid('patient:G3');
  const G4 = seedUuid('patient:G4');
  const V1 = 'a1b2c3d4-0000-4000-8000-000000000001';
  const V2 = 'a1b2c3d4-0000-4000-8000-000000000002';
  const A1 = 'a1b2c3d4-0000-4000-8000-0000000000a1';
  const T0 = '2026-11-23T04:00:00.000Z';
  const T1 = '2026-11-23T04:05:00.000Z';
  const T2 = '2026-11-23T04:10:00.000Z';

  const complaint = (value: string, at: string, o: Record<string, unknown> = {}) => ({
    section: 'complaint',
    key: 'chief_complaint',
    value,
    source: 'typed',
    confirmed: true,
    clientUpdatedAt: at,
    ...o,
  });
  const gerd = { kind: 'icd10', icd10Code: 'K21.0', label: 'GERD' };
  const put = (id: string, tok: string, body: unknown) =>
    http()
      .put(`/visits/${id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send(body as object);
  const queueStatus = async (patientId: string): Promise<string | undefined> => {
    const q = await http().get('/queue').set('Authorization', `Bearer ${saiyam}`).expect(200);
    return (q.body as QueueEntry[]).find((e) => e.patient.id === patientId)?.status;
  };

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

  describe('draft save', () => {
    it('creates the draft on first save, owned by the doctor', async () => {
      const res = await put(V1, saiyam, {
        patientId: G3,
        fields: [complaint('Burning after meals', T0)],
        diagnoses: [gerd],
        diagnosesClientUpdatedAt: T0,
        followUp: '2026-12-07',
      }).expect(200);
      const v = res.body as VisitDetail;
      expect(v).toMatchObject({
        id: V1,
        patientId: G3,
        doctorId: seedUuid('user:saiyam'),
        doctorName: expect.any(String),
        status: 'draft',
        version: 1,
        signedAt: null,
        isSeed: false,
        diagnoses: [{ kind: 'icd10', icd10Code: 'K21.0', label: 'GERD' }],
        fields: [
          {
            section: 'complaint',
            key: 'chief_complaint',
            value: 'Burning after meals',
            source: 'typed',
            confirmed: true,
          },
        ],
        amendments: [],
      });
      expect(v.visitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('is idempotent: replaying the same save changes nothing and creates no second visit', async () => {
      const body = { patientId: G3, fields: [complaint('Burning after meals', T0)] };
      await put(V1, saiyam, body).expect(200);
      await put(V1, saiyam, body).expect(200);
      const n = await t.db
        .selectFrom('visits')
        .select(t.db.fn.countAll().as('n'))
        .where('patient_id', '=', G3)
        .where('is_seed', '=', false)
        .executeTakeFirstOrThrow();
      expect(Number(n.n)).toBe(1);
    });

    it('keeps the newest edit when offline saves arrive out of order', async () => {
      await put(V1, saiyam, {
        patientId: G3,
        fields: [complaint('Newer text', T2)],
        diagnoses: [gerd, { kind: 'misc', label: 'Anxiety' }],
        diagnosesClientUpdatedAt: T2,
      }).expect(200);
      const res = await put(V1, saiyam, {
        patientId: G3,
        fields: [complaint('Older text', T1), { ...complaint('72', T1), section: 'vitals', key: 'pulse' }],
        diagnoses: [],
        diagnosesClientUpdatedAt: T1,
      }).expect(200);
      const v = res.body as VisitDetail;
      expect(v.fields.find((f) => f.key === 'chief_complaint')?.value).toBe('Newer text');
      expect(v.fields.find((f) => f.key === 'pulse')?.value).toBe('72'); // a new field still lands
      expect(v.diagnoses.map((d) => d.label)).toEqual(['GERD', 'Anxiety']);
    });

    it('rejects another doctor, another patient, an unknown patient and a bad body', async () => {
      const other = await put(V1, samradnyee, { patientId: G3 }).expect(403);
      expect(other.body.code).toBe('not_your_patient'); // checked before the visit's owner (DIG-96)
      // DIG-96: a doctor can't start a note for the other doctor's patient (E3 is Dr. Samradnyee's).
      const notMine = await put('a1b2c3d4-0000-4000-8000-0000000000f0', saiyam, {
        patientId: seedUuid('patient:E3'),
      }).expect(403);
      expect(notMine.body.code).toBe('not_your_patient');
      const mismatch = await put(V1, saiyam, { patientId: G4 }).expect(409);
      expect(mismatch.body.code).toBe('patient_mismatch');
      await put(V2, saiyam, { patientId: '00000000-0000-4000-8000-000000000000' }).expect(404);
      const bad = await put(V1, saiyam, {
        patientId: G3,
        fields: [complaint('Ramesh', T0, { source: 'ai' })],
      }).expect(400);
      expect(bad.body.code).toBe('invalid_body');
      expect(JSON.stringify(bad.body)).not.toContain('Ramesh');
      await put('not-a-uuid', saiyam, { patientId: G3 }).expect(400);
      await put(V1, admin, { patientId: G3 }).expect(403);
    });
  });

  describe('sign', () => {
    it('is blocked without a diagnosis and with unconfirmed dictated fields', async () => {
      await put(V2, saiyam, {
        patientId: G4,
        fields: [complaint('Pain', T0, { source: 'dictated', confirmed: false })],
      }).expect(200);
      const res = await http()
        .post(`/visits/${V2}/sign`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(422);
      expect(res.body).toMatchObject({
        code: 'sign_blocked',
        problems: [
          { code: 'no_diagnosis' },
          { code: 'unconfirmed_fields', fields: ['complaint.chief_complaint'] },
        ],
      });
      const v = await http().get(`/visits/${V2}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(v.body.status).toBe('draft');
    });

    it('signs, locks the visit and sets the queue entry to Done in one go', async () => {
      await http().post(`/queue/${G3}/open`).set('Authorization', `Bearer ${saiyam}`).expect(201);
      expect(await queueStatus(G3)).toBe('in_consult');

      const res = await http()
        .post(`/visits/${V1}/sign`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      const v = res.body as VisitDetail;
      expect(v).toMatchObject({ status: 'signed', version: 1, diagnosis: 'GERD' });
      expect(v.signedAt).not.toBeNull();
      expect(await queueStatus(G3)).toBe('done');

      const row = await t.db
        .selectFrom('visits')
        .select(['icd10_code'])
        .where('id', '=', V1)
        .executeTakeFirstOrThrow();
      expect(row.icd10_code).toBe('K21.0');
      await expect(
        sql`UPDATE visit_diagnoses SET label = 'x' WHERE visit_id = ${V1}`.execute(t.db),
      ).rejects.toThrow(/read-only/);
    });

    it('returns the signed visit unchanged when the sign is retried', async () => {
      const before = await http().get(`/visits/${V1}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      const again = await http()
        .post(`/visits/${V1}/sign`)
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(again.body.signedAt).toBe(before.body.signedAt);
    });

    it('refuses draft saves after signing, and another doctor’s sign', async () => {
      const res = await put(V1, saiyam, { patientId: G3, fields: [complaint('late edit', T2)] }).expect(409);
      expect(res.body.code).toBe('visit_signed');
      const other = await http()
        .post(`/visits/${V2}/sign`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(403);
      expect(other.body.code).toBe('not_your_visit');
      await http()
        .post('/visits/00000000-0000-4000-8000-000000000000/sign')
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(404);
    });
  });

  describe('amendment', () => {
    const amendment = {
      id: A1,
      reason: 'Lab report came back',
      fields: [
        { section: 'plan', key: 'advice', value: 'Repeat LFT in 4 weeks', source: 'typed', confirmed: true },
      ],
      diagnoses: [gerd, { kind: 'icd10', icd10Code: 'K76.0', label: 'NAFLD' }],
    };
    const amend = (id: string, tok: string, body: unknown) =>
      http()
        .post(`/visits/${id}/amendments`)
        .set('Authorization', `Bearer ${tok}`)
        .send(body as object);

    it('adds a dated amendment, shows the latest version and keeps the signed rows as they were', async () => {
      const res = await amend(V1, saiyam, amendment).expect(200);
      const v = res.body as VisitDetail;
      expect(v.version).toBe(2);
      // DIG-97: the record shows the latest version…
      expect(v.diagnoses.map((d) => d.label)).toEqual(['GERD', 'NAFLD']);
      expect(v.fields.find((f) => f.key === 'advice')?.value).toBe('Repeat LFT in 4 weeks');
      expect(v.editedAt).toEqual(expect.any(String));
      // …while the signed rows are untouched.
      const rows = await t.db
        .selectFrom('visit_diagnoses')
        .select('label')
        .where('visit_id', '=', V1)
        .orderBy('position')
        .execute();
      expect(rows.map((r) => r.label)).toEqual(['GERD', 'Anxiety']);
      expect(v.amendments).toEqual([
        {
          id: A1,
          version: 2,
          amendedBy: seedUuid('user:saiyam'),
          amendedByName: expect.any(String),
          reason: 'Lab report came back',
          fields: amendment.fields,
          // Stored with the default tags (DIG-53).
          diagnoses: amendment.diagnoses.map((d, i) => ({
            ...d,
            role: i === 0 ? 'primary' : 'comorbidity',
            certainty: 'final',
            eye: null,
            diagnosedOn: null,
          })),
          investigations: null,
          createdAt: expect.any(String),
        },
      ]);
      const p = await http().get(`/patients/${G3}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      const listed = p.body.visits.find((x: { id: string }) => x.id === V1);
      expect(listed).toMatchObject({ version: 2, diagnosis: 'GERD', diagnosisCode: 'K21.0' });
      expect(listed.editedAt).toEqual(expect.any(String));
    });

    it('needs no reason on the signing day, and records it as "Same-day edit" (DIG-97)', async () => {
      const res = await amend(V1, saiyam, {
        id: 'a1b2c3d4-0000-4000-8000-0000000000b1',
        diagnoses: [{ kind: 'icd10', icd10Code: 'K76.0', label: 'NAFLD' }, gerd],
        investigations: [{ testName: 'Ultrasound abdomen', testCode: null }],
        followUp: '2026-12-21',
      }).expect(200);
      const v = res.body as VisitDetail;
      expect(v.amendments.at(-1)).toMatchObject({ reason: 'Same-day edit', followUp: '2026-12-21' });
      expect(v.investigations).toEqual([{ testName: 'Ultrasound abdomen', testCode: null }]);
      expect(v.followUp).toBe('2026-12-21');
      const p = await http().get(`/patients/${G3}`).set('Authorization', `Bearer ${saiyam}`).expect(200);
      expect(p.body.visits.find((x: { id: string }) => x.id === V1)).toMatchObject({
        diagnosis: 'NAFLD',
        diagnosisCode: 'K76.0',
      });
    });

    it('needs a reason for a visit signed on an earlier day', async () => {
      const res = await amend(seedUuid('visit:G1-v1'), saiyam, {
        id: 'a1b2c3d4-0000-4000-8000-0000000000b2',
        followUp: null,
      }).expect(422);
      expect(res.body.code).toBe('reason_required');
    });

    it('is idempotent on the amendment id, and versions further amendments', async () => {
      await amend(V1, saiyam, amendment).expect(200);
      const second = await amend(V1, saiyam, {
        id: 'a1b2c3d4-0000-4000-8000-0000000000a2',
        reason: 'Typo',
        diagnoses: [gerd],
      }).expect(200);
      expect(second.body.amendments.map((a: { version: number }) => a.version)).toEqual([2, 3, 4]);
      expect(second.body.version).toBe(4);
    });

    it('refuses drafts, other doctors, reused ids and bad bodies', async () => {
      const draft = await amend(V2, saiyam, {
        ...amendment,
        id: 'a1b2c3d4-0000-4000-8000-0000000000a9',
      }).expect(409);
      expect(draft.body.code).toBe('visit_not_signed');
      const other = await amend(V1, samradnyee, amendment).expect(403);
      expect(other.body.code).toBe('not_your_visit');
      const bad = await amend(V1, saiyam, { id: A1, reason: 'x' }).expect(400);
      expect(bad.body.code).toBe('invalid_body');
      const seedVisit = seedUuid('visit:G1-v1');
      const taken = await amend(seedVisit, saiyam, amendment).expect(409);
      expect(taken.body.code).toBe('amendment_id_taken');
    });

    it('keeps amendments append-only at the database level', async () => {
      await expect(
        sql`UPDATE visit_amendments SET reason = 'x' WHERE id = ${A1}`.execute(t.db),
      ).rejects.toThrow(/append-only/);
      await expect(sql`DELETE FROM visit_amendments WHERE id = ${A1}`.execute(t.db)).rejects.toThrow(
        /append-only/,
      );
    });
  });

  describe('read and audit', () => {
    it('returns a seed visit’s single diagnosis as a list', async () => {
      const res = await http()
        .get(`/visits/${seedUuid('visit:G1-v1')}`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(200);
      expect(res.body.diagnoses).toEqual([
        {
          kind: 'icd10',
          icd10Code: 'K21.0',
          label: expect.any(String),
          role: 'primary',
          certainty: 'final',
          eye: null,
          diagnosedOn: '2026-08-14',
        },
      ]);
      expect(res.body.signedAt).not.toBeNull();
    });

    it('audits every save, sign and amendment with the visit id, including refused ones', async () => {
      const rows = await t.db
        .selectFrom('audit_log')
        .select(['action', 'entity_id', 'status_code', 'username'])
        .where('action', 'like', 'visit.%')
        .execute();
      const seen = (action: string, status: number) =>
        rows.some((r) => r.action === action && r.status_code === status && r.entity_id !== null);
      expect(seen('visit.save_draft', 200)).toBe(true);
      expect(seen('visit.save_draft', 409)).toBe(true);
      expect(seen('visit.sign', 200)).toBe(true);
      expect(seen('visit.sign', 422)).toBe(true);
      expect(seen('visit.amend', 200)).toBe(true);
      expect(rows.find((r) => r.action === 'visit.sign' && r.status_code === 200)).toMatchObject({
        entity_id: V1,
        username: 'saiyam',
      });
    });

    it('Clear test visits removes test drafts, signed test visits and all amendments', async () => {
      const res = await http()
        .post('/admin/test-visits/clear')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body).toEqual({ deleted: 2 });
      const left = await t.db.selectFrom('visit_amendments').select('id').execute();
      expect(left).toHaveLength(0);
      await http().get(`/visits/${V1}`).set('Authorization', `Bearer ${saiyam}`).expect(404);
    });
  });

  describe('investigations and follow-up on the draft (DIG-50)', () => {
    const V3 = 'a1b2c3d4-0000-4000-8000-000000000003';
    const G5 = seedUuid('patient:G5');

    it('saves the ordered tests and the follow-up date, and returns them with the visit', async () => {
      const res = await put(V3, saiyam, {
        patientId: G5,
        investigations: [{ testName: 'USG abdomen' }, { testName: 'Liver function tests', testCode: 'alt' }],
        investigationsClientUpdatedAt: T1,
        followUp: '2026-12-08',
      }).expect(200);
      expect(res.body.investigations).toEqual([
        { testName: 'USG abdomen', testCode: null },
        { testName: 'Liver function tests', testCode: 'ALT' },
      ]);
      expect(res.body.followUp).toBe('2026-12-08');
    });

    it('keeps the newest list when offline saves arrive out of order, and can clear it', async () => {
      await put(V3, saiyam, {
        patientId: G5,
        investigations: [{ testName: 'CBC', testCode: 'HB' }],
        investigationsClientUpdatedAt: T2,
      }).expect(200);
      const stale = await put(V3, saiyam, {
        patientId: G5,
        investigations: [],
        investigationsClientUpdatedAt: T0,
        followUp: null,
      }).expect(200);
      expect(stale.body.investigations).toEqual([{ testName: 'CBC', testCode: 'HB' }]);
      expect(stale.body.followUp).toBeNull();
      const cleared = await put(V3, saiyam, {
        patientId: G5,
        investigations: [],
        investigationsClientUpdatedAt: new Date().toISOString(),
      }).expect(200);
      expect(cleared.body.investigations).toEqual([]);
    });
  });

  describe('diagnosis tags and favourites (DIG-53)', () => {
    const V4 = 'a1b2c3d4-0000-4000-8000-000000000004';
    const E3 = seedUuid('patient:E3');

    it('stores role, certainty, eye and date, defaulting the date to the visit date', async () => {
      const res = await put(V4, samradnyee, {
        patientId: E3,
        diagnoses: [
          {
            kind: 'icd10',
            icd10Code: 'E11.9',
            label: 'Type 2 diabetes mellitus without complications',
            role: 'comorbidity',
          },
          {
            kind: 'icd10',
            icd10Code: 'H25.13',
            label: 'Age-related nuclear cataract, bilateral',
            role: 'primary',
            certainty: 'provisional',
            eye: 'OU',
            diagnosedOn: '2026-11-20',
          },
        ],
        diagnosesClientUpdatedAt: new Date().toISOString(),
      }).expect(200);
      const v = res.body as VisitDetail;
      expect(v.diagnoses).toEqual([
        {
          kind: 'icd10',
          icd10Code: 'E11.9',
          label: 'Type 2 diabetes mellitus without complications',
          role: 'comorbidity',
          certainty: 'final',
          eye: null,
          diagnosedOn: v.visitDate,
        },
        {
          kind: 'icd10',
          icd10Code: 'H25.13',
          label: 'Age-related nuclear cataract, bilateral',
          role: 'primary',
          certainty: 'provisional',
          eye: 'OU',
          diagnosedOn: '2026-11-20',
        },
      ]);
    });

    it('signs with the diagnosis marked Primary on the visit list, not simply the first', async () => {
      const res = await http()
        .post(`/visits/${V4}/sign`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(200);
      expect(res.body.diagnosis).toBe('Age-related nuclear cataract, bilateral');
    });

    it('rejects RE / LE in place of OD / OS', async () => {
      const bad = await put('a1b2c3d4-0000-4000-8000-000000000005', samradnyee, {
        patientId: E3,
        diagnoses: [{ kind: 'misc', label: 'x', eye: 'RE' }],
        diagnosesClientUpdatedAt: new Date().toISOString(),
      }).expect(400);
      expect(bad.body.message).toMatch(/eye must be one of OD, OS, OU/);
    });

    it('lists each doctor’s most-used codes from their own visits, seed visits included', async () => {
      const sam = await http()
        .get('/diagnoses/favourites')
        .set('Authorization', `Bearer ${samradnyee}`)
        .expect(200);
      const codes = (sam.body as { icd10Code: string; uses: number }[]).map((f) => f.icd10Code);
      expect(codes).toEqual(expect.arrayContaining(['H25.13', 'E11.9']));
      expect(codes).not.toContain('K21.0'); // Dr. Saiyam's code
      const saiyamFav = await http()
        .get('/diagnoses/favourites')
        .set('Authorization', `Bearer ${saiyam}`)
        .expect(200);
      expect(saiyamFav.body[0]).toEqual({
        icd10Code: expect.any(String),
        label: expect.any(String),
        uses: expect.any(Number),
      });
      expect((saiyamFav.body as { icd10Code: string }[]).map((f) => f.icd10Code)).toContain('K80.20');
      await http().get('/diagnoses/favourites').set('Authorization', `Bearer ${admin}`).expect(403);
    });
  });
});
