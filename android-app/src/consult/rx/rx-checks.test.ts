import type { AllergyClass, Medicine, RxLineInput } from '@swasthyaiq/shared';
import { allergyEntries, checkRx, genericBase, linesMissingEye, overridesFor } from '@swasthyaiq/shared';

const med = (
  id: string,
  generic: string,
  cls: string,
  allergy: AllergyClass[] = [],
  route: 'oral' | 'eye' = 'oral',
): Medicine => ({
  id,
  specialty: route === 'eye' ? 'eye' : 'gastro',
  generic,
  strength: '1 mg',
  form: route === 'eye' ? 'Eye drops' : 'Tablet',
  route,
  therapeuticClass: cls,
  allergyClasses: allergy,
  defaults: { dose: '1', frequency: '1-0-0-0', timing: null, duration: '5 days' },
});
const CAT = [
  med('amox', 'amoxicillin + clavulanic acid', 'penicillin', ['penicillin']),
  med('cefix', 'cefixime', 'cephalosporin', ['cephalosporin']),
  med('panto', 'pantoprazole', 'ppi'),
  med('rabe', 'rabeprazole', 'ppi'),
  med('diclo', 'diclofenac', 'nsaid', ['nsaid']),
  med('dorzo', 'dorzolamide', 'carbonic-anhydrase-inhibitor', ['sulfonamide'], 'eye'),
  med('cmc', 'carboxymethylcellulose', 'lubricant', [], 'eye'),
  med('cmcgel', 'carboxymethylcellulose gel', 'lubricant', [], 'eye'),
];
const line = (
  id: string,
  medicineId: string | null,
  generic: string,
  o: Partial<RxLineInput> = {},
): RxLineInput => ({
  id,
  medicineId,
  route: 'oral',
  medicineGeneric: generic,
  form: 'Tablet',
  eye: null,
  dose: '1',
  frequency: '1-0-0-0',
  timing: null,
  duration: '5 days',
  taper: null,
  instructionsEn: null,
  instructionsLocal: null,
  instructionsLanguage: null,
  ...o,
});
const rules = (
  lines: RxLineInput[],
  allergies: string[] = [],
  otherRx: Parameters<typeof checkRx>[0]['otherRx'] = [],
) => checkRx({ lines, catalogue: CAT, allergies, otherRx }).map((w) => `${w.rxLineId} ${w.rule}`);

describe('Rx advisory checks (DIG-71)', () => {
  it.each<[string, RxLineInput[], string[], string[]]>([
    [
      'penicillin allergy, amoxicillin',
      [line('a', 'amox', 'amoxicillin + clavulanic acid 625 mg')],
      ['penicillin'],
      ['a allergy:penicillin'],
    ],
    [
      'brand word in the allergy',
      [line('a', 'amox', 'amoxicillin + clavulanic acid 625 mg')],
      ['augmentin rash'],
      ['a allergy:penicillin'],
    ],
    [
      'penicillin allergy, cefixime cross-reaction',
      [line('c', 'cefix', 'cefixime 200 mg')],
      ['penicillin'],
      ['c allergy:penicillin-cephalosporin'],
    ],
    [
      'sulfa allergy, dorzolamide drops',
      [line('d', 'dorzo', 'dorzolamide 2%', { route: 'eye', eye: 'BE' })],
      ['sulpha drugs'],
      ['d allergy:sulfonamide'],
    ],
    [
      'NSAID allergy by drug name',
      [line('n', 'diclo', 'diclofenac 50 mg')],
      ['ibuprofen'],
      ['n allergy:nsaid'],
    ],
    [
      'free-typed medicine, class from its name',
      [line('f', null, 'ofloxacin 200 mg')],
      ['ciprofloxacin'],
      ['f allergy:fluoroquinolone'],
    ],
    [
      'free-typed medicine listed by name',
      [line('f', null, 'serratiopeptidase 10 mg')],
      ['serratiopeptidase'],
      ['f allergy:name'],
    ],
    ['no allergy match', [line('p', 'panto', 'pantoprazole 40 mg')], ['penicillin'], []],
  ])('%s', (_name, lines, allergies, expected) => {
    expect(rules(lines, allergies)).toEqual(expected);
  });

  it('flags the same medicine twice and two of one class, but not two lubricants', () => {
    expect(rules([line('1', 'panto', 'pantoprazole 40 mg'), line('2', null, 'pantoprazole 20 mg')])).toEqual([
      '2 duplicate:same-medicine',
    ]);
    expect(rules([line('1', 'panto', 'pantoprazole 40 mg'), line('2', 'rabe', 'rabeprazole 20 mg')])).toEqual(
      ['2 duplicate:class:ppi'],
    );
    expect(
      rules([
        line('1', 'cmc', 'carboxymethylcellulose 0.5%'),
        line('2', 'cmcgel', 'carboxymethylcellulose gel 1%'),
      ]),
    ).toEqual([]);
  });

  it('flags a medicine the other doctor already prescribes, by name or class', () => {
    const other = [
      { by: 'Dr. Saiyam', lines: [{ medicineId: null, medicineGeneric: 'pantoprazole 40 mg' }] },
    ];
    const w = checkRx({
      lines: [line('1', 'rabe', 'rabeprazole 20 mg')],
      catalogue: CAT,
      allergies: [],
      otherRx: [
        { by: 'Dr. Saiyam', lines: [{ medicineId: 'panto', medicineGeneric: 'pantoprazole 40 mg' }] },
      ],
    });
    expect(w.map((x) => x.text)).toEqual(['Dr. Saiyam already prescribes pantoprazole.']);
    expect(rules([line('1', null, 'pantoprazole 40 mg')], [], other)).toEqual(['1 duplicate:other-doctor']);
  });

  it('reads allergies from the list and the note, ignoring "no known allergies"', () => {
    expect(allergyEntries(['Penicillin', 'No known drug allergies'], 'Sulfa; dust\n')).toEqual([
      'penicillin',
      'sulfa',
      'dust',
    ]);
  });

  it('finds eye lines without an eye, and turns warnings into rule-only overrides', () => {
    expect(linesMissingEye([line('e', 'cmc', 'cmc', { route: 'eye' }), line('o', 'panto', 'p')])).toEqual([
      'e',
    ]);
    const w = checkRx({
      lines: [line('a', 'amox', 'amoxicillin + clavulanic acid 625 mg')],
      catalogue: CAT,
      allergies: ['penicillin', 'amoxicillin'],
      otherRx: [],
    });
    expect(overridesFor(w)).toEqual([{ rxLineId: 'a', kind: 'allergy', rule: 'allergy:penicillin' }]);
    expect(genericBase('amoxicillin + clavulanic acid 625 mg')).toBe('amoxicillin + clavulanic acid');
  });
});
