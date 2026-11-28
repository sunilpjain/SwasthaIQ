import request from 'supertest';
import type { PrintCopyInput, RxLineInput, SummaryDocument } from '@swasthyaiq/shared';
import { startApp, type TestApp } from './helpers';
import { seedUuid } from '../src/seed/seed';
import { summaryKey } from '../src/summary/summary.service';

/** Buffers a binary response body (supertest leaves PDFs unparsed otherwise). */
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('A4 consultation summary (DIG-72/73)', () => {
  let t: TestApp;
  let saiyam: string;
  let samradnyee: string;
  const http = () => request(t.app.getHttpServer());
  const G2 = seedUuid('patient:G2');
  const V = 'c1b2c3d4-0000-4000-8000-000000000001';
  const L1 = 'c1b2c3d4-0000-4000-8000-0000000000e1';
  const T0 = '2026-11-28T04:00:00.000Z';
  const rx: RxLineInput = {
    id: L1,
    medicineId: 'pantoprazole-40-tab',
    route: 'oral',
    medicineGeneric: 'pantoprazole 40 mg',
    form: 'Tablet',
    eye: null,
    dose: '1',
    frequency: '1-0-0-0',
    timing: '30 min before breakfast',
    duration: '2 weeks',
    taper: null,
    instructionsEn: null,
    instructionsLocal: 'સવારે · 1 · નાસ્તાના 30 મિનિટ પહેલાં · 2 અઠવાડિયા સુધી',
    instructionsLanguage: 'gu',
  };
  const pdf = (tok: string) =>
    http().get(`/visits/${V}/summary.pdf`).set('Authorization', `Bearer ${tok}`).buffer(true).parse(binary);
  const summary = async (): Promise<SummaryDocument> =>
    (await http().get(`/visits/${V}/summary`).set('Authorization', `Bearer ${saiyam}`).expect(200)).body;

  beforeAll(async () => {
    t = await startApp();
    saiyam = await t.tokenFor('saiyam');
    samradnyee = await t.tokenFor('samradnyee');
    await http()
      .put(`/visits/${V}`)
      .set('Authorization', `Bearer ${saiyam}`)
      .send({
        patientId: G2,
        fields: [
          {
            section: 'complaint',
            key: 'chief_complaint',
            value: 'Burning after meals',
            source: 'typed',
            confirmed: true,
            clientUpdatedAt: T0,
          },
          {
            section: 'plan',
            key: 'advice',
            value: 'Small meals; no late dinner',
            source: 'typed',
            confirmed: true,
            clientUpdatedAt: T0,
          },
        ],
        diagnoses: [{ kind: 'icd10', icd10Code: 'K21.9', label: 'GERD' }],
        diagnosesClientUpdatedAt: T0,
        investigations: [{ testName: 'LFT', testCode: 'ALT' }],
        investigationsClientUpdatedAt: T0,
        rxLines: [rx],
        rxClientUpdatedAt: T0,
      })
      .expect(200);
  });

  afterAll(async () => {
    await t.app.close();
    await t.db.destroy();
  });

  it('lays out the summary in the DIG-29 order, investigations before medicines', async () => {
    const doc = await summary();
    expect(doc).toMatchObject({
      clinic: 'Arihant Clinic',
      status: 'draft',
      doctor: {
        name: 'Dr. Saiyam Shah',
        registration: expect.stringMatching(/sample — not a real registration number/),
      },
    });
    const ids = doc.sections.map((s) => s.id);
    expect(ids.indexOf('diagnosis-icd-10')).toBeLessThan(ids.indexOf('investigation-order'));
    expect(ids.indexOf('investigation-order')).toBeLessThan(ids.indexOf('medication-order'));
    expect(ids.indexOf('medication-order')).toBeLessThan(ids.indexOf('advice'));
    const meds = doc.sections.find((s) => s.id === 'medication-order')?.medicines;
    expect(meds?.[0]).toMatchObject({ id: L1, drug: 'Pantoprazole 40 mg · Tablet', localLanguage: 'gu' });
    expect(meds?.[0]?.instruction).toMatch(/Qty 14/);
  });

  it('renders a draft live as a small A4 PDF', async () => {
    const res = await pdf(saiyam).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('inline; filename="consultation-summary-v1.pdf"');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeLessThan(300_000);
    expect(t.files.files.size).toBe(0); // drafts are not stored
  });

  it('stores the signed version from a background job and serves it from then on', async () => {
    await http().post(`/visits/${V}/sign`).set('Authorization', `Bearer ${saiyam}`).send({}).expect(200);
    await t.jobs.idle();
    const stored = t.files.files.get(summaryKey(V, 1));
    expect(stored?.contentType).toBe('application/pdf');
    const row = await t.db
      .selectFrom('visit_documents')
      .selectAll()
      .where('visit_id', '=', V)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ version: 1, s3_key: summaryKey(V, 1), bytes: stored?.body.length });
    // Both doctors can read it (prototype rule); it is the stored file.
    const res = await pdf(samradnyee).expect(200);
    expect(Buffer.compare(res.body as Buffer, stored!.body)).toBe(0);
  });

  it('renders each edited version as its own file (DIG-97)', async () => {
    await http()
      .post(`/visits/${V}/amendments`)
      .set('Authorization', `Bearer ${saiyam}`)
      .send({ id: 'c1b2c3d4-0000-4000-8000-0000000000a1', followUp: '2026-12-12' })
      .expect(200);
    await t.jobs.idle();
    expect(t.files.files.has(summaryKey(V, 2))).toBe(true);
    expect((await summary()).version).toBe(2);
  });

  it('renders a reworded print copy without changing the visit, and audits it without text', async () => {
    const before = await summary();
    const edits: PrintCopyInput = {
      version: before.version,
      sections: [{ id: 'advice', lines: ['Eat small meals. Nothing after 8 pm.'] }],
      medicines: [{ id: L1, instruction: 'One tablet every morning before breakfast, 2 weeks', local: null }],
    };
    const res = await http()
      .post(`/visits/${V}/print-copy`)
      .set('Authorization', `Bearer ${saiyam}`)
      .send(edits)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(/print-copy\.pdf/);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(await summary()).toEqual(before); // nothing written back
    const audit = await t.db
      .selectFrom('audit_log')
      .selectAll()
      .where('action', '=', 'visit.print_copy_edit')
      .executeTakeFirstOrThrow();
    expect(audit).toMatchObject({ entity_id: V, status_code: 200 });
    expect(JSON.stringify(audit)).not.toMatch(/Nothing after 8 pm/);
  });

  it('refuses a stale version, an unknown section, bad bodies and the other doctor', async () => {
    const send = (body: object, tok = saiyam) =>
      http().post(`/visits/${V}/print-copy`).set('Authorization', `Bearer ${tok}`).send(body);
    expect((await send({ version: 1, sections: [] }).expect(400)).body.code).toBe('print_copy_stale');
    expect((await send({ version: 2, sections: [{ id: 'nope', lines: [] }] }).expect(400)).body.code).toBe(
      'print_copy_stale',
    );
    await send({ version: 2, sections: [{ id: 'advice', lines: [42] }] }).expect(400);
    expect((await send({ version: 2, sections: [] }, samradnyee).expect(403)).body.code).toBe(
      'not_your_visit',
    );
  });
});
