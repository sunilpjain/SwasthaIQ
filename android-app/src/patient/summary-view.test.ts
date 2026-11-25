import type { PatientDetail, PrescriptionSummary, RxLine, VisitSummary } from '@swasthyaiq/shared';
import {
  currentMedicineRows,
  doctorLabel,
  labFlag,
  labText,
  lastVisitLines,
  maskPhone,
  medicineLine,
  pendingText,
  sharedLabel,
  shortDate,
  visitStatusLine,
} from './summary-view';

const ME = 'u-sam';
const SAIYAM = 'u-saiyam';

const line = (o: Partial<RxLine> = {}): RxLine => ({
  id: 'l1',
  medicineBrand: 'Brand',
  medicineGeneric: 'ursodeoxycholic acid 300 mg',
  form: 'Tablet',
  eye: null,
  dose: '1',
  frequency: '1-0-1',
  timing: null,
  duration: '3 months',
  taper: null,
  instructionsEn: null,
  instructionsLocal: null,
  instructionsLanguage: null,
  ...o,
});

const visit = (o: Partial<VisitSummary>): VisitSummary => ({
  id: 'v1',
  patientId: 'p',
  doctorId: ME,
  doctorName: 'Dr. Samradnyee Shah',
  doctorSpecialty: 'eye',
  visitDate: '2026-08-14',
  status: 'signed',
  version: 1,
  diagnosis: 'Early cataract OU',
  isSeed: true,
  ...o,
});

const rx = (o: Partial<PrescriptionSummary>): PrescriptionSummary => ({
  visitId: 'v1',
  visitDate: '2026-08-14',
  doctorId: ME,
  doctorName: 'Dr. Samradnyee Shah',
  doctorSpecialty: 'eye',
  advice: null,
  lines: [line()],
  ...o,
});

describe('patient summary view', () => {
  it('formats dates and masks the phone to its last 4 digits', () => {
    expect(shortDate('2026-08-14')).toBe('14 Aug');
    expect(shortDate('2026-10-16', true)).toBe('16 Oct 2026');
    expect(maskPhone('90000 10001')).toBe('Phone ••••0001');
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('12')).toBeNull();
  });

  it('names doctors as You or Dr. First name, and spots shared patients', () => {
    expect(doctorLabel(ME, 'Dr. Samradnyee Shah', ME)).toBe('You');
    expect(doctorLabel(SAIYAM, 'Dr. Saiyam Shah', ME)).toBe('Dr. Saiyam');
    expect(doctorLabel(SAIYAM, 'Admin', ME)).toBe('Admin');
    const both = [visit({}), visit({ id: 'v2', doctorId: SAIYAM, doctorName: 'Dr. Saiyam Shah' })];
    expect(sharedLabel(both, ME)).toBe('Shared: Dr. Samradnyee + Dr. Saiyam');
    expect(sharedLabel([visit({})], ME)).toBeNull();
  });

  it('lists current medicines from both doctors, mine first, with the eye for drops', () => {
    expect(
      medicineLine(line({ medicineGeneric: 'carboxymethylcellulose 0.5%', eye: 'BE', frequency: '1-1-1-1' })),
    ).toBe('Carboxymethylcellulose 0.5% OU · 1-1-1-1'); // stored as BE, shown as OU
    const rows = currentMedicineRows(
      [
        rx({ doctorId: SAIYAM, doctorName: 'Dr. Saiyam Shah', lines: [line({ id: 'a' })] }),
        rx({ lines: [line({ id: 'b' })] }),
      ],
      ME,
    );
    expect(rows.map((r) => [r.key, r.by])).toEqual([
      ['b', 'You'],
      ['a', 'Dr. Saiyam'],
    ]);
  });

  it('shows lab values with High / Low / Normal', () => {
    const hba1c = {
      testCode: 'HBA1C',
      testName: 'HbA1c',
      value: '8.1',
      unit: '%',
      refRange: null,
      flag: 'H' as const,
    };
    expect(labText(hba1c)).toBe('HbA1c 8.1 %');
    expect(labFlag(hba1c)).toEqual({ label: '▲ High', tone: 'high' });
    expect(labFlag({ ...hba1c, flag: 'L' }).tone).toBe('low');
    expect(labFlag({ ...hba1c, flag: null })).toEqual({ label: 'Normal', tone: 'normal' });
  });

  it('describes pending tests', () => {
    const base = { visitId: 'v', visitDate: '2026-10-16', doctorId: ME, doctorName: 'x' };
    expect(pendingText({ ...base, testName: 'OCT macula', testCode: null })).toBe(
      'OCT macula ordered 16 Oct — not done yet',
    );
    expect(pendingText({ ...base, testName: 'Liver function tests', testCode: 'ALT' })).toBe(
      'Liver function tests ordered 16 Oct — not received',
    );
  });

  it('summarises the last visit with its Rx', () => {
    const v = visit({});
    const d = { lastVisit: v, lastRx: rx({}) } as unknown as PatientDetail;
    expect(lastVisitLines(d, ME)).toEqual({
      meta: '14 Aug 2026 · You',
      diagnosis: 'Early cataract OU',
      rx: 'Rx: Ursodeoxycholic acid 300 mg · 1-0-1',
    });
    const noRx = { lastVisit: v, lastRx: rx({ visitId: 'older' }) } as unknown as PatientDetail;
    expect(lastVisitLines(noRx, ME)?.rx).toBeNull();
    expect(lastVisitLines({ lastVisit: null } as unknown as PatientDetail, ME)).toBeNull();
  });

  it('builds the header status line', () => {
    expect(visitStatusLine('9:45 am', '9:37 am')).toBe('Appt 9:45 am · checked in 9:37 am');
    expect(visitStatusLine('10:45 am', null)).toBe('Appt 10:45 am · not checked in');
    expect(visitStatusLine(null, null)).toBeNull();
  });
});
