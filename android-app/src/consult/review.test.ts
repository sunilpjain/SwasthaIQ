import type { DraftField } from './draft-store';
import { buildReview, diagnosisLine, signErrorCode } from './review';

const typed = (value: string): DraftField => ({ value, source: 'typed', confirmed: true, updatedAt: 'x' });
const now = new Date('2026-11-25T05:00:00Z');
const gerd = {
  kind: 'icd10' as const,
  icd10Code: 'K21.9',
  label: 'Gastro-esophageal reflux disease without esophagitis',
  role: 'primary' as const,
  certainty: 'provisional' as const,
};

describe('review before signing (DIG-95)', () => {
  it('lays out a gastro note in the DIG-29 order, skipping empty sections', () => {
    const r = buildReview({
      specialty: 'gastro',
      fields: {
        'complaint.chief_complaint': typed('Upper abdominal pain, 2 weeks\nBurning after meals'),
        'vitals.bp': typed('128/84'),
        'vitals.pulse': typed('82'),
        'exam.general': typed('Conscious, oriented'),
        'gastro.per_abdomen': typed('Soft, epigastric tenderness'),
        'gastro.alarm_features': typed('None'),
        'plan.plan_type': typed('Medical'),
        'plan.advice': typed('Small meals'),
      },
      diagnoses: [gerd],
      investigations: [{ testName: 'LFT', testCode: 'ALT' }],
      followUp: '2026-12-09',
      knownAllergies: [],
      now,
    });
    expect(r.sections.map((s) => s.title)).toEqual([
      'Chief complaints & history of present illness',
      'Allergy',
      'Physical evaluation',
      'Systemic examination',
      'Diagnosis (ICD-10)',
      'Investigation order',
      'Plan',
      'Advice',
      'Follow-up',
    ]);
    expect(r.sections[0]!.lines.map((l) => l.text)).toEqual([
      'Upper abdominal pain, 2 weeks',
      'Burning after meals',
    ]);
    expect(r.sections[1]!.lines[0]!.text).toBe('No known allergies');
    expect(r.sections[2]!.lines.map((l) => l.text)).toEqual([
      'BP 128/84 mmHg · Pulse 82 /min',
      'General: Conscious, oriented',
    ]);
    expect(r.sections[4]!.lines[0]!.text).toBe(
      'K21.9 Gastro-esophageal reflux disease without esophagitis — Primary · Provisional',
    );
    expect(r.sections[8]!.lines[0]!.text).toBe('In 2 weeks · Wed 9 Dec (9 Dec 2026)');
    expect(r.blocking).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('lays out an eye note: vision, IOP, per-eye exam, surgery plan', () => {
    const r = buildReview({
      specialty: 'eye',
      fields: {
        'eye.purpose': typed('Review'),
        'eye.re_va_unaided': typed('6/12'),
        'eye.le_va_unaided': typed('6/18'),
        'eye.re_iop': typed('18'),
        'eye.le_iop': typed('26'),
        'eye.iop_method': typed('Applanation'),
        'eye.re_lens': typed('Clear'),
        'eye.le_lens': typed('NS2'),
        'eye.cover_test': typed('Ortho'),
        'eye.dilatation': typed('OU'),
        'eye.dilatation_drug': typed('Tropicamide'),
        'eye.surgery_eye': typed('OS'),
        'eye.surgery_iol': typed('Monofocal'),
      },
      diagnoses: [
        { ...gerd, kind: 'icd10', icd10Code: 'H25.12', label: 'Nuclear cataract, left eye', eye: 'OS' },
      ],
      investigations: [],
      followUp: null,
      knownAllergies: ['Sulfonamides'],
      now,
    });
    const byTitle = Object.fromEntries(r.sections.map((s) => [s.title, s.lines.map((l) => l.text)]));
    expect(byTitle['Purpose of visit']).toEqual(['Review']);
    expect(byTitle['Vision & refraction']).toEqual(['Unaided: OD 6/12 · OS 6/18']);
    expect(byTitle.IOP).toEqual(['IOP: OD 18 mmHg · OS 26 mmHg (Applanation)']);
    expect(byTitle.Examination).toEqual(['Cover test: Ortho', 'Lens: OD Clear · OS NS2']);
    expect(byTitle.Dilatation).toEqual(['OU · Tropicamide']);
    expect(byTitle['Surgery plan']).toEqual(['OS · IOL: Monofocal']);
    expect(byTitle.Allergy).toEqual(['Known: Sulfonamides']);
    expect(byTitle['Diagnosis (ICD-10)']).toEqual([
      'H25.12 Nuclear cataract, left eye — OS · Primary · Provisional',
    ]);
    expect(r.warnings).toEqual([
      'No complaint or history written.',
      'IOP OS: Above 21 mmHg.',
      'No review date set.',
    ]);
  });

  it('blocks signing without a diagnosis or with unconfirmed dictated values, and only warns otherwise', () => {
    const r = buildReview({
      specialty: 'gastro',
      fields: {
        'complaint.chief_complaint': { value: 'Pain', source: 'dictated', confirmed: false, updatedAt: 'x' },
        'vitals.pulse': typed('820'),
      },
      diagnoses: [],
      investigations: [],
      followUp: null,
      knownAllergies: [],
      now,
    });
    expect(r.blocking).toEqual([
      'Add at least one diagnosis (ICD-10 or Misc).',
      'Confirm 1 dictated or scanned value.',
    ]);
    expect(r.warnings).toEqual(['Pulse: Check this value.', 'No follow-up set.']);
    expect(r.sections[0]!.lines[0]).toEqual({ text: 'Pain', source: 'dictated' });
  });

  it('describes diagnoses and error codes', () => {
    expect(diagnosisLine({ kind: 'misc', icd10Code: null, label: 'Post-op review' })).toBe(
      'Misc Post-op review — Co-morbidity · Final',
    );
    expect(signErrorCode(0, 'network')).toBe('SIGN-NET');
    expect(signErrorCode(503, 'http_503')).toBe('SIGN-503');
    expect(signErrorCode(0, 'not_saved')).toBe('SIGN-SAVE');
  });
});
