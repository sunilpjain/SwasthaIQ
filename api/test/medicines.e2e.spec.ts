import request from 'supertest';
import type { MedicineCatalogue, MedicineFavourite } from '@swasthyaiq/shared';
import { startApp, type TestApp } from './helpers';

describe('medicine catalogue (DIG-69)', () => {
  let t: TestApp;
  let saiyam: string;
  let samradnyee: string;
  let admin: string;
  const get = (path: string, tok: string) =>
    request(t.app.getHttpServer()).get(path).set('Authorization', `Bearer ${tok}`);

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

  it('lists the doctor’s specialty first, with only their order sets', async () => {
    const gastro = (await get('/medicines', saiyam).expect(200)).body as MedicineCatalogue;
    expect(gastro.note).toMatch(/not a validated formulary/);
    expect(gastro.medicines).toHaveLength(60);
    expect(gastro.medicines[0]?.specialty).toBe('gastro');
    expect(gastro.orderSets.map((o) => o.name)).toEqual(['GERD', 'IBS', 'Post-lap cholecystectomy']);
    const eye = (await get('/medicines', samradnyee).expect(200)).body as MedicineCatalogue;
    expect(eye.medicines[0]?.specialty).toBe('eye');
    expect(eye.orderSets.map((o) => o.id)).toEqual([
      'post-cataract',
      'glaucoma-starter',
      'allergic-conjunctivitis',
    ]);
  });

  it('learns favourites from the doctor’s own signed prescriptions', async () => {
    const fav = (await get('/medicines/favourites', saiyam).expect(200)).body as MedicineFavourite[];
    expect(fav[0]).toEqual({ medicineId: 'pantoprazole-40-tab', uses: 2 });
    expect(fav.map((f) => f.medicineId)).toEqual(
      expect.arrayContaining(['udca-300-tab', 'paracetamol-650-tab']),
    );
    const eye = (await get('/medicines/favourites', samradnyee).expect(200)).body as MedicineFavourite[];
    expect(eye.every((f) => !f.medicineId.endsWith('-tab') || f.medicineId.startsWith('acetazolamide'))).toBe(
      true,
    );
  });

  it('is for doctors only', async () => {
    await get('/medicines', admin).expect(403);
    await request(t.app.getHttpServer()).get('/medicines').expect(401);
  });
});
