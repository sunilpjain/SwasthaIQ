import { BadRequestException } from '@nestjs/common';
import { parseAllergyInput, parseConditionInput, parseConditionUpdate } from './condition-input';

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

describe('parseConditionInput', () => {
  it('trims the name and normalises the ICD-10 code', () => {
    expect(
      parseConditionInput({
        name: ' Hypothyroidism ',
        icd10Code: 'e03.9',
        status: 'controlled',
        since: '2024-01-15',
      }),
    ).toEqual({ name: 'Hypothyroidism', icd10Code: 'E03.9', status: 'controlled', since: '2024-01-15' });
  });

  it('allows the code and start date to be left out', () => {
    expect(parseConditionInput({ name: 'Asthma', status: 'active', icd10Code: null })).toEqual({
      name: 'Asthma',
      icd10Code: null,
      status: 'active',
      since: null,
    });
  });

  it.each<[string, unknown, RegExp]>([
    ['not an object', 'Asthma', /^body must be a JSON object/],
    ['no name', { status: 'active' }, /^name must not be empty/],
    ['blank name', { name: '  ', status: 'active' }, /^name must not be empty/],
    ['long name', { name: 'x'.repeat(201), status: 'active' }, /at most 200/],
    [
      'bad code',
      { name: 'Asthma', icd10Code: 'asthma', status: 'active' },
      /^icd10Code must be an ICD-10 code/,
    ],
    [
      'bad status',
      { name: 'Asthma', status: 'cured' },
      /^status must be one of active, controlled, resolved/,
    ],
    ['bad date', { name: 'Asthma', status: 'active', since: '2024' }, /^since must be an ISO date/],
  ])('rejects %s', (_name, body, re) => {
    expect(message(() => parseConditionInput(body))).toMatch(re);
  });
});

describe('parseConditionUpdate', () => {
  it('accepts a status', () => {
    expect(parseConditionUpdate({ status: 'resolved' })).toEqual({ status: 'resolved' });
  });
  it('rejects anything else', () => {
    expect(message(() => parseConditionUpdate(null))).toMatch(/^body/);
    expect(message(() => parseConditionUpdate({ status: 'gone' }))).toMatch(/^status/);
  });
});

describe('parseAllergyInput (DIG-99)', () => {
  it('trims the name and rejects empty or long names', () => {
    expect(parseAllergyInput({ name: ' Latex ' })).toEqual({ name: 'Latex' });
    expect(message(() => parseAllergyInput({ name: '' }))).toMatch(/^name must not be empty/);
    expect(message(() => parseAllergyInput({ name: 'x'.repeat(101) }))).toMatch(/at most 100/);
    expect(message(() => parseAllergyInput(null))).toMatch(/^body/);
  });
});
