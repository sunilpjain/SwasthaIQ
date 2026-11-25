import { eyeFromTitle, findCode, normalise, recentCodes, rememberPick, searchCodes } from './search';

const titles = (sections: ReturnType<typeof searchCodes>) => sections.map((s) => s.title);
const codes = (sections: ReturnType<typeof searchCodes>, title: string) =>
  sections.find((s) => s.title === title)?.codes.map((c) => c.code) ?? [];
const gastro = { specialty: 'gastro' as const, favourites: [], recent: [] };

describe('ICD-10 search (bundled, offline)', () => {
  it('has the clinic’s common codes', () => {
    expect(findCode('K21.9')?.title).toBe('Gastro-esophageal reflux disease without esophagitis');
    expect(findCode('k80.20')?.group).toBe('g');
    expect(findCode('H25.13')?.group).toBe('e');
    expect(findCode('E11.3299')?.group).toBe('e'); // diabetic retinopathy belongs with the eye codes
    expect(findCode('I10')?.group).toBe('o');
    expect(findCode('Z99.9')).toBeUndefined(); // outside the bundled groups: use Misc
  });

  it('finds by code prefix, with or without the dot', () => {
    expect(codes(searchCodes('K21.9', gastro), 'Gastro')[0]).toBe('K21.9');
    expect(codes(searchCodes('k219', gastro), 'Gastro')[0]).toBe('K21.9');
    expect(codes(searchCodes('K21', gastro), 'Gastro')).toEqual(
      expect.arrayContaining(['K21.00', 'K21.01', 'K21.9']),
    );
  });

  it('finds by words in the title, and accepts British spelling', () => {
    expect(codes(searchCodes('gastro reflux', gastro), 'Gastro')).toContain('K21.9');
    expect(codes(searchCodes('oesophagitis', gastro), 'Gastro').length).toBeGreaterThan(0);
    expect(codes(searchCodes('calculus gallbladder', gastro), 'Gastro')).toContain('K80.20');
    expect(normalise('Oesophageal varices, haemorrhage')).toBe('esophageal varices hemorrhage');
  });

  it('puts the doctor’s specialty first and the rest under Other ICD-10', () => {
    const eye = searchCodes('diabetes', { specialty: 'eye', favourites: [], recent: [] });
    expect(titles(eye)).toEqual(['Eye', 'Other ICD-10']);
    expect(codes(eye, 'Other ICD-10')).toContain('E11.9');
    const hypertension = searchCodes('essential hypertension', gastro);
    expect(codes(hypertension, 'Other ICD-10')).toContain('I10');
  });

  it('shows favourites and recent picks first, each code once', () => {
    rememberPick('K80.20');
    rememberPick('K21.9');
    rememberPick('K80.20');
    expect(recentCodes().slice(0, 2)).toEqual(['K80.20', 'K21.9']);
    const s = searchCodes('', {
      specialty: 'gastro',
      favourites: [
        { icd10Code: 'K21.9', label: 'GERD', uses: 4 },
        { icd10Code: 'K21.0', label: 'GERD with esophagitis', uses: 2 },
      ],
      recent: recentCodes(),
    });
    expect(titles(s)).toEqual(['Your favourites', 'Recent']);
    expect(codes(s, 'Your favourites')).toEqual(['K21.9', 'K21.0']); // K21.0 kept from the seed with its label
    expect(codes(s, 'Recent')).toEqual(['K80.20']);
    // Searching filters favourites too, and never repeats a code lower down.
    const g = searchCodes('reflux', {
      ...gastro,
      favourites: [{ icd10Code: 'K21.9', label: 'GERD', uses: 4 }],
    });
    expect(codes(g, 'Your favourites')).toEqual(['K21.9']);
    expect(codes(g, 'Gastro')).not.toContain('K21.9');
  });

  it('reads the eye from ICD-10-CM titles', () => {
    expect(eyeFromTitle('Age-related nuclear cataract, bilateral')).toBe('OU');
    expect(eyeFromTitle('Primary open-angle glaucoma, right eye, mild stage')).toBe('OD');
    expect(eyeFromTitle('Chalazion left upper eyelid')).toBe('OS');
    expect(eyeFromTitle('Gastro-esophageal reflux disease without esophagitis')).toBeNull();
  });
});
