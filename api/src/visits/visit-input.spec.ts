import { BadRequestException } from '@nestjs/common';
import {
  LIMITS,
  parseAmendment,
  parseDiagnoses,
  parseDraft,
  parseInvestigations,
  parseRxLines,
} from './visit-input';
import { clampToNow, isSameDayEdit, istToday } from './visits.service';

const PATIENT = '11111111-1111-4111-8111-111111111111';
const AT = '2026-11-23T10:00:00.000Z';
const field = (o: Record<string, unknown> = {}) => ({
  section: 'complaint',
  key: 'chief_complaint',
  value: 'Burning pain after meals',
  source: 'typed',
  confirmed: true,
  clientUpdatedAt: AT,
  ...o,
});

function message(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    const body = (e as BadRequestException).getResponse() as { code: string; message: string };
    expect(body.code).toBe('invalid_body');
    return body.message;
  }
  throw new Error('expected a BadRequestException');
}

describe('parseDraft', () => {
  it('accepts a full draft and normalises ICD-10 codes', () => {
    const d = parseDraft({
      patientId: PATIENT,
      fields: [field()],
      diagnoses: [
        { kind: 'icd10', icd10Code: ' k21.0 ', label: ' GERD ' },
        { kind: 'misc', label: 'Post-op review' },
      ],
      diagnosesClientUpdatedAt: AT,
      followUp: '2026-12-07',
    });
    expect(d.fields).toHaveLength(1);
    // Tags default when left out: first Primary, the rest Co-morbidity, all Final (DIG-53).
    const defaults = { certainty: 'final', eye: null, diagnosedOn: null };
    expect(d.diagnoses).toEqual([
      { kind: 'icd10', icd10Code: 'K21.0', label: 'GERD', role: 'primary', ...defaults },
      { kind: 'misc', icd10Code: null, label: 'Post-op review', role: 'comorbidity', ...defaults },
    ]);
    expect(d.followUp).toBe('2026-12-07');
  });

  it('accepts a bare draft, an empty value and a cleared follow-up', () => {
    expect(parseDraft({ patientId: PATIENT })).toEqual({ patientId: PATIENT });
    expect(
      parseDraft({ patientId: PATIENT, fields: [field({ value: '' })], followUp: null }).followUp,
    ).toBeNull();
  });

  it.each<[string, unknown, RegExp]>([
    ['not an object', [], /^body must be a JSON object/],
    ['bad patient id', { patientId: 'G3' }, /^patientId must be a UUID/],
    ['fields not an array', { patientId: PATIENT, fields: {} }, /^fields must be an array/],
    ['field not an object', { patientId: PATIENT, fields: ['x'] }, /^fields\[0\] must be an object/],
    [
      'bad section',
      { patientId: PATIENT, fields: [field({ section: 'Chief Complaint' })] },
      /fields\[0\]\.section/,
    ],
    ['bad key', { patientId: PATIENT, fields: [field({ key: 1 })] }, /fields\[0\]\.key/],
    [
      'bad source',
      { patientId: PATIENT, fields: [field({ source: 'ai' })] },
      /fields\[0\]\.source must be one of/,
    ],
    [
      'bad confirmed',
      { patientId: PATIENT, fields: [field({ confirmed: 'yes' })] },
      /confirmed must be true or false/,
    ],
    ['value not a string', { patientId: PATIENT, fields: [field({ value: 5 })] }, /value must be a string/],
    [
      'missing timestamp',
      { patientId: PATIENT, fields: [field({ clientUpdatedAt: undefined })] },
      /clientUpdatedAt/,
    ],
    [
      'date-only timestamp',
      { patientId: PATIENT, fields: [field({ clientUpdatedAt: '2026-11-23' })] },
      /ISO 8601/,
    ],
    [
      'duplicate field',
      { patientId: PATIENT, fields: [field(), field()] },
      /complaint\.chief_complaint more than once/,
    ],
    ['diagnoses without time', { patientId: PATIENT, diagnoses: [] }, /^diagnosesClientUpdatedAt/],
    [
      'time without diagnoses',
      { patientId: PATIENT, diagnosesClientUpdatedAt: AT },
      /only allowed with diagnoses/,
    ],
    ['bad follow-up', { patientId: PATIENT, followUp: '7 Dec' }, /^followUp must be an ISO date/],
  ])('rejects %s', (_name, body, re) => {
    expect(message(() => parseDraft(body))).toMatch(re);
  });

  it('enforces size limits', () => {
    const long = 'x'.repeat(LIMITS.valueChars + 1);
    expect(message(() => parseDraft({ patientId: PATIENT, fields: [field({ value: long })] }))).toMatch(
      /at most/,
    );
    const many = Array.from({ length: LIMITS.fields + 1 }, (_, i) => field({ key: `k${i}` }));
    expect(message(() => parseDraft({ patientId: PATIENT, fields: many }))).toMatch(/at most 300 items/);
  });

  it('never echoes the submitted value in the error', () => {
    const msg = message(() =>
      parseDraft({ patientId: PATIENT, fields: [field({ value: 'Ramesh secret', source: 'x' })] }),
    );
    expect(msg).not.toContain('Ramesh');
  });
});

