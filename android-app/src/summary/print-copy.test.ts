import type { SummaryDocument } from '@swasthyaiq/shared';
import { printCopyInput, toEditable } from './print-copy';

const doc = {
  version: 3,
  sections: [
    { id: 'advice', title: 'Advice', lines: ['Small meals', 'No late dinner'] },
    { id: 'follow-up', title: 'Follow-up', lines: ['In 2 weeks'] },
    {
      id: 'medication-order',
      title: 'Medication order',
      lines: [],
      medicines: [
        {
          id: 'm1',
          drug: 'Pantoprazole',
          instruction: '1-0-0-0',
          taper: null,
          local: 'સવારે',
          localLanguage: 'gu',
        },
      ],
    },
  ],
} as unknown as SummaryDocument;

describe('print copy (DIG-73)', () => {
  it('sends only what the doctor changed, line by line', () => {
    const e = toEditable(doc);
    expect(e.sections.advice).toBe('Small meals\nNo late dinner');
    expect(printCopyInput(doc, e)).toEqual({ version: 3, sections: [] });
    e.sections.advice = 'Eat small meals.\n\n Nothing after 8 pm. ';
    e.medicines.m1 = { instruction: 'One tablet every morning', local: 'સવારે' };
    expect(printCopyInput(doc, e)).toEqual({
      version: 3,
      sections: [{ id: 'advice', lines: ['Eat small meals.', 'Nothing after 8 pm.'] }],
      medicines: [{ id: 'm1', instruction: 'One tablet every morning', local: 'સવારે' }],
    });
  });
});
