import { ALLERGY_CLASSES } from '@swasthyaiq/shared';
import { MEDICINES, ORDER_SETS } from './catalogue';

const FREQUENCY = /^([0-9½]-){3}[0-9½]$|^SOS$|× a day$|through the day$/;

describe('medicine catalogue (DIG-69)', () => {
  it('has about 30 items per specialty with unique ids and names', () => {
    for (const s of ['gastro', 'eye'] as const) {
      expect(MEDICINES.filter((m) => m.specialty === s)).toHaveLength(30);
    }
    expect(new Set(MEDICINES.map((m) => m.id)).size).toBe(MEDICINES.length);
    const names = MEDICINES.map((m) => `${m.generic} ${m.strength} ${m.form}`);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(MEDICINES.map((m) => [m.id, m] as const))('%s is complete and generic-only', (_id, m) => {
    expect(m.generic).toBe(m.generic.toLowerCase());
    expect(m.strength).not.toBe('');
    expect(m.defaults.dose).not.toBe('');
    expect(m.defaults.duration).not.toBe('');
    expect(m.defaults.frequency).toMatch(FREQUENCY);
    for (const a of m.allergyClasses) expect(ALLERGY_CLASSES).toContain(a);
    // Eye drops and ointments need an eye on every Rx line; tablets for the eye are oral.
    expect(m.route).toBe(/eye/i.test(m.form) ? 'eye' : 'oral');
  });

  it('has the six order sets, each pointing at medicines of its own specialty', () => {
    expect(ORDER_SETS.map((o) => o.name)).toEqual([
      'GERD',
      'IBS',
      'Post-lap cholecystectomy',
      'Post-cataract',
      'Glaucoma starter',
      'Allergic conjunctivitis',
    ]);
    for (const o of ORDER_SETS) {
      for (const l of o.lines) {
        const m = MEDICINES.find((x) => x.id === l.medicineId);
        expect(m?.specialty).toBe(o.specialty);
      }
    }
  });

  it('tags the allergy classes the safety check needs', () => {
    const tagged = (c: string) =>
      MEDICINES.filter((m) => (m.allergyClasses as string[]).includes(c)).map((m) => m.generic);
    expect(tagged('penicillin')).toContain('amoxicillin + clavulanic acid');
    expect(tagged('sulfonamide')).toEqual(
      expect.arrayContaining(['dorzolamide', 'brinzolamide', 'acetazolamide']),
    );
    expect(tagged('nsaid')).toEqual(expect.arrayContaining(['diclofenac', 'nepafenac', 'ketorolac']));
  });
});
