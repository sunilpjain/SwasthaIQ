import type { Eye, Language, Medicine, OrderSet, RxLine, RxLineInput } from '@swasthyaiq/shared';
import { eyeLabel } from '../eye-fields';

/**
 * Prescription builder helpers (DIG-70). Pure functions so the rules are unit tested.
 * Generic names only; frequency is the 4-slot morning-noon-evening-night form (1-0-0-1).
 */

export type LocalLanguage = Exclude<Language, 'en'>;

export const FREQUENCY_CHIPS = ['1-0-0-0', '1-0-0-1', '1-1-0-1', '1-1-1-1', '0-0-0-1', 'SOS'] as const;
export const TIMING_CHIPS = ['before food', 'after food', '30 min before breakfast', 'with meals'] as const;
export const RX_DURATION_CHIPS = ['3 days', '5 days', '1 week', '2 weeks', '4 weeks', '3 months'] as const;
/** Shown as OD / OS / OU; stored as RE / LE / BE. */
export const EYE_CHOICES: { eye: Eye; label: string }[] = [
  { eye: 'RE', label: 'OD' },
  { eye: 'LE', label: 'OS' },
  { eye: 'BE', label: 'OU' },
];
export const LOCAL_LANGUAGES: { code: LocalLanguage; label: string }[] = [
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

export const medicineName = (m: Pick<Medicine, 'generic' | 'strength'>) => `${m.generic} ${m.strength}`;

export function lineFromMedicine(
  m: Medicine,
  id: string,
  sig: Partial<Medicine['defaults']> = {},
): RxLineInput {
  const d = { ...m.defaults, ...sig };
  return {
    id,
    medicineId: m.id,
    route: m.route,
    medicineGeneric: medicineName(m),
    form: m.form,
    eye: null, // eye lines: the doctor picks OD / OS / OU every time (DIG-71)
    dose: d.dose,
    frequency: d.frequency,
    timing: d.timing ?? null,
    duration: d.duration,
    taper: d.taper ?? null,
    instructionsEn: null,
    instructionsLocal: null,
    instructionsLanguage: null,
  };
}

/** A free-typed medicine that is not in the catalogue. */
export function lineFromText(name: string, id: string): RxLineInput {
  return {
    id,
    medicineId: null,
    route: null,
    medicineGeneric: name.trim().toLowerCase(),
    form: 'Tablet',
    eye: null,
    dose: '1',
    frequency: '1-0-0-0',
    timing: null,
    duration: '5 days',
    taper: null,
    instructionsEn: null,
    instructionsLocal: null,
    instructionsLanguage: null,
  };
}

export function linesFromOrderSet(set: OrderSet, catalogue: Medicine[], newId: () => string): RxLineInput[] {
  return set.lines.flatMap(({ medicineId, ...sig }) => {
    const m = catalogue.find((x) => x.id === medicineId);
    return m ? [lineFromMedicine(m, newId(), sig)] : [];
  });
}

/** "Copy last Rx": the lines of the doctor's last signed prescription, as new lines. */
export function linesFromLastRx(lines: RxLine[], newId: () => string): RxLineInput[] {
  return lines.map(({ medicineBrand: _brand, ...l }) => ({ ...l, id: newId() }));
}

/** Adds lines, skipping a medicine already on the Rx (same generic and form). */
export function addLines(current: RxLineInput[], added: RxLineInput[]): RxLineInput[] {
  const key = (l: RxLineInput) => `${l.medicineGeneric.toLowerCase()}|${l.form.toLowerCase()}`;
  const seen = new Set(current.map(key));
  return [
    ...current,
    ...added.filter((l) => {
      if (seen.has(key(l))) return false;
      seen.add(key(l));
      return true;
    }),
  ];
}

export function searchMedicines(catalogue: Medicine[], query: string, limit = 8): Medicine[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return catalogue
    .filter((m) => {
      const text = `${m.generic} ${m.strength} ${m.form} ${m.therapeuticClass}`.toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .slice(0, limit);
}

/** Doses a day from a slot frequency ("1-0-0-1" → 2); null for SOS or free text. */
export function dosesPerDay(frequency: string): number | null {
  if (!/^\d(-\d){2,3}$/.test(frequency.trim())) return null;
  return frequency.split('-').reduce((n, x) => n + Number(x), 0);
}

/** "5 days" → 5, "2 weeks" → 14, "3 months" → 90 (30-day months); null otherwise. */
export function durationDays(duration: string): number | null {
  const m = /^(\d+)\s*(day|week|month)s?$/i.exec(duration.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  return unit === 'day' ? n : unit === 'week' ? n * 7 : n * 30;
}

/** Tablets or capsules to dispense; null when it can't be worked out (drops, syrups, SOS). */
export function quantity(l: Pick<RxLineInput, 'form' | 'dose' | 'frequency' | 'duration'>): number | null {
  if (!/tablet|capsule/i.test(l.form) || !/^\d+$/.test(l.dose.trim())) return null;
  const perDay = dosesPerDay(l.frequency);
  const days = durationDays(l.duration);
  return perDay && days ? Number(l.dose) * perDay * days : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;

/** "28 Nov → 11 Dec 2026", starting on the visit date (ISO). Null when the duration is free text. */
export function dateRange(duration: string, startIso: string): string | null {
  const days = durationDays(duration);
  if (!days) return null;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(start.getTime() + (days - 1) * 86_400_000);
  return `${dayMonth(start)} → ${dayMonth(end)} ${end.getUTCFullYear()}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Pantoprazole 40 mg · Tablet" */
export function lineTitle(l: Pick<RxLineInput, 'medicineGeneric' | 'form'>): string {
  return `${capitalise(l.medicineGeneric)} · ${l.form}`;
}

/** "1-0-0-0 · OD · before food · 14 days · Qty 14" */
export function lineSig(l: RxLineInput): string {
  const eye = eyeLabel(l.eye);
  const qty = quantity(l);
  return [
    l.dose,
    l.frequency,
    l.route === 'eye' ? (eye ?? 'eye?') : l.route,
    l.timing,
    l.duration,
    qty ? `Qty ${qty}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ------------------------------------------------------------ local-language instruction line

interface Phrases {
  slots: [string, string, string, string];
  sos: string;
  timing: Record<string, string>;
  unit: { day: string; week: string; month: string };
  forDuration: (n: number, unit: string) => string;
  eye: Record<Eye, string>;
}

/**
 * Fixed phrases for the patient's instruction line (DIG-70). DRAFT for the doctors and clinic
 * staff to check; the doctor can edit the generated line before signing.
 */
const PHRASES: Record<LocalLanguage, Phrases> = {
  gu: {
    slots: ['સવારે', 'બપોરે', 'સાંજે', 'રાત્રે'],
    sos: 'જરૂર પડે ત્યારે',
    timing: {
      'before food': 'જમતા પહેલાં',
      'after food': 'જમ્યા પછી',
      '30 min before breakfast': 'નાસ્તાના 30 મિનિટ પહેલાં',
      'with meals': 'જમવા સાથે',
    },
    unit: { day: 'દિવસ', week: 'અઠવાડિયા', month: 'મહિના' },
    forDuration: (n, u) => `${n} ${u} સુધી`,
    eye: { RE: 'જમણી આંખમાં', LE: 'ડાબી આંખમાં', BE: 'બંને આંખોમાં' },
  },
  hi: {
    slots: ['सुबह', 'दोपहर', 'शाम', 'रात'],
    sos: 'ज़रूरत होने पर',
    timing: {
      'before food': 'खाने से पहले',
      'after food': 'खाने के बाद',
      '30 min before breakfast': 'नाश्ते से 30 मिनट पहले',
      'with meals': 'खाने के साथ',
    },
    unit: { day: 'दिन', week: 'हफ़्ते', month: 'महीने' },
    forDuration: (n, u) => `${n} ${u} तक`,
    eye: { RE: 'दाईं आँख में', LE: 'बाईं आँख में', BE: 'दोनों आँखों में' },
  },
  mr: {
    slots: ['सकाळी', 'दुपारी', 'संध्याकाळी', 'रात्री'],
    sos: 'गरज असल्यास',
    timing: {
      'before food': 'जेवणापूर्वी',
      'after food': 'जेवणानंतर',
      '30 min before breakfast': 'नाश्त्याच्या 30 मिनिटे आधी',
      'with meals': 'जेवणासोबत',
    },
    unit: { day: 'दिवस', week: 'आठवडे', month: 'महिने' },
    forDuration: (n, u) => `${n} ${u}`,
    eye: { RE: 'उजव्या डोळ्यात', LE: 'डाव्या डोळ्यात', BE: 'दोन्ही डोळ्यांत' },
  },
};

/**
 * The instruction line in Gujarati, Hindi or Marathi, built from the sig with fixed phrases:
 * "સવારે, રાત્રે · 1 · જમ્યા પછી · 5 દિવસ સુધી". Parts it has no phrase for are left in English.
 */
export function localInstruction(l: RxLineInput, lang: LocalLanguage): string {
  const p = PHRASES[lang];
  const parts: string[] = [];
  if (l.route === 'eye' && l.eye) parts.push(p.eye[l.eye]);
  if (l.frequency.trim().toUpperCase() === 'SOS') {
    parts.push(p.sos);
  } else if (dosesPerDay(l.frequency) !== null) {
    const slots = l.frequency.split('-');
    const four = slots.length === 3 ? [slots[0], slots[1], '0', slots[2]] : slots;
    parts.push(
      four
        .map((n, i) => (n !== '0' ? `${p.slots[i]}${n !== '1' ? ` ${n}` : ''}` : null))
        .filter(Boolean)
        .join(', '),
    );
  } else {
    parts.push(l.frequency);
  }
  parts.push(l.dose);
  if (l.timing) parts.push(p.timing[l.timing.toLowerCase()] ?? l.timing);
  const m = /^(\d+)\s*(day|week|month)s?$/i.exec(l.duration.trim());
  if (m) {
    const unit = p.unit[m[2]!.toLowerCase() as keyof Phrases['unit']];
    parts.push(p.forDuration(Number(m[1]), unit));
  } else if (l.duration) {
    parts.push(l.duration);
  }
  return parts.filter(Boolean).join(' · ');
}
