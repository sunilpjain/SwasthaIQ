import type { Medicine, OrderSet, RxLine } from '@swasthyaiq/shared';
import {
  addLines,
  dateRange,
  dosesPerDay,
  durationDays,
  lineFromMedicine,
  lineSig,
  lineTitle,
  linesFromLastRx,
  linesFromOrderSet,
  localInstruction,
  quantity,
  searchMedicines,
} from './rx-lines';

const med = (o: Partial<Medicine>): Medicine => ({
  id: 'pantoprazole-40-tab',
  specialty: 'gastro',
  generic: 'pantoprazole',
  strength: '40 mg',
  form: 'Tablet',
  route: 'oral',
  therapeuticClass: 'ppi',
  allergyClasses: [],
  defaults: { dose: '1', frequency: '1-0-0-0', timing: '30 min before breakfast', duration: '4 weeks' },
  ...o,
});
const PANTO = med({});
const MOXI = med({
  id: 'moxifloxacin-05-drops',
  specialty: 'eye',
  generic: 'moxifloxacin',
  strength: '0.5%',
  form: 'Eye drops',
  route: 'eye',
  therapeuticClass: 'fluoroquinolone',
  defaults: { dose: '1 drop', frequency: '1-1-1-1', timing: null, duration: '1 week' },
});
let n = 0;
const newId = () => `id-${++n}`;

describe('prescription builder helpers (DIG-70)', () => {
  it('makes a line from a catalogue medicine with its default sig and no eye yet', () => {
    const l = lineFromMedicine(MOXI, 'x');
    expect(l).toMatchObject({
      medicineId: 'moxifloxacin-05-drops',
      route: 'eye',
      medicineGeneric: 'moxifloxacin 0.5%',
      form: 'Eye drops',
      eye: null,
      frequency: '1-1-1-1',
    });
    expect(lineTitle(l)).toBe('Moxifloxacin 0.5% · Eye drops');
    expect(lineSig(l)).toBe('1 drop · 1-1-1-1 · eye? · 1 week');
    expect(lineSig({ ...l, eye: 'BE' })).toBe('1 drop · 1-1-1-1 · OU · 1 week');
  });

  it('adds order sets with their own sig, and skips medicines already on the Rx', () => {
    const set: OrderSet = {
      id: 'gerd',
      specialty: 'gastro',
      name: 'GERD',
      lines: [{ medicineId: 'pantoprazole-40-tab', duration: '8 weeks' }, { medicineId: 'missing' }],
    };
    const lines = linesFromOrderSet(set, [PANTO], newId);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.duration).toBe('8 weeks');
    expect(addLines(lines, [lineFromMedicine(PANTO, 'y')])).toHaveLength(1);
  });

  it('copies the last Rx as new lines without the brand', () => {
    const last = { ...lineFromMedicine(PANTO, 'old'), medicineBrand: 'Pan 40' } as RxLine;
    const [copy] = linesFromLastRx([last], newId);
    expect(copy).not.toHaveProperty('medicineBrand');
    expect(copy?.id).not.toBe('old');
  });

  it('searches by generic, strength, form or class', () => {
    expect(searchMedicines([PANTO, MOXI], 'panto').map((m) => m.id)).toEqual(['pantoprazole-40-tab']);
    expect(searchMedicines([PANTO, MOXI], 'eye drops').map((m) => m.id)).toEqual(['moxifloxacin-05-drops']);
    expect(searchMedicines([PANTO, MOXI], 'ppi 40')).toHaveLength(1);
    expect(searchMedicines([PANTO, MOXI], ' ')).toEqual([]);
  });

  it('works out quantity and dates for tablets and capsules', () => {
    expect(dosesPerDay('1-0-0-1')).toBe(2);
    expect(dosesPerDay('1-0-1')).toBe(2);
    expect(dosesPerDay('SOS')).toBeNull();
    expect(durationDays('2 weeks')).toBe(14);
    expect(durationDays('3 Months')).toBe(90);
    expect(durationDays('till review')).toBeNull();
    expect(quantity({ form: 'Tablet', dose: '1', frequency: '1-0-0-1', duration: '5 days' })).toBe(10);
    expect(
      quantity({ form: 'Eye drops', dose: '1 drop', frequency: '1-1-1-1', duration: '1 week' }),
    ).toBeNull();
    expect(quantity({ form: 'Tablet', dose: '1', frequency: 'SOS', duration: '5 days' })).toBeNull();
    expect(dateRange('14 days', '2026-11-20')).toBe('20 Nov → 03 Dec 2026');
    expect(dateRange('till review', '2026-11-20')).toBeNull();
  });

  it('writes the instruction line in Gujarati, Hindi and Marathi from fixed phrases', () => {
    const l = {
      ...lineFromMedicine(PANTO, 'x'),
      frequency: '1-0-0-1',
      timing: 'after food',
      duration: '5 days',
    };
    expect(localInstruction(l, 'gu')).toBe('સવારે, રાત્રે · 1 · જમ્યા પછી · 5 દિવસ સુધી');
    expect(localInstruction(l, 'hi')).toBe('सुबह, रात · 1 · खाने के बाद · 5 दिन तक');
    expect(localInstruction(l, 'mr')).toBe('सकाळी, रात्री · 1 · जेवणानंतर · 5 दिवस');
    const drop = { ...lineFromMedicine(MOXI, 'y'), eye: 'LE' as const };
    expect(localInstruction(drop, 'gu')).toBe('ડાબી આંખમાં · સવારે, બપોરે, સાંજે, રાત્રે · 1 drop · 1 અઠવાડિયા સુધી');
    expect(localInstruction({ ...l, frequency: 'SOS', timing: 'odd timing' }, 'hi')).toBe(
      'ज़रूरत होने पर · 1 · odd timing · 5 दिन तक',
    );
  });
});
