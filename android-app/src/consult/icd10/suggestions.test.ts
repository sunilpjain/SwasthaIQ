import type { PatientCondition, VisitSummary } from '@swasthyaiq/shared';
import type { DraftField } from '../draft-store';
import { findCode } from './search';
import { GASTRO_RULES, suggestDiagnoses } from './suggestions';

const typed = (value: string): DraftField => ({ value, source: 'typed', confirmed: true, updatedAt: 'x' });
const ME = 'u-saiyam';
const base = { conditions: [], visits: [], chosen: [], myUserId: ME };
const codes = (s: { code: string }[]) => s.map((x) => x.code);

describe('suggested ICD-10 codes (DIG-100)', () => {
  it('every rule points at a code in the bundled list', () => {
    for (const r of GASTRO_RULES) expect(findCode(r.code)).toBeDefined();
    for (const c of [
      'H25.11',
      'H25.12',
      'H25.13',
      'H25.041',
      'H25.042',
      'H25.043',
      'H40.051',
      'H40.052',
      'H40.053',
    ]) {
      expect(findCode(c)).toBeDefined();
    }
  });

  it('gastro: epigastric burning suggests GERD and epigastric pain, with titles and reasons', () => {
    const s = suggestDiagnoses({
      ...base,
      specialty: 'gastro',
      fields: { 'complaint.chief_complaint': typed('Epigastric pain for 2 weeks, burning after meals') },
    });
    expect(codes(s)).toEqual(['K21.9', 'R10.13']);
    expect(s[0]).toMatchObject({
      label: 'Gastro-esophageal reflux disease without esophagitis',
      reason: 'Epigastric burning / reflux',
      eye: null,
    });
  });

  it('gastro: needs every part of a rule (epigastric alone is not GERD)', () => {
    const s = suggestDiagnoses({
      ...base,
      specialty: 'gastro',
      fields: { 'gastro.per_abdomen': typed('Soft, epigastric tenderness') },
    });
    expect(codes(s)).toEqual(['R10.13']);
  });

  it('eye: NS2 in one eye, NS1 in both, PSC and high IOP map to the right eye code', () => {
    const one = suggestDiagnoses({
      ...base,
      specialty: 'eye',
      fields: { 'eye.le_lens': typed('NS2'), 'eye.re_lens': typed('Clear') },
    });
    expect(one).toEqual([
      {
        code: 'H25.12',
        label: 'Age-related nuclear cataract, left eye',
        reason: 'From exam: nuclear sclerosis OS',
        eye: 'OS',
      },
    ]);
    const both = suggestDiagnoses({
      ...base,
      specialty: 'eye',
      fields: {
        'eye.re_lens': typed('NS1'),
        'eye.le_lens': typed('NS1'),
        'eye.re_iop': typed('26'),
        'eye.le_iop': typed('18'),
      },
    });
    expect(codes(both)).toEqual(['H25.13', 'H40.051']);
    expect(both[1]?.eye).toBe('OD');
    const psc = suggestDiagnoses({ ...base, specialty: 'eye', fields: { 'eye.re_lens': typed('PSC') } });
    expect(codes(psc)).toEqual(['H25.041']);
  });

  it('adds open coded conditions and this doctor’s past coded diagnoses, skipping invalid and chosen codes', () => {
    const conditions = [
      { id: 'c1', name: 'Type 2 diabetes', icd10Code: 'E11.9', status: 'controlled' },
      { id: 'c2', name: 'Hypertension', icd10Code: 'I10', status: 'resolved' },
      { id: 'c3', name: 'Asthma', icd10Code: null, status: 'active' },
    ] as PatientCondition[];
    const visits = [
      { id: 'v1', doctorId: ME, status: 'signed', visitDate: '2026-08-14', diagnosisCode: 'K21.0' }, // no longer a valid code
      { id: 'v2', doctorId: ME, status: 'signed', visitDate: '2026-07-10', diagnosisCode: 'K76.0' },
      { id: 'v3', doctorId: 'other', status: 'signed', visitDate: '2026-06-01', diagnosisCode: 'K80.20' },
    ] as VisitSummary[];
    const s = suggestDiagnoses({
      specialty: 'gastro',
      fields: {},
      conditions,
      visits,
      chosen: [{ kind: 'icd10', icd10Code: 'E11.9', label: 'T2DM' }],
      myUserId: ME,
    });
    // E11.9 already chosen, I10 resolved, K21.0 not in the 2026 list, K80.20 by the other doctor.
    expect(s).toEqual([
      {
        code: 'K76.0',
        label: 'Fatty (change of) liver, not elsewhere classified',
        reason: 'Your diagnosis on 10 Jul',
        eye: null,
      },
    ]);
  });

  it('offers each code once and at most six', () => {
    const s = suggestDiagnoses({
      ...base,
      specialty: 'gastro',
      fields: {
        'complaint.chief_complaint': typed(
          'epigastric burning, gallstones, fatty liver, constipation, diarrhoea, dysphagia, jaundice, inguinal hernia',
        ),
      },
      visits: [
        {
          id: 'v',
          doctorId: ME,
          status: 'signed',
          visitDate: '2026-01-01',
          diagnosisCode: 'K21.9',
        } as VisitSummary,
      ],
    });
    expect(s).toHaveLength(6);
    expect(new Set(codes(s)).size).toBe(6);
  });
});
