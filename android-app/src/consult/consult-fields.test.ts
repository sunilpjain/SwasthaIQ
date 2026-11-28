import {
  appendPhrase,
  FIELD,
  followUpDate,
  followUpLabel,
  hasPhrase,
  splitKey,
  toggleInvestigation,
  vitalWarning,
} from '@swasthyaiq/shared';

describe('consult fields', () => {
  it('splits section and key', () => {
    expect(splitKey(FIELD.complaint)).toEqual({ section: 'complaint', key: 'chief_complaint' });
  });

  it('tap-to-add appends a phrase once, after a comma or a full stop', () => {
    expect(appendPhrase('', 'Conscious, oriented')).toBe('Conscious, oriented');
    expect(appendPhrase('Conscious, oriented', 'Pallor')).toBe('Conscious, oriented, pallor');
    expect(appendPhrase('Conscious, oriented.', 'Pallor')).toBe('Conscious, oriented. Pallor');
    expect(appendPhrase('Conscious, oriented, pallor', 'Pallor')).toBe('Conscious, oriented, pallor');
    expect(appendPhrase('Conscious, oriented', 'NAD')).toBe('Conscious, oriented, NAD');
    expect(appendPhrase('Soft   ', 'Oedema')).toBe('Soft, oedema');
  });

  it('spots a phrase by whole words, any case', () => {
    expect(hasPhrase('No pallor or icterus', 'Pallor')).toBe(true);
    expect(hasPhrase('Lymphadenopathy absent', 'Lymphadenopathy')).toBe(true);
    expect(hasPhrase('NADPH', 'NAD')).toBe(false);
  });

  it('toggles ordered tests by name', () => {
    const lft = { testName: 'LFT', testCode: 'ALT' };
    const list = toggleInvestigation([], lft);
    expect(list).toEqual([lft]);
    expect(toggleInvestigation(list, { testName: 'lft', testCode: 'ALT' })).toEqual([]);
  });

  it('works out follow-up dates from today in IST', () => {
    const now = new Date('2026-11-24T20:00:00Z'); // already 25 Nov in IST
    expect(followUpDate(14, now)).toBe('2026-12-09');
    expect(followUpLabel('2026-12-09', now)).toBe('In 2 weeks · Wed 9 Dec');
    expect(followUpLabel('2026-11-26', now)).toBe('Tomorrow · Thu 26 Nov');
    expect(followUpLabel('2026-12-05', now)).toBe('In 10 days · Sat 5 Dec');
  });

  it('warns about likely typos in vitals but accepts normal values', () => {
    expect(vitalWarning(FIELD.bp, '128/84')).toBeNull();
    expect(vitalWarning(FIELD.bp, '12884')).toMatch(/systolic\/diastolic/);
    expect(vitalWarning(FIELD.bp, '80/120')).toBe('Check this value');
    expect(vitalWarning(FIELD.pulse, '82')).toBeNull();
    expect(vitalWarning(FIELD.pulse, '820')).toBe('Check this value');
    expect(vitalWarning(FIELD.temperature, '98.4')).toBeNull();
    expect(vitalWarning(FIELD.temperature, '37')).toBe('Check this value'); // °C typed into °F
    expect(vitalWarning(FIELD.spo2, 'ab')).toBe('Numbers only');
    expect(vitalWarning(FIELD.rbs, '')).toBeNull();
    expect(vitalWarning(FIELD.complaint, 'anything')).toBeNull();
  });
});