describe('parseDiagnoses', () => {
  it.each<[string, unknown, RegExp]>([
    ['not an object', ['GERD'], /\[0\] must be an object/],
    ['unknown kind', [{ kind: 'snomed', label: 'x' }], /kind must be one of icd10, misc/],
    ['empty label', [{ kind: 'misc', label: '  ' }], /label must not be empty/],
    ['misc with a code', [{ kind: 'misc', icd10Code: 'K21.0', label: 'x' }], /must be null for misc/],
    ['icd10 without a code', [{ kind: 'icd10', label: 'GERD' }], /must be an ICD-10 code/],
    ['malformed code', [{ kind: 'icd10', icd10Code: 'K2', label: 'GERD' }], /must be an ICD-10 code/],
  ])('rejects %s', (_name, v, re) => {
    expect(message(() => parseDiagnoses(v, 'diagnoses'))).toMatch(re);
  });

  it('keeps the tags the doctor set (DIG-53)', () => {
    expect(
      parseDiagnoses(
        [
          {
            kind: 'icd10',
            icd10Code: 'H25.13',
            label: 'Cataract',
            role: 'comorbidity',
            certainty: 'provisional',
            eye: 'OU',
            diagnosedOn: '2026-11-25',
          },
          { kind: 'icd10', icd10Code: 'E11.9', label: 'T2DM', role: 'primary' },
        ],
        'd',
      ),
    ).toEqual([
      {
        kind: 'icd10',
        icd10Code: 'H25.13',
        label: 'Cataract',
        role: 'comorbidity',
        certainty: 'provisional',
        eye: 'OU',
        diagnosedOn: '2026-11-25',
      },
      {
        kind: 'icd10',
        icd10Code: 'E11.9',
        label: 'T2DM',
        role: 'primary',
        certainty: 'final',
        eye: null,
        diagnosedOn: null,
      },
    ]);
  });

  it.each<[string, unknown, RegExp]>([
    ['bad role', [{ kind: 'misc', label: 'x', role: 'main' }], /role must be one of primary, comorbidity/],
    [
      'bad certainty',
      [{ kind: 'misc', label: 'x', certainty: 'sure' }],
      /certainty must be one of provisional, final/,
    ],
    ['RE instead of OD', [{ kind: 'misc', label: 'x', eye: 'RE' }], /eye must be one of OD, OS, OU/],
    ['bad date', [{ kind: 'misc', label: 'x', diagnosedOn: 'today' }], /diagnosedOn must be an ISO date/],
  ])('rejects a %s', (_name, v, re) => {
    expect(message(() => parseDiagnoses(v, 'd'))).toMatch(re);
  });

  it('accepts long eye codes', () => {
    expect(parseDiagnoses([{ kind: 'icd10', icd10Code: 'H40.1131', label: 'POAG' }], 'd')[0]!.icd10Code).toBe(
      'H40.1131',
    );
  });
});

describe('parseInvestigations (DIG-50)', () => {
  it('accepts tests with or without a lab code, and upper-cases the code', () => {
    expect(
      parseInvestigations(
        [
          { testName: ' Liver function tests ', testCode: 'alt' },
          { testName: 'USG abdomen' },
          { testName: 'ECG', testCode: null },
        ],
        'investigations',
      ),
    ).toEqual([
      { testName: 'Liver function tests', testCode: 'ALT' },
      { testName: 'USG abdomen', testCode: null },
      { testName: 'ECG', testCode: null },
    ]);
  });

  it.each<[string, unknown, RegExp]>([
    ['not an array', {}, /must be an array/],
    ['not an object', ['LFT'], /\[0\] must be an object/],
    ['no name', [{ testName: ' ' }], /testName must not be empty/],
    ['bad code', [{ testName: 'LFT', testCode: 'A-1' }], /testCode must be a lab test code/],
  ])('rejects %s', (_name, v, re) => {
    expect(message(() => parseInvestigations(v, 'investigations'))).toMatch(re);
  });

  it('needs a device time with the list, and only with the list', () => {
    expect(message(() => parseDraft({ patientId: PATIENT, investigations: [] }))).toMatch(
      /^investigationsClientUpdatedAt/,
    );
    expect(message(() => parseDraft({ patientId: PATIENT, investigationsClientUpdatedAt: AT }))).toMatch(
      /only allowed with investigations/,
    );
    expect(
      parseDraft({
        patientId: PATIENT,
        investigations: [{ testName: 'CBC', testCode: 'HB' }],
        investigationsClientUpdatedAt: AT,
      }).investigations,
    ).toEqual([{ testName: 'CBC', testCode: 'HB' }]);
  });
});

