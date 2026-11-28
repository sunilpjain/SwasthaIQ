import type { PrintCopyInput, SummaryDocument } from '@swasthyaiq/shared';

/** The print-copy editor's state: one text box per section (lines joined), two per medicine. */
export interface EditableSummary {
  sections: Record<string, string>;
  medicines: Record<string, { instruction: string; local: string | null }>;
}

export function toEditable(doc: SummaryDocument): EditableSummary {
  const out: EditableSummary = { sections: {}, medicines: {} };
  for (const s of doc.sections) {
    if (s.medicines)
      for (const m of s.medicines) out.medicines[m.id] = { instruction: m.instruction, local: m.local };
    else out.sections[s.id] = s.lines.join('\n');
  }
  return out;
}

/** Only what the doctor changed is sent; the server renders it over the latest version. */
export function printCopyInput(doc: SummaryDocument, edit: EditableSummary): PrintCopyInput {
  const original = toEditable(doc);
  const sections = Object.entries(edit.sections)
    .filter(([id, text]) => text !== original.sections[id])
    .map(([id, text]) => ({
      id,
      lines: text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    }));
  const medicines = Object.entries(edit.medicines)
    .filter(
      ([id, m]) =>
        m.instruction !== original.medicines[id]?.instruction || m.local !== original.medicines[id]?.local,
    )
    .map(([id, m]) => ({ id, instruction: m.instruction, local: m.local }));
  return { version: doc.version, sections, ...(medicines.length ? { medicines } : {}) };
}
