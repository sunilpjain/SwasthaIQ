import type { DiagnosisFavourite, EyeSide, Specialty } from '@swasthyaiq/shared';
import data from './icd10-codes.json';

/**
 * Offline ICD-10 search for the diagnosis picker (DIG-53), over the list bundled in the app
 * (scripts/build-icd10.mjs: CMS ICD-10-CM 2026, gastro, eye and common co-morbidity codes).
 */

export type CodeGroup = 'g' | 'e' | 'o';
export interface Icd10Code {
  code: string;
  title: string;
  group: CodeGroup;
}

const CODES: Icd10Code[] = (data.codes as [string, string, CodeGroup][]).map(([code, title, group]) => ({
  code,
  title,
  group,
}));
const BY_CODE = new Map(CODES.map((c) => [c.code, c]));

export const ICD10_SOURCE: string = data.source;

export function findCode(code: string): Icd10Code | undefined {
  return BY_CODE.get(code.toUpperCase());
}

/** The bundled titles use US spelling; doctors here type British. */
const SPELLING: [RegExp, string][] = [
  [/oesoph/g, 'esoph'],
  [/haem/g, 'hem'],
  [/oedem/g, 'edem'],
  [/anaem/g, 'anem'],
  [/diarrhoea/g, 'diarrhea'],
  [/faec/g, 'fec'],
  [/coeli/g, 'celi'],
  [/oestr/g, 'estr'],
  [/paediat/g, 'pediat'],
  [/colour/g, 'color'],
];

export function normalise(text: string): string {
  let t = text.toLowerCase().replace(/[^a-z0-9.\s-]/g, ' ');
  for (const [from, to] of SPELLING) t = t.replace(from, to);
  return t.replace(/\s+/g, ' ').trim();
}

const LOOKS_LIKE_CODE = /^[a-z]\d/;

/** Code prefix ("k21", "K21.9", "k219"), or every word as a word start in the title. */
function score(c: Icd10Code, q: string, words: string[]): number | null {
  if (LOOKS_LIKE_CODE.test(q)) {
    const bare = q.replace('.', '');
    const code = c.code.toLowerCase().replace('.', '');
    if (code === bare) return 0;
    if (code.startsWith(bare)) return 1 + code.length;
    return null;
  }
  const title = normalise(c.title);
  for (const w of words) {
    if (!new RegExp(`(^|[\\s(,-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) return null;
  }
  return (title.startsWith(words[0]!) ? 0 : 10) + title.length / 100;
}

export interface SearchSection {
  title: string;
  codes: Icd10Code[];
}

const GROUP_TITLE: Record<CodeGroup, string> = { g: 'Gastro', e: 'Eye', o: 'Other ICD-10' };

/**
 * Picker results in sections: Favourites, Recent, the doctor's specialty, then the rest
 * (the other specialty and common co-morbidities). Each code appears once.
 */
export function searchCodes(
  query: string,
  opts: { specialty: Specialty; favourites: DiagnosisFavourite[]; recent: string[]; limit?: number },
): SearchSection[] {
  const q = normalise(query);
  const words = q.split(' ').filter(Boolean);
  const limit = opts.limit ?? 30;
  const seen = new Set<string>();
  const sections: SearchSection[] = [];

  const add = (title: string, list: Icd10Code[]) => {
    const fresh = list.filter((c) => !seen.has(c.code));
    fresh.forEach((c) => seen.add(c.code));
    if (fresh.length) sections.push({ title, codes: fresh });
  };
  const matching = (list: Icd10Code[]) =>
    q
      ? list
          .map((c) => ({ c, s: score(c, q, words) }))
          .filter((x): x is { c: Icd10Code; s: number } => x.s !== null)
          .sort((a, b) => a.s - b.s || a.c.code.localeCompare(b.c.code))
          .map((x) => x.c)
      : list;

  // A favourite not in the bundled list (e.g. an older seed code) still shows, with its own label.
  const favCodes = opts.favourites.map(
    (f) => findCode(f.icd10Code) ?? { code: f.icd10Code, title: f.label, group: 'o' as const },
  );
  add('Your favourites', matching(favCodes));
  add('Recent', matching(opts.recent.map((r) => findCode(r)).filter((c): c is Icd10Code => !!c)));
  if (!q) return sections;

  const mine: CodeGroup = opts.specialty === 'eye' ? 'e' : 'g';
  add(GROUP_TITLE[mine], matching(CODES.filter((c) => c.group === mine)).slice(0, limit));
  add(GROUP_TITLE.o, matching(CODES.filter((c) => c.group !== mine)).slice(0, limit));
  return sections;
}

/** ICD-10-CM eye codes say which eye in the title; used as the starting OD / OS / OU tag. */
export function eyeFromTitle(title: string): EyeSide | null {
  const t = title.toLowerCase();
  if (t.includes('bilateral')) return 'OU';
  if (t.includes('right eye') || t.includes('right lower eyelid') || t.includes('right upper eyelid'))
    return 'OD';
  if (t.includes('left eye') || t.includes('left lower eyelid') || t.includes('left upper eyelid'))
    return 'OS';
  return null;
}

/** Recent picks on this phone, newest first (cleared when the app restarts). */
const recentPicks: string[] = [];

export function rememberPick(code: string): void {
  const i = recentPicks.indexOf(code);
  if (i >= 0) recentPicks.splice(i, 1);
  recentPicks.unshift(code);
  recentPicks.splice(10);
}

export function recentCodes(): string[] {
  return [...recentPicks];
}