describe('parseRxLines (DIG-70)', () => {
  const ID = '33333333-3333-4333-8333-333333333333';
  const line = (o: Record<string, unknown> = {}) => ({
    id: ID,
    medicineId: 'moxifloxacin-05-drops',
    route: 'eye',
    medicineGeneric: ' moxifloxacin 0.5% ',
    form: 'Eye drops',
    eye: null,
    dose: '1 drop',
    frequency: '1-1-1-1',
    timing: '',
    duration: '1 week',
    ...o,
  });

  it('trims, fills the optional parts and allows a draft line without the eye', () => {
    expect(parseRxLines([line()], 'rxLines')).toEqual([
      {
        id: ID,
        medicineId: 'moxifloxacin-05-drops',
        route: 'eye',
        medicineGeneric: 'moxifloxacin 0.5%',
        form: 'Eye drops',
        eye: null,
        dose: '1 drop',
        frequency: '1-1-1-1',
        timing: null,
        duration: '1 week',
        taper: null,
        instructionsEn: null,
        instructionsLocal: null,
        instructionsLanguage: null,
      },
    ]);
  });

  it.each<[string, unknown, RegExp]>([
    ['bad id', [line({ id: 'x' })], /rxLines\[0\]\.id must be a UUID/],
    ['bad catalogue id', [line({ medicineId: 'Not An Id' })], /medicineId must be a catalogue id/],
    ['eye as OD', [line({ eye: 'OD' })], /eye must be one of RE, LE, BE/],
    [
      'english local line',
      [line({ instructionsLocal: 'x', instructionsLanguage: 'en' })],
      /must be mr, hi or gu/,
    ],
    ['local line without language', [line({ instructionsLocal: 'x' })], /is needed with instructionsLocal/],
    ['repeated id', [line(), line()], /more than once/],
    ['no medicine', [line({ medicineGeneric: ' ' })], /medicineGeneric must not be empty/],
  ])('refuses %s', (_name, body, re) => {
    expect(() => parseRxLines(body, 'rxLines')).toThrow(re);
  });
});

describe('parseAmendment', () => {
  const ID = '22222222-2222-4222-8222-222222222222';
  const amendField: Record<string, unknown> = field();
  delete amendField.clientUpdatedAt;

  it('accepts fields and diagnoses with a reason', () => {
    const a = parseAmendment({
      id: ID,
      reason: ' Lab report came back ',
      fields: [amendField],
      diagnoses: [{ kind: 'misc', label: 'x' }],
    });
    expect(a.reason).toBe('Lab report came back');
    expect(a.fields).toHaveLength(1);
  });

  it('accepts a same-day edit without a reason, and tests or follow-up alone (DIG-97)', () => {
    const a = parseAmendment({ id: ID, investigations: [{ testName: 'LFT' }], followUp: null });
    expect(a.reason).toBeUndefined();
    expect(a.investigations).toEqual([{ testName: 'LFT', testCode: null }]);
    expect(a.followUp).toBeNull();
    expect(parseAmendment({ id: ID, followUp: '2026-12-07' }).followUp).toBe('2026-12-07');
  });

  it.each<[string, unknown, RegExp]>([
    ['not an object', null, /^body must be a JSON object/],
    ['bad id', { id: 'x', reason: 'r', fields: [amendField] }, /^id must be a UUID/],
    ['no reason', { id: ID, reason: ' ', fields: [amendField] }, /reason must not be empty/],
    ['no changes', { id: ID, reason: 'r' }, /at least one field, the diagnoses/],
    ['empty fields', { id: ID, reason: 'r', fields: [] }, /at least one field, the diagnoses/],
    ['empty diagnoses', { id: ID, reason: 'r', diagnoses: [] }, /must not be empty/],
    [
      'unconfirmed field',
      { id: ID, reason: 'r', fields: [{ ...amendField, confirmed: false }] },
      /an amendment is final/,
    ],
    ['duplicate field', { id: ID, reason: 'r', fields: [amendField, amendField] }, /more than once/],
  ])('rejects %s', (_name, body, re) => {
    expect(message(() => parseAmendment(body))).toMatch(re);
  });
});

describe('time helpers', () => {
  it('gives the IST date, which turns over at 18:30 UTC', () => {
    expect(istToday(new Date('2026-11-23T18:29:59Z'))).toBe('2026-11-23');
    expect(istToday(new Date('2026-11-23T18:30:00Z'))).toBe('2026-11-24');
    // DIG-97: same IST day as the signing, so no reason needed; midnight IST ends it.
    const signed = new Date('2026-11-23T10:00:00Z');
    expect(isSameDayEdit(signed, new Date('2026-11-23T18:29:59Z'))).toBe(true);
    expect(isSameDayEdit(signed, new Date('2026-11-23T18:30:00Z'))).toBe(false);
    expect(isSameDayEdit(null, signed)).toBe(false);
  });
  it('never treats a device time as later than now', () => {
    const now = new Date('2026-11-23T10:00:00Z');
    expect(clampToNow('2026-11-23T11:00:00Z', now)).toEqual(now);
    expect(clampToNow('2026-11-23T09:00:00Z', now)).toEqual(new Date('2026-11-23T09:00:00Z'));
  });
});
