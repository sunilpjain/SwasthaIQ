import { addEyeTag, EXAM_ROWS, eyeKey, eyeLabel, iopWarning, NORMAL_EXAM, normalFillFor } from './eye-fields';

describe('eye fields (DIG-52)', () => {
  it('stores per-eye values under the seed’s keys, never showing RE/LE', () => {
    expect(eyeKey('OD', 'iop')).toBe('eye.re_iop');
    expect(eyeKey('OS', 'fundus')).toBe('eye.le_fundus');
  });

  it('tags each complaint with its eye on a new line', () => {
    expect(addEyeTag('', 'OS')).toBe('OS: ');
    expect(addEyeTag('OS: blurred vision for 6 months', 'OD')).toBe('OS: blurred vision for 6 months\nOD: ');
    expect(addEyeTag('OS: blurred\n\n', 'OU')).toBe('OS: blurred\nOU: ');
  });

  it('shows prescription eyes as OD / OS / OU', () => {
    expect(eyeLabel('RE')).toBe('OD');
    expect(eyeLabel('LE')).toBe('OS');
    expect(eyeLabel('BE')).toBe('OU');
    expect(eyeLabel(null)).toBeNull();
  });

  it('flags high or unlikely IOP without blocking', () => {
    expect(iopWarning('18')).toBeNull();
    expect(iopWarning('26')).toBe('Above 21 mmHg');
    expect(iopWarning('180')).toBe('Check this value');
    expect(iopWarning('x')).toBe('Numbers only');
    expect(iopWarning('')).toBeNull();
  });

  it('"all normal" fills only empty cells for that eye (DIG-98)', () => {
    const values: Record<string, string> = { 'eye.re_lens': 'NS2', 'eye.re_pupil': '  ' };
    const fill = normalFillFor('OD', (k) => values[k] ?? '');
    const byKey = Object.fromEntries(fill);
    expect(byKey['eye.re_lens']).toBeUndefined(); // the doctor's NS2 is kept
    expect(byKey['eye.re_pupil']).toBe('RRR'); // blank counts as empty
    expect(byKey['eye.re_fundus']).toBe('Normal');
    expect(Object.keys(byKey).every((k) => k.startsWith('eye.re_'))).toBe(true); // OD only
    expect(fill).toHaveLength(8);
    // Second tap: nothing left to fill.
    for (const [k, v] of fill) values[k] = v;
    expect(normalFillFor('OD', (k) => values[k] ?? '')).toEqual([]);
  });

  it('has a normal value for every examination row', () => {
    expect(Object.keys(NORMAL_EXAM).sort()).toEqual(EXAM_ROWS.map((r) => r.key).sort());
  });
});
