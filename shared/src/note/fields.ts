import type { CaptureSource } from '../index';

/** One consult-note field as the summary builders read it ("section.key" → value). */
export interface NoteField {
  value: string;
  source: CaptureSource;
  confirmed: boolean;
}
