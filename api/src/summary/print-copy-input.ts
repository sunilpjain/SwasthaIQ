import { BadRequestException } from '@nestjs/common';
import type { PrintCopyInput } from '@swasthyaiq/shared';

/** Checks for POST /visits/:id/print-copy. Messages name the path only, never the text. */

const ID_RE = /^[a-z0-9-]{1,80}$/i;
const MAX_LINE = 1_000;

function bad(path: string, problem: string): never {
  throw new BadRequestException({ code: 'invalid_body', message: `${path} ${problem}` });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown, path: string, allowNull = false): string | null {
  if (v === null && allowNull) return null;
  if (typeof v !== 'string') bad(path, 'must be a string');
  if (v.length > MAX_LINE) bad(path, `must be at most ${MAX_LINE} characters`);
  return v;
}

export function parsePrintCopy(body: unknown): PrintCopyInput {
  if (!isObject(body)) bad('body', 'must be a JSON object');
  if (!Number.isInteger(body.version) || (body.version as number) < 1)
    bad('version', 'must be a version number');
  if (!Array.isArray(body.sections) || body.sections.length > 40) bad('sections', 'must be a list');
  const sections = body.sections.map((s, i) => {
    if (!isObject(s) || typeof s.id !== 'string' || !ID_RE.test(s.id))
      bad(`sections[${i}].id`, 'must be a section id');
    if (!Array.isArray(s.lines) || s.lines.length > 60) bad(`sections[${i}].lines`, 'must be a list');
    return { id: s.id, lines: s.lines.map((l, j) => text(l, `sections[${i}].lines[${j}]`) as string) };
  });
  const out: PrintCopyInput = { version: body.version as number, sections };
  if (body.medicines !== undefined) {
    if (!Array.isArray(body.medicines) || body.medicines.length > 30) bad('medicines', 'must be a list');
    out.medicines = body.medicines.map((m, i) => {
      if (!isObject(m) || typeof m.id !== 'string' || !ID_RE.test(m.id))
        bad(`medicines[${i}].id`, 'must be an Rx line id');
      return {
        id: m.id,
        instruction: text(m.instruction, `medicines[${i}].instruction`) as string,
        local: text(m.local ?? null, `medicines[${i}].local`, true),
      };
    });
  }
  return out;
}
