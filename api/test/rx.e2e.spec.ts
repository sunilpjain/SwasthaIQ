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
});
