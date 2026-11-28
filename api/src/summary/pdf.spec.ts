import type { SummaryDocument } from '@swasthyaiq/shared';
import { pdfSafe, renderSummaryPdf, scriptRuns } from './pdf';
import { applyPrintCopy, PrintCopyMismatch } from './summary-document';

const doc: SummaryDocument = {
  visitId: 'v',
  version: 1,
  status: 'signed',
  clinic: 'Arihant Clinic',
  doctor: {
    name: 'Dr. Test',
    qualifications: 'MS',
    specialty: 'eye',
    registration: 'Reg. No. 00000 (sample)',
  },
  patient: { name: 'Test Patient', ageSex: '40 F', date: '28 Nov 2026' },
  sections: [
    { id: 'advice', title: 'Advice', lines: ['Rest'] },
    {
      id: 'medication-order',
      title: 'Medication order',
      lines: [],
      medicines: [
        {
          id: 'm1',
          drug: 'Timolol 0.5% · Eye drops · OU',
          instruction: '1 drop · 1-0-0-1 · 3 months · 28 Nov → 25 Feb 2027',
          taper: null,
          local: 'बंने डोळ्यांत · सकाळी, रात्री',
          localLanguage: 'mr',
        },
      ],
    },
  ],
  signedAt: '2026-11-28T05:00:00Z',
};

describe('A4 PDF (DIG-72)', () => {
  it('splits mixed-script text into font runs', () => {
    expect(scriptRuns('સવારે, रात्री · 1', 'Sans')).toEqual([
      { font: 'Guj', text: 'સવારે' },
      { font: 'Sans', text: ', ' },
      { font: 'Deva', text: 'रात्री' },
      { font: 'Sans', text: ' · 1' },
    ]);
    expect(pdfSafe('28 Nov → 11 Dec')).toBe('28 Nov – 11 Dec');
  });

  it('renders a small PDF, with or without print-copy edits', async () => {
    const plain = await renderSummaryPdf(doc);
    const edited = await renderSummaryPdf(doc, { printCopyEdited: true });
    for (const b of [plain, edited]) {
      expect(b.subarray(0, 5).toString()).toBe('%PDF-');
      expect(b.length).toBeLessThan(300_000);
    }
    expect(Buffer.compare(plain, edited)).not.toBe(0);
  });

  it('applies print-copy edits to a copy, and refuses a stale version or unknown parts', () => {
    const out = applyPrintCopy(doc, {
      version: 1,
      sections: [{ id: 'advice', lines: ['  Rest your eyes ', ''] }],
      medicines: [{ id: 'm1', instruction: 'One drop morning and night', local: ' ' }],
    });
    expect(out.sections[0]?.lines).toEqual(['Rest your eyes']);
    expect(out.sections[1]?.medicines?.[0]).toMatchObject({
      instruction: 'One drop morning and night',
      local: null,
      localLanguage: null,
    });
    expect(doc.sections[0]?.lines).toEqual(['Rest']); // the original is untouched
    expect(() => applyPrintCopy(doc, { version: 2, sections: [] })).toThrow(PrintCopyMismatch);
    expect(() => applyPrintCopy(doc, { version: 1, sections: [{ id: 'x', lines: [] }] })).toThrow(
      PrintCopyMismatch,
    );
    expect(() =>
      applyPrintCopy(doc, {
        version: 1,
        sections: [],
        medicines: [{ id: 'x', instruction: '', local: null }],
      }),
    ).toThrow(PrintCopyMismatch);
  });
});
