import request from 'supertest';
import type { PatientDetail, RxLineInput, VisitDetail } from '@swasthyaiq/shared';
import { startApp, type TestApp } from './helpers';
import { seedUuid } from '../src/seed/seed';

describe('prescription in the consult (DIG-70)', () => {
  let t: TestApp;
  let saiyam: string;
  const http = () => request(t.app.getHttpServer());
  const G5 = seedUuid('patient:G5');
  const V = 'b1b2c3d4-0000-4000-8000-000000000001';
  const L1 = 'b1b2c3d4-0000-4000-8000-0000000000c1';
  const L2 = 'b1b2c3d4-0000-4000-8000-0000000000c2';
  const T0 = '2026-11-28T04:00:00.000Z';
  const T1 = '2026-11-28T04:05:00.000Z';

  const line = (o: Partial<RxLineInput> = {}): RxLineInput => ({
    id: L1,
    medicineId: 'pantoprazole-40-tab',
    route: 'oral',
    medicineGeneric: 'pantoprazole 40 mg',
    form: 'Tablet',
    eye: null,
    dose: '1',
    frequency: '1-0-0-0',
    timing: '30 min before breakfast',
    duration: '4 weeks',
    taper: null,
    instructionsEn: null,
    instructionsLocal: 'સવારે નાસ્તા પહેલાં',
    instructionsLanguage: 'gu',
    ...o,
  });
  const put = (body: object) =>
    http()
      .put(`/visits/${V}`)
      .set('Authorization', `Bearer ${saiyam}`)
      .send({ patientId: G5, ...body });

  beforeAll(async () => {
    t = await startApp();
    saiyam = await t.tokenFor('saiyam');
  });

  afterAll(async () => {
    await t.app.close();
    await t.db.destroy();
  });

  it('saves the Rx with the draft and returns it', async () => {
    const res = await put({ rxLines: [line()], rxClientUpdatedAt: T1 }).expect(200);
    const v = res.body as VisitDetail;
    expect(v.rxLines).toEqual([{ ...line(), medicineBrand: null }]);
  });

  it('keeps the newest edit when saves arrive out of order', async () => {
    await put({ rxLines: [], rxClientUpdatedAt: T0 }).expect(200);
    const v = (await http().get(`/visits/${V}`).set('Authorization', `Bearer ${saiyam}`).expect(200))
      .body as VisitDetail;
    expect(v.rxLines).toHaveLength(1);
  });

  it('refuses a bad line without echoing it', async () => {
    const res = await put({ rxLines: [line({ eye: 'OD' as never })], rxClientUpdatedAt: T1 }).expect(400);
    expect(res.body.message).toBe('rxLines[0].eye must be one of RE, LE, BE');
    await put({ rxLines: [line(), line()], rxClientUpdatedAt: T1 }).expect(400);
    await put({ rxLines: [line()] }).expect(400); // no timestamp
  });

  it('shows the latest version’s Rx as the current medicines after an edit (DIG-97)', async () => {
    await put({
      diagnoses: [{ kind: 'icd10', icd10Code: 'K21.9', label: 'GERD' }],
      diagnosesClientUpdatedAt: T1,
    }).expect(200);
    await http().post(`/visits/${V}/sign`).set('Authorization', `Bearer ${saiyam}`).expect(200);
    const before = (await http().get(`/patients/${G5}`).set('Authorization', `Bearer ${saiyam}`).expect(200))
      .body as PatientDetail;
    expect(before.currentMedicines.find((r) => r.visitId === V)?.lines.map((l) => l.id)).toEqual([L1]);

    const edited = line({ id: L2, medicineId: 'rabeprazole-20-tab', medicineGeneric: 'rabeprazole 20 mg' });
    const v = (
      await http()
        .post(`/visits/${V}/amendments`)
        .set('Authorization', `Bearer ${saiyam}`)
        .send({ id: 'b1b2c3d4-0000-4000-8000-0000000000a1', rxLines: [edited] })
        .expect(200)
    ).body as VisitDetail;
    expect(v.rxLines.map((l) => l.medicineGeneric)).toEqual(['rabeprazole 20 mg']);
    const after = (await http().get(`/patients/${G5}`).set('Authorization', `Bearer ${saiyam}`).expect(200))
      .body as PatientDetail;
    expect(after.currentMedicines.find((r) => r.visitId === V)?.lines.map((l) => l.id)).toEqual([L2]);
  });

  describe('advisory checks (DIG-71)', () => {
    let samradnyee: string;
    const E5 = seedUuid('patient:E5');
    const VE = 'b1b2c3d4-0000-4000-8000-000000000002';
    const D1 = 'b1b2c3d4-0000-4000-8000-0000000000d1';
    const drop = line({
      id: D1,
      medicineId: 'dorzolamide-2-drops',
      route: 'eye',
      medicineGeneric: 'dorzolamide 2%',
      form: 'Eye drops',
      dose: '1 drop',
      frequency: '1-1-0-1',
      timing: null,
      instructionsLocal: null,
      instructionsLanguage: null,
    });
    const save = (body: object) =>
      http()
        .put(`/visits/${VE}`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .send({ patientId: E5, ...body });
    const sign = (body?: object) =>
      http()
        .post(`/visits/${VE}/sign`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .send(body ?? {});

    beforeAll(async () => {
      samradnyee = await t.tokenFor('samradnyee');
    });

    it('blocks signing until every eye medicine has OD / OS / OU', async () => {
      await save({
        rxLines: [drop],
        rxClientUpdatedAt: T0,
        diagnoses: [{ kind: 'icd10', icd10Code: 'H40.10X0', label: 'Open-angle glaucoma' }],
        diagnosesClientUpdatedAt: T0,
      }).expect(200);
      const res = await sign().expect(422);
      expect(res.body.problems).toEqual([{ code: 'rx_eye_missing', rxLines: [D1] }]);
    });

    it('signs once the eye is chosen, logging the warnings signed past (rule ids only)', async () => {
      await save({ rxLines: [{ ...drop, eye: 'BE' }], rxClientUpdatedAt: T1 }).expect(200);
      await sign({ overrides: [{ rxLineId: 'x', kind: 'allergy', rule: 'allergy:sulfonamide' }] }).expect(
        400,
      );
      await sign({ overrides: [{ rxLineId: D1, kind: 'allergy', rule: 'Allergy: sulfa!' }] }).expect(400);
      await sign({ overrides: [{ rxLineId: D1, kind: 'allergy', rule: 'allergy:sulfonamide' }] }).expect(200);
      const rows = await t.db.selectFrom('rx_overrides').selectAll().where('visit_id', '=', VE).execute();
      expect(rows).toEqual([
        expect.objectContaining({ rx_line_id: D1, kind: 'allergy', rule: 'allergy:sulfonamide' }),
      ]);
      await expect(t.db.deleteFrom('rx_overrides').execute()).rejects.toThrow(/append-only/);
    });

    it('refuses an edit that leaves an eye medicine without its eye', async () => {
      const res = await http()
        .post(`/visits/${VE}/amendments`)
        .set('Authorization', `Bearer ${samradnyee}`)
        .send({ id: 'b1b2c3d4-0000-4000-8000-0000000000a2', rxLines: [drop] })
        .expect(422);
      expect(res.body.problems[0].code).toBe('rx_eye_missing');
    });
  });
});
