import type { AllergyClass, Medicine, RxLineInput, RxOverride, RxWarningKind } from '../index';

/**
 * Advisory prescription checks (DIG-71). Deterministic rules with test tables, never AI.
 * Allergy and duplicate checks only warn; the doctor decides, and signing past a warning is
 * logged as an override. A missing eye on an eye medicine is a required field and blocks signing.
 */

export interface RxWarning {
  rxLineId: string;
  kind: RxWarningKind;
  /** Rule id stored with an override; never clinical text. */
  rule: string;
  text: string;
}

/** Words in an allergy entry that mean the patient is allergic to a drug class. */
export const ALLERGY_WORDS: Record<AllergyClass, RegExp> = {
  penicillin: /penicillin|amoxy?cillin|ampicillin|augmentin|cloxacillin|piperacillin|clavulan/,
  cephalosporin: /cephalosporin|\bcef|\bceph/,
  sulfonamide: /sulf|sulph|co-?trimoxazole|septran|bactrim/,
  nsaid: /nsaid|aspirin|ibuprofen|diclofenac|mefenamic|naproxen|ketorolac|aceclofenac|nimesulide|painkiller/,
  fluoroquinolone: /quinolone|floxacin/,
  aminoglycoside: /aminoglycoside|gentamicin|tobramycin|amikacin|neomycin/,
  nitroimidazole: /nidazole/,
  tetracycline: /tetracycline|doxycycline|minocycline/,
  opioid: /opioid|morphine|tramadol|codeine/,
};

const CLASS_NAME: Record<AllergyClass, string> = {
  penicillin: 'penicillin',
  cephalosporin: 'cephalosporin',
  sulfonamide: 'sulfa',
  nsaid: 'NSAID',
  fluoroquinolone: 'fluoroquinolone',
  aminoglycoside: 'aminoglycoside',
  nitroimidazole: 'nitroimidazole',
  tetracycline: 'tetracycline',
  opioid: 'opioid',
};

/** Therapeutic classes where two items together are usual (e.g. lubricant drops and gel). */
const CLASS_PAIRS_OK = new Set(['lubricant', 'laxative']);

/** "pantoprazole 40 mg" → "pantoprazole"; "amoxicillin + clavulanic acid 625 mg" → same text without strength. */
export function genericBase(medicineGeneric: string): string {
  return medicineGeneric
    .toLowerCase()
    .replace(/\s*\d[\d.,]*\s*(mg|g|ml|%|units|mcg).*$/, '')
    .trim();
}

const NO_ALLERGY = /^(no known|nkda|none|nil)/i;

/** Allergy entries from the patient's list and the note's allergy field, split on commas. */
export function allergyEntries(listed: string[], noteText: string): string[] {
  return [...listed, ...noteText.split(/[,;\n]/)]
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a && !NO_ALLERGY.test(a));
}

export interface CheckInput {
  lines: RxLineInput[];
  catalogue: Medicine[];
  /** From allergyEntries(). */
  allergies: string[];
  /** The other doctor's current prescription lines, with that doctor's label ("Dr. Saiyam"). */
  otherRx: { by: string; lines: Pick<RxLineInput, 'medicineId' | 'medicineGeneric'>[] }[];
}

export function checkRx(input: CheckInput): RxWarning[] {
  const byId = new Map(input.catalogue.map((m) => [m.id, m]));
  const med = (l: Pick<RxLineInput, 'medicineId'>) => (l.medicineId ? byId.get(l.medicineId) : undefined);
  const out: RxWarning[] = [];

  for (const l of input.lines) {
    const m = med(l);
    const base = genericBase(l.medicineGeneric);
    const name = base.charAt(0).toUpperCase() + base.slice(1);

    // Allergy: the medicine's class, or its own name, appears in an allergy entry.
    const classes = new Set<AllergyClass>(m?.allergyClasses ?? []);
    for (const [cls, re] of Object.entries(ALLERGY_WORDS) as [AllergyClass, RegExp][]) {
      if (re.test(base)) classes.add(cls);
    }
    const hits = new Set<string>();
    for (const a of input.allergies) {
      for (const cls of classes) {
        if (ALLERGY_WORDS[cls].test(a) && !hits.has(cls)) {
          hits.add(cls);
          out.push({
            rxLineId: l.id,
            kind: 'allergy',
            rule: `allergy:${cls}`,
            text: `${name}: ${CLASS_NAME[cls]} allergy recorded (“${a}”).`,
          });
        }
      }
      if (cross(classes, a) && !hits.has('cross')) {
        hits.add('cross');
        out.push({
          rxLineId: l.id,
          kind: 'allergy',
          rule: 'allergy:penicillin-cephalosporin',
          text: `${name}: penicillin allergy recorded; cephalosporins can cross-react.`,
        });
      }
      const firstWord = base.split(/[\s+]/)[0] ?? '';
      if (!classes.size && firstWord.length > 3 && a.includes(firstWord) && !hits.has('name')) {
        hits.add('name');
        out.push({
          rxLineId: l.id,
          kind: 'allergy',
          rule: 'allergy:name',
          text: `${name}: listed as an allergy.`,
        });
      }
    }
  }

  // Duplicates within this Rx: the same medicine (any strength or form), or two of one class.
  input.lines.forEach((l, i) => {
    const m = med(l);
    for (const e of input.lines.slice(0, i)) {
      const em = med(e);
      if (genericBase(e.medicineGeneric) === genericBase(l.medicineGeneric)) {
        out.push({
          rxLineId: l.id,
          kind: 'duplicate',
          rule: 'duplicate:same-medicine',
          text: `${genericBase(l.medicineGeneric)} is on this Rx twice.`,
        });
        return;
      }
      if (m && em && m.therapeuticClass === em.therapeuticClass && !CLASS_PAIRS_OK.has(m.therapeuticClass)) {
        out.push({
          rxLineId: l.id,
          kind: 'duplicate',
          rule: `duplicate:class:${m.therapeuticClass}`,
          text: `Two of the same kind (${m.therapeuticClass}): ${em.generic} and ${m.generic}.`,
        });
        return;
      }
    }
  });

  // Duplicates with the other doctor's current prescription.
  for (const l of input.lines) {
    const m = med(l);
    for (const other of input.otherRx) {
      const same = other.lines.find((o) => {
        if (genericBase(o.medicineGeneric) === genericBase(l.medicineGeneric)) return true;
        const om = med(o);
        return !!(
          m &&
          om &&
          m.therapeuticClass === om.therapeuticClass &&
          !CLASS_PAIRS_OK.has(m.therapeuticClass)
        );
      });
      if (same) {
        out.push({
          rxLineId: l.id,
          kind: 'duplicate',
          rule: 'duplicate:other-doctor',
          text: `${other.by} already prescribes ${genericBase(same.medicineGeneric)}.`,
        });
      }
    }
  }
  return out;
}

function cross(classes: Set<AllergyClass>, allergy: string): boolean {
  return classes.has('cephalosporin') && ALLERGY_WORDS.penicillin.test(allergy);
}

/** Eye-medicine lines still waiting for OD / OS / OU; these block signing. */
export function linesMissingEye(lines: RxLineInput[]): string[] {
  return lines.filter((l) => l.route === 'eye' && !l.eye).map((l) => l.id);
}

/** What the app sends with a sign or an edit: one override per warning, rule ids only. */
export function overridesFor(warnings: RxWarning[]): RxOverride[] {
  const seen = new Set<string>();
  return warnings.flatMap(({ rxLineId, kind, rule }) => {
    const key = `${rxLineId}|${rule}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ rxLineId, kind, rule }];
  });
}
